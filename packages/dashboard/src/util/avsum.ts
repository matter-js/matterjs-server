/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterClient, MatterNode } from "@matter-server/ws-client";
import { asObject, pickNumber, pickString } from "./attribute-shapes.js";

/** Camera AV Settings User Level Management cluster (spec 1.5.1 §11.3). */
export const AVSUM_CLUSTER_ID = 1362; // 0x0552

// Attribute IDs (spec §11.3.6).
const ATTR_MPTZ_POSITION = 0;
const ATTR_MAX_PRESETS = 1;
const ATTR_MPTZ_PRESETS = 2;
const ATTR_DPTZ_STREAMS = 3;
const ATTR_ZOOM_MAX = 4;
const ATTR_TILT_MIN = 5;
const ATTR_TILT_MAX = 6;
const ATTR_PAN_MIN = 7;
const ATTR_PAN_MAX = 8;
const ATTR_MOVEMENT_STATE = 9;
const ATTR_FEATURE_MAP = 0xfffc;

// Feature bits.
export const AVSUM_FEAT_DPTZ = 1 << 0;
export const AVSUM_FEAT_MPAN = 1 << 1;
export const AVSUM_FEAT_MTILT = 1 << 2;
export const AVSUM_FEAT_MZOOM = 1 << 3;
export const AVSUM_FEAT_MPRESETS = 1 << 4;

export interface AvsumFeatures {
    dptz: boolean;
    mPan: boolean;
    mTilt: boolean;
    mZoom: boolean;
    mPresets: boolean;
}

export interface MptzPosition {
    pan: number | null;
    tilt: number | null;
    zoom: number | null;
}

export interface MptzRanges {
    panMin: number | null;
    panMax: number | null;
    tiltMin: number | null;
    tiltMax: number | null;
    zoomMax: number | null;
}

export type MovementState = "idle" | "moving" | "unknown";

export interface MptzPreset {
    presetId: number;
    name: string;
    settings: { pan: number | null; tilt: number | null; zoom: number | null };
}

export interface DptzStreamEntry {
    videoStreamId: number;
}

function readAttr(node: MatterNode, endpoint: number, attrId: number): unknown {
    return node.attributes[`${endpoint}/${AVSUM_CLUSTER_ID}/${attrId}`];
}

export function readFeatures(node: MatterNode, endpoint: number): AvsumFeatures {
    const fm = readAttr(node, endpoint, ATTR_FEATURE_MAP);
    const bits = typeof fm === "number" ? fm : 0;
    return {
        dptz: (bits & AVSUM_FEAT_DPTZ) !== 0,
        mPan: (bits & AVSUM_FEAT_MPAN) !== 0,
        mTilt: (bits & AVSUM_FEAT_MTILT) !== 0,
        mZoom: (bits & AVSUM_FEAT_MZOOM) !== 0,
        mPresets: (bits & AVSUM_FEAT_MPRESETS) !== 0,
    };
}

function pickFieldNumber(obj: Record<string, unknown>, named: string, tagId: string): number | null {
    return pickNumber(obj, named) ?? pickNumber(obj, tagId);
}

export function readPosition(node: MatterNode, endpoint: number): MptzPosition {
    const obj = asObject(readAttr(node, endpoint, ATTR_MPTZ_POSITION));
    if (!obj) return { pan: null, tilt: null, zoom: null };
    return {
        pan: pickFieldNumber(obj, "pan", "0"),
        tilt: pickFieldNumber(obj, "tilt", "1"),
        zoom: pickFieldNumber(obj, "zoom", "2"),
    };
}

export function readRanges(node: MatterNode, endpoint: number): MptzRanges {
    const v = (id: number): number | null => {
        const x = readAttr(node, endpoint, id);
        return typeof x === "number" ? x : null;
    };
    return {
        panMin: v(ATTR_PAN_MIN),
        panMax: v(ATTR_PAN_MAX),
        tiltMin: v(ATTR_TILT_MIN),
        tiltMax: v(ATTR_TILT_MAX),
        zoomMax: v(ATTR_ZOOM_MAX),
    };
}

export function readMovementState(node: MatterNode, endpoint: number): MovementState {
    const v = readAttr(node, endpoint, ATTR_MOVEMENT_STATE);
    if (v === 0) return "idle";
    if (v === 1) return "moving";
    return "unknown";
}

export function readPresets(node: MatterNode, endpoint: number): { items: MptzPreset[]; max: number } {
    const max = readAttr(node, endpoint, ATTR_MAX_PRESETS);
    const raw = readAttr(node, endpoint, ATTR_MPTZ_PRESETS);
    const items = new Array<MptzPreset>();
    if (Array.isArray(raw)) {
        for (const item of raw) {
            const obj = asObject(item);
            if (!obj) continue;
            const presetId = pickFieldNumber(obj, "presetId", "0");
            const name = pickString(obj, "name") ?? pickString(obj, "1");
            const settings = asObject(obj["settings"] ?? obj["2"]);
            if (presetId === null || name === null) continue;
            items.push({
                presetId,
                name,
                settings: {
                    pan: settings ? pickFieldNumber(settings, "pan", "0") : null,
                    tilt: settings ? pickFieldNumber(settings, "tilt", "1") : null,
                    zoom: settings ? pickFieldNumber(settings, "zoom", "2") : null,
                },
            });
        }
    }
    return { items, max: typeof max === "number" ? max : 0 };
}

export function readDptzStreams(node: MatterNode, endpoint: number): DptzStreamEntry[] {
    const raw = readAttr(node, endpoint, ATTR_DPTZ_STREAMS);
    if (!Array.isArray(raw)) return [];
    const out = new Array<DptzStreamEntry>();
    for (const item of raw) {
        const obj = asObject(item);
        if (!obj) continue;
        const id = pickFieldNumber(obj, "videoStreamId", "0");
        if (id !== null) out.push({ videoStreamId: id });
    }
    return out;
}

export async function relativeMove(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    delta: { panDelta?: number; tiltDelta?: number; zoomDelta?: number },
): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, AVSUM_CLUSTER_ID, "MPTZRelativeMove", delta);
}

export async function moveToPreset(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    presetId: number,
): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, AVSUM_CLUSTER_ID, "MPTZMoveToPreset", { presetID: presetId });
}

export async function savePreset(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    name: string,
    presetId?: number,
): Promise<void> {
    const payload: Record<string, unknown> = { name };
    if (presetId !== undefined) payload.presetID = presetId;
    await client.deviceCommand(nodeId, endpoint, AVSUM_CLUSTER_ID, "MPTZSavePreset", payload);
}

export async function removePreset(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    presetId: number,
): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, AVSUM_CLUSTER_ID, "MPTZRemovePreset", { presetID: presetId });
}

export async function dptzRelativeMove(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    streamId: number,
    delta: { deltaX?: number; deltaY?: number; zoomDelta?: number },
): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, AVSUM_CLUSTER_ID, "DPTZRelativeMove", {
        videoStreamID: streamId,
        ...delta,
    });
}

export function hasAvsumOnEndpoint(node: MatterNode, endpoint: number): boolean {
    const prefix = `${endpoint}/${AVSUM_CLUSTER_ID}/`;
    return Object.keys(node.attributes).some(k => k.startsWith(prefix));
}
