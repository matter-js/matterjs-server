/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { StreamUsage } from "@matter/main/types";
import type {
    AllocatedAudioStream,
    AllocatedSnapshotStream,
    AllocatedVideoStream,
    AudioEnvelope,
    Resolution,
    VideoBudgetNarrowing,
    VideoEnvelope,
} from "./cameraTypes.js";
import type { OverlayBounds } from "./overlayPolicy.js";
import { overlaysMatch } from "./overlayPolicy.js";
import type { SdpVideoConstraints, SelectedVideoCodecLimits, VideoCodecLimits } from "./sdpConstraints.js";
import { receivableCodecs } from "./sdpConstraints.js";
import { audioCodecName } from "./wireNames.js";

/**
 * The only value the Aqara G350 accepted in raw `VideoStreamAllocate` probes (2000, 3000, 3999, 5000 and
 * 8000 were refused with DynamicConstraintError); the reference camera app uses it for every stream.
 */
export const KEY_FRAME_INTERVAL_MS = 4000;
const DEFAULT_MAX_BIT_RATE = 8000000;

export interface RateDistortionPoint {
    codec: number;
    resolution: Resolution;
    minBitRate: number;
}

export interface VideoCapabilities {
    sensor: Resolution;
    maxFrameRate: number;
    minViewport?: Resolution;
    rateDistortionPoints: RateDistortionPoint[];
    maxNetworkBandwidth?: number;
}

/** A stated field is a hard bound; an absent one is left to the server. */
export interface VideoRangeBounds {
    minResolution?: Resolution;
    maxResolution?: Resolution;
    minFrameRate?: number;
    maxFrameRate?: number;
    minBitRate?: number;
    maxBitRate?: number;
}

export interface VideoHints extends VideoRangeBounds, OverlayBounds {
    codecs?: string[];
}

/** `limits` is the offer's decode ceiling for the resolved codec, which no ladder rung may give up. */
export interface VideoCallerBounds extends VideoRangeBounds {
    limits: SelectedVideoCodecLimits;
    streamUsage: number;
    overlays: OverlayBounds;
}

export function videoCallerBounds(
    limits: SelectedVideoCodecLimits,
    streamUsage: number,
    hints: VideoHints | undefined,
): VideoCallerBounds {
    return {
        limits,
        streamUsage,
        minResolution: hints?.minResolution,
        maxResolution: hints?.maxResolution,
        minFrameRate: hints?.minFrameRate,
        maxFrameRate: hints?.maxFrameRate,
        minBitRate: hints?.minBitRate,
        maxBitRate: hints?.maxBitRate,
        overlays: { watermarkEnabled: hints?.watermarkEnabled, osdEnabled: hints?.osdEnabled },
    };
}

/** A demanded track must not be answered with a null track and no error. */
export type TrackRequest<Hints> =
    | { readonly state: "declined" | "deferred" }
    | { readonly state: "demanded"; readonly hints: Hints };

export function trackRequest<Hints>(stated: Hints | false | undefined): TrackRequest<Hints> {
    if (stated === false) return { state: "declined" };
    if (stated === undefined) return { state: "deferred" };
    return { state: "demanded", hints: stated };
}

export function statedHints<Hints>(request: TrackRequest<Hints>): Hints | undefined {
    return request.state === "demanded" ? request.hints : undefined;
}

export interface VideoEnvelopeArgs {
    capabilities: VideoCapabilities;
    limits: SelectedVideoCodecLimits;
    hints: VideoHints | undefined;
    /** As `resolveOverlays` resolved them; not the raw hints. */
    overlays: OverlayBounds;
}

function pixels(resolution: Resolution): number {
    return resolution.width * resolution.height;
}

/** Scale to fit a pixel budget on the same aspect ratio, in even dimensions the encoder can use. */
function scaleToPixels(resolution: Resolution, maxPixels: number): Resolution {
    if (pixels(resolution) <= maxPixels) return resolution;
    const factor = Math.sqrt(maxPixels / pixels(resolution));
    const even = (value: number): number => Math.max(2, Math.floor((value * factor) / 2) * 2);
    return { width: even(resolution.width), height: even(resolution.height) };
}

/** Clamp `resolution` under `ceiling` on each dimension; `VideoStreamAllocate` checks width and height separately. */
function clampDown(resolution: Resolution, ceiling: Resolution): Resolution {
    return {
        width: Math.min(resolution.width, ceiling.width),
        height: Math.min(resolution.height, ceiling.height),
    };
}

function clampUp(resolution: Resolution, floor: Resolution): Resolution {
    return {
        width: Math.max(resolution.width, floor.width),
        height: Math.max(resolution.height, floor.height),
    };
}

