/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClientNode, NodeConnectionState, NodeId } from "@matter/main";
import { EndpointNumber } from "@matter/main/types";
import { ServerError } from "../types/WebSocketMessageTypes.js";
import { AttributeDataCache } from "./AttributeDataCache.js";

/**
 * Manages node storage and tracks per-node availability.
 *
 * This class handles:
 * - Storage of ClientNode instances
 * - Node retrieval and existence checking
 * - Attribute data caching
 * - Connection state tracking for availability
 */
export class Nodes {
    #nodes = new Map<NodeId, ClientNode>();
    #attributeCache = new AttributeDataCache();
    /** Cached so serialization and event paths always agree on availability. */
    #lastAvailability = new Map<NodeId, boolean>();
    /**
     * Buffered endpoint_added events. python-matter-server wire contract requires
     * node_updated (carrying the new endpoint) to arrive before endpoint_added,
     * so HA can resolve node.endpoints[endpoint_id] in its callback.
     */
    #pendingEndpointAdds = new Map<NodeId, EndpointNumber[]>();

    get attributeCache(): AttributeDataCache {
        return this.#attributeCache;
    }

    getIds(): NodeId[] {
        return Array.from(this.#nodes.keys());
    }

    /** @throws ServerError if node not found */
    get(nodeId: NodeId): ClientNode {
        const node = this.#nodes.get(nodeId);
        if (node === undefined) {
            throw ServerError.nodeNotExists(nodeId);
        }
        return node;
    }

    has(nodeId: NodeId): boolean {
        return this.#nodes.has(nodeId);
    }

    set(nodeId: NodeId, node: ClientNode): void {
        this.#nodes.set(nodeId, node);
    }

    delete(nodeId: NodeId): void {
        this.#nodes.delete(nodeId);
        this.#attributeCache.delete(nodeId);
        this.#lastAvailability.delete(nodeId);
        this.#pendingEndpointAdds.delete(nodeId);
    }

    queueEndpointAdded(nodeId: NodeId, endpointId: EndpointNumber): void {
        let queue = this.#pendingEndpointAdds.get(nodeId);
        if (queue === undefined) {
            queue = [];
            this.#pendingEndpointAdds.set(nodeId, queue);
        }
        queue.push(endpointId);
    }

    /** Returns insertion-ordered queue; empty if nothing pending. */
    drainPendingEndpointAdds(nodeId: NodeId): EndpointNumber[] {
        const queue = this.#pendingEndpointAdds.get(nodeId);
        if (queue === undefined || queue.length === 0) {
            return [];
        }
        this.#pendingEndpointAdds.delete(nodeId);
        return queue;
    }

    seedState(nodeId: NodeId, initialState: NodeConnectionState): void {
        this.#lastAvailability.set(nodeId, this.isNodeAvailable(initialState));
    }

    processStateChange(
        nodeId: NodeId,
        newState: NodeConnectionState,
    ): { availabilityChanged: true; available: boolean } | { availabilityChanged: false } {
        const wasAvailable = this.#lastAvailability.get(nodeId) ?? false;
        const available = this.isNodeAvailable(newState);

        this.#lastAvailability.set(nodeId, available);

        if (wasAvailable !== available) {
            return { availabilityChanged: true, available };
        }
        return { availabilityChanged: false };
    }

    /**
     * Reconnecting counts as available: the new connection-state engine only reports
     * WaitingForDeviceDiscovery once a peer is known unreachable — the MRP budget was exhausted with no
     * reply, or a registered ICD missed its check-in.
     */
    isNodeAvailable(currentState: NodeConnectionState): boolean {
        return currentState === NodeConnectionState.Connected || currentState === NodeConnectionState.Reconnecting;
    }

    /** Returns the cached value, not a recomputation — avoids disagreement with the event path. */
    isAvailable(nodeId: NodeId): boolean {
        return this.#lastAvailability.get(nodeId) ?? false;
    }
}
