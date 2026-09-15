/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterClient, MatterNode } from "@matter-server/ws-client";
import { asObject, pickNumber, tagField, toNumber } from "./attribute-shapes.js";

export const MEDIA_PLAYBACK_CLUSTER_ID = 1286; // 0x0506

const ATTR_CURRENT_STATE = 0;
const ATTR_DURATION = 2;
const ATTR_SAMPLED_POSITION = 3;
const ATTR_PLAYBACK_SPEED = 4;
const ATTR_ACCEPTED_COMMAND_LIST = 0xfff9;

export const PLAY_COMMAND_ID = 0;
export const PAUSE_COMMAND_ID = 1;
export const STOP_COMMAND_ID = 2;
export const START_OVER_COMMAND_ID = 3;
export const PREVIOUS_COMMAND_ID = 4;
export const NEXT_COMMAND_ID = 5;
export const REWIND_COMMAND_ID = 6;
export const FAST_FORWARD_COMMAND_ID = 7;
export const SKIP_FORWARD_COMMAND_ID = 8;
export const SKIP_BACKWARD_COMMAND_ID = 9;

/** PlaybackStateEnum. */
export enum PlaybackState {
    Playing = 0,
    Paused = 1,
    NotPlaying = 2,
    Buffering = 3,
}

function readAttr(node: MatterNode, endpoint: number, attrId: number): unknown {
    return node.attributes[`${endpoint}/${MEDIA_PLAYBACK_CLUSTER_ID}/${attrId}`];
}

export function readCurrentState(node: MatterNode, endpoint: number): PlaybackState | null {
    const value = toNumber(readAttr(node, endpoint, ATTR_CURRENT_STATE));
    return value === undefined ? null : value;
}

export function formatPlaybackState(state: PlaybackState | null): string {
    switch (state) {
        case PlaybackState.Playing:
            return "Playing";
        case PlaybackState.Paused:
            return "Paused";
        case PlaybackState.NotPlaying:
            return "Not playing";
        case PlaybackState.Buffering:
            return "Buffering";
        default:
            return "Unknown";
    }
}

/** SampledPosition.Position (field tag 1), in milliseconds. */
export function readPositionMs(node: MatterNode, endpoint: number): number | null {
    return toNumber(tagField(readAttr(node, endpoint, ATTR_SAMPLED_POSITION), 1)) ?? null;
}

/** Duration, in milliseconds, or null when the device reports no duration (e.g. a live stream). */
export function readDurationMs(node: MatterNode, endpoint: number): number | null {
    return toNumber(readAttr(node, endpoint, ATTR_DURATION)) ?? null;
}

/**
 * PlaybackSpeed is a float32, so a device reporting 0.1x decodes to 0.10000000149011612; round it to
 * the two decimals the spec's 1/16 speed steps need. A stopped player reports 0, which is not a speed.
 */
export function readPlaybackSpeed(node: MatterNode, endpoint: number): number | null {
    const speed = toNumber(readAttr(node, endpoint, ATTR_PLAYBACK_SPEED));
    if (speed === undefined || speed === 0) return null;
    return Math.round(speed * 100) / 100;
}

/** m:ss for anything under an hour, h:mm:ss beyond that. */
export function formatDurationMs(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

export function supportsCommand(node: MatterNode, endpoint: number, commandId: number): boolean {
    const accepted = readAttr(node, endpoint, ATTR_ACCEPTED_COMMAND_LIST);
    return Array.isArray(accepted) && accepted.map(value => Number(value)).includes(commandId);
}

/** PlaybackResponse.Status. */
const PLAYBACK_STATUS_NAMES: Record<number, string> = {
    0: "Success",
    1: "Invalid state for command",
    2: "Not allowed",
    3: "Not active",
    4: "Speed out of range",
    5: "Seek out of range",
};

/**
 * Every transport command answers with PlaybackResponse, and a non-Success status is a successful
 * invoke at the interaction layer — the caller only learns the device refused from the payload.
 * Command responses are name-keyed (convertMatterToWebSocketNameBased), unlike attributes.
 */
export async function invokeTransportCommand(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    command: string,
    payload: Record<string, unknown> = {},
): Promise<void> {
    const response = await client.deviceCommand(nodeId, endpoint, MEDIA_PLAYBACK_CLUSTER_ID, command, payload);
    const status = pickNumber(asObject(response) ?? {}, "status");
    if (status !== null && status !== 0) {
        throw new Error(`${command} rejected: ${PLAYBACK_STATUS_NAMES[status] ?? `status ${status}`}`);
    }
}

/** The delta the skip form would send, or null when the field holds no submittable value. */
export function parseSkipMs(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const ms = Number(trimmed);
    if (!Number.isSafeInteger(ms) || ms < 1) return null;
    return ms;
}