function fitsUnder(resolution: Resolution, ceiling: Resolution): boolean {
    return resolution.width <= ceiling.width && resolution.height <= ceiling.height;
}

/** Can be 0; must not be rounded up, since it is a decode ceiling. */
function offerFrameRateCeiling(limits: VideoCodecLimits, resolution: Resolution): number | undefined {
    const ceilings = new Array<number>();
    if (limits.maxPixelsPerSecond !== undefined) {
        ceilings.push(Math.floor(limits.maxPixelsPerSecond / pixels(resolution)));
    }
    if (limits.maxFrameRate !== undefined) ceilings.push(limits.maxFrameRate);
    return ceilings.length === 0 ? undefined : Math.min(...ceilings);
}

/**
 * The first window to request, and the lowest frame rate a later window may go down to: the caller's
 * `min_frame_rate`, or 1. Every window asks for a single frame rate (minimum equals maximum).
 */
export interface VideoPlan {
    readonly envelope: VideoEnvelope;
    readonly frameRateFloor: number;
}

/** `limit` is the ceiling in force after every narrowing (sensor, offer or caller). */
export type VideoSelection =
    | { readonly plan: VideoPlan }
    | {
          readonly unsatisfiable: "bounds";
          readonly field: "min_resolution" | "min_frame_rate" | "min_bit_rate";
          readonly requested: string;
          readonly limit: string;
      };

function resolutionText(resolution: Resolution): string {
    return `${resolution.width}x${resolution.height}`;
}

/**
 * The best window both the camera and the offer allow. Resolution and bit rate are ranges, so the
 * camera can adapt (§11.2.1.2.2). Frame rate is one value, the highest the caller's bounds allow:
 * cameras refuse a range reaching below a frame rate floor they do not publish. A caller-stated floor
 * out of reach fails the request. Server-derived floors (viewport minimum, trade-off point bit rate)
 * are clamped down instead.
 */
export function computeVideoEnvelope(args: VideoEnvelopeArgs): VideoSelection {
    const { capabilities, limits, hints, overlays } = args;
    const codec = limits.codec;

    let maxResolution = capabilities.sensor;
    let maxFrameRate = capabilities.maxFrameRate;

    // Apply the caller's ceiling before the offer's pixel budget, or the budget is spent on dimensions
    // the ceiling then cuts again.
    if (hints?.maxResolution !== undefined) {
        maxResolution = clampDown(maxResolution, hints.maxResolution);
    }
    if (limits.maxPixels !== undefined) {
        maxResolution = scaleToPixels(maxResolution, limits.maxPixels);
    }
    if (limits.maxPixelsPerSecond !== undefined) {
        // At 1 fps minimum, the pixel-rate budget is also a frame-size ceiling.
        maxResolution = scaleToPixels(maxResolution, limits.maxPixelsPerSecond);
    }
    const offerCeiling = offerFrameRateCeiling(limits, maxResolution);
    if (offerCeiling !== undefined) {
        maxFrameRate = Math.min(maxFrameRate, offerCeiling);
    }
    if (hints?.maxFrameRate !== undefined) {
        maxFrameRate = Math.min(maxFrameRate, hints.maxFrameRate);
    }

    if (hints?.minResolution !== undefined && !fitsUnder(hints.minResolution, maxResolution)) {
        return {
            unsatisfiable: "bounds",
            field: "min_resolution",
            requested: resolutionText(hints.minResolution),
            limit: resolutionText(maxResolution),
        };
    }
    if (hints?.minFrameRate !== undefined && hints.minFrameRate > maxFrameRate) {
        return {
            unsatisfiable: "bounds",
            field: "min_frame_rate",
            requested: String(hints.minFrameRate),
            limit: String(maxFrameRate),
        };
    }

    const codecPoints = capabilities.rateDistortionPoints.filter(point => point.codec === codec);
    const smallestPoint = codecPoints.reduce<Resolution | undefined>(
        (smallest, point) =>
            smallest === undefined || pixels(point.resolution) < pixels(smallest) ? point.resolution : smallest,
        undefined,
    );

    const derivedFloor = clampDown(capabilities.minViewport ?? smallestPoint ?? maxResolution, maxResolution);
    const minResolution =
        hints?.minResolution === undefined ? derivedFloor : clampUp(derivedFloor, hints.minResolution);

    // The trade-off point at or just below the ceiling states the bitrate that resolution needs.
    const applicable = codecPoints
        .filter(point => fitsUnder(point.resolution, maxResolution))
        .sort((a, b) => pixels(b.resolution) - pixels(a.resolution))[0];
    const ceilings = [hints?.maxBitRate, limits.maxBitRate, capabilities.maxNetworkBandwidth].filter(
        (value): value is number => value !== undefined,
    );
    const maxBitRate = ceilings.length > 0 ? Math.min(...ceilings) : DEFAULT_MAX_BIT_RATE;
    if (hints?.minBitRate !== undefined && hints.minBitRate > maxBitRate) {
        return {
            unsatisfiable: "bounds",
            field: "min_bit_rate",
            requested: String(hints.minBitRate),
            limit: String(maxBitRate),
        };
    }
    // A trade-off point's floor can exceed the camera's bandwidth; drop it rather than pin min to max.
    const derivedBitRateFloor = applicable?.minBitRate ?? 1;
    const minBitRate = hints?.minBitRate ?? (derivedBitRateFloor <= maxBitRate ? derivedBitRateFloor : 1);

    return {
        plan: {
            envelope: {
                overlays,
                codec,
                minResolution,
                maxResolution,
                minFrameRate: maxFrameRate,
                maxFrameRate,
                minBitRate,
                maxBitRate,
                keyFrameInterval: KEY_FRAME_INTERVAL_MS,
            },
            frameRateFloor: hints?.minFrameRate ?? Math.min(1, maxFrameRate),
        },
    };
}

