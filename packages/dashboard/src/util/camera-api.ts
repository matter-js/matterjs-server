/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    CAMERA_NOT_SUPPORTED_ERROR_CODE,
    CAMERA_PRIVACY_MODE_ERROR_CODE,
    CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE,
    CAMERA_STREAM_IN_USE_ERROR_CODE,
    CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE,
    type CameraCapabilitiesResult,
    type CameraPrivacyMode,
    type CameraResolution,
    type CameraStartStreamResult,
    type CameraStartStreamVideoResult,
    type CameraStreamKind,
    type CameraVideoHints,
    ServerCommandError,
} from "@matter-server/ws-client";
import { errorText } from "./error-text.js";

export interface CameraStreamRef {
    kind: CameraStreamKind;
    stream_id: number;
}

/** What the user picked in the camera overlay; a null resolution is "Auto". */
export interface CameraStreamChoices {
    maxResolution: CameraResolution | null;
    watermarkEnabled: boolean;
    osdEnabled: boolean;
}

function distinctResolutions(resolutions: CameraResolution[]): CameraResolution[] {
    const seen = new Map<string, CameraResolution>();
    for (const { width, height } of resolutions) {
        const key = `${width}x${height}`;
        if (!seen.has(key)) seen.set(key, { width, height });
    }
    return [...seen.values()].sort((a, b) => b.width * b.height - a.width * a.height);
}

const COMMON_VIDEO_SIZES: CameraResolution[] = [
    { width: 640, height: 360 },
    { width: 640, height: 480 },
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 3840, height: 2160 },
];

/**
 * Common sizes from the camera's minimum viewport up to its sensor, each sent as `max_resolution`.
 * Nothing without a reported sensor size: the list would be a guess.
 */
export function videoResolutionOptions(caps: CameraCapabilitiesResult | null): CameraResolution[] {
    const sensor = caps?.video.sensor;
    if (sensor === undefined) return [];
    const floor = caps?.video.min_viewport ?? { width: 0, height: 0 };
    return distinctResolutions(
        COMMON_VIDEO_SIZES.filter(
            ({ width, height }) =>
                width >= floor.width && height >= floor.height && width <= sensor.width && height <= sensor.height,
        ),
    );
}

export function snapshotResolutionOptions(caps: CameraCapabilitiesResult | null): CameraResolution[] {
    return distinctResolutions(caps?.snapshot.capabilities.map(capability => capability.resolution) ?? []);
}

const AUTO_OPTION = "auto";

export function resolutionOption(resolution: CameraResolution | null): string {
    return resolution ? `${resolution.width}x${resolution.height}` : AUTO_OPTION;
}

