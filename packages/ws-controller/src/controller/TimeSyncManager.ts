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
 * 3. Reactive resync when a node emits a timeFailure event (driven externally via syncNode())
 *
 * A startup window scaled to the number of commissioned nodes prevents syncing while nodes are
 * still being initialized. This manager must only be enabled when the host time source is known
 * to be reliable (see --enable-time-sync CLI flag).
 */

import { Duration, Hours, Logger, Millis, Minutes, Seconds, Time } from "@matter/main";
import { TimeSynchronization } from "@matter/main/clusters";
import { PeerAddress, PeerAddressMap } from "@matter/main/protocol";
import { StatusResponseError } from "@matter/main/types";
import { AttributesData } from "../types/CommandHandler.js";
import { formatNodeId } from "../util/formatNodeId.js";
import { nextOffsetChangeMs, resolveHostTimeZone, timeZonePlan } from "../util/hostTimeZone.js";
import { NodeProcessor } from "./NodeProcessor.js";

const logger = Logger.get("TimeSyncManager");

// TimeSynchronization cluster ID (0x0038 = 56 decimal)
export const TIME_SYNC_CLUSTER_ID = 0x0038;

// timeFailure event ID within the TimeSynchronization cluster
export const TIME_FAILURE_EVENT_ID = 0x03;

// Periodic resync interval: 24 hours
const RESYNC_INTERVAL = Hours(24);

// Startup window, scaled to the node count: nodes initialize at roughly 10 per minute, so this
// clears initialization before the first sync without idling on small installations.
const STARTUP_BASE_DELAY = Minutes(3);
const STARTUP_DELAY_PER_NODE = Seconds(10);

// Land past an upcoming offset change rather than on it, so the cycle sees the post-change zone
// state and replaces any DST entry the node has just retired.
const POST_CHANGE_MARGIN = Minutes(1);
// Floor for a brought-forward cycle. A future change already clears it via POST_CHANGE_MARGIN; this
// catches a lookup returning an instant that has already passed, which would otherwise fire at once.
const MIN_ACCELERATED_DELAY = Minutes(1);

// Minimum spacing between trigger-driven (reconnect / timeFailure) syncs for one peer.
// The periodic path already caps its own cadence; this stops a flapping node or a device
// repeatedly emitting timeFailure from storming setUtcTime commands.
const TRIGGER_SYNC_COOLDOWN = Hours(24);

export interface TimeSyncConnector {
    syncTime(peer: PeerAddress): Promise<void>;
    nodeConnected(peer: PeerAddress): boolean;
    commissionedNodeCount(): number;
}

/** Instant of the host zone's next offset change, or null when none is in view. */
export type OffsetChangeLookup = (fromMs: number) => number | null;

/** Delay before the first sync, long enough for node initialization to finish. */
export function startupDelayMs(commissionedNodeCount: number): number {
    return STARTUP_BASE_DELAY + commissionedNodeCount * STARTUP_DELAY_PER_NODE;
}

/**
 * Delay before the next periodic cycle: normally the full interval, brought forward to just after an
 * upcoming offset change so a node's retired DST entry is replaced promptly. A change nearer than the
 * floor is left to the following cycle rather than scheduling a near-zero delay.
 */
export function resyncDelayMs(nowMs: number, nextChangeMs: number | null): number {
    if (nextChangeMs === null) {
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
    // Last trigger-driven sync attempt per node, used to enforce TRIGGER_SYNC_COOLDOWN
    #lastTriggerSyncMs = new PeerAddressMap<number>();
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
        if (!hasTimeSyncCluster(attributes)) {
            this.unregisterNode(peer);
            return;
        }

        if (this.registerPeer(peer)) {
            logger.info(`Registered node ${formatNodeId(peer)} for time synchronization`);
        }

        // Only sync immediately if the startup window has elapsed. During startup,
        // the first periodic resync handles all nodes once initialization is done.
        if (this.#startupComplete) {
            this.syncNode(peer);
        } else {
            // The commissioned count is known in full by the first registration, so this lands once
            // and later registrations are no-ops against the already-running timer.
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
        this.#lastTriggerSyncMs.delete(peer);
        if (this.unregisterPeer(peer)) {
            logger.info(`Unregistered node ${formatNodeId(peer)} from time synchronization`);
        }
    }

    /**
     * Trigger an immediate time sync for a node (fire-and-forget with deduplication).
     * Called externally when a timeFailure event is received from the node.
     */
    syncNode(peer: PeerAddress): void {
        if (this.closed || !this.hasPeer(peer) || !this.#connector.nodeConnected(peer)) return;
        if (this.#inFlightSyncs.has(peer)) {
            logger.debug(`Time sync already in progress for node ${formatNodeId(peer)}, skipping`);
            return;
        }
        const lastSync = this.#lastTriggerSyncMs.get(peer);
        if (lastSync !== undefined && Time.nowMs - lastSync < TRIGGER_SYNC_COOLDOWN) {
            logger.debug(
                `Time sync for node ${formatNodeId(peer)} skipped, within ${Duration.format(TRIGGER_SYNC_COOLDOWN)} cooldown`,
            );
            return;
        }
        this.#lastTriggerSyncMs.set(peer, Time.nowMs);
        const promise = this.#connector
            .syncTime(peer)
            .then(() => logger.info(`Synced time on node ${formatNodeId(peer)}`))
            .catch(error => logSyncFailure("", peer, error))
            .finally(() => {
                this.#inFlightSyncs.delete(peer);
            });
        this.#inFlightSyncs.set(peer, promise);
    }

    /** For testing: advance past the startup window to enable immediate syncs. */
    completeStartup(): void {
        this.#startupComplete = true;
    }

    override async stop(): Promise<void> {
        await super.stop();
        await Promise.allSettled(this.#inFlightSyncs.values());
        this.#inFlightSyncs.clear();
        this.#lastTriggerSyncMs.clear();
        logger.info("Time sync manager stopped");
    }

    protected override shouldProcess(peer: PeerAddress): boolean {
        return this.#connector.nodeConnected(peer) && !this.#inFlightSyncs.has(peer);
    }

    /**
     * Bring the next cycle forward to just after the host zone's next offset change. Nodes apply the
     * change themselves from the DST list they already hold; resyncing refreshes a list whose final
     * entry has just expired, which a node is otherwise entitled to discard entirely.
     */
    protected override nextCycleDelay(): Duration {
        const nowMs = Time.nowMs;
        return Millis(resyncDelayMs(nowMs, this.#offsetChangeLookup(nowMs)));
    }

    protected override async processNode(peer: PeerAddress): Promise<void> {
        // Register in #inFlightSyncs so a concurrent trigger sync (syncNode) for the same
        // peer dedupes against the periodic push instead of double-sending.
        const promise = this.#connector
            .syncTime(peer)
            .then(() => logger.info(`Periodic resync: synced time on node ${formatNodeId(peer)}`))
            .catch(error => logSyncFailure("Periodic resync: ", peer, error))
            .finally(() => {
                this.#inFlightSyncs.delete(peer);
            });
        this.#inFlightSyncs.set(peer, promise);
        await promise;
    }

    protected override onCycleComplete(processedCount: number, _intervalFormatted: string): void {
        if (!this.#startupComplete) {
            this.#startupComplete = true;
            logger.info("Time sync startup window complete, immediate syncs enabled on reconnect");
        }
        if (processedCount > 0) {
            logger.info(
                `Periodic resync complete: synced ${processedCount} nodes. Next resync in ${Duration.format(RESYNC_INTERVAL)}`,
            );
        }
    }
}
