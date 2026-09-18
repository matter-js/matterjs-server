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
