/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Handles time synchronization for nodes with the TimeSynchronization cluster.
 * Syncs time on three triggers:
 * 1. Node connects/reconnects after startup (immediate, once startup window has elapsed)
 * 2. Periodic resync every 24 hours, brought forward when the host zone changes offset sooner
 * 3. Reactive resync when a node emits a timeFailure event (driven externally via syncNode()),
 *    held off far more briefly than a reconnect because the node is asking to be given a time
 *
 * A startup window scaled to the number of commissioned nodes prevents syncing while nodes are
 * still being initialized, including on the reactive path: a restart can leave many nodes without
 * a time at once, and answering each one individually is the traffic the window exists to avoid.
 * This manager must only be enabled when the host time source is known to be reliable (see
 * --enable-time-sync CLI flag).
 */

import { isLongIdleTimeDevice } from "@matter-server/ws-client";
import { Duration, Hours, Logger, Millis, Minutes, Seconds, Time } from "@matter/main";
import { TimeSynchronization } from "@matter/main/clusters";
import { PeerAddress, PeerAddressMap, PeerAddressSet } from "@matter/main/protocol";
import { StatusResponseError } from "@matter/main/types";
import { AttributesData } from "../types/CommandHandler.js";
import { formatNodeId } from "../util/formatNodeId.js";
import { nextOffsetChangeMs, resolveHostTimeZone, timeZonePlan } from "../util/hostTimeZone.js";
import { MAX_TIMER_DELAY_MS, NodeProcessor } from "./NodeProcessor.js";

const logger = Logger.get("TimeSyncManager");

// TimeSynchronization cluster ID (0x0038 = 56 decimal)
export const TIME_SYNC_CLUSTER_ID = 0x0038;

// timeFailure event ID within the TimeSynchronization cluster
export const TIME_FAILURE_EVENT_ID = 0x03;

// Periodic resync interval: 24 hours
const RESYNC_INTERVAL = Hours(24);

// Startup window, scaled to the node count: nodes initialize at roughly 10 per minute, so this
// clears initialization before the first sync without idling on small installations.
export const STARTUP_BASE_DELAY = Minutes(3);
const STARTUP_DELAY_PER_NODE = Seconds(10);

// Land past an upcoming offset change rather than on it, so the cycle sees the post-change zone
// state and replaces any DST entry the node has just retired.
const POST_CHANGE_MARGIN = Minutes(1);
// Floor for a brought-forward cycle. A future change already clears it via POST_CHANGE_MARGIN; this
// catches a lookup returning an instant that has already passed, which would otherwise fire at once.
const MIN_ACCELERATED_DELAY = Minutes(1);

// Minimum spacing between reconnect-driven syncs for one peer. A reconnect says nothing about
// whether the node's time is still good, so a flapping node must not storm setUtcTime.
const RECONNECT_SYNC_COOLDOWN = Hours(24);

// A timeFailure event is the node reporting it has no usable time, so it is answered almost
// immediately: long enough only to absorb a burst from one loss. Do not widen this on the spec's
// one-event-per-hour limit (§11.17.10.4) — devices are observed emitting four in 49 s and then
// giving up, so anything longer refuses the node and nothing asks again until the periodic pass.
const TIME_FAILURE_SYNC_COOLDOWN = Minutes(1);

// The periodic cycle and the trigger paths are otherwise blind to each other, so a peer registering
// during the cycle's inter-node delay is pushed twice seconds apart. Long enough to cover that delay,
// far short of any cooldown, so it can never defer a cycle.
const RECENT_SYNC_GUARD = Minutes(1);

/** Why a sync was triggered outside the periodic cycle. Decides how long the peer is then held off. */
export enum SyncTrigger {
    /** The node reconnected; its time may well still be correct. */
    Reconnect = "reconnect",
    /** The node reported it has no usable time and is asking to be given one. */
    TimeFailure = "timeFailure",
}

export interface TimeSyncConnector {
    syncTime(peer: PeerAddress): Promise<void>;
    nodeConnected(peer: PeerAddress): boolean;
    commissionedNodeCount(): number;
}

/** Instant of the host zone's next offset change, or null when none is in view. */
export type OffsetChangeLookup = (fromMs: number) => number | null;

/**
 * Delay before the first sync, long enough for node initialization to finish. Capped so the value
 * reported to the log is the one the timer can actually be given.
 */
