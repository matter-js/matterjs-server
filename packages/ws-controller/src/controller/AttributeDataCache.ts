/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClientNode, ClusterBehavior, Diagnostic, Logger, MatterError, Millis, NodeId, Time } from "@matter/main";
import { DecodedAttributeReportValue } from "@matter/main/protocol";
import { PairedNode } from "@project-chip/matter.js/device";
import { ClusterMap } from "../model/ModelMapper.js";
import { buildAttributePath, convertMatterToWebSocketTagBased } from "../server/Converters.js";
import { AttributesData } from "../types/CommandHandler.js";
import { formatNodeId } from "../util/formatNodeId.js";

const logger = Logger.get("AttributeDataCache");

/**
 * Tracks an in-flight asynchronous populate so concurrent populate requests collapse onto a single
 * run, and single-attribute updates arriving mid-run are replayed onto the freshly built snapshot.
 */
type PopulateContext = {
    rerun: boolean;
    cancelled: boolean;
    pending: Array<[path: string, value: unknown]>;
    promise: Promise<void>;
};

/**
 * Cache for node attributes in WebSocket format.
 *
 * Stores attributes pre-converted to WebSocket tag-based format as flat
 * "endpoint/cluster/attribute" keyed objects for direct retrieval when
 * clients request node data.
 */
export class AttributeDataCache {
    #cache = new Map<NodeId, AttributesData>();
    #inFlight = new Map<NodeId, PopulateContext>();

    /**
     * Add a node to the cache and populate its attributes.
     * No entry is created if the node is not yet initialized.
     */
    add(node: PairedNode): Promise<void> {
        return this.#populateFromNode(node, false);
    }

    /**
     * Remove a node from the cache.
     */
    delete(nodeId: NodeId): void {
        this.#cache.delete(nodeId);
        const context = this.#inFlight.get(nodeId);
        if (context !== undefined) {
            // Signal the running populate to stop at its next yield instead of churning through the
            // remaining endpoints of a node that no longer exists.
            context.cancelled = true;
            this.#inFlight.delete(nodeId);
        }
    }

    /**
     * Update (reinitialize) the cache for a node.
     * Creates a fresh cache from the node's current state.
     * Use this when the node structure may have changed (endpoints added/removed).
     */
    update(node: PairedNode): Promise<void> {
        return this.#populateFromNode(node, true);
    }

    /**
     * Update a single attribute in the cache.
     * Use this for incremental updates when an attribute value changes.
     */
    updateAttribute(nodeId: NodeId, data: DecodedAttributeReportValue<any>): void {
        const { endpointId, clusterId, attributeId } = data.path;

        const clusterData = ClusterMap[clusterId];
        const convertedValue = convertMatterToWebSocketTagBased(
            data.value,
            clusterData?.attributes[attributeId],
            clusterData?.model,
        );
        if (convertedValue === undefined) {
            return;
        }
        const path = buildAttributePath(endpointId, clusterId, attributeId);
        const inFlight = this.#inFlight.get(nodeId);
        const attributes = this.#cache.get(nodeId);

        // Only patch an existing complete snapshot. Never create an entry from a single attribute:
        // has() must not report a node as cached from a partial write, or ensureNodePopulated /
        // getNodeDetails would serve a truncated snapshot and skip the real populate. With no snapshot
        // yet, the value is captured by the in-flight populate's pending replay, or by the next full
        // populate (which reads live state) when none is running.
        if (attributes !== undefined) {
            attributes[path] = convertedValue;
        }

        // A full populate builds into a detached snapshot and swaps it in at the end, so a write
        // landing mid-run would be lost. Record it for replay onto that snapshot.
        inFlight?.pending.push([path, convertedValue]);
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
     *
     * Collecting attributes for a large node (~90 endpoints) is heavy synchronous work, so it is
     * chunked with event-loop yields. Concurrent calls for the same node collapse onto the running
     * populate instead of building competing snapshots.
     *
     * `rebuild` distinguishes a data-changed caller (state/structure change) that needs the running
     * pass redone from a caller that merely awaits completion (a read). Only the former schedules a
     * re-run; reads just await the in-flight promise, so frequent reads can never thrash the populate.
     */
    #populateFromNode(node: PairedNode, rebuild: boolean): Promise<void> {
        const nodeId = node.nodeId;
        if (!node.initialized || !node.node.lifecycle.isCommissioned || !node.node.lifecycle.isReady) {
            logger.debug(`Node ${formatNodeId(nodeId)} not initialized, skipping cache population`);
            return Promise.resolve();
        }

        const inFlight = this.#inFlight.get(nodeId);
        if (inFlight !== undefined) {
            if (rebuild) {
                inFlight.rerun = true;
                logger.debug(`Populate for node ${formatNodeId(nodeId)} already running, scheduling re-run`);
            }
            return inFlight.promise;
        }

        const context: PopulateContext = { rerun: false, cancelled: false, pending: [], promise: Promise.resolve() };
        context.promise = this.#runPopulate(node, context);
        this.#inFlight.set(nodeId, context);
        return context.promise;
    }

