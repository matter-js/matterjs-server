/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BorderRouterEntry, MatterClient, ThreadDiagnosticsBatch } from "@matter-server/ws-client";

/**
 * Elapsed-time clock for batch lifetimes. A batch says how long it stays current, so measuring it
 * on the wall clock would let an NTP step or a manual clock change expire or revive every held
 * batch at once.
 */
export function monotonicNow(): number {
    return performance.now();
}

/**
 * Snapshot of mDNS-discovered Thread Border Routers and the most recent Thread diagnostic
 * batch per network.
 *
 * A batch states how long it stays current ({@link ThreadDiagnosticsBatch.expiresInMs}); past that
 * the server stops serving it, and keeping it would let stale diagnostics go on vouching for
 * external devices the mesh may no longer have. Acting on that deadline is the owner's job: this
 * class records it ({@link BorderRouterStore.nextExpiryAt}) and drops what has run out when asked
 * ({@link BorderRouterStore.pruneExpired}).
 *
 * Refreshed on Thread-graph mount and on the reload-button click. The BR map is keyed by the
 * uppercase 16-char xa hex so callers can join against neighbor-table extended addresses
 * normalized to the same casing. The diagnostic map is keyed by the uppercase 16-char
 * extPanId hex so callers can join against {@link BorderRouterEntry.extendedPanIdHex}.
 */
export class BorderRouterStore {
    // Replaced (not mutated) on every refresh so Lit consumers passing this map as a
    // @property() detect the snapshot change via the default `===` identity compare and
    // re-render. Mutating in place would keep the same reference and silently skip updates.
    #entries: ReadonlyMap<string, BorderRouterEntry> = new Map();
    #diagnostics: ReadonlyMap<string, ThreadDiagnosticsBatch> = new Map();
    // Deadline per extPanId on the monotonic clock: a batch states a duration rather than an
    // instant, so neither the server's clock nor a step of this device's wall clock can move it.
    #expiry = new Map<string, number>();

    get entries(): ReadonlyMap<string, BorderRouterEntry> {
        return this.#entries;
    }

    get diagnostics(): ReadonlyMap<string, ThreadDiagnosticsBatch> {
        return this.#diagnostics;
    }

    /** Earliest batch deadline on the {@link monotonicNow} scale, or undefined when nothing expires. */
    get nextExpiryAt(): number | undefined {
        let earliest: number | undefined;
        for (const at of this.#expiry.values()) {
            if (earliest === undefined || at < earliest) earliest = at;
        }
        return earliest;
    }

    /**
     * Drop every batch whose stated lifetime has run out. Returns true when something was dropped,
     * so a caller can re-render only on an actual change.
     */
    pruneExpired(now = monotonicNow()): boolean {
        const expired = new Array<string>();
        for (const [key, at] of this.#expiry) {
            if (at <= now) expired.push(key);
        }
        if (expired.length === 0) return false;

        const next = new Map(this.#diagnostics);
        for (const key of expired) {
            next.delete(key);
            this.#expiry.delete(key);
        }
        this.#diagnostics = next;
        return true;
    }

    /**
     * Record when `batch` stops being current. A lifetime that is not a positive finite number is
     * no lifetime at all: it comes off the wire, and treating a NaN or a negative as a deadline
     * would make every comparison against it false and spin the caller's reschedule loop.
     */
    #trackExpiry(expiry: Map<string, number>, key: string, batch: ThreadDiagnosticsBatch, now: number): void {
        const lifetime = batch.expiresInMs;
        if (lifetime === undefined || !Number.isFinite(lifetime) || lifetime <= 0) {
            expiry.delete(key);
            return;
        }
        expiry.set(key, now + lifetime);
    }

    async refresh(client: MatterClient): Promise<void> {
        const list = await client.sendCommand("get_thread_border_routers", 0, {});
        const next = new Map<string, BorderRouterEntry>();
        for (const entry of list) {
            next.set(entry.extAddressHex.toUpperCase(), entry);
        }
        this.#entries = next;

        // Diagnostics are a schema-12, best-effort feature: their failure (an older
        // server, or a transient error) must never abort the border-router refresh.
        try {
            const result = await client.sendCommand("get_thread_diagnostics", 12, {});
            const batches = Array.isArray(result) ? result : result === undefined || result === null ? [] : [result];
            const nextDiag = new Map<string, ThreadDiagnosticsBatch>();
            const nextExpiry = new Map<string, number>();
            const now = monotonicNow();
            for (const batch of batches) {
                const key = batch.extPanIdHex.toUpperCase();
                nextDiag.set(key, batch);
                this.#trackExpiry(nextExpiry, key, batch, now);
            }
            // Both maps swap together: a throw above must not leave batches behind with their
            // deadlines cleared, which would make them un-expirable.
            this.#diagnostics = nextDiag;
            this.#expiry = nextExpiry;
        } catch (err) {
            console.warn("Thread diagnostics refresh skipped:", err);
        }
    }

    /** Apply a single batch update from a thread_diagnostics_updated event. */
    applyBatch(batch: ThreadDiagnosticsBatch): void {
        const key = batch.extPanIdHex.toUpperCase();
        const next = new Map(this.#diagnostics);
        next.set(key, batch);
        this.#diagnostics = next;
        this.#trackExpiry(this.#expiry, key, batch, monotonicNow());
    }

    /** Force-refresh diagnostics for a single network. */
    async refreshDiagnosticsFor(client: MatterClient, extPanIdHex: string): Promise<void> {
        try {
            const result = await client.sendCommand("get_thread_diagnostics", 12, {
                ext_pan_id: extPanIdHex.toLowerCase(),
                force: true,
            });
            if (result === undefined || result === null) return;
            if (Array.isArray(result)) {
                for (const batch of result) this.applyBatch(batch);
            } else {
                this.applyBatch(result);
            }
        } catch (err) {
            console.warn("Thread diagnostics refresh skipped:", err);
        }
    }

    reset(): void {
        this.#entries = new Map();
        this.#diagnostics = new Map();
        this.#expiry.clear();
    }
}
