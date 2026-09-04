/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterClient } from "@matter-server/ws-client";
import { asObject, pickArray, pickBoolean, pickNumber, toNumber, toText } from "./attribute-shapes.js";

export const ENERGY_EVSE_CLUSTER_ID = 153; // 0x99

const ATTR_STATE = 0x00;
const ATTR_SUPPLY_STATE = 0x01;
const ATTR_FAULT_STATE = 0x02;
const ATTR_CHARGING_ENABLED_UNTIL = 0x03;
const ATTR_DISCHARGING_ENABLED_UNTIL = 0x04;
const ATTR_CIRCUIT_CAPACITY = 0x05;
const ATTR_MINIMUM_CHARGE_CURRENT = 0x06;
const ATTR_MAXIMUM_CHARGE_CURRENT = 0x07;
const ATTR_MAXIMUM_DISCHARGE_CURRENT = 0x08;
const ATTR_USER_MAXIMUM_CHARGE_CURRENT = 0x09;
const ATTR_RANDOMIZATION_DELAY_WINDOW = 0x0a;
const ATTR_NEXT_CHARGE_START_TIME = 0x23;
const ATTR_NEXT_CHARGE_TARGET_TIME = 0x24;
const ATTR_NEXT_CHARGE_REQUIRED_ENERGY = 0x25;
const ATTR_NEXT_CHARGE_TARGET_SOC = 0x26;
const ATTR_APPROXIMATE_EV_EFFICIENCY = 0x27;
const ATTR_STATE_OF_CHARGE = 0x30;
const ATTR_BATTERY_CAPACITY = 0x31;
const ATTR_VEHICLE_ID = 0x32;
const ATTR_SESSION_ID = 0x40;
const ATTR_SESSION_DURATION = 0x41;
const ATTR_SESSION_ENERGY_CHARGED = 0x42;
const ATTR_SESSION_ENERGY_DISCHARGED = 0x43;
const ATTR_FEATURE_MAP = 0xfffc;

/** EnergyEvse FeatureMap bits per Matter 1.6 §9.3.4. */
const FEATURE_BIT_CHARGING_PREFERENCES = 0b1;
const FEATURE_BIT_SOC_REPORTING = 0b10;
const FEATURE_BIT_PLUG_AND_CHARGE = 0b100;
const FEATURE_BIT_V2X = 0b10000;

const SUPPLY_STATE_DISABLED = 0;
/** Self-diagnostics mode: EnableCharging/EnableDischarging are rejected until Disable clears it. */
const SUPPLY_STATE_DISABLED_DIAGNOSTICS = 4;

const STATE_NAMES: Record<number, string> = {
    0: "Not plugged in",
    1: "Plugged in, no demand",
    2: "Plugged in, demand (not allowed)",
    3: "Plugged in, charging",
    4: "Plugged in, discharging",
    5: "Session ending",
    6: "Fault",
};

const SUPPLY_STATE_NAMES: Record<number, string> = {
    0: "Disabled",
    1: "Charging enabled",
    2: "Discharging enabled",
    3: "Disabled (error)",
    4: "Disabled (diagnostics)",
    5: "Charging and discharging enabled",
};

const FAULT_STATE_NAMES: Record<number, string> = {
    0: "No error",
    1: "Meter failure",
    2: "Over voltage",
    3: "Under voltage",
    4: "Over current",
    5: "Contact wet failure",
    6: "Contact dry failure",
    7: "Ground fault",
    8: "Power loss",
    9: "Power quality",
    10: "Pilot short circuit",
    11: "Emergency stop",
    12: "EV disconnected",
    13: "Wrong power supply",
    14: "Live/neutral swap",
    15: "Over temperature",
    255: "Other",
};

export interface SessionInfo {
    id: number;
    durationS?: number;
    energyChargedKWh?: number;
    energyDischargedKWh?: number;
}

