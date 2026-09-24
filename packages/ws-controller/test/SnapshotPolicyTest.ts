/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SnapshotCapability, SnapshotSelection } from "../src/camera/snapshotPolicy.js";
import {
    encodersExhausted,
    findAdoptableSnapshotStream,
    selectSnapshotCapabilities,
    usesHardwareEncoder,
} from "../src/camera/snapshotPolicy.js";

/** The ordered candidates, failing the test when the selection was unsatisfiable instead. */
function chosen(selection: SnapshotSelection): SnapshotCapability[] {
    if ("unsatisfiable" in selection) throw new Error(`unsatisfiable on ${selection.unsatisfiable}`);
    return selection.capabilities;
}

/** Aqara G350, verified from live attributes: entry 0 is encoder-free, entry 1 needs the encoder. */
const G350 = [
    {
        resolution: { width: 640, height: 480 },
        maxFrameRate: 1,
        imageCodec: 0,
        requiresEncodedPixels: false,
        requiresHardwareEncoder: false,
    },
    {
        resolution: { width: 1920, height: 1080 },
        maxFrameRate: 1,
        imageCodec: 0,
        requiresEncodedPixels: true,
        requiresHardwareEncoder: true,
    },
];

describe("snapshotPolicy", () => {
    describe("usesHardwareEncoder", () => {
        it("reports an encoder user only when both flags are set", () => {
            expect(usesHardwareEncoder(G350[1])).to.equal(true);
        });

        it("ignores requiresHardwareEncoder when requiresEncodedPixels is false", () => {
            // §11.2.6.9.5: "This field is only considered if RequiresEncodedPixels is true." The
            // reference server never reads the flag otherwise, so neither may we.
            const unencoded = { ...G350[0], requiresHardwareEncoder: true };
            expect(usesHardwareEncoder(unencoded)).to.equal(false);
        });

        it("reports no encoder use for an encoded capability the device serves without one", () => {
            const softwareEncoded = { ...G350[1], requiresHardwareEncoder: false };
            expect(usesHardwareEncoder(softwareEncoded)).to.equal(false);
        });
    });

    describe("encodersExhausted", () => {
        const LIVE_VIDEO = {
            videoStreamId: 1,
            streamUsage: 3,
            videoCodec: 1,
            minResolution: { width: 1920, height: 1080 },
            maxResolution: { width: 1920, height: 1080 },
            minFrameRate: 1,
            maxFrameRate: 30,
            minBitRate: 800000,
            maxBitRate: 4000000,
            referenceCount: 1,
        };

        /** A snapshot stream the camera states uses one of its hardware encoders (§11.2.6.13.9). */
        const ENCODING_SNAPSHOT = {
            snapshotStreamId: 8,
            imageCodec: 0,
            minResolution: { width: 1920, height: 1080 },
            maxResolution: { width: 1920, height: 1080 },
            referenceCount: 0,
            hardwareEncoder: true,
        };

        it("leaves encoders free on a camera that states more than are taken", () => {
            expect(
                encodersExhausted({ maxConcurrentEncoders: 4, videoStreams: [LIVE_VIDEO], snapshotStreams: [] }),
            ).to.equal(false);
        });

        it("reports exhaustion once as many streams are live as the camera can encode", () => {
            expect(
                encodersExhausted({ maxConcurrentEncoders: 1, videoStreams: [LIVE_VIDEO], snapshotStreams: [] }),
            ).to.equal(true);
        });

        it("ignores an allocated video stream nothing references", () => {
            const idle = { ...LIVE_VIDEO, referenceCount: 0 };
            expect(encodersExhausted({ maxConcurrentEncoders: 1, videoStreams: [idle], snapshotStreams: [] })).to.equal(
                false,
            );
        });

        it("counts a snapshot stream the camera marks as using a hardware encoder", () => {
            // No call gives such a stream back, so missing it sends the next request at a camera
            // whose encoder is already taken.
            expect(
                encodersExhausted({
                    maxConcurrentEncoders: 1,
                    videoStreams: [],
                    snapshotStreams: [ENCODING_SNAPSHOT],
                }),
            ).to.equal(true);
        });

        it("counts such a snapshot stream although nothing references it", () => {
            // HardwareEncoder states that the stream uses an encoder, not that anyone is watching.
            expect(
                encodersExhausted({
                    maxConcurrentEncoders: 2,
                    videoStreams: [LIVE_VIDEO],
                    snapshotStreams: [ENCODING_SNAPSHOT],
                }),
            ).to.equal(true);
        });

        it("ignores a snapshot stream the camera marks as using no hardware encoder", () => {
            expect(
                encodersExhausted({
                    maxConcurrentEncoders: 1,
                    videoStreams: [],
                    snapshotStreams: [{ ...ENCODING_SNAPSHOT, hardwareEncoder: false }],
                }),
            ).to.equal(false);
        });

        it("treats any live stream as the last encoder when the camera states no budget", () => {
            expect(
                encodersExhausted({
                    maxConcurrentEncoders: undefined,
                    videoStreams: [LIVE_VIDEO],
                    snapshotStreams: [],
                }),
            ).to.equal(true);
            expect(
                encodersExhausted({ maxConcurrentEncoders: undefined, videoStreams: [], snapshotStreams: [] }),
            ).to.equal(false);
        });
    });

    describe("selectSnapshotCapabilities", () => {
        it("orders the highest resolution first when no stream holds the encoder", () => {
            expect(chosen(selectSnapshotCapabilities(G350, { encodersExhausted: false }))[0]?.resolution).to.deep.equal(
                {
                    width: 1920,
                    height: 1080,
                },
            );
        });

        it("offers every eligible capability, so a rejected one has a fallback", () => {
            expect(
                chosen(selectSnapshotCapabilities(G350, { encodersExhausted: false })).map(entry => entry.resolution),
            ).to.deep.equal([
                { width: 1920, height: 1080 },
                { width: 640, height: 480 },
            ]);
        });

        it("picks an encoder-free capability while a video stream is live", () => {
            expect(chosen(selectSnapshotCapabilities(G350, { encodersExhausted: true }))[0]?.resolution).to.deep.equal({
                width: 640,
                height: 480,
            });
        });

        it("keeps an encoded capability the device serves without a hardware encoder while streaming", () => {
            // requiresEncodedPixels alone does not take an encoder: filtering on it would rule out a
            // capability the camera can serve concurrently.
            const softwareEncoded = [{ ...G350[1], requiresHardwareEncoder: false }, G350[0]];
            expect(
                chosen(selectSnapshotCapabilities(softwareEncoded, { encodersExhausted: true }))[0]?.resolution,
            ).to.deep.equal({
                width: 1920,
                height: 1080,
            });
        });

        it("clamps a caller ceiling down to a capability the camera offers", () => {
            const selected = chosen(
                selectSnapshotCapabilities(G350, {
                    encodersExhausted: false,
                    maxResolution: { width: 1280, height: 720 },
                }),
            );
            expect(selected[0]?.resolution).to.deep.equal({ width: 640, height: 480 });
        });

        it("excludes a capability that exceeds the ceiling on one dimension only", () => {
            // 1920x1080 and 1440x1440 have comparable pixel counts; only a per-dimension test keeps
            // the taller one out of a 1920x1080 ceiling, and the device validates per dimension.
            const tall = { ...G350[0], resolution: { width: 1440, height: 1440 } };
            const selected = chosen(
                selectSnapshotCapabilities([tall, G350[0]], {
                    encodersExhausted: false,
                    maxResolution: { width: 1920, height: 1080 },
                }),
            );
            expect(selected.map(entry => entry.resolution)).to.deep.equal([{ width: 640, height: 480 }]);
        });

        it("excludes a capability wider than the ceiling although it is no taller", () => {
            const wide = { ...G350[0], resolution: { width: 2400, height: 600 } };
            const selected = chosen(
                selectSnapshotCapabilities([wide, G350[0]], {
                    encodersExhausted: false,
                    maxResolution: { width: 1920, height: 1080 },
                }),
            );
            expect(selected.map(entry => entry.resolution)).to.deep.equal([{ width: 640, height: 480 }]);
        });

        it("keeps the encoder-free capability under a ceiling that would also admit an encoder one", () => {
            const selected = chosen(
                selectSnapshotCapabilities(G350, {
                    encodersExhausted: true,
                    maxResolution: { width: 1920, height: 1080 },
                }),
            );
            expect(selected[0]?.resolution).to.deep.equal({ width: 640, height: 480 });
        });

        it("keeps a capability inside the caller's ceiling even when it takes the busy encoder", () => {
            // The encoder preference is the server's own; giving it up is what keeps a request the
            // caller's stated bounds allow from failing.
            const encoderFreeLarge = { ...G350[0], resolution: { width: 2560, height: 1440 } };
            const encoderSmall = { ...G350[1], resolution: { width: 1280, height: 720 } };
            const selected = chosen(
                selectSnapshotCapabilities([encoderFreeLarge, encoderSmall], {
                    encodersExhausted: true,
                    maxResolution: { width: 1280, height: 720 },
                }),
            );
            expect(selected.map(entry => entry.resolution)).to.deep.equal([{ width: 1280, height: 720 }]);
        });

        it("reports a bounds failure when a caller ceiling excludes every capability", () => {
            // Dropping the ceiling here would hand back a 1920x1080 snapshot to a caller that stated
            // it can handle 100x100.
            expect(
                selectSnapshotCapabilities(G350, {
                    encodersExhausted: false,
                    maxResolution: { width: 100, height: 100 },
                }),
            ).to.deep.equal({ unsatisfiable: "bounds" });
        });

        it("reports a codec failure when no capability uses the requested codec", () => {
            expect(selectSnapshotCapabilities(G350, { encodersExhausted: false, codec: 7 })).to.deep.equal({
                unsatisfiable: "codec",
            });
        });

        it("filters to a requested codec", () => {
            const mixed = [...G350, { ...G350[0], imageCodec: 1, resolution: { width: 320, height: 240 } }];
            expect(
                chosen(selectSnapshotCapabilities(mixed, { encodersExhausted: false, codec: 1 }))[0]?.resolution,
            ).to.deep.equal({
                width: 320,
                height: 240,
            });
        });

        it("falls back to an encoder capability when the camera offers no encoder-free one", () => {
            const encoderOnly = [G350[1]];
            expect(
                chosen(selectSnapshotCapabilities(encoderOnly, { encodersExhausted: true }))[0]?.resolution,
            ).to.deep.equal({
                width: 1920,
                height: 1080,
            });
        });

        it("reports nothing when the camera advertises no capabilities", () => {
            expect(selectSnapshotCapabilities([], { encodersExhausted: false })).to.deep.equal({
                capabilities: [],
                bestWithFreeEncoder: undefined,
            });
        });
    });

    describe("findAdoptableSnapshotStream", () => {
        const best = G350[1];
        const stream = (snapshotStreamId: number, width: number, height: number, imageCodec = 0) => ({
            snapshotStreamId,
            imageCodec,
            minResolution: { width, height },
            maxResolution: { width, height },
            referenceCount: 0,
            hardwareEncoder: false,
        });

        it("adopts a stream whose whole range covers the capability that would be allocated", () => {
            expect(findAdoptableSnapshotStream([stream(8, 1920, 1080)], best, {})?.snapshotStreamId).to.equal(8);
        });

        it("refuses a stream smaller than that capability, since adoption may not cost picture size", () => {
            expect(findAdoptableSnapshotStream([stream(8, 640, 480)], best, {})).to.equal(undefined);
        });

        it("refuses a stream whose floor is below the capability, however high its ceiling is", () => {
            // §11.2.8.13.3 lets the camera answer with any size in the stream's range, so the ceiling
            // states what the frame may be rather than what it will be.
            const ranged = { ...stream(8, 1920, 1080), minResolution: { width: 640, height: 480 } };
            expect(findAdoptableSnapshotStream([ranged], best, {})).to.equal(undefined);
        });

        it("refuses a stream that outnumbers the capability in pixels but is shorter", () => {
            // 3000x700 is 2.10 Mpx against 1920x1080's 2.07, and 380 rows short of it.
            expect(findAdoptableSnapshotStream([stream(8, 3000, 700)], best, {})).to.equal(undefined);
        });

        it("refuses a stream that outnumbers the capability in pixels but is narrower", () => {
            // 1000x2100 is 2.10 Mpx against 1920x1080's 2.07, and 920 columns short of it.
            expect(findAdoptableSnapshotStream([stream(8, 1000, 2100)], best, {})).to.equal(undefined);
        });

        it("refuses a stream in a codec the caller did not ask for", () => {
            expect(findAdoptableSnapshotStream([stream(8, 1920, 1080, 1)], best, { codec: 0 })).to.equal(undefined);
        });

        it("refuses a stream above the ceiling the caller stated", () => {
            expect(
                findAdoptableSnapshotStream([stream(8, 1920, 1080)], best, {
                    maxResolution: { width: 1280, height: 720 },
                }),
            ).to.equal(undefined);
        });

        it("refuses a stream wider than the caller's ceiling although it is no taller", () => {
            const wide = { ...stream(8, 3000, 1080), minResolution: { width: 1920, height: 1080 } };
            expect(
                findAdoptableSnapshotStream([wide], best, { maxResolution: { width: 2000, height: 1080 } }),
            ).to.equal(undefined);
        });

        it("takes the largest of several candidates", () => {
            const candidates = [stream(8, 1920, 1080), stream(9, 2560, 1440)];
            expect(findAdoptableSnapshotStream(candidates, best, {})?.snapshotStreamId).to.equal(9);
        });
    });
});
