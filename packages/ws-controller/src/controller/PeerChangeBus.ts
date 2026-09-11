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

/**
 * Fans the controller's single node-wide {@link ChangeNotificationService} stream out into per-peer
 * attribute/event/endpoint-removal notifications.
 */
export class PeerChangeBus {
    #observers = new ObserverGroup();
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
            this.#watch(peer);
        }
        this.#observers.on(controller.peers.added, node => this.#watch(node));
    }

    /**
     * Latch data reporting on the same signal the legacy bus used, rather than sampling connection
     * state when a change happens to arrive: a read issued while the peer is reconnecting still has to
     * reach consumers, and sampling would drop it.
     */
    #watch(peer: ClientNode) {
        if (peer.lifecycle.connectionState === NodeConnectionState.Connected) {
            this.#reporting.add(peer);
        }
        this.#observers.on(peer.eventsOf(NetworkClient).subscriptionStatusChanged, isActive => {
            if (isActive) {
                this.#reporting.add(peer);
            }
        });
        this.#observers.on(peer.lifecycle.changed, type => {
            if (type === EndpointLifecycle.Change.Destroying) {
                this.#tearingDown.add(peer);
            }
        });
    }

    close() {
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
                    // The wire format distinguishes the two clocks, so report the one the device used
                    // rather than labelling everything as epoch.
                    ...(timestampKind === "system" || timestampKind === "system-delta"
                        ? { systemTimestamp: timestamp }
                        : { epochTimestamp: timestamp }),
                    data: payload,
                },
            ],
        });
    }
}
