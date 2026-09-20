/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AllocatedVideoStream, Resolution } from "./cameraTypes.js";

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

/**
 * Whether every one of the camera's encoders is taken.
 *
 * `MaxConcurrentEncoders` is how many streams the camera can encode at once, so one live stream on a
 * camera that states four leaves three encoders free. Treating any live stream as "no encoder left"
 * costs picture size on every multi-encoder camera and reports the loss as a downgrade that did not
 * happen. With `MaxConcurrentEncoders` absent the camera states no budget, and any live stream is
 * taken as the last one.
 *
 * Only referenced video streams are counted, although an allocated snapshot stream from a
 * capability that requires the hardware encoder holds one too. `AllocatedSnapshotStreams` comes from
 * a cached view that lags a deallocate, so counting it would make two `camera_snapshot` calls in a
 * row see the first call's own stream, already given back, and clamp the second to a smaller
 * capability it would report as `downgraded` — the exact false report this function exists to
 * remove. Under-counting costs one refused allocate that the snapshot ladder already walks down
 * from; over-counting costs picture size and lies about why.
 */
export function encodersExhausted(args: {
    maxConcurrentEncoders: number | undefined;
    videoStreams: AllocatedVideoStream[];
}): boolean {
    const { maxConcurrentEncoders, videoStreams } = args;
    const taken = videoStreams.filter(stream => stream.referenceCount > 0).length;
    if (maxConcurrentEncoders === undefined) return taken > 0;
    return taken >= maxConcurrentEncoders;
}

/**
 * The capabilities to try, best first, or which narrowing step left none.
 *
 * `bestWithFreeEncoder` is the capability the caller's own bounds allow at its largest, before the
 * encoder preference narrows anything, so a caller can be told whether a live stream cost it picture
 * size. It is undefined only when the camera advertises no snapshot capability at all.
 */
export type SnapshotSelection =
    | { readonly capabilities: SnapshotCapability[]; readonly bestWithFreeEncoder: SnapshotCapability | undefined }
    | { readonly unsatisfiable: "codec" | "bounds" };

/** Whether `chosen` delivers a smaller image than the best capability the caller's bounds allowed. */
export function isDowngradeFrom(
    chosen: SnapshotCapability,
    bestWithFreeEncoder: SnapshotCapability | undefined,
): boolean {
    return bestWithFreeEncoder !== undefined && pixels(chosen.resolution) < pixels(bestWithFreeEncoder.resolution);
}

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
    options: { encodersExhausted: boolean; maxResolution?: Resolution; codec?: number },
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
    // Array.prototype.sort mutates in place; eligible can still be the caller's own array here.
    const largestFirst = (list: SnapshotCapability[]): SnapshotCapability[] =>
        [...list].sort((a, b) => pixels(b.resolution) - pixels(a.resolution));
    const preferred = largestFirst(eligible);
    const bestWithFreeEncoder = preferred[0];
    if (options.encodersExhausted) {
        const encoderFree = eligible.filter(capability => !usesHardwareEncoder(capability));
        if (encoderFree.length > 0) return { capabilities: largestFirst(encoderFree), bestWithFreeEncoder };
    }
    return { capabilities: preferred, bestWithFreeEncoder };
}
