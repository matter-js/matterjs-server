/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Encoder-budget planning for concurrent camera video + snapshot streams.
 *
 * A Matter camera reserves encoder capacity per allocated stream as
 * `maxFrameRate × width × height` (px/s) and enforces a ceiling advertised as
 * the CameraAVStreamManagement `MaxEncodedPixelRate` attribute (0x0001). A live
 * video stream that reserves the entire budget makes a concurrent
 * SnapshotStreamAllocate fail with `ResourceExhausted` (status 0x89). These
 * helpers choose a video frame rate that leaves room for a snapshot stream.
 */

export interface Resolution {
    width: number;
    height: number;
}

/** Live view is capped at 60 fps — higher rates buy nothing and starve the snapshot budget. */
export const VIDEO_MAX_FRAME_RATE = 60;
/** Never propose a video frame rate below this while a snapshot can still fit. */
export const VIDEO_MIN_FRAME_RATE = 30;

export function pixelRate(res: Resolution, frameRate: number): number {
    return res.width * res.height * frameRate;
}

export interface VideoFrameRatePlan {
    /** MaxEncodedPixelRate in px/s, or null when the camera doesn't advertise it. */
    maxEncodedPixelRate: number | null;
    /** MaxResolution the video stream will reserve. */
    videoResolution: Resolution;
    /** px/s a concurrent snapshot stream needs; 0 when no snapshot draws from the budget. */
    snapshotReservation: number;
}

/**
 * Pick a video `maxFrameRate` that keeps `snapshotReservation` px/s free within the
 * camera's `MaxEncodedPixelRate`. Falls back to {@link VIDEO_MAX_FRAME_RATE} when the
 * budget is unknown. When video + snapshot cannot both fit, video is given the whole
 * budget (best effort — a concurrent snapshot may then still be refused).
 */
export function planVideoMaxFrameRate(plan: VideoFrameRatePlan): number {
    const { maxEncodedPixelRate: budget, videoResolution, snapshotReservation } = plan;
    const videoPixels = videoResolution.width * videoResolution.height;
    if (!budget || budget <= 0 || videoPixels <= 0) return VIDEO_MAX_FRAME_RATE;

    const withSnapshot = Math.floor((budget - snapshotReservation) / videoPixels);
    if (withSnapshot >= VIDEO_MIN_FRAME_RATE) {
        return Math.min(withSnapshot, VIDEO_MAX_FRAME_RATE);
    }
    const videoOnly = Math.floor(budget / videoPixels);
    return Math.min(Math.max(videoOnly, 1), VIDEO_MAX_FRAME_RATE);
}

/**
 * Whether reserving a candidate video stream still leaves room for a concurrent snapshot.
 * Used to reject reuse of an over-budget (e.g. 120 fps) stream. Unknown budget, or no
 * snapshot reservation, accepts any candidate.
 */
export function videoStreamFitsSnapshotBudget(args: {
    maxEncodedPixelRate: number | null;
    candidateResolution: Resolution;
    candidateFrameRate: number;
    snapshotReservation: number;
}): boolean {
    const { maxEncodedPixelRate: budget, candidateResolution, candidateFrameRate, snapshotReservation } = args;
    if (!budget || budget <= 0 || snapshotReservation <= 0) return true;
    return pixelRate(candidateResolution, candidateFrameRate) + snapshotReservation <= budget;
}
