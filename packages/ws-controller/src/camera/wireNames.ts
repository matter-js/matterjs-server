/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { CameraAvStreamManagement } from "@matter/main/clusters/camera-av-stream-management";
import { StreamUsage } from "@matter/main/types";

/**
 * Wire spelling of the camera cluster enums, so what `camera_get_capabilities` reports can be sent
 * straight back in a `camera_start_stream` hint, a `camera_snapshot` codec or a `stream_usage`. The
 * numeric enum values stay inside the server.
 *
 * Only the names are written here: matter.js spells the members `Hevc`, `Vvc`, `Av1`, `AacLc` and
 * `Jpeg`, while SDP and the wire spell them `H265`, `H266`, `AV1`, `AAC` and `JPEG`, so the mapping
 * cannot be derived from the enum — but every numeric value comes from it.
 */
const VIDEO_CODEC_NAMES = new Map<CameraAvStreamManagement.VideoCodec, string>([
    [CameraAvStreamManagement.VideoCodec.H264, "H264"],
    [CameraAvStreamManagement.VideoCodec.Hevc, "H265"],
    [CameraAvStreamManagement.VideoCodec.Vvc, "H266"],
    [CameraAvStreamManagement.VideoCodec.Av1, "AV1"],
]);

const AUDIO_CODEC_NAMES = new Map<CameraAvStreamManagement.AudioCodec, string>([
    [CameraAvStreamManagement.AudioCodec.Opus, "OPUS"],
    [CameraAvStreamManagement.AudioCodec.AacLc, "AAC"],
]);

const IMAGE_CODEC_NAMES = new Map<CameraAvStreamManagement.ImageCodec, string>([
    [CameraAvStreamManagement.ImageCodec.Jpeg, "JPEG"],
    [CameraAvStreamManagement.ImageCodec.Heic, "HEIC"],
]);

/** Value -> member name for a numeric enum, which TypeScript builds as a two-way object. */
function namesOfEnum(enumeration: Record<string, string | number>): Map<number, string> {
    const names = new Map<number, string>();
    for (const [name, value] of Object.entries(enumeration)) {
        if (typeof value === "number") names.set(value, name);
    }
    return names;
}

const STREAM_USAGE_NAMES = namesOfEnum(StreamUsage);
const TWO_WAY_TALK_SUPPORT_NAMES = namesOfEnum(CameraAvStreamManagement.TwoWayTalkSupportType);

/** A value the cluster enum does not define is reported as its decimal digits rather than dropped. */
function wireName(names: Map<number, string>, value: number): string {
    return names.get(value) ?? String(value);
}

function wireValue(names: Map<number, string>, name: string): number | undefined {
    const wanted = name.toUpperCase();
    for (const [value, known] of names) {
        if (known.toUpperCase() === wanted) return value;
    }
    return undefined;
}

export function videoCodecName(codec: number): string {
    return wireName(VIDEO_CODEC_NAMES, codec);
}

export function audioCodecName(codec: number): string {
    return wireName(AUDIO_CODEC_NAMES, codec);
}

export function imageCodecName(codec: number): string {
    return wireName(IMAGE_CODEC_NAMES, codec);
}

/**
 * The codec set is open: a camera may report a codec this build does not name, so the decimal
 * spelling {@link imageCodecName} falls back to is taken back. A codec the camera does not advertise
 * still fails as a typed codec mismatch before it reaches the device.
 */
export function imageCodecByName(name: string): number | undefined {
    const codec = wireValue(IMAGE_CODEC_NAMES, name);
    if (codec !== undefined) return codec;
    return /^\d+$/.test(name) ? Number(name) : undefined;
}

/** The enum's own video vocabulary, for a camera that advertises no trade-off point to narrow. */
export function knownVideoCodecs(): CameraAvStreamManagement.VideoCodec[] {
    return [...VIDEO_CODEC_NAMES.keys()];
}

export function streamUsageName(usage: number): string {
    return wireName(STREAM_USAGE_NAMES, usage);
}

/**
 * Unlike the codec set, the stream usages are closed: nothing but a member name is accepted, so a
 * usage the server cannot check against the device never reaches `VideoStreamAllocate`.
 */
export function streamUsageByName(name: string): number | undefined {
    return wireValue(STREAM_USAGE_NAMES, name);
}

export function twoWayTalkSupportName(support: number): string {
    return wireName(TWO_WAY_TALK_SUPPORT_NAMES, support);
}
