/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { attribute, cluster, uint32 } from "@matter/main/model";

@cluster(0x00000b04)
export class DraftElectricalMeasurementCluster {
    @attribute(0x00000505, uint32)
    rmsVoltage?: number;

    @attribute(0x00000508, uint32)
    rmsCurrent?: number;

    @attribute(0x0000050b, uint32)
    activePower?: number;

    @attribute(0x00000600, uint32)
    acVoltageMultiplier?: number;

    @attribute(0x00000601, uint32)
    acVoltageDivisor?: number;

    @attribute(0x00000602, uint32)
    acCurrentMultiplier?: number;

    @attribute(0x00000603, uint32)
    acCurrentDivisor?: number;

    @attribute(0x00000604, uint32)
    acPowerMultiplier?: number;

    @attribute(0x00000605, uint32)
    acPowerDivisor?: number;
}
