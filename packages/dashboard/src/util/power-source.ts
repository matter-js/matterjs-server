/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { toBoolean, toNumber, toText } from "./attribute-shapes.js";
import { formatDuration } from "./duration.js";

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
const ATTR_ACTIVE_WIRED_FAULTS = 10;
const ATTR_BAT_VOLTAGE = 11;
const ATTR_BAT_PERCENT_REMAINING = 12;
const ATTR_BAT_TIME_REMAINING = 13;
const ATTR_BAT_CHARGE_LEVEL = 14;
const ATTR_BAT_REPLACEMENT_NEEDED = 15;
const ATTR_BAT_REPLACEABILITY = 16;
const ATTR_BAT_PRESENT = 17;
const ATTR_ACTIVE_BAT_FAULTS = 18;
const ATTR_BAT_REPLACEMENT_DESCRIPTION = 19;
const ATTR_BAT_ANSI_DESIGNATION = 21;
const ATTR_BAT_IEC_DESIGNATION = 22;
const ATTR_BAT_CAPACITY = 24;
const ATTR_BAT_QUANTITY = 25;
const ATTR_BAT_CHARGE_STATE = 26;
const ATTR_BAT_TIME_TO_FULL_CHARGE = 27;
const ATTR_BAT_FUNCTIONAL_WHILE_CHARGING = 28;
const ATTR_BAT_CHARGING_CURRENT = 29;
const ATTR_ACTIVE_BAT_CHARGE_FAULTS = 30;
const ATTR_ENDPOINT_LIST = 31;
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

const WIRED_FAULT_NAMES: Record<number, string> = {
    0: "Unspecified",
    1: "Over voltage",
    2: "Under voltage",
};

const BAT_CHARGE_LEVEL_NAMES: Record<number, string> = {
    0: "OK",
    1: "Warning",
    2: "Critical",
};

const BAT_CHARGE_STATE_NAMES: Record<number, string> = {
    0: "Undetermined",
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

const BAT_FAULT_NAMES: Record<number, string> = {
    0: "Unspecified",
    1: "Over temperature",
    2: "Under temperature",
};

const BAT_CHARGE_FAULT_NAMES: Record<number, string> = {
    0: "Unspecified",
    1: "Ambient too hot",
    2: "Ambient too cold",
    3: "Battery too hot",
    4: "Battery too cold",
    5: "Battery absent",
    6: "Battery over voltage",
    7: "Battery under voltage",
    8: "Charger over voltage",
    9: "Charger under voltage",
    10: "Safety timeout",
};

/**
 * Decoded PowerSource attributes. `undefined` means not reported; `null` on a nullable reading means the device
 * reported it cannot assess the value.
 */
export interface PowerSourceInfo {
    supported: boolean;
    status?: string;
    order?: number;
    description?: string;
    endpointList?: number[];

    wiredSupported: boolean;
    wiredPresent?: boolean;
    wiredCurrentType?: string;
    wiredAssessedInputVoltageV?: number | null;
    wiredAssessedInputFrequencyHz?: number | null;
    wiredAssessedCurrentA?: number | null;
    wiredNominalVoltageV?: number;
    wiredMaximumCurrentA?: number;
    activeWiredFaults?: string[];

    batterySupported: boolean;
    batPresent?: boolean;
    batVoltageV?: number | null;
    /** Percent; the wire value is in half-percent units (0-200). */
    batPercentRemaining?: number | null;
    batTimeRemainingS?: number | null;
    batChargeLevel?: string;
    batChargeState?: string;
    batReplacementNeeded?: boolean;
    batReplaceability?: string;
    batReplacementDescription?: string;
    batAnsiDesignation?: string;
    batIecDesignation?: string;
    batCapacityMAh?: number;
    batQuantity?: number;
    batTimeToFullChargeS?: number | null;
    batFunctionalWhileCharging?: boolean;
    batChargingCurrentA?: number | null;
    activeBatFaults?: string[];
    activeBatChargeFaults?: string[];
}

export interface PowerSourceRow {
    label: string;
    value: string;
}

/** Display rows of the PowerSource panel; a source section is present only when its FeatureMap bit is set and it has rows. */
export interface PowerSourceSections {
    general: PowerSourceRow[];
    wired?: PowerSourceRow[];
    battery?: PowerSourceRow[];
}

function attr(attributes: Record<string, unknown>, endpoint: number, attributeId: number): unknown {
    return attributes[`${endpoint}/${POWER_SOURCE_CLUSTER_ID}/${attributeId}`];
}

function enumName(value: unknown, names: Record<number, string>): string | undefined {
    const raw = toNumber(value);
    if (raw === undefined) return undefined;
    return names[raw] ?? `Unknown (${raw})`;
}

function enumNameList(value: unknown, names: Record<number, string>): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    return value.map(entry => enumName(entry, names)).filter(name => name !== undefined);
}

