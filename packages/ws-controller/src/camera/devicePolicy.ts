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
 * matter.js shows an empty `FeatureMap` until the device reports it. One of Audio, Video and Snapshot
 * is mandatory (§11.2.5, `O.a+`), so a map with none of them has not arrived yet.
 */
function featureMapStated(features: CameraFeatures): boolean {
    return features.audio === true || features.video === true || features.snapshot === true;
}

export function statedFeatureNames(features: CameraFeatures): string[] | undefined {
    return featureMapStated(features) ? advertisedFeatureNames(features) : undefined;
}

/** An unstated map never lacks a feature, so the request goes to the device and it answers for itself. */
export function lacksFeature(features: CameraFeatures, feature: keyof CameraFeatures): boolean {
    return featureMapStated(features) && features[feature] !== true;
}

export function overlaySupport(features: CameraFeatures): OverlaySupport {
    if (!featureMapStated(features)) return {};
    return { watermark: features.watermark === true, osd: features.onScreenDisplay === true };
}

/** Per `SolicitOffer` (§11.5.6.1.10) and `ProvideOffer` (§11.5.6.3.12). */
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

/** Per `CaptureSnapshot` (§11.2.8.13.3). */
export function snapshotPrivacyModes(privacy: CameraPrivacyState): CameraPrivacyMode[] {
    const modes = new Array<CameraPrivacyMode>();
    if (privacy.hardModeOn === true) modes.push("hard_mode_on");
    if (privacy.softLivestreamModeEnabled === true) modes.push("soft_livestream_mode_enabled");
    return modes;
}
