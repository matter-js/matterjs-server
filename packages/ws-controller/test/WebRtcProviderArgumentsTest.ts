/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClusterModel, CommandModel, MatterModel } from "@matter/main/model";
import { parseStartStreamArgs } from "../src/camera/cameraCommands.js";
import { PROVIDER_COMMAND_NAMES, toProviderCommandFields } from "../src/camera/webRtcProviderArguments.js";
import { ServerError, ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";
import { ENDPOINT, LIVE_VIEW, managerWith, NODE, STATE, VIDEO_OFFER } from "./CameraStreamManagerTest.js";

/** The `ice_servers` shape the wire reference documents, and the `offer` event emits. */
const DOCUMENTED_ICE_SERVERS = [
    { urls: "stun:stun.example:3478" },
    { urls: ["turn:turn.example:3478", "turns:turn.example:5349"], username: "u", credential: "p", caid: 7 },
];

/** The same servers as `ICEServerStruct`: `urls` becomes the mandatory `urLs` list. */
const CLUSTER_ICE_SERVERS = [
    { urLs: ["stun:stun.example:3478"] },
    { urLs: ["turn:turn.example:3478", "turns:turn.example:5349"], username: "u", credential: "p", caid: 7 },
];

function refusal(run: () => unknown): ServerError {
    try {
        run();
    } catch (error) {
        return error as ServerError;
    }
    throw new Error("expected the argument to be refused");
}

function providerCommandFields(name: string): string[] {
    const cluster = MatterModel.standard.get(ClusterModel, "WebRtcTransportProvider");
    const command = cluster?.get(CommandModel, name);
    if (command === undefined) throw new Error(`no ${name} in the model`);
    return command.children.map(field => field.propertyName).filter(name => name !== "originatingEndpointId");
}

describe("WebRTC provider arguments", () => {
    describe("one boundary for both routes", () => {
        it("puts the documented ice_servers on the provider command from either route", async () => {
            const { manager, invokes } = managerWith(STATE, async invoke => {
                if (invoke.command === "videoStreamAllocate") return { videoStreamId: 9 };
                if (invoke.command === "provideOffer") return { webRtcSessionId: 42 };
                return undefined;
            });
            const managed = parseStartStreamArgs({
                node_id: 5,
                endpoint_id: 1,
                stream_usage: "LiveView",
                sdp: VIDEO_OFFER,
                ice_servers: DOCUMENTED_ICE_SERVERS,
                ice_transport_policy: "relay",
            });
            await manager.startStream({
                nodeId: NODE,
                endpointId: ENDPOINT,
                connectionId: "conn-1",
                streamUsage: LIVE_VIEW,
                sdp: managed.sdp,
                iceServers: managed.iceServers,
                iceTransportPolicy: managed.iceTransportPolicy,
            });
            const managedFields = invokes.find(invoke => invoke.command === "provideOffer")?.fields;

            const raw = toProviderCommandFields("ProvideOffer", {
                webRtcSessionId: null,
                sdp: VIDEO_OFFER,
                stream_usage: LIVE_VIEW,
                ice_servers: DOCUMENTED_ICE_SERVERS,
                ice_transport_policy: "relay",
            });

            expect(managedFields?.iceServers).to.deep.equal(CLUSTER_ICE_SERVERS);
            expect(raw.iceServers).to.deep.equal(CLUSTER_ICE_SERVERS);
            expect(raw.iceServers).to.deep.equal(managedFields?.iceServers);
            expect(raw.iceTransportPolicy).to.equal(managedFields?.iceTransportPolicy);
        });

        it("refuses the same malformed ice_servers entry on either route", () => {
            const entry = { ice_servers: [{ urls: "stun:a.example", turnServer: true }] };
            const managed = refusal(() =>
                parseStartStreamArgs({ node_id: 5, endpoint_id: 1, stream_usage: "LiveView", ...entry }),
            );
            const raw = refusal(() =>
                toProviderCommandFields("ProvideOffer", { webRtcSessionId: null, sdp: "v=0", ...entry }),
            );
            expect(managed.code).to.equal(ServerErrorCode.InvalidArguments);
            expect(raw.code).to.equal(ServerErrorCode.InvalidArguments);
            expect(raw.message).to.equal(managed.message);
        });
    });

    describe("toProviderCommandFields", () => {
        it("accepts every field the command states, and no other", () => {
            const expected = {
                ProvideOffer: [
                    "webRtcSessionId",
                    "sdp",
                    "streamUsage",
                    "videoStreamId",
                    "audioStreamId",
                    "iceServers",
                    "iceTransportPolicy",
                    "metadataEnabled",
                    "videoStreams",
                    "audioStreams",
                ],
                SolicitOffer: [
                    "streamUsage",
                    "videoStreamId",
                    "audioStreamId",
                    "iceServers",
                    "iceTransportPolicy",
                    "metadataEnabled",
                    "videoStreams",
                    "audioStreams",
                ],
                ProvideIceCandidates: ["webRtcSessionId", "iceCandidates"],
            };
            for (const command of PROVIDER_COMMAND_NAMES) {
                const message = refusal(() => toProviderCommandFields(command, { notAField: 1 })).message;
                const accepted = message.slice(message.indexOf("Accepted: ") + "Accepted: ".length).split(", ");
                expect(accepted).to.deep.equal(expected[command]);
                // The spelled list is what the boundary owes a client; the model is what it must match.
                expect(accepted).to.deep.equal(providerCommandFields(command));
            }
        });

        it("resolves this API's own snake spelling of a field to it", () => {
            // Every id this API hands a client is snake-cased — camera_start_stream answers
            // `webrtc_session_id` — so the echo of one has to reach the field it names.
            const fields = toProviderCommandFields("ProvideIceCandidates", {
                webrtc_session_id: 12,
                ice_candidates: [{ candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0 }],
            });
            expect(fields.webRtcSessionId).to.equal(12);
        });

        it("refuses originatingEndpointId on a command that states no such field", () => {
            // Dropped where the server overwrites it, unknown where the command has no such field:
            // dropping it there would discard an argument nothing else answers for.
            expect(
                refusal(() =>
                    toProviderCommandFields("ProvideIceCandidates", {
                        webRtcSessionId: 1,
                        ice_candidates: [{ candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0 }],
                        originatingEndpointId: 99,
                    }),
                ).message,
            ).to.match(/^unknown ProvideIceCandidates payload key: originatingEndpointId\./);
        });

        it("holds a string to the floor its field states, where that is all it states", () => {
            // SdpMid is `min 1` with no ceiling. An empty string is one the struct forbids, so the
            // camera would otherwise be the one to refuse it.
            expect(
                refusal(() =>
                    toProviderCommandFields("ProvideIceCandidates", {
                        webRtcSessionId: 1,
                        ice_candidates: [{ candidate: "candidate:1", sdpMid: "", sdpMLineIndex: 0 }],
                    }),
                ).message,
            ).to.equal("ice_candidates[0].sdpMid must be a string of at least 1 characters");
            // Candidate states neither end, so its length is not the server's to judge.
            expect(
                toProviderCommandFields("ProvideIceCandidates", {
                    webRtcSessionId: 1,
                    ice_candidates: [{ candidate: "", sdpMid: "0", sdpMLineIndex: 0 }],
                }),
            ).to.deep.equal({
                webRtcSessionId: 1,
                iceCandidates: [{ candidate: "", sdpMid: "0", sdpmLineIndex: 0 }],
            });
        });

        it("refuses an unknown key inside an ice_candidates entry", () => {
            expect(
                refusal(() =>
                    toProviderCommandFields("ProvideIceCandidates", {
                        webRtcSessionId: 1,
                        ice_candidates: [{ candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0, priority: 5 }],
                    }),
                ).message,
            ).to.match(/^unknown ice_candidates\[0\] key: priority\./);
        });

        it("requires the members ICECandidateStruct states as mandatory", () => {
            expect(
                refusal(() =>
                    toProviderCommandFields("ProvideIceCandidates", {
                        webRtcSessionId: 1,
                        ice_candidates: [{ candidate: "candidate:1" }],
                    }),
                ).message,
            ).to.equal("ice_candidates[0] requires sdpMid");
        });

        it("bounds an ice_candidates entry's members by the struct's own definition", () => {
            expect(
                refusal(() =>
                    toProviderCommandFields("ProvideIceCandidates", {
                        webRtcSessionId: 1,
                        ice_candidates: [{ candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 65536 }],
                    }),
                ).message,
            ).to.equal("ice_candidates[0].sdpMLineIndex must be an integer between 0 and 65535");
        });

        it("refuses the empty ice_candidates list the field's minimum forbids", () => {
            expect(
                refusal(() =>
                    toProviderCommandFields("ProvideIceCandidates", { webRtcSessionId: 1, ice_candidates: [] }),
                ).message,
            ).to.equal("ice_candidates must be an array of 1 or more entries");
        });

        it("refuses a payload that is not an object", () => {
            expect(refusal(() => toProviderCommandFields("ProvideOffer", undefined)).message).to.equal(
                "ProvideOffer payload must be an object",
            );
        });

        it("resolves the Python Matter Server spelling to the field it names", () => {
            const fields = toProviderCommandFields("ProvideOffer", { WebRTCSessionID: 12, SDP: "v=0" });
            expect(fields).to.deep.equal({ webRtcSessionId: 12, sdp: "v=0" });
        });

        it("refuses a key that names an Object prototype member", () => {
            expect(
                refusal(() =>
                    toProviderCommandFields("ProvideOffer", { webRtcSessionId: null, sdp: "v=0", toString: 1 }),
                ).message,
            ).to.match(/^unknown ProvideOffer payload key: toString\./);
        });

        it("refuses two spellings of the same field whichever came first", () => {
            // The first spelling carries a null the field drops, so nothing records it but the walk.
            for (const payload of [
                { metadataEnabled: null, metadata_enabled: true },
                { metadata_enabled: true, metadataEnabled: null },
            ]) {
                expect(
                    refusal(() =>
                        toProviderCommandFields("ProvideOffer", { webRtcSessionId: null, sdp: "v=0", ...payload }),
                    ).message,
                ).to.match(/^ProvideOffer payload states metadataEnabled twice/);
            }
        });

        it("refuses two spellings of the same field", () => {
            expect(
                refusal(() =>
                    toProviderCommandFields("ProvideOffer", {
                        webRtcSessionId: null,
                        sdp: "v=0",
                        ice_servers: [{ urls: "stun:a.example" }],
                        iceServers: [{ urls: "stun:b.example" }],
                    }),
                ).message,
            ).to.equal("ProvideOffer payload states iceServers twice, last as iceServers");
        });

        it("drops a client-supplied originatingEndpointId", () => {
            const fields = toProviderCommandFields("SolicitOffer", { streamUsage: 3, originatingEndpointId: 99 });
            expect(fields).to.deep.equal({ streamUsage: 3 });
        });

        it("requires the fields the command states as mandatory", () => {
            expect(refusal(() => toProviderCommandFields("ProvideOffer", { sdp: "v=0" })).message).to.equal(
                "ProvideOffer payload requires webRtcSessionId",
            );
            expect(refusal(() => toProviderCommandFields("SolicitOffer", {})).message).to.equal(
                "SolicitOffer payload requires streamUsage",
            );
        });

        it("keeps null for a nullable field and drops it for an optional one", () => {
            const fields = toProviderCommandFields("ProvideOffer", {
                webRtcSessionId: null,
                sdp: "v=0",
                metadataEnabled: null,
            });
            expect(fields).to.deep.equal({ webRtcSessionId: null, sdp: "v=0" });
        });

        it("refuses null for a mandatory field that is not nullable", () => {
            expect(refusal(() => toProviderCommandFields("SolicitOffer", { streamUsage: null })).message).to.equal(
                "streamUsage must not be null",
            );
        });

        it("bounds every number by the field it becomes", () => {
            expect(
                refusal(() => toProviderCommandFields("ProvideOffer", { webRtcSessionId: 65536, sdp: "v=0" })).message,
            ).to.equal("webRtcSessionId must be an integer between 0 and 65535");
            expect(
                refusal(() =>
                    toProviderCommandFields("ProvideOffer", {
                        webRtcSessionId: null,
                        sdp: "v=0",
                        videoStreams: [65536],
                    }),
                ).message,
            ).to.equal("videoStreams[0] must be an integer between 0 and 65535");
        });

        it("bounds every list by the length the field takes", () => {
            expect(
                refusal(() =>
                    toProviderCommandFields("ProvideOffer", { webRtcSessionId: null, sdp: "v=0", videoStreams: [] }),
                ).message,
            ).to.equal("videoStreams must be an array of 1 to 16 entries");
        });

        it("bounds every string by the length the field takes", () => {
            expect(
                refusal(() =>
                    toProviderCommandFields("ProvideOffer", {
                        webRtcSessionId: null,
                        sdp: "v=0",
                        iceTransportPolicy: "x".repeat(17),
                    }),
                ).message,
            ).to.equal("iceTransportPolicy must be a string of 1 to 16 characters");
            // `sdp` states no ceiling, so nothing but its type is checked.
            expect(
                refusal(() => toProviderCommandFields("ProvideOffer", { webRtcSessionId: null, sdp: 5 })).message,
            ).to.equal("sdp must be a string");
        });

        it("refuses a value whose type the field does not take", () => {
            expect(
                refusal(() =>
                    toProviderCommandFields("ProvideOffer", {
                        webRtcSessionId: null,
                        sdp: "v=0",
                        metadataEnabled: "yes",
                    }),
                ).message,
            ).to.equal("metadataEnabled must be a boolean");
        });

        it("names the key the client sent in the refusal", () => {
            expect(
                refusal(() =>
                    toProviderCommandFields("ProvideOffer", {
                        webRtcSessionId: null,
                        sdp: "v=0",
                        ice_servers: [{ urls: 5 }],
                    }),
                ).message,
            ).to.equal("ice_servers[0].urls[0] must be a string of 1 to 2000 characters");
        });
    });
});
