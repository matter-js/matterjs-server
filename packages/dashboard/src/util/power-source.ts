/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { toNumber, toText } from "./attribute-shapes.js";

export const POWER_SOURCE_CLUSTER_ID = 47; // 0x2F

const ATTR_STATUS = 0;
const ATTR_ORDER = 1;
const ATTR_DESCRIPTION = 2;
const ATTR_WIRED_ASSESSED_INPUT_VOLTAGE = 3;
const ATTR_WIRED_ASSESSED_INPUT_FREQUENCY = 4;
const ATTR_WIRED_CURRENT_TYPE = 5;
const ATTR_WIRED_ASSESSED_CURRENT = 6;
const ATTR_WIRED_NOMINAL_VOLTAGE = 7;
const ATTR_WIRED_MAXIMUM_CURRENT = 8;
const ATTR_WIRED_PRESENT = 9;
const ATTR_BAT_VOLTAGE = 11;
const ATTR_BAT_PERCENT_REMAINING = 12;
const ATTR_BAT_TIME_REMAINING = 13;
const ATTR_BAT_CHARGE_LEVEL = 14;
const ATTR_BAT_REPLACEMENT_NEEDED = 15;
const ATTR_BAT_REPLACEABILITY = 16;
const ATTR_BAT_PRESENT = 17;
const ATTR_BAT_REPLACEMENT_DESCRIPTION = 19;
const ATTR_BAT_CAPACITY = 24;
const ATTR_BAT_QUANTITY = 25;
const ATTR_BAT_CHARGE_STATE = 26;
const ATTR_BAT_TIME_TO_FULL_CHARGE = 27;
const ATTR_BAT_CHARGING_CURRENT = 29;
const ATTR_FEATURE_MAP = 0xfffc;

/** PowerSource FeatureMap bits per Matter 1.6.1 §11.7.4. */
const FEATURE_BIT_WIRED = 0b1;
const FEATURE_BIT_BATTERY = 0b10;

const STATUS_NAMES: Record<number, string> = {
    0: "Unspecified",
    1: "Active",
    2: "Standby",
    3: "Unavailable",
};

const WIRED_CURRENT_TYPE_NAMES: Record<number, string> = {
    0: "AC",
    1: "DC",
};

const BAT_CHARGE_LEVEL_NAMES: Record<number, string> = {
    0: "OK",
    1: "Warning",
    2: "Critical",
};

const BAT_CHARGE_STATE_NAMES: Record<number, string> = {
    0: "Unknown",
    1: "Charging",
    2: "At full charge",
    3: "Not charging",
};

const BAT_REPLACEABILITY_NAMES: Record<number, string> = {
    0: "Unspecified",
    1: "Not replaceable",
    2: "User replaceable",
    3: "Factory replaceable",
};

export interface PowerSourceInfo {
    supported: boolean;
    status?: string;
    order?: number;
    description?: string;

    /** Whether the device declares Wired support in FeatureMap; WiredPresent is an optional runtime flag on top of this. */
    wiredSupported: boolean;
    wiredPresent?: boolean;
    wiredCurrentType?: string;
    wiredAssessedInputVoltageV?: number | null;
    wiredAssessedInputFrequencyHz?: number | null;
    wiredAssessedCurrentA?: number | null;
    wiredNominalVoltageV?: number;
    wiredMaximumCurrentA?: number;

    /** Whether the device declares Battery support in FeatureMap; BatPresent is an optional runtime flag on top of this. */
    batterySupported: boolean;
    batPresent?: boolean;
    batVoltageV?: number | null;
    /** BatPercentRemaining is reported in half-percent units (0-200); this is already divided by 2. */
    batPercentRemaining?: number | null;
    batTimeRemainingS?: number | null;
    batChargeLevel?: string;
    batChargeState?: string;
    batReplacementNeeded?: boolean;
    batReplaceability?: string;
    batReplacementDescription?: string;
    batCapacityMAh?: number;
    batQuantity?: number;
    batTimeToFullChargeS?: number | null;
    batChargingCurrentA?: number | null;
}

