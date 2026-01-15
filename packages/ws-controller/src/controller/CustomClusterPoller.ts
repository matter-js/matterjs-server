/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Handles polling of custom cluster attributes that don't support subscriptions.
 * This is primarily for Eve Energy devices that expose power measurements via
 * a custom cluster without standard Matter subscription support.
 */

import { CancelablePromise, Logger, Millis, NodeId, Seconds, Time, Timer } from "@matter/main";
import { AttributesData } from "../types/CommandHandler.js";

const logger = Logger.get("CustomClusterPoller");

// Eve vendor ID (0x130A = 4874)
const VENDOR_ID_EVE = 4874;

// Eve custom cluster ID (0x130AFC01)
const EVE_CLUSTER_ID = 0x130afc01;

// Eve energy attribute IDs that should be polled
const EVE_ENERGY_ATTRIBUTE_IDS = {
    watt: 0x130a000a,
    wattAccumulated: 0x130a000b,
    voltage: 0x130a0008,
    current: 0x130a0009,
};

// Standard Matter ElectricalPowerMeasurement cluster ID
const ELECTRICAL_POWER_MEASUREMENT_CLUSTER_ID = 0x0090; // 144

// Polling interval in milliseconds (30 seconds, same as Python server)
const POLLING_INTERVAL_MS = 30_000;

// Maximum initial delay in milliseconds (random 0-30s to stagger startup)
const MAX_INITIAL_DELAY_MS = 30_000;

// Attribute path format: endpoint/cluster/attribute
type AttributePath = string;

export interface NodeAttributeReader {
    handleReadAttributes(nodeId: NodeId, attributePaths: string[], fabricFiltered?: boolean): Promise<AttributesData>;
}

/**
 * Check if a node needs custom attribute polling based on its attributes.
 *
 * A node needs polling if:
 * 1. It has Eve vendor ID (4874) at endpoint 0/40/2 (BasicInformation.VendorID)
 * 2. It has Eve custom cluster (0x130AFC01) with energy attributes
 * 3. It does NOT have the standard ElectricalPowerMeasurement cluster (0x0090)
 */
export function checkPolledAttributes(attributes: AttributesData): Set<AttributePath> {
    const polledAttributes = new Set<AttributePath>();

    // Check vendor ID - attribute path: 0/40/2 (endpoint 0, BasicInformation cluster, VendorID attribute)
    const vendorId = attributes["0/40/2"];
    if (vendorId !== VENDOR_ID_EVE) {
        // Not an Eve device (or not the original Eve vendor - some bridges mimic Eve clusters)
        return polledAttributes;
    }

    // Find endpoints that have the Eve cluster
    const eveEndpoints = new Set<number>();
    for (const attrPath of Object.keys(attributes)) {
        const [endpointStr, clusterStr] = attrPath.split("/");
        const clusterId = Number(clusterStr);
        if (clusterId === EVE_CLUSTER_ID) {
            eveEndpoints.add(Number(endpointStr));
        }
    }

    if (eveEndpoints.size === 0) {
        return polledAttributes;
    }

    // Check if ElectricalPowerMeasurement cluster exists (if so, no need to poll Eve cluster)
    // The standard cluster would be on endpoint 2 typically
    for (const attrPath of Object.keys(attributes)) {
        const [, clusterStr] = attrPath.split("/");
        const clusterId = Number(clusterStr);
        if (clusterId === ELECTRICAL_POWER_MEASUREMENT_CLUSTER_ID) {
            // Has standard cluster, no need to poll Eve energy attributes
            logger.debug("Node has standard ElectricalPowerMeasurement cluster, skipping Eve energy polling");
            return polledAttributes;
        }
    }

    // Add Eve energy attributes to poll for each Eve endpoint
    for (const endpoint of eveEndpoints) {
        for (const [, attributeId] of Object.entries(EVE_ENERGY_ATTRIBUTE_IDS)) {
            const attrPath = `${endpoint}/${EVE_CLUSTER_ID}/${attributeId}`;
            // Only add if the attribute exists in the node's attributes
            if (attrPath in attributes) {
                polledAttributes.add(attrPath);
            }
        }
    }

    if (polledAttributes.size > 0) {
        logger.info(`Eve device detected, will poll ${polledAttributes.size} energy attributes`);
    }

    return polledAttributes;
}

/**
 * Manages polling of custom cluster attributes for multiple nodes.
 */