export interface EnergyEvseInfo {
    supported: boolean;
    state?: string;
    supplyState?: string;
    /** SupplyState is DisabledDiagnostics: EnableCharging/EnableDischarging are rejected until Disable clears it. */
    diagnosticsActive: boolean;
    /** Whether StartDiagnostics is expected to succeed right now (the device only accepts it while fully disabled). */
    canStartDiagnostics: boolean;
    faultState?: string;
    faultActive: boolean;
    /** undefined: not reported. null: no expiry, i.e. charging stays enabled until disabled explicitly. */
    chargingEnabledUntil?: number | null;
    circuitCapacityA?: number;
    minimumChargeCurrentA?: number;
    maximumChargeCurrentA?: number;
    userMaximumChargeCurrentA?: number;
    randomizationDelayWindowS?: number;
    /** undefined when the EV has never been plugged in (SessionID is still null). */
    session?: SessionInfo;

    v2xSupported: boolean;
    dischargingEnabledUntil?: number | null;
    maximumDischargeCurrentA?: number;

    chargingPreferencesSupported: boolean;
    nextChargeStartTime?: number | null;
    nextChargeTargetTime?: number | null;
    nextChargeRequiredEnergyKWh?: number | null;
    nextChargeTargetSoC?: number | null;
    approximateEvEfficiencyKmPerKWh?: number | null;

    soCReportingSupported: boolean;
    stateOfCharge?: number | null;
    batteryCapacityKWh?: number | null;

    plugAndChargeSupported: boolean;
    vehicleId?: string | null;
}

function attr(attributes: Record<string, unknown>, endpoint: number, attributeId: number): unknown {
    return attributes[`${endpoint}/${ENERGY_EVSE_CLUSTER_ID}/${attributeId}`];
}

function enumName(value: unknown, names: Record<number, string>): string | undefined {
    const raw = toNumber(value);
    if (raw === undefined) return undefined;
    return names[raw] ?? `Unknown (${raw})`;
}

/** Distinguishes an attribute that hasn't been reported (undefined) from its explicit null value. */
function nullableNumber(value: unknown): number | null | undefined {
    if (value === null) return null;
    if (value === undefined) return undefined;
    return toNumber(value);
}

function nullableText(value: unknown): string | null | undefined {
    if (value === null) return null;
    if (value === undefined) return undefined;
    return toText(value) ?? null;
}

/** Scales a nullable reading (e.g. energy-mWh) to its display unit, passing null/undefined through unchanged. */
function scaleNullable(value: number | null | undefined, factor: number): number | null | undefined {
    return typeof value === "number" ? value / factor : value;
}

function toAmps(valueMa: number | undefined): number | undefined {
    return valueMa === undefined ? undefined : valueMa / 1000;
}

function decodeSession(attributes: Record<string, unknown>, endpoint: number): SessionInfo | undefined {
    const id = nullableNumber(attr(attributes, endpoint, ATTR_SESSION_ID));
    if (id === undefined || id === null) return undefined;
    return {
        id,
        durationS: toNumber(attr(attributes, endpoint, ATTR_SESSION_DURATION)),
        energyChargedKWh:
            scaleNullable(toNumber(attr(attributes, endpoint, ATTR_SESSION_ENERGY_CHARGED)), 1_000_000) ?? undefined,
        energyDischargedKWh:
            scaleNullable(toNumber(attr(attributes, endpoint, ATTR_SESSION_ENERGY_DISCHARGED)), 1_000_000) ?? undefined,
    };
}

