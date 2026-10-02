/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterClient } from "@matter-server/ws-client";
import { toNumber } from "./attribute-shapes.js";

export const WATER_HEATER_MANAGEMENT_CLUSTER_ID = 0x0094; // 148

const ATTR_HEATER_TYPES = 0x00;
const ATTR_HEAT_DEMAND = 0x01;
const ATTR_TANK_VOLUME = 0x02;
const ATTR_ESTIMATED_HEAT_REQUIRED = 0x03;
const ATTR_TANK_PERCENTAGE = 0x04;
const ATTR_BOOST_STATE = 0x05;
const ATTR_FEATURE_MAP = 0xfffc;

const HEATER_TYPE_NAMES: Record<number, string> = {
    0: "Immersion Element 1",
    1: "Immersion Element 2",
    2: "Heat Pump",
    3: "Boiler",
    4: "Other",
};

const BOOST_STATE_NAMES: Record<number, string> = {
    0: "Inactive",
    1: "Active",
};

const FEATURE_ENERGY_MANAGEMENT = 1 << 0;
const FEATURE_TANK_PERCENT = 1 << 1;

function attr(attributes: Record<string, unknown>, endpoint: number, attributeId: number): unknown {
    return attributes[`${endpoint}/${WATER_HEATER_MANAGEMENT_CLUSTER_ID}/${attributeId}`];
}

function heaterTypesToNames(bitmap: number): string[] {
    const names: string[] = [];
    for (let bit = 0; bit < 5; bit++) {
        if ((bitmap & (1 << bit)) !== 0) {
            names.push(HEATER_TYPE_NAMES[bit] ?? `Unknown (${bit})`);
        }
    }
    return names;
}

export interface BoostInfoStruct {
    duration: number; // seconds
    oneShot?: boolean;
    emergencyBoost?: boolean;
    temporarySetpoint?: number; // Celsius
    targetPercentage?: number; // 0-100%
}

export interface WaterHeaterManagementInfo {
    supported: boolean;
    heaterTypes?: string[]; // Heat sources the device has
    heaterTypesBitmap?: number;
    heatDemandTypes?: string[]; // Currently demanding heat
    heatDemandBitmap?: number;
    tankPercentage?: number; // 0-100
    boostState?: string; // "Inactive" or "Active"
    boostStateValue?: number;
    boostActive?: boolean;
    tankVolumeL?: number; // Liters (if EM feature supported)
    estimatedHeatRequiredMilliWh?: number; // if EM feature supported
    supportsEnergyManagement?: boolean;
    supportsTankPercent?: boolean;
}

export function waterHeaterManagementInfo(
    attributes: Record<string, unknown>,
    endpoint: number,
): WaterHeaterManagementInfo {
    const result: WaterHeaterManagementInfo = { supported: false };
    let hasAnyAttribute = false;

    const heaterTypes = toNumber(attr(attributes, endpoint, ATTR_HEATER_TYPES));
    if (heaterTypes !== undefined) {
        hasAnyAttribute = true;
        result.heaterTypesBitmap = heaterTypes;
        result.heaterTypes = heaterTypesToNames(heaterTypes);
    }

    const heatDemand = toNumber(attr(attributes, endpoint, ATTR_HEAT_DEMAND));
    if (heatDemand !== undefined) {
        hasAnyAttribute = true;
        result.heatDemandBitmap = heatDemand;
        result.heatDemandTypes = heaterTypesToNames(heatDemand);
    }

    const tankVolume = toNumber(attr(attributes, endpoint, ATTR_TANK_VOLUME));
    if (tankVolume !== undefined) {
        hasAnyAttribute = true;
        result.tankVolumeL = tankVolume;
    }

    const estimatedHeatRequired = toNumber(attr(attributes, endpoint, ATTR_ESTIMATED_HEAT_REQUIRED));
    if (estimatedHeatRequired !== undefined) {
        hasAnyAttribute = true;
        result.estimatedHeatRequiredMilliWh = estimatedHeatRequired;
    }

    const tankPercentage = toNumber(attr(attributes, endpoint, ATTR_TANK_PERCENTAGE));
    if (tankPercentage !== undefined) {
        hasAnyAttribute = true;
        result.tankPercentage = tankPercentage;
    }

    const boostStateValue = toNumber(attr(attributes, endpoint, ATTR_BOOST_STATE));
    if (boostStateValue !== undefined) {
        hasAnyAttribute = true;
        result.boostStateValue = boostStateValue;
        result.boostState = BOOST_STATE_NAMES[boostStateValue] ?? `Unknown (${boostStateValue})`;
        result.boostActive = boostStateValue === 1;
    }

    const featureMap = toNumber(attr(attributes, endpoint, ATTR_FEATURE_MAP));
    if (featureMap !== undefined) {
        hasAnyAttribute = true;
        result.supportsEnergyManagement = (featureMap & FEATURE_ENERGY_MANAGEMENT) !== 0;
        result.supportsTankPercent = (featureMap & FEATURE_TANK_PERCENT) !== 0;
    }

    result.supported = hasAnyAttribute;
    return result;
}

