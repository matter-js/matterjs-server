/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ClientNode,
    ClusterBehavior,
    Diagnostic,
    Duration,
    Logger,
    MatterError,
    Millis,
    NodeId,
    Observable,
    Time,
    Timestamp,
} from "@matter/main";
import { BasicInformationClient } from "@matter/main/behaviors";
import { EndpointNumber } from "@matter/main/types";
import { ClusterMap } from "../model/ModelMapper.js";
import { buildAttributePath, convertMatterToWebSocketTagBased } from "../server/Converters.js";
import { AttributesData, EndpointParentsData } from "../types/CommandHandler.js";
import { formatNodeId } from "../util/formatNodeId.js";
import { nodeIdOf } from "../util/nodeIdOf.js";
import { AttributeChange } from "./PeerChangeBus.js";

const logger = Logger.get("AttributeDataCache");

/** A node's attributes, and the parent of each endpoint as of the populate that built them. */
type NodeSnapshot = {
    attributes: AttributesData;
    endpointParents: EndpointParentsData;
};

/**
 * Tracks an in-flight asynchronous populate so concurrent populate requests collapse onto a single
 * run, and single-attribute updates arriving mid-run are replayed onto the freshly built snapshot.
 */
type PopulateContext = {
    rerun: boolean;
    cancelled: boolean;
    /** Time spent waiting at the event-loop yields of this populate. */
    yieldWait: Duration;
    /** An `undefined` value records a removed attribute. */
    pending: Array<[path: string, value: unknown]>;
    promise: Promise<void>;
};

/** Snapshots a cache wrote, and the time spent collecting them, not counting the waits at event-loop yields. */
export interface PopulateTiming {
    populated: number;
    collecting: Duration;
}

/**
 * Cache for node attributes in WebSocket format.
 *
 * Stores attributes pre-converted to WebSocket tag-based format as flat
 * "endpoint/cluster/attribute" keyed objects for direct retrieval when
 * clients request node data.
 */
export class AttributeDataCache {
    #cache = new Map<NodeId, NodeSnapshot>();
    #inFlight = new Map<NodeId, PopulateContext>();
    #timing: PopulateTiming = { populated: 0, collecting: Millis(0) };

