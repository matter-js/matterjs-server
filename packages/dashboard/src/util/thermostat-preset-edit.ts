/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterClient, MatterNode } from "@matter-server/ws-client";
import { asObject, pickNumber } from "./attribute-shapes.js";
import { getMatterStatusName, requireAttributeWriteSuccess } from "./matter-status.js";
import {
    decodePresets,
    readThermostatAttribute,
    THERMOSTAT_CLUSTER_ID,
    type ThermostatPreset,
    type ThermostatSchedule,
} from "./thermostat-schedule.js";

const ATTR_PRESET_TYPES = 0x48;
const ATTR_NUMBER_OF_PRESETS = 0x4a;
const ATTR_PRESETS = 0x50;

/** PresetTypeFeaturesBitmap (Matter spec §4.3.10.3): bit 1 says a preset of this scenario may carry a Name. */
const PRESET_TYPE_SUPPORTS_NAMES = 0x2;

/** PresetScenarioEnum UserDefined (§4.3.10.17): a preset of this scenario must carry a Name. */
const PRESET_SCENARIO_USER_DEFINED = 254;

/** First server schema with `write_atomic_attribute`; older servers cannot write presets for the dashboard. */
export const PRESET_WRITE_MIN_SCHEMA = 15;

/**
 * How often a preset write is tried. A DATA_VERSION_MISMATCH mostly comes from another attribute of the cluster, such as
 * the measured temperature, so the next read usually succeeds.
 */
const PRESET_WRITE_ATTEMPTS = 2;

/** What a failed preset write means for the user, for the statuses that point at a change made elsewhere. */
const DATA_VERSION_MISMATCH = 0x92;

const PRESET_WRITE_HINTS: Record<number, string> = {
    [DATA_VERSION_MISMATCH]: "the thermostat changed since its presets were read, try again",
    0x9c: "another change of the presets is still running, try again",
    0xcb: "the thermostat ended or refused the edit, try again",
};

export interface ThermostatPresetType {
    scenario: number;
    numberOfPresets: number;
    supportsNames: boolean;
}

function decodePresetType(raw: unknown): ThermostatPresetType | null {
    const obj = asObject(raw);
    if (!obj) return null;
    const scenario = pickNumber(obj, "0");
    const numberOfPresets = pickNumber(obj, "1");
    if (scenario === null || numberOfPresets === null) return null;
    const features = pickNumber(obj, "2") ?? 0;
    return { scenario, numberOfPresets, supportsNames: (features & PRESET_TYPE_SUPPORTS_NAMES) !== 0 };
}

/** Decoded PresetTypes (the scenarios this device supports, and how many presets of each), or undefined if not cached. */
export function readPresetTypes(node: MatterNode, endpoint: number): ThermostatPresetType[] | undefined {
    const raw = readThermostatAttribute(node, endpoint, ATTR_PRESET_TYPES);
    if (!Array.isArray(raw)) return undefined;
    return raw.map(decodePresetType).filter((t): t is ThermostatPresetType => t !== null);
}

/** Whether a preset of `scenario` may carry a Name; false when the scenario is unknown or PresetTypes isn't cached. */
export function presetTypeSupportsNames(presetTypes: ThermostatPresetType[], scenario: number | null): boolean {
    return presetTypes.some(t => t.scenario === scenario && t.supportsNames);
}

/** NumberOfPresets: how many presets the device holds in total, across all scenarios; null if not cached. */
export function readNumberOfPresets(node: MatterNode, endpoint: number): number | null {
    const raw = readThermostatAttribute(node, endpoint, ATTR_NUMBER_OF_PRESETS);
    return typeof raw === "number" ? raw : null;
}

/** A preset as the edit UI builds it, before it is placed into the full Presets array the device expects. */
export interface ThermostatPresetEdit {
    presetHandle: string | null;
    presetScenario: number;
    name: string | null;
    coolingSetpoint: number | null;
    heatingSetpoint: number | null;
    builtIn: boolean;
}

/** A decoded preset as the edit UI starts from it; an unknown scenario falls back to 0. */
export function toPresetEdit(preset: ThermostatPreset): ThermostatPresetEdit {
    return {
        presetHandle: preset.handle,
        presetScenario: preset.scenario ?? 0,
        name: preset.name,
        coolingSetpoint: preset.coolingSetpoint,
        heatingSetpoint: preset.heatingSetpoint,
        builtIn: preset.builtIn === true,
    };
}

/**
 * Applies the edit form's text inputs to `preset`. A blank or unparsable setpoint keeps the preset's value, and the
 * name is only taken when the preset's scenario supports names: the device rejects a Name on any other preset.
 */
export function applyPresetEdit(
    preset: ThermostatPreset,
    presetTypes: ThermostatPresetType[],
    input: { name: string; heating: string; cooling: string },
): ThermostatPresetEdit {
    const name = input.name.trim();
    return {
        ...toPresetEdit(preset),
        name: presetTypeSupportsNames(presetTypes, preset.scenario) ? name || null : preset.name,
        heatingSetpoint: parseSetpointInput(input.heating, preset.heatingSetpoint),
        coolingSetpoint: parseSetpointInput(input.cooling, preset.coolingSetpoint),
    };
}

