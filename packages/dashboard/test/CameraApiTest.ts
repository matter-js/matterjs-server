/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    CAMERA_NOT_SUPPORTED_ERROR_CODE,
    CAMERA_PRIVACY_MODE_ERROR_CODE,
    CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE,
    CAMERA_STREAM_IN_USE_ERROR_CODE,
    CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE,
    type CameraStartStreamResult,
    type CameraStartStreamVideoResult,
    ServerCommandError,
} from "@matter-server/ws-client";
import { sanitizeAnswerSdp } from "../src/components/webrtc-stream-view.js";
import {
    buildSnapshotOverlays,
    buildVideoRequest,
    cameraErrorText,
    isAudioOnlyCamera,
    parseResolutionOption,
    resolutionOption,
    snapshotMimeType,
    snapshotResolutionOptions,
    streamQualityBadges,
    streamsToRelease,
    videoResolutionOptions,
} from "../src/util/camera-api.js";
import { capabilities } from "./CameraFixtures.js";

function video(overrides: Partial<CameraStartStreamVideoResult> = {}): CameraStartStreamVideoResult {
    return {
        stream_id: 1,
        codec: "H264",
        resolution: { min: { width: 640, height: 480 }, max: { width: 1280, height: 720 } },
        frame_rate: { min: 15, max: 30 },
        bit_rate: { min: 10000, max: 2000000 },
        provenance: "allocated",
        degraded: false,
        watermark_enabled: false,
        osd_enabled: false,
        ...overrides,
    };
}

const AUDIO_RESULT = {
    stream_id: 2,
    codec: "OPUS",
    channel_count: 1,
    sample_rate: 48000,
    bit_rate: 20000,
    bit_depth: 16,
} as const;

function serverError(code: number, details: object): ServerCommandError {
    return new ServerCommandError(JSON.stringify(details), code);
}

const CHOICES = { maxResolution: null, watermarkEnabled: true, osdEnabled: false };

