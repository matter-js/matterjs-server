/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WebRtcCallbackData } from "@matter-server/ws-client";
import { Logger } from "@matter/main";
import type { EndpointNumber, FabricIndex, NodeId } from "@matter/main";
import { BasicInformation } from "@matter/main/clusters";
import { WebRtcTransportDefinitions } from "@matter/main/clusters/web-rtc-transport-definitions";
import { WebRtcTransportProvider } from "@matter/main/clusters/web-rtc-transport-provider";
import type { AttributeId, ClusterId, EventId } from "@matter/main/types";
import type { WebRtcTransportRequestorServer } from "@matter/node/behaviors/web-rtc-transport-requestor";
import { offerWithClockRetry } from "./iceServerClock.js";
import { attachWebRtcCallbackBridge, type WebRtcCallbackBridge } from "./WebRtcCallbackBridge.js";
import { WebRtcProviderSessionWatch, type WebRtcProviderSessionWatchIo } from "./WebRtcProviderSessionWatch.js";
import {
    establishWebRtcProviderSession,
    sameWebRtcSession,
    trackedSessionOf,
    type WebRtcProviderSessionIo,
    type WebRtcProviderSessionKey,
    type WebRtcSessionKey,
} from "./webRtcSessionStreams.js";

const logger = Logger.get("WebRtcProviderSessions");

type WebRtcSession = WebRtcTransportDefinitions.WebRtcSession;

/** What this unit needs from the camera nodes: node state reads and invokes. */
export interface WebRtcProviderNodes {
    /** The `PeerNodeID` a camera stores for this server's sessions (§11.4.5.5). */
    localNodeId(): NodeId;
    providerEndpoints(nodeId: NodeId): EndpointNumber[];
    /** The provider's `CurrentSessions` from node state (fabric-filtered); undefined without the cluster. */
    currentSessions(
        nodeId: NodeId,
        endpointId: EndpointNumber,
    ): readonly { id: number; peerNodeId: NodeId }[] | undefined;
    /** The provider's ClusterRevision; throws a `ServerError` when the endpoint has no WebRTC provider. */
    providerRevision(nodeId: NodeId, endpointId: EndpointNumber): number | undefined;
    invoke(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        command: "provideOffer" | "solicitOffer" | "endSession",
        fields: Record<string, unknown>,
    ): Promise<unknown>;
    /** Pushes this server's time to the node. */
    syncTime(nodeId: NodeId): Promise<void>;
    formatNode(nodeId: NodeId): string;
}

/** The parts of matter.js's `WebRtcTransportRequestorServer` used inside {@link WebRtcRequestor.act}. */
export interface WebRtcRequestorSessions {
    readonly state: { readonly currentSessions: readonly WebRtcSession[] };
    upsertSession(session: WebRtcSession): void;
    removeSession(key: WebRtcSessionKey): void;
}

/** This server's WebRTC Transport Requestor endpoint. */
export interface WebRtcRequestor {
    /** The `OriginatingEndpointID` of every offer. */
    endpointId(): EndpointNumber;
    /** The requestor's `CurrentSessions`, read without a transaction. */
    sessions(): readonly Readonly<WebRtcProviderSessionKey>[];
    act(work: (requestor: WebRtcRequestorSessions) => void): Promise<void>;
}

export interface WebRtcProviderSessionsOptions {
    nodes: WebRtcProviderNodes;
    requestor: WebRtcRequestor;
    /** This server's fabric: the requestor holds this server's sessions under it. */
    fabricIndex: FabricIndex;
    /** @see WebRtcProviderSessionWatchIo.reported */
    reported: WebRtcProviderSessionWatchIo["reported"];
}

export interface WebRtcProviderSessionRequest {
    nodeId: NodeId;
    endpointId: EndpointNumber;
    commandName: "ProvideOffer" | "SolicitOffer";
    /** In matter.js's field-name convention; any `originatingEndpointId` is overwritten. */
    fields: Record<string, unknown>;
    /** @see WebRtcProviderSessionArgs.sessionEstablishing */
    sessionEstablishing?: (webRtcSessionId: number) => void;
}

