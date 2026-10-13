/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CameraFeatures } from "./cameraTypes.js";

/** An absent field means "not stated", which is not the same as `false`. */
export interface OverlayBounds {
    watermarkEnabled?: boolean;
    osdEnabled?: boolean;
}

/**
 * Whether the camera advertises each overlay feature: `true` makes the allocate field mandatory,
 * `false` forbids it, absent means the feature map has not arrived and nothing is gated on it.
 */
export interface OverlaySupport {
    watermark?: boolean;
    osd?: boolean;
}

export type OverlayFeature = Extract<keyof CameraFeatures, "watermark" | "onScreenDisplay">;

/** `unsupported` is a capability refusal, not a bound the ladder can relax. */
export type OverlaySelection = { readonly overlays: OverlayBounds } | { readonly unsupported: OverlayFeature };

function overlayField(stated: boolean | undefined, supported: boolean | undefined): boolean | undefined {
    if (supported === true) return stated ?? false;
    // A stated `true` never reaches here: resolveOverlays refuses it.
    if (supported === false) return undefined;
    return stated;
}

/**
 * `WatermarkEnabled` / `OSDEnabled` must be present exactly when the feature is advertised (conformance
 * `WMARK` / `OSD`, §11.2.8.4, §11.2.8.8); the reference server answers `INVALID_COMMAND` otherwise.
 * An unstated flag on a supporting camera is sent as `false`, the §11.2.6.11 fallback.
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
 * An absent flag on the stream reads as off: the struct reports it only when the feature is advertised
 * (§11.2.6.11, §11.2.6.13).
 */
export function overlaysMatch(carried: OverlayBounds, wanted: OverlayBounds): boolean {
    if (wanted.watermarkEnabled !== undefined && (carried.watermarkEnabled ?? false) !== wanted.watermarkEnabled) {
        return false;
    }
    if (wanted.osdEnabled !== undefined && (carried.osdEnabled ?? false) !== wanted.osdEnabled) return false;
    return true;
}
