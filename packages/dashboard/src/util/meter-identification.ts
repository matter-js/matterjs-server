/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { tagField as field, toNumber, toText } from "./attribute-shapes.js";

export const METER_IDENTIFICATION_CLUSTER_ID = 2822;

const ATTR_METER_TYPE = 0;
const ATTR_POINT_OF_DELIVERY = 1;
const ATTR_METER_SERIAL_NUMBER = 2;
const ATTR_PROTOCOL_VERSION = 3;
const ATTR_POWER_THRESHOLD = 4;
const ATTR_FEATURE_MAP = 0xfffc;

const METER_TYPE_NAMES: Record<number, string> = {
    0: "Utility",
    1: "Private",
    2: "Generic",
};

const POWER_THRESHOLD_SOURCE_NAMES: Record<number, string> = {
    0: "Contract",
    1: "Legal regulator",
    2: "Meter equipment limit",
};

/** MeterIdentification FeatureMap bits per Matter 1.6 §2.13.4. */
const POWER_THRESHOLD_FEATURE_BIT = 0b1;

export interface PowerThresholdInfo {
    powerThresholdW?: number;
    apparentPowerThresholdVA?: number;
    source?: string;
}

export interface MeterIdentificationInfo {
    supported: boolean;
    meterType?: string;
    pointOfDelivery?: string;
    meterSerialNumber?: string;
    protocolVersion?: string;
    powerThresholdSupported: boolean;
    powerThreshold?: PowerThresholdInfo;
}

function attr(attributes: Record<string, unknown>, endpoint: number, attributeId: number): unknown {
    return attributes[`${endpoint}/${METER_IDENTIFICATION_CLUSTER_ID}/${attributeId}`];
}

function enumName(value: unknown, names: Record<number, string>): string | undefined {
    const raw = toNumber(value);
    if (raw === undefined) return undefined;
    return names[raw] ?? `Unknown (${raw})`;
}

function decodePowerThreshold(value: unknown): PowerThresholdInfo | undefined {
    const powerThreshold = toNumber(field(value, 0));
    const apparentPowerThreshold = toNumber(field(value, 1));
    const source = enumName(field(value, 2), POWER_THRESHOLD_SOURCE_NAMES);
    if (powerThreshold === undefined && apparentPowerThreshold === undefined && source === undefined) return undefined;
    return {
        powerThresholdW: powerThreshold !== undefined ? powerThreshold / 1000 : undefined,
        apparentPowerThresholdVA: apparentPowerThreshold !== undefined ? apparentPowerThreshold / 1000 : undefined,
        source,
    };
}

export function meterIdentificationInfo(
    attributes: Record<string, unknown>,
    endpoint: number,
): MeterIdentificationInfo {
    const featureMap = attr(attributes, endpoint, ATTR_FEATURE_MAP);

    return {
        supported: toNumber(featureMap) !== undefined,
        meterType: enumName(attr(attributes, endpoint, ATTR_METER_TYPE), METER_TYPE_NAMES),
        pointOfDelivery: toText(attr(attributes, endpoint, ATTR_POINT_OF_DELIVERY)),
        meterSerialNumber: toText(attr(attributes, endpoint, ATTR_METER_SERIAL_NUMBER)),
        protocolVersion: toText(attr(attributes, endpoint, ATTR_PROTOCOL_VERSION)),
        powerThresholdSupported: ((toNumber(featureMap) ?? 0) & POWER_THRESHOLD_FEATURE_BIT) !== 0,
        powerThreshold: decodePowerThreshold(attr(attributes, endpoint, ATTR_POWER_THRESHOLD)),
    };
}