export function startupDelayMs(commissionedNodeCount: number): number {
    return Math.min(STARTUP_BASE_DELAY + commissionedNodeCount * STARTUP_DELAY_PER_NODE, MAX_TIMER_DELAY_MS);
}

/**
 * Delay before the next periodic cycle: normally the full interval, brought forward to a minute past
 * an upcoming offset change so a node's retired DST entry is replaced promptly. An instant that has
 * already passed, or one beyond the interval, leaves the cadence alone.
 */
export function resyncDelayMs(nowMs: number, nextChangeMs: number | null): number {
    if (nextChangeMs === null || !Number.isFinite(nextChangeMs)) {
        return RESYNC_INTERVAL;
    }
    const delay = nextChangeMs + POST_CHANGE_MARGIN - nowMs;
    return delay < MIN_ACCELERATED_DELAY || delay >= RESYNC_INTERVAL ? RESYNC_INTERVAL : delay;
}

const defaultOffsetChangeLookup: OffsetChangeLookup = fromMs => {
    const zone = resolveHostTimeZone();
    // A node with less capacity cannot surface a nearer boundary than the cluster maxima do.
    return nextOffsetChangeMs(timeZonePlan(zone, fromMs, { maxRegimes: 2, maxWindows: 2 }), fromMs);
};

/** TimeNotAccepted means the node keeps a time source it prefers — expected, not an error. */
function logSyncFailure(prefix: string, peer: PeerAddress, error: unknown) {
    if (error instanceof StatusResponseError && error.clusterCode === TimeSynchronization.StatusCode.TimeNotAccepted) {
        logger.info(`${prefix}Node ${formatNodeId(peer)} declined the provided time`);
        return;
    }
    logger.warn(`${prefix}Failed to sync time on node ${formatNodeId(peer)}:`, error);
}

/**
 * Check if a node has the TimeSynchronization cluster based on its attribute cache.
 * The cluster is always on endpoint 0 per the Matter spec.
 */
export function hasTimeSyncCluster(attributes: AttributesData): boolean {
    // Checks the existence of the Granularity Attribute 1
    return attributes[`0/${TIME_SYNC_CLUSTER_ID}/1`] !== undefined;
}

/**
 * Check if a node exposes the TimeSynchronization TimeZone feature, i.e. the TimeZone
 * attribute (5) on endpoint 0. Presence implies SetTimeZone/SetDstOffset are supported.
 */
export function hasTimeZoneFeature(attributes: AttributesData): boolean {
    return attributes[`0/${TIME_SYNC_CLUSTER_ID}/5`] !== undefined;
}

/** DSTOffsetListMaxSize (attribute 11) if the node reports it as a number. */
export function dstOffsetListMaxSize(attributes: AttributesData): number | undefined {
    const value = attributes[`0/${TIME_SYNC_CLUSTER_ID}/11`];
    return typeof value === "number" ? value : undefined;
}

/** TimeZoneListMaxSize (attribute 10) if the node reports it as a number. */
export function timeZoneListMaxSize(attributes: AttributesData): number | undefined {
    const value = attributes[`0/${TIME_SYNC_CLUSTER_ID}/10`];
    return typeof value === "number" ? value : undefined;
}

/**
 * Manages time synchronization for nodes with the TimeSynchronization cluster.
 */
export class TimeSyncManager extends NodeProcessor {
    readonly #connector: TimeSyncConnector;
    readonly #offsetChangeLookup: OffsetChangeLookup;
    // Tracks in-flight immediate syncs per node to prevent parallel syncs
    #inFlightSyncs = new PeerAddressMap<Promise<void>>();
    // Peers whose in-flight push is aimed at a long idle time node. Tracked separately from
    // isLongIdleTime(), which forgets a peer the moment it unregisters — shutdown would then wait out
    // the very push it must not wait for.
    #longIdleTimeSyncs = new PeerAddressSet();
    // Last attempt per node, kept per trigger: a reconnect attempt must not spend the shorter leash
    // a timeFailure is entitled to, least of all when that attempt failed.
    #lastReconnectSyncMs = new PeerAddressMap<number>();
    #lastTimeFailureSyncMs = new PeerAddressMap<number>();
    // Last push attempt by any path, so the periodic cycle and a trigger cannot double up on a peer.
    #lastSyncMs = new PeerAddressMap<number>();
    // Successful syncs in the running cycle; the base class counts attempts.
    #cycleSyncedCount = 0;
    // True after the first periodic resync cycle, enabling immediate syncs on reconnect
    #startupComplete = false;