export class CustomClusterPoller {
    #polledAttributes = new Map<NodeId, Set<AttributePath>>();
    #pollerTimer: Timer;
    #attributeReader: NodeAttributeReader;
    #isPolling = false;
    #currentDelayPromise?: CancelablePromise;
    #closed = false;

    constructor(attributeReader: NodeAttributeReader) {
        this.#attributeReader = attributeReader;
        const delay = Millis(Math.random() * MAX_INITIAL_DELAY_MS);
        this.#pollerTimer = Time.getTimer("eve-poller", delay, () => this.#pollAllNodes());
        logger.info(`Scheduling initial custom attribute poll in ${Seconds.of(delay)}s`);
    }

    /**
     * Register a node for polling if it has custom attributes that need polling.
     * Call this after a node is connected and its attributes are available.
     */
    registerNode(nodeId: NodeId, attributes: AttributesData): void {
        const attributesToPoll = checkPolledAttributes(attributes);

        if (attributesToPoll.size === 0) {
            // Remove from polling if it was previously registered
            this.unregisterNode(nodeId);
            return;
        }

        this.#polledAttributes.set(nodeId, attributesToPoll);
        logger.info(
            `Registered node ${nodeId} for custom attribute polling: ${Array.from(attributesToPoll).join(", ")}`,
        );

        // Start the poller if not already running
        this.#schedulePoller();
    }

    /**
     * Unregister a node from polling (e.g., when decommissioned or disconnected).
     */
    unregisterNode(nodeId: NodeId): void {
        if (this.#polledAttributes.delete(nodeId)) {
            logger.info(`Unregistered node ${nodeId} from custom attribute polling`);
        }
    }

    /**
     * Check if a node has any attributes being polled.
     */
    hasPolledAttributes(nodeId: NodeId): boolean {
        return this.#polledAttributes.has(nodeId);
    }

    /**
     * Get the set of polled attributes for a node.
     */
    getPolledAttributes(nodeId: NodeId): Set<AttributePath> | undefined {
        return this.#polledAttributes.get(nodeId);
    }

    /**
     * Stop all polling and cleanup.
     */
    stop(): void {
        this.#closed = true;
        this.#currentDelayPromise?.cancel(new Error("Close"));
        this.#pollerTimer?.stop();
        this.#polledAttributes.clear();
        logger.info("Custom attribute poller stopped");
    }

    /**
     * Schedule the next polling cycle.
     * Uses a random initial delay (0-30s) on first run to stagger startup,
     * then polls every 30s thereafter.
     */
    #schedulePoller(): void {
        // No schedule if no nodes to poll
        if (this.#polledAttributes.size === 0 || this.#closed) {
            return;
        }

        // Don't schedule if already scheduled
        if (this.#pollerTimer?.isRunning || this.#isPolling) {
            return;
        }

        // Set the new interval
        this.#pollerTimer.start();
    }

    /**
     * Poll all registered nodes for their custom attributes.
     */
    async #pollAllNodes(): Promise<void> {
        if (this.#isPolling) {
            // Already polling, schedule next cycle
            return;
        }

        this.#pollerTimer.interval = Millis(POLLING_INTERVAL_MS);

        this.#isPolling = true;

        try {
            for (const [nodeId, attributePaths] of this.#polledAttributes) {
                await this.#pollNode(nodeId, attributePaths);
                // Small delay between nodes to avoid overwhelming the network
                this.#currentDelayPromise = Time.sleep("sleep", Millis(1_000));
                await this.#currentDelayPromise;
            }
        } finally {
            this.#isPolling = false;
            // Schedule next polling cycle
            this.#schedulePoller();
        }
    }

    /**
     * Poll a single node for its custom attributes.
     * The read will automatically trigger change events through the normal attribute flow.
     */
    async #pollNode(nodeId: NodeId, attributePaths: Set<AttributePath>): Promise<void> {
        const paths = Array.from(attributePaths);
        logger.debug(`Polling ${paths.length} custom attributes for node ${nodeId}`);

        try {
            // Read with fabricFiltered=true as per Eve's requirements
            // This automatically updates the attribute cache and triggers change events
            await this.#attributeReader.handleReadAttributes(nodeId, paths, true);
        } catch (error) {
            logger.warn(`Failed to poll custom attributes for node ${nodeId}: `, error);
        }
    }
}
