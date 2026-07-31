/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger, Timestamp } from "@matter/main";
import { TimeSynchronization } from "@matter/main/clusters";
import { MATTER_EPOCH_OFFSET_US } from "@matter/main/types";
import { AttributesData } from "../types/CommandHandler.js";
import {
    resolveHostTimeZone as defaultResolveHostTimeZone,
    timeZonePlan as defaultTimeZonePlan,
    TimeZonePlan,
    TimeZonePlanLimits,
} from "../util/hostTimeZone.js";
import { dstOffsetListMaxSize, hasTimeZoneFeature, timeZoneListMaxSize } from "./TimeSyncManager.js";

const logger = Logger.get("TimeSyncCommands");

// Default when the node does not advertise DSTOffsetListMaxSize: covers the current DST
// window plus the next one.
const DEFAULT_DST_LIST_MAX = 2;
// Default when the node does not advertise TimeZoneListMaxSize. The cluster caps the list at 2, and
// the second entry is what lets an upcoming standard-offset change be stated as such.
const DEFAULT_TIME_ZONE_LIST_MAX = 2;

export interface TimeZoneProvider {
    resolveHostTimeZone(): string;
    timeZonePlan(zone: string, fromMs: number, limits: TimeZonePlanLimits): TimeZonePlan;
}

export interface TimeSyncInvokers {
    setUtcTime(fields: TimeSynchronization.SetUtcTimeRequest): Promise<void>;
    setTimeZone(
        fields: TimeSynchronization.SetTimeZoneRequest,
    ): Promise<TimeSynchronization.SetTimeZoneResponse | undefined>;
    setDstOffset(fields: TimeSynchronization.SetDstOffsetRequest): Promise<void>;
}

const defaultTimeZoneProvider: TimeZoneProvider = {
    resolveHostTimeZone: defaultResolveHostTimeZone,
    timeZonePlan: defaultTimeZonePlan,
};

function unixMsToEpochUs(ms: number): bigint {
    return Timestamp.toMicroseconds(Timestamp(ms));
}

/**
 * Push time to a single node: always SetUtcTime; for TimeZone-feature nodes also SetTimeZone and,
 * only when the node reports it cannot derive DST itself, SetDstOffset. Time-zone/DST failures are
 * best-effort and never fail the UTC sync.
 */
export async function pushNodeTime(opts: {
    invokers: TimeSyncInvokers;
    attributes: AttributesData;
    nowMs: number;
    tz?: TimeZoneProvider;
}): Promise<void> {
    const { invokers, attributes, nowMs } = opts;

    await invokers.setUtcTime({
        utcTime: unixMsToEpochUs(nowMs),
        granularity: TimeSynchronization.Granularity.MillisecondsGranularity,
        timeSource: TimeSynchronization.TimeSource.Admin,
    });

    if (!hasTimeZoneFeature(attributes)) {
        return;
    }

    try {
        const tz = opts.tz ?? defaultTimeZoneProvider;
        const zone = tz.resolveHostTimeZone();
        const plan = tz.timeZonePlan(zone, nowMs, {
            maxRegimes: timeZoneListMaxSize(attributes) ?? DEFAULT_TIME_ZONE_LIST_MAX,
            maxWindows: dstOffsetListMaxSize(attributes) ?? DEFAULT_DST_LIST_MAX,
        });

        const response = await invokers.setTimeZone({
            timeZone: plan.regimes.map(regime => ({
                offset: regime.offsetSeconds,
                // Spec: the first entry's ValidAt is Matter-epoch 0 and a later entry's must not be.
                // TlvEpochUs subtracts the Matter epoch, so passing it encodes to 0.
                validAt: regime.validFromMs === null ? MATTER_EPOCH_OFFSET_US : unixMsToEpochUs(regime.validFromMs),
                name: zone,
            })),
        });

        if (response?.dstOffsetRequired) {
            const dstOffset: TimeSynchronization.DstOffset[] = plan.dstWindows.map(window => ({
                offset: window.offsetSeconds,
                validStarting:
                    window.validStartingMs === null ? MATTER_EPOCH_OFFSET_US : unixMsToEpochUs(window.validStartingMs),
                validUntil: window.validUntilMs === null ? null : unixMsToEpochUs(window.validUntilMs),
            }));
            if (dstOffset.length === 0) {
                // Spec: an empty DSTOffset list forces LocalTime to null; a no-DST zone must be
                // expressed as a single permanent entry with offset 0 instead of an empty list.
                dstOffset.push({ offset: 0, validStarting: MATTER_EPOCH_OFFSET_US, validUntil: null });
            }
            await invokers.setDstOffset({ dstOffset });
        }
    } catch (error) {
        logger.warn("Failed to push time zone / DST offset:", error);
    }
}
