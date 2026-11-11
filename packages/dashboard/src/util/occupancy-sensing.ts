/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { tagField as field, toNumber } from "./attribute-shapes.js";
import { formatDuration } from "./duration.js";

export const OCCUPANCY_SENSING_CLUSTER_ID = 1030;

const ATTR_OCCUPANCY = 0;
const ATTR_OCCUPANCY_SENSOR_TYPE = 1;
const ATTR_OCCUPANCY_SENSOR_TYPE_BITMAP = 2;
const ATTR_HOLD_TIME = 3;
const ATTR_HOLD_TIME_LIMITS = 4;
const ATTR_FEATURE_MAP = 0xfffc;

const OCCUPIED_BIT = 0b1;

/** Sensing modality feature bits 0-7 per Matter 1.6 §2.7.4. */
const MODALITY_FEATURE_NAMES: Record<number, string> = {
    0: "Other sensing",
    1: "Passive infrared",
    2: "Ultrasonic",
    3: "Physical contact",
    4: "Active infrared",
    5: "Radar",
    6: "RF sensing",
    7: "Vision",
};

/** OccupancySensorTypeBitmap per Matter 1.6 §2.7.5.2. */
const SENSOR_TYPE_BITMAP_NAMES: Record<number, string> = {
    0: "Passive infrared",
    1: "Ultrasonic",
    2: "Physical contact",
};

/** OccupancySensorTypeEnum per Matter 1.6 §2.7.5.3. */
const SENSOR_TYPE_NAMES: Record<number, string[]> = {
    0: ["Passive infrared"],
    1: ["Ultrasonic"],
    2: ["Passive infrared", "Ultrasonic"],
    3: ["Physical contact"],
};

export interface HoldTimeLimits {
    minS?: number;
    maxS?: number;
    defaultS?: number;
}

/** Decoded OccupancySensing attributes. `undefined` means not reported. */
export interface OccupancySensingInfo {
    supported: boolean;
    occupied?: boolean;
    sensorTypes: string[];
    holdTimeS?: number;
    holdTimeLimits?: HoldTimeLimits;
}

function attr(attributes: Record<string, unknown>, endpoint: number, attributeId: number): unknown {
    return attributes[`${endpoint}/${OCCUPANCY_SENSING_CLUSTER_ID}/${attributeId}`];
}

function bitNames(value: number, names: Record<number, string>): string[] {
    return Object.entries(names)
        .filter(([bit]) => (value & (1 << Number(bit))) !== 0)
        .map(([, name]) => name);
}

/**
 * The modality feature bits are the sensor type for cluster revision 5 and later (§2.7.6.2); a conformant server sets
 * at least one (§2.7.4, O.a+). They win over the legacy attributes, which report PIR for a sensor without PIR, US or
 * PHY. The choice is made from the bits, not from ClusterRevision. Without bits, the legacy bitmap is used as reported,
 * also when it is 0; the legacy enum is the last resort because it cannot express every combination.
 */
function sensorTypes(
    featureMap: number | undefined,
    sensorTypeBitmapValue: unknown,
    sensorTypeValue: unknown,
): string[] {
    const modalities = bitNames(featureMap ?? 0, MODALITY_FEATURE_NAMES);
    if (modalities.length > 0) return modalities;

    const sensorTypeBitmap = toNumber(sensorTypeBitmapValue);
    if (sensorTypeBitmap !== undefined) return bitNames(sensorTypeBitmap, SENSOR_TYPE_BITMAP_NAMES);

    const sensorType = toNumber(sensorTypeValue);
    if (sensorType === undefined) return [];
    return SENSOR_TYPE_NAMES[sensorType] ?? [`Unknown (${sensorType})`];
}

function decodeHoldTimeLimits(value: unknown): HoldTimeLimits | undefined {
    const limits = {
        minS: toNumber(field(value, 0)),
        maxS: toNumber(field(value, 1)),
        defaultS: toNumber(field(value, 2)),
    };
    if (limits.minS === undefined && limits.maxS === undefined && limits.defaultS === undefined) return undefined;
    return limits;
}

/** Formats limits as "min 1 s, max 5 min, default 30 s"; absent fields are left out. */
export function formatHoldTimeLimits(limits: HoldTimeLimits): string {
    const parts: [string, number | undefined][] = [
        ["min", limits.minS],
        ["max", limits.maxS],
        ["default", limits.defaultS],
    ];
    return parts
        .filter((part): part is [string, number] => part[1] !== undefined)
        .map(([label, seconds]) => `${label} ${formatDuration(seconds)}`)
        .join(", ");
}

export function occupancySensingInfo(attributes: Record<string, unknown>, endpoint: number): OccupancySensingInfo {
    const featureMap = toNumber(attr(attributes, endpoint, ATTR_FEATURE_MAP));
    const occupancy = toNumber(attr(attributes, endpoint, ATTR_OCCUPANCY));

    return {
        supported: featureMap !== undefined,
        occupied: occupancy === undefined ? undefined : (occupancy & OCCUPIED_BIT) !== 0,
        sensorTypes: sensorTypes(
            featureMap,
            attr(attributes, endpoint, ATTR_OCCUPANCY_SENSOR_TYPE_BITMAP),
            attr(attributes, endpoint, ATTR_OCCUPANCY_SENSOR_TYPE),
        ),
        holdTimeS: toNumber(attr(attributes, endpoint, ATTR_HOLD_TIME)),
        holdTimeLimits: decodeHoldTimeLimits(attr(attributes, endpoint, ATTR_HOLD_TIME_LIMITS)),
    };
}
