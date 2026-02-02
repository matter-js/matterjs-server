/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClientNode, ClusterBehavior, Logger, NodeId } from "@matter/main";
import { DecodedAttributeReportValue } from "@matter/main/protocol";
import { AttributeId, ClusterId, EndpointNumber, getClusterById } from "@matter/main/types";
import { PairedNode } from "@project-chip/matter.js/device";
import { ClusterMap } from "../model/ModelMapper.js";
import { buildAttributePath, convertMatterToWebSocketTagBased } from "../server/Converters.js";
import { AttributesData } from "../types/CommandHandler.js";
import { formatNodeId } from "../util/formatNodeId.js";

const logger = Logger.get("AttributeDataCache");

/**
 * Nested cache structure for node attributes in WebSocket format.
 * Structure: endpointId -> clusterId -> attributeId -> value
 */
type EndpointAttributeCache = Map<EndpointNumber, Map<ClusterId, Map<AttributeId, unknown>>>;

/**
 * Cache for node attributes in WebSocket format.
 *
 * Stores attributes pre-converted to WebSocket tag-based format for fast retrieval
 * when clients request node data. The cache is structured as:
 * nodeId -> endpointId -> clusterId -> attributeId -> value
 */
export class AttributeDataCache {
    #cache = new Map<NodeId, EndpointAttributeCache>();

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
     * Creates a fresh cache structure from the node's current state.
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

        let nodeCache = this.#cache.get(nodeId);
        if (!nodeCache) {
            nodeCache = new Map();
            this.#cache.set(nodeId, nodeCache);
        }

        let endpointCache = nodeCache.get(endpointId);
        if (!endpointCache) {
            endpointCache = new Map();
            nodeCache.set(endpointId, endpointCache);
        }

        let clusterCache = endpointCache.get(clusterId);
        if (!clusterCache) {
            clusterCache = new Map();
            endpointCache.set(clusterId, clusterCache);
        }

        // Convert and store the value
        const cluster = getClusterById(clusterId);
        const clusterData = ClusterMap[cluster.name.toLowerCase()];
        const convertedValue = convertMatterToWebSocketTagBased(
            data.value,
            clusterData?.attributes[attributeId],
            clusterData?.model,
        );
        if (convertedValue === undefined) {
            return;
        }
        clusterCache.set(attributeId, convertedValue);
    }

    /**
     * Get cached attributes for a node as flat AttributesData.
     * Returns undefined if no cache exists for the node.
     */
    get(nodeId: NodeId): AttributesData | undefined {
        const nodeCache = this.#cache.get(nodeId);
        if (!nodeCache) {
            return undefined;
        }

        const attributes: AttributesData = {};
        for (const [endpointId, endpointCache] of nodeCache) {
            for (const [clusterId, clusterCache] of endpointCache) {
                for (const [attributeId, value] of clusterCache) {
                    const pathStr = buildAttributePath(endpointId, clusterId, attributeId);
                    attributes[pathStr] = value;
                }
            }
        }
        return attributes;
    }

    /**
     * Check if a node exists in the cache.
     */
    has(nodeId: NodeId): boolean {
        return this.#cache.has(nodeId);
    }

    /**
     * Populate the cache for a node from its current state.
     * Creates a completely fresh cache structure.
     */
    #populateFromNode(node: PairedNode): void {
        const nodeId = node.nodeId;
        if (!node.initialized) {
            logger.debug(`Node ${formatNodeId(nodeId)} not initialized, skipping cache population`);
            return;
        }

        const nodeCache: EndpointAttributeCache = new Map();
        this.#collectAttributes(node.node, nodeCache);
        this.#cache.set(nodeId, nodeCache);
        logger.debug(`Populated attribute cache for node ${formatNodeId(nodeId)}`);
    }

    /**
     * Recursively collect attributes from an endpoint into the cache structure.
     * Always creates fresh maps for each endpoint and cluster to ensure no stale data.
     */
    #collectAttributes(node: ClientNode, nodeCache: EndpointAttributeCache): void {
        for (const endpoint of node.endpoints) {
            const endpointId = endpoint.number;
            // Always create fresh maps for this endpoint
            const endpointCache: Map<ClusterId, Map<AttributeId, unknown>> = new Map();

            for (const behavior of endpoint.behaviors.active) {
                if (!ClusterBehavior.is(behavior)) {
                    continue;
                }
                const cluster = behavior.cluster;
                const clusterId = cluster.id;
                const clusterData = ClusterMap[cluster.name.toLowerCase()];
                const clusterState = endpoint.stateOf(behavior) as Record<string, unknown>;

                // Always create a fresh map for this cluster
                const clusterCache: Map<AttributeId, unknown> = new Map();

                for (const attributeName in cluster.attributes) {
                    const attribute = cluster.attributes[attributeName];
                    if (attribute === undefined) {
                        continue;
                    }
                    const attributeValue = clusterState[attributeName];
                    const convertedValue = convertMatterToWebSocketTagBased(
                        attributeValue,
                        clusterData?.attributes[attribute.id],
                        clusterData?.model,
                    );
                    if (convertedValue === undefined) {
                        continue;
                    }
                    clusterCache.set(attribute.id, convertedValue);
                }

                if (clusterCache.size) {
                    endpointCache.set(clusterId, clusterCache);
                }
            }

            if (endpointCache.size) {
                nodeCache.set(endpointId, endpointCache);
            }
        }
    }
}
