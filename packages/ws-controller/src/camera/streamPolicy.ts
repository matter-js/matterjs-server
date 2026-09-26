/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { StreamUsage } from "@matter/main/types";
import type {
    AllocatedAudioStream,
    AllocatedVideoStream,
    AudioEnvelope,
    Resolution,
    VideoEnvelope,
} from "./cameraTypes.js";
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

/**
 * The video ranges a caller may state.
 *
 * Every field here is a bound on what the caller is willing to be given, so none of them may be
 * given up on its behalf. An absent field is the opposite: a choice the caller left to the server.
 */
export interface VideoRangeBounds {
    minResolution?: Resolution;
    maxResolution?: Resolution;
    minFrameRate?: number;
    maxFrameRate?: number;
    minBitRate?: number;
    maxBitRate?: number;
}

export interface VideoHints extends VideoRangeBounds {
    codecs?: string[];
}

/**
 * Everything the caller stated about the video stream it asked for.
 *
 * `limits` is what the caller's own offer stated its peer can decode, carrying the codec that
 * `codecs` and the offer already resolved to; `streamUsage` is mandatory on the wire. All three are
 * always stated and all three are checked unconditionally. The offer's limits belong here rather
 * than in the envelope alone because they are a decode ceiling: a rung that gives up the envelope
 * may not hand out video the peer cannot decode.
 */
export interface VideoCallerBounds extends VideoRangeBounds {
    limits: SelectedVideoCodecLimits;
    streamUsage: number;
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
    };
}

/**
 * What the caller stated about one track.
 *
 * Three statements, three values. `declined` is `video: false` / `audio: false`, `deferred` is the
 * key left out, and `demanded` is the key present — an object, however empty — carrying whatever
 * bounds came with it. Collapsing `demanded` into `deferred` is what lets a stated request be
 * answered with a null track and no error, so the three never share a value and
 * {@link statedHints} is the only way to read the bounds back.
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

/**
 * Clamp `resolution` under `ceiling` on each dimension.
 *
 * `VideoStreamAllocate` validates width and height separately and answers ConstraintError when
 * `minResolution` exceeds `maxResolution` on either; `resolutionContains` below states why comparing
 * pixel areas cannot stand in for that.
 */
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
 * The frame rate the offer's limits allow at `resolution`, or none when they state neither.
 *
 * Can be 0, which is a resolution the peer cannot decode at any rate an encoder runs at. Rounding
 * that up to 1 was widening a bound the peer stated, and this is a decode ceiling: a stream past it
 * is not a slow picture, it is no picture. {@link computeVideoEnvelope} answers it by shrinking the
 * resolution into the pixel-rate budget first, so the rate it allocates at is never 0;
 * {@link satisfiesVideoCallerBounds} answers it by refusing every candidate at that resolution.
 * Both read this one function so the rate the server allocates at and the rate it accepts a
 * candidate at cannot drift apart.
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
 * The envelope to allocate in, or the caller floor that nothing available reaches.
 *
 * `limit` is the ceiling in force after every narrowing, whoever stated it — the sensor, the offer or
 * the caller's own ceiling — so it is reported as a limit rather than as something the camera said.
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
 * The range to allocate a video stream in.
 *
 * Wide by default: the camera is required to use the highest resolution and bitrate the network
 * supports and to adapt for concurrent viewers (spec 15.2.1.2.2), so the server's job is to leave it
 * room rather than pick a point inside the range. Each step narrows only; nothing here widens past
 * what the camera reports.
 *
 * A floor the caller stated is as hard as a ceiling: when the sensor, the offer or the caller's own
 * ceiling puts it out of reach, the request fails instead of silently returning less than was asked
 * for. Floors the server derived — the viewport minimum, a trade-off point's bit rate, frame rate 1 —
 * still clamp down, since giving those up gives up nothing the caller stated.
 */
