/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Resolution } from "./cameraTypes.js";

export interface SnapshotCapability {
    resolution: Resolution;
    maxFrameRate: number;
    imageCodec: number;
    requiresEncodedPixels: boolean;
    requiresHardwareEncoder: boolean;
}

function pixels(resolution: Resolution): number {
    return resolution.width * resolution.height;
}

/**
 * The capability to allocate a snapshot stream against.
 *
 * A camera with MaxConcurrentEncoders = 1 has no encoder to spare while a video stream is live, so a
 * concurrent snapshot must use a capability that needs none — on the Aqara G350 that is 640x480, and
 * requesting 1080p there fails with ResourceExhausted rather than degrading.
 */
export function selectSnapshotCapability(
    capabilities: SnapshotCapability[],
    options: { encoderBusy: boolean; maxResolution?: Resolution; codec?: number },
): SnapshotCapability | undefined {
    let eligible = capabilities;
    if (options.codec !== undefined) {
        eligible = eligible.filter(capability => capability.imageCodec === options.codec);
    }
    if (options.encoderBusy) {
        const encoderFree = eligible.filter(capability => !capability.requiresEncodedPixels);
        if (encoderFree.length > 0) eligible = encoderFree;
    }
    if (options.maxResolution !== undefined) {
        const ceiling = pixels(options.maxResolution);
        const withinCeiling = eligible.filter(capability => pixels(capability.resolution) <= ceiling);
        if (withinCeiling.length > 0) eligible = withinCeiling;
    }
    // Array.prototype.sort mutates in place; eligible can still be the caller's own array here.
    return [...eligible].sort((a, b) => pixels(b.resolution) - pixels(a.resolution))[0];
}
