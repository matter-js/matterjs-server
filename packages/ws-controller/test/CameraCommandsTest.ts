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
            expect(wire.limits).to.not.have.property("max_network_bandwidth");
        });

        it("names every codec it reports, so the output can be sent back as a request", () => {
            const wire = toWireCapabilities({
                ...EMPTY_CAPABILITIES,
                video: {
                    ...EMPTY_CAPABILITIES.video,
                    codecs: [CameraAvStreamManagement.VideoCodec.Hevc],
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
            expect(wire.video.codecs).to.deep.equal(["H265"]);
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
        it("base64-encodes the image data and carries the stream identity through", () => {
            const result: SnapshotResult = {
                data: new Uint8Array([1, 2, 3]),
                imageCodec: 0,
                resolution: { width: 640, height: 480 },
                downgraded: true,
                streamId: 4,
                reused: false,
                allocatedByUs: true,
            };
            const wire = toWireSnapshotResult(result);
            expect(wire.data).to.equal(Buffer.from([1, 2, 3]).toString("base64"));
            expect(wire.codec).to.equal("JPEG");
            expect(wire.resolution).to.deep.equal({ width: 640, height: 480 });
            expect(wire.downgraded).to.equal(true);
            expect(wire.stream_id).to.equal(4);
            expect(wire.reused).to.equal(false);
            expect(wire.allocated_by_server).to.equal(true);
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
