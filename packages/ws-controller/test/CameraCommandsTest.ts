/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { EndpointNumber, NodeId } from "@matter/main";
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
import type {
    AllocatedAudioStream,
    AllocatedSnapshotStream,
    CameraCapabilities,
    SnapshotResult,
    StartStreamResult,
} from "../src/camera/CameraStreamManager.js";
import type { AllocatedVideoStream } from "../src/camera/streamPolicy.js";
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

        it("passes sdp, ice and metadata fields through unchanged", () => {
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
            expect(parsed.iceServers).to.deep.equal([{ urls: "stun:example.com" }]);
            expect(parsed.iceTransportPolicy).to.equal("relay");
            expect(parsed.metadataEnabled).to.equal(true);
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
    });

    describe("parseSnapshotArgs", () => {
        it("parses an optional max_resolution and codec", () => {
            const parsed = parseSnapshotArgs({
                node_id: 5,
                endpoint_id: 1,
                max_resolution: { width: 640, height: 480 },
                codec: 0,
            });
            expect(parsed.maxResolution).to.deep.equal({ width: 640, height: 480 });
            expect(parsed.codec).to.equal(0);
        });

        it("leaves max_resolution and codec undefined when omitted", () => {
            const parsed = parseSnapshotArgs({ node_id: 5, endpoint_id: 1 });
            expect(parsed.maxResolution).to.equal(undefined);
            expect(parsed.codec).to.equal(undefined);
        });

        it("rejects a negative codec", () => {
            let thrown: unknown;
            try {
                parseSnapshotArgs({ node_id: 5, endpoint_id: 1, codec: -1 });
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
    });

    describe("toWireCapabilities", () => {
        const EMPTY_CAPABILITIES: CameraCapabilities = {
            video: { rateDistortionPoints: [], codecs: [] },
            audio: { codecs: [], sampleRates: [], bitDepths: [] },
            snapshot: { capabilities: [] },
            limits: { supportedStreamUsages: [], streamUsagePriorities: [] },
            allocated: { video: [], audio: [], snapshot: [] },
        };

        it("emits snake_case keys and omits absent capabilities", () => {
            const wire = toWireCapabilities(EMPTY_CAPABILITIES);
            expect(wire.video).to.not.have.property("sensor");
            expect(wire.video).to.have.property("rate_distortion_points");
            expect(wire.limits).to.have.property("supported_stream_usages");
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
                resolution: { width: 640, height: 480 },
                referenceCount: 0,
                ownedByServer: true,
            };
            const wire = toWireCapabilities({
                ...EMPTY_CAPABILITIES,
                allocated: { video: [videoStream], audio: [audioStream], snapshot: [snapshotStream] },
            });
            expect(wire.allocated.video[0]).to.deep.equal({
                video_stream_id: 1,
                stream_usage: 3,
                video_codec: 1,
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
                stream_usage: 3,
                audio_codec: 0,
                channel_count: 1,
                sample_rate: 48000,
                bit_rate: 64000,
                bit_depth: 16,
                reference_count: 0,
                owned_by_server: false,
            });
            expect(wire.allocated.snapshot[0]).to.deep.equal({
                snapshot_stream_id: 3,
                image_codec: 0,
                resolution: { width: 640, height: 480 },
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
                codec: 1,
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
                codec: 0,
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
        it("base64-encodes the image data", () => {
            const result: SnapshotResult = {
                data: new Uint8Array([1, 2, 3]),
                imageCodec: 0,
                resolution: { width: 640, height: 480 },
                downgraded: true,
            };
            const wire = toWireSnapshotResult(result);
            expect(wire.data).to.equal(Buffer.from([1, 2, 3]).toString("base64"));
            expect(wire.codec).to.equal(0);
            expect(wire.resolution).to.deep.equal({ width: 640, height: 480 });
            expect(wire.downgraded).to.equal(true);
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
