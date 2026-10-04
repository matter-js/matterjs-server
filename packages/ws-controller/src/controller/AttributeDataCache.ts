/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Behavior, ClusterBehavior, Diagnostic, Logger, MatterError, Millis, NodeId, Time } from "@matter/main";
import { AttributeList, AttributeModel } from "@matter/main/model";
import { DecodedAttributeReportValue } from "@matter/main/protocol";
import { ClusterMap } from "../model/ModelMapper.js";
import { buildAttributePath, convertMatterToWebSocketTagBased } from "../server/Converters.js";
import { AttributesData } from "../types/CommandHandler.js";
import { formatNodeId } from "../util/formatNodeId.js";

const logger = Logger.get("AttributeDataCache");

/**
 * The parts of a `PairedNode` the cache reads.
 */
export interface AttributeSourceNode {
    readonly nodeId: NodeId;
    readonly initialized: boolean;
    readonly node: {
        readonly lifecycle: { readonly isCommissioned: boolean; readonly isReady: boolean };
        readonly endpoints: Iterable<AttributeSourceEndpoint>;
    };
}

export interface AttributeSourceEndpoint {
    readonly number: number;
    readonly behaviors: { readonly active: Iterable<Behavior.Type> };
    stateOf(type: ClusterBehavior.Type): object;
}

/** A change to one attribute with its converted value; `undefined` records a removal. */
type AttributeChange = { endpointId: number; clusterId: number; attributeId: number; value: unknown };

/**
 * Tracks an in-flight asynchronous populate so concurrent populate requests collapse onto a single
 * run, and single-attribute updates arriving mid-run are replayed onto the freshly built snapshot.
 */
type PopulateContext = {
    rerun: boolean;
    cancelled: boolean;
    pending: Array<AttributeChange>;
    promise: Promise<void>;
};

/**
 * Cache for node attributes in WebSocket format.
 *
 * Stores attributes pre-converted to WebSocket tag-based format as flat
 * "endpoint/cluster/attribute" keyed objects for direct retrieval when
 * clients request node data. Only attributes the cluster's AttributeList reports are stored (see {@link isListed}).
 */
export class AttributeDataCache {
    #cache = new Map<NodeId, AttributesData>();
    #inFlight = new Map<NodeId, PopulateContext>();

    /**
     * Add a node to the cache and populate its attributes.
     * No entry is created if the node is not yet initialized.
     */
    add(node: AttributeSourceNode): Promise<void> {
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
     * Use this when the node structure may have changed (endpoints added/removed, AttributeList changed).
     */
    update(node: AttributeSourceNode): Promise<void> {
        return this.#populateFromNode(node, true);
    }

    /**
     * Update a single attribute in the cache.
     * Use this for incremental updates when an attribute value changes. An `undefined` value removes the attribute,
     * which matter.js reports when a new AttributeList drops it.
     *
     * @returns whether clients should see the change as an attribute update: `false` for a removal and for an
     *   attribute the cached AttributeList does not report. Without a snapshot every value counts as visible.
     */
    updateAttribute(nodeId: NodeId, data: DecodedAttributeReportValue<any>): boolean {
        const { endpointId, clusterId, attributeId } = data.path;

        const clusterData = ClusterMap[clusterId];
        const convertedValue = convertMatterToWebSocketTagBased(
            data.value,
            clusterData?.attributes[attributeId],
            clusterData?.model,
        );
        const change: AttributeChange = { endpointId, clusterId, attributeId, value: convertedValue };
        const inFlight = this.#inFlight.get(nodeId);
        const attributes = this.#cache.get(nodeId);

        // A full populate builds into a detached snapshot and swaps it in at the end, so a write
        // landing mid-run would be lost. Record it for replay onto that snapshot.
        inFlight?.pending.push(change);

        // Only patch an existing complete snapshot. Never create an entry from a single attribute:
        // has() must not report a node as cached from a partial write, or ensureNodePopulated /
        // getNodeDetails would serve a truncated snapshot and skip the real populate. With no snapshot
        // yet, the value is captured by the in-flight populate's pending replay, or by the next full
        // populate (which reads live state) when none is running.
        if (attributes === undefined) {
            return convertedValue !== undefined;
        }
        return applyChange(attributes, change);
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
    #populateFromNode(node: AttributeSourceNode, rebuild: boolean): Promise<void> {
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

    async #runPopulate(node: AttributeSourceNode, context: PopulateContext): Promise<void> {
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
                for (const change of context.pending) {
                    applyChange(attributes, change);
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
    async #collectAttributes(
        node: AttributeSourceNode["node"],
        attributes: AttributesData,
        context: PopulateContext,
    ): Promise<void> {
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
                    if (!isListed(attribute.id, clusterState.attributeList)) {
                        continue;
                    }
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

/**
 * Whether a cluster's AttributeList reports an attribute. Global attributes always count as listed.
 *
 * Some devices report an empty AttributeList despite returning attribute data, so only a non-empty list is
 * authoritative. This matches how matter.js `ClientStructure` derives the peer's attribute set.
 */
function isListed(attributeId: number, attributeList: unknown): boolean {
    if (AttributeModel.globalIds.has(attributeId) || !Array.isArray(attributeList) || !attributeList.length) {
        return true;
    }
    return attributeList.includes(attributeId);
}

/**
 * Apply a change to a snapshot, checked against the AttributeList stored in that snapshot.
 *
 * @returns whether a visible value was written
 */
function applyChange(attributes: AttributesData, { endpointId, clusterId, attributeId, value }: AttributeChange) {
    const path = buildAttributePath(endpointId, clusterId, attributeId);
    if (value === undefined) {
        delete attributes[path];
        return false;
    }
    if (!isListed(attributeId, attributes[buildAttributePath(endpointId, clusterId, AttributeList.id)])) {
        return false;
    }
    attributes[path] = value;
    return true;
}
