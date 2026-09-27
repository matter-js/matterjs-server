/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { StreamUsage } from "@matter/main/types";
import type {
    AllocatedSnapshotStream,
    AllocatedVideoStream,
    AudioEnvelope,
    VideoEnvelope,
} from "../src/camera/cameraTypes.js";
import type { OverlayBounds } from "../src/camera/overlayPolicy.js";
import { parseSdpVideoConstraints, videoCodecLimits } from "../src/camera/sdpConstraints.js";
import {
    budgetVideoEnvelope,
    chooseEvictionVictim,
    computeAudioEnvelope,
    computeVideoEnvelope,
    findDegradedVideoStream,
    findReusableVideoStream,
    narrowEnvelope,
    satisfiesAudioCallerBounds,
    satisfiesVideoCallerBounds,
    videoCallerBounds,
} from "../src/camera/streamPolicy.js";
import type { AudioSelection, VideoEnvelopeArgs, VideoSelection } from "../src/camera/streamPolicy.js";
import { NO_OVERLAYS } from "./cameraFixtures.js";

/** `computeVideoEnvelope` with no overlay asked for, which is what most cases are about. */
function videoSelection(args: Omit<VideoEnvelopeArgs, "overlays"> & { overlays?: OverlayBounds }): VideoSelection {
    return computeVideoEnvelope({ overlays: {}, ...args });
}

/** The envelope a video selection carries, failing the test when the caller's bounds were unsatisfiable. */
function videoEnvelope(args: Omit<VideoEnvelopeArgs, "overlays"> & { overlays?: OverlayBounds }): VideoEnvelope {
    const selection = videoSelection(args);
    if ("unsatisfiable" in selection) {
        throw new Error(`unsatisfiable: ${selection.field} ${selection.requested} against ${selection.limit}`);
    }
    return selection.envelope;
}

/** The envelope a selection carries, failing the test when the selection was unsatisfiable instead. */
function audioEnvelope(selection: AudioSelection): AudioEnvelope | undefined {
    if ("unsatisfiable" in selection) throw new Error(`unsatisfiable on ${selection.unsatisfiable}`);
    return selection.envelope;
}

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

/**
 * A browser-shaped offer: both codecs in one m-line, each with its own frame-size cap, written in
 * the parameter and the unit its own payload format defines.
 */
const OFFER_H265_8160_H264_3600 = [
    "v=0",
    "o=- 1 1 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=video 9 UDP/TLS/RTP/SAVPF 100 102",
    "c=IN IP4 0.0.0.0",
    "a=recvonly",
    "a=rtpmap:100 H265/90000",
    "a=fmtp:100 max-lps=2088960",
    "a=rtpmap:102 H264/90000",
    "a=fmtp:102 max-fs=3600",
    "",
].join("\r\n");

/**
 * An offer that states its ceiling through the H.264 level alone, which is how a peer usually states
 * it: level 3.1 (`level_idc` 0x1f) is MaxFS 3600 macroblocks in H.264 Table A-1, so 1920x1080 is
 * past what this peer can decode.
 */
const OFFER_H264_LEVEL_3_1_ONLY = [
    "v=0",
    "o=- 1 1 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "m=video 9 UDP/TLS/RTP/SAVPF 102",
    "c=IN IP4 0.0.0.0",
    "a=recvonly",
    "a=rtpmap:102 H264/90000",
    "a=fmtp:102 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
    "",
].join("\r\n");

/** A receiving video section offering one codec, with `params` as its only `a=fmtp` line. */
function offerWithFmtp(codec: string, params: string): string {
    return [
        "v=0",
        "o=- 1 1 IN IP4 127.0.0.1",
        "s=-",
        "t=0 0",
        "m=video 9 UDP/TLS/RTP/SAVPF 102",
        "c=IN IP4 0.0.0.0",
        "a=recvonly",
        `a=rtpmap:102 ${codec}/90000`,
        `a=fmtp:102 ${params}`,
        "",
    ].join("\r\n");
}

