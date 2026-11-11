/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterClient } from "@matter-server/ws-client";
import { attributeArray } from "./access-control.js";
import { asObject, pickNumber, tagField as field, toNumber, toText } from "./attribute-shapes.js";

/** ZoneManagement cluster (Matter 1.6 §2.14). */
export const ZONE_MANAGEMENT_CLUSTER_ID = 1360;

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
    supported: boolean;
    features: ZoneManagementFeatures;
    maxZones?: number;
    maxUserDefinedZones?: number;
    sensitivityMax?: number;
    sensitivity?: number;
    twoDCartesianMax?: Vertex;
    zones: ZoneInfo[];
    triggers: TriggerInfo[];
}

type CommandClient = Pick<MatterClient, "deviceCommand">;

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
    const featureMap = toNumber(attr(attributes, endpoint, ATTR_FEATURE_MAP));
    const features = parseFeatures(featureMap ?? 0);

    const zones = attributeArray(attr(attributes, endpoint, ATTR_ZONES))
        .map(decodeZone)
        .filter((zone): zone is ZoneInfo => zone !== undefined);

    const triggers = attributeArray(attr(attributes, endpoint, ATTR_TRIGGERS))
        .map(decodeTrigger)
        .filter((trigger): trigger is TriggerInfo => trigger !== undefined);

    return {
        supported: featureMap !== undefined,
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

/**
 * True when the device refuses a further user-defined zone: MaxUserDefinedZones is reached (§2.14.7.1.2). MaxZones is
 * the manufacturer zones plus MaxUserDefinedZones, so it is checked too.
 */
export function zoneCapacityReached(info: ZoneManagementInfo): boolean {
    const userZoneCount = info.zones.filter(zone => zone.zoneSource === ZoneSource.User).length;
    return (
        (info.maxZones !== undefined && info.zones.length >= info.maxZones) ||
        (info.maxUserDefinedZones !== undefined && userZoneCount >= info.maxUserDefinedZones)
    );
}

export function formatVertices(vertices: Vertex[]): string {
    return vertices.map(v => `${v.x},${v.y}`).join("\n");
}

const ZONE_COLOR_PATTERN = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

/**
 * The RGB part (#RRGGBB) of the zone color for an opaque swatch, or undefined when the device reported none or a value
 * that is not hex notation.
 */
export function zoneSwatchColor(color: string | undefined): string | undefined {
    if (color === undefined || !ZONE_COLOR_PATTERN.test(color)) return undefined;
    return color.slice(0, 7);
}

/** A parsed form: the value to send, or the reason the form cannot be sent. */
export type FormResult<T> = { value: T; error?: undefined } | { value?: undefined; error: string };

export interface ZoneForm {
    name: string;
    use: string;
    vertices: string;
    color: string;
}

export interface TriggerForm {
    zoneId: string;
    initialDuration: string;
    augmentationDuration: string;
    maxDuration: string;
    blindDuration: string;
    sensitivity: string;
}

const NAME_MAX_BYTES = 32;
const VERTICES_MIN = 3;
const VERTICES_MAX = 12;
const UINT16_MAX = 0xffff;
const UINT32_MAX = 0xffffffff;

function parseInteger(text: string, min: number, max: number): number | undefined {
    const trimmed = text.trim();
    if (!/^\d+$/.test(trimmed)) return undefined;
    const value = Number(trimmed);
    return value >= min && value <= max ? value : undefined;
}

/**
 * Checks the zone form against the TwoDCartesianZoneStruct constraints (§2.14.5.7) and TwoDCartesianMax. The device
 * also rejects a self-intersecting shape and a zone whose vertices and use match another zone; those are left to its
 * response.
 */
export function parseZoneForm(form: ZoneForm, info: ZoneManagementInfo): FormResult<TwoDCartesianZone> {
    const name = form.name.trim();
    if (new TextEncoder().encode(name).length > NAME_MAX_BYTES) {
        return { error: `The name is longer than ${NAME_MAX_BYTES} bytes.` };
    }

    const use = Number(form.use);
    if (ZONE_USE_LABELS[use] === undefined || (use === ZoneUse.Focus && !info.features.focusZones)) {
        return { error: "Select a use the device supports." };
    }

    const lines = form.vertices
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);
    if (lines.length < VERTICES_MIN || lines.length > VERTICES_MAX) {
        return { error: `Enter ${VERTICES_MIN} to ${VERTICES_MAX} vertices, one "x,y" pair per line.` };
    }
    const maxX = Math.min(info.twoDCartesianMax?.x ?? UINT16_MAX, UINT16_MAX);
    const maxY = Math.min(info.twoDCartesianMax?.y ?? UINT16_MAX, UINT16_MAX);
    const vertices = new Array<Vertex>();
    for (const line of lines) {
        const [xText, yText, ...rest] = line.split(",");
        const x = parseInteger(xText ?? "", 0, maxX);
        const y = parseInteger(yText ?? "", 0, maxY);
        if (rest.length > 0 || x === undefined || y === undefined) {
            return { error: `"${line}" is not a vertex from 0,0 to ${maxX},${maxY}.` };
        }
        vertices.push({ x, y });
    }

    const color = form.color.trim();
    if (color !== "" && !ZONE_COLOR_PATTERN.test(color)) {
        return { error: "Enter the color as #RRGGBB or #RRGGBBAA." };
    }

    return { value: { name, use, vertices, color: color === "" ? undefined : color } };
}

