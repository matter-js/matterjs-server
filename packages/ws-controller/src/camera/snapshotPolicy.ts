/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AllocatedSnapshotStream, AllocatedVideoStream, Resolution, ResolutionTarget } from "./cameraTypes.js";
import type { OverlayBounds } from "./overlayPolicy.js";
import { overlaysMatch } from "./overlayPolicy.js";

/** `Quality` is mandatory on `SnapshotStreamAllocate` (§11.2.8.8); 90 is what the reference SDK's tests and camera app use. */
export const SNAPSHOT_QUALITY = 90;

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

function reachesTarget(resolution: Resolution, target: ResolutionTarget): boolean {
    return (
        (target.width === undefined || resolution.width >= target.width) &&
        (target.height === undefined || resolution.height >= target.height)
    );
}

/**
 * Without a target: largest first. With one: the smallest entry that reaches the target in every stated
 * dimension, then the larger ones, then the entries that fall short, largest first. A larger source still
 * serves the target because the camera may downscale it (§11.2.8.13.3); it only costs the camera more.
 */
export function orderForTarget<T>(
    items: readonly T[],
    resolutionOf: (item: T) => Resolution,
    target: ResolutionTarget | undefined,
): T[] {
    const largestFirst = (a: T, b: T) => pixels(resolutionOf(b)) - pixels(resolutionOf(a));
    if (target === undefined) return [...items].sort(largestFirst);
    const reaching = items.filter(item => reachesTarget(resolutionOf(item), target));
    const short = items.filter(item => !reachesTarget(resolutionOf(item), target));
    return [...reaching.sort((a, b) => largestFirst(b, a)), ...short.sort(largestFirst)];
}

/**
 * The `RequestedResolution` (§11.2.8.13.2) for a source of size `available`: the target fitted inside the
 * source with the source's aspect ratio, so a stated width alone fixes the height. Never larger than
 * `available`. Without a target, `available` itself.
 */
export function requestedResolution(available: Resolution, target: ResolutionTarget | undefined): Resolution {
    if (target === undefined) return available;
    const scale = Math.min(
        1,
        target.width === undefined ? 1 : target.width / available.width,
        target.height === undefined ? 1 : target.height / available.height,
    );
    return {
        width: Math.max(1, Math.round(available.width * scale)),
        height: Math.max(1, Math.round(available.height * scale)),
    };
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

/**
 * `chosen` must be the returned frame's size, not the stream's ceiling: the device picks a size inside the range.
 * With a `target`, a frame is degraded when, in every stated dimension, it is smaller than the target or
 * than `best`, whichever is smaller. Stated dimensions only: the stream that served the frame can have another
 * aspect ratio than `best`, so a pixel count against `best` would flag a correct thumbnail.
 */
export function isDegradedFrom(
    chosen: Resolution,
    best: SnapshotCapability | undefined,
    target?: ResolutionTarget,
): boolean {
    if (best === undefined) return false;
    if (target === undefined) return pixels(chosen) < pixels(best.resolution);
    const short = (frame: number, wanted: number | undefined, available: number): boolean =>
        wanted === undefined || frame < Math.min(wanted, available);
    return (
        short(chosen.width, target.width, best.resolution.width) &&
        short(chosen.height, target.height, best.resolution.height)
    );
}

/**
 * `CaptureSnapshot` does not raise `ReferenceCount`, so a stream another controller polls can read 0
 * (§11.2.8.10.2); the caller decides whose streams are candidates.
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
 * The smallest frame a capture with `requestedResolution(stream.maxResolution, target)` can return: the camera
 * downscales to the requested size, but may answer with any native size in the stream's range (§11.2.8.13.3).
 */
function guaranteedFrame(stream: AllocatedSnapshotStream, target: ResolutionTarget | undefined): Resolution {
    const requested = requestedResolution(stream.maxResolution, target);
    return {
        width: Math.min(requested.width, stream.minResolution.width),
        height: Math.min(requested.height, stream.minResolution.height),
    };
}

/**
 * `best` is the capability that would otherwise be allocated. A candidate is adopted when the frame it is
 * sure to return for its own fitted request ({@link guaranteedFrame}) reaches the size `best` would give,
 * in every stated dimension of the `target` (in both without one). Such a frame is never
 * {@link isDegradedFrom} `best`. With a `target`, the candidate closest above it comes first.
 * `bounds.overlays` must be the resolved overlays, not the caller's statement.
 */
export function findAdoptableSnapshotStream(
    streams: AllocatedSnapshotStream[],
    best: SnapshotCapability,
    bounds: { maxResolution?: Resolution; codec?: number; overlays: OverlayBounds; target?: ResolutionTarget },
): AllocatedSnapshotStream | undefined {
    const { maxResolution: ceiling, target } = bounds;
    const needed = requestedResolution(best.resolution, target);
    const checksWidth = target === undefined || target.width !== undefined;
    const checksHeight = target === undefined || target.height !== undefined;
    const candidates = streams.filter(stream => {
        if (bounds.codec !== undefined && stream.imageCodec !== bounds.codec) return false;
        if (!overlaysMatch(stream.overlays, bounds.overlays)) return false;
        if (ceiling !== undefined && !fitsUnder(stream.maxResolution, ceiling)) return false;
        const frame = guaranteedFrame(stream, target);
        return (!checksWidth || frame.width >= needed.width) && (!checksHeight || frame.height >= needed.height);
    });
    return orderForTarget(candidates, stream => stream.maxResolution, target)[0];
}

/**
 * Encoder-using capabilities stay in the list when encoders are exhausted: `encodersExhausted` reads a
 * lagging view, so the device decides whether an encoder is really free. The encoder split comes first and
 * the `target` order applies inside each part, so a target never moves an encoder-using capability ahead of
 * an encoder-free one (the kind that samples a running video stream).
 */
export function selectSnapshotCapabilities(
    capabilities: SnapshotCapability[],
    options: {
        encodersExhausted: boolean;
        maxResolution?: Resolution;
        codec?: number;
        target?: ResolutionTarget;
    },
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
    const preferred = orderForTarget(eligible, capability => capability.resolution, options.target);
    const bestWithinCallerBounds = preferred[0];
    if (options.encodersExhausted) {
        const encoderFree = preferred.filter(capability => !usesHardwareEncoder(capability));
        const encoderUsing = preferred.filter(capability => usesHardwareEncoder(capability));
        return { capabilities: [...encoderFree, ...encoderUsing], bestWithinCallerBounds };
    }
    return { capabilities: preferred, bestWithinCallerBounds };
}
