/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeId } from "@matter/main";
import { EndpointNumber } from "@matter/main/types";
import { NodeStates, PairedNode } from "@project-chip/matter.js/device";
import { ServerError } from "../types/WebSocketMessageTypes.js";
import { AttributeDataCache } from "./AttributeDataCache.js";

/**
 * Manages node storage and tracks per-node availability.
 *
 * This class handles:
 * - Storage of PairedNode instances
 * - Node retrieval and existence checking
 * - Attribute data caching
 * - Connection state tracking for availability debouncing
 */
export class Nodes {
    #nodes = new Map<NodeId, PairedNode>();
    #attributeCache = new AttributeDataCache();
    /** Track previous connection state for availability debouncing */
    #previousStates = new Map<NodeId, NodeStates>();
    /** Cached availability so serialization and event paths always agree */
    #lastAvailability = new Map<NodeId, boolean>();
    /**
     * Endpoint additions queued until the next nodeStructureChanged for that node.
     * Preserves the wire contract used by python-matter-server: endpoint_added must
     * arrive AFTER a node_updated that already carries the new endpoint, so consumers
     * (e.g., Home Assistant) can resolve node.endpoints[endpoint_id] in their callback.
     */
    #pendingEndpointAdds = new Map<NodeId, EndpointNumber[]>();

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
        this.#lastAvailability.delete(nodeId);
        this.#pendingEndpointAdds.delete(nodeId);
    }

    /**
     * Buffer an endpoint_added until the next nodeStructureChanged for that node.
     */
    queueEndpointAdded(nodeId: NodeId, endpointId: EndpointNumber): void {
        let queue = this.#pendingEndpointAdds.get(nodeId);
        if (queue === undefined) {
            queue = [];
            this.#pendingEndpointAdds.set(nodeId, queue);
        }
        queue.push(endpointId);
    }

    /**
     * Take ownership of buffered endpoint additions for a node and clear the queue.
     * Returned array is in insertion order; an empty array is returned if nothing is queued.
     */
    drainPendingEndpointAdds(nodeId: NodeId): EndpointNumber[] {
        const queue = this.#pendingEndpointAdds.get(nodeId);
        if (queue === undefined || queue.length === 0) {
            return [];
        }
        this.#pendingEndpointAdds.delete(nodeId);
        return queue;
    }

    /**
     * Initialize state tracking for a newly paired/discovered node.
     * Sets previous state and initial availability so the first stateChanged event
     * has a real previous state instead of undefined.
     */
    seedState(nodeId: NodeId, initialState: NodeStates): void {
        this.#previousStates.set(nodeId, initialState);
        this.#lastAvailability.set(nodeId, initialState === NodeStates.Connected);
    }

    /**
     * Process a state change for a node. Reads previous state BEFORE updating,
     * computes new availability, and updates both tracking maps atomically.
     * Returns whether availability changed and the new value.
     */
    processStateChange(
        nodeId: NodeId,
        newState: NodeStates,
    ): { availabilityChanged: true; available: boolean } | { availabilityChanged: false } {
        const previousState = this.#previousStates.get(nodeId);
        const wasAvailable = this.#lastAvailability.get(nodeId) ?? false;
        const available = this.isNodeAvailable(newState, previousState);

        this.#previousStates.set(nodeId, newState);
        this.#lastAvailability.set(nodeId, available);

        if (wasAvailable !== available) {
            return { availabilityChanged: true, available };
        }
        return { availabilityChanged: false };
    }

    /**
     * Force a node to unavailable state. Used by reconnect timeout
     * when debounce period expires without reconnection.
     * Only updates #lastAvailability — #previousStates is left as-is because
     * processStateChange() will overwrite it on the next real state transition.
     * Returns true if the node was previously considered available.
     */
    forceUnavailable(nodeId: NodeId): boolean {
        const wasAvailable = this.#lastAvailability.get(nodeId) ?? false;
        this.#lastAvailability.set(nodeId, false);
        return wasAvailable;
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
     * Check if a node is available. Returns the cached availability value set by
     * seedState/processStateChange/forceUnavailable, avoiding the race where
     * recomputing from live state disagrees with the event path's determination.
     */
    isAvailable(nodeId: NodeId): boolean {
        return this.#lastAvailability.get(nodeId) ?? false;
    }
}
