/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { attribute, cluster, command, enum8 } from "@matter/main/model";

const enum IkeaCalibrationStatus {
    NotCalibrated = 0,
    InProgress = 1,
    Calibrated = 2,
}

const enum IkeaCalibrationError {
    NoError = 0,
    E1 = 1,
    E2 = 2,
}

/**
 * IKEA thermostat valve calibration — Vendor ID 0x117c (IKEA of Sweden).
 */
@cluster(0x117cfc01)
export class IkeaValveCalibrationCluster {
    /** See {@link IkeaCalibrationStatus}. */
    @attribute(0x0000, enum8)
    calibrationStatus?: IkeaCalibrationStatus;

    /** See {@link IkeaCalibrationError}. Reset to `NoError` by a successful calibration. */
    @attribute(0x0001, enum8)
    lastCalibrationError?: IkeaCalibrationError;

    @command(0x00)
    triggerCalibration(): void {}
}
