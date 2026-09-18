/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { attributeArray } from "./access-control.js";
import { asObject, pickNumber, tagField as field, toNumber, toText } from "./attribute-shapes.js";

/** ServiceArea cluster (Matter spec §1.11). */
export const SERVICE_AREA_CLUSTER_ID = 336; // 0x0150

const ATTR_SUPPORTED_AREAS = 0;
const ATTR_SUPPORTED_MAPS = 1;
const ATTR_CURRENT_AREA = 3;
const ATTR_ESTIMATED_END_TIME = 4;
const ATTR_PROGRESS = 5;
const ATTR_FEATURE_MAP = 0xfffc;

/** OperationalStatusEnum (Matter spec §1.11.5.1). */
const OPERATIONAL_STATUS_NAMES: Record<number, string> = {
    0: "Pending",
    1: "Operating",
    2: "Skipped",
    3: "Completed",
};

/** SelectAreasResponse.Status (Matter spec §1.11.7.3). */
const SELECT_AREAS_STATUS_NAMES: Record<number, string> = {
    0: "Success",
    1: "UnsupportedArea",
    2: "InvalidInMode",
    3: "InvalidSet",
};

/** SkipAreaResponse.Status (Matter spec §1.11.7.5). */
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

export interface MapInfo {
    mapId: number;
    name: string;
}

export interface AreaInfo {
    areaId: number;
    mapId?: number;
    locationName?: string;
    floorNumber?: number;
}

export interface ProgressInfo {
    areaId: number;
    status: string;
    totalOperationalTime?: number;
    estimatedTime?: number;
}

export interface ServiceAreaInfo {
    features: ServiceAreaFeatures;
    supportedAreas: AreaInfo[];
    supportedMaps: MapInfo[];
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

function attr(attributes: Record<string, unknown>, endpoint: number, attributeId: number): unknown {
    return attributes[`${endpoint}/${SERVICE_AREA_CLUSTER_ID}/${attributeId}`];
}

/** ServiceArea FeatureMap bits per Matter spec §1.11.4 (SELRUN=0, PROG=1, MAPS=2). */
function parseFeatures(featureMap: number): ServiceAreaFeatures {
    return {
        selectWhileRunning: (featureMap & (1 << 0)) !== 0,
        progressReporting: (featureMap & (1 << 1)) !== 0,
        maps: (featureMap & (1 << 2)) !== 0,
    };
}

/** MapStruct is field-tag keyed: "0" MapID, "1" Name. */
function decodeMap(entry: unknown): MapInfo | undefined {
    const mapId = toNumber(field(entry, 0));
    if (mapId === undefined) return undefined;
    return { mapId, name: toText(field(entry, 1)) ?? `Map ${mapId}` };
}

/**
 * AreaStruct is field-tag keyed: "0" AreaID, "1" MapID, "2" AreaInfo. AreaInfo's "0" LocationInfo
 * (locationdesc: "0" LocationName, "1" FloorNumber) is nullable, so a missing struct just yields no label.
 */
function decodeArea(entry: unknown): AreaInfo | undefined {
    const areaId = toNumber(field(entry, 0));
    if (areaId === undefined) return undefined;
    const mapId = toNumber(field(entry, 1));
    const locationInfo = field(field(entry, 2), 0);
    return {
        areaId,
        mapId,
        locationName: toText(field(locationInfo, 0)),
        floorNumber: toNumber(field(locationInfo, 1)),
    };
}

/** ProgressStruct is field-tag keyed: "0" AreaID, "1" Status, "2" TotalOperationalTime, "3" EstimatedTime. */
function decodeProgress(entry: unknown): ProgressInfo | undefined {
    const areaId = toNumber(field(entry, 0));
    if (areaId === undefined) return undefined;
    const statusValue = toNumber(field(entry, 1));
    const status =
        statusValue !== undefined ? (OPERATIONAL_STATUS_NAMES[statusValue] ?? `Unknown(${statusValue})`) : "Unknown";
    return {
        areaId,
        status,
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

    const progress = attributeArray(attr(attributes, endpoint, ATTR_PROGRESS))
        .map(decodeProgress)
        .filter((entry): entry is ProgressInfo => entry !== undefined);

    const estimatedEndTimeRaw = attr(attributes, endpoint, ATTR_ESTIMATED_END_TIME);

    return {
        features,
        supportedAreas,
        supportedMaps,
        currentArea: toNumber(attr(attributes, endpoint, ATTR_CURRENT_AREA)),
        estimatedEndTime: estimatedEndTimeRaw === null ? null : toNumber(estimatedEndTimeRaw),
        progress,
    };
}

export function areaLabel(area: AreaInfo): string {
    return area.locationName || `Area ${area.areaId}`;
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
    if (status === null) {
        throw new Error(`The device answered ${commandLabel} without a status`);
    }
    return {
        success: status === 0,
        status,
        statusName: statusNames[status] ?? `Unknown (${status})`,
        statusText: obj === null ? undefined : (toText(obj["statusText"]) ?? undefined),
    };
}

export function decodeSelectAreasResult(response: unknown): CommandResult {
    return decodeCommandResult(response, SELECT_AREAS_STATUS_NAMES, "SelectAreas");
}

export function decodeSkipAreaResult(response: unknown): CommandResult {
    return decodeCommandResult(response, SKIP_AREA_STATUS_NAMES, "SkipArea");
}
