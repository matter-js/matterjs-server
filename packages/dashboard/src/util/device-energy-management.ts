/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { tagField as field, toNumber } from "./attribute-shapes.js";
import { currencyInfo, formatPrice, type CurrencyInfo } from "./commodity-tariff.js";

export const DEVICE_ENERGY_MANAGEMENT_CLUSTER_ID = 152;

const ATTR_ESA_TYPE = 0;
const ATTR_ESA_CAN_GENERATE = 1;
const ATTR_ESA_STATE = 2;
const ATTR_ABS_MIN_POWER = 3;
const ATTR_ABS_MAX_POWER = 4;
const ATTR_FORECAST = 6;
const ATTR_OPT_OUT_STATE = 7;
const ATTR_FEATURE_MAP = 0xfffc;

/** DeviceEnergyManagement FeatureMap bits per Matter 1.6 §9.2.4. */
const FEATURE_POWER_ADJUSTMENT = 1 << 0;
const FEATURE_POWER_FORECAST_REPORTING = 1 << 1;
const FEATURE_STATE_FORECAST_REPORTING = 1 << 2;
const FEATURE_START_TIME_ADJUSTMENT = 1 << 3;
const FEATURE_PAUSABLE = 1 << 4;
const FEATURE_FORECAST_ADJUSTMENT = 1 << 5;
const FEATURE_CONSTRAINT_BASED_ADJUSTMENT = 1 << 6;

const ESA_TYPE_NAMES: Record<number, string> = {
    0: "EV Supply Equipment",
    1: "Space heating",
    2: "Water heating",
    3: "Space cooling",
    4: "Space heating & cooling",
    5: "Battery storage",
    6: "Solar PV",
    7: "Fridge / freezer",
    8: "Washing machine",
    9: "Dishwasher",
    10: "Cooking",
    11: "Home water pump",
    12: "Irrigation water pump",
    13: "Pool pump",
    255: "Other",
};

const ESA_STATE_NAMES: Record<number, string> = {
    0: "Offline",
    1: "Online",
    2: "Fault",
    3: "Power adjust active",
    4: "Paused",
};

const OPT_OUT_STATE_NAMES: Record<number, string> = {
    0: "No opt-out",
    1: "Local opt-out",
    2: "Grid opt-out",
    3: "Opted out",
};

const FORECAST_UPDATE_REASON_NAMES: Record<number, string> = {
    0: "Internal optimization",
    1: "Local optimization",
    2: "Grid optimization",
};

const COST_TYPE_NAMES: Record<number, string> = {
    0: "Financial",
    1: "GHG emissions",
    2: "Comfort",
    3: "Temperature",
};

/** Where a slot sits relative to Forecast.ActiveSlotNumber. */
export type SlotStatus = "completed" | "active" | "scheduled";

export interface DeviceEnergyManagementFeatures {
    powerAdjustment: boolean;
    powerForecastReporting: boolean;
    stateForecastReporting: boolean;
    startTimeAdjustment: boolean;
    pausable: boolean;
    forecastAdjustment: boolean;
    constraintBasedAdjustment: boolean;
}

export interface ForecastCostInfo {
    type: string;
    /** Value scaled by DecimalPoints, with the currency symbol when the cost carries one. */
    amount?: string;
}

export interface ForecastSlotInfo {
    /** Position in Forecast.Slots; ActiveSlotNumber indexes this same list. */
    index: number;
    status: SlotStatus;
    minDurationSeconds?: number;
    maxDurationSeconds?: number;
    defaultDurationSeconds?: number;
    elapsedSeconds?: number;
    remainingSeconds?: number;
    /** Live clock (elapsed + remaining) for the running slot, planned duration otherwise. */
    durationSeconds?: number;
    /** Matter epoch-s, accumulated from Forecast.StartTime over the preceding slots' durations. */
    startTime?: number;
    endTime?: number;
    pausable?: boolean;
    minPauseSeconds?: number;
    maxPauseSeconds?: number;
    /** Opaque device-defined state under SFR; only the manufacturer knows what it names. */
    manufacturerEsaState?: number;
    nominalPowerW?: number;
    minPowerW?: number;
    maxPowerW?: number;
    /** Negative for a slot that generates rather than consumes. */
    energyWh?: number;
    /** The slot reported no NominalEnergy, so its energy is nominal power over the slot duration. */
    energyEstimated: boolean;
    minPowerAdjustmentW?: number;
    maxPowerAdjustmentW?: number;
    minDurationAdjustmentSeconds?: number;
    maxDurationAdjustmentSeconds?: number;
    costs: ForecastCostInfo[];
}

