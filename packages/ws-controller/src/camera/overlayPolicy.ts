/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CameraFeatures } from "./cameraTypes.js";

/**
 * What a caller stated about the overlays burnt into a stream, or the values to put on an allocate.
 *
 * A watermark is a manufacturer logo (§11.2.5.7) and OSD is text such as date, time and device name
 * (§11.2.5.8); both change the picture the camera encodes. An absent field means the caller stated
 * nothing, which is not the same as `false` — {@link resolveOverlays} is what turns the one into the
 * other, and only for a camera that can apply the overlay at all.
 */
export interface OverlayBounds {
    watermarkEnabled?: boolean;
    osdEnabled?: boolean;
}

/**
 * Whether the camera advertises each overlay feature, or has stated no feature map.
 *
 * Three values per feature, because the conformance rule needs all three: `true` makes the allocate
 * field mandatory, `false` forbids it, and absent means the map has not arrived and nothing may be
 * gated on it (round 19's `lacksFeature` rule).
 */
export interface OverlaySupport {
    watermark?: boolean;
    osd?: boolean;
}

/** One overlay feature, named by the flag {@link CameraFeatures} carries it under. */
export type OverlayFeature = Extract<keyof CameraFeatures, "watermark" | "onScreenDisplay">;

/**
 * The overlay fields an allocate carries, or the feature a caller demanded that the camera lacks.
 *
 * A demanded overlay is unreachable by any narrowing — the camera cannot draw what it has no feature
 * for — so it is a capability refusal rather than a bound the ladder walks down.
 */
export type OverlaySelection = { readonly overlays: OverlayBounds } | { readonly unsupported: OverlayFeature };

/** One overlay field's value, or none when the field must not be sent at all. */
function overlayField(stated: boolean | undefined, supported: boolean | undefined): boolean | undefined {
    // Mandatory: silence becomes the struct's own fallback rather than an omitted field.
    if (supported === true) return stated ?? false;
    // Forbidden, and there is no such overlay to decline either, so a stated `false` is met by sending
    // nothing. A stated `true` never reaches here — resolveOverlays refuses it.
    if (supported === false) return undefined;
    // The feature map has not arrived, so nothing is gated on it and the device answers for itself.
    return stated;
}

/**
 * The overlay fields to send with an allocate, given what the caller stated and what the camera
 * advertises.
 *
 * `WatermarkEnabled` and `OSDEnabled` are conformance `WMARK` / `OSD` on both `VideoStreamAllocate`
 * (§11.2.8.4) and `SnapshotStreamAllocate` (§11.2.8.8), which means present exactly when the camera
 * advertises the feature. The reference server enforces the biconditional and answers
 * `INVALID_COMMAND` either way — omitting the field on a camera that has the feature and sending it
 * on one that does not are the same error
 * (`CameraAVStreamManagementCluster.cpp`: `HasFeature(Feature::kWatermark) == commandData.watermarkEnabled.HasValue()`).
 *
 * An unstated overlay becomes `false` rather than being left off, because a `WMARK` camera has to be
 * told something: §11.2.6.11 gives `VideoStreamStruct.WatermarkEnabled` and `OSDEnabled` a fallback of
 * 0, so `false` is the spec's own reading of a flag nobody stated, and `true` would burn a logo into a
 * picture the caller never asked to have marked.
 *
 * With the feature map unstated nothing is gated on it: the caller's own statement goes to the device,
 * which then answers for itself, and a caller that stated nothing sends nothing. So the biconditional
 * holds for a camera that has answered and for nothing else, which is the same shape `lacksFeature` has.
 */
export function resolveOverlays(stated: OverlayBounds, support: OverlaySupport): OverlaySelection {
    if (stated.watermarkEnabled === true && support.watermark === false) return { unsupported: "watermark" };
    if (stated.osdEnabled === true && support.osd === false) return { unsupported: "onScreenDisplay" };
    const watermarkEnabled = overlayField(stated.watermarkEnabled, support.watermark);
    const osdEnabled = overlayField(stated.osdEnabled, support.osd);
    return {
        overlays: {
            ...(watermarkEnabled === undefined ? {} : { watermarkEnabled }),
            ...(osdEnabled === undefined ? {} : { osdEnabled }),
        },
    };
}

/**
 * Whether `carried` has the overlays `wanted` states, for each one it states.
 *
 * Shared by the caller-bounds gate, where `wanted` is what the caller stated, and by the reuse gate,
 * where it is what the server resolved: a stream with a watermark is not the same picture as one
 * without, so a stream whose flag differs is not a candidate.
 *
 * This is the one place an unstated flag on the *stream* reads as off. The struct reports each flag only
 * for a camera advertising the feature (`WMARK` / `OSD` on §11.2.6.11 and §11.2.6.13), so a camera that
 * states nothing has no such overlay to draw. Everywhere else the absence is kept, because it is also
 * what says the field must not go on an allocate.
 */
export function overlaysMatch(carried: OverlayBounds, wanted: OverlayBounds): boolean {
    if (wanted.watermarkEnabled !== undefined && (carried.watermarkEnabled ?? false) !== wanted.watermarkEnabled) {
        return false;
    }
    if (wanted.osdEnabled !== undefined && (carried.osdEnabled ?? false) !== wanted.osdEnabled) return false;
    return true;
}