    constructor(connector: TimeSyncConnector, offsetChangeLookup: OffsetChangeLookup = defaultOffsetChangeLookup) {
        super("time-sync-resync", STARTUP_BASE_DELAY, RESYNC_INTERVAL);
        this.#connector = connector;
        this.#offsetChangeLookup = offsetChangeLookup;
    }

    /**
     * Register a node for time sync if it has the TimeSynchronization cluster.
     * Call this after a node connects and its attributes are available.
     * Immediate sync is skipped during the startup window to avoid traffic while
     * the server is initializing all nodes.
     */
    registerNode(peer: PeerAddress, attributes: AttributesData): void {
        if (this.closed) return;
        if (!hasTimeSyncCluster(attributes)) {
            this.unregisterNode(peer);
            return;
        }

        if (this.registerPeer(peer, isLongIdleTimeDevice(attributes))) {
            logger.info(`Registered node ${formatNodeId(peer)} for time synchronization`);
        }

        // Only sync immediately if the startup window has elapsed. During startup,
        // the first periodic resync handles all nodes once initialization is done.
        if (this.#startupComplete) {
            this.syncNode(peer);
        } else if (this.cycleDelayAdjustable) {
            // initializeNodes resolves the full commissioned list before registering any of it, so
            // the first registration already sees the final count.
            let nodeCount = 0;
            try {
                nodeCount = this.#connector.commissionedNodeCount();
            } catch (error) {
                // Scaling the delay is an optimization; it must not abort the node's registration.
                logger.warn("Could not determine the commissioned node count:", error);
            }
            const delay = startupDelayMs(nodeCount);
            if (this.setNextCycleDelay(delay)) {
                logger.info(`First time synchronization in ${Duration.format(Millis(delay))}`);
            }
        }

        this.scheduleIfNeeded();
    }

    /**
     * Unregister a node from time sync tracking.
     */
    unregisterNode(peer: PeerAddress): void {
        this.#lastReconnectSyncMs.delete(peer);
        this.#lastTimeFailureSyncMs.delete(peer);
        this.#lastSyncMs.delete(peer);
        if (this.unregisterPeer(peer)) {
            logger.info(`Unregistered node ${formatNodeId(peer)} from time synchronization`);
        }
    }

    /**
     * Trigger an immediate time sync for a node (fire-and-forget with deduplication).
     * Called externally when a timeFailure event is received from the node.
     */
    syncNode(peer: PeerAddress, trigger = SyncTrigger.Reconnect): void {
        if (this.closed || !this.hasPeer(peer) || !this.#connector.nodeConnected(peer)) return;
        if (!this.#startupComplete) {
            // Nodes are still being initialized; the first periodic cycle covers every peer shortly.
            logger.debug(`Time sync for node ${formatNodeId(peer)} deferred to the first periodic cycle`);
            return;
        }
        if (this.#inFlightSyncs.has(peer)) {
            logger.debug(`Time sync already in progress for node ${formatNodeId(peer)}, skipping`);
            return;
        }
        // Never on the timeFailure path: the node is reporting it has no usable time, so a push we
        // just made is evidence it did not take, not a reason to refuse. Only its own cooldown applies.
        if (trigger !== SyncTrigger.TimeFailure && this.#syncedRecently(peer)) {
            logger.debug(`Time sync for node ${formatNodeId(peer)} skipped, pushed moments ago`);
            return;
        }
        const { cooldown, stamps } =
            trigger === SyncTrigger.TimeFailure
                ? { cooldown: TIME_FAILURE_SYNC_COOLDOWN, stamps: this.#lastTimeFailureSyncMs }
                : { cooldown: RECONNECT_SYNC_COOLDOWN, stamps: this.#lastReconnectSyncMs };
        const lastSync = stamps.get(peer);
        if (lastSync !== undefined && Time.nowMs - lastSync < cooldown) {
            logger.debug(
                `Time sync for node ${formatNodeId(peer)} skipped, within ${Duration.format(cooldown)} ${trigger} cooldown`,
            );
            return;
        }
        stamps.set(peer, Time.nowMs);
        this.#lastSyncMs.set(peer, Time.nowMs);
        this.#trackInFlight(
            peer,
            this.#connector
                .syncTime(peer)
                .then(() => logger.info(`Synced time on node ${formatNodeId(peer)}`))
                .catch(error => logSyncFailure("", peer, error)),
        );
    }

    /** Owns the #inFlightSyncs slot until this push settles, so a later push keeps its dedupe guard. */
    #trackInFlight(peer: PeerAddress, push: Promise<void>): void {
        if (this.isLongIdleTime(peer)) {
            this.#longIdleTimeSyncs.add(peer);
        }
        const tracked: Promise<void> = push.finally(() => {
            if (this.#inFlightSyncs.get(peer) === tracked) {
                this.#inFlightSyncs.delete(peer);
                this.#longIdleTimeSyncs.delete(peer);
            }
        });
        this.#inFlightSyncs.set(peer, tracked);
    }

    /** For testing: advance past the startup window to enable immediate syncs. */
    completeStartup(): void {
        this.#startupComplete = true;
    }

    override async stop(): Promise<void> {
        await super.stop();
        // A push to a long idle time node sits behind its idle interval, so it is left running rather
        // than holding shutdown for hours; its own catch keeps the rejection handled.
        const pending = new Array<Promise<void>>();
        for (const [peer, push] of this.#inFlightSyncs) {
            if (!this.#longIdleTimeSyncs.has(peer)) {
                pending.push(push);
            }
        }
        await Promise.allSettled(pending);
        this.#inFlightSyncs.clear();
        this.#longIdleTimeSyncs.clear();
        this.#lastReconnectSyncMs.clear();
        this.#lastTimeFailureSyncMs.clear();
        this.#lastSyncMs.clear();
        logger.info("Time sync manager stopped");
    }

    protected override shouldProcess(peer: PeerAddress): boolean {
        return this.#connector.nodeConnected(peer) && !this.#inFlightSyncs.has(peer) && !this.#syncedRecently(peer);
    }

    #syncedRecently(peer: PeerAddress): boolean {
        const last = this.#lastSyncMs.get(peer);
        return last !== undefined && Time.nowMs - last < RECENT_SYNC_GUARD;
    }

