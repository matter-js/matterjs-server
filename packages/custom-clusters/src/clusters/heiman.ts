/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { attribute, cluster, uint8, writable } from "@matter/main/model";

@cluster(0x120bfc01)
export class HeimanCluster {
    @attribute(0x0010, uint8)
    tamperAlarm?: number;

    @attribute(0x0011, uint8)
    preheatingState?: number;

    @attribute(0x0012, uint8)
    noDisturbingState?: number;

    @attribute(0x0013, uint8)
    sensorType?: number;

    @attribute(0x0014, uint8, writable)
    sirenActive?: number;

    @attribute(0x0015, uint8, writable)
    alarmMute?: number;

    @attribute(0x0016, uint8, writable)
    lowPowerMode?: number;
}