describe("camera API helpers", () => {
    describe("resolution pickers", () => {
        it("lists common sizes from the minimum viewport up to the sensor, largest first", () => {
            const caps = capabilities({
                video: {
                    sensor: { width: 1920, height: 1080 },
                    min_viewport: { width: 640, height: 480 },
                    rate_distortion_points: [
                        { codec: "H264", resolution: { width: 640, height: 480 }, min_bit_rate: 10000 },
                    ],
                    codecs: ["H264"],
                },
            });
            expect(videoResolutionOptions(caps)).to.deep.equal([
                { width: 1920, height: 1080 },
                { width: 1280, height: 720 },
                { width: 640, height: 480 },
            ]);
        });

        it("starts at the smallest common size when the camera states no minimum viewport", () => {
            const caps = capabilities({
                video: { sensor: { width: 1280, height: 720 }, rate_distortion_points: [], codecs: ["H264"] },
            });
            expect(videoResolutionOptions(caps)).to.deep.equal([
                { width: 1280, height: 720 },
                { width: 640, height: 480 },
                { width: 640, height: 360 },
            ]);
        });

        it("offers only Auto for video when the camera states no sensor size", () => {
            const caps = capabilities({
                video: {
                    min_viewport: { width: 640, height: 480 },
                    rate_distortion_points: [
                        { codec: "H264", resolution: { width: 1920, height: 1080 }, min_bit_rate: 1 },
                    ],
                    codecs: ["H264"],
                },
            });
            expect(videoResolutionOptions(caps)).to.deep.equal([]);
        });

        it("lists every snapshot capability the Aqara G350 reports", () => {
            const cap = {
                max_frame_rate: 30,
                image_codec: "JPEG",
                requires_encoded_pixels: false,
                requires_hardware_encoder: false,
            };
            const caps = capabilities({
                snapshot: {
                    capabilities: [
                        { ...cap, resolution: { width: 640, height: 480 } },
                        {
                            ...cap,
                            resolution: { width: 1920, height: 1080 },
                            requires_encoded_pixels: true,
                            requires_hardware_encoder: true,
                        },
                    ],
                },
            });
            expect(snapshotResolutionOptions(caps)).to.deep.equal([
                { width: 1920, height: 1080 },
                { width: 640, height: 480 },
            ]);
        });

        it("lists snapshot capability resolutions", () => {
            const cap = {
                max_frame_rate: 1,
                image_codec: "JPEG",
                requires_encoded_pixels: false,
                requires_hardware_encoder: false,
            };
            const caps = capabilities({
                snapshot: {
                    capabilities: [
                        { ...cap, resolution: { width: 640, height: 360 } },
                        { ...cap, resolution: { width: 3840, height: 2160 } },
                    ],
                },
            });
            expect(snapshotResolutionOptions(caps)).to.deep.equal([
                { width: 3840, height: 2160 },
                { width: 640, height: 360 },
            ]);
        });

        it("offers nothing without capabilities", () => {
            expect(videoResolutionOptions(null)).to.deep.equal([]);
            expect(snapshotResolutionOptions(null)).to.deep.equal([]);
        });

        it("round-trips a picker value and reads anything else as Auto", () => {
            expect(parseResolutionOption(resolutionOption({ width: 1280, height: 720 }))).to.deep.equal({
                width: 1280,
                height: 720,
            });
            expect(resolutionOption(null)).to.equal("auto");
            expect(parseResolutionOption("auto")).to.equal(null);
            expect(parseResolutionOption("1280x")).to.equal(null);
        });
    });

    describe("isAudioOnlyCamera", () => {
        it("is true when the reported features lack Video", () => {
            expect(isAudioOnlyCamera(capabilities({ features: ["Audio"] }))).to.equal(true);
        });

        it("is false while the features are not reported", () => {
            expect(isAudioOnlyCamera(capabilities({ features: undefined }))).to.equal(false);
            expect(isAudioOnlyCamera(null)).to.equal(false);
        });

        it("is false for a video camera", () => {
            expect(isAudioOnlyCamera(capabilities())).to.equal(false);
        });
    });

    describe("buildVideoRequest", () => {
        it("declines video on an audio-only camera", () => {
            expect(buildVideoRequest(capabilities({ features: ["Audio"] }), CHOICES)).to.equal(false);
        });

        it("demands video for Auto on a camera that reports Video", () => {
            expect(buildVideoRequest(capabilities(), CHOICES)).to.deep.equal({});
        });

        it("sends the picked resolution as max_resolution", () => {
            const hints = buildVideoRequest(capabilities(), {
                ...CHOICES,
                maxResolution: { width: 1280, height: 720 },
            });
            expect(hints).to.deep.equal({ max_resolution: { width: 1280, height: 720 } });
        });

        it("states watermark and OSD only on a camera advertising them, false included", () => {
            const caps = capabilities({ features: ["Video", "Watermark", "OnScreenDisplay"] });
            expect(buildVideoRequest(caps, CHOICES)).to.deep.equal({ watermark_enabled: true, osd_enabled: false });
        });

        it("leaves video to the server while the features are not reported", () => {
            expect(buildVideoRequest(capabilities({ features: undefined }), CHOICES)).to.equal(undefined);
        });

        it("leaves video to the server when the capabilities could not be read", () => {
            expect(buildVideoRequest(null, CHOICES)).to.equal(undefined);
        });

        it("still sends a picked resolution while the features are not reported", () => {
            const choices = { ...CHOICES, maxResolution: { width: 640, height: 480 } };
            expect(buildVideoRequest(capabilities({ features: undefined }), choices)).to.deep.equal({
                max_resolution: { width: 640, height: 480 },
            });
        });
    });

    describe("buildSnapshotOverlays", () => {
        it("states only the advertised overlays", () => {
            expect(buildSnapshotOverlays(capabilities({ features: ["Snapshot", "Watermark"] }), CHOICES)).to.deep.equal(
                {
                    watermark_enabled: true,
                },
            );
            expect(
                buildSnapshotOverlays(capabilities({ features: ["Snapshot", "OnScreenDisplay"] }), CHOICES),
            ).to.deep.equal({ osd_enabled: false });
            expect(buildSnapshotOverlays(null, CHOICES)).to.deep.equal({});
        });
    });

    describe("streamsToRelease", () => {
        it("names only streams this session allocated", () => {
            const result: CameraStartStreamResult = {
                webrtc_session_id: 3,
                mode: "provide_offer",
                video: video({ provenance: "allocated", stream_id: 5 }),
                audio: { ...AUDIO_RESULT, provenance: "allocated", stream_id: 6 },
            };
            expect(streamsToRelease(result)).to.deep.equal([
                { kind: "video", stream_id: 5 },
                { kind: "audio", stream_id: 6 },
            ]);
        });

        it("never names reused or adopted streams", () => {
            const result: CameraStartStreamResult = {
                webrtc_session_id: 3,
                mode: "provide_offer",
                video: video({ provenance: "adopted" }),
                audio: { ...AUDIO_RESULT, provenance: "reused" },
            };
            expect(streamsToRelease(result)).to.deep.equal([]);
            expect(streamsToRelease({ ...result, video: null, audio: null })).to.deep.equal([]);
        });
    });

    it("maps snapshot codecs to MIME types", () => {
        expect(snapshotMimeType("JPEG")).to.equal("image/jpeg");
        expect(snapshotMimeType("heic")).to.equal("image/heic");
    });

    describe("streamQualityBadges", () => {
        it("shows nothing for a stream in range or no video", () => {
            expect(streamQualityBadges(video())).to.deep.equal([]);
            expect(streamQualityBadges(null)).to.deep.equal([]);
        });

        it("flags a degraded stream", () => {
            const badges = streamQualityBadges(video({ degraded: true }));
            expect(badges.map(b => b.label)).to.deep.equal(["Degraded"]);
            expect(badges[0].detail).to.contain("1280×720");
        });

        it("names each ceiling the encoder budget lowered", () => {
            const badges = streamQualityBadges(
                video({
                    narrowed_by_encoder_budget: { max_resolution: { width: 1920, height: 1080 }, max_frame_rate: 60 },
                }),
            );
            expect(badges.map(b => b.label)).to.deep.equal(["Narrowed"]);
            expect(badges[0].detail).to.contain("resolution 1920×1080 → 1280×720");
            expect(badges[0].detail).to.contain("frame rate 60 → 30 fps");
        });

        it("names only the frame rate when only it was lowered", () => {
            const [badge] = streamQualityBadges(video({ narrowed_by_encoder_budget: { max_frame_rate: 60 } }));
            expect(badge.detail).to.not.contain("resolution");
        });
    });

    describe("cameraErrorText", () => {
        const facts = { device: [], requested: [] };

        it("names the missing feature", () => {
            const err = serverError(CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE, {
                message: "Camera does not advertise the feature this request needs",
                reason: "feature",
                feature: "Watermark",
                ...facts,
            });
            expect(cameraErrorText(err)).to.equal(
                "Camera does not advertise the feature this request needs: Watermark",
            );
        });

        it("names the bound the server ruled out", () => {
            const err = serverError(CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE, {
                message: "Camera cannot serve the requested stream parameters",
                reason: "bounds",
                bound: { field: "min_resolution", requested: "3840x2160", limit: "1920x1080" },
                ...facts,
            });
            expect(cameraErrorText(err)).to.equal(
                "Camera cannot serve the requested stream parameters: min_resolution 3840x2160 exceeds 1920x1080",
            );
        });

        it("uses the message alone for bounds without a named bound and for no_media", () => {
            const bounds = serverError(CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE, {
                message: "bounds text",
                reason: "bounds",
                ...facts,
            });
            const noMedia = serverError(CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE, {
                message: "no media text",
                reason: "no_media",
                ...facts,
            });
            expect(cameraErrorText(bounds)).to.equal("bounds text");
            expect(cameraErrorText(noMedia)).to.equal("no media text");
        });

        it("names the track for track-scoped reasons", () => {
            const withTrack = serverError(CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE, {
                message: "codec text",
                reason: "codec",
                track: "video",
                ...facts,
            });
            const withoutTrack = serverError(CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE, {
                message: "codec text",
                reason: "codec",
                ...facts,
            });
            expect(cameraErrorText(withTrack)).to.equal("codec text (video)");
            expect(cameraErrorText(withoutTrack)).to.equal("codec text");
        });

        it("names the privacy switches in plain words", () => {
            const err = serverError(CAMERA_PRIVACY_MODE_ERROR_CODE, {
                message: "Camera privacy mode is enabled",
                modes: ["hard_mode_on", "soft_livestream_mode_enabled"],
                device_status: 0x87,
            });
            expect(cameraErrorText(err)).to.equal(
                "Camera privacy mode is enabled: hardware privacy switch, live stream privacy mode",
            );
            const none = serverError(CAMERA_PRIVACY_MODE_ERROR_CODE, {
                message: "privacy",
                modes: [],
                device_status: 1,
            });
            expect(cameraErrorText(none)).to.equal("privacy");
        });

        it("suggests freeing capacity on resource exhaustion", () => {
            const err = serverError(CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE, {
                message: "Camera has no capacity for this stream",
                allocated: [],
            });
            expect(cameraErrorText(err)).to.equal(
                "Camera has no capacity for this stream; end other sessions or release streams",
            );
        });

        it("names the stream still in use", () => {
            const err = serverError(CAMERA_STREAM_IN_USE_ERROR_CODE, { message: "in use", stream_id: 3 });
            expect(cameraErrorText(err)).to.equal("in use (stream 3)");
        });

        it("names the missing clusters in hex", () => {
            const err = serverError(CAMERA_NOT_SUPPORTED_ERROR_CODE, {
                message: "no camera",
                missing_clusters: [0x553],
            });
            expect(cameraErrorText(err)).to.equal("no camera: missing 0x0553");
            const none = serverError(CAMERA_NOT_SUPPORTED_ERROR_CODE, { message: "no camera", missing_clusters: [] });
            expect(cameraErrorText(none)).to.equal("no camera");
        });

        it("shows the server's message text, not JSON, when a camera code's details are partial", () => {
            const noClusters = serverError(CAMERA_NOT_SUPPORTED_ERROR_CODE, { message: "no camera" });
            expect(cameraErrorText(noClusters)).to.equal("no camera");
            const noModes = serverError(CAMERA_PRIVACY_MODE_ERROR_CODE, { message: "privacy", device_status: 1 });
            expect(cameraErrorText(noModes)).to.equal("privacy");
        });

        it("names the error code when invalid details carry no message text", () => {
            expect(cameraErrorText(serverError(CAMERA_PRIVACY_MODE_ERROR_CODE, { modes: 1 }))).to.equal(
                "Camera privacy mode is enabled",
            );
            expect(cameraErrorText(serverError(CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE, { message: 5 }))).to.equal(
                "Camera cannot serve the requested stream",
            );
            expect(cameraErrorText(serverError(CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE, {}))).to.equal(
                "Camera has no capacity for this stream",
            );
            expect(cameraErrorText(serverError(CAMERA_STREAM_IN_USE_ERROR_CODE, []))).to.equal(
                "Stream is still in use",
            );
            expect(cameraErrorText(serverError(CAMERA_NOT_SUPPORTED_ERROR_CODE, { message: null }))).to.equal(
                "Endpoint does not support camera streaming",
            );
            expect(cameraErrorText(serverError(8, { reason: "x" }))).to.equal("Server error 8");
        });

        it("keeps a plain-text message under a camera code", () => {
            expect(cameraErrorText(new ServerCommandError("device offline", CAMERA_STREAM_IN_USE_ERROR_CODE))).to.equal(
                "device offline",
            );
        });

        it("falls back to the message for other codes and errors", () => {
            expect(cameraErrorText(new ServerCommandError("bad argument", 8))).to.equal("bad argument");
            expect(cameraErrorText(new Error("boom"))).to.equal("boom");
            expect(cameraErrorText("text")).to.equal("text");
        });
    });

    it("coerces sendrecv to sendonly inside media sections only (characterization)", () => {
        const sdp = ["v=0", "a=sendrecv", "m=audio 9 UDP/TLS/RTP/SAVPF 111", "a=sendrecv"].join("\r\n");
        expect(sanitizeAnswerSdp(sdp).split("\r\n")).to.deep.equal([
            "v=0",
            "a=sendrecv",
            "m=audio 9 UDP/TLS/RTP/SAVPF 111",
            "a=sendonly",
        ]);
    });
});
