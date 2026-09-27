/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CameraPrivacyMode } from "@matter-server/ws-client";
import { StreamUsage } from "@matter/main/types";
import type { CameraFeatures, CameraPrivacyState } from "./cameraTypes.js";
import type { OverlaySupport } from "./overlayPolicy.js";
import { advertisedFeatureNames } from "./wireNames.js";

/**
 * Whether the camera has stated its feature map at all.
 *
 * matter.js shows an empty `FeatureMap` until the device reports it. One of Audio, Video and Snapshot
 * is mandatory (§11.2.5, `O.a+`), so a map with none of them has not arrived yet.
 */
function featureMapStated(features: CameraFeatures): boolean {
    return features.audio === true || features.video === true || features.snapshot === true;
}

/** The features the camera advertises, or undefined when it has not stated its feature map. */
export function statedFeatureNames(features: CameraFeatures): string[] | undefined {
    return featureMapStated(features) ? advertisedFeatureNames(features) : undefined;
}

/**
 * Whether the camera has stated its feature map and that map does not carry `feature`.
 *
 * An unstated map never lacks a feature, so the request goes to the device and it answers for itself.
 */
export function lacksFeature(features: CameraFeatures, feature: keyof CameraFeatures): boolean {
    return featureMapStated(features) && features[feature] !== true;
}

/** Which overlay features the camera advertises; `{}` for an unstated map, so nothing is gated on it. */
export function overlaySupport(features: CameraFeatures): OverlaySupport {
    if (!featureMapStated(features)) return {};
    return { watermark: features.watermark === true, osd: features.onScreenDisplay === true };
}

/**
 * The privacy switches that forbid a new WebRTC session of `streamUsage`.
 *
 * Per `SolicitOffer` (§11.5.6.1.10) and `ProvideOffer` (§11.5.6.3.12): hard privacy blocks every usage,
 * soft livestream privacy blocks LiveView, soft recording privacy blocks Recording and Analysis.
 */
export function sessionPrivacyModes(privacy: CameraPrivacyState, streamUsage: number): CameraPrivacyMode[] {
    const modes = new Array<CameraPrivacyMode>();
    if (privacy.hardModeOn === true) modes.push("hard_mode_on");
    if (privacy.softLivestreamModeEnabled === true && streamUsage === StreamUsage.LiveView) {
        modes.push("soft_livestream_mode_enabled");
    }
    if (
        privacy.softRecordingModeEnabled === true &&
        (streamUsage === StreamUsage.Recording || streamUsage === StreamUsage.Analysis)
    ) {
        modes.push("soft_recording_mode_enabled");
    }
    return modes;
}

/** The privacy switches that forbid a snapshot: hard and soft livestream only (§11.2.8.13.3). */
export function snapshotPrivacyModes(privacy: CameraPrivacyState): CameraPrivacyMode[] {
    const modes = new Array<CameraPrivacyMode>();
    if (privacy.hardModeOn === true) modes.push("hard_mode_on");
    if (privacy.softLivestreamModeEnabled === true) modes.push("soft_livestream_mode_enabled");
    return modes;
}
