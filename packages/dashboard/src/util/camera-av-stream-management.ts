/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterClient, MatterNode } from "@matter-server/ws-client";
import { CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID } from "./camera.js";
import { requireAttributeWriteSuccess } from "./matter-status.js";

export { CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID };

const ATTR_HDR_MODE_ENABLED = 0x0d;
const ATTR_ALLOCATED_VIDEO_STREAMS = 0x0f;
const ATTR_ALLOCATED_AUDIO_STREAMS = 0x10;
const ATTR_ALLOCATED_SNAPSHOT_STREAMS = 0x11;
const ATTR_SOFT_RECORDING_PRIVACY_MODE_ENABLED = 0x13;
const ATTR_SOFT_LIVESTREAM_PRIVACY_MODE_ENABLED = 0x14;
const ATTR_HARD_PRIVACY_MODE_ON = 0x15;
const ATTR_NIGHT_VISION = 0x16;
const ATTR_SPEAKER_MUTED = 0x19;
const ATTR_MICROPHONE_MUTED = 0x1d;
const ATTR_STATUS_LIGHT_ENABLED = 0x27;
const ATTR_FEATURE_MAP = 0xfffc;

/** AVSM FeatureMap bits (spec §11.2.5), in the order the Feature enum declares them. */
const FEATURE_AUDIO = 1 << 0;
const FEATURE_VIDEO = 1 << 1;
const FEATURE_SNAPSHOT = 1 << 2;
const FEATURE_PRIVACY = 1 << 3;
const FEATURE_SPEAKER = 1 << 4;
const FEATURE_HIGH_DYNAMIC_RANGE = 1 << 9;
const FEATURE_NIGHT_VISION = 1 << 10;

/** TriStateAutoEnum (spec §11.2.6.5), shared by NightVision and NightVisionIllum. */
export const NIGHT_VISION_LABELS: Record<number, string> = {
    0: "Off",
    1: "On",
    2: "Auto",
};

function readAttr(node: MatterNode, endpoint: number, attrId: number): unknown {
    return node.attributes[`${endpoint}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/${attrId}`];
}

function readBooleanAttr(node: MatterNode, endpoint: number, attrId: number): boolean | null {
    const value = readAttr(node, endpoint, attrId);
    return typeof value === "boolean" ? value : null;
}

function readFeatureMap(node: MatterNode, endpoint: number): number | null {
    const value = readAttr(node, endpoint, ATTR_FEATURE_MAP);
    return typeof value === "number" ? value : null;
}

function hasFeature(node: MatterNode, endpoint: number, bit: number): boolean {
    return ((readFeatureMap(node, endpoint) ?? 0) & bit) !== 0;
}

export function hasAudioFeature(node: MatterNode, endpoint: number): boolean {
    return hasFeature(node, endpoint, FEATURE_AUDIO);
}

export function hasVideoFeature(node: MatterNode, endpoint: number): boolean {
    return hasFeature(node, endpoint, FEATURE_VIDEO);
}

export function hasSnapshotFeature(node: MatterNode, endpoint: number): boolean {
    return hasFeature(node, endpoint, FEATURE_SNAPSHOT);
}

export function hasPrivacyFeature(node: MatterNode, endpoint: number): boolean {
    return hasFeature(node, endpoint, FEATURE_PRIVACY);
}

export function hasSpeakerFeature(node: MatterNode, endpoint: number): boolean {
    return hasFeature(node, endpoint, FEATURE_SPEAKER);
}

export function hasHighDynamicRangeFeature(node: MatterNode, endpoint: number): boolean {
    return hasFeature(node, endpoint, FEATURE_HIGH_DYNAMIC_RANGE);
}

export function hasNightVisionFeature(node: MatterNode, endpoint: number): boolean {
    return hasFeature(node, endpoint, FEATURE_NIGHT_VISION);
}

export function readMicrophoneMuted(node: MatterNode, endpoint: number): boolean | null {
    return readBooleanAttr(node, endpoint, ATTR_MICROPHONE_MUTED);
}

export function readSpeakerMuted(node: MatterNode, endpoint: number): boolean | null {
    return readBooleanAttr(node, endpoint, ATTR_SPEAKER_MUTED);
}

export function readHdrModeEnabled(node: MatterNode, endpoint: number): boolean | null {
    return readBooleanAttr(node, endpoint, ATTR_HDR_MODE_ENABLED);
}

export function readStatusLightEnabled(node: MatterNode, endpoint: number): boolean | null {
    return readBooleanAttr(node, endpoint, ATTR_STATUS_LIGHT_ENABLED);
}

