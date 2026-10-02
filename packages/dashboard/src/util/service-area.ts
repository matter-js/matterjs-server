/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { semantic_tag_namespaces } from "../client/models/descriptions.js";
import { attributeArray } from "./access-control.js";
import { asObject, pickNumber, tagField as field, toNumber, toText } from "./attribute-shapes.js";
import { formatDuration } from "./duration.js";
import { MATTER_EPOCH_OFFSET_SECONDS } from "./time.js";

/** ServiceArea cluster (Matter Application Clusters spec, ServiceArea). */
export const SERVICE_AREA_CLUSTER_ID = 336; // 0x0150

const ATTR_SUPPORTED_AREAS = 0;
const ATTR_SUPPORTED_MAPS = 1;
const ATTR_SELECTED_AREAS = 2;
const ATTR_CURRENT_AREA = 3;
const ATTR_ESTIMATED_END_TIME = 4;
const ATTR_PROGRESS = 5;
const ATTR_ACCEPTED_COMMAND_LIST = 0xfff9;
const ATTR_FEATURE_MAP = 0xfffc;

const CMD_SELECT_AREAS = 0;
const CMD_SKIP_AREA = 2;

/** Namespaces the AreaStruct tag fields are drawn from. */
const AREA_NAMESPACE_ID = 0x10;
const LANDMARK_NAMESPACE_ID = 0x11;
const RELATIVE_POSITION_NAMESPACE_ID = 0x12;

/** OperationalStatusEnum. */
export enum OperationalStatus {
    Pending = 0,
    Operating = 1,
    Skipped = 2,
    Completed = 3,
}

const OPERATIONAL_STATUS_NAMES: Record<number, string> = {
    [OperationalStatus.Pending]: "Pending",
    [OperationalStatus.Operating]: "Operating",
    [OperationalStatus.Skipped]: "Skipped",
    [OperationalStatus.Completed]: "Completed",
};

/** SelectAreasResponse.Status. */
const SELECT_AREAS_STATUS_NAMES: Record<number, string> = {
    0: "Success",
    1: "UnsupportedArea",
    2: "InvalidInMode",
    3: "InvalidSet",
};

/** SkipAreaResponse.Status. */
const SKIP_AREA_STATUS_NAMES: Record<number, string> = {
    0: "Success",
    1: "InvalidAreaList",
    2: "InvalidInMode",
    3: "InvalidSkippedArea",
};

export interface ServiceAreaFeatures {
    selectWhileRunning: boolean;
    progressReporting: boolean;
    maps: boolean;
}

/**
 * Which commands the device accepts. SkipArea's conformance is `[CurrentArea | Progress]`, so no
 * feature bit implies it and only AcceptedCommandList answers it directly.
 */
export interface ServiceAreaCommands {
    selectAreas: boolean;
    skipArea: boolean;
}

export interface MapInfo {
    mapId: number;
    name: string;
}

export interface AreaInfo {
    areaId: number;
    mapId?: number;
    locationName?: string;
    floorNumber?: number;
    areaTypeTag?: number;
    landmarkTag?: number;
    relativePositionTag?: number;
}

export interface ProgressInfo {
    areaId: number;
    /** OperationalStatusEnum value, or undefined when the device omitted the mandatory field. */
    status?: number;
    totalOperationalTime?: number;
    estimatedTime?: number;
}

export interface ServiceAreaInfo {
    features: ServiceAreaFeatures;
    commands: ServiceAreaCommands;
    supportedAreas: AreaInfo[];
    supportedMaps: MapInfo[];
    selectedAreas: number[];
    currentArea?: number;
    estimatedEndTime?: number | null;
    progress: ProgressInfo[];
}

export interface CommandResult {
    success: boolean;
    status: number;
    statusName: string;
    statusText?: string;
}

/** A display label plus a CSS-safe key, so wire content never reaches a class attribute. */
export interface OperationalStatusDisplay {
    label: string;
    key: string;
}

function attr(attributes: Record<string, unknown>, endpoint: number, attributeId: number): unknown {
    return attributes[`${endpoint}/${SERVICE_AREA_CLUSTER_ID}/${attributeId}`];
}

