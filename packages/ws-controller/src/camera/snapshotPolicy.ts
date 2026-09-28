/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AllocatedSnapshotStream, AllocatedVideoStream, Resolution } from "./cameraTypes.js";
import type { OverlayBounds } from "./overlayPolicy.js";
import { overlaysMatch } from "./overlayPolicy.js";

export interface SnapshotCapability {
    resolution: Resolution;
    maxFrameRate: number;
    imageCodec: number;
    requiresEncodedPixels: boolean;
    /** Optional on the wire; absent reads as false, as in the reference server. */
    requiresHardwareEncoder: boolean;
}

function pixels(resolution: Resolution): number {
    return resolution.width * resolution.height;
}

function fitsUnder(resolution: Resolution, ceiling: Resolution): boolean {
    return resolution.width <= ceiling.width && resolution.height <= ceiling.height;
}

/** `RequiresHardwareEncoder` "is only considered if RequiresEncodedPixels is true" (§11.2.6.9.5). */
export function usesHardwareEncoder(capability: SnapshotCapability): boolean {
    return capability.requiresEncodedPixels && capability.requiresHardwareEncoder;
}

/**
 * Callers include streams allocated but not yet reported. The reference server counts every allocated
 * video stream (`IsResourceAvailableForStreamAllocation`), not only referenced ones; this result only
 * orders the snapshot ladder, so an undercount costs one device refusal.
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
 * `bestWithinCallerBounds` is taken before the encoder reordering; undefined only when the camera
 * advertises no snapshot capability.
 */
export type SnapshotSelection =
    | { readonly capabilities: SnapshotCapability[]; readonly bestWithinCallerBounds: SnapshotCapability | undefined }
    | { readonly unsatisfiable: "codec" | "bounds" };

/** `chosen` must be the returned frame's size, not the stream's ceiling: the device picks a size inside the range. */
export function isDegradedFrom(chosen: Resolution, best: SnapshotCapability | undefined): boolean {
    return best !== undefined && pixels(chosen) < pixels(best.resolution);
}

/**
 * `candidates` must be only streams this server allocated in this process run: `CaptureSnapshot` does
 * not raise `ReferenceCount`, so a foreign stream in use can read 0 (§11.2.8.10.2).
 * `frameRate × maxResolution` is the reference server's measure of pixel rate.
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
 * `best` is the capability that would otherwise be allocated. It must fit under the candidate's
 * `minResolution` per dimension: the camera may answer with any size in the range (§11.2.8.13.3).
 * `bounds.overlays` must be the resolved overlays, not the caller's statement.
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
 * Encoder-using capabilities stay in the list when encoders are exhausted: `encodersExhausted` reads a
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
