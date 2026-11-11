/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterClient } from "@matter-server/ws-client";
import { toBoolean, toNumber } from "./attribute-shapes.js";
import { CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID } from "./camera.js";
import { requireAttributeWriteSuccess } from "./matter-status.js";

export { CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID };

const ATTR_ALLOCATED_VIDEO_STREAMS = 0x0f;
const ATTR_ALLOCATED_AUDIO_STREAMS = 0x10;
const ATTR_ALLOCATED_SNAPSHOT_STREAMS = 0x11;
const ATTR_HARD_PRIVACY_MODE_ON = 0x15;
const ATTR_FEATURE_MAP = 0xfffc;

/** CameraAvStreamManagement FeatureMap bits per Matter 1.6 §11.2.5. */
const FEATURE_AUDIO = 1 << 0;
const FEATURE_VIDEO = 1 << 1;
const FEATURE_SNAPSHOT = 1 << 2;
const FEATURE_PRIVACY = 1 << 3;
const FEATURE_SPEAKER = 1 << 4;
const FEATURE_HIGH_DYNAMIC_RANGE = 1 << 9;
const FEATURE_NIGHT_VISION = 1 << 10;

/** TriStateAutoEnum per Matter 1.6 §11.2.6.5. */
export const NIGHT_VISION_NAMES: Record<number, string> = {
    0: "Off",
    1: "On",
    2: "Auto",
};

/** Value type of each writable setting the panel offers. */
export interface CameraSettingValues {
    microphoneMuted: boolean;
    speakerMuted: boolean;
    hdrModeEnabled: boolean;
    statusLightEnabled: boolean;
    softRecordingPrivacyModeEnabled: boolean;
    softLivestreamPrivacyModeEnabled: boolean;
    nightVision: number;
}

export type CameraSetting = keyof CameraSettingValues;

export type CameraSwitchSetting = Exclude<CameraSetting, "nightVision">;

const SETTING_ATTRIBUTES: Record<CameraSetting, { attributeId: number; name: string }> = {
    microphoneMuted: { attributeId: 0x1d, name: "MicrophoneMuted" },
    speakerMuted: { attributeId: 0x19, name: "SpeakerMuted" },
    hdrModeEnabled: { attributeId: 0x0d, name: "HDRModeEnabled" },
    statusLightEnabled: { attributeId: 0x27, name: "StatusLightEnabled" },
    softRecordingPrivacyModeEnabled: { attributeId: 0x13, name: "SoftRecordingPrivacyModeEnabled" },
    softLivestreamPrivacyModeEnabled: { attributeId: 0x14, name: "SoftLivestreamPrivacyModeEnabled" },
    nightVision: { attributeId: 0x16, name: "NightVision" },
};

export interface CameraAvStreamManagementFeatures {
    audio: boolean;
    video: boolean;
    snapshot: boolean;
    privacy: boolean;
    speaker: boolean;
    highDynamicRange: boolean;
    nightVision: boolean;
}

/**
 * Decoded CameraAvStreamManagement settings. A setting is `undefined` when it is not reported; a feature-gated setting
 * is always `undefined` when its feature bit is clear. The writable settings use the keys of {@link CameraSettingValues}.
 */
export interface CameraAvStreamManagementInfo extends Partial<CameraSettingValues> {
    supported: boolean;
    features: CameraAvStreamManagementFeatures;
    hardPrivacyModeOn?: boolean;
    allocatedStreams: { video?: number; audio?: number; snapshot?: number };
}

function attr(attributes: Record<string, unknown>, endpoint: number, attributeId: number): unknown {
    return attributes[`${endpoint}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/${attributeId}`];
}

function listLength(value: unknown): number | undefined {
    return Array.isArray(value) ? value.length : undefined;
}