    /** Accumulated since this cache was created; take two readings to measure a phase. */
    get populateTiming(): Readonly<PopulateTiming> {
        return { ...this.#timing };
    }

    /**
     * Paths a rebuild dropped from a node's previous snapshot, emitted once per swap before the rebuild
     * resolves. Paths of an endpoint the new snapshot no longer has are not included.
     */
    readonly attributesRemoved = new Observable<[nodeId: NodeId, paths: string[]]>();

    /**
     * Whether the node's model carries something to snapshot.
     *
     * This is the one place that decides it. A peer restored from storage can carry its endpoints and
     * their persisted state while matter.js does not report it seeded, so a caller testing `isSeeded`
     * instead would answer reads with an empty node.
     */
    static hasStructure(node: ClientNode): boolean {
        const { isCommissioned, isReady } = node.lifecycle;
        // A device may have only its root endpoint, so the read structure shows in BasicInformation, not in the count.
        return isCommissioned && isReady && node.maybeStateOf(BasicInformationClient) !== undefined;
    }

    /** Populates the node's attributes, and does nothing for a node with no structure to read. */
    add(node: ClientNode): Promise<void> {
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
    update(node: ClientNode): Promise<void> {
        return this.#populateFromNode(node, true);
    }

    /**
     * Update a single attribute in the cache.
     * Use this for incremental updates when an attribute value changes. An `undefined` value removes the attribute,
     * which matter.js reports when the device's AttributeList no longer contains it.
     *
     * @returns whether a removal dropped an attribute from the cached node data
     */
    updateAttribute(nodeId: NodeId, data: AttributeChange): boolean {
        const { endpointId, clusterId, attributeId } = data.path;

        const clusterData = ClusterMap[clusterId];
        const convertedValue = convertMatterToWebSocketTagBased(
            data.value,
            clusterData?.attributes[attributeId],
            clusterData?.model,
        );
        const path = buildAttributePath(endpointId, clusterId, attributeId);
        const inFlight = this.#inFlight.get(nodeId);
        const attributes = this.#cache.get(nodeId)?.attributes;

        // Only patch an existing complete snapshot. Never create an entry from a single attribute:
        // has() must not report a node as cached from a partial write, or ensureNodePopulated /
        // getNodeDetails would serve a truncated snapshot and skip the real populate. With no snapshot
        // yet, the value is captured by the in-flight populate's pending replay, or by the next full
        // populate (which reads live state) when none is running.
        let removed = false;
        if (attributes !== undefined) {
            removed = convertedValue === undefined && path in attributes;
            setAttribute(attributes, path, convertedValue);
        }

        // A full populate builds into a detached snapshot and swaps it in at the end, so a write
        // landing mid-run would be lost. Record it for replay onto that snapshot.
        inFlight?.pending.push([path, convertedValue]);

        return removed;
    }

    /** Whether the cached snapshot of the node carries any attribute of the endpoint. */
    hasEndpoint(nodeId: NodeId, endpointId: EndpointNumber): boolean {
        const attributes = this.#cache.get(nodeId)?.attributes;
        if (attributes === undefined) {
            return false;
        }
        const prefix = `${endpointId}/`;
        return Object.keys(attributes).some(path => path.startsWith(prefix));
    }

    /**
     * Drop the attributes of one endpoint, for a node that no longer has it.
     *
     * A running populate may already have collected the endpoint, so it is restarted from live state.
     */
    deleteEndpoint(nodeId: NodeId, endpointId: EndpointNumber): void {
        const prefix = `${endpointId}/`;
        const snapshot = this.#cache.get(nodeId);
        if (snapshot !== undefined) {
            for (const path of Object.keys(snapshot.attributes)) {
                if (path.startsWith(prefix)) {
                    delete snapshot.attributes[path];
                }
            }
            delete snapshot.endpointParents[endpointId];
        }
        const inFlight = this.#inFlight.get(nodeId);
        if (inFlight !== undefined) {
            inFlight.rerun = true;
        }
    }

    /**
     * Await the populate currently running for a node, so a read serves the snapshot the node
     * reports now instead of the one it reported before the change that started the rebuild.
     */
    async settled(nodeId: NodeId): Promise<void> {
        await this.#inFlight.get(nodeId)?.promise;
    }

    /**
     * Get cached attributes for a node.
     * Returns undefined if no cache exists for the node.
     */
    get(nodeId: NodeId): AttributesData | undefined {
        return this.#cache.get(nodeId)?.attributes;
    }

    /**
     * Get the direct parent of each endpoint in the cached attributes of a node other than 0, keyed by
     * endpoint number; empty if no cache exists for the node.
     *
     * Attribute reports patch the cached attributes between populates, so an endpoint the node added
     * since the last populate has attributes but no recorded parent; its parent is read from the node.
     * The recorded parent comes first: the node drops an endpoint before its removal is announced, and
     * until then the endpoint keeps its attributes here.
     */
    endpointParents(nodeId: NodeId, node: ClientNode): EndpointParentsData {
        const parents: EndpointParentsData = {};
        const snapshot = this.#cache.get(nodeId);
        if (snapshot === undefined) {
            return parents;
        }
        const seen = new Set<number>([0]);
        for (const path of Object.keys(snapshot.attributes)) {
            const endpointId = Number(path.slice(0, path.indexOf("/")));
            if (seen.has(endpointId)) {
                continue;
            }
            seen.add(endpointId);
            const parentId =
                snapshot.endpointParents[endpointId] ??
                (node.endpoints.has(endpointId) ? node.endpoints.for(endpointId).owner?.maybeNumber : undefined);
            if (parentId !== undefined) {
                parents[endpointId] = parentId;
            }
        }
        return parents;
    }

    /**
     * Check if a node exists in the cache.
     */
    has(nodeId: NodeId): boolean {
        return this.#cache.has(nodeId);
    }

    /**
     * Populate the cache for a node from its current state.
     * Creates a completely fresh flat attribute object and endpoint parent map.
     *
     * Collecting attributes for a large node (~90 endpoints) is heavy synchronous work, so it is
     * chunked with event-loop yields. Concurrent calls for the same node collapse onto the running
     * populate instead of building competing snapshots.
     *
     * `rebuild` distinguishes a data-changed caller (state/structure change) that needs the running
     * pass redone from a caller that merely awaits completion (a read). Only the former schedules a
     * re-run; reads just await the in-flight promise, so frequent reads can never thrash the populate.
     */
    #populateFromNode(node: ClientNode, rebuild: boolean): Promise<void> {
        const nodeId = nodeIdOf(node);
        if (!AttributeDataCache.hasStructure(node)) {
            logger.debug(`Node ${formatNodeId(nodeId)} has no structure yet, skipping cache population`);
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

        const context: PopulateContext = {
            rerun: false,
            cancelled: false,
            yieldWait: Millis(0),
            pending: [],
            promise: Promise.resolve(),
        };
        context.promise = this.#runPopulate(nodeId, node, context);
        this.#inFlight.set(nodeId, context);
        return context.promise;
    }

    async #runPopulate(nodeId: NodeId, node: ClientNode, context: PopulateContext): Promise<void> {
        const startedAt = Time.nowUs;
        try {
            let attributeCount = 0;
            do {
                context.rerun = false;
                context.pending = [];

                const snapshot: NodeSnapshot = { attributes: {}, endpointParents: {} };
                await this.#collectSnapshot(node, snapshot, context);

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
                    setAttribute(snapshot.attributes, path, value);
                }
                const previous = this.#cache.get(nodeId)?.attributes;
                this.#cache.set(nodeId, snapshot);
                attributeCount = Object.keys(snapshot.attributes).length;
                if (previous !== undefined) {
                    const removed = removedPaths(previous, snapshot.attributes);
                    if (removed.length > 0) {
                        this.attributesRemoved.emit(nodeId, removed);
                    }
                }
            } while (context.rerun);

            const total = Timestamp.delta(startedAt, Time.nowUs);
            const collecting = Millis(total - context.yieldWait);
            this.#timing.populated++;
            this.#timing.collecting = Millis(this.#timing.collecting + collecting);
            logger.debug(
                `Populated attribute cache for node ${formatNodeId(nodeId)}: ${attributeCount} attributes in ${Duration.format(total)}`,
                `(collecting ${Duration.format(collecting)}, waiting at yields ${Duration.format(context.yieldWait)})`,
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
     * Collect attributes from all endpoints into a flat attribute object, and the parent of each endpoint,
     * yielding to the event loop between endpoints so a large node does not block other timers, I/O, and
     * WebSocket traffic.
     */
    async #collectSnapshot(node: ClientNode, snapshot: NodeSnapshot, context: PopulateContext): Promise<void> {
        const { attributes, endpointParents } = snapshot;
        for (const endpoint of node.endpoints) {
            const endpointId = endpoint.number;

            if (endpointId !== 0) {
                const parentId = endpoint.owner?.maybeNumber;
                if (parentId !== undefined) {
                    endpointParents[endpointId] = parentId;
                }
            }

            for (const behavior of endpoint.behaviors.active) {
                if (!ClusterBehavior.is(behavior)) {
                    continue;
                }
                const cluster = behavior.cluster;
                const clusterData = ClusterMap[cluster.id];
                let clusterState: Record<string, unknown>;
                try {
                    // One behavior that cannot be read must not cost the node its whole snapshot.
                    clusterState = endpoint.stateOf(behavior);
                } catch (error) {
                    MatterError.accept(error);
                    logger.debug(`Ignoring cluster ${cluster.id} because of`, Diagnostic.errorMessage(error));
                    continue;
                }

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

            const yieldedAt = Time.nowUs;
            await Time.sleep("AttributeDataCache populate yield", Millis(0));
            context.yieldWait = Millis(context.yieldWait + Timestamp.delta(yieldedAt, Time.nowUs));
            // Bail on deletion or a requested re-run; #runPopulate drops or restarts the partial.
            if (context.cancelled || context.rerun) {
                return;
            }
        }
    }
}

function setAttribute(attributes: AttributesData, path: string, value: unknown) {
    if (value === undefined) {
        delete attributes[path];
    } else {
        attributes[path] = value;
    }
}

function removedPaths(previous: AttributesData, current: AttributesData) {
    const endpoints = new Set(Object.keys(current).map(path => path.slice(0, path.indexOf("/"))));
    return Object.keys(previous).filter(path => !(path in current) && endpoints.has(path.slice(0, path.indexOf("/"))));
}
