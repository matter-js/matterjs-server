/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterClient, MatterNode } from "@matter-server/ws-client";
import { asObject, pickNumber } from "./attribute-shapes.js";
import { getMatterStatusName, requireAttributeWriteSuccess } from "./matter-status.js";
import { readThermostatAttribute, THERMOSTAT_CLUSTER_ID, type ThermostatPreset } from "./thermostat-schedule.js";

const ATTR_PRESET_TYPES = 0x48;
const ATTR_PRESETS = 0x50;

/** PresetTypeFeaturesBitmap (Matter spec §4.3.10.18): bit 1 says a preset of this scenario may carry a Name. */
const PRESET_TYPE_SUPPORTS_NAMES = 0x2;

/**
 * How long the device holds our pending Presets write before discarding it (AtomicRequest Timeout, ms).
 * matter.js's own ThermostatServer caps this at 9000ms, so this stays comfortably under that.
 */
const ATOMIC_WRITE_TIMEOUT_MS = 5_000;

enum AtomicRequestType {
    BeginWrite = 0,
    CommitWrite = 1,
    RollbackWrite = 2,
}

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

/** A preset as the edit UI builds it, before it is placed into the full Presets array the device expects. */
export interface ThermostatPresetEdit {
    presetHandle: string | null;
    presetScenario: number;
    name: string | null;
    coolingSetpoint: number | null;
    heatingSetpoint: number | null;
    builtIn: boolean;
}

/** A decoded preset as the Presets array's full-replace write expects it, field names included. */
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

interface AtomicResponse {
    statusCode: number;
    attributeStatus?: { attributeId: number; statusCode: number }[];
}

async function atomicRequest(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    requestType: AtomicRequestType,
    timeout?: number,
): Promise<AtomicResponse> {
    return (await client.deviceCommand(nodeId, endpoint, THERMOSTAT_CLUSTER_ID, "AtomicRequest", {
        requestType,
        attributeRequests: [ATTR_PRESETS],
        timeout,
    })) as AtomicResponse;
}

function describeAtomicFailure(response: AtomicResponse): string {
    const code = response.attributeStatus?.find(s => s.attributeId === ATTR_PRESETS)?.statusCode ?? response.statusCode;
    return `${getMatterStatusName(code)} (${code})`;
}

/**
 * Replaces the device's Presets list with `nextPresets` — the full intended list, not a diff: per §4.3.9.3.2 a
 * handle missing from it is a removal (rejected if that preset is built-in) and `presetHandle: null` is an
 * addition.
 *
 * A bare `write_attribute` on Presets is only valid inside the cluster's atomic-write handshake (the device
 * holds the pending list until AtomicRequest CommitWrite and discards it on Timeout or RollbackWrite); a write
 * outside it is rejected as InvalidInState.
 */
export async function writeThermostatPresets(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    nextPresets: ThermostatPresetEdit[],
): Promise<void> {
    const begin = await atomicRequest(client, nodeId, endpoint, AtomicRequestType.BeginWrite, ATOMIC_WRITE_TIMEOUT_MS);
    if (begin.statusCode !== 0) {
        throw new Error(`Could not start editing presets: ${describeAtomicFailure(begin)}`);
    }

    try {
        const writeResults = await client.writeAttribute(
            nodeId,
            `${endpoint}/${THERMOSTAT_CLUSTER_ID}/${ATTR_PRESETS}`,
            nextPresets.map(preset => ({ ...preset })),
        );
        requireAttributeWriteSuccess(writeResults, "Writing presets failed");
    } catch (error) {
        await atomicRequest(client, nodeId, endpoint, AtomicRequestType.RollbackWrite).catch((rollbackError: unknown) =>
            console.error("Could not roll back a failed preset write", rollbackError),
        );
        throw error;
    }

    const commit = await atomicRequest(client, nodeId, endpoint, AtomicRequestType.CommitWrite);
    if (commit.statusCode !== 0) {
        throw new Error(`Could not commit preset changes: ${describeAtomicFailure(commit)}`);
    }
}

/** Sets the thermostat's active preset (SetActivePresetRequest, §4.3.9.1); `presetHandle: null` clears it. */
export async function setActivePreset(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    presetHandle: string | null,
): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, THERMOSTAT_CLUSTER_ID, "SetActivePresetRequest", { presetHandle });
}
