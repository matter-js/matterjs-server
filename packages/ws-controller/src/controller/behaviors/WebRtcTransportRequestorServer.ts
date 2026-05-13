/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Observable } from "@matter/general";
import { Node } from "@matter/main";
import type { ServerNode } from "@matter/main";
import { AccessControlServer } from "@matter/node/behaviors/access-control";
import { WebRtcTransportRequestorBehavior } from "@matter/node/behaviors/web-rtc-transport-requestor";
import { assertRemoteActor, FabricAuthority, NodeSession } from "@matter/protocol";
import { Status, StatusResponseError } from "@matter/types";
import { AccessControl } from "@matter/types/clusters/access-control";
import { WebRtcTransportDefinitions } from "@matter/types/clusters/web-rtc-transport-definitions";
import { WebRtcTransportRequestor } from "@matter/types/clusters/web-rtc-transport-requestor";

type WebRtcSession = WebRtcTransportDefinitions.WebRtcSession;

export class WebRtcTransportRequestorServer extends WebRtcTransportRequestorBehavior {
    declare state: WebRtcTransportRequestorServer.State;
    declare events: WebRtcTransportRequestorServer.Events;

    upsertSession(session: WebRtcSession): void {
        const enriched: WebRtcSession = {
            ...session,
            videoStreamId: session.videoStreams?.[0] ?? null,
            audioStreamId: session.audioStreams?.[0] ?? null,
        };
        const sessions = this.state.currentSessions;
        const idx = sessions.findIndex(s => s.id === session.id);
        if (idx === -1) {
            this.state.currentSessions = [...sessions, enriched];
        } else {
            this.state.currentSessions = sessions.map((s, i) => (i === idx ? enriched : s));
        }
    }

    removeSession(id: number): void {
        this.state.currentSessions = this.state.currentSessions.filter(s => s.id !== id);
    }

    override async offer(request: WebRtcTransportRequestor.OfferRequest): Promise<void> {
        const session = this.#findSessionStrict(request.webRtcSessionId);
        this.events.offer.emit(session, request);
    }

    override async answer(request: WebRtcTransportRequestor.AnswerRequest): Promise<void> {
        const session = this.#findSessionStrict(request.webRtcSessionId);
        this.events.answer.emit(session, request.sdp);
    }

    override async iceCandidates(request: WebRtcTransportRequestor.IceCandidatesRequest): Promise<void> {
        if (request.iceCandidates.length === 0) {
            throw new StatusResponseError("ICE candidates list must not be empty", Status.InvalidCommand);
        }
        const session = this.#findSessionStrict(request.webRtcSessionId);
        this.events.iceCandidates.emit(session, request.iceCandidates);
    }

    override async end(request: WebRtcTransportRequestor.EndRequest): Promise<void> {
        const session = this.#findSessionStrict(request.webRtcSessionId);
        this.removeSession(request.webRtcSessionId);
        this.events.end.emit(session, request.reason);
    }

    override async initialize() {
        const node = Node.forEndpoint(this.endpoint) as ServerNode;
        this.reactTo(node.lifecycle.online, this.#nodeOnline);
        if (node.lifecycle.isOnline) {
            await this.#nodeOnline();
        }
    }

    async #nodeOnline() {
        const fabricAuthority = this.env.get(FabricAuthority);
        const ownFabric = fabricAuthority.fabrics[0];
        if (!ownFabric) {
            // void: fabricAdded is a synchronous observable; awaiting #nodeOnline here deadlocks setStateOf.
            fabricAuthority.fabricAdded.once(() => void this.#nodeOnline());
            return;
        }

        const node = Node.forEndpoint(this.endpoint) as ServerNode;
        await node.act(agent => agent.load(AccessControlServer));
        if (node.behaviors.has(AccessControlServer)) {
            if (
                !node
                    .stateOf(AccessControlServer)
                    .acl.some(
                        ({ fabricIndex, privilege, authMode, subjects, targets }) =>
                            fabricIndex === ownFabric.fabricIndex &&
                            privilege === AccessControl.AccessControlEntryPrivilege.Operate &&
                            authMode === AccessControl.AccessControlEntryAuthMode.Case &&
                            subjects?.length === 0 &&
                            targets?.length === 1 &&
                            targets[0].endpoint === this.endpoint.number &&
                            targets[0].cluster === WebRtcTransportRequestor.id,
                    )
            ) {
                const acl = [
                    ...node.stateOf(AccessControlServer).acl,
                    {
                        fabricIndex: ownFabric.fabricIndex,
                        privilege: AccessControl.AccessControlEntryPrivilege.Operate,
                        authMode: AccessControl.AccessControlEntryAuthMode.Case,
                        subjects: [],
                        targets: [{ endpoint: this.endpoint.number, cluster: WebRtcTransportRequestor.id }],
                    },
                ];
                await node.setStateOf(AccessControlServer, { acl });
            }
        }
    }

    #findSessionStrict(id: number): WebRtcSession {
        assertRemoteActor(this.context);
        NodeSession.assert(this.context.session);
        const peer = this.context.session.peerAddress;
        const session = this.state.currentSessions.find(s => s.id === id);
        if (session === undefined || session.fabricIndex !== peer.fabricIndex || session.peerNodeId !== peer.nodeId) {
            throw new StatusResponseError(`WebRTC session ${id} not found`, Status.NotFound);
        }
        return session;
    }
}

export namespace WebRtcTransportRequestorServer {
    export class State extends WebRtcTransportRequestorBehavior.State {
        override currentSessions: WebRtcSession[] = new Array<WebRtcSession>();
    }
    export class Events extends WebRtcTransportRequestorBehavior.Events {
        offer = Observable<[session: WebRtcSession, args: WebRtcTransportRequestor.OfferRequest]>();
        answer = Observable<[session: WebRtcSession, sdp: string]>();
        iceCandidates = Observable<[session: WebRtcSession, candidates: WebRtcTransportDefinitions.IceCandidate[]]>();
        end = Observable<[session: WebRtcSession, reason: WebRtcTransportDefinitions.WebRtcEndReason]>();
    }
}