function numberList(value: unknown): number[] | undefined {
    if (!Array.isArray(value)) return undefined;
    return value.map(toNumber).filter(entry => entry !== undefined);
}

function nullableNumber(value: unknown): number | null | undefined {
    if (value === null) return null;
    return toNumber(value);
}

function scaleNullable(value: number | null | undefined, factor: number): number | null | undefined {
    return typeof value === "number" ? value / factor : value;
}

function scaleOptional(value: number | undefined, factor: number): number | undefined {
    return value === undefined ? undefined : value / factor;
}

export function powerSourceInfo(attributes: Record<string, unknown>, endpoint: number): PowerSourceInfo {
    const featureMap = toNumber(attr(attributes, endpoint, ATTR_FEATURE_MAP));
    const features = featureMap ?? 0;

    return {
        supported: featureMap !== undefined,
        status: enumName(attr(attributes, endpoint, ATTR_STATUS), STATUS_NAMES),
        order: toNumber(attr(attributes, endpoint, ATTR_ORDER)),
        description: toText(attr(attributes, endpoint, ATTR_DESCRIPTION)),
        endpointList: numberList(attr(attributes, endpoint, ATTR_ENDPOINT_LIST)),

        wiredSupported: (features & FEATURE_BIT_WIRED) !== 0,
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
        activeWiredFaults: enumNameList(attr(attributes, endpoint, ATTR_ACTIVE_WIRED_FAULTS), WIRED_FAULT_NAMES),

        batterySupported: (features & FEATURE_BIT_BATTERY) !== 0,
        batPresent: toBoolean(attr(attributes, endpoint, ATTR_BAT_PRESENT)),
        batVoltageV: scaleNullable(nullableNumber(attr(attributes, endpoint, ATTR_BAT_VOLTAGE)), 1000),
        batPercentRemaining: scaleNullable(nullableNumber(attr(attributes, endpoint, ATTR_BAT_PERCENT_REMAINING)), 2),
        batTimeRemainingS: nullableNumber(attr(attributes, endpoint, ATTR_BAT_TIME_REMAINING)),
        batChargeLevel: enumName(attr(attributes, endpoint, ATTR_BAT_CHARGE_LEVEL), BAT_CHARGE_LEVEL_NAMES),
        batChargeState: enumName(attr(attributes, endpoint, ATTR_BAT_CHARGE_STATE), BAT_CHARGE_STATE_NAMES),
        batReplacementNeeded: toBoolean(attr(attributes, endpoint, ATTR_BAT_REPLACEMENT_NEEDED)),
        batReplaceability: enumName(attr(attributes, endpoint, ATTR_BAT_REPLACEABILITY), BAT_REPLACEABILITY_NAMES),
        batReplacementDescription: toText(attr(attributes, endpoint, ATTR_BAT_REPLACEMENT_DESCRIPTION)),
        batAnsiDesignation: toText(attr(attributes, endpoint, ATTR_BAT_ANSI_DESIGNATION)),
        batIecDesignation: toText(attr(attributes, endpoint, ATTR_BAT_IEC_DESIGNATION)),
        batCapacityMAh: toNumber(attr(attributes, endpoint, ATTR_BAT_CAPACITY)),
        batQuantity: toNumber(attr(attributes, endpoint, ATTR_BAT_QUANTITY)),
        batTimeToFullChargeS: nullableNumber(attr(attributes, endpoint, ATTR_BAT_TIME_TO_FULL_CHARGE)),
        batFunctionalWhileCharging: toBoolean(attr(attributes, endpoint, ATTR_BAT_FUNCTIONAL_WHILE_CHARGING)),
        batChargingCurrentA: scaleNullable(nullableNumber(attr(attributes, endpoint, ATTR_BAT_CHARGING_CURRENT)), 1000),
        activeBatFaults: enumNameList(attr(attributes, endpoint, ATTR_ACTIVE_BAT_FAULTS), BAT_FAULT_NAMES),
        activeBatChargeFaults: enumNameList(
            attr(attributes, endpoint, ATTR_ACTIVE_BAT_CHARGE_FAULTS),
            BAT_CHARGE_FAULT_NAMES,
        ),
    };
}

