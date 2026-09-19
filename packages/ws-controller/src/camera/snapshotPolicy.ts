/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Resolution } from "./cameraTypes.js";

/** SnapshotCapabilitiesStruct (§11.2.6.9) as `CameraAvStreamManagementClient` reports it. */
export interface SnapshotCapability {
    resolution: Resolution;
    maxFrameRate: number;
    imageCodec: number;
    requiresEncodedPixels: boolean;
    /** Optional on the wire; absent reads as false, matching the reference server's default. */
    requiresHardwareEncoder: boolean;
}

function pixels(resolution: Resolution): number {
    return resolution.width * resolution.height;
}

/**
 * Whether this capability takes one of the camera's `MaxConcurrentEncoders`.
 *
 * The two flags are nested, not equivalent: `RequiresHardwareEncoder` "is only considered if
 * RequiresEncodedPixels is true" (§11.2.6.9.5, quoted in `@matter/types`' SnapshotCapabilitiesStruct).
 * The reference server encodes the same nesting — `CameraAVStreamManagementCluster.cpp` leaves
 * `snapshotStreamArgs.hardwareEncoder` at false and overwrites it only inside
 * `if (requiresEncodedPixels && requiresHardwareEncoder.HasValue())`.
 */
export function usesHardwareEncoder(capability: SnapshotCapability): boolean {
    return capability.requiresEncodedPixels && capability.requiresHardwareEncoder;
}

/** Which narrowing step left no capability, for the typed failure the caller raises. */
export type SnapshotSelection =
    | { readonly capabilities: SnapshotCapability[] }
    | { readonly unsatisfiable: "codec" | "bounds" };

/**
 * The capabilities to attempt a snapshot stream against, best first.
 *
 * A camera with MaxConcurrentEncoders = 1 has no encoder to spare while a video stream is live, so a
 * concurrent snapshot must use a capability that needs none — on the Aqara G350 that is 640x480, and
 * requesting 1080p there fails with ResourceExhausted rather than degrading. Several are returned so
 * the caller can walk down after a device rejection instead of failing on the first choice.
 *
 * The caller's codec and resolution ceiling are hard and are applied first: a ceiling that excludes
 * every capability reports `unsatisfiable` rather than handing back a snapshot larger than the caller
 * declared it can handle. The encoder preference runs last and is the one step that may be given up,
 * so wanting an encoder-free capability can never turn a request the caller's own bounds allow into a
 * failure.
 */
export function selectSnapshotCapabilities(
    capabilities: SnapshotCapability[],
    options: { encoderBusy: boolean; maxResolution?: Resolution; codec?: number },
): SnapshotSelection {
    let eligible = capabilities;
    if (options.codec !== undefined) {
        const before = eligible;
        eligible = eligible.filter(capability => capability.imageCodec === options.codec);
        if (eligible.length === 0 && before.length > 0) return { unsatisfiable: "codec" };
    }
    if (options.maxResolution !== undefined) {
        const ceiling = options.maxResolution;
        const before = eligible;
        eligible = eligible.filter(
            capability =>
                capability.resolution.width <= ceiling.width && capability.resolution.height <= ceiling.height,
        );
        if (eligible.length === 0 && before.length > 0) return { unsatisfiable: "bounds" };
    }
    if (options.encoderBusy) {
        const encoderFree = eligible.filter(capability => !usesHardwareEncoder(capability));
        if (encoderFree.length > 0) eligible = encoderFree;
    }
    // Array.prototype.sort mutates in place; eligible can still be the caller's own array here.
    return { capabilities: [...eligible].sort((a, b) => pixels(b.resolution) - pixels(a.resolution)) };
}
