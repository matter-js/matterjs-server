/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { TimeSynchronization } from "@matter/main/clusters";
import { MATTER_EPOCH_OFFSET_US, TlvEpochUs } from "@matter/main/types";
import { pushNodeTime, TimeSyncInvokers, TimeZoneProvider } from "../src/controller/timeSyncCommands.js";
import { AttributesData } from "../src/types/CommandHandler.js";
import { TimeZonePlan } from "../src/util/hostTimeZone.js";

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
    timeZonePlan: () => ({
        regimes: [{ offsetSeconds: 3600, validFromMs: null }],
        dstWindows: [{ offsetSeconds: 3600, validStartingMs: 1000, validUntilMs: 2000 }],
    }),
};

function planWith(dstWindows: TimeZonePlan["dstWindows"]): TimeZoneProvider {
    return { ...tz, timeZonePlan: () => ({ regimes: [{ offsetSeconds: 3600, validFromMs: null }], dstWindows }) };
}

function capturing(maxSeen: number[]): TimeZoneProvider {
    return {
        ...tz,
        timeZonePlan: (_zone, _fromMs, limits) => {
            maxSeen.push(limits.maxWindows);
            return { regimes: [{ offsetSeconds: 3600, validFromMs: null }], dstWindows: [] };
        },
    };
}

