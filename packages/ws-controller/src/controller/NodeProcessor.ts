/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { CancelablePromise, Duration, Logger, Millis, Time, Timer } from "@matter/main";
import { PeerAddress, PeerAddressSet } from "@matter/main/protocol";

const logger = Logger.get("NodeProcessor");

/**
 * Abstract base class for timer-driven periodic processing of registered nodes.
 * Handles timer lifecycle, node registration, and the per-node processing loop
 * with inter-node delay. Subclasses provide the actual processing logic.
 */
export abstract class NodeProcessor {
    readonly #targetInterval: Duration;
    readonly #timer: Timer;
    #peers = new PeerAddressSet();
    #isProcessing = false;
    #currentDelayPromise?: CancelablePromise;
    #processingPromise?: Promise<void>;
    #closed = false;

    constructor(timerName: string, initialDelay: number, targetInterval: number) {
        this.#targetInterval = Millis(targetInterval);
        this.#timer = Time.getTimer(timerName, Millis(initialDelay), () => this.#startProcessing());
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

    /** Register a peer. Returns true if this was a new registration. */
    protected registerPeer(peer: PeerAddress): boolean {
        const isNew = !this.#peers.has(peer);
        this.#peers.add(peer);
        return isNew;
    }

    /** Unregister a peer. Stops the timer if no peers remain. Returns true if was registered. */
    protected unregisterPeer(peer: PeerAddress): boolean {
        const removed = this.#peers.delete(peer);
        if (removed && this.#peers.size === 0) {
            this.#timer.stop();
        }
        return removed;
    }

    protected hasPeer(peer: PeerAddress): boolean {
        return this.#peers.has(peer);
    }

    /** Snapshot of registered peers (for subclass iteration outside a cycle). */
    protected peers(): PeerAddress[] {
        return Array.from(this.#peers);
    }

    /** Start the timer if there are registered peers and it is not already running. */
    protected scheduleIfNeeded(): void {
        if (this.#peers.size === 0 || this.#closed) return;
        if (this.#timer.isRunning || this.#isProcessing) return;
        this.#timer.start();
    }

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

    /** Called after a full processing cycle completes. Override for cycle-complete logging. */
    protected onCycleComplete(_processedCount: number, _intervalFormatted: string): void {}

    async #processAll(): Promise<void> {
        if (this.#isProcessing) return;

        if (this.#timer.interval !== this.#targetInterval) {
            this.#timer.interval = this.#targetInterval;
        }

        this.#isProcessing = true;
        let processedCount = 0;

        try {
            const peers = Array.from(this.#peers);
            for (let i = 0; i < peers.length; i++) {
                if (this.#closed) break;
                const peer = peers[i];
                if (!this.#peers.has(peer) || !this.shouldProcess(peer)) continue;
                processedCount++;
                await this.processNode(peer);
                if (i < peers.length - 1 && !this.#closed) {
                    this.#currentDelayPromise = Time.sleep("node-processor-delay", Millis(2_000)).finally(() => {
                        this.#currentDelayPromise = undefined;
                    });
                    await this.#currentDelayPromise;
                }
            }
        } finally {
            this.#isProcessing = false;
            this.scheduleIfNeeded();
        }

        if (!this.#closed) {
            this.onCycleComplete(processedCount, Duration.format(this.#timer.interval));
        }
    }
}
