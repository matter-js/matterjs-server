/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { toNumber } from "./attribute-shapes.js";

export const IKEA_VALVE_CALIBRATION_CLUSTER_ID = 0x117cfc01;

const ATTR_CALIBRATION_STATUS = 0;
const ATTR_LAST_CALIBRATION_ERROR = 1;

export const CALIBRATION_IN_PROGRESS = 1;
const CALIBRATION_ERROR_NONE = 0;

const STATUS_NAMES: Record<number, string> = {
    0: "Not calibrated",
    [CALIBRATION_IN_PROGRESS]: "In progress",
    2: "Calibrated",
};

const ERROR_NAMES: Record<number, string> = {
    [CALIBRATION_ERROR_NONE]: "No error",
    1: "E1",
    2: "E2",
};

export interface ValveCalibrationInfo {
    status?: { value: number; label: string };
    lastError?: { value: number; label: string; isError: boolean };
}

function label(names: Record<number, string>, value: number): string {
    return names[value] ?? `Unknown (${value})`;
}

/** Decodes the cached IKEA ValveCalibration attributes of one endpoint; absent attributes stay `undefined`. */
export function valveCalibrationInfo(attributes: Record<string, unknown>, endpoint: number): ValveCalibrationInfo {
    const prefix = `${endpoint}/${IKEA_VALVE_CALIBRATION_CLUSTER_ID}`;
    const status = toNumber(attributes[`${prefix}/${ATTR_CALIBRATION_STATUS}`]);
    const lastError = toNumber(attributes[`${prefix}/${ATTR_LAST_CALIBRATION_ERROR}`]);
    return {
        status: status === undefined ? undefined : { value: status, label: label(STATUS_NAMES, status) },
        lastError:
            lastError === undefined
                ? undefined
                : {
                      value: lastError,
                      label: label(ERROR_NAMES, lastError),
                      isError: lastError !== CALIBRATION_ERROR_NONE,
                  },
    };
}