describe("pushNodeTime", () => {
    it("sends UtcTime, TimeZone, then DstOffset when the node requires DST", async () => {
        const { calls, invokers } = recorder(true);
        await pushNodeTime({ invokers, attributes: TZ_ATTRS, nowMs: NOW_MS, tz });

        expect(calls.map(c => c.command)).to.deep.equal(["setUtcTime", "setTimeZone", "setDstOffset"]);
        expect((calls[0].fields as TimeSynchronization.SetUtcTimeRequest).utcTime).to.equal(BigInt(NOW_MS) * 1000n);
        const tzReq = calls[1].fields as TimeSynchronization.SetTimeZoneRequest;
        expect(tzReq.timeZone).to.deep.equal([
            { offset: 3600, validAt: MATTER_EPOCH_OFFSET_US, name: "Europe/Berlin" },
        ]);
        const dstReq = calls[2].fields as TimeSynchronization.SetDstOffsetRequest;
        expect(dstReq.dstOffset).to.deep.equal([{ offset: 3600, validStarting: 1_000_000n, validUntil: 2_000_000n }]);
    });

    it("emits a first-entry validAt the matter.js TlvEpochUs codec accepts", async () => {
        const { calls, invokers } = recorder(true);
        await pushNodeTime({ invokers, attributes: TZ_ATTRS, nowMs: NOW_MS, tz });

        const tzReq = calls[1].fields as TimeSynchronization.SetTimeZoneRequest;
        expect(() => TlvEpochUs.encode(tzReq.timeZone[0].validAt)).not.to.throw();
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
        const { invokers } = recorder(true);
        await pushNodeTime({ invokers, attributes: TZ_ATTRS, nowMs: NOW_MS, tz: capturing(maxSeen) });
        expect(maxSeen).to.deep.equal([2]);
    });

    it("forwards DSTOffsetListMaxSize from attributes verbatim", async () => {
        const maxSeen = new Array<number>();
        const { invokers } = recorder(true);
        await pushNodeTime({
            invokers,
            attributes: { ...TZ_ATTRS, "0/56/11": 5 },
            nowMs: NOW_MS,
            tz: capturing(maxSeen),
        });
        expect(maxSeen).to.deep.equal([5]);
    });

    it("leaves a DSTOffsetListMaxSize below the spec minimum to the plan builder", async () => {
        const maxSeen = new Array<number>();
        const { invokers } = recorder(true);
        await pushNodeTime({
            invokers,
            attributes: { ...TZ_ATTRS, "0/56/11": 0 },
            nowMs: NOW_MS,
            tz: capturing(maxSeen),
        });
        expect(maxSeen).to.deep.equal([0]);
    });

    it("sends a second TimeZone entry for a pending standard-offset change", async () => {
        const changeMs = Date.UTC(2024, 1, 29, 18);
        const twoRegimes: TimeZoneProvider = {
            ...tz,
            timeZonePlan: () => ({
                regimes: [
                    { offsetSeconds: 21600, validFromMs: null },
                    { offsetSeconds: 18000, validFromMs: changeMs },
                ],
                dstWindows: [],
            }),
        };
        const { calls, invokers } = recorder(true);
        await pushNodeTime({ invokers, attributes: TZ_ATTRS, nowMs: NOW_MS, tz: twoRegimes });

        const tzReq = calls[1].fields as TimeSynchronization.SetTimeZoneRequest;
        expect(tzReq.timeZone).to.deep.equal([
            { offset: 21600, validAt: MATTER_EPOCH_OFFSET_US, name: "Europe/Berlin" },
            { offset: 18000, validAt: BigInt(changeMs) * 1000n, name: "Europe/Berlin" },
        ]);
        // The cluster requires entry 0 at the Matter epoch and any later entry strictly after it.
        expect(tzReq.timeZone[1].validAt > tzReq.timeZone[0].validAt).to.equal(true);
        tzReq.timeZone.forEach(entry => expect(() => TlvEpochUs.encode(entry.validAt)).not.to.throw());
    });

    it("forwards TimeZoneListMaxSize from attributes and defaults it to 2", async () => {
        const seen = new Array<number>();
        const capturingRegimes: TimeZoneProvider = {
            ...tz,
            timeZonePlan: (_zone, _fromMs, limits) => {
                seen.push(limits.maxRegimes);
                return { regimes: [{ offsetSeconds: 3600, validFromMs: null }], dstWindows: [] };
            },
        };
        const { invokers } = recorder(true);
        await pushNodeTime({ invokers, attributes: TZ_ATTRS, nowMs: NOW_MS, tz: capturingRegimes });
        await pushNodeTime({
            invokers,
            attributes: { ...TZ_ATTRS, "0/56/10": 1 },
            nowMs: NOW_MS,
            tz: capturingRegimes,
        });
        expect(seen).to.deep.equal([2, 1]);
    });

    it("maps a null validUntil through unchanged", async () => {
        const { calls, invokers } = recorder(true);
        const openTz = planWith([{ offsetSeconds: 3600, validStartingMs: 1000, validUntilMs: null }]);
        await pushNodeTime({ invokers, attributes: TZ_ATTRS, nowMs: NOW_MS, tz: openTz });
        const dstReq = calls[2].fields as TimeSynchronization.SetDstOffsetRequest;
        expect(dstReq.dstOffset[0].validUntil).to.equal(null);
    });

    it("maps a null validStarting to the Matter epoch so an already-active window applies at once", async () => {
        const { calls, invokers } = recorder(true);
        const activeTz = planWith([{ offsetSeconds: 3600, validStartingMs: null, validUntilMs: 2000 }]);
        await pushNodeTime({ invokers, attributes: TZ_ATTRS, nowMs: NOW_MS, tz: activeTz });
        const dstReq = calls[2].fields as TimeSynchronization.SetDstOffsetRequest;
        expect(dstReq.dstOffset[0].validStarting).to.equal(MATTER_EPOCH_OFFSET_US);
        expect(() => TlvEpochUs.encode(dstReq.dstOffset[0].validStarting)).not.to.throw();
    });

    it("sends the canonical no-DST entry instead of an empty list for a no-DST zone", async () => {
        const { calls, invokers } = recorder(true);
        await pushNodeTime({ invokers, attributes: TZ_ATTRS, nowMs: NOW_MS, tz: planWith([]) });

        expect(calls.map(c => c.command)).to.deep.equal(["setUtcTime", "setTimeZone", "setDstOffset"]);
        const dstReq = calls[2].fields as TimeSynchronization.SetDstOffsetRequest;
        expect(dstReq.dstOffset).to.deep.equal([
            { offset: 0, validStarting: MATTER_EPOCH_OFFSET_US, validUntil: null },
        ]);
    });

    it("emits DST validStarting/validUntil the TlvEpochUs codec round-trips", async () => {
        const validStartingMs = Date.UTC(2026, 2, 29, 1);
        const validUntilMs = Date.UTC(2026, 9, 25, 1);
        const { calls, invokers } = recorder(true);
        const realisticTz = planWith([{ offsetSeconds: 3600, validStartingMs, validUntilMs }]);
        await pushNodeTime({ invokers, attributes: TZ_ATTRS, nowMs: NOW_MS, tz: realisticTz });

        const dstReq = calls[2].fields as TimeSynchronization.SetDstOffsetRequest;
        const { validStarting, validUntil } = dstReq.dstOffset[0];
        expect(() => TlvEpochUs.encode(validStarting)).not.to.throw();
        expect(() => TlvEpochUs.encode(validUntil!)).not.to.throw();
        expect(TlvEpochUs.decode(TlvEpochUs.encode(validStarting))).to.equal(BigInt(validStartingMs * 1000));
        expect(TlvEpochUs.decode(TlvEpochUs.encode(validUntil!))).to.equal(BigInt(validUntilMs * 1000));
    });
});
