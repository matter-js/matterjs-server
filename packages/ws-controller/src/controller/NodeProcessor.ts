/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { CancelablePromise, Duration, Logger, Millis, Time, Timer } from "@matter/main";
import { PeerAddress, PeerAddressSet } from "@matter/main/protocol";
import { AttributesData } from "../types/CommandHandler.js";

const logger = Logger.get("NodeProcessor");

// Timer.interval rejects anything outside the 32-bit signed range.
export const MAX_TIMER_DELAY_MS = 2_147_483_647;

/** Attribute access a polling processor needs from the controller. */
export interface NodeAttributeReader {
    handleReadAttributes(
        peer: PeerAddress,
        attributePaths: string[],
        fabricFiltered?: boolean,
    ): Promise<AttributesData>;
    nodeConnected(peer: PeerAddress): boolean;
}

/**
 * Abstract base class for timer-driven periodic processing of registered nodes.
 * Handles timer lifecycle, node registration, and the per-node processing loop
 * with inter-node delay. Subclasses provide the actual processing logic.
 *
 * Peers registered as Long Idle Time (LIT) are held back from the serial loop and processed together
 * once it ends, concurrently and without being awaited: a LIT node can leave an interaction queued
 * for the length of its idle interval, which would otherwise stall every node behind it for hours.
 */
export abstract class NodeProcessor {
    readonly #name: string;
    readonly #initialDelay: Duration;
    readonly #targetInterval: Duration;
    readonly #timer: Timer;
    #peers = new PeerAddressSet();
    #longIdleTimePeers = new PeerAddressSet();
    #isProcessing = false;
    #currentDelayPromise?: CancelablePromise;
    #processingPromise?: Promise<void>;
    #longIdleTimeBatch?: Promise<unknown>;
    #closed = false;

    constructor(timerName: string, initialDelay: number, targetInterval: number) {
        this.#name = timerName;
        this.#initialDelay = Millis(initialDelay);
        this.#targetInterval = Millis(targetInterval);
        this.#timer = Time.getTimer(timerName, this.#initialDelay, () => this.#startProcessing());
    }

