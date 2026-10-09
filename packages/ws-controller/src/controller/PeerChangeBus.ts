/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ClientNode,
    ClusterBehavior,
    Endpoint,
    EndpointLifecycle,
    Logger,
    NetworkClient,
    NodeConnectionState,
    NodeId,
    Observable,
    ObserverGroup,
    ServerNode,
    Timestamp,
} from "@matter/main";
import { AttributeId, ClusterId, EndpointNumber, EventId, EventNumber } from "@matter/main/types";
import { ChangeNotificationService } from "@matter/node";
import { nodeIdOf } from "../util/nodeIdOf.js";

const logger = Logger.get("PeerChangeBus");

export type AttributeChange = {
    path: { endpointId: EndpointNumber; clusterId: ClusterId; attributeId: AttributeId };
    value: unknown;
};

export type EventOccurrence = {
    eventNumber: EventNumber;
    priority: number;
    epochTimestamp?: number | bigint;
    systemTimestamp?: number | bigint;
    data: unknown;
};

export type EventChange = {
    path: { endpointId: EndpointNumber; clusterId: ClusterId; eventId: EventId };
    events: EventOccurrence[];
};

/** The timestamp fields to forward, empty for the delta variants a consumer cannot resolve. */
export function absoluteTimestampOf(
    timestamp: Timestamp,
    kind: ChangeNotificationService.TimestampKind,
): { epochTimestamp?: Timestamp; systemTimestamp?: Timestamp } {
    switch (kind) {
        case "epoch":
            return { epochTimestamp: timestamp };
        case "system":
            return { systemTimestamp: timestamp };
        default:
            logger.debug(`Dropping ${kind} event timestamp: a delta cannot be reported as an absolute time`);
            return {};
    }
}

/**
 * Fans the controller's single node-wide {@link ChangeNotificationService} stream out into per-peer
 * attribute/event/endpoint-removal notifications.
 */
export class PeerChangeBus {
    #observers = new ObserverGroup();
    /** Per-peer observers, closed when the peer goes away so its node does not stay reachable. */
    #peerObservers = new Map<ClientNode, ObserverGroup>();
    /** Endpoint to owning peer, so the owner chain is walked once per endpoint rather than per change. */
    #peerOfEndpoint = new WeakMap<Endpoint, ClientNode>();
    /** Endpoints already resolved to the controller itself, so its own changes don't re-walk either. */
    #notAPeer = new WeakSet<Endpoint>();
    /**
     * Peers whose first subscription has been established. Latched, never cleared: the seeding read
     * reports every attribute of every endpoint, and forwarding that would flood consumers with an
     * update per attribute on every startup.
     */
    #reporting = new WeakSet<ClientNode>();
    /**
     * Peers being destroyed. Their endpoint tree is torn down depth-first, emitting a deletion per
     * endpoint, which must not reach consumers as individual endpoint removals.
     */
    #tearingDown = new WeakSet<ClientNode>();

    readonly events = {
        attributeChanged: new Observable<[nodeId: NodeId, change: AttributeChange]>(),
        eventTriggered: new Observable<[nodeId: NodeId, change: EventChange]>(),
        endpointRemoved: new Observable<[nodeId: NodeId, endpointId: EndpointNumber]>(),
    };

