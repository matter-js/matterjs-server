/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Handles time synchronization for nodes with the TimeSynchronization cluster.
 * Syncs UTC time on two triggers:
 * 1. Node connects/reconnects after startup (immediate, once startup window has elapsed)
 * 2. Periodic resync every 24 hours
 *
 * A startup window of 30–60 minutes prevents syncing during initial node connection
 * while the host's NTP is still stabilizing. This manager must only be enabled when
 * the host time source is known to be reliable (see --enable-time-sync CLI flag).
 */

import { Duration, Hours, Logger, Minutes } from "@matter/main";
import { PeerAddress, PeerAddressMap } from "@matter/main/protocol";
import { AttributesData } from "../types/CommandHandler.js";
import { formatNodeId } from "../util/formatNodeId.js";
import { NodeProcessor } from "./NodeProcessor.js";

const logger = Logger.get("TimeSyncManager");

// TimeSynchronization cluster ID (0x0038 = 56 decimal)
const TIME_SYNC_CLUSTER_ID = 0x0038;

// Periodic resync interval: 24 hours
const RESYNC_INTERVAL = Hours(24);

export interface TimeSyncConnector {
    syncTime(peer: PeerAddress): Promise<void>;
    nodeConnected(peer: PeerAddress): boolean;
}

/**
 * Check if a node has the TimeSynchronization cluster based on its attribute cache.
 * The cluster is always on endpoint 0 per the Matter spec.
 */
export function hasTimeSyncCluster(attributes: AttributesData): boolean {
    const prefix = `0/${TIME_SYNC_CLUSTER_ID}/`;
    for (const key of Object.keys(attributes)) {
        if (key.startsWith(prefix)) {
            return true;
        }
    }
    return false;
}

/**
 * Manages time synchronization for nodes with the TimeSynchronization cluster.
 */
export class TimeSyncManager extends NodeProcessor {
    readonly #connector: TimeSyncConnector;
    // Tracks in-flight immediate syncs per node to prevent parallel syncs
    #inFlightSyncs = new PeerAddressMap<Promise<void>>();
    // True after the first periodic resync cycle, enabling immediate syncs on reconnect
    #startupComplete = false;

    constructor(connector: TimeSyncConnector) {
        // Startup window: random 30–60 minutes to stagger across server restarts and
        // allow NTP to stabilize before pushing time to devices
        const startupDelayMs = Minutes(30) + Math.floor(Math.random() * Minutes(30));
        super("time-sync-resync", startupDelayMs, RESYNC_INTERVAL);
        this.#connector = connector;
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
        // the first periodic resync handles all nodes once NTP has stabilized.
        if (this.#startupComplete) {
            this.syncNode(peer);
        }

        this.scheduleIfNeeded();
    }

    /**
     * Unregister a node from time sync tracking.
     */
    unregisterNode(peer: PeerAddress): void {
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
        const promise = this.#connector
            .syncTime(peer)
            .then(() => logger.info(`Synced time on node ${formatNodeId(peer)}`))
            .catch(error => logger.warn(`Failed to sync time on node ${formatNodeId(peer)}:`, error))
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
        logger.info("Time sync manager stopped");
    }

    protected override shouldProcess(peer: PeerAddress): boolean {
        return this.#connector.nodeConnected(peer) && !this.#inFlightSyncs.has(peer);
    }

    protected override async processNode(peer: PeerAddress): Promise<void> {
        try {
            await this.#connector.syncTime(peer);
            logger.info(`Periodic resync: synced time on node ${formatNodeId(peer)}`);
        } catch (error) {
            logger.warn(`Periodic resync: failed to sync time on node ${formatNodeId(peer)}:`, error);
        }
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
