/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterClient, MatterNode } from "@matter-server/ws-client";
import { asObject, pickNumber } from "./attribute-shapes.js";

/** ClosureDimension cluster (Matter spec §5.5). */
export const CLOSURE_DIMENSION_CLUSTER_ID = 261; // 0x0105

const ATTR_CURRENT_STATE = 0;
const ATTR_TARGET_STATE = 1;
const ATTR_RESOLUTION = 2;
const ATTR_STEP_VALUE = 3;
const ATTR_UNIT = 4;
const ATTR_UNIT_RANGE = 5;
const ATTR_LIMIT_RANGE = 6;
const ATTR_TRANSLATION_DIRECTION = 7;
const ATTR_ROTATION_AXIS = 8;
const ATTR_OVERFLOW = 9;
const ATTR_MODULATION_TYPE = 10;
const ATTR_LATCH_CONTROL_MODES = 11;
const ATTR_FEATURE_MAP = 0xfffc;

export const SPEED_LABELS: Record<number, string> = {
    0: "Auto",
    1: "Low",
    2: "Medium",
    3: "High",
};

export const CLOSURE_UNIT_LABELS: Record<number, string> = {
    0: "Millimeter",
    1: "Degree",
};

/** TranslationDirectionEnum (spec §5.5.6.1). */
export const TRANSLATION_DIRECTION_LABELS: Record<number, string> = {
    0: "Downward",
    1: "Upward",
    2: "Vertical mask",
    3: "Vertical symmetry",
    4: "Leftward",
    5: "Rightward",
    6: "Horizontal mask",
    7: "Horizontal symmetry",
    8: "Forward",
    9: "Backward",
    10: "Depth mask",
    11: "Depth symmetry",
};

/** RotationAxisEnum (spec §5.5.6.2). */
export const ROTATION_AXIS_LABELS: Record<number, string> = {
    0: "Left",
    1: "Centered vertical",
    2: "Left and right",
    3: "Right",
    4: "Top",
    5: "Centered horizontal",
    6: "Top and bottom",
    7: "Bottom",
    8: "Left barrier",
    9: "Left and right barriers",
    10: "Right barrier",
};

/** OverflowEnum (spec §5.5.6.3). */
export const OVERFLOW_LABELS: Record<number, string> = {
    0: "No overflow",
    1: "Inside",
    2: "Outside",
    3: "Top inside",
    4: "Top outside",
    5: "Bottom inside",
    6: "Bottom outside",
    7: "Left inside",
    8: "Left outside",
    9: "Right inside",
    10: "Right outside",
};

/** ModulationTypeEnum (spec §5.5.6.4). */
export const MODULATION_TYPE_LABELS: Record<number, string> = {
    0: "Slats orientation",
    1: "Slats openwork",
    2: "Stripes alignment",
    3: "Opacity",
    4: "Ventilation",
};

/** StepDirectionEnum (spec §5.5.6.6). */
export const STEP_DIRECTION_LABELS: Record<number, string> = {
    0: "Decrease",
    1: "Increase",
};

export interface ClosureDimensionFeatures {
    positioning: boolean;
    motionLatching: boolean;
    unit: boolean;
    limitation: boolean;
    speed: boolean;
    translation: boolean;
    rotation: boolean;
    modulation: boolean;
}

export interface DimensionState {
    position: number | null;
    latch: boolean | null;
    speed: number | null;
}

export interface Range {
    min: number;
    max: number;
}

export interface LatchControlModes {
    remoteLatching: boolean;
    remoteUnlatching: boolean;
}

function readAttr(node: MatterNode, endpoint: number, attrId: number): unknown {
    return node.attributes[`${endpoint}/${CLOSURE_DIMENSION_CLUSTER_ID}/${attrId}`];
}

/** ClosureDimension FeatureMap bits per Matter spec §5.5.5 (PS=0, LT=1, UT=2, LM=3, SP=4, TR=5, RO=6, MD=7). */
export function parseClosureDimensionFeatures(featureMap: number): ClosureDimensionFeatures {
    return {
        positioning: (featureMap & (1 << 0)) !== 0,
        motionLatching: (featureMap & (1 << 1)) !== 0,
        unit: (featureMap & (1 << 2)) !== 0,
        limitation: (featureMap & (1 << 3)) !== 0,
        speed: (featureMap & (1 << 4)) !== 0,
        translation: (featureMap & (1 << 5)) !== 0,
        rotation: (featureMap & (1 << 6)) !== 0,
        modulation: (featureMap & (1 << 7)) !== 0,
    };
}

export function readFeatures(node: MatterNode, endpoint: number): ClosureDimensionFeatures {
    const v = readAttr(node, endpoint, ATTR_FEATURE_MAP);
    return parseClosureDimensionFeatures(typeof v === "number" ? v : 0);
}

