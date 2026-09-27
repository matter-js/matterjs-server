/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AllocatedSnapshotStream, AllocatedVideoStream, Resolution } from "./cameraTypes.js";
import type { OverlayBounds } from "./overlayPolicy.js";
import { overlaysMatch } from "./overlayPolicy.js";

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

function fitsUnder(resolution: Resolution, ceiling: Resolution): boolean {
    return resolution.width <= ceiling.width && resolution.height <= ceiling.height;
}

/**
 * Whether this capability takes one of the camera's `MaxConcurrentEncoders`. `RequiresHardwareEncoder`
 * "is only considered if RequiresEncodedPixels is true" (§11.2.6.9.5).
 */
export function usesHardwareEncoder(capability: SnapshotCapability): boolean {
    return capability.requiresEncodedPixels && capability.requiresHardwareEncoder;
}

/**
 * Whether every one of the camera's encoders is taken. With `MaxConcurrentEncoders` absent, any live
 * stream counts as the last one.
 *
 * A video stream counts while referenced; a snapshot stream counts while it exists with
 * `HardwareEncoder` set (§11.2.6.13.9). Callers include streams allocated but not yet reported.
 * The reference server counts every allocated video stream (`IsResourceAvailableForStreamAllocation`);
 * this result only orders the snapshot ladder, so an undercount costs one device refusal.
 */
export function encodersExhausted(args: {
    maxConcurrentEncoders: number | undefined;
    videoStreams: AllocatedVideoStream[];
    snapshotStreams: AllocatedSnapshotStream[];
}): boolean {
    const { maxConcurrentEncoders, videoStreams, snapshotStreams } = args;
    const taken =
        videoStreams.filter(stream => stream.referenceCount > 0).length +
        snapshotStreams.filter(stream => stream.hardwareEncoder).length;
    if (maxConcurrentEncoders === undefined) return taken > 0;
    return taken >= maxConcurrentEncoders;
}

/**
 * The capabilities to try, best first, or which narrowing step left none.
 *
 * `bestWithinCallerBounds` is the largest capability the caller's bounds allow, before the encoder
 * reordering; undefined only when the camera advertises no snapshot capability.
 */
export type SnapshotSelection =
    | { readonly capabilities: SnapshotCapability[]; readonly bestWithinCallerBounds: SnapshotCapability | undefined }
    | { readonly unsatisfiable: "codec" | "bounds" };

/**
 * Whether `chosen` is a smaller image than the best capability the caller's bounds allowed. `chosen`
 * must be the returned frame's size, not the stream's ceiling: the device picks a size inside the range.
 */
export function isDegradedFrom(chosen: Resolution, best: SnapshotCapability | undefined): boolean {
    return best !== undefined && pixels(chosen) < pixels(best.resolution);
}

/**
 * The snapshot stream the make-room rung should take, or none whose loss would buy anything.
 *
 * `candidates` must be only streams this server allocated in this process run: `SnapshotStreamDeallocate`
 * (§11.2.8.10.2) checks only `ReferenceCount`, which `CaptureSnapshot` does not raise, so a foreign
 * stream in use can read 0.
 *
 * A candidate must free an encoder (`HardwareEncoder`, §11.2.6.13.9) or pixel rate (`EncodedPixels`,
 * §11.2.6.13.8, only when the camera states `MaxEncodedPixelRate`). Encoder holders go first, then the
 * larger `frameRate × maxResolution` (the reference server's measure), then the lower id.
 */
export function chooseSnapshotStreamToFree(
    candidates: AllocatedSnapshotStream[],
    limits: { maxEncodedPixelRate: number | undefined },
): AllocatedSnapshotStream | undefined {
    const freesPixelRate = (stream: AllocatedSnapshotStream): boolean =>
        stream.encodedPixels && limits.maxEncodedPixelRate !== undefined;
    const footprint = (stream: AllocatedSnapshotStream): number =>
        freesPixelRate(stream) ? pixels(stream.maxResolution) * stream.frameRate : 0;
    return candidates
        .filter(stream => stream.referenceCount === 0 && (stream.hardwareEncoder || freesPixelRate(stream)))
        .sort(
            (a, b) =>
                Number(b.hardwareEncoder) - Number(a.hardwareEncoder) ||
                footprint(b) - footprint(a) ||
                a.snapshotStreamId - b.snapshotStreamId,
        )[0];
}

/**
 * An already-allocated snapshot stream worth capturing from instead of allocating one, or none.
 * Reuse avoids the allocation churn §11.2.1.1 asks controllers to avoid.
 *
 * `best` is the capability that would otherwise be allocated. It is compared per dimension against the
 * candidate's `minResolution`, because the camera may answer with any size in the range (§11.2.8.13.3),
 * so an adopted stream never yields a smaller frame than allocating would. `bounds.overlays` must be
 * the resolved overlays, not the caller's statement.
 */
export function findAdoptableSnapshotStream(
    streams: AllocatedSnapshotStream[],
    best: SnapshotCapability,
    bounds: { maxResolution?: Resolution; codec?: number; overlays: OverlayBounds },
): AllocatedSnapshotStream | undefined {
    const ceiling = bounds.maxResolution;
    const candidates = streams.filter(stream => {
        if (bounds.codec !== undefined && stream.imageCodec !== bounds.codec) return false;
        if (!overlaysMatch(stream.overlays, bounds.overlays)) return false;
        if (ceiling !== undefined && !fitsUnder(stream.maxResolution, ceiling)) return false;
        return fitsUnder(best.resolution, stream.minResolution);
    });
    return candidates.sort((a, b) => pixels(b.maxResolution) - pixels(a.maxResolution))[0];
}

/**
 * The capabilities to attempt a snapshot stream against, best first.
 *
 * The caller's codec and resolution ceiling are hard. With every encoder taken, encoder-free
 * capabilities are moved first but encoder-using ones stay in the list: `encodersExhausted` reads a
 * lagging view, so the device decides whether an encoder is really free.
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
    // Copy before sorting: `eligible` can still be the caller's array.
    const largestFirst = (list: SnapshotCapability[]): SnapshotCapability[] =>
        [...list].sort((a, b) => pixels(b.resolution) - pixels(a.resolution));
    const preferred = largestFirst(eligible);
    const bestWithinCallerBounds = preferred[0];
    if (options.encodersExhausted) {
        const encoderFree = preferred.filter(capability => !usesHardwareEncoder(capability));
        const encoderUsing = preferred.filter(capability => usesHardwareEncoder(capability));
        return { capabilities: [...encoderFree, ...encoderUsing], bestWithinCallerBounds };
    }
    return { capabilities: preferred, bestWithinCallerBounds };
}
