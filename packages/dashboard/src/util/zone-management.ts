/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterClient } from "@matter-server/ws-client";
import { attributeArray } from "./access-control.js";
import { asObject, pickNumber, tagField as field, toNumber, toText } from "./attribute-shapes.js";

/** ZoneManagement cluster (Matter spec §2.14). */
export const ZONE_MANAGEMENT_CLUSTER_ID = 1360; // 0x0550

const ATTR_MAX_USER_DEFINED_ZONES = 0;
const ATTR_MAX_ZONES = 1;
const ATTR_ZONES = 2;
const ATTR_TRIGGERS = 3;
const ATTR_SENSITIVITY_MAX = 4;
const ATTR_SENSITIVITY = 5;
const ATTR_TWO_D_CARTESIAN_MAX = 6;
const ATTR_FEATURE_MAP = 0xfffc;

/** ZoneUseEnum (spec §2.14.5.2). */
export const ZONE_USE_LABELS: Record<number, string> = {
    0: "Motion",
    1: "Privacy",
    2: "Focus",
};

/** ZoneSourceEnum (spec §2.14.5.3). */
export const ZONE_SOURCE_LABELS: Record<number, string> = {
    0: "Manufacturer",
    1: "User",
};

export enum ZoneSource {
    Mfg = 0,
    User = 1,
}

export enum ZoneUse {
    Motion = 0,
    Privacy = 1,
    Focus = 2,
}

export interface ZoneManagementFeatures {
    twoDCartesian: boolean;
    perZoneSensitivity: boolean;
    userDefined: boolean;
    focusZones: boolean;
}

export interface Vertex {
    x: number;
    y: number;
}

export interface TwoDCartesianZone {
    name: string;
    use: number;
    vertices: Vertex[];
    color?: string;
}

export interface ZoneInfo {
    zoneId: number;
    zoneType: number;
    zoneSource: number;
    twoDCartesianZone?: TwoDCartesianZone;
}

export interface TriggerInfo {
    zoneId: number;
    initialDuration: number;
    augmentationDuration: number;
    maxDuration: number;
    blindDuration: number;
    sensitivity?: number;
}

export interface ZoneManagementInfo {
    features: ZoneManagementFeatures;
    maxZones?: number;
    maxUserDefinedZones?: number;
    sensitivityMax?: number;
    sensitivity?: number;
    twoDCartesianMax?: Vertex;
    zones: ZoneInfo[];
    triggers: TriggerInfo[];
}

export interface CommandResult {
    success: boolean;
    status: number;
    statusName: string;
    statusText?: string;
}

function attr(attributes: Record<string, unknown>, endpoint: number, attributeId: number): unknown {
    return attributes[`${endpoint}/${ZONE_MANAGEMENT_CLUSTER_ID}/${attributeId}`];
}

/** ZoneManagement FeatureMap bits: TWODCART=0, PERZONESENS=1, USERDEFINED=2, FOCUSZONES=3. */
function parseFeatures(featureMap: number): ZoneManagementFeatures {
    return {
        twoDCartesian: (featureMap & (1 << 0)) !== 0,
        perZoneSensitivity: (featureMap & (1 << 1)) !== 0,
        userDefined: (featureMap & (1 << 2)) !== 0,
        focusZones: (featureMap & (1 << 3)) !== 0,
    };
}

/** TwoDCartesianVertexStruct is field-tag keyed: "0" X, "1" Y. */
function decodeVertex(entry: unknown): Vertex | undefined {
    const x = toNumber(field(entry, 0));
    const y = toNumber(field(entry, 1));
    return x === undefined || y === undefined ? undefined : { x, y };
}

/** TwoDCartesianZoneStruct is field-tag keyed: "0" Name, "1" Use, "2" Vertices, "3" Color. */
function decodeTwoDCartesianZone(entry: unknown): TwoDCartesianZone | undefined {
    if (entry === undefined || entry === null) return undefined;
    const vertices = attributeArray(field(entry, 2))
        .map(decodeVertex)
        .filter((v): v is Vertex => v !== undefined);
    return {
        name: toText(field(entry, 0)) ?? "",
        use: toNumber(field(entry, 1)) ?? 0,
        vertices,
        color: toText(field(entry, 3)),
    };
}

/** ZoneInformationStruct is field-tag keyed: "0" ZoneID, "1" ZoneType, "2" ZoneSource, "3" TwoDCartesianZone. */
function decodeZone(entry: unknown): ZoneInfo | undefined {
    const zoneId = toNumber(field(entry, 0));
    if (zoneId === undefined) return undefined;
    return {
        zoneId,
        zoneType: toNumber(field(entry, 1)) ?? 0,
        zoneSource: toNumber(field(entry, 2)) ?? 0,
        twoDCartesianZone: decodeTwoDCartesianZone(field(entry, 3)),
    };
}

/**
 * ZoneTriggerControlStruct is field-tag keyed: "0" ZoneID, "1" InitialDuration, "2" AugmentationDuration,
 * "3" MaxDuration, "4" BlindDuration, "5" Sensitivity.
 */