    constructor(controller: ServerNode) {
        this.#observers.on(controller.env.get(ChangeNotificationService).change, change => {
            // Shared Observable: an uncaught throw here aborts the emit, starving every later observer.
            try {
                this.#dispatch(controller, change);
            } catch (error) {
                logger.warn("Failed to dispatch a peer change:", error);
            }
        });

        for (const peer of controller.peers) {
            this.#watchSafely(peer);
        }
        // Shared Observable with matter.js's own peer observation: a throw here aborts the emit, so a
        // peer we cannot watch must not stop the library from tracking it.
        this.#observers.on(controller.peers.added, node => this.#watchSafely(node));
        this.#observers.on(controller.peers.deleted, node => this.#unwatch(node));
    }

    #watchSafely(peer: ClientNode) {
        try {
            this.#watch(peer);
        } catch (error) {
            logger.warn(`Failed to watch peer ${peer.id}:`, error);
        }
    }

    #watch(peer: ClientNode) {
        if (peer.lifecycle.connectionState === NodeConnectionState.Connected) {
            this.#reporting.add(peer);
        }
        const observers = new ObserverGroup();
        this.#peerObservers.set(peer, observers);
        observers.on(peer.eventsOf(NetworkClient).subscriptionStatusChanged, isActive => {
            if (isActive) {
                this.#reporting.add(peer);
            }
        });
        // `changed` bubbles, so it also reports a child endpoint being destroyed. Only the peer's own
        // root going down is a teardown.
        observers.on(peer.lifecycle.changed, (type, endpoint) => {
            if (type === EndpointLifecycle.Change.Destroying && endpoint === peer) {
                this.#tearingDown.add(peer);
            }
        });
    }

    #unwatch(peer: ClientNode) {
        this.#peerObservers.get(peer)?.close();
        this.#peerObservers.delete(peer);
    }

    close() {
        for (const observers of this.#peerObservers.values()) {
            observers.close();
        }
        this.#peerObservers.clear();
        this.#observers.close();
    }

    #dispatch(controller: ServerNode, change: ChangeNotificationService.Change) {
        const peer = this.#peerOf(controller, change.endpoint);
        if (peer === undefined) {
            return;
        }

        let nodeId;
        try {
            nodeId = nodeIdOf(peer);
        } catch {
            return;
        }

        switch (change.kind) {
            case "update":
                if (this.#reporting.has(peer)) {
                    this.#emitAttributeChanges(nodeId, change);
                }
                break;
            case "event":
                if (this.#reporting.has(peer)) {
                    this.#emitEvent(nodeId, change);
                }
                break;
            case "delete":
                // The peer's own root endpoint being destroyed is node removal, reported elsewhere.
                if (change.endpoint !== peer && !this.#tearingDown.has(peer)) {
                    this.events.endpointRemoved.emit(nodeId, EndpointNumber(change.endpoint.number));
                }
                break;
        }
    }

    /**
     * Resolve the peer owning `endpoint` by walking the owner chain; a peer node is its own root
     * endpoint. Returns undefined for the controller's own endpoints.
     */
    #peerOf(controller: ServerNode, endpoint: Endpoint): ClientNode | undefined {
        const cached = this.#peerOfEndpoint.get(endpoint);
        if (cached !== undefined) {
            return cached;
        }
        if (this.#notAPeer.has(endpoint)) {
            return undefined;
        }

        let root: Endpoint = endpoint;
        while (root.owner !== undefined && root.owner !== controller) {
            root = root.owner;
        }
        if (!(root instanceof ClientNode)) {
            // An endpoint not yet linked into a tree may still become a peer's, so only remember the
            // answer once the walk reached a real root.
            if (root === controller || root.owner === controller) {
                this.#notAPeer.add(endpoint);
            }
            return undefined;
        }

        this.#peerOfEndpoint.set(endpoint, root);
        return root;
    }

    #emitAttributeChanges(nodeId: NodeId, change: ChangeNotificationService.PropertyUpdate) {
        const { endpoint, behavior, properties } = change;
        if (!ClusterBehavior.is(behavior) || !endpoint.behaviors.supported[behavior.id]) {
            return;
        }

        const endpointId = EndpointNumber(endpoint.number);
        const clusterId = behavior.cluster.id;
        const attributes = behavior.cluster.attributes ?? {};
        const state = endpoint.stateOf(behavior) as Record<string, unknown>;

        for (const property of properties ?? Object.keys(attributes)) {
            const attributeId = this.#attributeIdOf(attributes, property);
            if (attributeId === undefined) {
                continue;
            }
            this.events.attributeChanged.emit(nodeId, {
                path: { endpointId, clusterId, attributeId },
                value: state[property],
            });
        }
    }

    /** Property names carry the id in the cluster schema; unknown attributes surface as numeric keys. */
    #attributeIdOf(attributes: Record<string, { id: AttributeId } | undefined>, property: string) {
        const numeric = parseInt(property, 10);
        if (!isNaN(numeric)) {
            return AttributeId(numeric);
        }
        return attributes[property]?.id;
    }

    #emitEvent(nodeId: NodeId, change: ChangeNotificationService.EventOccurrence) {
        const { endpoint, behavior, event, number, timestamp, timestampKind, priority, payload } = change;
        if (!ClusterBehavior.is(behavior)) {
            return;
        }

        this.events.eventTriggered.emit(nodeId, {
            path: {
                endpointId: EndpointNumber(endpoint.number),
                clusterId: behavior.cluster.id,
                eventId: EventId(event.id),
            },
            events: [
                {
                    eventNumber: number,
                    priority,
                    // Matter Core 10.7 has four timestamp variants and neither the clock nor
                    // absolute-vs-delta is recoverable from the value. A delta is left out rather than
                    // published as an absolute time, which would read as a bogus uptime or a 1970 date;
                    // the WebSocket layer then times the event at reception.
                    ...absoluteTimestampOf(timestamp, timestampKind),
                    data: payload,
                },
            ],
        });
    }
}