export function energyEvseInfo(attributes: Record<string, unknown>, endpoint: number): EnergyEvseInfo {
    const featureMap = toNumber(attr(attributes, endpoint, ATTR_FEATURE_MAP));
    const faultStateRaw = toNumber(attr(attributes, endpoint, ATTR_FAULT_STATE));
    const supplyStateRaw = toNumber(attr(attributes, endpoint, ATTR_SUPPLY_STATE));

    return {
        supported: featureMap !== undefined,
        state: enumName(attr(attributes, endpoint, ATTR_STATE), STATE_NAMES),
        supplyState: enumName(supplyStateRaw, SUPPLY_STATE_NAMES),
        diagnosticsActive: supplyStateRaw === SUPPLY_STATE_DISABLED_DIAGNOSTICS,
        canStartDiagnostics: supplyStateRaw === undefined || supplyStateRaw === SUPPLY_STATE_DISABLED,
        faultState: enumName(faultStateRaw, FAULT_STATE_NAMES),
        faultActive: faultStateRaw !== undefined && faultStateRaw !== 0,
        chargingEnabledUntil: nullableNumber(attr(attributes, endpoint, ATTR_CHARGING_ENABLED_UNTIL)),
        circuitCapacityA: toAmps(toNumber(attr(attributes, endpoint, ATTR_CIRCUIT_CAPACITY))),
        minimumChargeCurrentA: toAmps(toNumber(attr(attributes, endpoint, ATTR_MINIMUM_CHARGE_CURRENT))),
        maximumChargeCurrentA: toAmps(toNumber(attr(attributes, endpoint, ATTR_MAXIMUM_CHARGE_CURRENT))),
        userMaximumChargeCurrentA: toAmps(toNumber(attr(attributes, endpoint, ATTR_USER_MAXIMUM_CHARGE_CURRENT))),
        randomizationDelayWindowS: toNumber(attr(attributes, endpoint, ATTR_RANDOMIZATION_DELAY_WINDOW)),
        session: decodeSession(attributes, endpoint),

        v2xSupported: ((featureMap ?? 0) & FEATURE_BIT_V2X) !== 0,
        dischargingEnabledUntil: nullableNumber(attr(attributes, endpoint, ATTR_DISCHARGING_ENABLED_UNTIL)),
        maximumDischargeCurrentA: toAmps(toNumber(attr(attributes, endpoint, ATTR_MAXIMUM_DISCHARGE_CURRENT))),

        chargingPreferencesSupported: ((featureMap ?? 0) & FEATURE_BIT_CHARGING_PREFERENCES) !== 0,
        nextChargeStartTime: nullableNumber(attr(attributes, endpoint, ATTR_NEXT_CHARGE_START_TIME)),
        nextChargeTargetTime: nullableNumber(attr(attributes, endpoint, ATTR_NEXT_CHARGE_TARGET_TIME)),
        nextChargeRequiredEnergyKWh: scaleNullable(
            nullableNumber(attr(attributes, endpoint, ATTR_NEXT_CHARGE_REQUIRED_ENERGY)),
            1_000_000,
        ),
        nextChargeTargetSoC: nullableNumber(attr(attributes, endpoint, ATTR_NEXT_CHARGE_TARGET_SOC)),
        approximateEvEfficiencyKmPerKWh: scaleNullable(
            nullableNumber(attr(attributes, endpoint, ATTR_APPROXIMATE_EV_EFFICIENCY)),
            1000,
        ),

        soCReportingSupported: ((featureMap ?? 0) & FEATURE_BIT_SOC_REPORTING) !== 0,
        stateOfCharge: nullableNumber(attr(attributes, endpoint, ATTR_STATE_OF_CHARGE)),
        batteryCapacityKWh: scaleNullable(nullableNumber(attr(attributes, endpoint, ATTR_BATTERY_CAPACITY)), 1_000_000),

        plugAndChargeSupported: ((featureMap ?? 0) & FEATURE_BIT_PLUG_AND_CHARGE) !== 0,
        vehicleId: nullableText(attr(attributes, endpoint, ATTR_VEHICLE_ID)),
    };
}

export async function disableEvse(client: MatterClient, nodeId: number | bigint, endpoint: number): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, ENERGY_EVSE_CLUSTER_ID, "Disable");
}

export interface EnableChargingParams {
    /** null: no expiry. */
    chargingEnabledUntil: number | null;
    minimumChargeCurrentA: number;
    maximumChargeCurrentA: number;
}

export async function enableCharging(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    params: EnableChargingParams,
): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, ENERGY_EVSE_CLUSTER_ID, "EnableCharging", {
        chargingEnabledUntil: params.chargingEnabledUntil,
        minimumChargeCurrent: Math.round(params.minimumChargeCurrentA * 1000),
        maximumChargeCurrent: Math.round(params.maximumChargeCurrentA * 1000),
    });
}

export async function startDiagnostics(client: MatterClient, nodeId: number | bigint, endpoint: number): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, ENERGY_EVSE_CLUSTER_ID, "StartDiagnostics");
}

export interface EnableDischargingParams {
    /** null: no expiry. */
    dischargingEnabledUntil: number | null;
    maximumDischargeCurrentA: number;
}

