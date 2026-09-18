/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { selectSnapshotCapability } from "../src/camera/snapshotPolicy.js";

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
    describe("selectSnapshotCapability", () => {
        it("picks the highest resolution when no stream holds the encoder", () => {
            expect(selectSnapshotCapability(G350, { encoderBusy: false })?.resolution).to.deep.equal({
                width: 1920,
                height: 1080,
            });
        });

        it("picks an encoder-free capability while a video stream is live", () => {
            expect(selectSnapshotCapability(G350, { encoderBusy: true })?.resolution).to.deep.equal({
                width: 640,
                height: 480,
            });
        });

        it("clamps a caller ceiling down to a capability the camera offers", () => {
            const chosen = selectSnapshotCapability(G350, {
                encoderBusy: false,
                maxResolution: { width: 1280, height: 720 },
            });
            expect(chosen?.resolution).to.deep.equal({ width: 640, height: 480 });
        });

        it("ignores a caller ceiling that would reach an encoder capability while streaming", () => {
            const chosen = selectSnapshotCapability(G350, {
                encoderBusy: true,
                maxResolution: { width: 1920, height: 1080 },
            });
            expect(chosen?.resolution).to.deep.equal({ width: 640, height: 480 });
        });

        it("keeps every capability when a caller ceiling excludes all of them", () => {
            const chosen = selectSnapshotCapability(G350, {
                encoderBusy: false,
                maxResolution: { width: 100, height: 100 },
            });
            expect(chosen?.resolution).to.deep.equal({ width: 1920, height: 1080 });
        });

        it("filters to a requested codec", () => {
            const mixed = [...G350, { ...G350[0], imageCodec: 1, resolution: { width: 320, height: 240 } }];
            expect(selectSnapshotCapability(mixed, { encoderBusy: false, codec: 1 })?.resolution).to.deep.equal({
                width: 320,
                height: 240,
            });
        });

        it("falls back to an encoder capability when the camera offers no encoder-free one", () => {
            const encoderOnly = [G350[1]];
            expect(selectSnapshotCapability(encoderOnly, { encoderBusy: true })?.resolution).to.deep.equal({
                width: 1920,
                height: 1080,
            });
        });

        it("reports nothing when the camera advertises no capabilities", () => {
            expect(selectSnapshotCapability([], { encoderBusy: false })).to.equal(undefined);
        });
    });
});