export interface ForecastInfo {
    forecastId?: number;
    /** Index into `slots` of the running slot; absent when the device reports none. */
    activeSlotNumber?: number;
    startTime?: number;
    endTime?: number;
    earliestStartTime?: number;
    latestEndTime?: number;
    isPausable?: boolean;
    updateReason?: string;
    slots: ForecastSlotInfo[];
    durationSeconds?: number;
    consumedEnergyWh: number;
    generatedEnergyWh: number;
    /** A consuming slot's energy was derived from its nominal power rather than reported. */
    consumedEnergyEstimated: boolean;
    /** A generating slot's energy was derived from its nominal power rather than reported. */
    generatedEnergyEstimated: boolean;
}

export interface DeviceEnergyManagementInfo {
    supported: boolean;
    esaTypeId?: number;
    esaType?: string;
    canGenerate?: boolean;
    esaState?: string;
    absMinPowerW?: number;
    absMaxPowerW?: number;
    optOutState?: string;
    features: DeviceEnergyManagementFeatures;
    forecast?: ForecastInfo;
}

function attr(attributes: Record<string, unknown>, endpoint: number, attributeId: number): unknown {
    return attributes[`${endpoint}/${DEVICE_ENERGY_MANAGEMENT_CLUSTER_ID}/${attributeId}`];
}

function enumName(value: unknown, names: Record<number, string>): string | undefined {
    const raw = toNumber(value);
    if (raw === undefined) return undefined;
    return names[raw] ?? `Unknown (${raw})`;
}

function toBoolean(value: unknown): boolean | undefined {
    return typeof value === "boolean" ? value : undefined;
}

/** power-mW and energy-mWh fields carry milli-units; the dashboard works in W and Wh. */
function milliToUnit(value: unknown): number | undefined {
    const raw = toNumber(value);
    return raw !== undefined ? raw / 1000 : undefined;
}

function decodeFeatures(featureMap: unknown): DeviceEnergyManagementFeatures {
    const bits = toNumber(featureMap) ?? 0;
    return {
        powerAdjustment: (bits & FEATURE_POWER_ADJUSTMENT) !== 0,
        powerForecastReporting: (bits & FEATURE_POWER_FORECAST_REPORTING) !== 0,
        stateForecastReporting: (bits & FEATURE_STATE_FORECAST_REPORTING) !== 0,
        startTimeAdjustment: (bits & FEATURE_START_TIME_ADJUSTMENT) !== 0,
        pausable: (bits & FEATURE_PAUSABLE) !== 0,
        forecastAdjustment: (bits & FEATURE_FORECAST_ADJUSTMENT) !== 0,
        constraintBasedAdjustment: (bits & FEATURE_CONSTRAINT_BASED_ADJUSTMENT) !== 0,
    };
}

/** DecimalPoints is a uint8; a scale past a few digits is not a cost this can render, and toFixed rejects 101+. */
const MAX_COST_DECIMAL_POINTS = 6;

function formatCost(value: number, decimalPoints: number, currency: CurrencyInfo | undefined): string | undefined {
    if (decimalPoints < 0 || decimalPoints > MAX_COST_DECIMAL_POINTS) return undefined;
    return formatPrice(value, currency) ?? (value / 10 ** decimalPoints).toFixed(decimalPoints);
}