/** Every window asks for a single frame rate: cameras refuse a range reaching below a floor they do not publish. */
export function withFrameRate(envelope: VideoEnvelope, frameRate: number): VideoEnvelope {
    return { ...envelope, minFrameRate: frameRate, maxFrameRate: frameRate };
}

/**
 * Halves each side (a quarter of the pixels), which is how encoders step resolution down, never below
 * `floor` on either side.
 */
export function halveResolution(resolution: Resolution, floor: Resolution): Resolution {
    return clampUp(scaleToPixels(resolution, pixels(resolution) / 4), floor);
}

/** Equal in every field a retry step can lower. */
export function sameVideoEnvelope(a: VideoEnvelope, b: VideoEnvelope): boolean {
    return (
        a.maxBitRate === b.maxBitRate &&
        a.maxFrameRate === b.maxFrameRate &&
        a.maxResolution.width === b.maxResolution.width &&
        a.maxResolution.height === b.maxResolution.height
    );
}

function pixelRate(resolution: Resolution, frameRate: number): number {
    return pixels(resolution) * frameRate;
}

export interface VideoPixelRateBudget {
    maxEncodedPixelRate: number | undefined;
    videoStreams: AllocatedVideoStream[];
    snapshotStreams: AllocatedSnapshotStream[];
}

export interface BudgetedVideoEnvelope {
    envelope: VideoEnvelope;
    /** Absent when the budget lowered no ceiling, which includes a camera that states no budget. */
    narrowed?: VideoBudgetNarrowing;
}

/**
 * Narrows into what is left of `MaxEncodedPixelRate` (§11.2.7.2): frame size first, down to the
 * resolution floor, and frame rate only after that, since its floor is the one cameras do not publish.
 * Never below `frameRateFloor`; a conflict goes to the device (§11.2.1.2.2). A budget already fully
 * spent narrows nothing.
 */
export function budgetVideoEnvelope(
    envelope: VideoEnvelope,
    budget: VideoPixelRateBudget,
    frameRateFloor: number,
): BudgetedVideoEnvelope {
    const { maxEncodedPixelRate } = budget;
    if (maxEncodedPixelRate === undefined) return { envelope };
    // The spec states no per-stream formula; this is the reference server's accounting
    // (CameraAVStreamManagementCluster.cpp, IsResourceAvailableForStreamAllocation).
    const committed =
        budget.videoStreams.reduce((total, stream) => total + pixelRate(stream.maxResolution, stream.maxFrameRate), 0) +
        budget.snapshotStreams
            .filter(stream => stream.encodedPixels)
            .reduce((total, stream) => total + pixelRate(stream.maxResolution, stream.frameRate), 0);
    const free = maxEncodedPixelRate - committed;
    if (free <= 0) return { envelope };

    const maxResolution = clampUp(
        scaleToPixels(envelope.maxResolution, free / envelope.maxFrameRate),
        envelope.minResolution,
    );
    const affordable = Math.max(1, Math.floor(free / pixels(maxResolution)));
    const maxFrameRate = Math.max(frameRateFloor, Math.min(envelope.maxFrameRate, affordable));
    const budgeted = { ...withFrameRate(envelope, maxFrameRate), maxResolution };

    const rateLowered = maxFrameRate < envelope.maxFrameRate;
    const sizeLowered = !fitsUnder(envelope.maxResolution, maxResolution);
    if (!rateLowered && !sizeLowered) return { envelope: budgeted };
    return {
        envelope: budgeted,
        narrowed: {
            ...(rateLowered ? { maxFrameRate: envelope.maxFrameRate } : {}),
            ...(sizeLowered ? { maxResolution: envelope.maxResolution } : {}),
        },
    };
}

