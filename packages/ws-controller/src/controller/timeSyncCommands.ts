/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger } from "@matter/main";
import { TimeSynchronization } from "@matter/main/clusters";
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

// epoch-us fields are raw Unix-epoch microseconds; matter.js TlvEpochUs adds the Matter-epoch offset.
function unixMsToEpochUs(ms: number): number {
    return ms * 1000;
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
            timeZone: [{ offset, validAt: 0, name: zone }],
        });

        if (response?.dstOffsetRequired) {
            const max = dstOffsetListMaxSize(attributes) ?? DEFAULT_DST_LIST_MAX;
            const dstOffset = tz.dstWindows(zone, nowMs, max).map(window => ({
                offset: window.offsetSeconds,
                validStarting: unixMsToEpochUs(window.validStartingMs),
                validUntil: window.validUntilMs === null ? null : unixMsToEpochUs(window.validUntilMs),
            }));
            await invokers.setDstOffset({ dstOffset });
        }
    } catch (error) {
        logger.warn("Failed to push time zone / DST offset:", error);
    }
}
