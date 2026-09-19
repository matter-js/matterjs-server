/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    computeAudioEnvelope,
    computeVideoEnvelope,
    findDegradedVideoStream,
    findReusableVideoStream,
    narrowEnvelope,
} from "../src/camera/streamPolicy.js";

/** H.264 = 0, H.265 = 1 in VideoCodecEnum. */
const H264 = 0;
const H265 = 1;

const LIVE_VIEW = 3;
const RECORDING_USAGE = 1;

const CAPABILITIES = {
    sensor: { width: 2560, height: 1440 },
    maxFrameRate: 30,
    minViewport: { width: 640, height: 360 },
    rateDistortionPoints: [
        { codec: H265, resolution: { width: 1920, height: 1080 }, minBitRate: 800000 },
        { codec: H265, resolution: { width: 1280, height: 720 }, minBitRate: 400000 },
        { codec: H264, resolution: { width: 1920, height: 1080 }, minBitRate: 2000000 },
    ],
    maxNetworkBandwidth: 8000000,
};

describe("streamPolicy", () => {
    describe("computeVideoEnvelope", () => {
        it("defaults to the widest envelope the camera reports", () => {
            const envelope = computeVideoEnvelope({
                capabilities: CAPABILITIES,
                codec: H265,
                sdp: undefined,
                hints: undefined,
            });
            expect(envelope.maxResolution).to.deep.equal({ width: 2560, height: 1440 });
            expect(envelope.minResolution).to.deep.equal({ width: 640, height: 360 });
            expect(envelope.minFrameRate).to.equal(1);
            expect(envelope.maxFrameRate).to.equal(30);
        });

        it("takes minBitRate from the trade-off point for the chosen codec", () => {
            expect(
                computeVideoEnvelope({
                    capabilities: CAPABILITIES,
                    codec: H265,
                    sdp: undefined,
                    hints: undefined,
                }).minBitRate,
            ).to.equal(800000);
        });

        it("clamps a caller maxBitRate above the camera's network bandwidth to the camera's value", () => {
            const envelope = computeVideoEnvelope({
                capabilities: CAPABILITIES,
                codec: H265,
                sdp: undefined,
                hints: { maxBitRate: 50000000 },
            });
            expect(envelope.maxBitRate).to.equal(CAPABILITIES.maxNetworkBandwidth);
        });

        it("clamps a caller maxBitRate above the SDP's maxBitRate to the SDP's value", () => {
            const envelope = computeVideoEnvelope({
                capabilities: CAPABILITIES,
                codec: H265,
                sdp: {
                    codecs: ["H265"],
                    audioCodecs: [],
                    hasVideo: true,
                    hasAudio: false,
                    wantsTalkback: false,
                    maxBitRate: 3000000,
                },
                hints: { maxBitRate: 50000000 },
            });
            expect(envelope.maxBitRate).to.equal(3000000);
        });

        it("clamps a caller minBitRate above every stated ceiling down to the ceiling, without raising it", () => {
            const envelope = computeVideoEnvelope({
                capabilities: CAPABILITIES,
                codec: H265,
                sdp: undefined,
                hints: { minBitRate: 50000000 },
            });
            expect(envelope.maxBitRate).to.equal(CAPABILITIES.maxNetworkBandwidth);
            expect(envelope.minBitRate).to.equal(CAPABILITIES.maxNetworkBandwidth);
        });

        it("falls back to the default maxBitRate when no ceiling is stated anywhere", () => {
            const envelope = computeVideoEnvelope({
                capabilities: { ...CAPABILITIES, maxNetworkBandwidth: undefined },
                codec: H265,
                sdp: undefined,
                hints: undefined,
            });
            expect(envelope.maxBitRate).to.equal(8000000);
        });

        it("does not cap a camera whose network bandwidth exceeds the default", () => {
            const envelope = computeVideoEnvelope({
                capabilities: { ...CAPABILITIES, maxNetworkBandwidth: 20000000 },
                codec: H265,
                sdp: undefined,
                hints: undefined,
            });
            expect(envelope.maxBitRate).to.equal(20000000);
        });

        it("uses the smallest advertised point as the floor when no viewport minimum is reported", () => {
            const envelope = computeVideoEnvelope({
                capabilities: { ...CAPABILITIES, minViewport: undefined },
                codec: H265,
                sdp: undefined,
                hints: undefined,
            });
            expect(envelope.minResolution).to.deep.equal({ width: 1280, height: 720 });
        });

        it("falls back to the maximum as the floor when the camera reports nothing smaller", () => {
            const envelope = computeVideoEnvelope({
                capabilities: {
                    sensor: { width: 1920, height: 1080 },
                    maxFrameRate: 30,
                    minViewport: undefined,
                    rateDistortionPoints: [],
                    maxNetworkBandwidth: undefined,
                },
                codec: H264,
                sdp: undefined,
                hints: undefined,
            });
            expect(envelope.minResolution).to.deep.equal({ width: 1920, height: 1080 });
            expect(envelope.maxResolution).to.deep.equal({ width: 1920, height: 1080 });
        });

        it("narrows the ceiling to the SDP's pixel cap", () => {
            const envelope = computeVideoEnvelope({
                capabilities: CAPABILITIES,
                codec: H265,
                sdp: {
                    codecs: ["H265"],
                    audioCodecs: [],
                    hasVideo: true,
                    hasAudio: false,
                    wantsTalkback: false,
                    maxPixels: 1920 * 1080,
                },
                hints: undefined,
            });
            // 2560x1440 exceeds the cap; scaled down on the same aspect ratio.
            expect(envelope.maxResolution.width * envelope.maxResolution.height).to.be.at.most(1920 * 1080);
        });

        it("rounds a scaled resolution down to even dimensions", () => {
            const envelope = computeVideoEnvelope({
                capabilities: CAPABILITIES,
                codec: H265,
                sdp: {
                    codecs: ["H265"],
                    audioCodecs: [],
                    hasVideo: true,
                    hasAudio: false,
                    wantsTalkback: false,
                    maxPixels: 1000000,
                },
                hints: undefined,
            });
            expect(envelope.maxResolution).to.deep.equal({ width: 1332, height: 750 });
        });

        it("narrows the frame rate to the SDP's pixel-rate cap", () => {
            const envelope = computeVideoEnvelope({
                capabilities: CAPABILITIES,
                codec: H265,
                sdp: {
                    codecs: ["H265"],
                    audioCodecs: [],
                    hasVideo: true,
                    hasAudio: false,
                    wantsTalkback: false,
                    maxPixelsPerSecond: 2560 * 1440 * 10,
                },
                hints: undefined,
            });
            expect(envelope.maxFrameRate).to.equal(10);
        });

        it("clamps the floor to the ceiling when the SDP narrows below the viewport minimum", () => {
            const envelope = computeVideoEnvelope({
                capabilities: CAPABILITIES,
                codec: H265,
                sdp: {
                    codecs: ["H265"],
                    audioCodecs: [],
                    hasVideo: true,
                    hasAudio: false,
                    wantsTalkback: false,
                    maxPixels: 320 * 180,
                },
                hints: undefined,
            });
            expect(envelope.maxResolution).to.deep.equal({ width: 320, height: 180 });
            expect(envelope.minResolution).to.deep.equal({ width: 320, height: 180 });
        });

        it("narrows to explicit caller hints", () => {
            const envelope = computeVideoEnvelope({
                capabilities: CAPABILITIES,
                codec: H265,
                sdp: undefined,
                hints: {
                    minResolution: { width: 1280, height: 720 },
                    maxResolution: { width: 1920, height: 1080 },
                    maxFrameRate: 15,
                },
            });
            expect(envelope.minResolution).to.deep.equal({ width: 1280, height: 720 });
            expect(envelope.maxResolution).to.deep.equal({ width: 1920, height: 1080 });
            expect(envelope.maxFrameRate).to.equal(15);
        });

        it("never widens past the camera's own bounds when a hint asks for more", () => {
            const envelope = computeVideoEnvelope({
                capabilities: CAPABILITIES,
                codec: H265,
                sdp: undefined,
                hints: { maxResolution: { width: 7680, height: 4320 }, maxFrameRate: 120 },
            });
            expect(envelope.maxResolution).to.deep.equal({ width: 2560, height: 1440 });
            expect(envelope.maxFrameRate).to.equal(30);
        });
    });

    describe("findReusableVideoStream", () => {
        const REQUEST = {
            codec: H265,
            minResolution: { width: 1920, height: 1080 },
            maxResolution: { width: 1920, height: 1080 },
            minFrameRate: 1,
            maxFrameRate: 30,
            minBitRate: 800000,
            maxBitRate: 4000000,
            keyFrameInterval: 2000,
        };

        function stream(
            overrides: Partial<{
                videoStreamId: number;
                streamUsage: number;
                videoCodec: number;
                minResolution: { width: number; height: number };
                maxResolution: { width: number; height: number };
                minFrameRate: number;
                maxFrameRate: number;
                referenceCount: number;
            }> = {},
        ) {
            return {
                videoStreamId: 1,
                streamUsage: LIVE_VIEW,
                videoCodec: H265,
                minResolution: { width: 1920, height: 1080 },
                maxResolution: { width: 1920, height: 1080 },
                minFrameRate: 1,
                maxFrameRate: 30,
                minBitRate: 800000,
                maxBitRate: 4000000,
                referenceCount: 0,
                ...overrides,
            };
        }

        it("reuses a stream whose envelope sits inside the request", () => {
            expect(findReusableVideoStream([stream()], REQUEST, LIVE_VIEW)?.videoStreamId).to.equal(1);
        });

        it("refuses a stream whose floor is below the requested floor", () => {
            // Issue #1056: [720p..1080p] may deliver 720p, so it does not satisfy a 1080p floor.
            const candidate = stream({ minResolution: { width: 1280, height: 720 } });
            expect(findReusableVideoStream([candidate], REQUEST, LIVE_VIEW)).to.equal(undefined);
        });

        it("refuses a stream whose ceiling is above the requested ceiling", () => {
            const candidate = stream({ maxResolution: { width: 2560, height: 1440 } });
            expect(findReusableVideoStream([candidate], REQUEST, LIVE_VIEW)).to.equal(undefined);
        });

        it("refuses a stream using a different codec", () => {
            expect(findReusableVideoStream([stream({ videoCodec: H264 })], REQUEST, LIVE_VIEW)).to.equal(undefined);
        });

        it("refuses a stream with a different usage by default", () => {
            expect(findReusableVideoStream([stream({ streamUsage: RECORDING_USAGE })], REQUEST, LIVE_VIEW)).to.equal(
                undefined,
            );
        });

        it("accepts a different usage when the caller relaxes the requirement", () => {
            const candidate = stream({ streamUsage: RECORDING_USAGE });
            expect(
                findReusableVideoStream([candidate], REQUEST, LIVE_VIEW, { ignoreStreamUsage: true })?.videoStreamId,
            ).to.equal(1);
        });

        it("prefers a stream whose encoder is already running", () => {
            const idle = stream({ videoStreamId: 1, referenceCount: 0 });
            const running = stream({ videoStreamId: 2, referenceCount: 1 });
            expect(findReusableVideoStream([idle, running], REQUEST, LIVE_VIEW)?.videoStreamId).to.equal(2);
        });

        it("refuses a stream whose frame-rate floor is below the requested floor", () => {
            const request = { ...REQUEST, minFrameRate: 15 };
            expect(findReusableVideoStream([stream({ minFrameRate: 1 })], request, LIVE_VIEW)).to.equal(undefined);
        });

        it("refuses a stream with the same pixel count but a different aspect ratio", () => {
            // 1440x1440 has the same area as 1920x1080 (2,073,600px) but is square, not widescreen.
            const square = stream({
                minResolution: { width: 1440, height: 1440 },
                maxResolution: { width: 1440, height: 1440 },
            });
            expect(findReusableVideoStream([square], REQUEST, LIVE_VIEW)).to.equal(undefined);
        });
    });

    describe("findDegradedVideoStream", () => {
        const IN_USE_WIDE = {
            videoStreamId: 4,
            streamUsage: LIVE_VIEW,
            videoCodec: H265,
            minResolution: { width: 1280, height: 720 },
            maxResolution: { width: 1920, height: 1080 },
            minFrameRate: 1,
            maxFrameRate: 30,
            minBitRate: 800000,
            maxBitRate: 4000000,
            referenceCount: 1,
        };

        it("hands out a wider in-use stream when the caller stated no bounds", () => {
            expect(findDegradedVideoStream([IN_USE_WIDE], H265, {})?.videoStreamId).to.equal(4);
        });

        it("refuses a stream below a floor the caller stated", () => {
            // The caller pinned 1080p, so [720p..1080p] may deliver less than asked — issue #1056.
            expect(
                findDegradedVideoStream([IN_USE_WIDE], H265, {
                    minResolution: { width: 1920, height: 1080 },
                }),
            ).to.equal(undefined);
        });

        it("refuses a stream above a ceiling the caller stated", () => {
            expect(
                findDegradedVideoStream([IN_USE_WIDE], H265, {
                    maxResolution: { width: 1280, height: 720 },
                }),
            ).to.equal(undefined);
        });

        it("refuses a stream below a frame-rate floor the caller stated", () => {
            expect(findDegradedVideoStream([IN_USE_WIDE], H265, { minFrameRate: 15 })).to.equal(undefined);
        });

        it("refuses a stream above a frame-rate ceiling the caller stated", () => {
            expect(findDegradedVideoStream([IN_USE_WIDE], H265, { maxFrameRate: 15 })).to.equal(undefined);
        });

        it("refuses a stream using a different codec", () => {
            expect(findDegradedVideoStream([IN_USE_WIDE], H264, {})).to.equal(undefined);
        });

        it("ignores stream usage, because this rung runs only when nothing else fits", () => {
            const recording = { ...IN_USE_WIDE, streamUsage: RECORDING_USAGE };
            expect(findDegradedVideoStream([recording], H265, {})?.videoStreamId).to.equal(4);
        });

        it("prefers the most capable stream when several degraded candidates qualify", () => {
            const narrow = { ...IN_USE_WIDE, videoStreamId: 5, maxResolution: { width: 1280, height: 720 } };
            const wide = { ...IN_USE_WIDE, videoStreamId: 6, maxResolution: { width: 1920, height: 1080 } };
            expect(findDegradedVideoStream([narrow, wide], H265, {})?.videoStreamId).to.equal(6);
        });

        it("refuses a stream with the same pixel count but a different aspect ratio than the pinned bounds", () => {
            // 1440x1440 has the same area as 1920x1080 (2,073,600px) but is square, not widescreen.
            const square = {
                ...IN_USE_WIDE,
                minResolution: { width: 1440, height: 1440 },
                maxResolution: { width: 1440, height: 1440 },
            };
            expect(
                findDegradedVideoStream([square], H265, {
                    minResolution: { width: 1920, height: 1080 },
                    maxResolution: { width: 1920, height: 1080 },
                }),
            ).to.equal(undefined);
        });
    });

    describe("narrowEnvelope", () => {
        const WIDE = {
            codec: H265,
            minResolution: { width: 640, height: 360 },
            maxResolution: { width: 2560, height: 1440 },
            minFrameRate: 1,
            maxFrameRate: 30,
            minBitRate: 800000,
            maxBitRate: 4000000,
            keyFrameInterval: 2000,
        };

        it("halves the resolution ceiling first, in even dimensions", () => {
            const narrowed = narrowEnvelope(WIDE);
            expect(narrowed?.maxResolution).to.deep.equal({ width: 1280, height: 720 });
            expect(narrowed?.maxFrameRate).to.equal(30);
        });

        it("halves the frame rate once the resolution floor is reached", () => {
            const atFloor = { ...WIDE, maxResolution: { width: 640, height: 360 } };
            const narrowed = narrowEnvelope(atFloor);
            expect(narrowed?.maxResolution).to.deep.equal({ width: 640, height: 360 });
            expect(narrowed?.maxFrameRate).to.equal(15);
        });

        it("reports no further narrowing once resolution and frame rate are both at the floor", () => {
            const exhausted = { ...WIDE, maxResolution: { width: 640, height: 360 }, maxFrameRate: 1 };
            expect(narrowEnvelope(exhausted)).to.equal(undefined);
        });

        it("clamps a halved resolution to the floor rather than overshooting", () => {
            const nearFloor = {
                ...WIDE,
                minResolution: { width: 960, height: 540 },
                maxResolution: { width: 1280, height: 720 },
            };
            const narrowed = narrowEnvelope(nearFloor);
            expect(narrowed?.maxResolution).to.deep.equal({ width: 960, height: 540 });
        });
    });

    describe("computeAudioEnvelope", () => {
        /** AudioCodecEnum: Opus = 0, AAC-LC = 1. */
        const OPUS = 0;
        const AAC = 1;

        const AUDIO_CAPABILITIES = {
            supportedCodecs: [OPUS],
            maxNumberOfChannels: 2,
            supportedSampleRates: [48000, 16000],
            supportedBitDepths: [16],
            twoWayTalkSupport: 0,
        };

        it("picks the camera's codec when the caller offers no SDP", () => {
            const envelope = computeAudioEnvelope({
                capabilities: AUDIO_CAPABILITIES,
                sdp: undefined,
                hints: undefined,
                wantsTalkback: false,
            });
            expect(envelope?.codec).to.equal(OPUS);
            expect(envelope?.sampleRate).to.equal(48000);
            expect(envelope?.channelCount).to.equal(2);
            expect(envelope?.bitDepth).to.equal(16);
        });

        it("reports nothing when no codec suits both sides", () => {
            expect(
                computeAudioEnvelope({
                    capabilities: { ...AUDIO_CAPABILITIES, supportedCodecs: [AAC] },
                    sdp: {
                        codecs: [],
                        audioCodecs: ["OPUS"],
                        hasVideo: false,
                        hasAudio: true,
                        wantsTalkback: false,
                    },
                    hints: undefined,
                    wantsTalkback: false,
                }),
            ).to.equal(undefined);
        });

        it("narrows to a caller codec preference", () => {
            const envelope = computeAudioEnvelope({
                capabilities: { ...AUDIO_CAPABILITIES, supportedCodecs: [OPUS, AAC] },
                sdp: undefined,
                hints: { codecs: ["AAC"] },
                wantsTalkback: false,
            });
            expect(envelope?.codec).to.equal(AAC);
        });

        it("reports nothing when the caller's codec preference is not one the camera supports", () => {
            expect(
                computeAudioEnvelope({
                    capabilities: AUDIO_CAPABILITIES,
                    sdp: undefined,
                    hints: { codecs: ["AAC"] },
                    wantsTalkback: false,
                }),
            ).to.equal(undefined);
        });

        it("ignores a hint codec name the device does not report a matching number for", () => {
            const envelope = computeAudioEnvelope({
                capabilities: { ...AUDIO_CAPABILITIES, supportedCodecs: [OPUS, AAC] },
                sdp: undefined,
                hints: { codecs: ["UNKNOWN_CODEC"] },
                wantsTalkback: false,
            });
            expect(envelope).to.equal(undefined);
        });

        it("does not filter by codec on an SDP audio m-line marked absent", () => {
            const envelope = computeAudioEnvelope({
                capabilities: AUDIO_CAPABILITIES,
                sdp: {
                    codecs: [],
                    audioCodecs: ["AAC"],
                    hasVideo: true,
                    hasAudio: false,
                    wantsTalkback: false,
                },
                hints: undefined,
                wantsTalkback: false,
            });
            expect(envelope?.codec).to.equal(OPUS);
        });

        it("never exceeds the camera's channel count", () => {
            const envelope = computeAudioEnvelope({
                capabilities: AUDIO_CAPABILITIES,
                sdp: undefined,
                hints: { channelCount: 8 },
                wantsTalkback: false,
            });
            expect(envelope?.channelCount).to.equal(2);
        });

        it("uses a requested sample rate the camera supports", () => {
            const envelope = computeAudioEnvelope({
                capabilities: AUDIO_CAPABILITIES,
                sdp: undefined,
                hints: { sampleRate: 16000 },
                wantsTalkback: false,
            });
            expect(envelope?.sampleRate).to.equal(16000);
        });

        it("ignores a sample rate the camera does not support", () => {
            const envelope = computeAudioEnvelope({
                capabilities: AUDIO_CAPABILITIES,
                sdp: undefined,
                hints: { sampleRate: 44100 },
                wantsTalkback: false,
            });
            expect(envelope?.sampleRate).to.equal(48000);
        });

        it("still produces a receive-only envelope when talkback is asked of a camera without it", () => {
            const envelope = computeAudioEnvelope({
                capabilities: AUDIO_CAPABILITIES,
                sdp: undefined,
                hints: undefined,
                wantsTalkback: true,
            });
            expect(envelope?.codec).to.equal(OPUS);
        });
    });
});
