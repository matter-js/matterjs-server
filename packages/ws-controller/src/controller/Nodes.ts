/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { FabricIndex, NodeId } from "@matter/main";
import { ClusterClientObj } from "@matter/main/protocol";
import { ClusterId, ClusterType, EndpointNumber } from "@matter/main/types";
import { InteractionClient } from "@project-chip/matter.js/cluster";
import { NodeStates, PairedNode } from "@project-chip/matter.js/device";
import { ServerError } from "../types/WebSocketMessageTypes.js";
import { AttributeDataCache } from "./AttributeDataCache.js";

/**
 * Format a NodeId as a PeerAddress string for logging.
 * Uses the matter.js format: @fabricIndex:nodeIdHex (e.g., "@1:a")
 *
 * @param nodeId The node ID to format
 * @param fabricIndex The fabric index (defaults to 1)
 * @returns Formatted PeerAddress string like "@1:a" or "@1:1f"
 */
export function formatNodeId(nodeId: NodeId, fabricIndex: FabricIndex = FabricIndex(1)): string {
    return `@${fabricIndex.toString(16)}:${nodeId.toString(16)}`;
}

/**
 * Manages node storage and provides access to nodes and their clients.
 *
 * This class handles:
 * - Storage of PairedNode instances
 * - Node retrieval and existence checking
 * - Access to interaction clients and cluster clients
 * - Attribute data caching
 * - Connection state tracking for availability debouncing
 */
export class Nodes {
    #nodes = new Map<NodeId, PairedNode>();
    #attributeCache = new AttributeDataCache();
    /** Track previous connection state for availability debouncing */
    #previousStates = new Map<NodeId, NodeStates>();

    /**
     * Get the attribute cache instance.
     */
    get attributeCache(): AttributeDataCache {
        return this.#attributeCache;
    }

    /**
     * Get all node IDs.
     */
    getIds(): NodeId[] {
        return Array.from(this.#nodes.keys());
    }

    /**
     * Get a node by ID.
     * @throws ServerError if node not found
     */
    get(nodeId: NodeId): PairedNode {
        const node = this.#nodes.get(nodeId);
        if (node === undefined) {
            throw ServerError.nodeNotExists(nodeId);
        }
        return node;
    }

    /**
     * Check if a node exists.
     */
    has(nodeId: NodeId): boolean {
        return this.#nodes.has(nodeId);
    }

    /**
     * Add or update a node in storage.
     */
    set(nodeId: NodeId, node: PairedNode): void {
        this.#nodes.set(nodeId, node);
    }

    /**
     * Remove a node from storage and clear its attribute cache and state tracking.
     */
    delete(nodeId: NodeId): void {
        this.#nodes.delete(nodeId);
        this.#attributeCache.delete(nodeId);
        this.#previousStates.delete(nodeId);
    }

    /**
     * Get the previous connection state for a node.
     */
    getPreviousState(nodeId: NodeId): NodeStates | undefined {
        return this.#previousStates.get(nodeId);
    }

    /**
     * Update the previous connection state for a node.
     * Call this after processing a state change to track state transitions.
     */
    setPreviousState(nodeId: NodeId, state: NodeStates): void {
        this.#previousStates.set(nodeId, state);
    }

    /**
     * Determine if a node should be considered available based on its connection state.
     * Uses debouncing logic similar to Python Matter Server:
     * - Connected: available
     * - Reconnecting when previously Connected: still available (debouncing)
     * - WaitingForDeviceDiscovery or Disconnected: unavailable
     *
     * @param currentState Current connection state
     * @param previousState Previous connection state (undefined if first state change)
     * @returns true if node should be considered available
     */
    isNodeAvailable(currentState: NodeStates, previousState?: NodeStates): boolean {
        if (currentState === NodeStates.Connected) {
            return true;
        }
        // Debounce: if transitioning from Connected to Reconnecting, still consider available
        if (currentState === NodeStates.Reconnecting && previousState === NodeStates.Connected) {
            return true;
        }
        // WaitingForDeviceDiscovery, Disconnected, or Reconnecting from non-connected state
        return false;
    }

    /**
     * Check if a node is available based on its current and previous connection state.
     * Uses debouncing: Reconnecting from Connected is still considered available.
     */
    isAvailable(nodeId: NodeId): boolean {
        const node = this.#nodes.get(nodeId);
        if (node === undefined) {
            return false;
        }
        const currentState = node.connectionState;
        const previousState = this.#previousStates.get(nodeId);
        return this.isNodeAvailable(currentState, previousState);
    }

    /**
     * Get the interaction client for a node.
     */
    interactionClientFor(nodeId: NodeId): Promise<InteractionClient> {
        return this.get(nodeId).getInteractionClient();
    }

    /**
     * Get a cluster client by cluster ID for a specific endpoint on a node.
     * @throws Error if endpoint or cluster not found
     * TODO: Migrate to new node API
     */
    clusterClientByIdFor(nodeId: NodeId, endpointId: EndpointNumber, clusterId: ClusterId): ClusterClientObj<any> {
        const node = this.get(nodeId);

        const endpoint = endpointId === 0 ? node.getRootEndpoint() : node.getDeviceById(endpointId);

        if (endpoint === undefined) {
            throw ServerError.invalidArguments(`Endpoint ${endpointId} on node ${nodeId} not found`);
        }

        const client = endpoint.getClusterClientById(clusterId);

        if (client === undefined) {
            throw ServerError.invalidArguments(
                `Cluster ${clusterId} on endpoint ${endpointId} on node ${nodeId} not found`,
            );
        }

        return client;
    }

    /**
     * Get a typed cluster client for a specific endpoint on a node.
     */
    clusterClientFor<const T extends ClusterType>(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        cluster: T,
    ): ClusterClientObj<T> {
        return this.clusterClientByIdFor(nodeId, endpointId, cluster.id) as ClusterClientObj<T>;
    }
}
