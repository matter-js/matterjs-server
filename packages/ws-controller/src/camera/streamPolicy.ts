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

/** KeyFrameInterval in milliseconds; LiveView favours fast recovery over bitrate. */
const LIVE_VIEW_KEY_FRAME_INTERVAL_MS = 2000;
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

/** The video ranges a caller may state. A stated field is a hard bound; an absent one is left to the server. */
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

/**
 * Everything the caller stated about the video stream it asked for. `limits` is the offer's decode
 * ceiling for the resolved codec, which no ladder rung may give up.
 */
export interface VideoCallerBounds extends VideoRangeBounds {
    limits: SelectedVideoCodecLimits;
    streamUsage: number;
    /** The overlays the caller stated, each absent when it stated nothing about that one. */
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

/**
 * What the caller stated about one track: `declined` is `false`, `deferred` is the key left out,
 * `demanded` is the key present (an object, however empty). A demanded track must not be answered
 * with a null track and no error.
 */
export type TrackRequest<Hints> =
    | { readonly state: "declined" | "deferred" }
    | { readonly state: "demanded"; readonly hints: Hints };

/** Read a caller's `video` / `audio` argument as the three statements it can make. */
export function trackRequest<Hints>(stated: Hints | false | undefined): TrackRequest<Hints> {
    if (stated === false) return { state: "declined" };
    if (stated === undefined) return { state: "deferred" };
    return { state: "demanded", hints: stated };
}

/** The bounds the caller stated for a track, or none when it stated no bounds to honour. */
export function statedHints<Hints>(request: TrackRequest<Hints>): Hints | undefined {
    return request.state === "demanded" ? request.hints : undefined;
}

export interface VideoEnvelopeArgs {
    capabilities: VideoCapabilities;
    /** The codec to allocate for, carrying the offer limits that codec itself stated. */
    limits: SelectedVideoCodecLimits;
    hints: VideoHints | undefined;
    /** The overlay fields to allocate with, as `resolveOverlays` resolved them; not the raw hints. */
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

/**
 * The frame rate the offer's limits allow at `resolution`, or `undefined` when they state none. Can be
 * 0; must not be rounded up, since it is a decode ceiling.
 */
function offerFrameRateCeiling(limits: VideoCodecLimits, resolution: Resolution): number | undefined {
    const ceilings = new Array<number>();
    if (limits.maxPixelsPerSecond !== undefined) {
        ceilings.push(Math.floor(limits.maxPixelsPerSecond / pixels(resolution)));
    }
    if (limits.maxFrameRate !== undefined) ceilings.push(limits.maxFrameRate);
    return ceilings.length === 0 ? undefined : Math.min(...ceilings);
}

/**
 * The envelope to allocate in, or the caller floor that nothing available reaches. `limit` is the
 * ceiling in force after every narrowing (sensor, offer or caller).
 */
export type VideoSelection =
    | { readonly envelope: VideoEnvelope }
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
 * The range to allocate a video stream in. Wide by default, so the camera can adapt (spec §11.2.1.2.2);
 * each step only narrows.
 *
 * A caller-stated floor out of reach fails the request. Server-derived floors (viewport minimum,
 * trade-off point bit rate, frame rate 1) are clamped down instead.
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

    const minFrameRate = hints?.minFrameRate ?? Math.min(1, maxFrameRate);

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
        envelope: {
            overlays,
            codec,
            minResolution,
            maxResolution,
            minFrameRate,
            maxFrameRate,
            minBitRate,
            maxBitRate,
            keyFrameInterval: LIVE_VIEW_KEY_FRAME_INTERVAL_MS,
        },
    };
}

function pixelRate(resolution: Resolution, frameRate: number): number {
    return pixels(resolution) * frameRate;
}

/** What the camera says its encoders can produce, and the streams already drawing on that. */
export interface VideoPixelRateBudget {
    /** `MaxEncodedPixelRate` (§11.2.7.2), or none when the camera states no budget. */
    maxEncodedPixelRate: number | undefined;
    videoStreams: AllocatedVideoStream[];
    snapshotStreams: AllocatedSnapshotStream[];
}

/** {@link budgetVideoEnvelope}'s answer: the envelope to allocate in, and what the budget cost it. */
export interface BudgetedVideoEnvelope {
    envelope: VideoEnvelope;
    /** Absent when the budget lowered no ceiling, which includes a camera that states no budget. */
    narrowed?: VideoBudgetNarrowing;
}

/**
 * `envelope` narrowed into the encoded pixel rate the camera has left (`MaxEncodedPixelRate`,
 * §11.2.7.2), and what that narrowing cost.
 *
 * Only ceilings move, never below the envelope's floors; a conflict goes to the device (§11.2.1.2.2).
 * A budget already fully spent narrows nothing.
 */
