/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseSnapshotCapabilitiesFromList } from "../src/components/webrtc-stream-view.js";

// Tag-based (cached-attribute) SnapshotCapabilitiesStruct: 0=resolution {0:w,1:h},
// 1=maxFrameRate, 2=imageCodec, 3=requiresEncodedPixels.
const res = (w: number, h: number) => ({ "0": w, "1": h });

// A camera exposing an encoder-free 640×480 capability plus an encoder-required 1080p one.
const MIXED_CAPS = [
    { "0": res(640, 480), "1": 30, "2": 0, "3": false },
    { "0": res(1920, 1080), "1": 30, "2": 0, "3": true },
];

describe("parseSnapshotCapabilitiesFromList", () => {
    it("prefers the encoder-free capability when a stream is live (preferEncoderFree=true)", () => {
        const cap = parseSnapshotCapabilitiesFromList(MIXED_CAPS, true);
        expect(cap.requiresEncodedPixels).to.equal(false);
        expect(cap.resolution).to.deep.equal({ width: 640, height: 480 });
    });

    it("uses the highest-resolution capability when idle (preferEncoderFree=false)", () => {
        const cap = parseSnapshotCapabilitiesFromList(MIXED_CAPS, false);
        expect(cap.requiresEncodedPixels).to.equal(true);
        expect(cap.resolution).to.deep.equal({ width: 1920, height: 1080 });
    });

    it("takes the highest-resolution encoder-free entry when several exist", () => {
        const cap = parseSnapshotCapabilitiesFromList(
            [
                { "0": res(640, 480), "1": 30, "2": 0, "3": false },
                { "0": res(1280, 720), "1": 30, "2": 0, "3": false },
            ],
            true,
        );
        expect(cap.resolution).to.deep.equal({ width: 1280, height: 720 });
    });

    it("falls back to an encoder-requiring capability when none is encoder-free", () => {
        const cap = parseSnapshotCapabilitiesFromList([{ "0": res(1920, 1080), "1": 30, "2": 0, "3": true }], true);
        expect(cap.requiresEncodedPixels).to.equal(true);
        expect(cap.resolution).to.deep.equal({ width: 1920, height: 1080 });
    });

    it("skips non-object entries without crashing", () => {
        const cap = parseSnapshotCapabilitiesFromList(
            [null, 42, { "0": res(1920, 1080), "1": 30, "2": 0, "3": true }],
            true,
        );
        expect(cap.resolution).to.deep.equal({ width: 1920, height: 1080 });
    });

    it("parses name-based (read_attribute) shapes and treats a missing flag as encoder-requiring", () => {
        const cap = parseSnapshotCapabilitiesFromList(
            [{ resolution: { width: 1280, height: 720 }, maxFrameRate: 15, imageCodec: 0 }],
            true,
        );
        expect(cap.requiresEncodedPixels).to.equal(true);
        expect(cap.resolution).to.deep.equal({ width: 1280, height: 720 });
        expect(cap.maxFrameRate).to.equal(15);
    });
});
