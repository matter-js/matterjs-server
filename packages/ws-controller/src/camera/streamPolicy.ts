/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { CameraAvStreamManagement } from "@matter/main/clusters/camera-av-stream-management";
import type { AudioEnvelope, Resolution, VideoEnvelope } from "./cameraTypes.js";
import type { SdpVideoConstraints } from "./sdpConstraints.js";

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

export interface VideoHints {
    minResolution?: Resolution;
    maxResolution?: Resolution;
    minFrameRate?: number;
    maxFrameRate?: number;
    minBitRate?: number;
    maxBitRate?: number;
    codecs?: string[];
}

export interface VideoEnvelopeArgs {
    capabilities: VideoCapabilities;
    codec: number;
    sdp: SdpVideoConstraints | undefined;
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
 * The range to allocate a video stream in.
 *
 * Wide by default: the camera is required to use the highest resolution and bitrate the network
 * supports and to adapt for concurrent viewers (spec 15.2.1.2.2), so the server's job is to leave it
 * room rather than pick a point inside the range. Each step narrows only; nothing here widens past
 * what the camera reports.
 */
export function computeVideoEnvelope(args: VideoEnvelopeArgs): VideoEnvelope {
    const { capabilities, codec, sdp, hints } = args;

    let maxResolution = capabilities.sensor;
    let maxFrameRate = capabilities.maxFrameRate;

    if (sdp?.maxPixels !== undefined) {
        maxResolution = scaleToPixels(maxResolution, sdp.maxPixels);
    }
    if (hints?.maxResolution !== undefined) {
        maxResolution = clampDown(maxResolution, hints.maxResolution);
    }
    if (sdp?.maxPixelsPerSecond !== undefined) {
        maxFrameRate = Math.max(1, Math.min(maxFrameRate, Math.floor(sdp.maxPixelsPerSecond / pixels(maxResolution))));
    }
    if (hints?.maxFrameRate !== undefined) {
        maxFrameRate = Math.min(maxFrameRate, hints.maxFrameRate);
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

    let minResolution = capabilities.minViewport ?? smallestPoint ?? maxResolution;
    minResolution = clampDown(minResolution, maxResolution);
    if (hints?.minResolution !== undefined) {
        minResolution = clampDown(clampUp(minResolution, hints.minResolution), maxResolution);
    }

    const minFrameRate = Math.min(hints?.minFrameRate ?? 1, maxFrameRate);

    // The trade-off point at or just below the ceiling states the bitrate that resolution needs.
    const applicable = codecPoints
        .filter(point => fitsUnder(point.resolution, maxResolution))
        .sort((a, b) => pixels(b.resolution) - pixels(a.resolution))[0];
    // Every stated ceiling binds; the default applies only when the camera, the SDP and the caller
    // all state none. The floor then clamps down to the ceiling, never the ceiling up to the floor.
    const ceilings = [hints?.maxBitRate, sdp?.maxBitRate, capabilities.maxNetworkBandwidth].filter(
        (value): value is number => value !== undefined,
    );
    const maxBitRate = ceilings.length > 0 ? Math.min(...ceilings) : DEFAULT_MAX_BIT_RATE;
    const minBitRate = Math.min(hints?.minBitRate ?? applicable?.minBitRate ?? 1, maxBitRate);

    return {
        codec,
        minResolution,
        maxResolution,
        minFrameRate,
        maxFrameRate,
        minBitRate,
        maxBitRate,
        keyFrameInterval: LIVE_VIEW_KEY_FRAME_INTERVAL_MS,
    };
}

export interface AllocatedVideoStream {
    videoStreamId: number;
    streamUsage: number;
    videoCodec: number;
    minResolution: Resolution;
    maxResolution: Resolution;
    minFrameRate: number;
    maxFrameRate: number;
    minBitRate: number;
    maxBitRate: number;
    referenceCount: number;
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
 * An allocated stream that satisfies the request, or none.
 *
 * Containment, not overlap: the request's minimum is a floor on delivered quality, so a stream
 * allocated [720p..1080p] does not satisfy a request for 1080p even though the ranges intersect.
 * Covering the request is the device's own dedup rule (spec 15.2.1.2.1), not a client's acceptance
 * rule.
 */
export function findReusableVideoStream(
    streams: AllocatedVideoStream[],
    envelope: VideoEnvelope,
    streamUsage: number,
    options?: { ignoreStreamUsage?: boolean },
): AllocatedVideoStream | undefined {
    const candidates = streams.filter(candidate => {
        if (candidate.videoCodec !== envelope.codec) return false;
        if (options?.ignoreStreamUsage !== true && candidate.streamUsage !== streamUsage) return false;
        if (
            !resolutionContains(
                { min: envelope.minResolution, max: envelope.maxResolution },
                { min: candidate.minResolution, max: candidate.maxResolution },
            )
        ) {
            return false;
        }
        return contains(
            { min: envelope.minFrameRate, max: envelope.maxFrameRate },
            { min: candidate.minFrameRate, max: candidate.maxFrameRate },
        );
    });

    // Starting an encoder is the expensive part, so a stream already running wins.
    return candidates.sort((a, b) => b.referenceCount - a.referenceCount)[0];
}

/**
 * A stream to hand out when nothing can be allocated, or none.
 *
 * Matches against the bounds the caller actually stated, not the envelope the server computed: a
 * degraded result may give up a default the server chose, never a constraint the caller set. A fully
 * pinned caller therefore matches nothing here and receives a typed failure.
 */
export function findDegradedVideoStream(
    streams: AllocatedVideoStream[],
    codec: number,
    callerBounds: VideoHints,
): AllocatedVideoStream | undefined {
    const candidates = streams.filter(candidate => {
        if (candidate.videoCodec !== codec) return false;
        if (
            callerBounds.minResolution !== undefined &&
            (candidate.minResolution.width < callerBounds.minResolution.width ||
                candidate.minResolution.height < callerBounds.minResolution.height)
        ) {
            return false;
        }
        if (
            callerBounds.maxResolution !== undefined &&
            (candidate.maxResolution.width > callerBounds.maxResolution.width ||
                candidate.maxResolution.height > callerBounds.maxResolution.height)
        ) {
            return false;
        }
        if (callerBounds.minFrameRate !== undefined && candidate.minFrameRate < callerBounds.minFrameRate) {
            return false;
        }
        if (callerBounds.maxFrameRate !== undefined && candidate.maxFrameRate > callerBounds.maxFrameRate) {
            return false;
        }
        return true;
    });

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

/**
 * SDP rtpmap names for the AudioCodecEnum values MicrophoneCapabilities reports.
 *
 * Only the names are written here: matter.js spells the members `Opus` and `AacLc`, SDP spells them
 * `OPUS` and `AAC`, so the mapping cannot be derived from the enum, but every numeric value comes
 * from it.
 */
const AUDIO_CODEC_NAMES = new Map<CameraAvStreamManagement.AudioCodec, string>([
    [CameraAvStreamManagement.AudioCodec.Opus, "OPUS"],
    [CameraAvStreamManagement.AudioCodec.AacLc, "AAC"],
]);

const DEFAULT_AUDIO_BIT_RATE = 64000;

export interface AudioCapabilities {
    supportedCodecs: number[];
    maxNumberOfChannels: number;
    supportedSampleRates: number[];
    supportedBitDepths: number[];
    /** A {@link CameraAvStreamManagement.TwoWayTalkSupportType} value. */
    twoWayTalkSupport: number;
}

export interface AudioHints {
    /** Codec names as SDP rtpmap advertises them, e.g. "OPUS" (matches VideoHints.codecs). */
    codecs?: string[];
    channelCount?: number;
    sampleRate?: number;
    bitRate?: number;
}

export interface AudioEnvelopeArgs {
    capabilities: AudioCapabilities;
    sdp: SdpVideoConstraints | undefined;
    hints: AudioHints | undefined;
    wantsTalkback: boolean;
}

/**
 * Parameters for an audio stream, or none when no codec suits both sides.
 *
 * Audio is optional in a way video is not: a caller that cannot agree on a codec gets a video-only
 * session rather than a failed one, so this reports absence instead of throwing.
 */
export function computeAudioEnvelope(args: AudioEnvelopeArgs): AudioEnvelope | undefined {
    const { capabilities, sdp, hints } = args;

    let codecs = capabilities.supportedCodecs;
    if (sdp !== undefined && sdp.hasAudio) {
        codecs = codecs.filter(codec => {
            const name = AUDIO_CODEC_NAMES.get(codec);
            return name !== undefined && sdp.audioCodecs.includes(name);
        });
    }
    if (hints?.codecs !== undefined) {
        const hintCodecs = hints.codecs;
        const preferred = codecs.filter(codec => {
            const name = AUDIO_CODEC_NAMES.get(codec);
            return name !== undefined && hintCodecs.includes(name);
        });
        codecs = preferred.length > 0 ? preferred : new Array<number>();
    }
    const codec = codecs[0];
    if (codec === undefined) return undefined;

    const sampleRate =
        hints?.sampleRate !== undefined && capabilities.supportedSampleRates.includes(hints.sampleRate)
            ? hints.sampleRate
            : Math.max(...capabilities.supportedSampleRates);

    return {
        codec,
        channelCount: Math.min(
            hints?.channelCount ?? capabilities.maxNumberOfChannels,
            capabilities.maxNumberOfChannels,
        ),
        sampleRate,
        bitRate: hints?.bitRate ?? DEFAULT_AUDIO_BIT_RATE,
        bitDepth: Math.max(...capabilities.supportedBitDepths),
    };
}
