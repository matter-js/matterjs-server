/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CameraFeatures } from "../src/camera/cameraTypes.js";

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

/**
 * A `FeatureMap` advertising exactly `advertised`.
 *
 * The names are the model's own feature keys, so a fixture cannot advertise a feature this cluster
 * does not have, and a feature a spec revision adds fails to compile here until it is stated above.
 */
export function cameraFeatures(...advertised: (keyof CameraFeatures)[]): CameraFeatures {
    const features: MutableFeatures = { ...NO_FEATURES };
    for (const name of advertised) features[name] = true;
    return features;
}
