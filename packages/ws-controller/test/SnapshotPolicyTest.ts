/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SnapshotCapability, SnapshotSelection } from "../src/camera/snapshotPolicy.js";
import { encodersExhausted, selectSnapshotCapabilities, usesHardwareEncoder } from "../src/camera/snapshotPolicy.js";

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

        it("leaves encoders free on a camera that states more than are taken", () => {
            expect(encodersExhausted({ maxConcurrentEncoders: 4, videoStreams: [LIVE_VIDEO] })).to.equal(false);
        });

        it("reports exhaustion once as many streams are live as the camera can encode", () => {
            expect(encodersExhausted({ maxConcurrentEncoders: 1, videoStreams: [LIVE_VIDEO] })).to.equal(true);
        });

        it("ignores an allocated video stream nothing references", () => {
            const idle = { ...LIVE_VIDEO, referenceCount: 0 };
            expect(encodersExhausted({ maxConcurrentEncoders: 1, videoStreams: [idle] })).to.equal(false);
        });

        it("treats any live stream as the last encoder when the camera states no budget", () => {
            expect(encodersExhausted({ maxConcurrentEncoders: undefined, videoStreams: [LIVE_VIDEO] })).to.equal(true);
            expect(encodersExhausted({ maxConcurrentEncoders: undefined, videoStreams: [] })).to.equal(false);
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
});
