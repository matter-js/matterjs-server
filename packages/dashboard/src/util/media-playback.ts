/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterNode } from "@matter-server/ws-client";
import { tagField, toNumber } from "./attribute-shapes.js";

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

/** PlaybackStateEnum, spec §10.4.4.1. */
export const enum PlaybackState {
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

/** SampledPosition.position (field tag 1, spec §6.10.5.4.2), in milliseconds. */
export function readPositionMs(node: MatterNode, endpoint: number): number | null {
    return toNumber(tagField(readAttr(node, endpoint, ATTR_SAMPLED_POSITION), 1)) ?? null;
}

/** Duration, in milliseconds, or null when the device reports no duration (e.g. a live stream). */
export function readDurationMs(node: MatterNode, endpoint: number): number | null {
    return toNumber(readAttr(node, endpoint, ATTR_DURATION)) ?? null;
}

export function readPlaybackSpeed(node: MatterNode, endpoint: number): number | null {
    return toNumber(readAttr(node, endpoint, ATTR_PLAYBACK_SPEED)) ?? null;
}

/** mm:ss for anything under an hour, hh:mm:ss beyond that. */
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