    #startProcessing(): void {
        // Keep #processingPromise pointing at the live cycle: never overwrite it with the
        // resolved no-op #processAll() returns while a cycle is already running, or stop()
        // could await the wrong promise and return before the real cycle finishes.
        if (this.#isProcessing) return;
        this.#processingPromise = this.#processAll().catch(error =>
            logger.error("Node processing cycle failed:", error),
        );
    }

    protected get closed(): boolean {
        return this.#closed;
    }

    /**
     * Register a peer. Returns true if this was a new registration. `longIdleTime` moves the peer to
     * the deferred batch and is re-evaluated on every call, so a node changing mode picks the other
     * path up on its next registration.
     */
    protected registerPeer(peer: PeerAddress, longIdleTime = false): boolean {
        const isNew = !this.#peers.has(peer);
        this.#peers.add(peer);
        if (longIdleTime) {
            this.#longIdleTimePeers.add(peer);
        } else {
            this.#longIdleTimePeers.delete(peer);
        }
        return isNew;
    }

    /** Unregister a peer. Stops the timer if no peers remain. Returns true if was registered. */
    protected unregisterPeer(peer: PeerAddress): boolean {
        const removed = this.#peers.delete(peer);
        this.#longIdleTimePeers.delete(peer);
        if (removed && this.#peers.size === 0) {
            this.#timer.stop();
            // The next peer to arrive starts over: leaving the last applied interval in place would
            // give a freshly commissioned node its first cycle a full interval out.
            this.#applyInterval(this.#initialDelay);
        }
        return removed;
    }

    protected hasPeer(peer: PeerAddress): boolean {
        return this.#peers.has(peer);
    }

    /** Whether this peer is processed in the deferred batch instead of the serial loop. */
    protected isLongIdleTime(peer: PeerAddress): boolean {
        return this.#longIdleTimePeers.has(peer);
    }

    /** Start the timer if there are registered peers and it is not already running. */
    protected scheduleIfNeeded(): void {
        if (this.#peers.size === 0 || this.#closed) return;
        if (this.#timer.isRunning || this.#isProcessing) return;
        this.#timer.start();
    }

    /**
     * Override the delay before the next cycle. Only takes effect while no cycle is scheduled or
     * running, so callers must apply it before scheduleIfNeeded() starts the timer.
     */
    protected setNextCycleDelay(delayMs: number): boolean {
        if (!this.cycleDelayAdjustable) return false;
        return this.#applyInterval(delayMs);
    }

    /** Whether setNextCycleDelay() can still take effect, so callers can skip computing a delay. */
    protected get cycleDelayAdjustable(): boolean {
        return !this.#timer.isRunning && !this.#isProcessing && !this.#closed;
    }

    /** Both assignment paths go through here, since nextCycleDelay() is open to any subclass. */
    #applyInterval(delayMs: number): boolean {
        if (!Number.isFinite(delayMs) || delayMs < 0) {
            // A NaN passes Timer.interval's range check and then fires immediately, every cycle.
            logger.warn(`Ignoring invalid cycle delay ${delayMs}`);
            return false;
        }
        this.#timer.interval = Millis(Math.min(delayMs, MAX_TIMER_DELAY_MS));
        return true;
    }

    /**
     * Awaits an in-flight serial cycle, but never a running long idle time batch — that batch sits
     * behind the nodes' idle intervals and would hold shutdown for hours.
     */
    async stop(): Promise<void> {
        this.#closed = true;
        this.#currentDelayPromise?.cancel(new Error("Close"));
        this.#timer.stop();
        await this.#processingPromise;
    }

    /** Returns false if this peer should be skipped during processing (e.g. not connected). */
    protected abstract shouldProcess(peer: PeerAddress): boolean;

    /** Perform work for a single peer. Must handle its own errors. */
    protected abstract processNode(peer: PeerAddress): Promise<void>;

    /**
     * Called once a cycle is committed to running, before the peer list is snapshotted. A peer
     * registering after this point is not in the snapshot, so anything a subclass gates on "the first
     * cycle has run" must open here rather than in onCycleComplete, or that peer falls between the two.
     */
    protected onCycleStart(): void {}

    /**
     * Called after a full processing cycle completes. `intervalFormatted` is empty when no next cycle
     * was scheduled, i.e. every peer unregistered during this one.
     */
    protected onCycleComplete(_processedCount: number, _intervalFormatted: string): void {}

    /** Delay before the cycle that follows this one. Override to vary the cadence. */
    protected nextCycleDelay(): Duration {
        return this.#targetInterval;
    }

    async #processAll(): Promise<void> {
        if (this.#isProcessing) return;

        // A throw here would skip the finally below, leaving the timer stopped and this processor
        // dead until a peer re-registers. The cadence is never worth that.
        let nextInterval: Duration;
        try {
            nextInterval = this.nextCycleDelay();
        } catch (error) {
            logger.warn("Falling back to the target interval, computing the next cycle delay failed:", error);
            nextInterval = this.#targetInterval;
        }
        this.#applyInterval(nextInterval);

        this.#isProcessing = true;
        let processedCount = 0;

        const longIdleTimePeers = new Array<PeerAddress>();

        try {
            this.onCycleStart();
            for (const peer of Array.from(this.#peers)) {
                if (this.#closed) break;
                if (!this.#peers.has(peer) || !this.shouldProcess(peer)) continue;
                if (this.#longIdleTimePeers.has(peer)) {
                    longIdleTimePeers.push(peer);
                    continue;
                }
                if (processedCount > 0) {
                    this.#currentDelayPromise = Time.sleep("node-processor-delay", Millis(2_000)).finally(() => {
                        this.#currentDelayPromise = undefined;
                    });
                    await this.#currentDelayPromise;
                    // The peer may have unregistered or gone offline while this delay was pending, and
                    // a trigger path may have covered it in the meantime.
                    if (this.#closed) break;
                    if (!this.#peers.has(peer) || !this.shouldProcess(peer)) continue;
                }
                processedCount++;
                await this.processNode(peer);
            }
        } finally {
            this.#isProcessing = false;
            this.scheduleIfNeeded();
            // Inside the finally so a throw from the loop cannot drop the held-back peers into
            // another full interval of waiting.
            this.#startLongIdleTimeBatch(longIdleTimePeers, processedCount);
        }

        if (!this.#closed) {
            // scheduleIfNeeded() declines to arm the timer with no peers left, so naming an interval
            // then would point at a timer that is not running.
            this.onCycleComplete(processedCount, this.#timer.isRunning ? Duration.format(this.#timer.interval) : "");
        }
    }

    /**
     * Process the held-back LIT peers concurrently, after the timer for the next cycle is already
     * armed. Not awaited by the cycle: the batch may outlive the cycle interval, and a cycle that
     * finds one still running skips its own LIT peers rather than stacking a second batch on top. A
     * peer that only registered after the running batch launched therefore waits for the cycle after
     * it — the alternative is unbounded concurrent interactions against nodes that are asleep anyway.
     */
    #startLongIdleTimeBatch(peers: PeerAddress[], processedCount: number): void {
        if (this.#closed || peers.length === 0) return;
        if (this.#longIdleTimeBatch !== undefined) {
            logger.info(
                `${this.#name}: ${processedCount} nodes processed, ${peers.length} long idle time nodes skipped because the previous batch is still running`,
            );
            return;
        }

        const pending = peers.filter(peer => this.#peers.has(peer) && this.shouldProcess(peer));
        if (pending.length === 0) {
            logger.info(
                `${this.#name}: ${processedCount} nodes processed, none of the ${peers.length} long idle time nodes is still eligible`,
            );
            return;
        }

        logger.info(
            `${this.#name}: ${processedCount} nodes processed, now starting ${pending.length} long idle time nodes in the background`,
        );
        this.#longIdleTimeBatch = Promise.allSettled(pending.map(peer => this.processNode(peer)))
            .finally(() => {
                this.#longIdleTimeBatch = undefined;
            })
            .then(() => logger.info(`${this.#name}: long idle time batch of ${pending.length} nodes complete`))
            .catch(error => logger.error(`${this.#name}: long idle time batch failed:`, error));
    }
}
