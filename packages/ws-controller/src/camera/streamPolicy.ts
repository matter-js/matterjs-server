/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Resolution, VideoEnvelope } from "./cameraTypes.js";
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

function smallerOf(a: Resolution, b: Resolution): Resolution {
    return pixels(a) <= pixels(b) ? a : b;
}

function largerOf(a: Resolution, b: Resolution): Resolution {
    return pixels(a) >= pixels(b) ? a : b;
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
        maxResolution = smallerOf(maxResolution, hints.maxResolution);
    }
    if (sdp?.maxPixelsPerSecond !== undefined) {
        maxFrameRate = Math.max(1, Math.min(maxFrameRate, Math.floor(sdp.maxPixelsPerSecond / pixels(maxResolution))));
    }
    if (hints?.maxFrameRate !== undefined) {
        maxFrameRate = Math.min(maxFrameRate, hints.maxFrameRate);
    }

    const codecPoints = capabilities.rateDistortionPoints.filter(point => point.codec === codec);
    const smallestPoint = codecPoints.reduce<Resolution | undefined>(
        (smallest, point) => (smallest === undefined ? point.resolution : smallerOf(smallest, point.resolution)),
        undefined,
    );

    let minResolution = capabilities.minViewport ?? smallestPoint ?? maxResolution;
    minResolution = smallerOf(minResolution, maxResolution);
    if (hints?.minResolution !== undefined) {
        minResolution = smallerOf(largerOf(minResolution, hints.minResolution), maxResolution);
    }

    const minFrameRate = Math.min(hints?.minFrameRate ?? 1, maxFrameRate);

    // The trade-off point at or just below the ceiling states the bitrate that resolution needs.
    const applicable = codecPoints
        .filter(point => pixels(point.resolution) <= pixels(maxResolution))
        .sort((a, b) => pixels(b.resolution) - pixels(a.resolution))[0];
    const minBitRate = hints?.minBitRate ?? applicable?.minBitRate ?? 1;
    const maxBitRate = Math.max(
        minBitRate,
        hints?.maxBitRate ?? sdp?.maxBitRate ?? capabilities.maxNetworkBandwidth ?? DEFAULT_MAX_BIT_RATE,
    );

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
    referenceCount: number;
}

function contains(outer: { min: number; max: number }, inner: { min: number; max: number }): boolean {
    return inner.min >= outer.min && inner.max <= outer.max;
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
            !contains(
                { min: pixels(envelope.minResolution), max: pixels(envelope.maxResolution) },
                { min: pixels(candidate.minResolution), max: pixels(candidate.maxResolution) },
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
            pixels(candidate.minResolution) < pixels(callerBounds.minResolution)
        ) {
            return false;
        }
        if (
            callerBounds.maxResolution !== undefined &&
            pixels(candidate.maxResolution) > pixels(callerBounds.maxResolution)
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
    if (pixels(envelope.maxResolution) > pixels(envelope.minResolution)) {
        // Quartering the pixel budget halves each linear dimension, matching how encoders step down resolution.
        const halved = scaleToPixels(envelope.maxResolution, pixels(envelope.maxResolution) / 4);
        const maxResolution = pixels(halved) < pixels(envelope.minResolution) ? envelope.minResolution : halved;
        return { ...envelope, maxResolution };
    }
    if (envelope.maxFrameRate > envelope.minFrameRate && envelope.maxFrameRate > 1) {
        const maxFrameRate = Math.max(envelope.minFrameRate, Math.floor(envelope.maxFrameRate / 2), 1);
        return { ...envelope, maxFrameRate };
    }
    return undefined;
}