/** Checks the trigger form against the ZoneTriggerControlStruct constraints (§2.14.5.9). */
export function parseTriggerForm(form: TriggerForm, info: ZoneManagementInfo): FormResult<TriggerInfo> {
    const zoneId = parseInteger(form.zoneId, 0, UINT16_MAX);
    if (zoneId === undefined) return { error: "Select a zone." };

    const initialDuration = parseInteger(form.initialDuration, 1, UINT16_MAX);
    if (initialDuration === undefined) return { error: `Enter an initial duration from 1 to ${UINT16_MAX} s.` };
    const augmentationDuration = parseInteger(form.augmentationDuration, 0, initialDuration);
    if (augmentationDuration === undefined) {
        return { error: `Enter an augmentation duration from 0 to ${initialDuration} s (the initial duration).` };
    }
    const maxDuration = parseInteger(form.maxDuration, initialDuration, UINT32_MAX);
    if (maxDuration === undefined) {
        return { error: `Enter a max duration of at least ${initialDuration} s (the initial duration).` };
    }
    const blindDuration = parseInteger(form.blindDuration, 0, UINT32_MAX);
    if (blindDuration === undefined) return { error: "Enter a blind duration of 0 s or more." };

    let sensitivity: number | undefined;
    if (info.features.perZoneSensitivity) {
        const sensitivityMax = info.sensitivityMax ?? 10;
        sensitivity = parseInteger(form.sensitivity, 1, sensitivityMax);
        if (sensitivity === undefined) return { error: `Enter a sensitivity from 1 to ${sensitivityMax}.` };
    }

    return { value: { zoneId, initialDuration, augmentationDuration, maxDuration, blindDuration, sensitivity } };
}

export async function createTwoDCartesianZone(
    client: CommandClient,
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
    const zoneId = obj === null ? null : pickNumber(obj, "zoneID", "zoneId");
    if (zoneId === null) throw new Error("The device did not return a ZoneID");
    return zoneId;
}

export async function updateTwoDCartesianZone(
    client: CommandClient,
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
    client: CommandClient,
    nodeId: number | bigint,
    endpoint: number,
    zoneId: number,
): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, ZONE_MANAGEMENT_CLUSTER_ID, "RemoveZone", { zoneId });
}

export async function createOrUpdateTrigger(
    client: CommandClient,
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
    client: CommandClient,
    nodeId: number | bigint,
    endpoint: number,
    zoneId: number,
): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, ZONE_MANAGEMENT_CLUSTER_ID, "RemoveTrigger", { zoneId });
}
