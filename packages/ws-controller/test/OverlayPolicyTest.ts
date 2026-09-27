/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { overlaySupport } from "../src/camera/devicePolicy.js";
import type { OverlaySelection } from "../src/camera/overlayPolicy.js";
import { overlaysMatch, resolveOverlays } from "../src/camera/overlayPolicy.js";
import { cameraFeatures } from "./cameraFixtures.js";

/** The fields a resolution carries, failing the test when the camera lacks a demanded feature instead. */
function fields(selection: OverlaySelection): { watermarkEnabled?: boolean; osdEnabled?: boolean } {
    if ("unsupported" in selection) throw new Error(`unsupported: ${selection.unsupported}`);
    return selection.overlays;
}

describe("overlayPolicy", () => {
    const BOTH = overlaySupport(cameraFeatures("video", "watermark", "onScreenDisplay"));
    const NEITHER = overlaySupport(cameraFeatures("video"));
    const UNSTATED = overlaySupport(cameraFeatures());

    describe("overlaySupport", () => {
        it("states each feature against a camera that has stated its map", () => {
            expect(overlaySupport(cameraFeatures("video", "watermark"))).to.deep.equal({
                watermark: true,
                osd: false,
            });
        });

        it("states neither feature for a map that has not arrived, so nothing is gated on it", () => {
            expect(UNSTATED).to.deep.equal({});
        });
    });

    describe("resolveOverlays", () => {
        it("sends both fields as false when the camera advertises both and the caller stated neither", () => {
            expect(fields(resolveOverlays({}, BOTH))).to.deep.equal({ watermarkEnabled: false, osdEnabled: false });
        });

        it("sends what the caller stated when the camera advertises the feature", () => {
            expect(fields(resolveOverlays({ watermarkEnabled: true, osdEnabled: false }, BOTH))).to.deep.equal({
                watermarkEnabled: true,
                osdEnabled: false,
            });
        });

        it("sends neither field to a camera that advertises neither feature", () => {
            expect(fields(resolveOverlays({}, NEITHER))).to.deep.equal({});
        });

        it("sends neither field for a caller that declined both on a camera that has neither", () => {
            // The request is met rather than refused: a camera without the feature has no overlay to
            // apply, and the field itself is INVALID_COMMAND there.
            expect(fields(resolveOverlays({ watermarkEnabled: false, osdEnabled: false }, NEITHER))).to.deep.equal({});
        });

        it("names the feature a caller demanded that the camera does not advertise", () => {
            expect(resolveOverlays({ watermarkEnabled: true }, NEITHER)).to.deep.equal({ unsupported: "watermark" });
            expect(resolveOverlays({ osdEnabled: true }, NEITHER)).to.deep.equal({
                unsupported: "onScreenDisplay",
            });
        });

        it("sends only what the caller stated while the feature map has not arrived", () => {
            expect(fields(resolveOverlays({ osdEnabled: true }, UNSTATED))).to.deep.equal({ osdEnabled: true });
            expect(fields(resolveOverlays({}, UNSTATED))).to.deep.equal({});
        });

        it("refuses nothing while the feature map has not arrived", () => {
            expect(fields(resolveOverlays({ watermarkEnabled: true }, UNSTATED))).to.deep.equal({
                watermarkEnabled: true,
            });
        });

        it("resolves each feature against its own support", () => {
            const watermarkOnly = overlaySupport(cameraFeatures("video", "watermark"));
            expect(fields(resolveOverlays({}, watermarkOnly))).to.deep.equal({ watermarkEnabled: false });
        });
    });

    describe("overlaysMatch", () => {
        const CARRIED = { watermarkEnabled: true, osdEnabled: false };

        it("reads a flag the camera stated nothing about as off", () => {
            // Absence is kept everywhere else, because it is also what says the field must not go on an
            // allocate; this is the one place it reads as a value.
            expect(overlaysMatch({}, { watermarkEnabled: false, osdEnabled: false })).to.equal(true);
            expect(overlaysMatch({}, { watermarkEnabled: true })).to.equal(false);
            expect(overlaysMatch({ watermarkEnabled: true }, { osdEnabled: true })).to.equal(false);
        });

        it("accepts a stream carrying exactly what was wanted", () => {
            expect(overlaysMatch(CARRIED, { watermarkEnabled: true, osdEnabled: false })).to.equal(true);
        });

        it("accepts anything for a preference nobody stated", () => {
            expect(overlaysMatch(CARRIED, {})).to.equal(true);
        });

        it("refuses a stream that has an overlay the request wanted off", () => {
            expect(overlaysMatch(CARRIED, { watermarkEnabled: false })).to.equal(false);
        });

        it("refuses a stream that lacks an overlay the request wanted on", () => {
            expect(overlaysMatch(CARRIED, { osdEnabled: true })).to.equal(false);
        });

        it("compares each overlay against its own statement", () => {
            expect(overlaysMatch(CARRIED, { watermarkEnabled: true, osdEnabled: true })).to.equal(false);
        });
    });
});
