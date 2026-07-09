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
    DstWindow,
    dstWindows as defaultDstWindows,
    resolveHostTimeZone as defaultResolveHostTimeZone,
    standardOffsetSeconds as defaultStandardOffsetSeconds,
} from "../util/hostTimeZone.js";
import { dstOffsetListMaxSize, hasTimeZoneFeature } from "./TimeSyncManager.js";

const logger = Logger.get("TimeSyncCommands");

// Default when the node does not advertise DSTOffsetListMaxSize: covers the current DST
// window plus the next one (spec minimum is 1).
const DEFAULT_DST_LIST_MAX = 2;

export interface TimeZoneProvider {
    resolveHostTimeZone(): string;
    standardOffsetSeconds(zone: string, atMs: number): number;
    dstWindows(zone: string, fromMs: number, max: number): DstWindow[];
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
    standardOffsetSeconds: defaultStandardOffsetSeconds,
    dstWindows: defaultDstWindows,
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
        const offset = tz.standardOffsetSeconds(zone, nowMs);

        const response = await invokers.setTimeZone({
            // Spec: the first TimeZone entry's ValidAt is Matter-epoch 0. TlvEpochUs takes
            // Unix-epoch µs and subtracts the Matter epoch, so the Matter epoch itself encodes to 0.
            timeZone: [{ offset, validAt: MATTER_EPOCH_OFFSET_US, name: zone }],
        });

        if (response?.dstOffsetRequired) {
            const max = dstOffsetListMaxSize(attributes) ?? DEFAULT_DST_LIST_MAX;
            const dstOffset: TimeSynchronization.DstOffset[] = tz.dstWindows(zone, nowMs, max).map(window => ({
                offset: window.offsetSeconds,
                validStarting: unixMsToEpochUs(window.validStartingMs),
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
