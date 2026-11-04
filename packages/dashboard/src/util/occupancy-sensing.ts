/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterNode } from "@matter-server/ws-client";

/** Occupancy Sensing cluster (Matter spec §2.7). */
export const OCCUPANCY_SENSING_CLUSTER_ID = 1030; // 0x0406

const ATTR_OCCUPANCY = 0x00;
const ATTR_OCCUPANCY_SENSOR_TYPE = 0x01;

/** OccupancySensorTypeEnum (spec §2.7.6.2). */
const SENSOR_TYPE_LABELS: Record<number, string> = {
    0: "PIR",
    1: "Ultrasonic",
    2: "PIR + Ultrasonic",
    3: "Physical Contact",
};

function readAttr(node: MatterNode, endpoint: number, attrId: number): unknown {
    return node.attributes[`${endpoint}/${OCCUPANCY_SENSING_CLUSTER_ID}/${attrId}`];
}

function readNumberAttr(node: MatterNode, endpoint: number, attrId: number): number | null {
    const value = readAttr(node, endpoint, attrId);
    return typeof value === "number" ? value : null;
}

export function readOccupancy(node: MatterNode, endpoint: number): number | null {
    return readNumberAttr(node, endpoint, ATTR_OCCUPANCY);
}

/** Occupancy's only defined bit is bit 0 (Occupied); the rest of the map8 is reserved. */
export function isOccupied(node: MatterNode, endpoint: number): boolean | null {
    const value = readOccupancy(node, endpoint);
    return value === null ? null : (value & 0x01) === 0x01;
}

export function readOccupancySensorType(node: MatterNode, endpoint: number): number | null {
    return readNumberAttr(node, endpoint, ATTR_OCCUPANCY_SENSOR_TYPE);
}

export function formatOccupancySensorType(sensorType: number | null): string | null {
    return sensorType === null ? null : (SENSOR_TYPE_LABELS[sensorType] ?? `Type ${sensorType}`);
}
