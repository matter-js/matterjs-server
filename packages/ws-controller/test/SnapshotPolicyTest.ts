/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AllocatedSnapshotStream } from "../src/camera/cameraTypes.js";
import type { OverlayBounds } from "../src/camera/overlayPolicy.js";
import type { SnapshotCapability, SnapshotSelection } from "../src/camera/snapshotPolicy.js";
import {
    chooseSnapshotStreamToFree,
    encodersExhausted,
    findAdoptableSnapshotStream,
    isDegradedFrom,
    requestedResolution,
    selectSnapshotCapabilities,
    usesHardwareEncoder,
} from "../src/camera/snapshotPolicy.js";
import { NO_OVERLAYS, overlays } from "./cameraFixtures.js";

/** The ordered candidates, failing the test when the selection was unsatisfiable instead. */
function chosen(selection: SnapshotSelection): SnapshotCapability[] {
    if ("unsatisfiable" in selection) throw new Error(`unsatisfiable on ${selection.unsatisfiable}`);
    return selection.capabilities;
}

/** A tested camera, verified from live attributes: entry 0 is encoder-free, entry 1 needs the encoder. */
const SNAPSHOT_CAPABILITIES = [
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
            expect(usesHardwareEncoder(SNAPSHOT_CAPABILITIES[1])).to.equal(true);
        });

        it("ignores requiresHardwareEncoder when requiresEncodedPixels is false", () => {
            // §11.2.6.9.5: "This field is only considered if RequiresEncodedPixels is true."
            const unencoded = { ...SNAPSHOT_CAPABILITIES[0], requiresHardwareEncoder: true };
            expect(usesHardwareEncoder(unencoded)).to.equal(false);
        });

        it("reports no encoder use for an encoded capability the device serves without one", () => {
            const softwareEncoded = { ...SNAPSHOT_CAPABILITIES[1], requiresHardwareEncoder: false };
            expect(usesHardwareEncoder(softwareEncoded)).to.equal(false);
        });
    });

    describe("encodersExhausted", () => {
        const LIVE_VIDEO = {
            videoStreamId: 1,
            overlays: NO_OVERLAYS,
            streamUsage: 3,
            videoCodec: 1,
            minResolution: { width: 1920, height: 1080 },
            maxResolution: { width: 1920, height: 1080 },
            minFrameRate: 1,
            maxFrameRate: 30,
            minBitRate: 800000,
            maxBitRate: 4000000,
            keyFrameInterval: 4000,
            referenceCount: 1,
        };

        /** A snapshot stream the camera states uses one of its hardware encoders (§11.2.6.13.9). */
        const ENCODING_SNAPSHOT = {
            snapshotStreamId: 8,
            overlays: NO_OVERLAYS,
            imageCodec: 0,
            minResolution: { width: 1920, height: 1080 },
            maxResolution: { width: 1920, height: 1080 },
            quality: 90,
            referenceCount: 0,
            frameRate: 1,
            encodedPixels: true,
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
            expect(
                chosen(selectSnapshotCapabilities(SNAPSHOT_CAPABILITIES, { encodersExhausted: false }))[0]?.resolution,
            ).to.deep.equal({
                width: 1920,
                height: 1080,
            });
        });

        it("offers every eligible capability, so a rejected one has a fallback", () => {
            expect(
                chosen(selectSnapshotCapabilities(SNAPSHOT_CAPABILITIES, { encodersExhausted: false })).map(
                    entry => entry.resolution,
                ),
            ).to.deep.equal([
                { width: 1920, height: 1080 },
                { width: 640, height: 480 },
            ]);
        });

        it("picks an encoder-free capability while a video stream is live", () => {
            expect(
                chosen(selectSnapshotCapabilities(SNAPSHOT_CAPABILITIES, { encodersExhausted: true }))[0]?.resolution,
            ).to.deep.equal({
                width: 640,
                height: 480,
            });
        });

        it("keeps the encoder-using capabilities as fallbacks behind the encoder-free ones", () => {
            // The encoder preference orders; it does not narrow.
            expect(
                chosen(selectSnapshotCapabilities(SNAPSHOT_CAPABILITIES, { encodersExhausted: true })).map(
                    entry => entry.resolution,
                ),
            ).to.deep.equal([
                { width: 640, height: 480 },
                { width: 1920, height: 1080 },
            ]);
        });

        it("orders several encoder-free capabilities largest first before the encoder-using ones", () => {
            const encoderFreeSmall = { ...SNAPSHOT_CAPABILITIES[0], resolution: { width: 320, height: 240 } };
            expect(
                chosen(
                    selectSnapshotCapabilities([encoderFreeSmall, ...SNAPSHOT_CAPABILITIES], {
                        encodersExhausted: true,
                    }),
                ).map(entry => entry.resolution),
            ).to.deep.equal([
                { width: 640, height: 480 },
                { width: 320, height: 240 },
                { width: 1920, height: 1080 },
            ]);
        });

        it("keeps an encoded capability the device serves without a hardware encoder while streaming", () => {
            // requiresEncodedPixels alone does not take an encoder.
            const softwareEncoded = [
                { ...SNAPSHOT_CAPABILITIES[1], requiresHardwareEncoder: false },
                SNAPSHOT_CAPABILITIES[0],
            ];
            expect(
                chosen(selectSnapshotCapabilities(softwareEncoded, { encodersExhausted: true }))[0]?.resolution,
            ).to.deep.equal({
                width: 1920,
                height: 1080,
            });
        });

        it("clamps a caller ceiling down to a capability the camera offers", () => {
            const selected = chosen(
                selectSnapshotCapabilities(SNAPSHOT_CAPABILITIES, {
                    encodersExhausted: false,
                    maxResolution: { width: 1280, height: 720 },
                }),
            );
            expect(selected[0]?.resolution).to.deep.equal({ width: 640, height: 480 });
        });

        it("excludes a capability that exceeds the ceiling on one dimension only", () => {
            // Comparable pixel count to 1920x1080, so only a per-dimension check (as the device does) excludes it.
            const tall = { ...SNAPSHOT_CAPABILITIES[0], resolution: { width: 1440, height: 1440 } };
            const selected = chosen(
                selectSnapshotCapabilities([tall, SNAPSHOT_CAPABILITIES[0]], {
                    encodersExhausted: false,
                    maxResolution: { width: 1920, height: 1080 },
                }),
            );
            expect(selected.map(entry => entry.resolution)).to.deep.equal([{ width: 640, height: 480 }]);
        });

        it("excludes a capability wider than the ceiling although it is no taller", () => {
            const wide = { ...SNAPSHOT_CAPABILITIES[0], resolution: { width: 2400, height: 600 } };
            const selected = chosen(
                selectSnapshotCapabilities([wide, SNAPSHOT_CAPABILITIES[0]], {
                    encodersExhausted: false,
                    maxResolution: { width: 1920, height: 1080 },
                }),
            );
            expect(selected.map(entry => entry.resolution)).to.deep.equal([{ width: 640, height: 480 }]);
        });

        it("keeps the encoder-free capability under a ceiling that would also admit an encoder one", () => {
            const selected = chosen(
                selectSnapshotCapabilities(SNAPSHOT_CAPABILITIES, {
                    encodersExhausted: true,
                    maxResolution: { width: 1920, height: 1080 },
                }),
            );
            expect(selected[0]?.resolution).to.deep.equal({ width: 640, height: 480 });
        });

        it("keeps a capability inside the caller's ceiling even when it takes the busy encoder", () => {
            // The encoder preference is the server's own and yields to the caller's bounds.
            const encoderFreeLarge = { ...SNAPSHOT_CAPABILITIES[0], resolution: { width: 2560, height: 1440 } };
            const encoderSmall = { ...SNAPSHOT_CAPABILITIES[1], resolution: { width: 1280, height: 720 } };
            const selected = chosen(
                selectSnapshotCapabilities([encoderFreeLarge, encoderSmall], {
                    encodersExhausted: true,
                    maxResolution: { width: 1280, height: 720 },
                }),
            );
            expect(selected.map(entry => entry.resolution)).to.deep.equal([{ width: 1280, height: 720 }]);
        });

        it("reports a bounds failure when a caller ceiling excludes every capability", () => {
            expect(
                selectSnapshotCapabilities(SNAPSHOT_CAPABILITIES, {
                    encodersExhausted: false,
                    maxResolution: { width: 100, height: 100 },
                }),
            ).to.deep.equal({ unsatisfiable: "bounds" });
        });

        it("reports a codec failure when no capability uses the requested codec", () => {
            expect(
                selectSnapshotCapabilities(SNAPSHOT_CAPABILITIES, { encodersExhausted: false, codec: 7 }),
            ).to.deep.equal({
                unsatisfiable: "codec",
            });
        });

        it("filters to a requested codec", () => {
            const mixed = [
                ...SNAPSHOT_CAPABILITIES,
                { ...SNAPSHOT_CAPABILITIES[0], imageCodec: 1, resolution: { width: 320, height: 240 } },
            ];
            expect(
                chosen(selectSnapshotCapabilities(mixed, { encodersExhausted: false, codec: 1 }))[0]?.resolution,
            ).to.deep.equal({
                width: 320,
                height: 240,
            });
        });

        it("falls back to an encoder capability when the camera offers no encoder-free one", () => {
            const encoderOnly = [SNAPSHOT_CAPABILITIES[1]];
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
                bestWithinCallerBounds: undefined,
            });
        });
    });

    describe("selectSnapshotCapabilities with a target", () => {
        const capability = (width: number, height: number, carried: Partial<SnapshotCapability> = {}) => ({
            ...SNAPSHOT_CAPABILITIES[0],
            resolution: { width, height },
            ...carried,
        });
        const LADDER = [capability(640, 360), capability(1280, 720), capability(1920, 1080)];
        const widths = (selection: SnapshotSelection) => chosen(selection).map(entry => entry.resolution.width);

        it("puts the smallest capability that reaches the target first, then the larger, then the short ones", () => {
            expect(
                widths(selectSnapshotCapabilities(LADDER, { encodersExhausted: false, target: { width: 1000 } })),
            ).to.deep.equal([1280, 1920, 640]);
        });

        it("keeps the largest-first order when no capability reaches the target", () => {
            expect(
                widths(selectSnapshotCapabilities(LADDER, { encodersExhausted: false, target: { width: 4000 } })),
            ).to.deep.equal([1920, 1280, 640]);
        });

        it("reads a height-only target against the height", () => {
            expect(
                widths(selectSnapshotCapabilities(LADDER, { encodersExhausted: false, target: { height: 700 } })),
            ).to.deep.equal([1280, 1920, 640]);
        });

        it("requires every stated dimension of a two-sided target", () => {
            const wideShort = capability(2000, 500);
            expect(
                widths(
                    selectSnapshotCapabilities([wideShort, ...LADDER], {
                        encodersExhausted: false,
                        target: { width: 640, height: 360 },
                    }),
                )[0],
            ).to.equal(640);
            expect(
                widths(
                    selectSnapshotCapabilities([wideShort, ...LADDER], {
                        encodersExhausted: false,
                        target: { width: 1000, height: 600 },
                    }),
                )[0],
            ).to.equal(1280);
        });

        it("never picks a capability above the ceiling, whatever the target", () => {
            expect(
                widths(
                    selectSnapshotCapabilities(LADDER, {
                        encodersExhausted: false,
                        maxResolution: { width: 1280, height: 720 },
                        target: { width: 1500 },
                    }),
                ),
            ).to.deep.equal([1280, 640]);
        });

        it("still puts encoder-free capabilities first when encoders are exhausted", () => {
            const mixed = [
                capability(640, 360),
                capability(1280, 720, { requiresEncodedPixels: true, requiresHardwareEncoder: true }),
            ];
            expect(
                widths(selectSnapshotCapabilities(mixed, { encodersExhausted: true, target: { width: 1000 } })),
            ).to.deep.equal([640, 1280]);
        });

        it("takes bestWithinCallerBounds from the target order, before the encoder split", () => {
            const mixed = [
                capability(640, 360),
                capability(1280, 720, { requiresEncodedPixels: true, requiresHardwareEncoder: true }),
            ];
            const selection = selectSnapshotCapabilities(mixed, { encodersExhausted: true, target: { width: 1000 } });
            if ("unsatisfiable" in selection) throw new Error("unsatisfiable");
            expect(selection.bestWithinCallerBounds?.resolution.width).to.equal(1280);
        });
    });

    describe("requestedResolution", () => {
        const FULL = { width: 1920, height: 1080 };

        it("returns the source size without a target", () => {
            expect(requestedResolution(FULL, undefined)).to.deep.equal(FULL);
        });

        it("derives the height from the aspect ratio for a width-only target", () => {
            expect(requestedResolution(FULL, { width: 640 })).to.deep.equal({ width: 640, height: 360 });
        });

        it("derives the width from the aspect ratio for a height-only target", () => {
            expect(requestedResolution(FULL, { height: 360 })).to.deep.equal({ width: 640, height: 360 });
        });

        it("fits a two-sided target inside the source aspect ratio instead of stretching", () => {
            expect(requestedResolution(FULL, { width: 640, height: 640 })).to.deep.equal({ width: 640, height: 360 });
        });

        it("scales a height-only target by the height ratio alone when it is above one half", () => {
            expect(requestedResolution(FULL, { height: 810 })).to.deep.equal({ width: 1440, height: 810 });
        });

        it("never asks for more than the source has", () => {
            expect(requestedResolution(FULL, { width: 4000 })).to.deep.equal(FULL);
            expect(requestedResolution(FULL, { width: 4000, height: 4000 })).to.deep.equal(FULL);
            expect(requestedResolution(FULL, { width: 4000, height: 100 })).to.deep.equal({ width: 178, height: 100 });
        });

        it("never asks for a zero side", () => {
            expect(requestedResolution({ width: 1920, height: 10 }, { width: 1 })).to.deep.equal({
                width: 1,
                height: 1,
            });
            expect(requestedResolution({ width: 10, height: 1920 }, { height: 1 })).to.deep.equal({
                width: 1,
                height: 1,
            });
        });
    });

    describe("isDegradedFrom with a target", () => {
        const best = { ...SNAPSHOT_CAPABILITIES[1] };

        it("does not flag a frame that meets the target although the capability is larger", () => {
            expect(isDegradedFrom({ width: 320, height: 180 }, best, { width: 320 })).to.equal(false);
        });

        it("flags a frame below the requested size", () => {
            expect(isDegradedFrom({ width: 160, height: 90 }, best, { width: 320 })).to.equal(true);
        });

        it("does not flag a correct frame from a stream whose aspect ratio differs from the capability", () => {
            const fourThirds = SNAPSHOT_CAPABILITIES[0];
            expect(isDegradedFrom({ width: 320, height: 180 }, fourThirds, { width: 320 })).to.equal(false);
            expect(isDegradedFrom({ width: 427, height: 240 }, fourThirds, { height: 240 })).to.equal(false);
        });

        it("accepts a frame that reaches either side of a two-sided target", () => {
            const target = { width: 320, height: 320 };
            expect(isDegradedFrom({ width: 320, height: 180 }, best, target)).to.equal(false);
            expect(isDegradedFrom({ width: 160, height: 90 }, best, target)).to.equal(true);
        });

        it("measures a height-only target against the height", () => {
            expect(isDegradedFrom({ width: 1000, height: 100 }, best, { height: 200 })).to.equal(true);
            expect(isDegradedFrom({ width: 100, height: 200 }, best, { height: 200 })).to.equal(false);
        });

        it("never flags a frame when the camera states no capability", () => {
            expect(isDegradedFrom({ width: 160, height: 90 }, undefined)).to.equal(false);
            expect(isDegradedFrom({ width: 160, height: 90 }, undefined, { width: 320 })).to.equal(false);
        });

        it("measures against the whole capability when the target is larger than it", () => {
            expect(isDegradedFrom({ width: 1280, height: 720 }, best, { width: 4000 })).to.equal(true);
            expect(isDegradedFrom({ width: 1920, height: 1080 }, best, { width: 4000 })).to.equal(false);
        });
    });

    describe("chooseSnapshotStreamToFree", () => {
        const BUDGETED = { maxEncodedPixelRate: 248832000 };
        const held = (
            snapshotStreamId: number,
            carried: Partial<AllocatedSnapshotStream> = {},
        ): AllocatedSnapshotStream => ({
            snapshotStreamId,
            imageCodec: 0,
            minResolution: { width: 640, height: 480 },
            maxResolution: { width: 640, height: 480 },
            quality: 90,
            referenceCount: 0,
            frameRate: 1,
            encodedPixels: true,
            hardwareEncoder: true,
            overlays: NO_OVERLAYS,
            ...carried,
        });

        it("takes nothing while every candidate is referenced", () => {
            expect(chooseSnapshotStreamToFree([held(1, { referenceCount: 1 })], BUDGETED)).to.equal(undefined);
        });

        it("takes nothing that holds neither an encoder nor a share of the pixel rate", () => {
            expect(
                chooseSnapshotStreamToFree([held(1, { encodedPixels: false, hardwareEncoder: false })], BUDGETED),
            ).to.equal(undefined);
        });

        it("takes nothing for the pixel rate on a camera that states no budget", () => {
            // Without MaxEncodedPixelRate the pixel rate is not accounted, so freeing gains nothing.
            const pixelRateOnly = held(1, { hardwareEncoder: false });
            expect(chooseSnapshotStreamToFree([pixelRateOnly], { maxEncodedPixelRate: undefined })).to.equal(undefined);
            expect(chooseSnapshotStreamToFree([pixelRateOnly], BUDGETED)?.snapshotStreamId).to.equal(1);
        });

        it("still takes an encoder holder on a camera that states no pixel-rate budget", () => {
            expect(
                chooseSnapshotStreamToFree([held(1, { encodedPixels: false })], { maxEncodedPixelRate: undefined })
                    ?.snapshotStreamId,
            ).to.equal(1);
        });

        it("takes the encoder holder before a larger stream that holds no encoder", () => {
            // MaxConcurrentEncoders is 1 on the hardware this rung exists for, so the encoder is the scarce resource.
            const big = held(1, {
                hardwareEncoder: false,
                maxResolution: { width: 1920, height: 1080 },
                frameRate: 30,
            });
            const encoderHolder = held(2);
            expect(chooseSnapshotStreamToFree([big, encoderHolder], BUDGETED)?.snapshotStreamId).to.equal(2);
        });

        it("takes the largest pixel-rate footprint among equals, whatever order the camera reported", () => {
            const small = held(1);
            const large = held(2, { maxResolution: { width: 1920, height: 1080 } });
            const fast = held(3, { frameRate: 30 });
            expect(chooseSnapshotStreamToFree([small, large, fast], BUDGETED)?.snapshotStreamId).to.equal(3);
            expect(chooseSnapshotStreamToFree([large, small], BUDGETED)?.snapshotStreamId).to.equal(2);
        });

        it("breaks a tie on the id, so the choice does not depend on the report order", () => {
            expect(chooseSnapshotStreamToFree([held(9), held(4)], BUDGETED)?.snapshotStreamId).to.equal(4);
        });
    });

    describe("findAdoptableSnapshotStream", () => {
        const best = SNAPSHOT_CAPABILITIES[1];
        const stream = (
            snapshotStreamId: number,
            width: number,
            height: number,
            imageCodec = 0,
            carried: OverlayBounds = {},
        ) => ({
            snapshotStreamId,
            imageCodec,
            minResolution: { width, height },
            maxResolution: { width, height },
            quality: 90,
            referenceCount: 0,
            frameRate: 1,
            encodedPixels: false,
            hardwareEncoder: false,
            overlays: overlays(carried),
        });

        it("adopts a stream whose whole range covers the capability that would be allocated", () => {
            expect(
                findAdoptableSnapshotStream([stream(8, 1920, 1080)], best, { overlays: {} })?.snapshotStreamId,
            ).to.equal(8);
        });

        it("refuses a stream whose overlays are not the ones the request resolved to", () => {
            const watermarked = stream(8, 1920, 1080, 0, { watermarkEnabled: true });
            expect(
                findAdoptableSnapshotStream([watermarked], best, {
                    overlays: { watermarkEnabled: false, osdEnabled: false },
                }),
            ).to.equal(undefined);
        });

        it("adopts a stream carrying exactly those overlays", () => {
            const watermarked = stream(8, 1920, 1080, 0, { watermarkEnabled: true });
            expect(
                findAdoptableSnapshotStream([watermarked], best, {
                    overlays: { watermarkEnabled: true, osdEnabled: false },
                })?.snapshotStreamId,
            ).to.equal(8);
        });

        it("refuses a stream smaller than that capability, since adoption may not cost picture size", () => {
            expect(findAdoptableSnapshotStream([stream(8, 640, 480)], best, { overlays: {} })).to.equal(undefined);
        });

        it("refuses a stream whose floor is below the capability, however high its ceiling is", () => {
            // §11.2.8.13.3 lets the camera answer with any size in the stream's range.
            const ranged = { ...stream(8, 1920, 1080), minResolution: { width: 640, height: 480 } };
            expect(findAdoptableSnapshotStream([ranged], best, { overlays: {} })).to.equal(undefined);
        });

        it("refuses a stream that outnumbers the capability in pixels but is shorter", () => {
            // 3000x700 is 2.10 Mpx against 1920x1080's 2.07, and 380 rows short of it.
            expect(findAdoptableSnapshotStream([stream(8, 3000, 700)], best, { overlays: {} })).to.equal(undefined);
        });

        it("refuses a stream that outnumbers the capability in pixels but is narrower", () => {
            // 1000x2100 is 2.10 Mpx against 1920x1080's 2.07, and 920 columns short of it.
            expect(findAdoptableSnapshotStream([stream(8, 1000, 2100)], best, { overlays: {} })).to.equal(undefined);
        });

        it("refuses a stream in a codec the caller did not ask for", () => {
            expect(findAdoptableSnapshotStream([stream(8, 1920, 1080, 1)], best, { overlays: {}, codec: 0 })).to.equal(
                undefined,
            );
        });

        it("refuses a stream above the ceiling the caller stated", () => {
            expect(
                findAdoptableSnapshotStream([stream(8, 1920, 1080)], best, {
                    overlays: {},
                    maxResolution: { width: 1280, height: 720 },
                }),
            ).to.equal(undefined);
        });

        it("refuses a stream wider than the caller's ceiling although it is no taller", () => {
            const wide = { ...stream(8, 3000, 1080), minResolution: { width: 1920, height: 1080 } };
            expect(
                findAdoptableSnapshotStream([wide], best, {
                    overlays: {},
                    maxResolution: { width: 2000, height: 1080 },
                }),
            ).to.equal(undefined);
        });

        it("takes the largest of several candidates", () => {
            const candidates = [stream(8, 1920, 1080), stream(9, 2560, 1440)];
            expect(findAdoptableSnapshotStream(candidates, best, { overlays: {} })?.snapshotStreamId).to.equal(9);
        });

        it("adopts a stream that covers the requested size although it is below the capability", () => {
            const mid = stream(8, 1280, 720);
            expect(findAdoptableSnapshotStream([mid], best, { overlays: {} })).to.equal(undefined);
            expect(
                findAdoptableSnapshotStream([mid], best, { overlays: {}, target: { width: 1000 } })?.snapshotStreamId,
            ).to.equal(8);
        });

        it("refuses a stream whose floor is below the requested size", () => {
            expect(
                findAdoptableSnapshotStream([stream(8, 640, 360)], best, { overlays: {}, target: { width: 1000 } }),
            ).to.equal(undefined);
        });

        it("fits the target to the candidate's own aspect ratio, not to the capability's", () => {
            // Capture asks the 16:9 stream for 640x360; that meets a width-only target the 4:3 capability would give as 640x480.
            const capability = SNAPSHOT_CAPABILITIES[0];
            const wide = stream(8, 640, 360);
            const adopted = findAdoptableSnapshotStream([wide], capability, { overlays: {}, target: { width: 640 } });
            expect(adopted?.snapshotStreamId).to.equal(8);
            expect(isDegradedFrom(wide.minResolution, capability, { width: 640 })).to.equal(false);
        });

        it("refuses a candidate short of the capability's fitted size in a stated dimension", () => {
            const capability = SNAPSHOT_CAPABILITIES[0];
            expect(
                findAdoptableSnapshotStream([stream(8, 640, 360)], capability, {
                    overlays: {},
                    target: { width: 640, height: 480 },
                }),
            ).to.equal(undefined);
        });

        it("refuses a ranged candidate whose floor is below its own fitted request", () => {
            const ranged = { ...stream(8, 1920, 1080), minResolution: { width: 640, height: 360 } };
            expect(findAdoptableSnapshotStream([ranged], best, { overlays: {}, target: { width: 1000 } })).to.equal(
                undefined,
            );
        });

        it("takes the smallest candidate that reaches the target", () => {
            const candidates = [stream(8, 1920, 1080), stream(9, 1280, 720), stream(10, 640, 360)];
            expect(
                findAdoptableSnapshotStream(candidates, best, { overlays: {}, target: { width: 1000 } })
                    ?.snapshotStreamId,
            ).to.equal(9);
        });
    });
});