function attr(attributes: Record<string, unknown>, endpoint: number, attributeId: number): unknown {
    return attributes[`${endpoint}/${POWER_SOURCE_CLUSTER_ID}/${attributeId}`];
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

function toBoolean(value: unknown): boolean | undefined {
    return typeof value === "boolean" ? value : undefined;
}

/** Scales a nullable reading (e.g. voltage-mV) to its display unit, passing null/undefined through unchanged. */
function scaleNullable(value: number | null | undefined, factor: number): number | null | undefined {
    return typeof value === "number" ? value / factor : value;
}

function scaleOptional(value: number | undefined, factor: number): number | undefined {
    return value === undefined ? undefined : value / factor;
}

export function powerSourceInfo(attributes: Record<string, unknown>, endpoint: number): PowerSourceInfo {
    const statusRaw = attr(attributes, endpoint, ATTR_STATUS);
    const featureMap = toNumber(attr(attributes, endpoint, ATTR_FEATURE_MAP)) ?? 0;

    return {
        supported: statusRaw !== undefined,
        status: enumName(statusRaw, STATUS_NAMES),
        order: toNumber(attr(attributes, endpoint, ATTR_ORDER)),
        description: toText(attr(attributes, endpoint, ATTR_DESCRIPTION)),

        wiredSupported: (featureMap & FEATURE_BIT_WIRED) !== 0,
        wiredPresent: toBoolean(attr(attributes, endpoint, ATTR_WIRED_PRESENT)),
        wiredCurrentType: enumName(attr(attributes, endpoint, ATTR_WIRED_CURRENT_TYPE), WIRED_CURRENT_TYPE_NAMES),
        wiredAssessedInputVoltageV: scaleNullable(
            nullableNumber(attr(attributes, endpoint, ATTR_WIRED_ASSESSED_INPUT_VOLTAGE)),
            1000,
        ),
        wiredAssessedInputFrequencyHz: nullableNumber(attr(attributes, endpoint, ATTR_WIRED_ASSESSED_INPUT_FREQUENCY)),
        wiredAssessedCurrentA: scaleNullable(
            nullableNumber(attr(attributes, endpoint, ATTR_WIRED_ASSESSED_CURRENT)),
            1000,
        ),
        wiredNominalVoltageV: scaleOptional(toNumber(attr(attributes, endpoint, ATTR_WIRED_NOMINAL_VOLTAGE)), 1000),
        wiredMaximumCurrentA: scaleOptional(toNumber(attr(attributes, endpoint, ATTR_WIRED_MAXIMUM_CURRENT)), 1000),

        batterySupported: (featureMap & FEATURE_BIT_BATTERY) !== 0,
        batPresent: toBoolean(attr(attributes, endpoint, ATTR_BAT_PRESENT)),
        batVoltageV: scaleNullable(nullableNumber(attr(attributes, endpoint, ATTR_BAT_VOLTAGE)), 1000),
        batPercentRemaining: scaleNullable(nullableNumber(attr(attributes, endpoint, ATTR_BAT_PERCENT_REMAINING)), 2),
        batTimeRemainingS: nullableNumber(attr(attributes, endpoint, ATTR_BAT_TIME_REMAINING)),
        batChargeLevel: enumName(attr(attributes, endpoint, ATTR_BAT_CHARGE_LEVEL), BAT_CHARGE_LEVEL_NAMES),
        batChargeState: enumName(attr(attributes, endpoint, ATTR_BAT_CHARGE_STATE), BAT_CHARGE_STATE_NAMES),
        batReplacementNeeded: toBoolean(attr(attributes, endpoint, ATTR_BAT_REPLACEMENT_NEEDED)),
        batReplaceability: enumName(attr(attributes, endpoint, ATTR_BAT_REPLACEABILITY), BAT_REPLACEABILITY_NAMES),
        batReplacementDescription: toText(attr(attributes, endpoint, ATTR_BAT_REPLACEMENT_DESCRIPTION)),
        batCapacityMAh: toNumber(attr(attributes, endpoint, ATTR_BAT_CAPACITY)),
        batQuantity: toNumber(attr(attributes, endpoint, ATTR_BAT_QUANTITY)),
        batTimeToFullChargeS: nullableNumber(attr(attributes, endpoint, ATTR_BAT_TIME_TO_FULL_CHARGE)),
        batChargingCurrentA: scaleNullable(nullableNumber(attr(attributes, endpoint, ATTR_BAT_CHARGING_CURRENT)), 1000),
    };
}
