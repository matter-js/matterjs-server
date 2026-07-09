/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Duration, Logger, Minutes, Time, Timer } from "@matter/main";

const logger = Logger.get("WebSocketConnection");

/** The subset of a `ws` WebSocket this connection drives. */
export interface OutboundSocket {
    readonly bufferedAmount: number;
    readonly readyState: number;
    send(data: string, cb?: (err?: Error) => void): void;
    close(code?: number, reason?: string): void;
    terminate(): void;
}

export type SendMode = "direct" | "queued";

const OPEN = 1;

export interface WebSocketConnectionOptions {
    connId: string;
    /**
     * Floor for the direct→queued trip point on `ws.bufferedAmount` (bytes). The effective mark rises
     * dynamically to twice the largest frame ever sent (capped at {@link highWaterCeilingBytes}), so a
     * single legitimately large payload (e.g. the initial node dump) never trips congestion.
     */
    highWaterBytes?: number;
    /** Absolute ceiling for the dynamic high-water mark (bytes), bounding the memory a stall can hold. */
    highWaterCeilingBytes?: number;
    /** Outbox entry-count cap floor. */
    capBase?: number;
    /** Per-node contribution to the outbox cap: cap = max(capBase, nodeCount * capPerNode). */
    capPerNode?: number;
    /** How long an in-flight send may stall before the connection is treated as dead and closed. */
    watchdog?: Duration;
    getNodeCount?: () => number;
}

interface OutboxEntry {
    /** Produces the wire frame lazily at send time; returns undefined to skip (e.g. the node is gone). */
    build: () => string | undefined;
    /** Ordered entries (events/structural) are droppable oldest-first under the cap; coalescables are not. */
    ordered: boolean;
}

const DEFAULT_HIGH_WATER = 1_048_576;
const DEFAULT_HIGH_WATER_CEILING = 50 * 1_048_576;
const DEFAULT_CAP_BASE = 1000;
const DEFAULT_CAP_PER_NODE = 20;
const DEFAULT_WATCHDOG = Minutes(5);

/**
 * Per-connection adaptive send path with backpressure (docs/plans/ws-backpressure.md).
 *
 * In **direct** mode every send hits the socket immediately in emit order — zero overhead for the
 * common case. When a send pushes `ws.bufferedAmount` over the high-water mark the connection flips
 * to **queued** mode: frames go into a single ordered outbox drained one-at-a-time, each next send
 * gated on the prior send's flush callback so the socket's own drain rate paces output and
 * `bufferedAmount` stays near one frame. Attribute/node-snapshot sends coalesce latest-wins per key;
 * events are FIFO and, past the cap, dropped oldest-first. A stalled in-flight send trips a watchdog
 * that closes the dead connection. The outbox empties → back to direct mode.
 */
export class WebSocketConnection {
    readonly #ws: OutboundSocket;
    readonly #connId: string;
    readonly #highWaterCeiling: number;
    /** Effective trip point; ratchets up to 2x the largest frame sent, capped at #highWaterCeiling. */
    #highWater: number;
    readonly #capBase: number;
    readonly #capPerNode: number;
    readonly #getNodeCount: () => number;
    readonly #watchdogTimer: Timer;

    #mode: SendMode = "direct";
    readonly #outbox = new Map<string, OutboxEntry>();
    #inFlight = false;
    #seq = 0;
    #disposed = false;
    #capWarned = false;