function decodeCost(value: unknown): ForecastCostInfo | undefined {
    const type = enumName(field(value, 0), COST_TYPE_NAMES);
    const rawValue = toNumber(field(value, 1));
    if (type === undefined && rawValue === undefined) return undefined;
    const decimalPoints = toNumber(field(value, 2)) ?? 0;
    return {
        type: type ?? "Unknown",
        amount:
            rawValue === undefined
                ? undefined
                : formatCost(rawValue, decimalPoints, currencyInfo(field(value, 3), decimalPoints)),
    };
}

function decodeCosts(value: unknown): ForecastCostInfo[] {
    return Array.isArray(value) ? value.map(decodeCost).filter((c): c is ForecastCostInfo => c !== undefined) : [];
}

function slotStatus(index: number, activeSlotNumber: number | undefined): SlotStatus {
    if (activeSlotNumber === undefined) return "scheduled";
    if (index < activeSlotNumber) return "completed";
    return index === activeSlotNumber ? "active" : "scheduled";
}

/**
 * The running slot's own clock is the only figure that tracks a device drifting from its plan;
 * for every other slot DefaultDuration is all the forecast commits to.
 */
function slotDuration(
    status: SlotStatus,
    elapsed: number | undefined,
    remaining: number | undefined,
    defaultDuration: number | undefined,
    minDuration: number | undefined,
): number | undefined {
    if (status === "active" && elapsed !== undefined && remaining !== undefined) return elapsed + remaining;
    return defaultDuration ?? (remaining !== undefined && remaining > 0 ? remaining : undefined) ?? minDuration;
}

function decodeSlot(value: unknown, index: number, activeSlotNumber: number | undefined): ForecastSlotInfo {
    const status = slotStatus(index, activeSlotNumber);
    const minDurationSeconds = toNumber(field(value, 0));
    const defaultDurationSeconds = toNumber(field(value, 2));
    const elapsedSeconds = toNumber(field(value, 3));
    const remainingSeconds = toNumber(field(value, 4));
    const durationSeconds = slotDuration(
        status,
        elapsedSeconds,
        remainingSeconds,
        defaultDurationSeconds,
        minDurationSeconds,
    );
    const nominalPowerW = milliToUnit(field(value, 9));
    const nominalEnergyWh = milliToUnit(field(value, 12));
    const energyWh =
        nominalEnergyWh ??
        (nominalPowerW !== undefined && durationSeconds !== undefined
            ? (nominalPowerW * durationSeconds) / 3600
            : undefined);

    return {
        index,
        status,
        minDurationSeconds,
        maxDurationSeconds: toNumber(field(value, 1)),
        defaultDurationSeconds,
        elapsedSeconds,
        remainingSeconds,
        durationSeconds,
        pausable: toBoolean(field(value, 5)),
        minPauseSeconds: toNumber(field(value, 6)),
        maxPauseSeconds: toNumber(field(value, 7)),
        manufacturerEsaState: toNumber(field(value, 8)),
        nominalPowerW,
        minPowerW: milliToUnit(field(value, 10)),
        maxPowerW: milliToUnit(field(value, 11)),
        energyWh,
        energyEstimated: nominalEnergyWh === undefined && energyWh !== undefined,
        minPowerAdjustmentW: milliToUnit(field(value, 14)),
        maxPowerAdjustmentW: milliToUnit(field(value, 15)),
        minDurationAdjustmentSeconds: toNumber(field(value, 16)),
        maxDurationAdjustmentSeconds: toNumber(field(value, 17)),
        costs: decodeCosts(field(value, 13)),
    };
}

/**
 * Slots carry durations, not instants, so a slot's clock time is Forecast.StartTime plus everything
 * ahead of it. A slot whose duration is unknown breaks the chain: the ones after it get no times.
 */
function applySlotTimes(slots: ForecastSlotInfo[], forecastStartTime: number | undefined): void {
    let cursor = forecastStartTime;
    for (const slot of slots) {
        if (cursor === undefined) return;
        slot.startTime = cursor;
        if (slot.durationSeconds === undefined) {
            cursor = undefined;
            continue;
        }
        cursor += slot.durationSeconds;
        slot.endTime = cursor;
    }
}

