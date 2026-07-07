/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WebRtcCallbackData } from "@matter-server/ws-client";
import {
    Crypto,
    Entropy,
    Environment,
    MockCrypto,
    MockStorageService,
    Network,
    NetworkSimulator,
} from "@matter/general";
import { EndpointNumber, FabricIndex, NodeId } from "@matter/main";
import { ServerNode } from "@matter/node";
import { WebRtcTransportRequestorServer } from "@matter/node/behaviors/web-rtc-transport-requestor";
import { CameraControllerDevice } from "@matter/node/devices/camera-controller";
import { StreamUsage } from "@matter/types";
import { WebRtcTransportDefinitions } from "@matter/types/clusters/web-rtc-transport-definitions";
import { attachWebRtcCallbackBridge } from "../src/controller/WebRtcCallbackBridge.js";

type WebRtcSession = WebRtcTransportDefinitions.WebRtcSession;

async function createTestNode() {
    MockTime.init();

    const env = new Environment("test");
    const crypto = MockCrypto();
    env.set(Entropy, crypto);
    env.set(Crypto, crypto);
    new MockStorageService(env);
    const simulator = new NetworkSimulator();
    env.set(Network, simulator.addHost(0x80));

    const node = new ServerNode(ServerNode.RootEndpoint, { environment: env });
    await node.add({
        id: "camera-controller",
        type: CameraControllerDevice.with(WebRtcTransportRequestorServer),
    });
    await node.start();
    if (!node.lifecycle.isOnline) {
        await node.lifecycle.online;
    }
    return node;
}

function makeSession(overrides: Partial<WebRtcSession> = {}): WebRtcSession {
    return {
        id: 7,
        peerNodeId: NodeId(42n),
        peerEndpointId: EndpointNumber(1),
        streamUsage: StreamUsage.LiveView,
        metadataEnabled: false,
        videoStreams: [10],
        audioStreams: [20],
        fabricIndex: FabricIndex(3),
        ...overrides,
    };
}

describe("WebRtcCallbackBridge", () => {
    let node: ServerNode;
    let cameraEndpoint: ReturnType<(typeof node)["parts"]["get"]>;
    let recorded: WebRtcCallbackData[];

    beforeEach(async () => {
        node = await createTestNode();
        cameraEndpoint = node.parts.get("camera-controller");
        recorded = [];
        await cameraEndpoint!.act(agent => {
            attachWebRtcCallbackBridge(agent.get(WebRtcTransportRequestorServer).events, data => {
                recorded.push(data);
            });
        });
    });

    afterEach(async () => {
        await MockTime.resolve(node.close(), { macrotasks: true });
    });

    it("offer emit translates to WebRtcCallbackData with offer payload", async () => {
        const session = makeSession();
        await cameraEndpoint!.act(agent => {
            const server = agent.get(WebRtcTransportRequestorServer);
            server.upsertSession(session);
            server.events.offer.emit(session, {
                webRtcSessionId: session.id,
                sdp: "v=0\nm=video",
                iceServers: [{ urLs: ["stun:stun.example:3478"] }],
                iceTransportPolicy: "all",
            });
        });

        expect(recorded).to.have.lengthOf(1);
        expect(recorded[0]).to.deep.equal({
            event_type: "offer",
            webrtc_session_id: session.id,
            node_id: session.peerNodeId,
            endpoint_id: session.peerEndpointId,
            fabric_index: session.fabricIndex,
            data: {
                sdp: "v=0\nm=video",
                ice_servers: [{ urLs: ["stun:stun.example:3478"] }],
                ice_transport_policy: "all",
            },
        });
    });

    it("answer emit translates to WebRtcCallbackData with answer payload", async () => {
        const session = makeSession();
        await cameraEndpoint!.act(agent => {
            const server = agent.get(WebRtcTransportRequestorServer);
            server.upsertSession(session);
            server.events.answer.emit(session, "answer-sdp");
        });

        expect(recorded).to.have.lengthOf(1);
        expect(recorded[0]).to.deep.equal({
            event_type: "answer",
            webrtc_session_id: session.id,
            node_id: session.peerNodeId,
            endpoint_id: session.peerEndpointId,
            fabric_index: session.fabricIndex,
            data: { sdp: "answer-sdp" },
        });
    });

    it("iceCandidates emit translates to WebRtcCallbackData and maps sdpmLineIndex -> sdpMLineIndex", async () => {
        const session = makeSession();
        const candidates: WebRtcTransportDefinitions.IceCandidate[] = [
            { candidate: "candidate:1 1 udp 2113937151 1.2.3.4 54321 typ host", sdpMid: "0", sdpmLineIndex: 0 },
            { candidate: "candidate:2 1 udp 2113937151 5.6.7.8 12345 typ host", sdpMid: null, sdpmLineIndex: null },
        ];
        await cameraEndpoint!.act(agent => {
            const server = agent.get(WebRtcTransportRequestorServer);
            server.upsertSession(session);
            server.events.iceCandidates.emit(session, candidates);
        });

        expect(recorded).to.have.lengthOf(1);
        expect(recorded[0]).to.deep.equal({
            event_type: "ice_candidates",
            webrtc_session_id: session.id,
            node_id: session.peerNodeId,
            endpoint_id: session.peerEndpointId,
            fabric_index: session.fabricIndex,
            data: {
                ice_candidates: [
                    { candidate: candidates[0].candidate, sdpMid: "0", sdpMLineIndex: 0 },
                    { candidate: candidates[1].candidate, sdpMid: null, sdpMLineIndex: null },
                ],
            },
        });
    });

    it("end emit translates to WebRtcCallbackData with reason", async () => {
        const session = makeSession();
        await cameraEndpoint!.act(agent => {
            const server = agent.get(WebRtcTransportRequestorServer);
            server.upsertSession(session);
            server.events.end.emit(session, WebRtcTransportDefinitions.WebRtcEndReason.UserHangup);
        });

        expect(recorded).to.have.lengthOf(1);
        expect(recorded[0]).to.deep.equal({
            event_type: "end",
            webrtc_session_id: session.id,
            node_id: session.peerNodeId,
            endpoint_id: session.peerEndpointId,
            fabric_index: session.fabricIndex,
            data: { reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup },
        });
    });

    it("session identifying fields are taken from the session, not the request payload", async () => {
        const session = makeSession({
            peerNodeId: NodeId(123n),
            peerEndpointId: EndpointNumber(7),
            fabricIndex: FabricIndex(2),
        });
        await cameraEndpoint!.act(agent => {
            const server = agent.get(WebRtcTransportRequestorServer);
            server.upsertSession(session);
            server.events.answer.emit(session, "sdp");
        });

        expect(recorded[0].node_id).to.equal(NodeId(123n));
        expect(recorded[0].endpoint_id).to.equal(EndpointNumber(7));
        expect(recorded[0].fabric_index).to.equal(FabricIndex(2));
    });
});