/** ServiceArea FeatureMap bits: SELRUN=0, PROG=1, MAPS=2. */
function parseFeatures(featureMap: number): ServiceAreaFeatures {
    return {
        selectWhileRunning: (featureMap & (1 << 0)) !== 0,
        progressReporting: (featureMap & (1 << 1)) !== 0,
        maps: (featureMap & (1 << 2)) !== 0,
    };
}

/** The commands the device lists, or undefined when it has not reported AcceptedCommandList. */
function acceptedCommands(attributes: Record<string, unknown>, endpoint: number): Set<number> | undefined {
    const raw = attr(attributes, endpoint, ATTR_ACCEPTED_COMMAND_LIST);
    if (raw === undefined || raw === null) return undefined;
    return new Set(
        attributeArray(raw)
            .map(toNumber)
            .filter((commandId): commandId is number => commandId !== undefined),
    );
}

function tagLabel(namespaceId: number, tag: number | undefined): string | undefined {
    return tag === undefined ? undefined : semantic_tag_namespaces[namespaceId]?.tags[tag]?.label;
}

/** MapStruct is field-tag keyed: "0" MapID, "1" Name. */
function decodeMap(entry: unknown): MapInfo | undefined {
    const mapId = toNumber(field(entry, 0));
    if (mapId === undefined) return undefined;
    return { mapId, name: toText(field(entry, 1)) ?? `Map ${mapId}` };
}

/**
 * AreaStruct is field-tag keyed: "0" AreaID, "1" MapID, "2" AreaInfo. AreaInfo carries "0" LocationInfo
 * (locationdesc: "0" LocationName, "1" FloorNumber, "2" AreaType) and "1" LandmarkInfo ("0" LandmarkTag,
 * "1" RelativePositionTag). Both are nullable, and the spec requires one of them, so a device may name
 * an area by landmark alone.
 */
function decodeArea(entry: unknown): AreaInfo | undefined {
    const areaId = toNumber(field(entry, 0));
    if (areaId === undefined) return undefined;
    const areaInfo = field(entry, 2);
    const locationInfo = field(areaInfo, 0);
    const landmarkInfo = field(areaInfo, 1);
    return {
        areaId,
        mapId: toNumber(field(entry, 1)),
        locationName: toText(field(locationInfo, 0)),
        floorNumber: toNumber(field(locationInfo, 1)),
        areaTypeTag: toNumber(field(locationInfo, 2)),
        landmarkTag: toNumber(field(landmarkInfo, 0)),
        relativePositionTag: toNumber(field(landmarkInfo, 1)),
    };
}

/** ProgressStruct is field-tag keyed: "0" AreaID, "1" Status, "2" TotalOperationalTime, "3" EstimatedTime. */
function decodeProgress(entry: unknown): ProgressInfo | undefined {
    const areaId = toNumber(field(entry, 0));
    if (areaId === undefined) return undefined;
    return {
        areaId,
        status: toNumber(field(entry, 1)),
        totalOperationalTime: toNumber(field(entry, 2)),
        estimatedTime: toNumber(field(entry, 3)),
    };
}

export function serviceAreaInfo(attributes: Record<string, unknown>, endpoint: number): ServiceAreaInfo {
    const features = parseFeatures(toNumber(attr(attributes, endpoint, ATTR_FEATURE_MAP)) ?? 0);

    const supportedAreas = attributeArray(attr(attributes, endpoint, ATTR_SUPPORTED_AREAS))
        .map(decodeArea)
        .filter((area): area is AreaInfo => area !== undefined);

    const supportedMaps = attributeArray(attr(attributes, endpoint, ATTR_SUPPORTED_MAPS))
        .map(decodeMap)
        .filter((map): map is MapInfo => map !== undefined);

    const selectedAreas = attributeArray(attr(attributes, endpoint, ATTR_SELECTED_AREAS))
        .map(toNumber)
        .filter((areaId): areaId is number => areaId !== undefined);

    const progress = attributeArray(attr(attributes, endpoint, ATTR_PROGRESS))
        .map(decodeProgress)
        .filter((entry): entry is ProgressInfo => entry !== undefined);

    const estimatedEndTimeRaw = attr(attributes, endpoint, ATTR_ESTIMATED_END_TIME);
    const currentArea = toNumber(attr(attributes, endpoint, ATTR_CURRENT_AREA));

    // Without the list, SelectAreas is mandatory and SkipArea follows its own conformance.
    const accepted = acceptedCommands(attributes, endpoint);

    return {
        features,
        commands: {
            selectAreas: accepted?.has(CMD_SELECT_AREAS) ?? true,
            skipArea: accepted?.has(CMD_SKIP_AREA) ?? (currentArea !== undefined || features.progressReporting),
        },
        supportedAreas,
        supportedMaps,
        selectedAreas,
        currentArea,
        estimatedEndTime: estimatedEndTimeRaw === null ? null : toNumber(estimatedEndTimeRaw),
        progress,
    };
}