class RowList {
    readonly rows = new Array<PowerSourceRow>();

    add(label: string, value: string | undefined): void {
        if (value !== undefined) this.rows.push({ label, value });
    }

    /** A null reading is shown as "Unknown"; an unreported one is left out. */
    reading(label: string, value: number | null | undefined, format: (value: number) => string): void {
        if (value === undefined) return;
        this.rows.push({ label, value: value === null ? "Unknown" : format(value) });
    }

    flag(label: string, value: boolean | undefined): void {
        if (value !== undefined) this.rows.push({ label, value: value ? "Yes" : "No" });
    }

    list(label: string, values: readonly string[] | undefined): void {
        if (values !== undefined) this.rows.push({ label, value: values.length > 0 ? values.join(", ") : "None" });
    }
}

const unit = (suffix: string) => (value: number) => `${value} ${suffix}`;

export function powerSourceSections(info: PowerSourceInfo): PowerSourceSections {
    const general = new RowList();
    general.add("Status", info.status);
    general.add("Order", info.order?.toString());
    general.add("Description", info.description);
    if (info.endpointList !== undefined) {
        // Spec: an empty EndpointList means the source powers the entire node.
        general.add("Powered endpoints", info.endpointList.length > 0 ? info.endpointList.join(", ") : "Entire node");
    }

    const sections: PowerSourceSections = { general: general.rows };

    if (info.wiredSupported) {
        const wired = new RowList();
        wired.add("Current type", info.wiredCurrentType);
        wired.flag("Present", info.wiredPresent);
        wired.reading("Input voltage", info.wiredAssessedInputVoltageV, unit("V"));
        wired.reading("Input current", info.wiredAssessedCurrentA, unit("A"));
        wired.reading("Input frequency", info.wiredAssessedInputFrequencyHz, unit("Hz"));
        wired.reading("Nominal voltage", info.wiredNominalVoltageV, unit("V"));
        wired.reading("Maximum current", info.wiredMaximumCurrentA, unit("A"));
        wired.list("Active faults", info.activeWiredFaults);
        if (wired.rows.length > 0) sections.wired = wired.rows;
    }

    if (info.batterySupported) {
        const battery = new RowList();
        battery.reading("Charge remaining", info.batPercentRemaining, value => `${value}%`);
        battery.add("Charge level", info.batChargeLevel);
        battery.flag("Present", info.batPresent);
        battery.reading("Voltage", info.batVoltageV, unit("V"));
        battery.reading("Time remaining", info.batTimeRemainingS, formatDuration);
        battery.add("Charge state", info.batChargeState);
        battery.reading("Time to full charge", info.batTimeToFullChargeS, formatDuration);
        battery.reading("Charging current", info.batChargingCurrentA, unit("A"));
        battery.flag("Functional while charging", info.batFunctionalWhileCharging);
        battery.reading("Capacity", info.batCapacityMAh, unit("mAh"));
        battery.add("Quantity", info.batQuantity?.toString());
        battery.add("Replaceability", info.batReplaceability);
        battery.flag("Replacement needed", info.batReplacementNeeded);
        battery.add("Replacement", info.batReplacementDescription);
        battery.add("ANSI designation", info.batAnsiDesignation);
        battery.add("IEC designation", info.batIecDesignation);
        battery.list("Active faults", info.activeBatFaults);
        battery.list("Active charge faults", info.activeBatChargeFaults);
        if (battery.rows.length > 0) sections.battery = battery.rows;
    }

    return sections;
}
