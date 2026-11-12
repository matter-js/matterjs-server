/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReadResult } from "@matter/main/protocol";
import { ChangeNotificationService } from "@matter/node";

/** An event's absolute time on the clock the device used; neither field when matter.js could not resolve it. */
export type DeviceEventTimestamp = { epochTimestamp?: number; systemTimestamp?: number };

/** {@link DeviceEventTimestamp} of an event that reached the node through its subscription. */
export function deviceTimestampOfChange({
    resolvedTimestamp,
    timestampKind,
}: Pick<ChangeNotificationService.EventOccurrence, "resolvedTimestamp" | "timestampKind">): DeviceEventTimestamp {
    return onClock(resolvedTimestamp, timestampKind === "epoch" || timestampKind === "epoch-delta");
}

/**
 * {@link DeviceEventTimestamp} of an event in a read result. The clock follows the timestamp variant matter.js resolves
 * from, checked in its order: epoch, system, epoch delta, system delta.
 */
export function deviceTimestampOfRead({
    resolvedTimestamp,
    epochTimestamp,
    systemTimestamp,
    deltaEpochTimestamp,
}: Pick<
    ReadResult.EventValue,
    "resolvedTimestamp" | "epochTimestamp" | "systemTimestamp" | "deltaEpochTimestamp"
>): DeviceEventTimestamp {
    const isEpoch =
        epochTimestamp !== undefined || (systemTimestamp === undefined && deltaEpochTimestamp !== undefined);
    return onClock(resolvedTimestamp, isEpoch);
}

function onClock(resolvedTimestamp: number | undefined, isEpoch: boolean): DeviceEventTimestamp {
    if (resolvedTimestamp === undefined) {
        return {};
    }
    return isEpoch ? { epochTimestamp: resolvedTimestamp } : { systemTimestamp: resolvedTimestamp };
}