/** Controlled by a physical switch on the camera; read-only from the Matter side. */
export function readHardPrivacyModeOn(node: MatterNode, endpoint: number): boolean | null {
    return readBooleanAttr(node, endpoint, ATTR_HARD_PRIVACY_MODE_ON);
}

export function readSoftRecordingPrivacyModeEnabled(node: MatterNode, endpoint: number): boolean | null {
    return readBooleanAttr(node, endpoint, ATTR_SOFT_RECORDING_PRIVACY_MODE_ENABLED);
}

export function readSoftLivestreamPrivacyModeEnabled(node: MatterNode, endpoint: number): boolean | null {
    return readBooleanAttr(node, endpoint, ATTR_SOFT_LIVESTREAM_PRIVACY_MODE_ENABLED);
}

export function readNightVision(node: MatterNode, endpoint: number): number | null {
    const value = readAttr(node, endpoint, ATTR_NIGHT_VISION);
    return typeof value === "number" ? value : null;
}

export function formatNightVision(nightVision: number | null): string | null {
    return nightVision === null ? null : (NIGHT_VISION_LABELS[nightVision] ?? `Mode ${nightVision}`);
}

function readStreamCount(node: MatterNode, endpoint: number, attrId: number): number | null {
    const value = readAttr(node, endpoint, attrId);
    return Array.isArray(value) ? value.length : null;
}

export function readAllocatedVideoStreamCount(node: MatterNode, endpoint: number): number | null {
    return readStreamCount(node, endpoint, ATTR_ALLOCATED_VIDEO_STREAMS);
}

export function readAllocatedAudioStreamCount(node: MatterNode, endpoint: number): number | null {
    return readStreamCount(node, endpoint, ATTR_ALLOCATED_AUDIO_STREAMS);
}

export function readAllocatedSnapshotStreamCount(node: MatterNode, endpoint: number): number | null {
    return readStreamCount(node, endpoint, ATTR_ALLOCATED_SNAPSHOT_STREAMS);
}

async function writeBooleanAttr(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    attrId: number,
    value: boolean,
    what: string,
): Promise<void> {
    requireAttributeWriteSuccess(
        await client.writeAttribute(nodeId, `${endpoint}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/${attrId}`, value),
        what,
    );
}

export function setMicrophoneMuted(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    muted: boolean,
): Promise<void> {
    return writeBooleanAttr(
        client,
        nodeId,
        endpoint,
        ATTR_MICROPHONE_MUTED,
        muted,
        "Writing the MicrophoneMuted attribute failed",
    );
}

export function setSpeakerMuted(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    muted: boolean,
): Promise<void> {
    return writeBooleanAttr(
        client,
        nodeId,
        endpoint,
        ATTR_SPEAKER_MUTED,
        muted,
        "Writing the SpeakerMuted attribute failed",
    );
}

export function setHdrModeEnabled(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    enabled: boolean,
): Promise<void> {
    return writeBooleanAttr(
        client,
        nodeId,
        endpoint,
        ATTR_HDR_MODE_ENABLED,
        enabled,
        "Writing the HDRModeEnabled attribute failed",
    );
}

export function setStatusLightEnabled(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    enabled: boolean,
): Promise<void> {
    return writeBooleanAttr(
        client,
        nodeId,
        endpoint,
        ATTR_STATUS_LIGHT_ENABLED,
        enabled,
        "Writing the StatusLightEnabled attribute failed",
    );
}

export function setSoftRecordingPrivacyModeEnabled(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    enabled: boolean,
): Promise<void> {
    return writeBooleanAttr(
        client,
        nodeId,
        endpoint,
        ATTR_SOFT_RECORDING_PRIVACY_MODE_ENABLED,
        enabled,
        "Writing the SoftRecordingPrivacyModeEnabled attribute failed",
    );
}

export function setSoftLivestreamPrivacyModeEnabled(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    enabled: boolean,
): Promise<void> {
    return writeBooleanAttr(
        client,
        nodeId,
        endpoint,
        ATTR_SOFT_LIVESTREAM_PRIVACY_MODE_ENABLED,
        enabled,
        "Writing the SoftLivestreamPrivacyModeEnabled attribute failed",
    );
}

export async function setNightVision(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    nightVision: number,
): Promise<void> {
    requireAttributeWriteSuccess(
        await client.writeAttribute(
            nodeId,
            `${endpoint}/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/${ATTR_NIGHT_VISION}`,
            nightVision,
        ),
        "Writing the NightVision attribute failed",
    );
}