/** Heat sources as display text: "—" when not reported, "None" for an empty bitmap. */
export function heatSourcesText(names: string[] | undefined): string {
    if (names === undefined) return "—";
    return names.length ? names.join(", ") : "None";
}

/** Formats an `energy-mWh` value as kWh. */
export function formatEnergyKwh(milliWattHours: number): string {
    return `${(milliWattHours / 1_000_000).toFixed(2)} kWh`;
}

type CommandClient = Pick<MatterClient, "deviceCommand">;

/** Raw text of the Boost form inputs. */
export interface BoostForm {
    duration: string;
    oneShot: boolean;
    emergencyBoost: boolean;
    temporarySetpoint: string;
    targetPercentage: string;
}

/**
 * Validates the Boost form against the BoostInfoStruct constraints. Empty optional fields are left
 * out; TargetPercentage is only sent with the TankPercent feature, which it requires.
 */
export function parseBoostForm(
    form: BoostForm,
    supportsTankPercent: boolean,
): { params: BoostInfoStruct } | { error: string } {
    const duration = Number(form.duration);
    if (form.duration.trim() === "" || !Number.isInteger(duration) || duration < 1 || duration > 0xffffffff) {
        return { error: "Duration must be a whole number of seconds, at least 1." };
    }
    const params: BoostInfoStruct = { duration };
    if (form.oneShot) params.oneShot = true;
    if (form.emergencyBoost) params.emergencyBoost = true;

    if (form.temporarySetpoint.trim() !== "") {
        const setpoint = Number(form.temporarySetpoint);
        if (!Number.isFinite(setpoint) || setpoint < -273.15 || setpoint > 327.67) {
            return { error: "Temporary setpoint must be a temperature in °C." };
        }
        params.temporarySetpoint = setpoint;
    }

    if (supportsTankPercent && form.targetPercentage.trim() !== "") {
        const percentage = Number(form.targetPercentage);
        if (!Number.isInteger(percentage) || percentage < 0 || percentage > 100) {
            return { error: "Target tank level must be a whole number from 0 to 100." };
        }
        params.targetPercentage = percentage;
    }
    return { params };
}

export async function startBoost(
    client: CommandClient,
    nodeId: number | bigint,
    endpoint: number,
    params: BoostInfoStruct,
): Promise<void> {
    const boostInfo: Record<string, unknown> = {
        duration: params.duration,
    };

    if (params.oneShot !== undefined) {
        boostInfo.oneShot = params.oneShot;
    }
    if (params.emergencyBoost !== undefined) {
        boostInfo.emergencyBoost = params.emergencyBoost;
    }
    if (params.temporarySetpoint !== undefined) {
        // Matter temperature is in 0.01 °C
        boostInfo.temporarySetpoint = Math.round(params.temporarySetpoint * 100);
    }
    if (params.targetPercentage !== undefined) {
        boostInfo.targetPercentage = params.targetPercentage;
    }

    await client.deviceCommand(nodeId, endpoint, WATER_HEATER_MANAGEMENT_CLUSTER_ID, "Boost", { boostInfo });
}

export async function cancelBoost(client: CommandClient, nodeId: number | bigint, endpoint: number): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, WATER_HEATER_MANAGEMENT_CLUSTER_ID, "CancelBoost");
}