export function cameraAvStreamManagementInfo(
    attributes: Record<string, unknown>,
    endpoint: number,
): CameraAvStreamManagementInfo {
    const featureMap = toNumber(attr(attributes, endpoint, ATTR_FEATURE_MAP));
    const has = (bit: number) => ((featureMap ?? 0) & bit) !== 0;
    const features: CameraAvStreamManagementFeatures = {
        audio: has(FEATURE_AUDIO),
        video: has(FEATURE_VIDEO),
        snapshot: has(FEATURE_SNAPSHOT),
        privacy: has(FEATURE_PRIVACY),
        speaker: has(FEATURE_SPEAKER),
        highDynamicRange: has(FEATURE_HIGH_DYNAMIC_RANGE),
        nightVision: has(FEATURE_NIGHT_VISION),
    };
    const setting = (key: CameraSetting) => attr(attributes, endpoint, SETTING_ATTRIBUTES[key].attributeId);
    const when = <T>(enabled: boolean, value: T): T | undefined => (enabled ? value : undefined);

    return {
        supported: featureMap !== undefined,
        features,
        microphoneMuted: when(features.audio, toBoolean(setting("microphoneMuted"))),
        speakerMuted: when(features.speaker, toBoolean(setting("speakerMuted"))),
        hdrModeEnabled: when(features.highDynamicRange, toBoolean(setting("hdrModeEnabled"))),
        statusLightEnabled: toBoolean(setting("statusLightEnabled")),
        softRecordingPrivacyModeEnabled: when(features.privacy, toBoolean(setting("softRecordingPrivacyModeEnabled"))),
        softLivestreamPrivacyModeEnabled: when(
            features.privacy,
            toBoolean(setting("softLivestreamPrivacyModeEnabled")),
        ),
        nightVision: when(features.nightVision, toNumber(setting("nightVision"))),
        hardPrivacyModeOn: toBoolean(attr(attributes, endpoint, ATTR_HARD_PRIVACY_MODE_ON)),
        allocatedStreams: {
            video: when(features.video, listLength(attr(attributes, endpoint, ATTR_ALLOCATED_VIDEO_STREAMS))),
            audio: when(features.audio, listLength(attr(attributes, endpoint, ATTR_ALLOCATED_AUDIO_STREAMS))),
            snapshot: when(features.snapshot, listLength(attr(attributes, endpoint, ATTR_ALLOCATED_SNAPSHOT_STREAMS))),
        },
    };
}

/**
 * One on/off control of the panel. `on` is `undefined` while the value is unknown. An inverted switch is on when the
 * attribute is false, so the microphone and speaker switches read "on" when they are not muted.
 */
export interface CameraSwitch {
    setting: CameraSwitchSetting;
    label: string;
    section: "general" | "privacy";
    inverted: boolean;
    on?: boolean;
}

/** The switches the camera supports, in display order. */
export function cameraSwitches(info: CameraAvStreamManagementInfo): CameraSwitch[] {
    const switches = new Array<CameraSwitch>();
    const add = (
        enabled: boolean,
        setting: CameraSwitchSetting,
        label: string,
        section: CameraSwitch["section"],
        inverted = false,
    ) => {
        if (!enabled) return;
        const value = info[setting];
        switches.push({ setting, label, section, inverted, on: value === undefined ? undefined : value !== inverted });
    };
    add(info.features.audio, "microphoneMuted", "Microphone", "general", true);
    add(info.features.speaker, "speakerMuted", "Speaker", "general", true);
    add(info.features.highDynamicRange, "hdrModeEnabled", "HDR", "general");
    add(info.statusLightEnabled !== undefined, "statusLightEnabled", "Status light", "general");
    add(info.features.privacy, "softRecordingPrivacyModeEnabled", "Recording privacy", "privacy");
    add(info.features.privacy, "softLivestreamPrivacyModeEnabled", "Live view privacy", "privacy");
    return switches;
}

/** The attribute value to write when the user sets the switch to `on`. */
export function switchWriteValue(cameraSwitch: CameraSwitch, on: boolean): boolean {
    return on !== cameraSwitch.inverted;
}

/** Writes one setting; rejects with the device's status when the write fails. */
export async function writeCameraSetting<K extends CameraSetting>(
    client: Pick<MatterClient, "writeAttribute">,
    nodeId: number | bigint,
    endpoint: number,
    setting: K,
    value: CameraSettingValues[K],
): Promise<void> {
    const { attributeId, name } = SETTING_ATTRIBUTES[setting];
    requireAttributeWriteSuccess(
        await client.writeAttribute(
            nodeId,
            `${endpoint}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/${attributeId}`,
            value,
        ),
        `Writing the ${name} attribute failed`,
    );
}
