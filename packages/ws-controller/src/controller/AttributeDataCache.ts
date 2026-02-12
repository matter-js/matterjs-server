/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClientNode, ClusterBehavior, Logger, NodeId } from "@matter/main";
import { DecodedAttributeReportValue } from "@matter/main/protocol";
import { PairedNode } from "@project-chip/matter.js/device";
import { ClusterMap } from "../model/ModelMapper.js";
import { buildAttributePath, convertMatterToWebSocketTagBased } from "../server/Converters.js";
import { AttributesData } from "../types/CommandHandler.js";
import { formatNodeId } from "../util/formatNodeId.js";

const logger = Logger.get("AttributeDataCache");

/**
 * Cache for node attributes in WebSocket format.
 *
 * Stores attributes pre-converted to WebSocket tag-based format as flat
 * "endpoint/cluster/attribute" keyed objects for direct retrieval when
 * clients request node data.
 */
export class AttributeDataCache {
    #cache = new Map<NodeId, AttributesData>();

    /**
     * Add a node to the cache and populate its attributes.
     * If the node is not initialized, the cache entry will be empty.
     */
    add(node: PairedNode): void {
        this.#populateFromNode(node);
    }

    /**
     * Remove a node from the cache.
     */
    delete(nodeId: NodeId): void {
        this.#cache.delete(nodeId);
    }

    /**
     * Update (reinitialize) the cache for a node.
     * Creates a fresh cache from the node's current state.
     * Use this when the node structure may have changed (endpoints added/removed).
     */
    update(node: PairedNode): void {
        this.#populateFromNode(node);
    }

    /**
     * Update a single attribute in the cache.
     * Use this for incremental updates when an attribute value changes.
     */
    updateAttribute(nodeId: NodeId, data: DecodedAttributeReportValue<any>): void {
        const { endpointId, clusterId, attributeId } = data.path;

        let attributes = this.#cache.get(nodeId);
        if (!attributes) {
            attributes = {};
            this.#cache.set(nodeId, attributes);
        }

        // Convert and store the value
        const clusterData = ClusterMap[clusterId];
        const convertedValue = convertMatterToWebSocketTagBased(
            data.value,
            clusterData?.attributes[attributeId],
            clusterData?.model,
        );
        if (convertedValue === undefined) {
            return;
        }
        attributes[buildAttributePath(endpointId, clusterId, attributeId)] = convertedValue;
    }

    /**
     * Get cached attributes for a node.
     * Returns undefined if no cache exists for the node.
     */
    get(nodeId: NodeId): AttributesData | undefined {
        return this.#cache.get(nodeId);
    }

    /**
     * Check if a node exists in the cache.
     */
    has(nodeId: NodeId): boolean {
        return this.#cache.has(nodeId);
    }

    /**
     * Populate the cache for a node from its current state.
     * Creates a completely fresh flat attribute object.
     */
    #populateFromNode(node: PairedNode): void {
        const nodeId = node.nodeId;
        if (!node.initialized || !node.node.lifecycle.isCommissioned || !node.node.lifecycle.isReady) {
            logger.debug(`Node ${formatNodeId(nodeId)} not initialized, skipping cache population`);
            return;
        }

        try {
            const attributes: AttributesData = {};
            this.#collectAttributes(node.node, attributes);
            this.#cache.set(nodeId, attributes);
        } catch (error) {
            logger.warn(`Failed to populate attribute cache for node ${formatNodeId(nodeId)}:`, error);
            return;
        }
        logger.debug(`Populated attribute cache for node ${formatNodeId(nodeId)}`);
    }

    /**
     * Collect attributes from all endpoints into a flat attribute object.
     */
    #collectAttributes(node: ClientNode, attributes: AttributesData): void {
        for (const endpoint of node.endpoints) {
            const endpointId = endpoint.number;

            for (const behavior of endpoint.behaviors.active) {
                if (!ClusterBehavior.is(behavior)) {
                    continue;
                }
                const cluster = behavior.cluster;
                const clusterData = ClusterMap[cluster.id];
                const clusterState = endpoint.stateOf(behavior) as Record<string, unknown>;

                for (const attributeName in cluster.attributes) {
                    const attribute = cluster.attributes[attributeName];
                    if (attribute === undefined) {
                        continue;
                    }
                    const convertedValue = convertMatterToWebSocketTagBased(
                        clusterState[attributeName],
                        clusterData?.attributes[attribute.id],
                        clusterData?.model,
                    );
                    if (convertedValue === undefined) {
                        continue;
                    }
                    attributes[buildAttributePath(endpointId, cluster.id, attribute.id)] = convertedValue;
                }
            }
        }
    }
}
