/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */
import { Logger, Time } from "@matter/main";
import { PeerAddress, PeerAddressMap } from "@matter/main/protocol";
import { formatNodeId } from "../util/formatNodeId.js";
import { NodeProcessor } from "./NodeProcessor.js";

const logger = Logger.get("SubscriptionWatchdog");

const CHECK_INTERVAL_MS = 30_000;
const INITIAL_DELAY_MS = 60_000;
const GRACE_MS = 60_000;
const FALLBACK_THRESHOLD_MS = 15 * 60_000;
const MIN_RETRIP_MS = 10 * 60_000;
const SNAPSHOT_INTERVAL_MS = 60 * 60_000;
// SustainedSubscription.maxInterval is seconds for an established subscription but
// falls back to Hours.one — a millisecond quantity — while re-subscribing (upstream
// units inconsistency). Matter's maxInterval is uint16 seconds (≤ 65535s), so any
// value above a day is bogus and would silently disable the watchdog for that node;
// treat it as "interval unknown" instead.
const MAX_PLAUSIBLE_INTERVAL_S = 24 * 60 * 60;

export interface SubscriptionWatchdogContext {
    nodeConnected(peer: PeerAddress): boolean;
    subscriptionIntervalSeconds(peer: PeerAddress): number | undefined;
    /** Mark unavailable; MUST return true only when availability actually changed. */
    forceUnavailable(peer: PeerAddress): boolean;
    notifyUnavailable(peer: PeerAddress): void;
    triggerReconnect(peer: PeerAddress): void;
}

/**
 * Detects subscriptions that die silently (no data reports, no keepalives, no state change —
 * the 2026-07-09 wedge) and forces a re-subscribe. Availability tracking alone cannot catch
 * this: it is purely connection-state driven.
 */
export class SubscriptionWatchdog extends NodeProcessor {
    readonly #context: SubscriptionWatchdogContext;
    #lastAliveAt = new PeerAddressMap<number>();
    #lastTripAt = new PeerAddressMap<number>();
    #tripTotals = new PeerAddressMap<number>();
    #pendingRepair = new PeerAddressMap<boolean>();
    #lastSnapshotAt = Time.nowMs;

    constructor(context: SubscriptionWatchdogContext) {
        super("subscription-watchdog", INITIAL_DELAY_MS, CHECK_INTERVAL_MS);
        this.#context = context;
    }

    /** Call on node registration and on every transition to Connected. */
    registerNode(peer: PeerAddress): void {
        this.#lastAliveAt.set(peer, Time.nowMs);
        if (this.registerPeer(peer)) {
            logger.debug(`Watching subscriptions of node ${formatNodeId(peer)}`);
        }
        this.scheduleIfNeeded();
    }

    unregisterNode(peer: PeerAddress): void {
        this.#lastAliveAt.delete(peer);
        this.#lastTripAt.delete(peer);
        this.#tripTotals.delete(peer);
        this.#pendingRepair.delete(peer);
        this.unregisterPeer(peer);
    }

    /**
     * Call from the node's connectionAlive observer — every data report or keepalive.
     * NOTE: as of matter.js 0.17.x, empty keepalives do NOT reach connectionAlive
     * (see matter-js/matter.js#4057); until that is fixed this signal is
     * data-reports-only and healthy quiet devices false-trip at threshold —
     * a key reason this watchdog defaults to off.
     */
    recordAlive(peer: PeerAddress): void {
        this.#lastAliveAt.set(peer, Time.nowMs);
        this.#lastTripAt.delete(peer); // fresh data clears trip backoff
    }

    /** True exactly once after a trip, consumed by the Connected handler to force a cache rebuild. */
    consumePendingRepair(peer: PeerAddress): boolean {
        const pending = this.#pendingRepair.get(peer) === true;
        this.#pendingRepair.delete(peer);
        return pending;
    }