describe("streamPolicy", () => {
    describe("computeVideoEnvelope", () => {
        it("narrows by the selected codec's own level cap, not by another codec's", () => {
            const sdp = parseSdpVideoConstraints(OFFER_H265_8160_H264_3600);
            const envelope = videoEnvelope({
                capabilities: CAPABILITIES,
                limits: videoCodecLimits(sdp, H265),
                hints: undefined,
            });
            const area = envelope.maxResolution.width * envelope.maxResolution.height;
            expect(area).to.be.at.most(8160 * 256);
            expect(area).to.be.above(3600 * 256);
        });

        it("applies the tighter cap when that is the codec selected", () => {
            const sdp = parseSdpVideoConstraints(OFFER_H265_8160_H264_3600);
            const envelope = videoEnvelope({
                capabilities: CAPABILITIES,
                limits: videoCodecLimits(sdp, H264),
                hints: undefined,
            });
            const area = envelope.maxResolution.width * envelope.maxResolution.height;
            expect(area).to.be.at.most(3600 * 256);
        });

        it("narrows by a level the offer states with no max-fs beside it", () => {
            // The camera offers H.264 at 1920x1080 and the peer states level 3.1 and nothing else.
            // Reading the level as no statement leaves that 1920x1080 envelope standing and hands
            // the peer a picture it cannot decode.
            const sdp = parseSdpVideoConstraints(OFFER_H264_LEVEL_3_1_ONLY);
            const envelope = videoEnvelope({
                capabilities: CAPABILITIES,
                limits: videoCodecLimits(sdp, H264),
                hints: undefined,
            });
            const area = envelope.maxResolution.width * envelope.maxResolution.height;
            expect(area).to.be.at.most(3600 * 256);
            expect(envelope.maxResolution).to.deep.equal({ width: 1280, height: 720 });
        });

        it("spends the peer's pixel-rate budget on frame size rather than allocating past it", () => {
            // Level 1 (level_idc 0x0a) with max-fs raised to 8160: RFC 6184 §8.1 lets a peer raise
            // one parameter without the other, so the frame size allows 1920x1080 while the level's
            // MaxMBPS allows 380160 pixels a second — under one frame per second there. Rounding the
            // rate up to 1 handed the peer 5.5x the pixel rate it stated it can decode.
            const sdp = parseSdpVideoConstraints(offerWithFmtp("H264", "profile-level-id=42e00a;max-fs=8160"));
            const limits = videoCodecLimits(sdp, H264);
            expect(limits.maxPixels).to.equal(8160 * 256);
            expect(limits.maxPixelsPerSecond).to.equal(1485 * 256);
            const envelope = videoEnvelope({ capabilities: CAPABILITIES, limits, hints: undefined });
            const area = envelope.maxResolution.width * envelope.maxResolution.height;
            // Both halves matter: the budget has to hold, and it has to hold at a rate an encoder
            // runs at, which is what spending it on frame size first buys.
            expect(envelope.maxFrameRate).to.be.at.least(1);
            expect(area * envelope.maxFrameRate).to.be.at.most(1485 * 256);
        });

        it("defaults to the widest envelope the camera reports", () => {
            const envelope = videoEnvelope({
                capabilities: CAPABILITIES,
                limits: { codec: H265 },
                hints: undefined,
            });
            expect(envelope.maxResolution).to.deep.equal({ width: 2560, height: 1440 });
            expect(envelope.minResolution).to.deep.equal({ width: 640, height: 360 });
            expect(envelope.minFrameRate).to.equal(1);
            expect(envelope.maxFrameRate).to.equal(30);
        });

        it("ignores a trade-off point that fits the ceiling by pixel count but not by dimension", () => {
            // 1440x1440 and 1920x1080 have the same pixel count, so an area test would take the square
            // point's minBitRate for a stream that can never be that tall.
            const square = {
                ...CAPABILITIES,
                sensor: { width: 1920, height: 1080 },
                rateDistortionPoints: [
                    { codec: H265, resolution: { width: 1440, height: 1440 }, minBitRate: 5000000 },
                    { codec: H265, resolution: { width: 1280, height: 720 }, minBitRate: 400000 },
                ],
            };
            const envelope = videoEnvelope({
                capabilities: square,
                limits: { codec: H265 },
                hints: undefined,
            });
            expect(envelope.minBitRate).to.equal(400000);
        });

        it("takes minBitRate from the trade-off point for the chosen codec", () => {
            expect(
                videoEnvelope({
                    capabilities: CAPABILITIES,
                    limits: { codec: H265 },
                    hints: undefined,
                }).minBitRate,
            ).to.equal(800000);
        });

        it("ignores another codec's trade-off point when it derives the bit-rate floor", () => {
            // A floor taken from H.264 on an H.265 allocation reserves bandwidth the stream does not
            // need, and spec 15.2.1.2.2 takes that from every other viewer on the camera.
            const mixed = {
                ...CAPABILITIES,
                rateDistortionPoints: [
                    { codec: H264, resolution: { width: 2560, height: 1440 }, minBitRate: 6000000 },
                    { codec: H265, resolution: { width: 1920, height: 1080 }, minBitRate: 800000 },
                ],
            };
            expect(
                videoEnvelope({
                    capabilities: mixed,
                    limits: { codec: H265 },
                    hints: undefined,
                }).minBitRate,
            ).to.equal(800000);
        });

        it("clamps a caller maxBitRate above the camera's network bandwidth to the camera's value", () => {
            const envelope = videoEnvelope({
                capabilities: CAPABILITIES,
                limits: { codec: H265 },
                hints: { maxBitRate: 50000000 },
            });
            expect(envelope.maxBitRate).to.equal(CAPABILITIES.maxNetworkBandwidth);
        });

        it("clamps a caller maxBitRate above the SDP's maxBitRate to the SDP's value", () => {
            const envelope = videoEnvelope({
                capabilities: CAPABILITIES,
                limits: { codec: H265, maxBitRate: 3000000 },
                hints: { maxBitRate: 50000000 },
            });
            expect(envelope.maxBitRate).to.equal(3000000);
        });

        it("fails a caller minBitRate above every stated ceiling instead of lowering it", () => {
            // Clamping the floor down reports success while delivering a stream the caller said was
            // too thin to be useful.
            expect(
                videoSelection({
                    capabilities: CAPABILITIES,
                    limits: { codec: H265 },
                    hints: { minBitRate: 50000000 },
                }),
            ).to.deep.equal({
                unsatisfiable: "bounds",
                field: "min_bit_rate",
                requested: "50000000",
                limit: "8000000",
            });
        });

        it("fails a caller minResolution the sensor cannot reach instead of lowering it", () => {
            expect(
                videoSelection({
                    capabilities: { ...CAPABILITIES, sensor: { width: 1280, height: 720 } },
                    limits: { codec: H265 },
                    hints: { minResolution: { width: 1920, height: 1080 } },
                }),
            ).to.deep.equal({
                unsatisfiable: "bounds",
                field: "min_resolution",
                requested: "1920x1080",
                limit: "1280x720",
            });
        });

        it("fails a caller minFrameRate above the sensor's maximum instead of lowering it", () => {
            expect(
                videoSelection({
                    capabilities: CAPABILITIES,
                    limits: { codec: H265 },
                    hints: { minFrameRate: 60 },
                }),
            ).to.deep.equal({
                unsatisfiable: "bounds",
                field: "min_frame_rate",
                requested: "60",
                limit: "30",
            });
        });

        it("fails a caller floor the caller's own ceiling excludes", () => {
            const selection = videoSelection({
                capabilities: CAPABILITIES,
                limits: { codec: H265 },
                hints: { minFrameRate: 25, maxFrameRate: 15 },
            });
            expect("unsatisfiable" in selection && selection.unsatisfiable).to.equal("bounds");
        });

        it("keeps the caller's ceiling out of the offer's pixel budget", () => {
            // A 4:3 sensor scaled to a 1920x1080 pixel budget lands on 4:3 dimensions narrower than
            // 1920, which would fail a 1080p floor the peer can in fact decode.
            const envelope = videoEnvelope({
                capabilities: { ...CAPABILITIES, sensor: { width: 2592, height: 1944 } },
                limits: { codec: H265, maxPixels: 1920 * 1080 },
                hints: { minResolution: { width: 1920, height: 1080 }, maxResolution: { width: 1920, height: 1080 } },
            });
            expect(envelope.maxResolution).to.deep.equal({ width: 1920, height: 1080 });
            expect(envelope.minResolution).to.deep.equal({ width: 1920, height: 1080 });
        });

        it("drops a trade-off floor the camera's own bandwidth cannot carry, instead of pinning min to max", () => {
            // Pinning min == max would take capacity from every other viewer (spec 15.2.1.2.2) to
            // honour a floor the caller never asked for.
            const envelope = videoEnvelope({
                capabilities: { ...CAPABILITIES, maxNetworkBandwidth: 500000 },
                limits: { codec: H265 },
                hints: undefined,
            });
            expect(envelope.maxBitRate).to.equal(500000);
            expect(envelope.minBitRate).to.equal(1);
        });

        it("keeps a caller floor the camera can reach", () => {
            const envelope = videoEnvelope({
                capabilities: CAPABILITIES,
                limits: { codec: H265 },
                hints: { minFrameRate: 15, minBitRate: 1000000, minResolution: { width: 1280, height: 720 } },
            });
            expect(envelope.minFrameRate).to.equal(15);
            expect(envelope.minBitRate).to.equal(1000000);
            expect(envelope.minResolution).to.deep.equal({ width: 1280, height: 720 });
        });

        it("still clamps a server-derived floor down to the ceiling", () => {
            // The viewport minimum is the camera's statement, not the caller's, so giving it up
            // gives up nothing anyone asked for.
            const envelope = videoEnvelope({
                capabilities: CAPABILITIES,
                limits: { codec: H265 },
                hints: { maxResolution: { width: 320, height: 180 } },
            });
            expect(envelope.minResolution).to.deep.equal({ width: 320, height: 180 });
        });

        it("falls back to the default maxBitRate when no ceiling is stated anywhere", () => {
            const envelope = videoEnvelope({
                capabilities: { ...CAPABILITIES, maxNetworkBandwidth: undefined },
                limits: { codec: H265 },
                hints: undefined,
            });
            expect(envelope.maxBitRate).to.equal(8000000);
        });

        it("does not cap a camera whose network bandwidth exceeds the default", () => {
            const envelope = videoEnvelope({
                capabilities: { ...CAPABILITIES, maxNetworkBandwidth: 20000000 },
                limits: { codec: H265 },
                hints: undefined,
            });
            expect(envelope.maxBitRate).to.equal(20000000);
        });

        it("uses the smallest advertised point as the floor when no viewport minimum is reported", () => {
            const envelope = videoEnvelope({
                capabilities: { ...CAPABILITIES, minViewport: undefined },
                limits: { codec: H265 },
                hints: undefined,
            });
            expect(envelope.minResolution).to.deep.equal({ width: 1280, height: 720 });
        });

        it("falls back to the maximum as the floor when the camera reports nothing smaller", () => {
            const envelope = videoEnvelope({
                capabilities: {
                    sensor: { width: 1920, height: 1080 },
                    maxFrameRate: 30,
                    minViewport: undefined,
                    rateDistortionPoints: [],
                    maxNetworkBandwidth: undefined,
                },
                limits: { codec: H264 },
                hints: undefined,
            });
            expect(envelope.minResolution).to.deep.equal({ width: 1920, height: 1080 });
            expect(envelope.maxResolution).to.deep.equal({ width: 1920, height: 1080 });
        });

        it("narrows the ceiling to the SDP's pixel cap", () => {
            const envelope = videoEnvelope({
                capabilities: CAPABILITIES,
                limits: { codec: H265, maxPixels: 1920 * 1080 },
                hints: undefined,
            });
            // 2560x1440 exceeds the cap; scaled down on the same aspect ratio.
            expect(envelope.maxResolution.width * envelope.maxResolution.height).to.be.at.most(1920 * 1080);
        });

        it("rounds a scaled resolution down to even dimensions", () => {
            const envelope = videoEnvelope({
                capabilities: CAPABILITIES,
                limits: { codec: H265, maxPixels: 1000000 },
                hints: undefined,
            });
            expect(envelope.maxResolution).to.deep.equal({ width: 1332, height: 750 });
        });

        it("narrows the frame rate to the SDP's pixel-rate cap", () => {
            const envelope = videoEnvelope({
                capabilities: CAPABILITIES,
                limits: { codec: H265, maxPixelsPerSecond: 2560 * 1440 * 10 },
                hints: undefined,
            });
            expect(envelope.maxFrameRate).to.equal(10);
        });

        it("clamps the floor to the ceiling when the SDP narrows below the viewport minimum", () => {
            const envelope = videoEnvelope({
                capabilities: CAPABILITIES,
                limits: { codec: H265, maxPixels: 320 * 180 },
                hints: undefined,
            });
            expect(envelope.maxResolution).to.deep.equal({ width: 320, height: 180 });
            expect(envelope.minResolution).to.deep.equal({ width: 320, height: 180 });
        });

        it("narrows to explicit caller hints", () => {
            const envelope = videoEnvelope({
                capabilities: CAPABILITIES,
                limits: { codec: H265 },
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

        it("fails a floor that exceeds the ceiling on one dimension while fitting it on pixel count", () => {
            // A 1440x1440 floor has fewer pixels than a 1920x1080 ceiling, so an area test finds
            // nothing wrong with it. Clamping it per dimension instead would return 1440x1080, which
            // is not the floor the caller asked for.
            expect(
                videoSelection({
                    capabilities: CAPABILITIES,
                    limits: { codec: H265 },
                    hints: {
                        minResolution: { width: 1440, height: 1440 },
                        maxResolution: { width: 1920, height: 1080 },
                    },
                }),
            ).to.deep.equal({
                unsatisfiable: "bounds",
                field: "min_resolution",
                requested: "1440x1440",
                limit: "1920x1080",
            });
        });

        it("clamps a caller ceiling that binds on one dimension only", () => {
            // 2560x1440 against a 3840x1080 ceiling: the area comparison keeps the sensor size whole
            // and leaves a height the caller ruled out.
            const envelope = videoEnvelope({
                capabilities: CAPABILITIES,
                limits: { codec: H265 },
                hints: { maxResolution: { width: 3840, height: 1080 } },
            });
            expect(envelope.maxResolution).to.deep.equal({ width: 2560, height: 1080 });
        });

        it("clamps the frame rate to the offer's own max-fr", () => {
            const envelope = videoEnvelope({
                capabilities: CAPABILITIES,
                limits: { codec: H265, maxFrameRate: 10 },
                hints: undefined,
            });
            expect(envelope.maxFrameRate).to.equal(10);
        });

        it("never widens past the camera's own bounds when a hint asks for more", () => {
            const envelope = videoEnvelope({
                capabilities: CAPABILITIES,
                limits: { codec: H265 },
                hints: { maxResolution: { width: 7680, height: 4320 }, maxFrameRate: 120 },
            });
            expect(envelope.maxResolution).to.deep.equal({ width: 2560, height: 1440 });
            expect(envelope.maxFrameRate).to.equal(30);
        });
    });

    describe("findReusableVideoStream", () => {
        const LIVE_VIEW_H265 = videoCallerBounds({ codec: H265 }, LIVE_VIEW, undefined);

        const REQUEST = {
            codec: H265,
            minResolution: { width: 1920, height: 1080 },
            maxResolution: { width: 1920, height: 1080 },
            minFrameRate: 1,
            maxFrameRate: 30,
            minBitRate: 800000,
            maxBitRate: 4000000,
            keyFrameInterval: 2000,
            overlays: {},
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
                minBitRate: number;
                maxBitRate: number;
                referenceCount: number;
                overlays: Required<OverlayBounds>;
            }> = {},
        ) {
            return {
                videoStreamId: 1,
                overlays: NO_OVERLAYS,
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
            expect(findReusableVideoStream([stream()], REQUEST, LIVE_VIEW_H265)?.videoStreamId).to.equal(1);
        });

        it("refuses a stream whose floor is below the requested floor", () => {
            // Issue #1056: [720p..1080p] may deliver 720p, so it does not satisfy a 1080p floor.
            const candidate = stream({ minResolution: { width: 1280, height: 720 } });
            expect(findReusableVideoStream([candidate], REQUEST, LIVE_VIEW_H265)).to.equal(undefined);
        });

        it("refuses a stream whose ceiling is above the requested ceiling", () => {
            const candidate = stream({ maxResolution: { width: 2560, height: 1440 } });
            expect(findReusableVideoStream([candidate], REQUEST, LIVE_VIEW_H265)).to.equal(undefined);
        });

        it("refuses a stream using a different codec", () => {
            expect(findReusableVideoStream([stream({ videoCodec: H264 })], REQUEST, LIVE_VIEW_H265)).to.equal(
                undefined,
            );
        });

        it("refuses a stream with a different usage", () => {
            expect(
                findReusableVideoStream([stream({ streamUsage: RECORDING_USAGE })], REQUEST, LIVE_VIEW_H265),
            ).to.equal(undefined);
        });

        it("refuses a stream whose bit-rate ceiling is above the one the caller stated", () => {
            // The caller's ceiling is what its link can carry. The envelope here is deliberately wide
            // enough to admit the stream, so the caller's own bound is the only thing refusing it.
            const wide = { ...REQUEST, maxBitRate: 8000000 };
            const bounds = videoCallerBounds({ codec: H265 }, LIVE_VIEW, { maxBitRate: 500000 });
            expect(findReusableVideoStream([stream({ maxBitRate: 8000000 })], wide, bounds)).to.equal(undefined);
        });

        it("refuses a stream below the bit-rate floor the caller stated", () => {
            const bounds = videoCallerBounds({ codec: H265 }, LIVE_VIEW, { minBitRate: 1000000 });
            expect(findReusableVideoStream([stream()], REQUEST, bounds)).to.equal(undefined);
        });

        it("refuses a stream outside the bit-rate range the server computed", () => {
            // Not a caller bound, so this stream is still available to the degraded rung — flagged.
            const request = { ...REQUEST, maxBitRate: 2000000 };
            expect(findReusableVideoStream([stream()], request, LIVE_VIEW_H265)).to.equal(undefined);
        });

        it("prefers a stream whose encoder is already running", () => {
            const idle = stream({ videoStreamId: 1, referenceCount: 0 });
            const running = stream({ videoStreamId: 2, referenceCount: 1 });
            expect(findReusableVideoStream([idle, running], REQUEST, LIVE_VIEW_H265)?.videoStreamId).to.equal(2);
        });

        it("refuses a stream whose frame-rate floor is below the requested floor", () => {
            const request = { ...REQUEST, minFrameRate: 15 };
            expect(findReusableVideoStream([stream({ minFrameRate: 1 })], request, LIVE_VIEW_H265)).to.equal(undefined);
        });

        it("refuses a stream whose overlays are not the ones the envelope asked for", () => {
            // The envelope carries what the server resolved, so the reuse rung requires it even where
            // the caller stated nothing: an unstated overlay resolves to false, not to "either will do".
            const watermarked = stream({ overlays: { watermarkEnabled: true, osdEnabled: false } });
            const asked = { ...REQUEST, overlays: { watermarkEnabled: false, osdEnabled: false } };
            expect(findReusableVideoStream([watermarked], asked, LIVE_VIEW_H265)).to.equal(undefined);
        });

        it("reuses a stream carrying exactly the overlays the envelope asked for", () => {
            const watermarked = stream({ overlays: { watermarkEnabled: true, osdEnabled: false } });
            const asked = { ...REQUEST, overlays: { watermarkEnabled: true, osdEnabled: false } };
            expect(findReusableVideoStream([watermarked], asked, LIVE_VIEW_H265)?.videoStreamId).to.equal(1);
        });

        it("refuses a stream with the same pixel count but a different aspect ratio", () => {
            // 1440x1440 has the same area as 1920x1080 (2,073,600px) but is square, not widescreen.
            const square = stream({
                minResolution: { width: 1440, height: 1440 },
                maxResolution: { width: 1440, height: 1440 },
            });
            expect(findReusableVideoStream([square], REQUEST, LIVE_VIEW_H265)).to.equal(undefined);
        });
    });

    describe("satisfiesVideoCallerBounds", () => {
        const STREAM = {
            videoStreamId: 4,
            overlays: NO_OVERLAYS,
            streamUsage: LIVE_VIEW,
            videoCodec: H265,
            minResolution: { width: 1280, height: 720 },
            maxResolution: { width: 2560, height: 1440 },
            minFrameRate: 1,
            maxFrameRate: 30,
            minBitRate: 800000,
            maxBitRate: 4000000,
            referenceCount: 1,
        };

        it("refuses a stream past the pixel budget the offer stated for the selected codec", () => {
            const bounds = videoCallerBounds({ codec: H265, maxPixels: 1280 * 720 }, LIVE_VIEW, undefined);
            expect(satisfiesVideoCallerBounds(STREAM, bounds)).to.equal(false);
        });

        it("refuses a stream past the frame rate the offer stated", () => {
            const bounds = videoCallerBounds({ codec: H265, maxFrameRate: 15 }, LIVE_VIEW, undefined);
            expect(satisfiesVideoCallerBounds(STREAM, bounds)).to.equal(false);
        });

        it("refuses a stream whose size leaves the offer's pixel rate no whole frame per second", () => {
            // 2560x1440 at the peer's 380160 pixels a second is 0.10 frames a second, and the stream
            // runs at 1. Rounding the ceiling up to 1 accepted it, which hands the peer ten times the
            // pixel rate it stated it can decode.
            const slowest = { ...STREAM, minFrameRate: 1, maxFrameRate: 1 };
            const bounds = videoCallerBounds({ codec: H265, maxPixelsPerSecond: 380160 }, LIVE_VIEW, undefined);
            expect(satisfiesVideoCallerBounds(slowest, bounds)).to.equal(false);
        });

        it("refuses a stream past the bit rate the offer stated", () => {
            const bounds = videoCallerBounds({ codec: H265, maxBitRate: 1000000 }, LIVE_VIEW, undefined);
            expect(satisfiesVideoCallerBounds(STREAM, bounds)).to.equal(false);
        });

        it("refuses a stream whose overlays differ from the ones the caller stated", () => {
            const watermarked = { ...STREAM, overlays: { watermarkEnabled: true, osdEnabled: false } };
            expect(
                satisfiesVideoCallerBounds(
                    watermarked,
                    videoCallerBounds({ codec: H265 }, LIVE_VIEW, { watermarkEnabled: false }),
                ),
            ).to.equal(false);
            expect(
                satisfiesVideoCallerBounds(STREAM, videoCallerBounds({ codec: H265 }, LIVE_VIEW, { osdEnabled: true })),
            ).to.equal(false);
        });

        it("accepts any overlays for a caller that stated none, which is the envelope's business", () => {
            const watermarked = { ...STREAM, overlays: { watermarkEnabled: true, osdEnabled: true } };
            expect(satisfiesVideoCallerBounds(watermarked, videoCallerBounds({ codec: H265 }, LIVE_VIEW, {}))).to.equal(
                true,
            );
        });

        it("accepts a stream inside every limit the offer stated", () => {
            const bounds = videoCallerBounds(
                { codec: H265, maxPixels: 2560 * 1440, maxFrameRate: 30, maxBitRate: 4000000 },
                LIVE_VIEW,
                undefined,
            );
            expect(satisfiesVideoCallerBounds(STREAM, bounds)).to.equal(true);
        });
    });

    describe("findDegradedVideoStream", () => {
        /** The bounds of a caller that stated nothing beyond the two arguments every caller states. */
        function bounds(hints?: Parameters<typeof videoCallerBounds>[2], codec = H265) {
            return videoCallerBounds({ codec }, LIVE_VIEW, hints);
        }

        const IN_USE_WIDE = {
            videoStreamId: 4,
            overlays: NO_OVERLAYS,
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
            expect(findDegradedVideoStream([IN_USE_WIDE], bounds())?.videoStreamId).to.equal(4);
        });

        it("refuses a stream below a floor the caller stated", () => {
            // The caller pinned 1080p, so [720p..1080p] may deliver less than asked — issue #1056.
            expect(
                findDegradedVideoStream(
                    [IN_USE_WIDE],
                    bounds({
                        minResolution: { width: 1920, height: 1080 },
                    }),
                ),
            ).to.equal(undefined);
        });

        it("refuses a stream whose width alone is below the floor the caller stated", () => {
            expect(
                findDegradedVideoStream(
                    [IN_USE_WIDE],
                    bounds({
                        minResolution: { width: 1400, height: 700 },
                    }),
                ),
            ).to.equal(undefined);
        });

        it("refuses a stream whose height alone is below the floor the caller stated", () => {
            expect(
                findDegradedVideoStream(
                    [IN_USE_WIDE],
                    bounds({
                        minResolution: { width: 1200, height: 900 },
                    }),
                ),
            ).to.equal(undefined);
        });

        it("refuses a stream above a ceiling the caller stated", () => {
            expect(
                findDegradedVideoStream(
                    [IN_USE_WIDE],
                    bounds({
                        maxResolution: { width: 1280, height: 720 },
                    }),
                ),
            ).to.equal(undefined);
        });

        it("refuses a stream whose width alone is above the ceiling the caller stated", () => {
            expect(
                findDegradedVideoStream(
                    [IN_USE_WIDE],
                    bounds({
                        maxResolution: { width: 1800, height: 1200 },
                    }),
                ),
            ).to.equal(undefined);
        });

        it("refuses a stream below a frame-rate floor the caller stated", () => {
            expect(findDegradedVideoStream([IN_USE_WIDE], bounds({ minFrameRate: 15 }))).to.equal(undefined);
        });

        it("refuses a stream above a frame-rate ceiling the caller stated", () => {
            expect(findDegradedVideoStream([IN_USE_WIDE], bounds({ maxFrameRate: 15 }))).to.equal(undefined);
        });

        it("refuses a stream using a different codec", () => {
            expect(findDegradedVideoStream([IN_USE_WIDE], bounds(undefined, H264))).to.equal(undefined);
        });

        it("refuses a stream below a bit-rate floor the caller stated", () => {
            expect(findDegradedVideoStream([IN_USE_WIDE], bounds({ minBitRate: 1000000 }))).to.equal(undefined);
        });

        it("refuses a stream above a bit-rate ceiling the caller stated", () => {
            // The caller's ceiling is what its link can carry; a 4 Mbit/s stream overruns it.
            expect(findDegradedVideoStream([IN_USE_WIDE], bounds({ maxBitRate: 2000000 }))).to.equal(undefined);
        });

        it("accepts a stream inside the bit-rate bounds the caller stated", () => {
            expect(
                findDegradedVideoStream([IN_USE_WIDE], bounds({ minBitRate: 500000, maxBitRate: 4000000 }))
                    ?.videoStreamId,
            ).to.equal(4);
        });

        it("refuses a stream whose usage is not the one the caller asked for", () => {
            // stream_usage is the only mandatory argument, so no rung may substitute it: a LiveView
            // caller handed a Recording stream got something it never asked for.
            const recording = { ...IN_USE_WIDE, streamUsage: RECORDING_USAGE };
            expect(findDegradedVideoStream([recording], bounds())).to.equal(undefined);
        });

        it("accepts a stream that matches pinned bounds exactly", () => {
            // Pinning leaves nothing for this rung to give up, so the one stream it can hand out is
            // the one that meets the pins — which is not a downgrade of anything the caller stated.
            const pinned = {
                ...IN_USE_WIDE,
                minResolution: { width: 1920, height: 1080 },
                maxResolution: { width: 1920, height: 1080 },
            };
            expect(
                findDegradedVideoStream(
                    [pinned],
                    bounds({
                        minResolution: { width: 1920, height: 1080 },
                        maxResolution: { width: 1920, height: 1080 },
                    }),
                )?.videoStreamId,
            ).to.equal(4);
        });

        it("prefers the most capable stream when several degraded candidates qualify", () => {
            const narrow = { ...IN_USE_WIDE, videoStreamId: 5, maxResolution: { width: 1280, height: 720 } };
            const wide = { ...IN_USE_WIDE, videoStreamId: 6, maxResolution: { width: 1920, height: 1080 } };
            expect(findDegradedVideoStream([narrow, wide], bounds())?.videoStreamId).to.equal(6);
        });

        it("refuses a stream with the same pixel count but a different aspect ratio than the pinned bounds", () => {
            // 1440x1440 has the same area as 1920x1080 (2,073,600px) but is square, not widescreen.
            const square = {
                ...IN_USE_WIDE,
                minResolution: { width: 1440, height: 1440 },
                maxResolution: { width: 1440, height: 1440 },
            };
            expect(
                findDegradedVideoStream(
                    [square],
                    bounds({
                        minResolution: { width: 1920, height: 1080 },
                        maxResolution: { width: 1920, height: 1080 },
                    }),
                ),
            ).to.equal(undefined);
        });
    });

    describe("budgetVideoEnvelope", () => {
        const SENSOR = {
            codec: H265,
            minResolution: { width: 640, height: 360 },
            maxResolution: { width: 2560, height: 1440 },
            minFrameRate: 1,
            maxFrameRate: 30,
            minBitRate: 800000,
            maxBitRate: 4000000,
            keyFrameInterval: 2000,
            overlays: {},
        };
        /** 2560x1440 at 30 fps, i.e. what the envelope above asks the camera to reserve. */
        const SENSOR_RATE = 2560 * 1440 * 30;

        const NO_STREAMS = {
            videoStreams: new Array<AllocatedVideoStream>(),
            snapshotStreams: new Array<AllocatedSnapshotStream>(),
        };

        function videoStream(id: number, width: number, height: number, maxFrameRate: number): AllocatedVideoStream {
            return {
                videoStreamId: id,
                overlays: NO_OVERLAYS,
                streamUsage: LIVE_VIEW,
                videoCodec: H265,
                minResolution: { width, height },
                maxResolution: { width, height },
                minFrameRate: 1,
                maxFrameRate,
                minBitRate: 800000,
                maxBitRate: 4000000,
                referenceCount: 0,
            };
        }

        function snapshotStream(
            width: number,
            height: number,
            frameRate: number,
            encodedPixels: boolean,
        ): AllocatedSnapshotStream {
            return {
                snapshotStreamId: 1,
                overlays: NO_OVERLAYS,
                imageCodec: 0,
                minResolution: { width, height },
                maxResolution: { width, height },
                referenceCount: 0,
                frameRate,
                encodedPixels,
                hardwareEncoder: false,
            };
        }

        it("leaves the envelope alone when the camera states no budget", () => {
            expect(budgetVideoEnvelope(SENSOR, { maxEncodedPixelRate: undefined, ...NO_STREAMS })).to.deep.equal(
                SENSOR,
            );
        });

        it("leaves the envelope alone when the budget carries it", () => {
            expect(budgetVideoEnvelope(SENSOR, { maxEncodedPixelRate: SENSOR_RATE, ...NO_STREAMS })).to.deep.equal(
                SENSOR,
            );
        });

        it("narrows the frame rate to what the budget carries at full frame size", () => {
            const budgeted = budgetVideoEnvelope(SENSOR, { maxEncodedPixelRate: SENSOR_RATE / 2, ...NO_STREAMS });
            expect(budgeted.maxResolution).to.deep.equal({ width: 2560, height: 1440 });
            expect(budgeted.maxFrameRate).to.equal(15);
        });

        it("narrows the frame size once not even one frame per second fits", () => {
            // Half a sensor frame, so the frame size is what has to give before any rate does.
            const budgeted = budgetVideoEnvelope(SENSOR, {
                maxEncodedPixelRate: (2560 * 1440) / 2,
                ...NO_STREAMS,
            });
            expect(budgeted.maxResolution).to.deep.equal({ width: 1810, height: 1018 });
            expect(budgeted.maxFrameRate).to.equal(1);
        });

        it("subtracts what the camera's other video streams reserve", () => {
            // One 1280x720 at 30 fps stream reserves a quarter of the sensor's rate, leaving three.
            const budgeted = budgetVideoEnvelope(SENSOR, {
                maxEncodedPixelRate: SENSOR_RATE,
                videoStreams: [videoStream(7, 1280, 720, 30)],
                snapshotStreams: new Array<AllocatedSnapshotStream>(),
            });
            expect(budgeted.maxFrameRate).to.equal(22);
        });

        it("subtracts a snapshot stream the camera counts in its encoded pixel rate", () => {
            const budgeted = budgetVideoEnvelope(SENSOR, {
                maxEncodedPixelRate: SENSOR_RATE,
                videoStreams: new Array<AllocatedVideoStream>(),
                snapshotStreams: [snapshotStream(2560, 1440, 15, true)],
            });
            expect(budgeted.maxFrameRate).to.equal(15);
        });

        it("ignores a snapshot stream the camera does not count in it", () => {
            // EncodedPixels false means the stream draws nothing from that budget (§11.2.6.13.8).
            const budgeted = budgetVideoEnvelope(SENSOR, {
                maxEncodedPixelRate: SENSOR_RATE,
                videoStreams: new Array<AllocatedVideoStream>(),
                snapshotStreams: [snapshotStream(2560, 1440, 15, false)],
            });
            expect(budgeted.maxFrameRate).to.equal(30);
        });

        it("narrows nothing once the budget is spent, leaving the refusal to the camera", () => {
            const budgeted = budgetVideoEnvelope(SENSOR, {
                maxEncodedPixelRate: SENSOR_RATE,
                videoStreams: [videoStream(7, 2560, 1440, 30)],
                snapshotStreams: new Array<AllocatedSnapshotStream>(),
            });
            expect(budgeted).to.deep.equal(SENSOR);
        });

        it("never narrows a ceiling below the envelope's own floor", () => {
            // The floors carry whatever the caller stated, so this is what keeps a stated bound from
            // being quietly shrunk into the budget.
            const pinned = {
                ...SENSOR,
                minResolution: { width: 2560, height: 1440 },
                minFrameRate: 30,
            };
            const budgeted = budgetVideoEnvelope(pinned, { maxEncodedPixelRate: 1000, ...NO_STREAMS });
            expect(budgeted.maxResolution).to.deep.equal({ width: 2560, height: 1440 });
            expect(budgeted.maxFrameRate).to.equal(30);
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
            overlays: {},
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

        it("moves to the frame rate rather than reporting a resolution ceiling it did not lower", () => {
            // The even-dimension floor can leave the halved ceiling where it already was. Returning
            // it unchanged would spend a ladder round on an identical request; the contract is that
            // each call gives something up or reports exhaustion.
            const degenerate = {
                ...WIDE,
                minResolution: { width: 1, height: 2 },
                maxResolution: { width: 2, height: 2 },
            };
            const narrowed = narrowEnvelope(degenerate);
            expect(narrowed?.maxResolution).to.deep.equal({ width: 2, height: 2 });
            expect(narrowed?.maxFrameRate).to.equal(15);
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

    describe("satisfiesAudioCallerBounds", () => {
        const LIVE_VIEW_AUDIO = {
            audioStreamId: 4,
            streamUsage: LIVE_VIEW,
            audioCodec: 0,
            channelCount: 1,
            sampleRate: 48000,
            bitRate: 64000,
            bitDepth: 16,
            referenceCount: 1,
        };

        it("accepts a stream carrying the usage the caller asked for", () => {
            expect(satisfiesAudioCallerBounds(LIVE_VIEW_AUDIO, { streamUsage: LIVE_VIEW })).to.equal(true);
        });

        it("refuses a stream whose usage is not the one the caller asked for", () => {
            // stream_usage is the only mandatory argument of camera_start_stream, so the audio rung
            // may no more substitute it than the video one: a LiveView caller handed the microphone
            // track of a Recording session got something it never asked for.
            const recording = { ...LIVE_VIEW_AUDIO, streamUsage: RECORDING_USAGE };
            expect(satisfiesAudioCallerBounds(recording, { streamUsage: LIVE_VIEW })).to.equal(false);
        });
    });

    describe("chooseEvictionVictim", () => {
        const ANALYSIS_USAGE = 2;
        /** The camera's own ranking: LiveView highest, then Recording, then Analysis. */
        const PRIORITIES = [LIVE_VIEW, RECORDING_USAGE, ANALYSIS_USAGE];

        function idle(id: number, streamUsage: number): AllocatedVideoStream {
            return {
                videoStreamId: id,
                overlays: NO_OVERLAYS,
                streamUsage,
                videoCodec: H265,
                minResolution: { width: 1280, height: 720 },
                maxResolution: { width: 1280, height: 720 },
                minFrameRate: 1,
                maxFrameRate: 30,
                minBitRate: 400000,
                maxBitRate: 4000000,
                referenceCount: 0,
            };
        }

        const oursBy =
            (...ids: number[]) =>
            (stream: AllocatedVideoStream) =>
                ids.includes(stream.videoStreamId);

        it("takes a stream of its own before a foreign one the camera ranks lower", () => {
            // The camera ranks Analysis below Recording, so ranking alone would destroy the foreign
            // stream. StreamUsagePriorities is the camera's guidance for its own arbitration and says
            // nothing about which controller should pay for a request.
            const ours = idle(30, RECORDING_USAGE);
            const foreign = idle(31, ANALYSIS_USAGE);
            expect(chooseEvictionVictim([ours, foreign], PRIORITIES, oursBy(30))?.videoStreamId).to.equal(30);
            expect(chooseEvictionVictim([foreign, ours], PRIORITIES, oursBy(30))?.videoStreamId).to.equal(30);
        });

        it("ranks by the camera's priorities among its own streams", () => {
            const high = idle(30, RECORDING_USAGE);
            const low = idle(31, ANALYSIS_USAGE);
            expect(chooseEvictionVictim([high, low], PRIORITIES, oursBy(30, 31))?.videoStreamId).to.equal(31);
        });

        it("ranks by the camera's priorities among foreign streams once it holds none of its own", () => {
            const high = idle(30, RECORDING_USAGE);
            const low = idle(31, ANALYSIS_USAGE);
            expect(chooseEvictionVictim([high, low], PRIORITIES, oursBy())?.videoStreamId).to.equal(31);
        });

        it("takes a usage the camera does not rank last of its own, ahead of no foreign stream", () => {
            const unranked = idle(30, 9);
            const foreign = idle(31, ANALYSIS_USAGE);
            expect(chooseEvictionVictim([unranked, foreign], PRIORITIES, oursBy(30))?.videoStreamId).to.equal(30);
            expect(chooseEvictionVictim([unranked, foreign], PRIORITIES, oursBy(31))?.videoStreamId).to.equal(31);
        });

        it("never takes a referenced stream or an Internal one, whoever allocated it", () => {
            const referenced = { ...idle(30, RECORDING_USAGE), referenceCount: 1 };
            const internal = idle(31, StreamUsage.Internal);
            expect(chooseEvictionVictim([referenced, internal], PRIORITIES, oursBy(30, 31))).to.equal(undefined);
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
        };

        it("picks the camera's codec when the caller offers no SDP", () => {
            const envelope = audioEnvelope(
                computeAudioEnvelope({
                    capabilities: AUDIO_CAPABILITIES,
                    sdp: undefined,
                    hints: undefined,
                }),
            );
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
                        video: { state: "absent" as const },
                        audio: { state: "receiving" as const, codecs: ["OPUS"] },
                        wantsTalkback: false,
                        limitsByCodec: new Map(),
                        unreadableCeilingCodecs: new Set<string>(),
                    },
                    hints: undefined,
                }),
            ).to.deep.equal({ envelope: undefined });
        });

        it("keeps the camera's codecs when an offered audio section states none", () => {
            // A section carrying only statically-mapped payload types states nothing about what the
            // peer decodes. Filtering by that empty statement drops every codec the camera has, and a
            // caller that asked for audio is then refused for a codec mismatch that was never stated.
            const envelope = audioEnvelope(
                computeAudioEnvelope({
                    capabilities: { ...AUDIO_CAPABILITIES, supportedCodecs: [OPUS, AAC] },
                    sdp: {
                        video: { state: "absent" as const },
                        audio: { state: "receiving" as const },
                        wantsTalkback: false,
                        limitsByCodec: new Map(),
                        unreadableCeilingCodecs: new Set<string>(),
                    },
                    hints: undefined,
                }),
            );
            expect(envelope?.codec).to.equal(OPUS);
        });

        it("narrows to a caller codec preference", () => {
            const envelope = audioEnvelope(
                computeAudioEnvelope({
                    capabilities: { ...AUDIO_CAPABILITIES, supportedCodecs: [OPUS, AAC] },
                    sdp: undefined,
                    hints: { codecs: ["AAC"] },
                }),
            );
            expect(envelope?.codec).to.equal(AAC);
        });

        it("describes no envelope when the caller's codec preference leaves the camera nothing", () => {
            // Whether that is a failure or a video-only session is the manager's to decide: it knows
            // whether the caller asked for audio at all, and this function does not.
            expect(
                computeAudioEnvelope({
                    capabilities: AUDIO_CAPABILITIES,
                    sdp: undefined,
                    hints: { codecs: ["AAC"] },
                }),
            ).to.deep.equal({ envelope: undefined });
        });

        it("describes no envelope for a hint codec name the device has no matching number for", () => {
            expect(
                computeAudioEnvelope({
                    capabilities: { ...AUDIO_CAPABILITIES, supportedCodecs: [OPUS, AAC] },
                    sdp: undefined,
                    hints: { codecs: ["UNKNOWN_CODEC"] },
                }),
            ).to.deep.equal({ envelope: undefined });
        });

        it("reports nothing, without failing, when the offer shares no codec with the camera", () => {
            // The offer states what the peer can decode; with no codec stated by the caller, an
            // audio-less session drops nothing the caller asked for.
            expect(
                computeAudioEnvelope({
                    capabilities: AUDIO_CAPABILITIES,
                    sdp: {
                        video: { state: "absent" as const },
                        audio: { state: "receiving" as const, codecs: ["AAC"] },
                        wantsTalkback: false,
                        limitsByCodec: new Map(),
                        unreadableCeilingCodecs: new Set<string>(),
                    },
                    hints: undefined,
                }),
            ).to.deep.equal({ envelope: undefined });
        });

        it("reports a sample rate the camera cannot serve ahead of a codec the offer ruled out", () => {
            // Both are unmet. Naming the codec would send the caller after its offer when the value
            // it can actually change is the sample rate.
            expect(
                computeAudioEnvelope({
                    capabilities: AUDIO_CAPABILITIES,
                    sdp: {
                        video: { state: "absent" as const },
                        audio: { state: "receiving" as const, codecs: ["AAC"] },
                        wantsTalkback: false,
                        limitsByCodec: new Map(),
                        unreadableCeilingCodecs: new Set<string>(),
                    },
                    hints: { codecs: ["OPUS"], sampleRate: 44100 },
                }),
            ).to.deep.equal({
                unsatisfiable: "bounds",
                field: "sample_rate",
                requested: "44100",
                limit: "48000, 16000",
            });
        });

        it("does not filter by codec on an SDP audio m-line marked absent", () => {
            const envelope = audioEnvelope(
                computeAudioEnvelope({
                    capabilities: AUDIO_CAPABILITIES,
                    sdp: {
                        video: { state: "receiving" as const },
                        audio: { state: "absent" as const },
                        wantsTalkback: false,
                        limitsByCodec: new Map(),
                        unreadableCeilingCodecs: new Set<string>(),
                    },
                    hints: undefined,
                }),
            );
            expect(envelope?.codec).to.equal(OPUS);
        });

        it("fails a channel count above what the camera states, rather than clamping it", () => {
            // Clamping reports success while delivering mono to a caller that asked for 8 channels.
            expect(
                computeAudioEnvelope({
                    capabilities: AUDIO_CAPABILITIES,
                    sdp: undefined,
                    hints: { channelCount: 8 },
                }),
            ).to.deep.equal({ unsatisfiable: "bounds", field: "channel_count", requested: "8", limit: "2" });
        });

        it("uses a channel count the camera can serve", () => {
            const envelope = audioEnvelope(
                computeAudioEnvelope({
                    capabilities: AUDIO_CAPABILITIES,
                    sdp: undefined,
                    hints: { channelCount: 1 },
                }),
            );
            expect(envelope?.channelCount).to.equal(1);
        });

        it("uses a requested sample rate the camera supports", () => {
            const envelope = audioEnvelope(
                computeAudioEnvelope({
                    capabilities: AUDIO_CAPABILITIES,
                    sdp: undefined,
                    hints: { sampleRate: 16000 },
                }),
            );
            expect(envelope?.sampleRate).to.equal(16000);
        });

        it("fails a sample rate the camera does not list, rather than substituting its own", () => {
            expect(
                computeAudioEnvelope({
                    capabilities: AUDIO_CAPABILITIES,
                    sdp: undefined,
                    hints: { sampleRate: 44100 },
                }),
            ).to.deep.equal({
                unsatisfiable: "bounds",
                field: "sample_rate",
                requested: "44100",
                limit: "48000, 16000",
            });
        });

        it("keeps the caller's bit rate rather than the default", () => {
            const envelope = audioEnvelope(
                computeAudioEnvelope({
                    capabilities: AUDIO_CAPABILITIES,
                    sdp: undefined,
                    hints: { bitRate: 32000 },
                }),
            );
            expect(envelope?.bitRate).to.equal(32000);
        });
    });
});
