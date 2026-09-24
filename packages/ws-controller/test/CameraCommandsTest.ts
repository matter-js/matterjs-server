/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { EndpointNumber, NodeId } from "@matter/main";
import { CameraAvStreamManagement } from "@matter/main/clusters/camera-av-stream-management";
import { StreamUsage } from "@matter/main/types";
import {
    parseCameraTarget,
    parseReleaseStreamArgs,
    parseSnapshotArgs,
    parseStartStreamArgs,
    parseStopStreamArgs,
    toWireCapabilities,
    toWireSnapshotResult,
    toWireStartStreamResult,
} from "../src/camera/cameraCommands.js";
import type { CameraCapabilities, SnapshotResult, StartStreamResult } from "../src/camera/CameraStreamManager.js";
import type { AllocatedAudioStream, AllocatedSnapshotStream, AllocatedVideoStream } from "../src/camera/cameraTypes.js";
import { ServerError, ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";

describe("cameraCommands", () => {
    describe("parseCameraTarget", () => {
        it("accepts a numeric node id", () => {
            expect(parseCameraTarget({ node_id: 5, endpoint_id: 1 })).to.deep.equal({ nodeId: 5n, endpointId: 1 });
        });

        it("accepts a bigint node id without losing precision", () => {
            const nodeId = 18446744069414584320n;
            expect(parseCameraTarget({ node_id: nodeId, endpoint_id: 1 }).nodeId).to.equal(nodeId);
        });

        it("rejects a missing node id", () => {
            let thrown: unknown;
            try {
                parseCameraTarget({ endpoint_id: 1 });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.InvalidArguments);
        });

        it("rejects a fractional, NaN, or infinite numeric node id instead of letting NodeId() throw", () => {
            for (const bad of [1.5, NaN, Infinity, -Infinity]) {
                let thrown: unknown;
                try {
                    parseCameraTarget({ node_id: bad, endpoint_id: 1 });
                } catch (error) {
                    thrown = error;
                }
                expect((thrown as ServerError).code).to.equal(ServerErrorCode.InvalidArguments);
            }
        });

        it("rejects a non-integer endpoint id", () => {
            let thrown: unknown;
            try {
                parseCameraTarget({ node_id: 5, endpoint_id: 1.5 });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.InvalidArguments);
        });

        it("rejects an endpoint id above the 16-bit range", () => {
            let thrown: unknown;
            try {
                parseCameraTarget({ node_id: 5, endpoint_id: 0x10000 });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.InvalidArguments);
        });

        it("rejects a negative endpoint id", () => {
            let thrown: unknown;
            try {
                parseCameraTarget({ node_id: 5, endpoint_id: -1 });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.InvalidArguments);
        });
    });

    describe("parseStartStreamArgs", () => {
        it("reads snake_case resolution ranges into internal hints", () => {
            const parsed = parseStartStreamArgs({
                node_id: 5,
                endpoint_id: 1,
                stream_usage: "LiveView",
                video: {
                    min_resolution: { width: 1280, height: 720 },
                    max_resolution: { width: 1920, height: 1080 },
                    max_frame_rate: 15,
                },
            });
            expect(parsed.video).to.deep.equal({
                minResolution: { width: 1280, height: 720 },
                maxResolution: { width: 1920, height: 1080 },
                maxFrameRate: 15,
            });
        });

        it("maps the stream usage name to its enum value", () => {
            expect(parseStartStreamArgs({ node_id: 5, endpoint_id: 1, stream_usage: "LiveView" }).streamUsage).to.equal(
                3,
            );
        });

        it("maps Recording and Analysis to their enum values", () => {
            expect(
                parseStartStreamArgs({ node_id: 5, endpoint_id: 1, stream_usage: "Recording" }).streamUsage,
            ).to.equal(1);
            expect(parseStartStreamArgs({ node_id: 5, endpoint_id: 1, stream_usage: "Analysis" }).streamUsage).to.equal(
                2,
            );
        });

        it("accepts a stream usage name in any case, as the codec names are", () => {
            expect(parseStartStreamArgs({ node_id: 5, endpoint_id: 1, stream_usage: "liveview" }).streamUsage).to.equal(
                StreamUsage.LiveView,
            );
        });

        it("rejects the decimal spelling of a stream usage, which the device cannot be asked for", () => {
            let thrown: unknown;
            try {
                parseStartStreamArgs({ node_id: 5, endpoint_id: 1, stream_usage: "3" });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.InvalidArguments);
        });

        it("rejects an unknown stream usage", () => {
            let thrown: unknown;
            try {
                parseStartStreamArgs({ node_id: 5, endpoint_id: 1, stream_usage: "Nonsense" });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.InvalidArguments);
        });

        it("rejects the device-only Internal stream usage", () => {
            let thrown: unknown;
            try {
                parseStartStreamArgs({ node_id: 5, endpoint_id: 1, stream_usage: "Internal" });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.InvalidArguments);
        });

        it("carries an explicit false through as no track", () => {
            expect(
                parseStartStreamArgs({ node_id: 5, endpoint_id: 1, stream_usage: "LiveView", audio: false }).audio,
            ).to.equal(false);
            expect(
                parseStartStreamArgs({ node_id: 5, endpoint_id: 1, stream_usage: "LiveView", video: false }).video,
            ).to.equal(false);
        });

        it("leaves video/audio undefined when omitted", () => {
            const parsed = parseStartStreamArgs({ node_id: 5, endpoint_id: 1, stream_usage: "LiveView" });
            expect(parsed.video).to.equal(undefined);
            expect(parsed.audio).to.equal(undefined);
        });

        it("reads audio hints from snake_case fields", () => {
            const parsed = parseStartStreamArgs({
                node_id: 5,
                endpoint_id: 1,
                stream_usage: "LiveView",
                audio: { codecs: ["OPUS"], channel_count: 1, sample_rate: 16000, bit_rate: 32000 },
            });
            expect(parsed.audio).to.deep.equal({
                codecs: ["OPUS"],
                channelCount: 1,
                sampleRate: 16000,
                bitRate: 32000,
            });
        });

        it("passes sdp, ice and metadata fields through, translating ice_servers to the struct", () => {
            const parsed = parseStartStreamArgs({
                node_id: 5,
                endpoint_id: 1,
                stream_usage: "LiveView",
                sdp: "v=0",
                ice_servers: [{ urls: "stun:example.com" }],
                ice_transport_policy: "relay",
                metadata_enabled: true,
            });
            expect(parsed.sdp).to.equal("v=0");
            expect(parsed.iceServers).to.deep.equal([{ urLs: ["stun:example.com"] }]);
            expect(parsed.iceTransportPolicy).to.equal("relay");
            expect(parsed.metadataEnabled).to.equal(true);
        });

        it("keeps a urls list, the credentials and the caid on the struct", () => {
            const parsed = parseStartStreamArgs({
                node_id: 5,
                endpoint_id: 1,
                stream_usage: "LiveView",
                ice_servers: [
                    { urls: ["turn:a.example:3478", "turns:a.example:5349"], username: "u", credential: "p", caid: 7 },
                ],
            });
            expect(parsed.iceServers).to.deep.equal([
                {
                    urLs: ["turn:a.example:3478", "turns:a.example:5349"],
                    username: "u",
                    credential: "p",
                    caid: 7,
                },
            ]);
        });

        function expectInvalidArguments(build: () => unknown): void {
            let thrown: unknown;
            try {
                build();
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.InvalidArguments);
        }

        it("rejects a non-string sdp", () => {
            expectInvalidArguments(() =>
                parseStartStreamArgs({ node_id: 5, endpoint_id: 1, stream_usage: "LiveView", sdp: 123 }),
            );
        });

        it("rejects a non-array ice_servers", () => {
            expectInvalidArguments(() =>
                parseStartStreamArgs({ node_id: 5, endpoint_id: 1, stream_usage: "LiveView", ice_servers: "stun:x" }),
            );
        });

        it("rejects an ice_servers entry that is not an object", () => {
            expectInvalidArguments(() =>
                parseStartStreamArgs({
                    node_id: 5,
                    endpoint_id: 1,
                    stream_usage: "LiveView",
                    ice_servers: ["stun:x"],
                }),
            );
        });

        function expectIceServersRejected(entry: unknown): void {
            expectInvalidArguments(() =>
                parseStartStreamArgs({
                    node_id: 5,
                    endpoint_id: 1,
                    stream_usage: "LiveView",
                    ice_servers: [entry],
                }),
            );
        }

        it("rejects an ice_servers entry with no urls", () => {
            expectIceServersRejected({ username: "u" });
            expectIceServersRejected({ urls: [] });
        });

        it("rejects an ice_servers entry whose urls are not strings", () => {
            expectIceServersRejected({ urls: 5 });
            expectIceServersRejected({ urls: ["stun:a.example", 5] });
        });

        it("rejects an empty url, username or credential", () => {
            expectIceServersRejected({ urls: "" });
            expectIceServersRejected({ urls: ["stun:a.example", ""] });
            expectIceServersRejected({ urls: "stun:a.example", username: "" });
            expectIceServersRejected({ urls: "stun:a.example", credential: "" });
        });

        it("rejects an ice_servers entry past the struct's own limits", () => {
            expectIceServersRejected({ urls: new Array<string>(11).fill("stun:a.example") });
            expectIceServersRejected({ urls: `stun:${"a".repeat(2000)}` });
            expectIceServersRejected({ urls: "stun:a.example", username: "u".repeat(509) });
            expectIceServersRejected({ urls: "stun:a.example", credential: "p".repeat(513) });
            expectIceServersRejected({ urls: "stun:a.example", caid: 65535 });
            expectIceServersRejected({ urls: "stun:a.example", caid: 1.5 });
        });

        it("rejects an unknown key on an ice_servers entry", () => {
            expectIceServersRejected({ urls: "stun:a.example", url: "stun:b.example" });
        });

        it("rejects more ice_servers than the command's own list takes", () => {
            expectInvalidArguments(() =>
                parseStartStreamArgs({
                    node_id: 5,
                    endpoint_id: 1,
                    stream_usage: "LiveView",
                    ice_servers: new Array<unknown>(11).fill({ urls: "stun:a.example" }),
                }),
            );
        });

        it("rejects an ice_transport_policy past the field's length", () => {
            expectInvalidArguments(() =>
                parseStartStreamArgs({
                    node_id: 5,
                    endpoint_id: 1,
                    stream_usage: "LiveView",
                    ice_transport_policy: "r".repeat(17),
                }),
            );
        });

        it("rejects a non-string ice_transport_policy", () => {
            expectInvalidArguments(() =>
                parseStartStreamArgs({
                    node_id: 5,
                    endpoint_id: 1,
                    stream_usage: "LiveView",
                    ice_transport_policy: 1,
                }),
            );
        });

        it("rejects a non-boolean metadata_enabled", () => {
            expectInvalidArguments(() =>
                parseStartStreamArgs({
                    node_id: 5,
                    endpoint_id: 1,
                    stream_usage: "LiveView",
                    metadata_enabled: "yes",
                }),
            );
        });

        it("rejects a non-numeric max_frame_rate hint", () => {
            expectInvalidArguments(() =>
                parseStartStreamArgs({
                    node_id: 5,
                    endpoint_id: 1,
                    stream_usage: "LiveView",
                    video: { max_frame_rate: "30" },
                }),
            );
        });

        it("rejects a non-numeric min_bit_rate hint", () => {
            expectInvalidArguments(() =>
                parseStartStreamArgs({
                    node_id: 5,
                    endpoint_id: 1,
                    stream_usage: "LiveView",
                    video: { min_bit_rate: "1000" },
                }),
            );
        });

        it("rejects a negative, zero, fractional, NaN, or infinite max_frame_rate hint", () => {
            for (const bad of [-1, 0, 1.5, NaN, Infinity, -Infinity]) {
                expectInvalidArguments(() =>
                    parseStartStreamArgs({
                        node_id: 5,
                        endpoint_id: 1,
                        stream_usage: "LiveView",
                        video: { max_frame_rate: bad },
                    }),
                );
            }
        });

        it("rejects a negative, zero, fractional, NaN, or infinite min_bit_rate hint", () => {
            for (const bad of [-1, 0, 1.5, NaN, Infinity, -Infinity]) {
                expectInvalidArguments(() =>
                    parseStartStreamArgs({
                        node_id: 5,
                        endpoint_id: 1,
                        stream_usage: "LiveView",
                        video: { min_bit_rate: bad },
                    }),
                );
            }
        });

        it("rejects a negative, zero, fractional, NaN, or infinite max_resolution width or height hint", () => {
            for (const bad of [-1, 0, 1.5, NaN, Infinity, -Infinity]) {
                expectInvalidArguments(() =>
                    parseStartStreamArgs({
                        node_id: 5,
                        endpoint_id: 1,
                        stream_usage: "LiveView",
                        video: { max_resolution: { width: bad, height: 480 } },
                    }),
                );
                expectInvalidArguments(() =>
                    parseStartStreamArgs({
                        node_id: 5,
                        endpoint_id: 1,
                        stream_usage: "LiveView",
                        video: { max_resolution: { width: 640, height: bad } },
                    }),
                );
            }
        });

        it("rejects a value past the wire width of the field it becomes", () => {
            // A positive safe integer is not enough: the cluster gives each of these a uint8, uint16
            // or uint32, and a value past that reaches matter.js's TLV encoder, whose error names the
            // encoder rather than the argument the client sent.
            expectInvalidArguments(() =>
                parseStartStreamArgs({
                    node_id: 5,
                    endpoint_id: 1,
                    stream_usage: "LiveView",
                    video: { max_resolution: { width: 100000, height: 480 } },
                }),
            );
            expectInvalidArguments(() =>
                parseStartStreamArgs({
                    node_id: 5,
                    endpoint_id: 1,
                    stream_usage: "LiveView",
                    video: { max_frame_rate: 65536 },
                }),
            );
            expectInvalidArguments(() =>
                parseStartStreamArgs({
                    node_id: 5,
                    endpoint_id: 1,
                    stream_usage: "LiveView",
                    video: { max_bit_rate: 4294967296 },
                }),
            );
            expectInvalidArguments(() =>
                parseStartStreamArgs({
                    node_id: 5,
                    endpoint_id: 1,
                    stream_usage: "LiveView",
                    audio: { bit_rate: 4294967296 },
                }),
            );
        });

        it("rejects a channel count above the eight the cluster allows, not merely a non-positive one", () => {
            // ChannelCount is "1 to 8" (§11.2.8.1), a constraint narrower than its uint8 width.
            expectInvalidArguments(() =>
                parseStartStreamArgs({
                    node_id: 5,
                    endpoint_id: 1,
                    stream_usage: "LiveView",
                    audio: { channel_count: 9 },
                }),
            );
        });

        it("accepts the largest value each field can carry", () => {
            const args = parseStartStreamArgs({
                node_id: 5,
                endpoint_id: 1,
                stream_usage: "LiveView",
                video: {
                    max_resolution: { width: 65535, height: 65535 },
                    max_frame_rate: 65535,
                    max_bit_rate: 4294967295,
                },
                audio: { channel_count: 8, sample_rate: 4294967295 },
            });
            expect(args.video === false ? undefined : args.video?.maxFrameRate).to.equal(65535);
            expect(args.audio === false ? undefined : args.audio?.channelCount).to.equal(8);
        });

        it("rejects a video codecs hint that is not an array of strings", () => {
            expectInvalidArguments(() =>
                parseStartStreamArgs({
                    node_id: 5,
                    endpoint_id: 1,
                    stream_usage: "LiveView",
                    video: { codecs: [1, 2] },
                }),
            );
        });

        it("upper-cases codec hints, so a lower-case name is not a hard codec failure", () => {
            const args = parseStartStreamArgs({
                node_id: 5,
                endpoint_id: 1,
                stream_usage: "LiveView",
                video: { codecs: ["h265"] },
                audio: { codecs: ["opus"] },
            });
            expect(args.video === false ? undefined : args.video?.codecs).to.deep.equal(["H265"]);
            expect(args.audio === false ? undefined : args.audio?.codecs).to.deep.equal(["OPUS"]);
        });

        it("rejects a non-object video hints value", () => {
            expectInvalidArguments(() =>
                parseStartStreamArgs({ node_id: 5, endpoint_id: 1, stream_usage: "LiveView", video: "H265" }),
            );
        });

        it("rejects a non-numeric channel_count audio hint", () => {
            expectInvalidArguments(() =>
                parseStartStreamArgs({
                    node_id: 5,
                    endpoint_id: 1,
                    stream_usage: "LiveView",
                    audio: { channel_count: "2" },
                }),
            );
        });

        it("rejects a negative, zero, fractional, NaN, or infinite channel_count audio hint", () => {
            for (const bad of [-1, 0, 1.5, NaN, Infinity, -Infinity]) {
                expectInvalidArguments(() =>
                    parseStartStreamArgs({
                        node_id: 5,
                        endpoint_id: 1,
                        stream_usage: "LiveView",
                        audio: { channel_count: bad },
                    }),
                );
            }
        });

        it("rejects a negative, zero, fractional, NaN, or infinite sample_rate or bit_rate audio hint", () => {
            for (const bad of [-1, 0, 1.5, NaN, Infinity, -Infinity]) {
                expectInvalidArguments(() =>
                    parseStartStreamArgs({
                        node_id: 5,
                        endpoint_id: 1,
                        stream_usage: "LiveView",
                        audio: { sample_rate: bad },
                    }),
                );
                expectInvalidArguments(() =>
                    parseStartStreamArgs({
                        node_id: 5,
                        endpoint_id: 1,
                        stream_usage: "LiveView",
                        audio: { bit_rate: bad },
                    }),
                );
            }
        });

        it("rejects an audio codecs hint that is not an array of strings", () => {
            expectInvalidArguments(() =>
                parseStartStreamArgs({
                    node_id: 5,
                    endpoint_id: 1,
                    stream_usage: "LiveView",
                    audio: { codecs: [0] },
                }),
            );
        });
    });

    describe("parseStopStreamArgs", () => {
        it("reads webrtc_session_id", () => {
            expect(parseStopStreamArgs({ node_id: 5, endpoint_id: 1, webrtc_session_id: 7 }).webRtcSessionId).to.equal(
                7,
            );
        });

        it("rejects a missing webrtc_session_id", () => {
            let thrown: unknown;
            try {
                parseStopStreamArgs({ node_id: 5, endpoint_id: 1 });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.InvalidArguments);
        });

        it("rejects a non-integer webrtc_session_id", () => {
            let thrown: unknown;
            try {
                parseStopStreamArgs({ node_id: 5, endpoint_id: 1, webrtc_session_id: 1.5 });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.InvalidArguments);
        });

        it("takes the highest webrtc_session_id the field holds and refuses the one above it", () => {
            expect(
                parseStopStreamArgs({ node_id: 5, endpoint_id: 1, webrtc_session_id: 65535 }).webRtcSessionId,
            ).to.equal(65535);

            let thrown: unknown;
            try {
                parseStopStreamArgs({ node_id: 5, endpoint_id: 1, webrtc_session_id: 65536 });
            } catch (error) {
                thrown = error;
            }
            // Not a session the camera can have: `ended: false` would read as a session that had
            // already ended.
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.InvalidArguments);
        });
    });

    describe("parseSnapshotArgs", () => {
        it("parses an optional max_resolution and codec name", () => {
            const parsed = parseSnapshotArgs({
                node_id: 5,
                endpoint_id: 1,
                max_resolution: { width: 640, height: 480 },
                codec: "JPEG",
            });
            expect(parsed.maxResolution).to.deep.equal({ width: 640, height: 480 });
            expect(parsed.codec).to.equal(CameraAvStreamManagement.ImageCodec.Jpeg);
        });

        it("accepts a codec name in any case, as the video and audio hints do", () => {
            const parsed = parseSnapshotArgs({ node_id: 5, endpoint_id: 1, codec: "heic" });
            expect(parsed.codec).to.equal(CameraAvStreamManagement.ImageCodec.Heic);
        });

        it("accepts the decimal spelling capabilities report for a codec the enum does not name", () => {
            const parsed = parseSnapshotArgs({ node_id: 5, endpoint_id: 1, codec: "7" });
            expect(parsed.codec).to.equal(7);
        });

        it("leaves max_resolution and codec undefined when omitted", () => {
            const parsed = parseSnapshotArgs({ node_id: 5, endpoint_id: 1 });
            expect(parsed.maxResolution).to.equal(undefined);
            expect(parsed.codec).to.equal(undefined);
        });

        it("rejects a codec that is neither a known name nor a number", () => {
            let thrown: unknown;
            try {
                parseSnapshotArgs({ node_id: 5, endpoint_id: 1, codec: "PNG" });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.InvalidArguments);
        });

        it("rejects a numeric codec, which is the pre-schema-14 spelling", () => {
            let thrown: unknown;
            try {
                parseSnapshotArgs({ node_id: 5, endpoint_id: 1, codec: 0 });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.InvalidArguments);
        });

        it("rejects a malformed max_resolution", () => {
            let thrown: unknown;
            try {
                parseSnapshotArgs({ node_id: 5, endpoint_id: 1, max_resolution: { width: 1280 } });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.InvalidArguments);
        });

        it("rejects a negative, zero, fractional, NaN, or infinite max_resolution width or height", () => {
            for (const bad of [-1, 0, 1.5, NaN, Infinity, -Infinity]) {
                let thrownWidth: unknown;
                try {
                    parseSnapshotArgs({ node_id: 5, endpoint_id: 1, max_resolution: { width: bad, height: 480 } });
                } catch (error) {
                    thrownWidth = error;
                }
                expect((thrownWidth as ServerError).code).to.equal(ServerErrorCode.InvalidArguments);

                let thrownHeight: unknown;
                try {
                    parseSnapshotArgs({ node_id: 5, endpoint_id: 1, max_resolution: { width: 640, height: bad } });
                } catch (error) {
                    thrownHeight = error;
                }
                expect((thrownHeight as ServerError).code).to.equal(ServerErrorCode.InvalidArguments);
            }
        });
    });

    describe("parseReleaseStreamArgs", () => {
        it("parses kind and stream_id", () => {
            const parsed = parseReleaseStreamArgs({ node_id: 5, endpoint_id: 1, kind: "video", stream_id: 3 });
            expect(parsed.kind).to.equal("video");
            expect(parsed.streamId).to.equal(3);
        });

        it("rejects a kind that is not video, audio, or snapshot", () => {
            let thrown: unknown;
            try {
                parseReleaseStreamArgs({ node_id: 5, endpoint_id: 1, kind: "metadata", stream_id: 3 });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.InvalidArguments);
        });

        it("rejects a non-integer stream_id", () => {
            let thrown: unknown;
            try {
                parseReleaseStreamArgs({ node_id: 5, endpoint_id: 1, kind: "video", stream_id: 1.5 });
            } catch (error) {
                thrown = error;
            }
            expect((thrown as ServerError).code).to.equal(ServerErrorCode.InvalidArguments);
        });

        it("takes the highest stream_id each kind holds and refuses the one above it", () => {
            for (const kind of ["video", "audio", "snapshot"]) {
                expect(
                    parseReleaseStreamArgs({ node_id: 5, endpoint_id: 1, kind, stream_id: 65535 }).streamId,
                ).to.equal(65535);

                let thrown: unknown;
                try {
                    parseReleaseStreamArgs({ node_id: 5, endpoint_id: 1, kind, stream_id: 65536 });
                } catch (error) {
                    thrown = error;
                }
                expect((thrown as ServerError).code, kind).to.equal(ServerErrorCode.InvalidArguments);
            }
        });
    });

    describe("toWireCapabilities", () => {
        const EMPTY_CAPABILITIES: CameraCapabilities = {
            video: { rateDistortionPoints: [], codecs: [] },
            audio: { codecs: [], sampleRates: [], bitDepths: [] },
            snapshot: { capabilities: [] },
            limits: { supportedStreamUsages: [], streamUsagePriorities: [] },
            allocated: { video: [], audio: [], snapshot: [] },
            sessions: [],
        };

        it("emits snake_case keys and omits absent capabilities", () => {
            const wire = toWireCapabilities(EMPTY_CAPABILITIES);
            expect(wire.video).to.not.have.property("sensor");
            expect(wire.video).to.have.property("rate_distortion_points");
            expect(wire.limits).to.have.property("supported_stream_usages");
            expect(wire.limits).to.not.have.property("max_network_bandwidth");
        });

        it("reports each camera session with its stream ids and a named stream usage", () => {
            const wire = toWireCapabilities({
                ...EMPTY_CAPABILITIES,
                sessions: [
                    {
                        webRtcSessionId: 7,
                        peerNodeId: NodeId(5n),
                        peerEndpointId: EndpointNumber(1),
                        streamUsage: StreamUsage.LiveView,
                        videoStreamIds: [9],
                        audioStreamIds: [4],
                        establishedByThisServer: true,
                    },
                ],
            });

            expect(wire.sessions).to.deep.equal([
                {
                    webrtc_session_id: 7,
                    peer_node_id: NodeId(5n),
                    peer_endpoint_id: EndpointNumber(1),
                    stream_usage: "LiveView",
                    video_stream_ids: [9],
                    audio_stream_ids: [4],
                    established_by_this_server: true,
                },
            ]);
        });

        it("names every codec it reports, so the output can be sent back as a request", () => {
            const wire = toWireCapabilities({
                ...EMPTY_CAPABILITIES,
                video: {
                    ...EMPTY_CAPABILITIES.video,
                    codecs: [
                        CameraAvStreamManagement.VideoCodec.H264,
                        CameraAvStreamManagement.VideoCodec.Hevc,
                        CameraAvStreamManagement.VideoCodec.Vvc,
                        CameraAvStreamManagement.VideoCodec.Av1,
                    ],
                    rateDistortionPoints: [
                        {
                            codec: CameraAvStreamManagement.VideoCodec.H264,
                            resolution: { width: 1920, height: 1080 },
                            minBitRate: 100000,
                        },
                    ],
                },
                audio: { ...EMPTY_CAPABILITIES.audio, codecs: [CameraAvStreamManagement.AudioCodec.AacLc] },
                snapshot: {
                    capabilities: [
                        {
                            resolution: { width: 640, height: 480 },
                            maxFrameRate: 30,
                            imageCodec: CameraAvStreamManagement.ImageCodec.Heic,
                            requiresEncodedPixels: false,
                            requiresHardwareEncoder: false,
                        },
                    ],
                },
            });
            expect(wire.video.codecs).to.deep.equal(["H264", "H265", "H266", "AV1"]);
            expect(wire.video.rate_distortion_points[0]?.codec).to.equal("H264");
            expect(wire.audio.codecs).to.deep.equal(["AAC"]);
            expect(wire.snapshot.capabilities[0]?.image_codec).to.equal("HEIC");

            const fedBack = parseSnapshotArgs({
                node_id: 5,
                endpoint_id: 1,
                codec: wire.snapshot.capabilities[0]?.image_codec,
            });
            expect(fedBack.codec).to.equal(CameraAvStreamManagement.ImageCodec.Heic);
        });

        it("names every stream usage it reports, so the output can be sent back as a request", () => {
            const wire = toWireCapabilities({
                ...EMPTY_CAPABILITIES,
                limits: {
                    supportedStreamUsages: [StreamUsage.LiveView, StreamUsage.Recording, StreamUsage.Internal],
                    streamUsagePriorities: [StreamUsage.Recording],
                },
            });
            expect(wire.limits.supported_stream_usages).to.deep.equal(["LiveView", "Recording", "Internal"]);
            expect(wire.limits.stream_usage_priorities).to.deep.equal(["Recording"]);

            const fedBack = parseStartStreamArgs({
                node_id: 5,
                endpoint_id: 1,
                stream_usage: wire.limits.supported_stream_usages[0],
            });
            expect(fedBack.streamUsage).to.equal(StreamUsage.LiveView);
        });

        it("names the camera's talkback support, as the README tells a client to read it", () => {
            const wire = toWireCapabilities({
                ...EMPTY_CAPABILITIES,
                audio: {
                    ...EMPTY_CAPABILITIES.audio,
                    twoWayTalkSupport: CameraAvStreamManagement.TwoWayTalkSupportType.HalfDuplex,
                },
            });
            expect(wire.audio.two_way_talk_support).to.equal("HalfDuplex");

            const none = toWireCapabilities({
                ...EMPTY_CAPABILITIES,
                audio: {
                    ...EMPTY_CAPABILITIES.audio,
                    twoWayTalkSupport: CameraAvStreamManagement.TwoWayTalkSupportType.NotSupported,
                },
            });
            expect(none.audio.two_way_talk_support).to.equal("NotSupported");

            const unnamed = toWireCapabilities({
                ...EMPTY_CAPABILITIES,
                audio: { ...EMPTY_CAPABILITIES.audio, twoWayTalkSupport: 7 },
            });
            expect(unnamed.audio.two_way_talk_support).to.equal("7");
        });

        it("reports a stream usage the cluster enum does not name by its number", () => {
            const wire = toWireCapabilities({
                ...EMPTY_CAPABILITIES,
                limits: { supportedStreamUsages: [7], streamUsagePriorities: [] },
            });
            expect(wire.limits.supported_stream_usages).to.deep.equal(["7"]);
        });

        it("reports a codec the cluster enum does not name by its number", () => {
            const wire = toWireCapabilities({
                ...EMPTY_CAPABILITIES,
                video: { ...EMPTY_CAPABILITIES.video, codecs: [7] },
            });
            expect(wire.video.codecs).to.deep.equal(["7"]);
        });

        it("publishes the bandwidth ceiling the server caps a stream's bit rate at", () => {
            // A caller whose min_bit_rate now fails against this bound has to be able to read it first.
            const wire = toWireCapabilities({
                ...EMPTY_CAPABILITIES,
                limits: { ...EMPTY_CAPABILITIES.limits, maxNetworkBandwidth: 2000000 },
            });
            expect(wire.limits.max_network_bandwidth).to.equal(2000000);
        });

        it("includes a stated sensor and viewport rather than omitting them", () => {
            const wire = toWireCapabilities({
                ...EMPTY_CAPABILITIES,
                video: {
                    ...EMPTY_CAPABILITIES.video,
                    sensor: { width: 2560, height: 1440 },
                    minViewport: { width: 640, height: 360 },
                    maxFps: 30,
                    maxHdrFps: 15,
                    hdrCapable: true,
                },
            });
            expect(wire.video.sensor).to.deep.equal({ width: 2560, height: 1440 });
            expect(wire.video.min_viewport).to.deep.equal({ width: 640, height: 360 });
            expect(wire.video.max_fps).to.equal(30);
            expect(wire.video.max_hdr_fps).to.equal(15);
            expect(wire.video.hdr_capable).to.equal(true);
        });

        it("converts allocated video/audio/snapshot streams to snake_case", () => {
            const videoStream: AllocatedVideoStream & { ownedByServer: boolean } = {
                videoStreamId: 1,
                streamUsage: 3,
                videoCodec: 1,
                minResolution: { width: 640, height: 360 },
                maxResolution: { width: 1920, height: 1080 },
                minFrameRate: 1,
                maxFrameRate: 30,
                minBitRate: 100000,
                maxBitRate: 8000000,
                referenceCount: 1,
                ownedByServer: true,
            };
            const audioStream: AllocatedAudioStream & { ownedByServer: boolean } = {
                audioStreamId: 2,
                streamUsage: 3,
                audioCodec: 0,
                channelCount: 1,
                sampleRate: 48000,
                bitRate: 64000,
                bitDepth: 16,
                referenceCount: 0,
                ownedByServer: false,
            };
            const snapshotStream: AllocatedSnapshotStream & { ownedByServer: boolean } = {
                snapshotStreamId: 3,
                imageCodec: 0,
                minResolution: { width: 640, height: 480 },
                maxResolution: { width: 1920, height: 1080 },
                referenceCount: 0,
                ownedByServer: true,
            };
            const wire = toWireCapabilities({
                ...EMPTY_CAPABILITIES,
                allocated: { video: [videoStream], audio: [audioStream], snapshot: [snapshotStream] },
            });
            expect(wire.allocated.video[0]).to.deep.equal({
                video_stream_id: 1,
                stream_usage: "LiveView",
                video_codec: "H265",
                min_resolution: { width: 640, height: 360 },
                max_resolution: { width: 1920, height: 1080 },
                min_frame_rate: 1,
                max_frame_rate: 30,
                min_bit_rate: 100000,
                max_bit_rate: 8000000,
                reference_count: 1,
                owned_by_server: true,
            });
            expect(wire.allocated.audio[0]).to.deep.equal({
                audio_stream_id: 2,
                stream_usage: "LiveView",
                audio_codec: "OPUS",
                channel_count: 1,
                sample_rate: 48000,
                bit_rate: 64000,
                bit_depth: 16,
                reference_count: 0,
                owned_by_server: false,
            });
            expect(wire.allocated.snapshot[0]).to.deep.equal({
                snapshot_stream_id: 3,
                image_codec: "JPEG",
                min_resolution: { width: 640, height: 480 },
                max_resolution: { width: 1920, height: 1080 },
                reference_count: 0,
                owned_by_server: true,
            });
        });
    });

    describe("toWireStartStreamResult", () => {
        it("reports a video-only session with codec and envelope ranges", () => {
            const result: StartStreamResult = {
                webRtcSessionId: 9,
                mode: "provide_offer",
                video: {
                    streamId: 1,
                    reused: false,
                    allocatedByUs: true,
                    envelope: {
                        codec: 1,
                        minResolution: { width: 640, height: 360 },
                        maxResolution: { width: 1920, height: 1080 },
                        minFrameRate: 1,
                        maxFrameRate: 30,
                        minBitRate: 100000,
                        maxBitRate: 8000000,
                        keyFrameInterval: 2000,
                    },
                },
            };
            const wire = toWireStartStreamResult(result);
            expect(wire.webrtc_session_id).to.equal(9);
            expect(wire.mode).to.equal("provide_offer");
            expect(wire.audio).to.equal(null);
            expect(wire.video).to.deep.equal({
                stream_id: 1,
                codec: "H265",
                resolution: { min: { width: 640, height: 360 }, max: { width: 1920, height: 1080 } },
                frame_rate: { min: 1, max: 30 },
                bit_rate: { min: 100000, max: 8000000 },
                reused: false,
                allocated_by_server: true,
            });
        });

        it("reports a degraded stream and an audio track", () => {
            const result: StartStreamResult = {
                webRtcSessionId: 9,
                mode: "solicit_offer",
                video: {
                    streamId: 1,
                    reused: true,
                    degraded: true,
                    allocatedByUs: true,
                    envelope: {
                        codec: 1,
                        minResolution: { width: 640, height: 360 },
                        maxResolution: { width: 1280, height: 720 },
                        minFrameRate: 1,
                        maxFrameRate: 15,
                        minBitRate: 100000,
                        maxBitRate: 4000000,
                        keyFrameInterval: 2000,
                    },
                },
                audio: {
                    streamId: 2,
                    reused: false,
                    allocatedByUs: true,
                    envelope: { codec: 0, channelCount: 1, sampleRate: 48000, bitRate: 64000, bitDepth: 16 },
                },
            };
            const wire = toWireStartStreamResult(result);
            expect(wire.video?.degraded).to.equal(true);
            expect(wire.audio).to.deep.equal({
                stream_id: 2,
                codec: "OPUS",
                channel_count: 1,
                sample_rate: 48000,
                bit_rate: 64000,
                bit_depth: 16,
                reused: false,
                allocated_by_server: true,
            });
        });
    });

    describe("toWireSnapshotResult", () => {
        it("base64-encodes the image data and names the codec and size of the frame", () => {
            const result: SnapshotResult = {
                data: new Uint8Array([1, 2, 3]),
                imageCodec: 0,
                resolution: { width: 640, height: 480 },
                downgraded: true,
            };
            const wire = toWireSnapshotResult(result);
            expect(wire.data).to.equal(Buffer.from([1, 2, 3]).toString("base64"));
            expect(wire.codec).to.equal("JPEG");
            expect(wire.resolution).to.deep.equal({ width: 640, height: 480 });
            expect(wire.downgraded).to.equal(true);
        });

        it("names the stream the frame came from when that stream outlived the call", () => {
            const wire = toWireSnapshotResult({
                data: new Uint8Array([1]),
                imageCodec: 0,
                resolution: { width: 640, height: 480 },
                downgraded: false,
                snapshotStreamId: 8,
            });
            expect(wire.stream_id).to.equal(8);
        });

        it("omits the key rather than sending a null for a stream that was given back", () => {
            // The contract is the field's presence: a client testing `"stream_id" in response` must
            // not see a member for a stream that no longer exists.
            const wire = toWireSnapshotResult({
                data: new Uint8Array([1]),
                imageCodec: 0,
                resolution: { width: 640, height: 480 },
                downgraded: false,
                snapshotStreamId: undefined,
            });
            expect(Object.keys(wire)).to.not.include("stream_id");
        });
    });

    // Exercise the branded id constructors directly, since parseCameraTarget's own tests only assert
    // on the resulting plain number/bigint value.
    it("parseCameraTarget returns ids usable as NodeId/EndpointNumber", () => {
        const { nodeId, endpointId } = parseCameraTarget({ node_id: 5, endpoint_id: 1 });
        expect(nodeId).to.equal(NodeId(5));
        expect(endpointId).to.equal(EndpointNumber(1));
    });
});