export function computeVideoEnvelope(args: VideoEnvelopeArgs): VideoSelection {
    const { capabilities, limits, hints } = args;
    const codec = limits.codec;

    let maxResolution = capabilities.sensor;
    let maxFrameRate = capabilities.maxFrameRate;

    // Order matters: spending the offer's pixel budget on the sensor's aspect ratio first lands on
    // dimensions the caller's ceiling then cuts again, failing a request the peer can decode.
    if (hints?.maxResolution !== undefined) {
        maxResolution = clampDown(maxResolution, hints.maxResolution);
    }
    if (limits.maxPixels !== undefined) {
        maxResolution = scaleToPixels(maxResolution, limits.maxPixels);
    }
    if (limits.maxPixelsPerSecond !== undefined) {
        // A stream runs at one frame per second at the very least, so the peer's pixel-rate budget
        // is a frame-size ceiling too. Spending it on size here is what keeps the rate below from
        // having to be rounded up past what the peer said it can decode.
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
    // A floor derived from the trade-off points must be one the camera actually advertised, so this
    // picks the smallest point by area rather than composing a per-dimension minimum the camera never
    // stated. The clamp below then makes it fit the ceiling on each dimension.
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
    // Every stated ceiling binds; the default applies only when the camera, the SDP and the caller
    // all state none.
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
    // A trade-off point's floor can exceed the bandwidth the same camera states. Pinning min to max
    // there takes capacity from every other viewer (spec 15.2.1.2.2) for a bound nobody asked for.
    const derivedBitRateFloor = applicable?.minBitRate ?? 1;
    const minBitRate = hints?.minBitRate ?? (derivedBitRateFloor <= maxBitRate ? derivedBitRateFloor : 1);

    return {
        envelope: {
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

function contains(outer: { min: number; max: number }, inner: { min: number; max: number }): boolean {
    return inner.min >= outer.min && inner.max <= outer.max;
}

/**
 * Whether `inner` fits inside `outer` on both dimensions independently.
 *
 * Pixel-count containment is not enough: a 1920x1080 request and an allocated 1440x1440 stream have
 * the same pixel count but different aspect ratios, so comparing areas would silently hand out square
 * video for a widescreen request.
 */
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
 * Whether `candidate` satisfies every bound the caller stated.
 *
 * The one gate every rung passes before it may hand a stream out. Which rung found a candidate is
 * not something the caller stated, so it cannot change what the caller is willing to accept: a rung
 * may give up the envelope the server computed and the defaults the server filled in, and nothing
 * here. A bound the caller left unstated is not a bound — that choice was the server's to make.
 *
 * The offer's `a=fmtp` limits are checked here rather than only in the envelope: they state what the
 * peer can decode, so a stream past them is video that arrives and does not play. The envelope is a
 * preference a rung may trade away; a decode ceiling is not.
 */
export function satisfiesVideoCallerBounds(candidate: AllocatedVideoStream, bounds: VideoCallerBounds): boolean {
    const limits = bounds.limits;
    if (candidate.videoCodec !== limits.codec) return false;
    // stream_usage is the only mandatory argument of camera_start_stream. Handing a Recording stream
    // to a LiveView caller substitutes the one thing every caller states.
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
 * An allocated stream as good as the one the server would have allocated, or none.
 *
 * Containment, not overlap: the request's minimum is a floor on delivered quality, so a stream
 * allocated [720p..1080p] does not satisfy a request for 1080p even though the ranges intersect.
 * Covering the request is the device's own dedup rule (spec 15.2.1.2.1), not a client's acceptance
 * rule. A candidate outside the computed envelope but inside the caller's own bounds is not refused
 * outright — it is what {@link findDegradedVideoStream} hands out, flagged, once allocation has
 * failed.
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
 * A stream to hand out when nothing can be allocated, or none.
 *
 * The rung that gives up the computed envelope and keeps the caller's bounds, which is what
 * `degraded: true` reports. The more the caller stated, the less this rung has left to give up: with
 * everything pinned it accepts only what the sensor narrowed the envelope by, and a caller that
 * stated neither bounds nor an offer is the one that can be handed a stream far outside the request.
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
        // Per dimension, so the ceiling can never drop below the floor on one axis while the areas
        // still compare the other way — the device rejects that envelope with ConstraintError.
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

/**
 * The audio values a caller may state.
 *
 * Audio has no ranges: the device states a set of sample rates and a channel maximum, so a caller
 * states one exact value. Each is as hard as a video bound — a value the device cannot meet fails
 * rather than being replaced by one the caller did not ask for.
 */
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

/**
 * Whether `candidate` satisfies every bound the caller stated. The audio counterpart of
 * {@link satisfiesVideoCallerBounds}, and equally the only gate the reuse rung may not skip.
 */
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
 * An audio envelope, no envelope, or the caller value the device cannot meet.
 *
 * `envelope: undefined` means no audio stream can be described — the camera, the offer or the
 * caller's own codec list left no codec. Whether that is a video-only session or a failure is not
 * decided here: it depends on whether the caller asked for audio at all, which
 * {@link CameraStreamManager} knows and this function does not.
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

/**
 * Parameters for an audio stream.
 *
 * Every value the caller stated is hard, as every video bound is: a sample rate the device does not
 * list and a channel count above its maximum fail rather than being replaced by a value the caller
 * did not ask for. Those two are checked before any codec narrowing, so a caller learns about the
 * value it can change rather than about a codec list the offer happened to empty first.
 */
export function computeAudioEnvelope(args: AudioEnvelopeArgs): AudioSelection {
    const { capabilities, sdp, hints } = args;

    // Ahead of the codec narrowing: a value the camera cannot serve is the caller's to correct
    // whatever the offer then leaves, and naming the codec instead would send it after the wrong one.
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
 * A video stream eviction may take over, or none.
 *
 * `VideoStreamDeallocate` (§11.2.8.7.2) refuses exactly three things: an id it does not know,
 * `ReferenceCount > 0`, and StreamUsage Internal. It checks neither who allocated the stream nor
 * which fabric asks, so a stream nobody is using is the camera's to give to whoever needs it — and a
 * controller that refused to take one over would let one client pin every encoder with streams
 * nobody is watching.
 *
 * `priorities` is the camera's own `StreamUsagePriorities` (§11.2.7.19), highest priority at index
 * 0, so the victim is the candidate furthest down that list: a stream whose usage this camera ranks
 * higher is never taken while a lower-ranked one is free. Which usage that is belongs to the camera
 * and its administrator, not to this server — §11.2.8.12 lets `SetStreamPriorities` reorder it, so
 * no ordering may be assumed here. A usage the list does not carry is taken last rather than first:
 * the camera states nothing about it, and destroying what cannot be reasoned about is the one
 * outcome with no way back. `ours` breaks a tie the ranking leaves open, so a foreign stream is
 * touched only when an equally ranked one of this server's own is not there to take instead.
 */
export function chooseEvictionVictim(
    streams: AllocatedVideoStream[],
    priorities: number[],
    ours: (stream: AllocatedVideoStream) => boolean,
): AllocatedVideoStream | undefined {
    // -1 for a usage the list does not carry, which sorts it behind every ranked candidate.
    const rankOf = (stream: AllocatedVideoStream): number => priorities.indexOf(stream.streamUsage);
    const candidates = streams.filter(
        stream => stream.referenceCount === 0 && stream.streamUsage !== StreamUsage.Internal,
    );
    return candidates.sort((a, b) => rankOf(b) - rankOf(a) || Number(ours(b)) - Number(ours(a)))[0];
}