function decodeTrigger(entry: unknown): TriggerInfo | undefined {
    const zoneId = toNumber(field(entry, 0));
    if (zoneId === undefined) return undefined;
    return {
        zoneId,
        initialDuration: toNumber(field(entry, 1)) ?? 0,
        augmentationDuration: toNumber(field(entry, 2)) ?? 0,
        maxDuration: toNumber(field(entry, 3)) ?? 0,
        blindDuration: toNumber(field(entry, 4)) ?? 0,
        sensitivity: toNumber(field(entry, 5)),
    };
}

export function zoneManagementInfo(attributes: Record<string, unknown>, endpoint: number): ZoneManagementInfo {
    const features = parseFeatures(toNumber(attr(attributes, endpoint, ATTR_FEATURE_MAP)) ?? 0);

    const zones = attributeArray(attr(attributes, endpoint, ATTR_ZONES))
        .map(decodeZone)
        .filter((zone): zone is ZoneInfo => zone !== undefined);

    const triggers = attributeArray(attr(attributes, endpoint, ATTR_TRIGGERS))
        .map(decodeTrigger)
        .filter((trigger): trigger is TriggerInfo => trigger !== undefined);

    return {
        features,
        maxZones: toNumber(attr(attributes, endpoint, ATTR_MAX_ZONES)),
        maxUserDefinedZones: toNumber(attr(attributes, endpoint, ATTR_MAX_USER_DEFINED_ZONES)),
        sensitivityMax: toNumber(attr(attributes, endpoint, ATTR_SENSITIVITY_MAX)),
        sensitivity: toNumber(attr(attributes, endpoint, ATTR_SENSITIVITY)),
        twoDCartesianMax: decodeVertex(attr(attributes, endpoint, ATTR_TWO_D_CARTESIAN_MAX)),
        zones,
        triggers,
    };
}

/** Names a zone by its TwoDCartesianZone name, else by its id. */
export function zoneLabel(zone: ZoneInfo): string {
    const name = zone.twoDCartesianZone?.name;
    return name !== undefined && name.trim() !== "" ? name : `Zone ${zone.zoneId}`;
}

/** One "x,y" pair per line; a polygon needs at least 3 vertices. Returns null when the text is not submittable. */
export function parseVertices(text: string): Vertex[] | null {
    const lines = text
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);
    if (lines.length < 3) return null;

    const vertices: Vertex[] = [];
    for (const line of lines) {
        const match = /^(-?\d+)\s*,\s*(-?\d+)$/.exec(line);
        if (!match) return null;
        vertices.push({ x: Number(match[1]), y: Number(match[2]) });
    }
    return vertices;
}

export function formatVertices(vertices: Vertex[]): string {
    return vertices.map(v => `${v.x},${v.y}`).join("\n");
}

/**
 * The Color field's CSS sRGB hex form, undefined when blank (field omitted), or null when the text
 * does not match the 6- or 8-digit form the device requires.
 */
export function parseZoneColor(text: string): string | undefined | null {
    const trimmed = text.trim();
    if (trimmed === "") return undefined;
    return /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(trimmed) ? trimmed : null;
}

/** A non-negative integer duration (seconds) field, or null when the text is not submittable. */
export function parseDurationSeconds(text: string): number | null {
    const trimmed = text.trim();
    if (trimmed === "") return null;
    const value = Number(trimmed);
    return Number.isInteger(value) && value >= 0 ? value : null;
}

export async function createTwoDCartesianZone(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    zone: TwoDCartesianZone,
): Promise<number> {
    const response = await client.deviceCommand(
        nodeId,
        endpoint,
        ZONE_MANAGEMENT_CLUSTER_ID,
        "CreateTwoDCartesianZone",
        {
            zone,
        },
    );
    const obj = asObject(response);
    const zoneId = obj === null ? null : pickNumber(obj, "zoneId");
    if (zoneId === null) throw new Error("The device did not return a ZoneID");
    return zoneId;
}

export async function updateTwoDCartesianZone(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    zoneId: number,
    zone: TwoDCartesianZone,
): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, ZONE_MANAGEMENT_CLUSTER_ID, "UpdateTwoDCartesianZone", {
        zoneId,
        zone,
    });
}

export async function removeZone(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    zoneId: number,
): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, ZONE_MANAGEMENT_CLUSTER_ID, "RemoveZone", { zoneId });
}

export async function createOrUpdateTrigger(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    trigger: TriggerInfo,
): Promise<void> {
    const payload: Record<string, unknown> = {
        zoneId: trigger.zoneId,
        initialDuration: trigger.initialDuration,
        augmentationDuration: trigger.augmentationDuration,
        maxDuration: trigger.maxDuration,
        blindDuration: trigger.blindDuration,
    };
    if (trigger.sensitivity !== undefined) payload.sensitivity = trigger.sensitivity;
    await client.deviceCommand(nodeId, endpoint, ZONE_MANAGEMENT_CLUSTER_ID, "CreateOrUpdateTrigger", {
        trigger: payload,
    });
}

export async function removeTrigger(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    zoneId: number,
): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, ZONE_MANAGEMENT_CLUSTER_ID, "RemoveTrigger", { zoneId });
}
