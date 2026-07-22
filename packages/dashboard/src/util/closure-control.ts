/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterClient, MatterNode } from "@matter-server/ws-client";
import { asObject, pickNumber } from "./attribute-shapes.js";

/** ClosureControl cluster (Matter spec §5.4). */
export const CLOSURE_CONTROL_CLUSTER_ID = 260; // 0x0104

const ATTR_COUNTDOWN_TIME = 0;
const ATTR_MAIN_STATE = 1;
const ATTR_CURRENT_ERROR_LIST = 2;
const ATTR_OVERALL_CURRENT_STATE = 3;
const ATTR_OVERALL_TARGET_STATE = 4;
const ATTR_LATCH_CONTROL_MODES = 5;
const ATTR_FEATURE_MAP = 0xfffc;

export const MAIN_STATE_LABELS: Record<number, string> = {
    0: "Stopped",
    1: "Moving",
    2: "Waiting for motion",
    3: "Error",
    4: "Calibrating",
    5: "Protected",
    6: "Disengaged",
    7: "Setup required",
};

export const CLOSURE_ERROR_LABELS: Record<number, string> = {
    0: "Physically blocked",
    1: "Blocked by sensor",
    2: "Temperature limited",
    3: "Maintenance required",
    4: "Internal interference",
};

export const TARGET_POSITION_LABELS: Record<number, string> = {
    0: "Fully closed",
    1: "Fully open",
    2: "Pedestrian",
    3: "Ventilation",
    4: "Signature",
};

export const SPEED_LABELS: Record<number, string> = {
    0: "Auto",
    1: "Low",
    2: "Medium",
    3: "High",
};

export interface ClosureFeatures {
    positioning: boolean;
    motionLatching: boolean;
    instantaneous: boolean;
    speed: boolean;
    ventilation: boolean;
    pedestrian: boolean;
    calibration: boolean;
    protection: boolean;
    manuallyOperable: boolean;
}

export interface ClosureState {
    position: number | null;
    latch: boolean | null;
    speed: number | null;
}

export interface ClosureCurrentState extends ClosureState {
    secureState: boolean | null;
}

function readAttr(node: MatterNode, endpoint: number, attrId: number): unknown {
    return node.attributes[`${endpoint}/${CLOSURE_CONTROL_CLUSTER_ID}/${attrId}`];
}

/** ClosureControl FeatureMap bits per Matter spec §5.4.5 (PS=0, LT=1, IS=2, SP=3, VT=4, PD=5, CL=6, PT=7, MO=8). */
export function parseClosureFeatures(featureMap: number): ClosureFeatures {
    return {
        positioning: (featureMap & (1 << 0)) !== 0,
        motionLatching: (featureMap & (1 << 1)) !== 0,
        instantaneous: (featureMap & (1 << 2)) !== 0,
        speed: (featureMap & (1 << 3)) !== 0,
        ventilation: (featureMap & (1 << 4)) !== 0,
        pedestrian: (featureMap & (1 << 5)) !== 0,
        calibration: (featureMap & (1 << 6)) !== 0,
        protection: (featureMap & (1 << 7)) !== 0,
        manuallyOperable: (featureMap & (1 << 8)) !== 0,
    };
}

export function readFeatures(node: MatterNode, endpoint: number): ClosureFeatures {
    const v = readAttr(node, endpoint, ATTR_FEATURE_MAP);
    return parseClosureFeatures(typeof v === "number" ? v : 0);
}

export function readMainState(node: MatterNode, endpoint: number): number | null {
    const v = readAttr(node, endpoint, ATTR_MAIN_STATE);
    return typeof v === "number" ? v : null;
}

export function readCurrentErrorList(node: MatterNode, endpoint: number): number[] {
    const raw = readAttr(node, endpoint, ATTR_CURRENT_ERROR_LIST);
    return Array.isArray(raw) ? raw.filter((v): v is number => typeof v === "number" && Number.isFinite(v)) : [];
}

export function readCountdownTime(node: MatterNode, endpoint: number): number | null {
    const v = readAttr(node, endpoint, ATTR_COUNTDOWN_TIME);
    return typeof v === "number" ? v : null;
}

function readBoolField(obj: Record<string, unknown>, name: string, tag: string): boolean | null {
    const v = obj[name] ?? obj[tag];
    return typeof v === "boolean" ? v : null;
}

export function readOverallCurrentState(node: MatterNode, endpoint: number): ClosureCurrentState | null {
    const obj = asObject(readAttr(node, endpoint, ATTR_OVERALL_CURRENT_STATE));
    if (!obj) return null;
    return {
        position: pickNumber(obj, "position", "0"),
        latch: readBoolField(obj, "latch", "1"),
        speed: pickNumber(obj, "speed", "2"),
        secureState: readBoolField(obj, "secureState", "3"),
    };
}

export function readOverallTargetState(node: MatterNode, endpoint: number): ClosureState | null {
    const obj = asObject(readAttr(node, endpoint, ATTR_OVERALL_TARGET_STATE));
    if (!obj) return null;
    return {
        position: pickNumber(obj, "position", "0"),
        latch: readBoolField(obj, "latch", "1"),
        speed: pickNumber(obj, "speed", "2"),
    };
}

export interface LatchControlModes {
    remoteLatching: boolean;
    remoteUnlatching: boolean;
}

/** Whether the latch mechanism accepts remote (un)latch requests, vs. manual-only per spec §5.4.6.7. */
export function readLatchControlModes(node: MatterNode, endpoint: number): LatchControlModes {
    const v = readAttr(node, endpoint, ATTR_LATCH_CONTROL_MODES);
    const bitmap = typeof v === "number" ? v : 0;
    return {
        remoteLatching: (bitmap & (1 << 0)) !== 0,
        remoteUnlatching: (bitmap & (1 << 1)) !== 0,
    };
}

export async function stop(client: MatterClient, nodeId: number | bigint, endpoint: number): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, CLOSURE_CONTROL_CLUSTER_ID, "Stop", {});
}

export async function calibrate(client: MatterClient, nodeId: number | bigint, endpoint: number): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, CLOSURE_CONTROL_CLUSTER_ID, "Calibrate", {});
}

export interface MoveToParams {
    position?: number;
    latch?: boolean;
    speed?: number;
}

export async function moveTo(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    params: MoveToParams,
): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (params.position !== undefined) payload.position = params.position;
    if (params.latch !== undefined) payload.latch = params.latch;
    if (params.speed !== undefined) payload.speed = params.speed;
    await client.deviceCommand(nodeId, endpoint, CLOSURE_CONTROL_CLUSTER_ID, "MoveTo", payload);
}