export async function enableDischarging(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    params: EnableDischargingParams,
): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, ENERGY_EVSE_CLUSTER_ID, "EnableDischarging", {
        dischargingEnabledUntil: params.dischargingEnabledUntil,
        maximumDischargeCurrent: Math.round(params.maximumDischargeCurrentA * 1000),
    });
}

export type EvseWeekday = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

/** TargetDayOfWeekBitmap fields per Matter 1.6 §9.3.7.1, in calendar (Monday-first) display order. */
export const EVSE_WEEKDAYS: { key: EvseWeekday; label: string }[] = [
    { key: "monday", label: "Mon" },
    { key: "tuesday", label: "Tue" },
    { key: "wednesday", label: "Wed" },
    { key: "thursday", label: "Thu" },
    { key: "friday", label: "Fri" },
    { key: "saturday", label: "Sat" },
    { key: "sunday", label: "Sun" },
];

export interface EditableChargingTarget {
    /** Minutes since local midnight, 0-1439. */
    timeMinutes: number;
    /** Percent. Mutually exclusive with addedEnergyKWh: set at most one. */
    targetSoC?: number;
    /** Mutually exclusive with targetSoC: set at most one. */
    addedEnergyKWh?: number;
}

export interface EditableChargingSchedule {
    days: Partial<Record<EvseWeekday, boolean>>;
    targets: EditableChargingTarget[];
}

function decodeChargingTarget(value: unknown): EditableChargingTarget | undefined {
    const obj = asObject(value);
    if (obj === null) return undefined;
    const timeMinutes = pickNumber(obj, "targetTimeMinutesPastMidnight");
    if (timeMinutes === null) return undefined;
    const addedEnergy = toNumber(obj.addedEnergy);
    return {
        timeMinutes,
        targetSoC: pickNumber(obj, "targetSoC") ?? undefined,
        addedEnergyKWh: addedEnergy !== undefined ? addedEnergy / 1_000_000 : undefined,
    };
}

function decodeChargingTargetSchedule(value: unknown): EditableChargingSchedule | undefined {
    const obj = asObject(value);
    if (obj === null) return undefined;
    const daysObj = asObject(obj.dayOfWeekForSequence) ?? {};
    const days: Partial<Record<EvseWeekday, boolean>> = {};
    for (const { key } of EVSE_WEEKDAYS) {
        if (pickBoolean(daysObj, key) === true) days[key] = true;
    }
    const targets = pickArray(obj, "chargingTargets")
        .map(decodeChargingTarget)
        .filter((target): target is EditableChargingTarget => target !== undefined);
    return { days, targets };
}

/** Decodes a GetTargets/SetTargets response's ChargingTargetSchedules list. */
export function decodeChargingTargetSchedules(response: unknown): EditableChargingSchedule[] {
    const obj = asObject(response);
    if (obj === null) return [];
    return pickArray(obj, "chargingTargetSchedules")
        .map(decodeChargingTargetSchedule)
        .filter((schedule): schedule is EditableChargingSchedule => schedule !== undefined);
}

export async function getChargingTargets(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
): Promise<EditableChargingSchedule[]> {
    const response = await client.deviceCommand(nodeId, endpoint, ENERGY_EVSE_CLUSTER_ID, "GetTargets");
    return decodeChargingTargetSchedules(response);
}

export async function setChargingTargets(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    schedules: EditableChargingSchedule[],
): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, ENERGY_EVSE_CLUSTER_ID, "SetTargets", {
        chargingTargetSchedules: schedules.map(schedule => ({
            dayOfWeekForSequence: Object.fromEntries(
                EVSE_WEEKDAYS.filter(({ key }) => schedule.days[key] === true).map(({ key }) => [key, true]),
            ),
            chargingTargets: schedule.targets.map(target => ({
                targetTimeMinutesPastMidnight: target.timeMinutes,
                ...(target.targetSoC !== undefined ? { targetSoC: target.targetSoC } : {}),
                ...(target.addedEnergyKWh !== undefined
                    ? { addedEnergy: Math.round(target.addedEnergyKWh * 1_000_000) }
                    : {}),
            })),
        })),
    });
}

export async function clearChargingTargets(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, ENERGY_EVSE_CLUSTER_ID, "ClearTargets");
}