function decodeForecast(value: unknown): ForecastInfo | undefined {
    const rawSlots = field(value, 7);
    const startTime = toNumber(field(value, 2));
    const endTime = toNumber(field(value, 3));
    if (!Array.isArray(rawSlots) && startTime === undefined) return undefined;

    const activeSlotNumber = toNumber(field(value, 1));
    const slots = Array.isArray(rawSlots)
        ? rawSlots.map((slot, index) => decodeSlot(slot, index, activeSlotNumber))
        : [];
    applySlotTimes(slots, startTime);

    const energies = slots.map(slot => slot.energyWh).filter((wh): wh is number => wh !== undefined);
    // A partial sum would be shown as the whole forecast's length, so the fallback only applies when
    // every slot contributes.
    const slotSeconds = slots.every(slot => slot.durationSeconds !== undefined)
        ? slots.reduce((total, slot) => total + (slot.durationSeconds ?? 0), 0)
        : 0;

    return {
        forecastId: toNumber(field(value, 0)),
        activeSlotNumber,
        startTime,
        endTime,
        earliestStartTime: toNumber(field(value, 4)),
        latestEndTime: toNumber(field(value, 5)),
        isPausable: toBoolean(field(value, 6)),
        updateReason: enumName(field(value, 8), FORECAST_UPDATE_REASON_NAMES),
        slots,
        durationSeconds:
            startTime !== undefined && endTime !== undefined
                ? endTime - startTime
                : slotSeconds > 0
                  ? slotSeconds
                  : undefined,
        consumedEnergyWh: energies.filter(wh => wh > 0).reduce((total, wh) => total + wh, 0),
        generatedEnergyWh: energies.filter(wh => wh < 0).reduce((total, wh) => total - wh, 0),
        consumedEnergyEstimated: slots.some(slot => slot.energyEstimated && (slot.energyWh ?? 0) > 0),
        generatedEnergyEstimated: slots.some(slot => slot.energyEstimated && (slot.energyWh ?? 0) < 0),
    };
}

export function deviceEnergyManagementInfo(
    attributes: Record<string, unknown>,
    endpoint: number,
): DeviceEnergyManagementInfo {
    const featureMap = attr(attributes, endpoint, ATTR_FEATURE_MAP);
    const esaTypeId = toNumber(attr(attributes, endpoint, ATTR_ESA_TYPE));

    return {
        supported: featureMap !== undefined,
        esaTypeId,
        esaType: enumName(esaTypeId, ESA_TYPE_NAMES),
        canGenerate: toBoolean(attr(attributes, endpoint, ATTR_ESA_CAN_GENERATE)),
        esaState: enumName(attr(attributes, endpoint, ATTR_ESA_STATE), ESA_STATE_NAMES),
        absMinPowerW: milliToUnit(attr(attributes, endpoint, ATTR_ABS_MIN_POWER)),
        absMaxPowerW: milliToUnit(attr(attributes, endpoint, ATTR_ABS_MAX_POWER)),
        optOutState: enumName(attr(attributes, endpoint, ATTR_OPT_OUT_STATE), OPT_OUT_STATE_NAMES),
        features: decodeFeatures(featureMap),
        forecast: decodeForecast(attr(attributes, endpoint, ATTR_FORECAST)),
    };
}

/** Formats watts, switching to kW past 10 kW where the extra digits stop carrying meaning. */
export function formatPower(watts: number): string {
    if (Math.abs(watts) >= 10_000) return `${(watts / 1000).toFixed(2)} kW`;
    return `${Number(watts.toFixed(1))} W`;
}

export function formatEnergy(wattHours: number): string {
    if (Math.abs(wattHours) >= 1000) return `${(wattHours / 1000).toFixed(2)} kWh`;
    return `${Number(wattHours.toFixed(1))} Wh`;
}
