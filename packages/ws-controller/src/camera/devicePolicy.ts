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
 * `FeatureMap` is a global attribute matter.js defaults for a client cluster and fills from the
 * device's own report, so it advertises nothing until that report has arrived. At least one of Audio,
 * Video and Snapshot is mandatory (§11.2.5, conformance `O.a+`), so a map carrying none of the three
 * has not been stated rather than describing a camera with no streams at all.
 */
function featureMapStated(features: CameraFeatures): boolean {
    return features.audio === true || features.video === true || features.snapshot === true;
}

/**
 * The features the camera advertises, or undefined when it has not stated its feature map.
 *
 * The report and the refusals read statedness through the same test, so a client is never handed a
 * list it has to apply {@link featureMapStated}'s rule to itself: an absent list says the camera has
 * not answered, and a present one is the complete set it advertises.
 */
export function statedFeatureNames(features: CameraFeatures): string[] | undefined {
    return featureMapStated(features) ? advertisedFeatureNames(features) : undefined;
}

/**
 * Whether the camera has stated its feature map and that map does not carry `feature`.
 *
 * The one read path for "this camera cannot do that", so nothing can gate a track on a feature map
 * that has not arrived: reading an unstated map as "no video" would strand a real camera in an
 * audio-only session, which is the opposite mistake from the one the gate exists to prevent. Where
 * this answers false for an unstated map the device gets the request and answers for itself, which is
 * what every release before the map was read did.
 */
export function lacksFeature(features: CameraFeatures, feature: keyof CameraFeatures): boolean {
    return featureMapStated(features) && features[feature] !== true;
}

/**
 * Which overlay features the camera advertises, for the conformance rule on both allocates.
 *
 * `{}` for a map that has not been stated, which is what keeps `resolveOverlays` from gating on one —
 * the same rule {@link lacksFeature} applies, for the same reason.
 */
export function overlaySupport(features: CameraFeatures): OverlaySupport {
    if (!featureMapStated(features)) return {};
    return { watermark: features.watermark === true, osd: features.onScreenDisplay === true };
}

/**
 * The privacy switches that forbid a new WebRTC session of `streamUsage`.
 *
 * `SolicitOffer` (§11.5.6.1.10) and `ProvideOffer` (§11.5.6.3.12) run the same three tests before
 * anything else, and the last two depend on the usage: soft livestream privacy covers LiveView and
 * soft recording privacy covers Recording and Analysis. A usage neither covers — `Internal`, which
 * this API refuses anyway — is blocked by the hard switch alone.
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

/**
 * The privacy switches that forbid a snapshot.
 *
 * `CaptureSnapshot` (§11.2.8.13.3) tests the hard switch and soft livestream privacy, and a snapshot
 * carries no stream usage for the recording switch to apply to.
 */
export function snapshotPrivacyModes(privacy: CameraPrivacyState): CameraPrivacyMode[] {
    const modes = new Array<CameraPrivacyMode>();
    if (privacy.hardModeOn === true) modes.push("hard_mode_on");
    if (privacy.softLivestreamModeEnabled === true) modes.push("soft_livestream_mode_enabled");
    return modes;
}
