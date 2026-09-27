/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { CameraAvStreamManagement } from "@matter/main/clusters/camera-av-stream-management";
import { StreamUsage } from "@matter/main/types";
import type { CameraFeatures } from "./cameraTypes.js";

/**
 * Wire names of the camera cluster enums. Every name `camera_get_capabilities` reports must be accepted
 * back by `camera_start_stream` and `camera_snapshot`. The names are written out because matter.js
 * member names (`Hevc`, `AacLc`, …) differ from the SDP spelling (`H265`, `AAC`, …).
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

function namesOfEnum(enumeration: Record<string, string | number>): Map<number, string> {
    const names = new Map<number, string>();
    for (const [name, value] of Object.entries(enumeration)) {
        if (typeof value === "number") names.set(value, name);
    }
    return names;
}

const STREAM_USAGE_NAMES = namesOfEnum(StreamUsage);
const TWO_WAY_TALK_SUPPORT_NAMES = namesOfEnum(CameraAvStreamManagement.TwoWayTalkSupportType);

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

/** Also accepts the decimal spelling {@link imageCodecName} reports for a codec this build does not name. */
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

/** Only member names are accepted, so a usage the server cannot check never reaches the device. */
export function streamUsageByName(name: string): number | undefined {
    return wireValue(STREAM_USAGE_NAMES, name);
}

export function twoWayTalkSupportName(support: number): string {
    return wireName(TWO_WAY_TALK_SUPPORT_NAMES, support);
}

/**
 * Flag name -> spec Feature title and FeatureMap bit. Relies on matter.js naming each flag as the
 * uncapitalized title, and on the enum's declaration order being the bit order.
 */
const FEATURE_TITLES = new Map<string, { title: string; bit: number }>(
    Object.values(CameraAvStreamManagement.Feature).map((title, bit) => [
        `${title.charAt(0).toLowerCase()}${title.slice(1)}`,
        { title, bit },
    ]),
);

/**
 * The features the camera advertises, as the spec's Feature titles, in bit order. A flag with no known
 * title is reported under its flag name, last.
 */
export function advertisedFeatureNames(features: CameraFeatures): string[] {
    const advertised = new Array<{ name: string; bit: number }>();
    for (const [flag, supported] of Object.entries(features)) {
        if (supported !== true) continue;
        const known = FEATURE_TITLES.get(flag);
        advertised.push({ name: known?.title ?? flag, bit: known?.bit ?? Number.MAX_SAFE_INTEGER });
    }
    return advertised.sort((left, right) => left.bit - right.bit).map(entry => entry.name);
}

/** One feature's reported name, for the error that says a camera does not advertise it. */
export function featureName(feature: keyof CameraFeatures): string {
    return FEATURE_TITLES.get(feature)?.title ?? feature;
}