function contains(outer: { min: number; max: number }, inner: { min: number; max: number }): boolean {
    return inner.min >= outer.min && inner.max <= outer.max;
}

/** Per dimension: areas would ignore aspect ratio. */
function resolutionContains(
    outer: { min: Resolution; max: Resolution },
    inner: { min: Resolution; max: Resolution },
): boolean {
    return (
        inner.min.width >= outer.min.width &&
        inner.min.height >= outer.min.height &&
        inner.max.width <= outer.max.width &&
        inner.max.height <= outer.max.height
    );
}

/** Hard at the reuse and degraded rungs; the allocate rungs carry these bounds in the envelope. */
export function satisfiesVideoCallerBounds(candidate: AllocatedVideoStream, bounds: VideoCallerBounds): boolean {
    const limits = bounds.limits;
    if (candidate.videoCodec !== limits.codec) return false;
    if (!overlaysMatch(candidate.overlays, bounds.overlays)) return false;
    if (candidate.streamUsage !== bounds.streamUsage) return false;
    if (limits.maxPixels !== undefined && pixels(candidate.maxResolution) > limits.maxPixels) return false;
    const offerCeiling = offerFrameRateCeiling(limits, candidate.maxResolution);
    if (offerCeiling !== undefined && candidate.maxFrameRate > offerCeiling) return false;
    if (limits.maxBitRate !== undefined && candidate.maxBitRate > limits.maxBitRate) return false;
    if (bounds.minResolution !== undefined && !fitsUnder(bounds.minResolution, candidate.minResolution)) return false;
    if (bounds.maxResolution !== undefined && !fitsUnder(candidate.maxResolution, bounds.maxResolution)) return false;
    if (bounds.minFrameRate !== undefined && candidate.minFrameRate < bounds.minFrameRate) return false;
    if (bounds.maxFrameRate !== undefined && candidate.maxFrameRate > bounds.maxFrameRate) return false;
    if (bounds.minBitRate !== undefined && candidate.minBitRate < bounds.minBitRate) return false;
    if (bounds.maxBitRate !== undefined && candidate.maxBitRate > bounds.maxBitRate) return false;
    return true;
}

/**
 * The stream must reach the plan's frame rate and may go down to `frameRateFloor`, so a slow stream
 * never stands in for the best one the request asked for.
 */
function fitsPlan(candidate: AllocatedVideoStream, plan: VideoPlan): boolean {
    const envelope = plan.envelope;
    return (
        candidate.maxFrameRate === envelope.maxFrameRate &&
        overlaysMatch(candidate.overlays, envelope.overlays) &&
        resolutionContains(
            { min: envelope.minResolution, max: envelope.maxResolution },
            { min: candidate.minResolution, max: candidate.maxResolution },
        ) &&
        contains(
            { min: plan.frameRateFloor, max: envelope.maxFrameRate },
            { min: candidate.minFrameRate, max: candidate.maxFrameRate },
        ) &&
        contains(
            { min: envelope.minBitRate, max: envelope.maxBitRate },
            { min: candidate.minBitRate, max: candidate.maxBitRate },
        )
    );
}

/** The candidate's range must lie inside the plan's, not merely overlap it. */
export function findReusableVideoStream(
    streams: AllocatedVideoStream[],
    plan: VideoPlan,
    bounds: VideoCallerBounds,
): AllocatedVideoStream | undefined {
    const candidates = streams.filter(
        candidate => satisfiesVideoCallerBounds(candidate, bounds) && fitsPlan(candidate, plan),
    );

    // Starting an encoder is the expensive part, so a stream already running wins.
    return candidates.sort((a, b) => b.referenceCount - a.referenceCount)[0];
}

/** For when nothing can be allocated (`degraded: true`). Ignores the envelope, keeps the caller's bounds. */
export function findDegradedVideoStream(
    streams: AllocatedVideoStream[],
    bounds: VideoCallerBounds,
): AllocatedVideoStream | undefined {
    const candidates = streams.filter(candidate => satisfiesVideoCallerBounds(candidate, bounds));

    // Prefer the most capable stream, since this rung is already a compromise.
    return candidates.sort((a, b) => pixels(b.maxResolution) - pixels(a.maxResolution))[0];
}

