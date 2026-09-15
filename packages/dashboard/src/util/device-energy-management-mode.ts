/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { attributeArray } from "./access-control.js";
import { asObject, pickNumber, tagField as field, toNumber, toText } from "./attribute-shapes.js";
import { formatHex } from "./format_hex.js";

export const DEVICE_ENERGY_MANAGEMENT_MODE_CLUSTER_ID = 159;

const ATTR_SUPPORTED_MODES = 0;
const ATTR_CURRENT_MODE = 1;

/** ModeBase's ModeChangeStatus enum (Matter 1.6 §1.10.6.6); DeviceEnergyManagementMode adds no cluster-specific codes. */
const MODE_CHANGE_STATUS_NAMES: Record<number, string> = {
    0: "Success",
    1: "UnsupportedMode",
    2: "GenericFailure",
    3: "InvalidInMode",
};

/** ModeBase common tags (Matter 1.6 §1.10.6.5) plus DeviceEnergyManagementMode-specific tags (§9.5.7.1). */
const MODE_TAG_NAMES: Record<number, string> = {
    0x0000: "Auto",
    0x0001: "Quick",
    0x0002: "Quiet",
    0x0003: "LowNoise",
    0x0004: "LowEnergy",
    0x0005: "Vacation",
    0x0006: "Min",
    0x0007: "Max",
    0x0008: "Night",
    0x0009: "Day",
    0x4000: "NoOptimization",
    0x4001: "DeviceOptimization",
    0x4002: "LocalOptimization",
    0x4003: "GridOptimization",
};

export interface ModeTagInfo {
    mfgCode?: number;
    value: number;
    label: string;
}

export interface ModeOptionInfo {
    label: string;
    mode: number;
    tags: ModeTagInfo[];
}

export interface DeviceEnergyManagementModeInfo {
    supportedModes: ModeOptionInfo[];
    currentMode?: number;
    currentModeLabel?: string;
}

export interface ChangeToModeResult {
    success: boolean;
    status: number;
    statusName: string;
    statusText?: string;
}

function attr(attributes: Record<string, unknown>, endpoint: number, attributeId: number): unknown {
    return attributes[`${endpoint}/${DEVICE_ENERGY_MANAGEMENT_MODE_CLUSTER_ID}/${attributeId}`];
}

/**
 * MfgCode is the tag's namespace: the same Value means different things under different vendors, so a
 * manufacturer tag is never resolved against the standard table. Mirrors describeSemanticTag().
 */
function modeTagLabel(value: number, mfgCode: number | undefined): string {
    if (mfgCode !== undefined) return `Mfg ${formatHex(mfgCode)} tag ${formatHex(value)}`;
    return MODE_TAG_NAMES[value] ?? `Tag ${formatHex(value)}`;
}

/** ModeTagStruct is field-tag keyed: "0" MfgCode (optional), "1" Value. */
function decodeModeTag(entry: unknown): ModeTagInfo | undefined {
    const value = toNumber(field(entry, 1));
    if (value === undefined) return undefined;
    const mfgCode = toNumber(field(entry, 0));
    return { mfgCode, value, label: modeTagLabel(value, mfgCode) };
}

/** ModeOptionStruct is field-tag keyed: "0" Label, "1" Mode, "2" ModeTags. */
function decodeModeOption(entry: unknown): ModeOptionInfo | undefined {
    const mode = toNumber(field(entry, 1));
    if (mode === undefined) return undefined;
    const tags = attributeArray(field(entry, 2))
        .map(decodeModeTag)
        .filter((tag): tag is ModeTagInfo => tag !== undefined);
    return { label: toText(field(entry, 0)) ?? `Mode ${mode}`, mode, tags };
}

export function deviceEnergyManagementModeInfo(
    attributes: Record<string, unknown>,
    endpoint: number,
): DeviceEnergyManagementModeInfo {
    const supportedModes = attributeArray(attr(attributes, endpoint, ATTR_SUPPORTED_MODES))
        .map(decodeModeOption)
        .filter((mode): mode is ModeOptionInfo => mode !== undefined);
    const labelFor = (mode: number | undefined) => supportedModes.find(m => m.mode === mode)?.label;

    const currentMode = toNumber(attr(attributes, endpoint, ATTR_CURRENT_MODE));

    return { supportedModes, currentMode, currentModeLabel: labelFor(currentMode) };
}

/**
 * Command responses are name-keyed (convertMatterToWebSocketNameBased), unlike the tag-keyed
 * attributes above. A response carrying no Status says nothing about the outcome, so it must not
 * read as Success.
 */
export function decodeChangeToModeResult(response: unknown): ChangeToModeResult {
    const obj = asObject(response);
    const status = obj === null ? null : pickNumber(obj, "status");
    if (status === null) {
        throw new Error("The device answered ChangeToMode without a status");
    }
    return {
        success: status === 0,
        status,
        statusName: MODE_CHANGE_STATUS_NAMES[status] ?? `Unknown (${status})`,
        statusText: obj === null ? undefined : (toText(obj["statusText"]) ?? undefined),
    };
}
