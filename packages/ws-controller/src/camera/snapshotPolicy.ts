/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AllocatedSnapshotStream, AllocatedVideoStream, Resolution } from "./cameraTypes.js";

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

/** Whether `resolution` fits under `ceiling` on each dimension independently. */
function fitsUnder(resolution: Resolution, ceiling: Resolution): boolean {
    return resolution.width <= ceiling.width && resolution.height <= ceiling.height;
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
 * A video stream counts while something references it; a snapshot stream counts while it exists,
 * because `HardwareEncoder` states that the stream uses one of the encoders (§11.2.6.13.9) and says
 * nothing about anyone watching. The flag is the camera's own, not derived from the capability the
 * stream was allocated at. Snapshot streams have to be counted now that no call gives one back:
 * missing them means the ladder walks down a camera whose encoder is already taken and, on hardware
 * whose every snapshot capability needs one, fails with `ResourceExhausted` and no rung left. The
 * price is `AllocatedSnapshotStreams` being a cached view: it lags an allocate, which under-counts
 * and costs one refused allocate the ladder walks down from, and it lags a `camera_release_stream`,
 * which over-counts and costs picture size on the next call until the report catches up.
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
 * `bestWithinCallerBounds` is the largest capability the caller's own bounds allow, whatever the
 * encoder preference then does with the order, so a caller can be told whether it was served a
 * smaller frame than it asked for. It is undefined only when the camera advertises no snapshot
 * capability at all.
 */
export type SnapshotSelection =
    | { readonly capabilities: SnapshotCapability[]; readonly bestWithinCallerBounds: SnapshotCapability | undefined }
    | { readonly unsatisfiable: "codec" | "bounds" };

/**
 * Whether `chosen` is a smaller image than the best capability the caller's bounds allowed.
 *
 * `chosen` is the frame the device returned, not the stream it came from: a snapshot stream is
 * allocated for a range and the device picks a size inside it, so the stream's ceiling would report
 * a size the caller may not have been given.
 */
export function isDowngradeFrom(chosen: Resolution, best: SnapshotCapability | undefined): boolean {
    return best !== undefined && pixels(chosen) < pixels(best.resolution);
}

/**
 * An already-allocated snapshot stream worth capturing from instead of allocating one, or none.
 *
 * Allocating a snapshot stream per call is the churn §11.2.1.1 asks controllers to avoid, and the
 * stream is a shared resource whoever allocated it: §11.2.8.8's own dedup returns an existing id for
 * a matching request, and `CaptureSnapshot` names any allocated stream. Adopting one also costs no
 * encoder, since the stream already holds whatever it holds — which is why the encoder narrowing
 * that {@link selectSnapshotCapabilities} applies has no say here.
 *
 * `best` is the capability that would otherwise be allocated. The floor is tested against the
 * candidate's `minResolution`, not its ceiling: a snapshot stream is allocated for a range and
 * §11.2.8.13.3 lets the camera answer with any size in it, so the ceiling states what the frame may
 * be rather than what it will be. Both bounds are compared per dimension, because a 3000x700 stream
 * outnumbers a 1920x1080 capability in pixels while being 380 rows shorter. Together that is what
 * makes adoption unable to hand back a smaller frame than allocating would have.
 *
 * The caller's own ceiling and codec are hard, as everywhere else: a stream past either is not a
 * candidate rather than a frame the caller did not ask for.
 */
export function findAdoptableSnapshotStream(
    streams: AllocatedSnapshotStream[],
    best: SnapshotCapability,
    bounds: { maxResolution?: Resolution; codec?: number },
): AllocatedSnapshotStream | undefined {
    const ceiling = bounds.maxResolution;
    const candidates = streams.filter(stream => {
        if (bounds.codec !== undefined && stream.imageCodec !== bounds.codec) return false;
        if (ceiling !== undefined && !fitsUnder(stream.maxResolution, ceiling)) return false;
        return fitsUnder(best.resolution, stream.minResolution);
    });
    return candidates.sort((a, b) => pixels(b.maxResolution) - pixels(a.maxResolution))[0];
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
 * declared it can handle. The encoder preference runs last and is a stable partition, not a filter:
 * with every encoder taken the encoder-free capabilities come first and the encoder-using ones follow
 * them. Removing the latter ended the ladder at the last encoder-free rung, so a device that refused
 * all of those failed the call while capabilities the caller's own bounds allowed had never been
 * tried — and the device is the arbiter of whether an encoder is really free, since
 * `encodersExhausted` reads a subscription-backed view that lags.
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
    const bestWithinCallerBounds = preferred[0];
    if (options.encodersExhausted) {
        const encoderFree = preferred.filter(capability => !usesHardwareEncoder(capability));
        const encoderUsing = preferred.filter(capability => usesHardwareEncoder(capability));
        return { capabilities: [...encoderFree, ...encoderUsing], bestWithinCallerBounds };
    }
    return { capabilities: preferred, bestWithinCallerBounds };
}