/** Inverse of {@link resolutionOption}; anything that is not `<width>x<height>` reads as "Auto". */
export function parseResolutionOption(value: string): CameraResolution | null {
    const match = /^(\d+)x(\d+)$/.exec(value);
    return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

export function hasCameraFeature(caps: CameraCapabilitiesResult | null, feature: string): boolean {
    return caps?.features?.includes(feature) ?? false;
}

/** Only a reported feature list can say the camera has no video; absent `features` means not reported yet. */
export function isAudioOnlyCamera(caps: CameraCapabilitiesResult | null): boolean {
    const features = caps?.features;
    return features !== undefined && !features.includes("Video");
}

/**
 * The `video` argument for `camera_start_stream`; undefined means leave the key out. A camera with the
 * `Video` feature always gets an object, which requires video; an audio-only camera gets `false`. While
 * the features are unknown, video is required only when the user picked a hint. Overlay flags are set
 * only on a camera with that feature.
 */
export function buildVideoRequest(
    caps: CameraCapabilitiesResult | null,
    choices: CameraStreamChoices,
): CameraVideoHints | false | undefined {
    if (isAudioOnlyCamera(caps)) return false;
    const hints: CameraVideoHints = {};
    if (choices.maxResolution) hints.max_resolution = choices.maxResolution;
    if (hasCameraFeature(caps, "Watermark")) hints.watermark_enabled = choices.watermarkEnabled;
    if (hasCameraFeature(caps, "OnScreenDisplay")) hints.osd_enabled = choices.osdEnabled;
    return hasCameraFeature(caps, "Video") || Object.keys(hints).length > 0 ? hints : undefined;
}

export function buildSnapshotOverlays(
    caps: CameraCapabilitiesResult | null,
    choices: Pick<CameraStreamChoices, "watermarkEnabled" | "osdEnabled">,
): { watermark_enabled?: boolean; osd_enabled?: boolean } {
    return {
        ...(hasCameraFeature(caps, "Watermark") ? { watermark_enabled: choices.watermarkEnabled } : {}),
        ...(hasCameraFeature(caps, "OnScreenDisplay") ? { osd_enabled: choices.osdEnabled } : {}),
    };
}

/** Streams the dashboard allocated for this session; `reused` and `adopted` streams belong to others. */
export function streamsToRelease(result: CameraStartStreamResult): CameraStreamRef[] {
    const streams = new Array<CameraStreamRef>();
    if (result.video?.provenance === "allocated") streams.push({ kind: "video", stream_id: result.video.stream_id });
    if (result.audio?.provenance === "allocated") streams.push({ kind: "audio", stream_id: result.audio.stream_id });
    return streams;
}

export function snapshotMimeType(codec: string): string {
    return codec.toUpperCase() === "HEIC" ? "image/heic" : "image/jpeg";
}

export interface CameraQualityBadge {
    label: string;
    detail: string;
}

function formatResolution({ width, height }: CameraResolution): string {
    return `${width}×${height}`;
}

export function streamQualityBadges(video: CameraStartStreamVideoResult | null): CameraQualityBadge[] {
    const badges = new Array<CameraQualityBadge>();
    if (!video) return badges;
    if (video.degraded) {
        badges.push({
            label: "Degraded",
            detail: `Outside the default stream range: up to ${formatResolution(video.resolution.max)} at ${video.frame_rate.max} fps`,
        });
    }
    const narrowed = video.narrowed_by_encoder_budget;
    if (narrowed) {
        const lowered = new Array<string>();
        if (narrowed.max_resolution) {
            lowered.push(
                `resolution ${formatResolution(narrowed.max_resolution)} → ${formatResolution(video.resolution.max)}`,
            );
        }
        if (narrowed.max_frame_rate !== undefined) {
            lowered.push(`frame rate ${narrowed.max_frame_rate} → ${video.frame_rate.max} fps`);
        }
        badges.push({
            label: "Narrowed",
            detail: `Lowered to fit the camera's encoder budget: ${lowered.join(", ")}`,
        });
    }
    return badges;
}

const PRIVACY_MODE_TEXT: Record<CameraPrivacyMode, string> = {
    hard_mode_on: "hardware privacy switch",
    soft_livestream_mode_enabled: "live stream privacy mode",
    soft_recording_mode_enabled: "recording privacy mode",
};

const ERROR_CODE_TEXT: Record<number, string> = {
    [CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE]: "Camera cannot serve the requested stream",
    [CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE]: "Camera has no capacity for this stream",
    [CAMERA_STREAM_IN_USE_ERROR_CODE]: "Stream is still in use",
    [CAMERA_NOT_SUPPORTED_ERROR_CODE]: "Endpoint does not support camera streaming",
    [CAMERA_PRIVACY_MODE_ERROR_CODE]: "Camera privacy mode is enabled",
};

/** A server message that is a JSON object is details the client could not read; never show it raw. */
function serverMessageText(error: ServerCommandError): string {
    let parsed: unknown;
    try {
        parsed = JSON.parse(error.message);
    } catch {
        return error.message;
    }
    if (typeof parsed !== "object" || parsed === null) return error.message;
    if ("message" in parsed && typeof parsed.message === "string") return parsed.message;
    return ERROR_CODE_TEXT[error.errorCode] ?? `Server error ${error.errorCode}`;
}

export function cameraErrorText(error: unknown): string {
    if (!(error instanceof ServerCommandError)) return errorText(error);
    if (error.hasDetails(CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE)) {
        const details = error.details;
        switch (details.reason) {
            case "feature":
                return `${details.message}: ${details.feature}`;
            case "bounds":
                return details.bound
                    ? `${details.message}: ${details.bound.field} ${details.bound.requested} exceeds ${details.bound.limit}`
                    : details.message;
            case "no_media":
                return details.message;
            default:
                return details.track ? `${details.message} (${details.track})` : details.message;
        }
    }
    if (error.hasDetails(CAMERA_PRIVACY_MODE_ERROR_CODE)) {
        const modes = error.details.modes.map(mode => PRIVACY_MODE_TEXT[mode]);
        return modes.length > 0 ? `${error.details.message}: ${modes.join(", ")}` : error.details.message;
    }
    if (error.hasDetails(CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE)) {
        return `${error.details.message}; end other sessions or release streams`;
    }
    if (error.hasDetails(CAMERA_STREAM_IN_USE_ERROR_CODE)) {
        return `${error.details.message} (stream ${error.details.stream_id})`;
    }
    if (error.hasDetails(CAMERA_NOT_SUPPORTED_ERROR_CODE)) {
        const clusters = error.details.missing_clusters.map(id => `0x${id.toString(16).padStart(4, "0")}`);
        return clusters.length > 0 ? `${error.details.message}: missing ${clusters.join(", ")}` : error.details.message;
    }
    return serverMessageText(error);
}
