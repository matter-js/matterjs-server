/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { TimeSynchronization } from "@matter/main/clusters";
import { pushNodeTime, TimeSyncInvokers, TimeZoneProvider } from "../src/controller/timeSyncCommands.js";
import { AttributesData } from "../src/types/CommandHandler.js";

const NOW_MS = 1_700_000_000_000;
const TZ_ATTRS: AttributesData = { "0/56/1": 1, "0/56/5": [] };

function recorder(dstOffsetRequired: boolean) {
    const calls = new Array<{ command: string; fields: unknown }>();
    const invokers: TimeSyncInvokers = {
        setUtcTime: async fields => {
            calls.push({ command: "setUtcTime", fields });
        },
        setTimeZone: async fields => {
            calls.push({ command: "setTimeZone", fields });
            return { dstOffsetRequired };
        },
        setDstOffset: async fields => {
            calls.push({ command: "setDstOffset", fields });
        },
    };
    return { calls, invokers };
}

const tz: TimeZoneProvider = {
    resolveHostTimeZone: () => "Europe/Berlin",
    standardOffsetSeconds: () => 3600,
    dstWindows: () => [{ offsetSeconds: 3600, validStartingMs: 1000, validUntilMs: 2000 }],
};

describe("pushNodeTime", () => {
    it("sends UtcTime, TimeZone, then DstOffset when the node requires DST", async () => {
        const { calls, invokers } = recorder(true);
        await pushNodeTime({ invokers, attributes: TZ_ATTRS, nowMs: NOW_MS, tz });

        expect(calls.map(c => c.command)).to.deep.equal(["setUtcTime", "setTimeZone", "setDstOffset"]);
        expect((calls[0].fields as TimeSynchronization.SetUtcTimeRequest).utcTime).to.equal(NOW_MS * 1000);
        const tzReq = calls[1].fields as TimeSynchronization.SetTimeZoneRequest;
        expect(tzReq.timeZone).to.deep.equal([{ offset: 3600, validAt: 0, name: "Europe/Berlin" }]);
        const dstReq = calls[2].fields as TimeSynchronization.SetDstOffsetRequest;
        expect(dstReq.dstOffset).to.deep.equal([{ offset: 3600, validStarting: 1_000_000, validUntil: 2_000_000 }]);
    });

    it("omits DstOffset when the node handles DST itself", async () => {
        const { calls, invokers } = recorder(false);
        await pushNodeTime({ invokers, attributes: TZ_ATTRS, nowMs: NOW_MS, tz });
        expect(calls.map(c => c.command)).to.deep.equal(["setUtcTime", "setTimeZone"]);
    });

    it("sends only UtcTime for a node without the TimeZone feature", async () => {
        const { calls, invokers } = recorder(true);
        await pushNodeTime({ invokers, attributes: { "0/56/1": 1 }, nowMs: NOW_MS, tz });
        expect(calls.map(c => c.command)).to.deep.equal(["setUtcTime"]);
    });

    it("does not fail the sync when the time-zone push throws", async () => {
        const calls = new Array<string>();
        const invokers: TimeSyncInvokers = {
            setUtcTime: async () => {
                calls.push("setUtcTime");
            },
            setTimeZone: async () => {
                throw new Error("boom");
            },
            setDstOffset: async () => {
                calls.push("setDstOffset");
            },
        };
        await pushNodeTime({ invokers, attributes: TZ_ATTRS, nowMs: NOW_MS, tz });
        expect(calls).to.deep.equal(["setUtcTime"]); // UTC done; TZ error swallowed
    });

    it("does not fail the sync when the DST offset push throws", async () => {
        const calls = new Array<string>();
        const invokers: TimeSyncInvokers = {
            setUtcTime: async () => {
                calls.push("setUtcTime");
            },
            setTimeZone: async () => {
                calls.push("setTimeZone");
                return { dstOffsetRequired: true };
            },
            setDstOffset: async () => {
                throw new Error("boom");
            },
        };
        await pushNodeTime({ invokers, attributes: TZ_ATTRS, nowMs: NOW_MS, tz });
        expect(calls).to.deep.equal(["setUtcTime", "setTimeZone"]);
    });

    it("falls back to a max DST list size of 2 when DSTOffsetListMaxSize is not advertised", async () => {
        const maxSeen = new Array<number>();
        const capturingTz: TimeZoneProvider = {
            ...tz,
            dstWindows: (_zone, _fromMs, max) => {
                maxSeen.push(max);
                return [];
            },
        };
        const { invokers } = recorder(true);
        await pushNodeTime({ invokers, attributes: TZ_ATTRS, nowMs: NOW_MS, tz: capturingTz });
        expect(maxSeen).to.deep.equal([2]);
    });

    it("forwards DSTOffsetListMaxSize from attributes when advertised", async () => {
        const maxSeen = new Array<number>();
        const capturingTz: TimeZoneProvider = {
            ...tz,
            dstWindows: (_zone, _fromMs, max) => {
                maxSeen.push(max);
                return [];
            },
        };
        const { invokers } = recorder(true);
        await pushNodeTime({
            invokers,
            attributes: { ...TZ_ATTRS, "0/56/11": 5 },
            nowMs: NOW_MS,
            tz: capturingTz,
        });
        expect(maxSeen).to.deep.equal([5]);
    });

    it("maps a null validUntil through unchanged", async () => {
        const { calls, invokers } = recorder(true);
        const openTz: TimeZoneProvider = {
            ...tz,
            dstWindows: () => [{ offsetSeconds: 3600, validStartingMs: 1000, validUntilMs: null }],
        };
        await pushNodeTime({ invokers, attributes: TZ_ATTRS, nowMs: NOW_MS, tz: openTz });
        const dstReq = calls[2].fields as TimeSynchronization.SetDstOffsetRequest;
        expect(dstReq.dstOffset[0].validUntil).to.equal(null);
    });
});