export function budgetVideoEnvelope(envelope: VideoEnvelope, budget: VideoPixelRateBudget): BudgetedVideoEnvelope {
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

    const maxResolution = clampUp(scaleToPixels(envelope.maxResolution, free), envelope.minResolution);
    const affordable = Math.max(1, Math.floor(free / pixels(maxResolution)));
    const maxFrameRate = Math.max(envelope.minFrameRate, Math.min(envelope.maxFrameRate, affordable));
    const budgeted = { ...envelope, maxResolution, maxFrameRate };

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

/** Whether `inner` fits inside `outer` on both dimensions independently (areas would ignore aspect ratio). */
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

/**
 * Whether `candidate` satisfies every bound the caller stated, including the offer's decode ceiling.
 * Hard at the reuse and degraded rungs; the allocate rungs carry these bounds in the envelope.
 */
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

/** Whether `candidate` also fits the envelope the server computed, on every dimension the envelope states. */
function fitsComputedEnvelope(candidate: AllocatedVideoStream, envelope: VideoEnvelope): boolean {
    return (
        overlaysMatch(candidate.overlays, envelope.overlays) &&
        resolutionContains(
            { min: envelope.minResolution, max: envelope.maxResolution },
            { min: candidate.minResolution, max: candidate.maxResolution },
        ) &&
        contains(
            { min: envelope.minFrameRate, max: envelope.maxFrameRate },
            { min: candidate.minFrameRate, max: candidate.maxFrameRate },
        ) &&
        contains(
            { min: envelope.minBitRate, max: envelope.maxBitRate },
            { min: candidate.minBitRate, max: candidate.maxBitRate },
        )
    );
}

/**
 * An allocated stream as good as the one the server would have allocated, or none. The candidate's
 * range must lie inside the envelope, not merely overlap it.
 */
export function findReusableVideoStream(
    streams: AllocatedVideoStream[],
    envelope: VideoEnvelope,
    bounds: VideoCallerBounds,
): AllocatedVideoStream | undefined {
    const candidates = streams.filter(
        candidate => satisfiesVideoCallerBounds(candidate, bounds) && fitsComputedEnvelope(candidate, envelope),
    );

    // Starting an encoder is the expensive part, so a stream already running wins.
    return candidates.sort((a, b) => b.referenceCount - a.referenceCount)[0];
}

/**
 * A stream to hand out when nothing can be allocated (`degraded: true`). Ignores the envelope, keeps the
 * caller's bounds.
 */
export function findDegradedVideoStream(
    streams: AllocatedVideoStream[],
    bounds: VideoCallerBounds,
): AllocatedVideoStream | undefined {
    const candidates = streams.filter(candidate => satisfiesVideoCallerBounds(candidate, bounds));

    // Prefer the most capable stream, since this rung is already a compromise.
    return candidates.sort((a, b) => pixels(b.maxResolution) - pixels(a.maxResolution))[0];
}

/** The next envelope to attempt after a device rejection, or none when nothing is left to give up. */
export function narrowEnvelope(envelope: VideoEnvelope): VideoEnvelope | undefined {
    if (!fitsUnder(envelope.maxResolution, envelope.minResolution)) {
        // Quartering the pixel budget halves each linear dimension, matching how encoders step down resolution.
        const halved = scaleToPixels(envelope.maxResolution, pixels(envelope.maxResolution) / 4);
        // Per dimension: a ceiling below the floor on either axis is a ConstraintError.
        const maxResolution = clampUp(halved, envelope.minResolution);
        if (!fitsUnder(envelope.maxResolution, maxResolution)) {
            return { ...envelope, maxResolution };
        }
    }
    if (envelope.maxFrameRate > envelope.minFrameRate && envelope.maxFrameRate > 1) {
        const maxFrameRate = Math.max(envelope.minFrameRate, Math.floor(envelope.maxFrameRate / 2), 1);
        return { ...envelope, maxFrameRate };
    }
    return undefined;
}

const DEFAULT_AUDIO_BIT_RATE = 64000;

export interface AudioCapabilities {
    supportedCodecs: number[];
    maxNumberOfChannels: number;
    supportedSampleRates: number[];
    supportedBitDepths: number[];
}

/** The audio values a caller may state: exact values, each a hard bound. */
export interface AudioHints {
    /** Codec names as SDP rtpmap advertises them, e.g. "OPUS" (matches VideoHints.codecs). */
    codecs?: string[];
    channelCount?: number;
    sampleRate?: number;
    bitRate?: number;
}

/** {@link AudioHints} plus the mandatory `stream_usage`, in the shape a candidate is compared against. */
export interface AudioCallerBounds extends AudioHints {
    streamUsage: number;
}

/** Whether `candidate` satisfies every bound the caller stated; see {@link satisfiesVideoCallerBounds}. */
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

/**
 * An audio envelope, no envelope, or the caller value the device cannot meet. `envelope: undefined`
 * means no codec is left; the caller decides whether that is a failure.
 */
export type AudioSelection =
    | { readonly envelope: AudioEnvelope | undefined }
    | {
          readonly unsatisfiable: "bounds";
          readonly field: "sample_rate" | "channel_count";
          readonly requested: string;
          /** What the device states for the field: its ceiling, or the set of values it accepts. */
          readonly limit: string;
      };

/** Parameters for an audio stream. Every value the caller stated is a hard bound. */
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
 * A video stream eviction may take over, or none. Candidates are what `VideoStreamDeallocate`
 * (§11.2.8.7.2) accepts: unreferenced and not `Internal`, whoever allocated them.
 *
 * Order: this server's own streams before anybody else's (the same rule as `chooseSnapshotStreamToFree`),
 * then lowest in `priorities` (`StreamUsagePriorities`, §11.2.7.19, highest first). A usage missing from
 * `priorities` goes last within its ownership group.
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