    /**
     * Bring the next cycle forward to just after the host zone's next offset change. Nodes apply the
     * change themselves from the DST list they already hold; resyncing refreshes a list whose final
     * entry has just expired, which a node is otherwise entitled to discard entirely.
     */
    protected override nextCycleDelay(): Duration {
        const nowMs = Time.nowMs;
        let nextChangeMs: number | null = null;
        try {
            nextChangeMs = this.#offsetChangeLookup(nowMs);
        } catch (error) {
            // Bringing the cycle forward is an optimization; the zone lookup rests on Intl and the
            // host's zone name, neither of which is worth a missed resync.
            logger.warn("Could not determine the next time zone offset change:", error);
        }
        return Millis(resyncDelayMs(nowMs, nextChangeMs));
    }

    protected override async processNode(peer: PeerAddress): Promise<void> {
        if (!this.hasPeer(peer)) return;
        // A long idle time push can still be running when the next cycle reports, so it must not be
        // counted into that cycle's total.
        const counted = !this.isLongIdleTime(peer);
        this.#lastSyncMs.set(peer, Time.nowMs);
        // Register in #inFlightSyncs so a concurrent trigger sync (syncNode) for the same
        // peer dedupes against the periodic push instead of double-sending.
        const push = this.#connector
            .syncTime(peer)
            .then(() => {
                if (counted) {
                    this.#cycleSyncedCount++;
                }
                logger.info(`Periodic resync: synced time on node ${formatNodeId(peer)}`);
            })
            .catch(error => logSyncFailure("Periodic resync: ", peer, error));
        this.#trackInFlight(peer, push);
        await push;
    }

    protected override onCycleStart(): void {
        this.#cycleSyncedCount = 0;
        if (!this.#startupComplete) {
            // Opening the window here, not on completion: a node registering mid-cycle is absent from
            // the peer snapshot, so it needs the immediate-sync path to be available already.
            this.#startupComplete = true;
            logger.info("Time sync startup window complete, immediate syncs enabled on reconnect");
        }
    }

    protected override onCycleComplete(processedCount: number, intervalFormatted: string): void {
        if (processedCount > 0) {
            // The interval comes from the timer, not RESYNC_INTERVAL: a cycle brought forward for an
            // offset change is armed for hours, and naming a day here would contradict it.
            const next = intervalFormatted === "" ? "" : ` Next resync in ${intervalFormatted}.`;
            logger.info(
                `Periodic resync complete: synced ${this.#cycleSyncedCount} of ${processedCount} nodes.${next}`,
            );
        }
    }
}
