/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Handles time synchronization for nodes with the TimeSynchronization cluster.
 * Syncs UTC time on three triggers:
 * 1. Node connects/reconnects (immediate)
 * 2. timeFailure event from the node (reactive)
 * 3. Periodic resync every 12 hours
 */

import { CancelablePromise, Duration, Logger, Millis, NodeId, Time, Timer } from "@matter/main";
import { DecodedEventReportValue } from "@matter/main/protocol";
import { AttributesData } from "../types/CommandHandler.js";

const logger = Logger.get("TimeSyncManager");

// TimeSynchronization cluster ID (0x0038 = 56 decimal)
const TIME_SYNC_CLUSTER_ID = 0x0038;

// timeFailure event ID within TimeSynchronization cluster
const TIME_FAILURE_EVENT_ID = 0x03;

// Periodic resync interval: 12 hours
const RESYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;

// Maximum initial delay in milliseconds (random 0-60s to stagger startup)
const MAX_INITIAL_DELAY_MS = 60_000;

export interface TimeSyncConnector {
    syncTime(nodeId: NodeId): Promise<void>;
    nodeConnected(nodeId: NodeId): boolean;
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
export class TimeSyncManager {
    #registeredNodes = new Set<NodeId>();
    #resyncTimer: Timer;
    #connector: TimeSyncConnector;
    #isResyncing = false;
    #currentDelayPromise?: CancelablePromise;
    #closed = false;

    constructor(connector: TimeSyncConnector) {
        this.#connector = connector;
        const delay = Millis(Math.random() * MAX_INITIAL_DELAY_MS);
        this.#resyncTimer = Time.getTimer("time-sync-resync", delay, () => this.#resyncAllNodes());
    }

    /**
     * Register a node for time sync if it has the TimeSynchronization cluster.
     * Call this after a node connects and its attributes are available.
     * Immediately syncs time on the node (fire-and-forget).
     */
    registerNode(nodeId: NodeId, attributes: AttributesData): void {
        if (!hasTimeSyncCluster(attributes)) {
            this.unregisterNode(nodeId);
            return;
        }

        const isNew = !this.#registeredNodes.has(nodeId);
        this.#registeredNodes.add(nodeId);

        if (isNew) {
            logger.info(`Registered node ${nodeId} for time synchronization`);
        }

        // Sync time immediately on connect/reconnect
        this.#syncNode(nodeId);

        // Start periodic resync if not already running
        this.#scheduleResync();
    }

    /**
     * Unregister a node from time sync tracking.
     */
    unregisterNode(nodeId: NodeId): void {
        if (this.#registeredNodes.delete(nodeId)) {
            logger.info(`Unregistered node ${nodeId} from time synchronization`);
        }
        if (this.#registeredNodes.size === 0) {
            this.#resyncTimer.stop();
        }
    }

    /**
     * Handle an event from a node. If it's a timeFailure event, sync time.
     */
    handleEvent(nodeId: NodeId, data: DecodedEventReportValue<any>): void {
        const { path } = data;
        if (path.clusterId === TIME_SYNC_CLUSTER_ID && path.eventId === TIME_FAILURE_EVENT_ID) {
            logger.info(`Received timeFailure event from node ${nodeId}, syncing time`);
            this.#syncNode(nodeId);
        }
    }

    /**
     * Stop all time sync operations and cleanup.
     */
    stop(): void {
        this.#closed = true;
        this.#currentDelayPromise?.cancel(new Error("Close"));
        this.#resyncTimer?.stop();
        this.#registeredNodes.clear();
        logger.info("Time sync manager stopped");
    }

    /**
     * Sync time on a single node (fire-and-forget with error handling).
     */
    #syncNode(nodeId: NodeId): void {
        if (this.#closed || !this.#registeredNodes.has(nodeId)) {
            return;
        }
        if (!this.#connector.nodeConnected(nodeId)) {
            logger.debug(`Node ${nodeId} not connected, skipping time sync`);
            return;
        }
        this.#connector.syncTime(nodeId).then(
            () => logger.info(`Synced time on node ${nodeId}`),
            error => logger.warn(`Failed to sync time on node ${nodeId}:`, error),
        );
    }

    #scheduleResync(): void {
        if (this.#registeredNodes.size === 0 || this.#closed) {
            return;
        }
        if (this.#resyncTimer?.isRunning || this.#isResyncing) {
            return;
        }
        this.#resyncTimer.start();
    }

    async #resyncAllNodes(): Promise<void> {
        if (this.#isResyncing) {
            return;
        }

        const targetInterval = Millis(RESYNC_INTERVAL_MS);
        if (this.#resyncTimer.interval !== targetInterval) {
            this.#resyncTimer.interval = targetInterval;
        }

        this.#isResyncing = true;

        let syncedNodes = 0;
        try {
            const nodes = Array.from(this.#registeredNodes);
            for (let i = 0; i < nodes.length; i++) {
                const nodeId = nodes[i];
                if (!this.#registeredNodes.has(nodeId)) {
                    continue;
                }
                if (!this.#connector.nodeConnected(nodeId)) {
                    continue;
                }
                syncedNodes++;
                try {
                    await this.#connector.syncTime(nodeId);
                    logger.info(`Periodic resync: synced time on node ${nodeId}`);
                } catch (error) {
                    logger.warn(`Periodic resync: failed to sync time on node ${nodeId}:`, error);
                }
                // Small delay between nodes to avoid overwhelming the network
                if (i < nodes.length - 1) {
                    this.#currentDelayPromise = Time.sleep("sleep", Millis(2_000)).finally(() => {
                        this.#currentDelayPromise = undefined;
                    });
                    await this.#currentDelayPromise;
                }
            }
        } finally {
            this.#isResyncing = false;
            this.#scheduleResync();
        }
        if (syncedNodes > 0) {
            logger.info(
                `Periodic resync complete: synced ${syncedNodes} nodes. Next resync in ${Duration.format(this.#resyncTimer.interval)}`,
            );
        }
    }
}