/** Names an area by its location, else by its landmark, else by its area type, else by its id. */
export function areaLabel(area: AreaInfo): string {
    if (area.locationName !== undefined) return area.locationName;

    const landmark = tagLabel(LANDMARK_NAMESPACE_ID, area.landmarkTag);
    if (landmark !== undefined) {
        const position = tagLabel(RELATIVE_POSITION_NAMESPACE_ID, area.relativePositionTag);
        return position === undefined ? landmark : `${position} ${landmark}`;
    }

    return tagLabel(AREA_NAMESPACE_ID, area.areaTypeTag) ?? `Area ${area.areaId}`;
}

export function describeOperationalStatus(status: number | undefined): OperationalStatusDisplay {
    if (status === undefined) return { label: "Unknown", key: "unknown" };
    const label = OPERATIONAL_STATUS_NAMES[status];
    return label === undefined ? { label: `Unknown (${status})`, key: "unknown" } : { label, key: label.toLowerCase() };
}

/**
 * Whether SkipArea can be invoked for an area. Confirmed against real hardware:
 * - InvalidInMode ("not allowed, given the current mode of the device") rejects a Pending area
 *   while nothing is actually Operating yet, so Pending only counts once some area is Operating.
 * - When the device reports no Progress entry at all (e.g. selected but not yet started), the
 *   device answers InvalidInMode with "the skipped area does not match the current area" for any
 *   area that isn't CurrentArea — being merely selected is not enough.
 */
export function isSkippable(info: ServiceAreaInfo, areaId: number): boolean {
    if (!info.commands.skipArea) return false;
    const progress = info.progress.find(entry => entry.areaId === areaId);
    if (progress === undefined) return info.currentArea === areaId;
    if (progress.status !== OperationalStatus.Pending && progress.status !== OperationalStatus.Operating) {
        return false;
    }
    return info.progress.some(entry => entry.status === OperationalStatus.Operating);
}

/** Seconds left until a Matter epoch-s instant; zero or negative once it has passed. */
export function remainingSeconds(estimatedEndTimeEpochS: number, nowMs: number = Date.now()): number {
    return Math.round(((estimatedEndTimeEpochS + MATTER_EPOCH_OFFSET_SECONDS) * 1000 - nowMs) / 1000);
}

/** Time left until a Matter epoch-s instant, or "due now" once it has passed. */
export function remainingTimeLabel(estimatedEndTimeEpochS: number, nowMs: number = Date.now()): string {
    const remaining = remainingSeconds(estimatedEndTimeEpochS, nowMs);
    return remaining <= 0 ? "due now" : `${formatDuration(remaining)} left`;
}

/**
 * Command responses are name-keyed (convertMatterToWebSocketNameBased), unlike the tag-keyed
 * attributes above. A response carrying no Status says nothing about the outcome, so it must not
 * read as Success.
 */
function decodeCommandResult(
    response: unknown,
    statusNames: Record<number, string>,
    commandLabel: string,
): CommandResult {
    const obj = asObject(response);
    const status = obj === null ? null : pickNumber(obj, "status");
    if (obj === null || status === null) {
        throw new Error(`The device answered ${commandLabel} without a status`);
    }
    return {
        success: status === 0,
        status,
        statusName: statusNames[status] ?? `Unknown (${status})`,
        statusText: toText(obj["statusText"]),
    };
}

export function decodeSelectAreasResult(response: unknown): CommandResult {
    return decodeCommandResult(response, SELECT_AREAS_STATUS_NAMES, "SelectAreas");
}

export function decodeSkipAreaResult(response: unknown): CommandResult {
    return decodeCommandResult(response, SKIP_AREA_STATUS_NAMES, "SkipArea");
}