    constructor(ws: OutboundSocket, options: WebSocketConnectionOptions) {
        this.#ws = ws;
        this.#connId = options.connId;
        this.#highWaterCeiling = options.highWaterCeilingBytes ?? DEFAULT_HIGH_WATER_CEILING;
        // Clamp the floor to the ceiling so a misconfigured floor > ceiling can't start the mark
        // above its cap (it only ever ratchets up, so it would never come back down).
        this.#highWater = Math.min(options.highWaterBytes ?? DEFAULT_HIGH_WATER, this.#highWaterCeiling);
        this.#capBase = options.capBase ?? DEFAULT_CAP_BASE;
        this.#capPerNode = options.capPerNode ?? DEFAULT_CAP_PER_NODE;
        this.#getNodeCount = options.getNodeCount ?? (() => 0);
        this.#watchdogTimer = Time.getTimer(
            `ws-backpressure-watchdog-${this.#connId}`,
            options.watchdog ?? DEFAULT_WATCHDOG,
            () => this.#onWatchdog(),
        );
    }

    get connId(): string {
        return this.#connId;
    }

    get mode(): SendMode {
        return this.#mode;
    }

    get outboxSize(): number {
        return this.#outbox.size;
    }

    /**
     * Critical frames (command responses, server info, shutdown): always sent immediately, never
     * queued or dropped. HA matches responses by message id, so jumping the queue is harmless.
     */
    sendReliable(frame: string): void {
        if (this.#disposed) return;
        this.#directSend(frame);
    }

    /** Non-coalescable ordered push (node events, structural changes): FIFO, droppable oldest-first under cap. */
    sendOrdered(frame: string): void {
        if (this.#disposed) return;
        if (this.#mode === "direct") {
            this.#directSend(frame);
            return;
        }
        this.#enqueue(`seq:${this.#seq++}`, { build: () => frame, ordered: true });
    }

    /**
     * Coalescing push (attribute updates, node snapshots): repeated sends with the same key collapse
     * to one, latest-wins, keeping the first occurrence's position. `build` is invoked once, lazily,
     * at actual send time — so a superseded value is never built and a heavy snapshot is built only
     * for the entry that survives coalescing.
     */
    sendCoalescable(key: string, build: () => string | undefined): void {
        if (this.#disposed) return;
        if (this.#mode === "direct") {
            const frame = build();
            if (frame !== undefined) this.#directSend(frame);
            return;
        }
        this.#enqueue(key, { build, ordered: false });
    }

    /** Release timers and drop any queued frames; call when the connection closes. */
    dispose(): void {
        this.#disposed = true;
        this.#watchdogTimer.stop();
        this.#outbox.clear();
    }

    #directSend(frame: string): void {
        if (this.#ws.readyState !== OPEN) return;
        this.#raiseHighWater(frame);
        this.#ws.send(frame);
        if (this.#mode === "direct" && this.#ws.bufferedAmount > this.#highWater) {
            this.#mode = "queued";
            logger.warn(
                `[${this.#connId}] outbound congested (bufferedAmount=${this.#ws.bufferedAmount} > ${this.#highWater}) — entering backpressure mode`,
            );
        }
    }

    /** Grow the trip point to twice the largest frame seen (capped), so one big frame never trips it. */
    #raiseHighWater(frame: string): void {
        const need = Math.min(this.#highWaterCeiling, 2 * Buffer.byteLength(frame));
        if (need > this.#highWater) this.#highWater = need;
    }

    #enqueue(key: string, entry: OutboxEntry): void {
        this.#outbox.set(key, entry);
        this.#enforceCap();
        this.#drain();
    }

    // Only ordered (event) entries are droppable. Coalescable entries are self-bounding: one per
    // distinct key, and keys map to the finite Matter data model (attribute paths / node ids / Thread
    // networks), so their count cannot grow without bound. A connection stuck long enough for even
    // that finite set to matter is caught by the watchdog.
    #enforceCap(): void {
        const cap = Math.max(this.#capBase, this.#getNodeCount() * this.#capPerNode);
        if (this.#outbox.size <= cap) return;
        let dropped = 0;
        for (const [key, value] of this.#outbox) {
            if (this.#outbox.size <= cap) break;
            if (value.ordered) {
                this.#outbox.delete(key);
                dropped++;
            }
        }
        if (dropped > 0 && !this.#capWarned) {
            logger.warn(`[${this.#connId}] outbox exceeded cap ${cap}; dropping oldest events (consumer overloaded)`);
            this.#capWarned = true;
        }
    }

    #drain(): void {
        if (this.#inFlight || this.#mode !== "queued") return;
        if (this.#ws.readyState !== OPEN) {
            this.#outbox.clear();
            return;
        }
        while (this.#outbox.size > 0) {
            const [key, entry] = this.#outbox.entries().next().value as [string, OutboxEntry];
            this.#outbox.delete(key);
            // #drain runs inside the ws send-completion callback, so a throwing builder would escape
            // as an uncaught exception. Treat a throw like an undefined frame: log it and skip on.
            let frame: string | undefined;
            try {
                frame = entry.build();
            } catch (err) {
                logger.error(`[${this.#connId}] failed to build queued frame; dropping it`, err);
                continue;
            }
            if (frame === undefined) continue;
            this.#raiseHighWater(frame);
            this.#inFlight = true;
            this.#watchdogTimer.start();
            this.#ws.send(frame, err => this.#onFlushed(err));
            return;
        }
        this.#exitQueued();
    }

    #onFlushed(err?: Error): void {
        this.#inFlight = false;
        this.#watchdogTimer.stop();
        if (this.#disposed) return;
        if (err !== undefined) {
            // A send error means the socket is dead. Dispose to release the queued closures, then
            // terminate to force the close event the handler needs to drop this connection — a
            // graceful close may never complete on an already-broken socket.
            this.dispose();
            this.#ws.terminate();
            return;
        }
        this.#drain();
    }

    #exitQueued(): void {
        if (this.#mode !== "queued") return;
        this.#mode = "direct";
        this.#capWarned = false;
        logger.notice(`[${this.#connId}] outbound drained — leaving backpressure mode`);
    }

    #onWatchdog(): void {
        if (this.#disposed || !this.#inFlight) return;
        logger.warn(`[${this.#connId}] outbound send stalled beyond watchdog — terminating dead connection`);
        // Dispose first so no further sends happen, then terminate (not a graceful close): a
        // half-open socket may never complete a graceful close, but terminate forces the "close"
        // event the handler needs to drop this connection from its registry.
        this.dispose();
        this.#ws.terminate();
    }
}