function readBoolField(obj: Record<string, unknown>, name: string, tag: string): boolean | null {
    const v = obj[name] ?? obj[tag];
    return typeof v === "boolean" ? v : null;
}

function readDimensionState(node: MatterNode, endpoint: number, attrId: number): DimensionState | null {
    const obj = asObject(readAttr(node, endpoint, attrId));
    if (!obj) return null;
    return {
        position: pickNumber(obj, "position", "0"),
        latch: readBoolField(obj, "latch", "1"),
        speed: pickNumber(obj, "speed", "2"),
    };
}

export function readCurrentState(node: MatterNode, endpoint: number): DimensionState | null {
    return readDimensionState(node, endpoint, ATTR_CURRENT_STATE);
}

export function readTargetState(node: MatterNode, endpoint: number): DimensionState | null {
    return readDimensionState(node, endpoint, ATTR_TARGET_STATE);
}

/** Position fields are percent100ths (0-10000 for 0.00%-100.00%); format for display. */
export function formatPercent100ths(value: number | null): string {
    return value === null ? "Unknown" : `${(value / 100).toFixed(2)}%`;
}

export function readResolution(node: MatterNode, endpoint: number): number | null {
    const v = readAttr(node, endpoint, ATTR_RESOLUTION);
    return typeof v === "number" ? v : null;
}

export function readStepValue(node: MatterNode, endpoint: number): number | null {
    const v = readAttr(node, endpoint, ATTR_STEP_VALUE);
    return typeof v === "number" ? v : null;
}

export function readUnit(node: MatterNode, endpoint: number): number | null {
    const v = readAttr(node, endpoint, ATTR_UNIT);
    return typeof v === "number" ? v : null;
}

export function readUnitRange(node: MatterNode, endpoint: number): Range | null {
    const obj = asObject(readAttr(node, endpoint, ATTR_UNIT_RANGE));
    if (!obj) return null;
    const min = pickNumber(obj, "min", "0");
    const max = pickNumber(obj, "max", "1");
    return min === null || max === null ? null : { min, max };
}

export function readLimitRange(node: MatterNode, endpoint: number): Range | null {
    const obj = asObject(readAttr(node, endpoint, ATTR_LIMIT_RANGE));
    if (!obj) return null;
    const min = pickNumber(obj, "min", "0");
    const max = pickNumber(obj, "max", "1");
    return min === null || max === null ? null : { min, max };
}

export function readTranslationDirection(node: MatterNode, endpoint: number): number | null {
    const v = readAttr(node, endpoint, ATTR_TRANSLATION_DIRECTION);
    return typeof v === "number" ? v : null;
}

export function readRotationAxis(node: MatterNode, endpoint: number): number | null {
    const v = readAttr(node, endpoint, ATTR_ROTATION_AXIS);
    return typeof v === "number" ? v : null;
}

export function readOverflow(node: MatterNode, endpoint: number): number | null {
    const v = readAttr(node, endpoint, ATTR_OVERFLOW);
    return typeof v === "number" ? v : null;
}

export function readModulationType(node: MatterNode, endpoint: number): number | null {
    const v = readAttr(node, endpoint, ATTR_MODULATION_TYPE);
    return typeof v === "number" ? v : null;
}

/** Whether the latch mechanism accepts remote (un)latch requests, vs. manual-only per spec §5.5.6.10. */
export function readLatchControlModes(node: MatterNode, endpoint: number): LatchControlModes {
    const v = readAttr(node, endpoint, ATTR_LATCH_CONTROL_MODES);
    const bitmap = typeof v === "number" ? v : 0;
    return {
        remoteLatching: (bitmap & (1 << 0)) !== 0,
        remoteUnlatching: (bitmap & (1 << 1)) !== 0,
    };
}

export interface SetTargetParams {
    position?: number;
    latch?: boolean;
    speed?: number;
}

export async function setTarget(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    params: SetTargetParams,
): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (params.position !== undefined) payload.position = params.position;
    if (params.latch !== undefined) payload.latch = params.latch;
    if (params.speed !== undefined) payload.speed = params.speed;
    await client.deviceCommand(nodeId, endpoint, CLOSURE_DIMENSION_CLUSTER_ID, "SetTarget", payload);
}

export interface StepParams {
    direction: number;
    numberOfSteps: number;
    speed?: number;
}

export async function step(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    params: StepParams,
): Promise<void> {
    const payload: Record<string, unknown> = {
        direction: params.direction,
        numberOfSteps: params.numberOfSteps,
    };
    if (params.speed !== undefined) payload.speed = params.speed;
    await client.deviceCommand(nodeId, endpoint, CLOSURE_DIMENSION_CLUSTER_ID, "Step", payload);
}
