/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CameraFeatures } from "../src/camera/cameraTypes.js";
import type { OverlayBounds } from "../src/camera/overlayPolicy.js";

/** matter.js reports the feature map read-only; a fixture builds one up flag by flag. */
type MutableFeatures = { -readonly [K in keyof CameraFeatures]: boolean };

const NO_FEATURES: MutableFeatures = {
    audio: false,
    video: false,
    snapshot: false,
    privacy: false,
    speaker: false,
    imageControl: false,
    watermark: false,
    onScreenDisplay: false,
    localStorage: false,
    highDynamicRange: false,
    nightVision: false,
};

/** A `FeatureMap` advertising exactly `advertised`, named by the model's own feature keys. */
export function cameraFeatures(...advertised: (keyof CameraFeatures)[]): CameraFeatures {
    const features: MutableFeatures = { ...NO_FEATURES };
    for (const name of advertised) features[name] = true;
    return features;
}

/** What a camera with neither overlay feature reports for a stream: §11.2.6.11 gives both a fallback of 0. */
export const NO_OVERLAYS: Required<OverlayBounds> = { watermarkEnabled: false, osdEnabled: false };

/** The overlays a stream carries, each off unless `carried` states it. */
export function overlays(carried: OverlayBounds): Required<OverlayBounds> {
    return {
        watermarkEnabled: carried.watermarkEnabled ?? false,
        osdEnabled: carried.osdEnabled ?? false,
    };
}
