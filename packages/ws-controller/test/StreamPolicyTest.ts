/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { computeVideoEnvelope } from "../src/camera/streamPolicy.js";

/** H.264 = 0, H.265 = 1 in VideoCodecEnum. */
const H264 = 0;
const H265 = 1;

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
});
