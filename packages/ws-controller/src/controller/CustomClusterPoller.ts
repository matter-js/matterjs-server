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

import { Logger } from "@matter/main";
import { PeerAddress, PeerAddressMap } from "@matter/main/protocol";
import { AttributesData } from "../types/CommandHandler.js";
import { formatNodeId } from "../util/formatNodeId.js";
import { NodeProcessor } from "./NodeProcessor.js";

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

// Polling interval in milliseconds (60 seconds)
const POLLING_INTERVAL_MS = 60_000;

// Initial delay range: random 30-60s to stagger startup
const INITIAL_DELAY_MS = 30_000;

// Attribute path format: endpoint/cluster/attribute
type AttributePath = string;

export interface NodeAttributeReader {
    handleReadAttributes(
        peer: PeerAddress,
        attributePaths: string[],
        fabricFiltered?: boolean,
    ): Promise<AttributesData>;
    nodeConnected(peer: PeerAddress): boolean;
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

    // Add Eve energy attributes to a poll for each Eve endpoint
    for (const endpoint of eveEndpoints) {
        for (const [, attributeId] of Object.entries(EVE_ENERGY_ATTRIBUTE_IDS)) {
            const attrPath = `${endpoint}/${EVE_CLUSTER_ID}/${attributeId}`;
            // Only add if the attribute exists in the node's attributes
            if (attributes[attrPath] !== undefined) {
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
export class CustomClusterPoller extends NodeProcessor {
    #polledAttributes = new PeerAddressMap<Set<AttributePath>>();
    readonly #attributeReader: NodeAttributeReader;
    #currentReadPromise?: Promise<void>;

    constructor(attributeReader: NodeAttributeReader) {
        super("eve-poller", INITIAL_DELAY_MS + Math.random() * INITIAL_DELAY_MS, POLLING_INTERVAL_MS);
        this.#attributeReader = attributeReader;
    }

    /**
     * Register a node for polling if it has custom attributes that need polling.
     * Call this after a node is connected and its attributes are available.
     */
    registerNode(peer: PeerAddress, attributes: AttributesData): void {
        const attributesToPoll = checkPolledAttributes(attributes);

        if (attributesToPoll.size === 0) {
            this.unregisterNode(peer);
            return;
        }

        this.#polledAttributes.set(peer, attributesToPoll);
        if (this.registerPeer(peer)) {
            logger.info(
                `Registered node ${formatNodeId(peer)} for custom attribute polling: ${Array.from(attributesToPoll).join(", ")}`,
            );
        }

        this.scheduleIfNeeded();
    }

    /**
     * Unregister a node from polling (e.g., when decommissioned or disconnected).
     */
    unregisterNode(peer: PeerAddress): void {
        this.#polledAttributes.delete(peer);
        if (this.unregisterPeer(peer)) {
            logger.info(`Unregistered node ${formatNodeId(peer)} from custom attribute polling`);
        }
    }

    override async stop(): Promise<void> {
        await super.stop();
        if (this.#currentReadPromise) {
            await this.#currentReadPromise;
        }
        this.#polledAttributes.clear();
        logger.info("Custom attribute poller stopped");
    }

    protected override shouldProcess(peer: PeerAddress): boolean {
        return this.#attributeReader.nodeConnected(peer);
    }

    protected override async processNode(peer: PeerAddress): Promise<void> {
        const attributePaths = this.#polledAttributes.get(peer);
        if (!attributePaths) return;

        const paths = Array.from(attributePaths);
        logger.debug(`Polling ${paths.length} custom attributes for node ${formatNodeId(peer)}`);

        try {
            // Read with fabricFiltered=true as per Eve's requirements
            // This automatically updates the attribute cache and triggers change events
            const readPromise = this.#attributeReader.handleReadAttributes(peer, paths, true);
            this.#currentReadPromise = readPromise.then(
                () => {},
                () => {},
            );
            await readPromise;
        } catch (error) {
            logger.warn(`Failed to poll custom attributes for node ${formatNodeId(peer)}: `, error);
        } finally {
            this.#currentReadPromise = undefined;
        }
    }

    protected override onCycleComplete(processedCount: number, intervalFormatted: string): void {
        if (processedCount > 0) {
            logger.info(`Polled ${processedCount} nodes for energy data. Next poll in ${intervalFormatted}`);
        }
    }
}
