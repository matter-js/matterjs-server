/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { attribute, bool, cluster, single, uint32, writable } from "@matter/main/model";

@cluster(0x130afc01)
export class EveCluster {
    @attribute(0x130a0006, uint32)
    timesOpened?: number;

    @attribute(0x130a000a, single)
    watt?: number;

    @attribute(0x130a000b, single)
    wattAccumulated?: number;

    @attribute(0x130a000e, uint32)
    wattAccumulatedControlPoint?: number;

    @attribute(0x130a0008, single)
    voltage?: number;

    @attribute(0x130a0009, single)
    current?: number;

    @attribute(0x130a0010, bool)
    obstructionDetected?: boolean;

    @attribute(0x130a0011, bool, writable)
    childLock?: boolean;

    @attribute(0x130a0013, single)
    altitude?: number;

    @attribute(0x130a0014, single)
    pressure?: number;

    @attribute(0x130a0015, uint32)
    weatherTrend?: number;

    @attribute(0x130a0018, uint32)
    valvePosition?: number;

    @attribute(0x130a000d, uint32)
    motionSensitivity?: number;
}
