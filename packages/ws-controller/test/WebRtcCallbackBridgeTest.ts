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
import { toProviderCommandFields } from "../src/camera/webRtcProviderArguments.js";
import { attachWebRtcCallbackBridge, type WebRtcCallbackBridge } from "../src/controller/WebRtcCallbackBridge.js";

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
    let bridge: WebRtcCallbackBridge;

    beforeEach(async () => {
        node = await createTestNode();
        cameraEndpoint = node.parts.get("camera-controller");
        recorded = [];
        await cameraEndpoint!.act(agent => {
            bridge = attachWebRtcCallbackBridge(agent.get(WebRtcTransportRequestorServer).events, data => {
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
                iceServers: [{ urls: ["stun:stun.example:3478"], username: "u", credential: "p", caid: 7 }],
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
                ice_servers: [{ urls: ["stun:stun.example:3478"], username: "u", credential: "p", caid: 7 }],
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

    describe("answer directions", () => {
        const OFFER = ["v=0", "m=video 9 UDP/TLS/RTP/SAVPF 96", "a=recvonly", ""].join("\r\n");
        const CAMERA_ANSWER = ["v=0", "m=video 9 UDP/TLS/RTP/SAVPF 96", "a=sendrecv", ""].join("\r\n");
        const NARROWED = ["v=0", "m=video 9 UDP/TLS/RTP/SAVPF 96", "a=sendonly", ""].join("\r\n");

        async function answer(session: WebRtcSession): Promise<unknown> {
            await cameraEndpoint!.act(agent => {
                const server = agent.get(WebRtcTransportRequestorServer);
                server.upsertSession(session);
                server.events.answer.emit(session, CAMERA_ANSWER);
            });
            const event = recorded.at(-1);
            return event?.event_type === "answer" ? event.data?.sdp : undefined;
        }

        it("narrows the answer to the offer sent for the session", async () => {
            const session = makeSession();
            bridge.offerSent(session, OFFER);

            expect(await answer(session)).to.equal(NARROWED);
        });

        it("narrows only the first answer to an offer", async () => {
            const session = makeSession();
            bridge.offerSent(session, OFFER);
            await answer(session);

            expect(await answer(session)).to.equal(CAMERA_ANSWER);
        });

        it("forwards the answer unchanged for an offer of another fabric", async () => {
            bridge.offerSent(makeSession({ fabricIndex: FabricIndex(4) }), OFFER);

            expect(await answer(makeSession())).to.equal(CAMERA_ANSWER);
        });

        it("forwards the answer unchanged for an offer to another camera", async () => {
            bridge.offerSent(makeSession({ peerNodeId: NodeId(43n) }), OFFER);

            expect(await answer(makeSession())).to.equal(CAMERA_ANSWER);
        });

        it("forwards the answer unchanged for an offer to another endpoint of the same camera", async () => {
            bridge.offerSent(makeSession({ peerEndpointId: EndpointNumber(2) }), OFFER);

            expect(await answer(makeSession())).to.equal(CAMERA_ANSWER);
        });

        it("forwards the answer unchanged for an offer of another session id", async () => {
            bridge.offerSent(makeSession({ id: 8 }), OFFER);

            expect(await answer(makeSession())).to.equal(CAMERA_ANSWER);
        });

        it("keeps the offer when its withdraw comes after the answer consumed it and a new offer was sent", async () => {
            const session = makeSession();
            const withdraw = bridge.offerSent(session, OFFER);
            await answer(session);
            bridge.offerSent(session, OFFER);

            withdraw();

            expect(await answer(session)).to.equal(NARROWED);
        });

        it("puts back the earlier offer when a later one is withdrawn before any answer", async () => {
            const session = makeSession();
            bridge.offerSent(session, OFFER);
            const withdraw = bridge.offerSent(session, CAMERA_ANSWER);

            withdraw();

            expect(await answer(session)).to.equal(NARROWED);
        });

        it("drops the offer on withdraw", async () => {
            const session = makeSession();
            const withdraw = bridge.offerSent(session, OFFER);

            withdraw();

            expect(await answer(session)).to.equal(CAMERA_ANSWER);
        });

        it("forgets the offer when the peer ends the session", async () => {
            const session = makeSession();
            bridge.offerSent(session, OFFER);
            await cameraEndpoint!.act(agent => {
                const server = agent.get(WebRtcTransportRequestorServer);
                server.upsertSession(session);
                server.events.end.emit(session, WebRtcTransportDefinitions.WebRtcEndReason.UserHangup);
            });

            expect(await answer(session)).to.equal(CAMERA_ANSWER);
        });

        it("forgets the offer of a session ended locally", async () => {
            const session = makeSession();
            bridge.offerSent(session, OFFER);
            bridge.sessionEnded(session);

            expect(await answer(session)).to.equal(CAMERA_ANSWER);
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

    it("a candidate this event reports is what ProvideIceCandidates takes back", async () => {
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

        const event = recorded[0];
        if (event.event_type !== "ice_candidates" || event.data === null) {
            throw new Error(`expected an ice_candidates event with data, got ${JSON.stringify(event)}`);
        }
        // Input is the event's own wire payload, so this asserts the round trip, not the conversion against itself.
        const fields = toProviderCommandFields("ProvideIceCandidates", {
            webrtc_session_id: event.webrtc_session_id,
            ice_candidates: event.data.ice_candidates,
        });

        expect(fields).to.deep.equal({ webRtcSessionId: session.id, iceCandidates: candidates });
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
