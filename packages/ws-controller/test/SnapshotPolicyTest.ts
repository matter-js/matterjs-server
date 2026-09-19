/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { selectSnapshotCapabilities, usesHardwareEncoder } from "../src/camera/snapshotPolicy.js";

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

    describe("selectSnapshotCapabilities", () => {
        it("orders the highest resolution first when no stream holds the encoder", () => {
            expect(selectSnapshotCapabilities(G350, { encoderBusy: false })[0]?.resolution).to.deep.equal({
                width: 1920,
                height: 1080,
            });
        });

        it("offers every eligible capability, so a rejected one has a fallback", () => {
            expect(
                selectSnapshotCapabilities(G350, { encoderBusy: false }).map(entry => entry.resolution),
            ).to.deep.equal([
                { width: 1920, height: 1080 },
                { width: 640, height: 480 },
            ]);
        });

        it("picks an encoder-free capability while a video stream is live", () => {
            expect(selectSnapshotCapabilities(G350, { encoderBusy: true })[0]?.resolution).to.deep.equal({
                width: 640,
                height: 480,
            });
        });

        it("keeps an encoded capability the device serves without a hardware encoder while streaming", () => {
            // requiresEncodedPixels alone does not take an encoder: filtering on it would rule out a
            // capability the camera can serve concurrently.
            const softwareEncoded = [{ ...G350[1], requiresHardwareEncoder: false }, G350[0]];
            expect(selectSnapshotCapabilities(softwareEncoded, { encoderBusy: true })[0]?.resolution).to.deep.equal({
                width: 1920,
                height: 1080,
            });
        });

        it("clamps a caller ceiling down to a capability the camera offers", () => {
            const chosen = selectSnapshotCapabilities(G350, {
                encoderBusy: false,
                maxResolution: { width: 1280, height: 720 },
            });
            expect(chosen[0]?.resolution).to.deep.equal({ width: 640, height: 480 });
        });

        it("excludes a capability that exceeds the ceiling on one dimension only", () => {
            // 1920x1080 and 1440x1440 have comparable pixel counts; only a per-dimension test keeps
            // the taller one out of a 1920x1080 ceiling, and the device validates per dimension.
            const tall = { ...G350[0], resolution: { width: 1440, height: 1440 } };
            const chosen = selectSnapshotCapabilities([tall, G350[0]], {
                encoderBusy: false,
                maxResolution: { width: 1920, height: 1080 },
            });
            expect(chosen.map(entry => entry.resolution)).to.deep.equal([{ width: 640, height: 480 }]);
        });

        it("ignores a caller ceiling that would reach an encoder capability while streaming", () => {
            const chosen = selectSnapshotCapabilities(G350, {
                encoderBusy: true,
                maxResolution: { width: 1920, height: 1080 },
            });
            expect(chosen[0]?.resolution).to.deep.equal({ width: 640, height: 480 });
        });

        it("keeps every capability when a caller ceiling excludes all of them", () => {
            const chosen = selectSnapshotCapabilities(G350, {
                encoderBusy: false,
                maxResolution: { width: 100, height: 100 },
            });
            expect(chosen[0]?.resolution).to.deep.equal({ width: 1920, height: 1080 });
        });

        it("filters to a requested codec", () => {
            const mixed = [...G350, { ...G350[0], imageCodec: 1, resolution: { width: 320, height: 240 } }];
            expect(selectSnapshotCapabilities(mixed, { encoderBusy: false, codec: 1 })[0]?.resolution).to.deep.equal({
                width: 320,
                height: 240,
            });
        });

        it("falls back to an encoder capability when the camera offers no encoder-free one", () => {
            const encoderOnly = [G350[1]];
            expect(selectSnapshotCapabilities(encoderOnly, { encoderBusy: true })[0]?.resolution).to.deep.equal({
                width: 1920,
                height: 1080,
            });
        });

        it("reports nothing when the camera advertises no capabilities", () => {
            expect(selectSnapshotCapabilities([], { encoderBusy: false })).to.deep.equal([]);
        });
    });
});