/**
 * This server's side of the WebRTC sessions it holds with cameras: it establishes them, keeps the local
 * requestor's records and the offers the answers are checked against, and watches the cameras'
 * `CurrentSessions`. `ControllerCommandHandler` constructs it and feeds it node changes.
 */
export class WebRtcProviderSessions {
    readonly #nodes: WebRtcProviderNodes;
    readonly #requestor: WebRtcRequestor;
    readonly #fabricIndex: FabricIndex;
    readonly #watch: WebRtcProviderSessionWatch;
    #callbacks?: WebRtcCallbackBridge;

    constructor({ nodes, requestor, fabricIndex, reported }: WebRtcProviderSessionsOptions) {
        this.#nodes = nodes;
        this.#requestor = requestor;
        this.#fabricIndex = fabricIndex;
        this.#watch = new WebRtcProviderSessionWatch({
            localNodeId: () => nodes.localNodeId(),
            providerEndpoints: nodeId => nodes.providerEndpoints(nodeId),
            currentSessions: (nodeId, endpointId) => nodes.currentSessions(nodeId, endpointId),
            requestorSessionIds: (nodeId, endpointId) =>
                new Set(
                    this.#sessionsOf(nodeId)
                        .filter(session => session.peerEndpointId === endpointId)
                        .map(session => session.id),
                ),
            endSession: async (nodeId, endpointId, webRtcSessionId) => {
                await nodes.invoke(nodeId, endpointId, "endSession", {
                    webRtcSessionId,
                    // No reason states "this server lost its record"; UnknownReason claims nothing that is false.
                    reason: WebRtcTransportDefinitions.WebRtcEndReason.UnknownReason,
                });
            },
            reported,
        });
    }

    /**
     * Forwards the requestor's signalling events to `emit`. Until this is called, offers are not recorded
     * and answers go out as the camera sent them.
     */
    attachCallbacks(events: WebRtcTransportRequestorServer.Events, emit: (data: WebRtcCallbackData) => void): void {
        this.#callbacks = attachWebRtcCallbackBridge(events, emit);
    }

    attributeChanged(
        nodeId: NodeId,
        path: { endpointId: EndpointNumber; clusterId: ClusterId; attributeId: AttributeId },
    ): void {
        if (
            path.clusterId === WebRtcTransportProvider.id &&
            path.attributeId === WebRtcTransportProvider.attributes.currentSessions.id
        ) {
            this.#watch.currentSessionsChanged(nodeId, path.endpointId);
        }
    }

    eventTriggered(nodeId: NodeId, path: { clusterId: ClusterId; eventId: EventId }): void {
        if (path.clusterId === BasicInformation.id && path.eventId === BasicInformation.events.startUp.id) {
            this.#watch.startedUp(nodeId);
        }
    }

    /** A report batch of the node was applied (`subscriptionAlive`); every change and event of it came before. */
    reportCompleted(nodeId: NodeId): void {
        this.#watch.reportCompleted(nodeId);
    }

    endpointAdded(nodeId: NodeId): void {
        this.#watch.endpointAdded(nodeId);
    }

    /** Forgets the node and drops the requestor's sessions with it. */
    async nodeRemoved(nodeId: NodeId): Promise<void> {
        this.#watch.nodeRemoved(nodeId);
        await this.#requestor.act(requestor => {
            // Plain keys first: each removal replaces the state array, which invalidates its entries.
            const removed = requestor.state.currentSessions
                .filter(session => session.peerNodeId === nodeId && session.fabricIndex === this.#fabricIndex)
                .map(({ id, fabricIndex, peerNodeId, peerEndpointId }) => ({
                    id,
                    fabricIndex,
                    peerNodeId,
                    peerEndpointId,
                }));
            for (const key of removed) {
                requestor.removeSession(key);
                this.#callbacks?.sessionEnded(key);
            }
        });
    }

    /**
     * Sends a `ProvideOffer` or `SolicitOffer` and stores the session with the local requestor. While it
     * runs, the leftover sweep skips the endpoint. An offer the camera may have refused for its missing
     * clock is sent again once after a time push ({@link offerWithClockRetry}).
     */
    async establish(
        request: WebRtcProviderSessionRequest,
    ): Promise<{ webRtcSessionId: number } & Record<string, unknown>> {
        const { nodeId, endpointId, commandName, fields, sessionEstablishing } = request;
        const clusterRevision = this.#nodes.providerRevision(nodeId, endpointId);
        const key = (id: number): WebRtcProviderSessionKey => ({
            id,
            fabricIndex: this.#fabricIndex,
            peerNodeId: nodeId,
            peerEndpointId: endpointId,
        });
        const send = (command: "provideOffer" | "solicitOffer" | "endSession", invokeFields: Record<string, unknown>) =>
            this.#nodes.invoke(nodeId, endpointId, command, invokeFields);
        const io: WebRtcProviderSessionIo = {
            invoke: (command, invokeFields) =>
                command === "endSession"
                    ? send(command, invokeFields)
                    : offerWithClockRetry({
                          command,
                          fields: invokeFields,
                          invoke: () => send(command, invokeFields),
                          syncTime: () => this.#nodes.syncTime(nodeId),
                          node: this.#nodes.formatNode(nodeId),
                      }),
            offerSent: (webRtcSessionId, sdp) => this.#callbacks?.offerSent(key(webRtcSessionId), sdp) ?? (() => {}),
            tracks: webRtcSessionId =>
                trackedSessionOf(this.#requestor.sessions(), key(webRtcSessionId), endpointId) !== undefined,
            upsertSession: (session, options) =>
                this.#requestor.act(requestor => {
                    if (
                        options?.onlyIfAbsent &&
                        requestor.state.currentSessions.some(tracked => sameWebRtcSession(tracked, session))
                    ) {
                        return;
                    }
                    requestor.upsertSession(session);
                }),
        };

        return this.#watch.establishing(nodeId, endpointId, () =>
            establishWebRtcProviderSession(io, {
                commandName,
                fields,
                sessionEstablishing,
                nodeId,
                endpointId,
                originatingEndpointId: this.#requestor.endpointId(),
                fabricIndex: this.#fabricIndex,
                clusterRevision,
                formatNode: id => this.#nodes.formatNode(id),
            }),
        );
    }

    /**
     * Drops a session this server ended from the requestor and the recorded offers. Peer-initiated ends are
     * removed by the requestor itself.
     */
    async removeTracked(webRtcSessionId: number, nodeId: NodeId, endpointId: EndpointNumber): Promise<void> {
        const key: WebRtcProviderSessionKey = {
            id: webRtcSessionId,
            fabricIndex: this.#fabricIndex,
            peerNodeId: nodeId,
            peerEndpointId: endpointId,
        };
        await this.#requestor.act(requestor => {
            const tracked = trackedSessionOf(requestor.state.currentSessions, key, endpointId);
            if (tracked === undefined) {
                logger.debug(
                    `WebRTC session ${webRtcSessionId} is not tracked for node ${this.#nodes.formatNode(nodeId)} endpoint ${endpointId}; local tracking left unchanged`,
                );
                return;
            }
            requestor.removeSession(tracked);
        });
        this.#callbacks?.sessionEnded(key);
    }

    /**
     * A session this server gave up and could not end: its signalling is no longer routed, and the next
     * batch end of the node sweeps the endpoint, which ends the session if the camera still lists it.
     */
    async abandon(webRtcSessionId: number, nodeId: NodeId, endpointId: EndpointNumber): Promise<void> {
        await this.removeTracked(webRtcSessionId, nodeId, endpointId);
        this.#watch.sweepAgain(nodeId, endpointId);
    }

    #sessionsOf(nodeId: NodeId): Readonly<WebRtcProviderSessionKey>[] {
        return this.#requestor
            .sessions()
            .filter(session => session.peerNodeId === nodeId && session.fabricIndex === this.#fabricIndex);
    }
}