const DEFAULT_AUDIO_BIT_RATE = 64000;

export interface AudioCapabilities {
    supportedCodecs: number[];
    maxNumberOfChannels: number;
    supportedSampleRates: number[];
    supportedBitDepths: number[];
}

/** Exact values, each a hard bound. */
export interface AudioHints {
    /** Codec names as SDP rtpmap advertises them, e.g. "OPUS" (matches VideoHints.codecs). */
    codecs?: string[];
    channelCount?: number;
    sampleRate?: number;
    bitRate?: number;
}

export interface AudioCallerBounds extends AudioHints {
    streamUsage: number;
}

export function satisfiesAudioCallerBounds(candidate: AllocatedAudioStream, bounds: AudioCallerBounds): boolean {
    if (candidate.streamUsage !== bounds.streamUsage) return false;
    if (bounds.codecs !== undefined && !bounds.codecs.includes(audioCodecName(candidate.audioCodec))) return false;
    if (bounds.channelCount !== undefined && candidate.channelCount !== bounds.channelCount) return false;
    if (bounds.sampleRate !== undefined && candidate.sampleRate !== bounds.sampleRate) return false;
    if (bounds.bitRate !== undefined && candidate.bitRate !== bounds.bitRate) return false;
    return true;
}

export interface AudioEnvelopeArgs {
    capabilities: AudioCapabilities;
    sdp: SdpVideoConstraints | undefined;
    hints: AudioHints | undefined;
}

/** `envelope: undefined` means no codec is left; the caller decides whether that is a failure. */
export type AudioSelection =
    | { readonly envelope: AudioEnvelope | undefined }
    | {
          readonly unsatisfiable: "bounds";
          readonly field: "sample_rate" | "channel_count";
          readonly requested: string;
          /** What the device states for the field: its ceiling, or the set of values it accepts. */
          readonly limit: string;
      };

export function computeAudioEnvelope(args: AudioEnvelopeArgs): AudioSelection {
    const { capabilities, sdp, hints } = args;

    // Checked before codec narrowing, so the caller hears about the value it can change.
    if (hints?.sampleRate !== undefined && !capabilities.supportedSampleRates.includes(hints.sampleRate)) {
        return {
            unsatisfiable: "bounds",
            field: "sample_rate",
            requested: String(hints.sampleRate),
            limit: capabilities.supportedSampleRates.join(", "),
        };
    }
    if (hints?.channelCount !== undefined && hints.channelCount > capabilities.maxNumberOfChannels) {
        return {
            unsatisfiable: "bounds",
            field: "channel_count",
            requested: String(hints.channelCount),
            limit: String(capabilities.maxNumberOfChannels),
        };
    }

    let codecs = capabilities.supportedCodecs;
    const offered = sdp === undefined ? undefined : receivableCodecs(sdp.audio);
    if (offered !== undefined) {
        codecs = codecs.filter(codec => offered.includes(audioCodecName(codec)));
    }
    if (hints?.codecs !== undefined) {
        const hintCodecs = hints.codecs;
        codecs = codecs.filter(codec => hintCodecs.includes(audioCodecName(codec)));
    }
    const codec = codecs[0];
    if (codec === undefined) return { envelope: undefined };

    return {
        envelope: {
            codec,
            channelCount: hints?.channelCount ?? capabilities.maxNumberOfChannels,
            sampleRate: hints?.sampleRate ?? Math.max(...capabilities.supportedSampleRates),
            bitRate: hints?.bitRate ?? DEFAULT_AUDIO_BIT_RATE,
            bitDepth: Math.max(...capabilities.supportedBitDepths),
        },
    };
}

/**
 * Candidates are what `VideoStreamDeallocate` (§11.2.8.7.2) accepts: unreferenced and not `Internal`,
 * whoever allocated them. Order: this server's own streams first, then lowest in `StreamUsagePriorities`
 * (§11.2.7.19, highest first). A usage missing from `priorities` is taken last within its ownership group.
 */
export function chooseEvictionVictim(
    streams: AllocatedVideoStream[],
    priorities: number[],
    ours: (stream: AllocatedVideoStream) => boolean,
): AllocatedVideoStream | undefined {
    const rankOf = (stream: AllocatedVideoStream): number => priorities.indexOf(stream.streamUsage);
    const candidates = streams.filter(
        stream => stream.referenceCount === 0 && stream.streamUsage !== StreamUsage.Internal,
    );
    return candidates.sort((a, b) => Number(ours(b)) - Number(ours(a)) || rankOf(b) - rankOf(a))[0];
}