    async #runPopulate(node: PairedNode, context: PopulateContext): Promise<void> {
        const nodeId = node.nodeId;
        try {
            let attributeCount = 0;
            const startedAt = Time.nowMs;
            do {
                context.rerun = false;
                context.pending = [];

                const attributes: AttributesData = {};
                await this.#collectAttributes(node.node, attributes, context);

                // The node may have been deleted (or this run superseded) while suspended at a yield;
                // dropping the snapshot avoids resurrecting a removed node's cache entry.
                if (this.#inFlight.get(nodeId) !== context) {
                    return;
                }
                // A change requested another pass while collecting; discard this now-stale partial and
                // restart instead of finishing and swapping in data we are about to rebuild.
                if (context.rerun) {
                    continue;
                }
                for (const [path, value] of context.pending) {
                    attributes[path] = value;
                }
                this.#cache.set(nodeId, attributes);
                attributeCount = Object.keys(attributes).length;
            } while (context.rerun);

            logger.debug(
                `Populated attribute cache for node ${formatNodeId(nodeId)}: ${attributeCount} attributes in ${Time.nowMs - startedAt}ms`,
            );
        } catch (error) {
            logger.warn(`Failed to populate attribute cache for node ${formatNodeId(nodeId)}:`, error);
        } finally {
            if (this.#inFlight.get(nodeId) === context) {
                this.#inFlight.delete(nodeId);
            }
        }
    }

    /**
     * Collect attributes from all endpoints into a flat attribute object, yielding to the event loop
     * between endpoints so a large node does not block other timers, I/O, and WebSocket traffic.
     */
    async #collectAttributes(node: ClientNode, attributes: AttributesData, context: PopulateContext): Promise<void> {
        for (const endpoint of node.endpoints) {
            const endpointId = endpoint.number;

            for (const behavior of endpoint.behaviors.active) {
                if (!ClusterBehavior.is(behavior)) {
                    continue;
                }
                const cluster = behavior.cluster;
                const clusterData = ClusterMap[cluster.id];
                const clusterState = endpoint.stateOf(behavior) as Record<string, unknown>;

                for (const attribute of cluster.schema.attributes) {
                    try {
                        const convertedValue = convertMatterToWebSocketTagBased(
                            clusterState[attribute.propertyName],
                            clusterData?.attributes[attribute.id],
                            clusterData?.model,
                        );
                        if (convertedValue === undefined) {
                            continue;
                        }
                        attributes[buildAttributePath(endpointId, cluster.id, attribute.id)] = convertedValue;
                    } catch (error) {
                        MatterError.accept(error);
                        logger.debug(
                            `Ignoring Attribute ${attribute.propertyName} because of`,
                            Diagnostic.errorMessage(error),
                        );
                    }
                }
            }

            await Time.sleep("AttributeDataCache populate yield", Millis(0));
            // Bail on deletion or a requested re-run; #runPopulate drops or restarts the partial.
            if (context.cancelled || context.rerun) {
                return;
            }
        }
    }
}