/**
 * Why `name` cannot be used for a preset of `scenario`, or null if it can. Names must be unique per scenario, a
 * missing name included (§4.3.10.23.3), and a UserDefined preset needs one. `exceptHandle` is the preset being edited.
 */
export function presetNameConflict(
    presets: ThermostatPreset[],
    scenario: number,
    name: string | null,
    exceptHandle: string | null,
): string | null {
    if (scenario === PRESET_SCENARIO_USER_DEFINED && name === null) return "A user-defined preset needs a name";
    const taken = presets.some(p => p.handle !== exceptHandle && p.scenario === scenario && p.name === name);
    if (!taken) return null;
    return name === null
        ? "Another preset of this scenario already has no name"
        : `Another preset of this scenario is already named "${name}"`;
}

/** Whether a schedule transition refers to the preset; the device refuses to remove such a preset (§4.3.11.50). */
export function isPresetUsedBySchedule(schedules: ThermostatSchedule[], presetHandle: string): boolean {
    return schedules.some(s => s.transitions.some(t => t.presetHandle === presetHandle));
}

/**
 * Tag-keyed PresetStruct as `write_attribute` expects it. A null setpoint is omitted (the field isn't nullable), and
 * so is a null Name: the CHIP SDK treats an explicit null Name as set and rejects it for a scenario without names.
 */
function toPresetStruct(preset: ThermostatPresetEdit): Record<string, unknown> {
    const struct: Record<string, unknown> = {
        "0": preset.presetHandle,
        "1": preset.presetScenario,
        "5": preset.builtIn,
    };
    if (preset.name !== null) struct["2"] = preset.name;
    if (preset.coolingSetpoint !== null) struct["3"] = preset.coolingSetpoint;
    if (preset.heatingSetpoint !== null) struct["4"] = preset.heatingSetpoint;
    return struct;
}

/** `°C` text to the cluster's int16 centidegrees; blank or unparsable input keeps `fallbackCentidegrees`. */
export function parseSetpointInput(text: string, fallbackCentidegrees: number | null): number | null {
    const parsed = Number.parseFloat(text);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : fallbackCentidegrees;
}

/** Centidegrees to `°C` input text at full precision, so saving an untouched field writes back the same value. */
export function formatSetpointInput(centidegrees: number | null): string {
    return centidegrees === null ? "" : String(centidegrees / 100);
}

/**
 * Replaces the device's Presets list with the list `buildNext` derives from the device's current one. The result is
 * the full intended list, not a diff: per §4.3.11.50 a handle missing from it is a removal (rejected if that preset is
 * built-in, active or used by a schedule transition) and `presetHandle: null` is an addition.
 *
 * Presets may only be written inside an atomic write (§7.15.3), which `write_atomic_attribute` runs on the server. The
 * current list is read from the device just before, with the cluster's data version. The write carries that version,
 * so the device refuses it when anything in the cluster changed since the read (status 146) instead of overwriting a
 * change made elsewhere; the read and the write are then tried once more. The committed list arrives with the next
 * report. Needs {@link PRESET_WRITE_MIN_SCHEMA}.
 */
export async function writeThermostatPresets(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    buildNext: (current: ThermostatPreset[]) => ThermostatPresetEdit[],
): Promise<void> {
    const path = presetsPath(endpoint);
    let results: Array<{ Status: number }>;
    let attempt = 0;
    do {
        attempt++;
        const report = await client.read({ node_id: nodeId, attribute_paths: [path] });
        const current = decodePresets(report.attributes[path]);
        const dataVersion = report.data_versions?.[`${endpoint}/${THERMOSTAT_CLUSTER_ID}`];
        if (current === undefined || dataVersion === undefined) {
            throw new Error("The device did not report its presets");
        }
        results = await client.writeAtomicAttribute(nodeId, path, buildNext(current).map(toPresetStruct), dataVersion);
    } while (results[0]?.Status === DATA_VERSION_MISMATCH && attempt < PRESET_WRITE_ATTEMPTS);
    const status = results[0]?.Status;
    const hint = status === undefined ? undefined : PRESET_WRITE_HINTS[status];
    if (status !== undefined && hint !== undefined) {
        throw new Error(`Writing presets failed: ${hint} (${getMatterStatusName(status)}, ${status})`);
    }
    requireAttributeWriteSuccess(results, "Writing presets failed");
}

function presetsPath(endpoint: number): string {
    return `${endpoint}/${THERMOSTAT_CLUSTER_ID}/${ATTR_PRESETS}`;
}

/** Sets the thermostat's active preset (SetActivePresetRequest, §4.3.12.3); `presetHandle: null` clears it. */
export async function setActivePreset(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    presetHandle: string | null,
): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, THERMOSTAT_CLUSTER_ID, "SetActivePresetRequest", { presetHandle });
}
