/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { attribute, cluster, uint8 } from "@matter/main/model";

@cluster(0x120bfc01)
export class HeimanCluster {
    @attribute(0x00120b0010, uint8)
    tamperAlarm?: number;

    @attribute(0x00120b0011, uint8)
    preheatingState?: number;

    @attribute(0x00120b0012, uint8)
    noDisturbingState?: number;

    @attribute(0x00120b0013, uint8)
    sensorType?: number;

    @attribute(0x00120b0014, uint8)
    sirenActive?: number;

    @attribute(0x00120b0015, uint8)
    alarmMute?: number;

    @attribute(0x00120b0016, uint8)
    lowPowerMode?: number;
}
