/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { attribute, cluster, uint8, writable, command, uint16, field } from "@matter/main/model";

/**
 * Input to the {@link HeimanCluster.mutingSensor} command.
 */
class MutingSensorCommand {
    @field(uint16)
    mutingTime!: number;
}

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

    /**
     * This command is used for muting sensor for a specific period if there is an alarm, like a fire alarm.
     */
    @command(0x00, MutingSensorCommand)
    mutingSensor(_request: MutingSensorCommand): void {}
}