    /** Test seam: run one full check cycle immediately. */
    async checkNow(): Promise<void> {
        for (const peer of this.peers()) {
            if (this.shouldProcess(peer)) await this.processNode(peer);
        }
        this.onCycleComplete();
    }

    #thresholdFor(peer: PeerAddress): { thresholdMs: number; intervalKnown: boolean } {
        const seconds = this.#context.subscriptionIntervalSeconds(peer);
        if (seconds === undefined || seconds > MAX_PLAUSIBLE_INTERVAL_S) {
            return { thresholdMs: FALLBACK_THRESHOLD_MS, intervalKnown: false };
        }
        return { thresholdMs: seconds * 1000 * 1.5 + GRACE_MS, intervalKnown: true };
    }

    protected override shouldProcess(peer: PeerAddress): boolean {
        // NodeProcessor calls shouldProcess unguarded (outside processNode's try/catch); a
        // throwing context implementation must not reject checkNow() or abort the cycle for
        // other peers.
        try {
            return this.#context.nodeConnected(peer);
        } catch (error) {
            logger.debug(`nodeConnected check failed for ${formatNodeId(peer)}, skipping this cycle:`, error);
            return false;
        }
    }

    protected override async processNode(peer: PeerAddress): Promise<void> {
        // NodeProcessor requires processNode to contain ALL its errors: a throwing context
        // implementation must neither abort the cycle for other peers nor reject checkNow().
        try {
            const now = Time.nowMs;
            const lastAlive = this.#lastAliveAt.get(peer);
            if (lastAlive === undefined) {
                this.#lastAliveAt.set(peer, now);
                return;
            }
            const silence = now - lastAlive;
            const { thresholdMs, intervalKnown } = this.#thresholdFor(peer);
            if (silence <= thresholdMs) return;

            const lastTrip = this.#lastTripAt.get(peer);
            const backoffMs = Math.max(2 * thresholdMs, MIN_RETRIP_MS);
            if (lastTrip !== undefined && now - lastTrip < backoffMs) return;

            this.#lastTripAt.set(peer, now);
            this.#tripTotals.set(peer, (this.#tripTotals.get(peer) ?? 0) + 1);
            this.#pendingRepair.set(peer, true);
            logger.warn(
                `Node ${formatNodeId(peer)} subscription silent for ${Math.round(silence / 1000)}s ` +
                    `(threshold ${Math.round(thresholdMs / 1000)}s${intervalKnown ? "" : ", interval unknown — fallback"}) — forcing resubscribe`,
            );
            // Recovery is best-effort and a notification failure must never prevent the
            // reconnect itself.
            try {
                if (this.#context.forceUnavailable(peer)) {
                    this.#context.notifyUnavailable(peer);
                }
            } catch (error) {
                logger.warn(`Failed to publish unavailability for ${formatNodeId(peer)}:`, error);
            } finally {
                try {
                    this.#context.triggerReconnect(peer);
                } catch (error) {
                    logger.warn(`Failed to trigger reconnect for ${formatNodeId(peer)}:`, error);
                }
            }
        } catch (error) {
            logger.warn(`Subscription check failed for node ${formatNodeId(peer)}:`, error);
        }
    }

    protected override onCycleComplete(): void {
        const now = Time.nowMs;
        if (now - this.#lastSnapshotAt < SNAPSHOT_INTERVAL_MS) return;
        this.#lastSnapshotAt = now;
        for (const peer of this.peers()) {
            const lastAlive = this.#lastAliveAt.get(peer);
            const silence = lastAlive === undefined ? -1 : Math.round((now - lastAlive) / 1000);
            let interval: number | undefined;
            try {
                interval = this.#context.subscriptionIntervalSeconds(peer);
            } catch {
                // Snapshot logging is best-effort; a faulty context must not break the cycle.
            }
            logger.info(
                `Watchdog snapshot ${formatNodeId(peer)}: silence=${silence}s interval=${interval ?? "?"}s trips=${this.#tripTotals.get(peer) ?? 0}`,
            );
        }
    }
}
