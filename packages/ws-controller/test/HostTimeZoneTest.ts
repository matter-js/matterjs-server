/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    nextOffsetChangeMs,
    offsetSecondsAt,
    offsetSegments,
    resolveHostTimeZone,
    TimeZonePlan,
    timeZonePlan,
} from "../src/util/hostTimeZone.js";

const JAN_2026 = Date.UTC(2026, 0, 15);
const JUL_2026 = Date.UTC(2026, 6, 1);
const DAY_MS = 86_400_000;

const BOTH_MAX = { maxRegimes: 2, maxWindows: 2 };
const SINGLE_TIME_ZONE_ENTRY = { maxRegimes: 1, maxWindows: 2 };

/**
 * The standard offset a compliant node would have active, mirroring
 * TimeSynchronizationCluster.cpp's UpdateTimeZoneState: the active entry is the last one whose
 * ValidAt has passed.
 */
function nodeRegimeOffsetSeconds(plan: TimeZonePlan, atMs: number): number {
    let active = plan.regimes[0];
    for (const regime of plan.regimes) {
        if (regime.validFromMs !== null && regime.validFromMs <= atMs) {
            active = regime;
        }
    }
    return active.offsetSeconds;
}

/**
 * The offset a compliant node would compute from a pushed plan, mirroring
 * TimeSynchronizationCluster.cpp's UpdateDSTOffsetState: the active entry is the last one whose
 * ValidStarting has passed, and an active entry whose ValidUntil has passed contributes nothing.
 */
function nodeOffsetSeconds(plan: TimeZonePlan, atMs: number): number {
    const standard = nodeRegimeOffsetSeconds(plan, atMs);
    let active;
    for (const window of plan.dstWindows) {
        if ((window.validStartingMs ?? Number.NEGATIVE_INFINITY) <= atMs) {
            active = window;
        }
    }
    if (active === undefined || (active.validUntilMs !== null && active.validUntilMs <= atMs)) {
        return standard;
    }
    return standard + active.offsetSeconds;
}

function expectPlanMatchesZone(zone: string, atMs: number, limits = BOTH_MAX) {
    const plan = timeZonePlan(zone, atMs, limits);
    const label = `${zone} @ ${new Date(atMs).toISOString()}`;
    expect(nodeOffsetSeconds(plan, atMs), label).to.equal(offsetSecondsAt(zone, atMs));
}

describe("hostTimeZone", () => {
    describe("offsetSecondsAt", () => {
        it("returns the total offset including DST", () => {
            expect(offsetSecondsAt("Europe/Berlin", JAN_2026)).to.equal(3600); // CET
            expect(offsetSecondsAt("Europe/Berlin", JUL_2026)).to.equal(7200); // CEST
            expect(offsetSecondsAt("America/Phoenix", JUL_2026)).to.equal(-25200); // no DST
        });

        it("floors sub-second instants and handles a negative epoch", () => {
            // Non-second-aligned instant still yields the whole-second offset.
            expect(offsetSecondsAt("Europe/Berlin", JUL_2026 + 500)).to.equal(7200);
            // Negative epoch (1969-12-31 23:59:58.5 UTC), Berlin was on standard time (CET).
            expect(offsetSecondsAt("Europe/Berlin", -1500)).to.equal(3600);
        });
    });

    describe("offsetSegments", () => {
        it("returns gap-free chronological segments that agree with the zone's offsets", () => {
            const segments = offsetSegments("Europe/Berlin", JAN_2026);
            expect(segments.length).to.be.greaterThan(1);
            expect(segments[0].startMs).to.equal(null);
            expect(segments[segments.length - 1].endMs).to.not.equal(null);
            for (let i = 0; i < segments.length; i++) {
                if (i > 0) {
                    expect(segments[i].startMs).to.equal(segments[i - 1].endMs);
                }
                const probe = (segments[i].startMs ?? JAN_2026 - 399 * DAY_MS) + DAY_MS;
                expect(offsetSecondsAt("Europe/Berlin", probe)).to.equal(segments[i].offsetSeconds);
            }
        });

        it("reports a single open-ended segment for a zone without transitions", () => {
            const segments = offsetSegments("America/Phoenix", JAN_2026);
            expect(segments.length).to.equal(1);
            expect(segments[0].startMs).to.equal(null);
            expect(segments[0].endMs).to.equal(null);
            expect(segments[0].offsetSeconds).to.equal(-25200);
        });

        it("leaves a permanently adopted offset open-ended rather than closing it at the scan edge", () => {
            // Turkey stayed on EEST (+03) after 2016-03-27 instead of falling back that autumn.
            const segments = offsetSegments("Europe/Istanbul", Date.UTC(2016, 0, 15));
            const last = segments[segments.length - 1];
            expect(last.offsetSeconds).to.equal(10800);
            expect(last.startMs).to.equal(Date.UTC(2016, 2, 27, 1, 0, 0));
            expect(last.endMs).to.equal(null);
        });
    });

    describe("timeZonePlan", () => {
        it("emits the upcoming DST window for a northern-hemisphere zone", () => {
            const plan = timeZonePlan("Europe/Berlin", JAN_2026, BOTH_MAX);
            expect(plan.regimes[0].offsetSeconds).to.equal(3600);
            expect(plan.dstWindows.length).to.equal(2);
            expect(plan.dstWindows[0].offsetSeconds).to.equal(3600);
            // DST 2026 begins 2026-03-29 01:00 UTC, ends 2026-10-25 01:00 UTC
            expect(plan.dstWindows[0].validStartingMs).to.equal(Date.UTC(2026, 2, 29, 1, 0, 0));
            expect(plan.dstWindows[0].validUntilMs).to.equal(Date.UTC(2026, 9, 25, 1, 0, 0));
            expect(plan.dstWindows[1].validStartingMs).to.equal(Date.UTC(2027, 2, 28, 1, 0, 0));
            expect(plan.dstWindows[1].validUntilMs).to.equal(Date.UTC(2027, 9, 31, 1, 0, 0));
        });

        it("emits the currently-active window when already in DST", () => {
            const plan = timeZonePlan("Europe/Berlin", JUL_2026, BOTH_MAX);
            expect(plan.regimes[0].offsetSeconds).to.equal(3600);
            expect(plan.dstWindows[0].validStartingMs).to.equal(Date.UTC(2026, 2, 29, 1, 0, 0));
            expect(plan.dstWindows[0].validUntilMs).to.equal(Date.UTC(2026, 9, 25, 1, 0, 0));
        });

        it("emits no windows for a zone without DST", () => {
            const plan = timeZonePlan("America/Phoenix", JAN_2026, BOTH_MAX);
            expect(plan.regimes[0].offsetSeconds).to.equal(-25200);
            expect(plan.dstWindows).to.deep.equal([]);
        });

        it("terminates a truncated list so the node does not drop it when the last window expires", () => {
            const plan = timeZonePlan("Europe/Berlin", JAN_2026, { maxRegimes: 2, maxWindows: 3 });
            const last = plan.dstWindows[plan.dstWindows.length - 1];
            expect(last.offsetSeconds).to.equal(0);
            expect(last.validUntilMs).to.equal(null);
            expect(last.validStartingMs).to.equal(plan.dstWindows[plan.dstWindows.length - 2].validUntilMs);
        });

        it("respects maxWindows and raises values below the spec minimum of 1", () => {
            expect(
                timeZonePlan("Europe/Berlin", JUL_2026, { maxRegimes: 2, maxWindows: 1 }).dstWindows.length,
            ).to.equal(1);
            // DSTOffsetListMaxSize 0 is a device bug; returning nothing would assert "never uses DST".
            const clamped = timeZonePlan("Europe/Berlin", JUL_2026, { maxRegimes: 2, maxWindows: 0 });
            expect(clamped.dstWindows.length).to.equal(1);
            expect(nodeOffsetSeconds(clamped, JUL_2026)).to.equal(7200);
        });

        it("emits the currently-active window for a southern-hemisphere zone spanning New Year", () => {
            const plan = timeZonePlan("Australia/Sydney", JAN_2026, BOTH_MAX);
            expect(plan.regimes[0].offsetSeconds).to.equal(36000); // AEST base
            expect(plan.dstWindows[0].offsetSeconds).to.equal(3600);
            expect(plan.dstWindows[0].validStartingMs).to.be.lessThan(JAN_2026);
            expect(plan.dstWindows[0].validUntilMs).to.be.greaterThan(JAN_2026);
        });
    });

    describe("timeZonePlan standard-offset regimes", () => {
        it("states a pending permanent reduction as a second regime rather than a DST delta", () => {
            // Kazakhstan moved Asia/Almaty +06 -> +05 permanently at 2024-03-01 00:00 local.
            const plan = timeZonePlan("Asia/Almaty", Date.UTC(2024, 0, 15), BOTH_MAX);
            expect(plan.regimes.length).to.equal(2);
            expect(plan.regimes[0].offsetSeconds).to.equal(21600); // +06, in effect now
            expect(plan.regimes[0].validFromMs).to.equal(null);
            expect(plan.regimes[1].offsetSeconds).to.equal(18000); // +05, from the change
            expect(plan.regimes[1].validFromMs).to.equal(Date.UTC(2024, 1, 29, 18));
            // The zone has no DST at all, so nothing may claim otherwise.
            expect(plan.dstWindows).to.deep.equal([]);
        });

        it("states a pending permanent adoption of a higher offset as a second regime", () => {
            const plan = timeZonePlan("Europe/Istanbul", Date.UTC(2016, 0, 15), BOTH_MAX);
            expect(plan.regimes.length).to.equal(2);
            expect(plan.regimes[0].offsetSeconds).to.equal(7200); // +02 EET
            expect(plan.regimes[1].offsetSeconds).to.equal(10800); // +03, permanent from 2016-03-27
            expect(plan.regimes[1].validFromMs).to.equal(Date.UTC(2016, 2, 27, 1));
            expect(plan.dstWindows).to.deep.equal([]);
        });

        it("falls back to a DST delta when the node holds only one TimeZone entry", () => {
            const plan = timeZonePlan("Asia/Almaty", Date.UTC(2024, 0, 15), SINGLE_TIME_ZONE_ENTRY);
            expect(plan.regimes.length).to.equal(1);
            expect(plan.regimes[0].offsetSeconds).to.equal(18000); // the post-change base
            expect(plan.dstWindows.length).to.be.greaterThan(0);
            expect(plan.dstWindows[0].offsetSeconds).to.equal(3600);
            // Local time must still come out right, which is the point of the fallback.
            expectPlanMatchesZone("Asia/Almaty", Date.UTC(2024, 0, 15), SINGLE_TIME_ZONE_ENTRY);
        });

        it("does not split a zone that is merely mid-DST at the sync instant", () => {
            // Sydney in January sits in DST, so its leading segment has a higher minimum than the
            // rest. Splitting there would call +11 a standard offset and +10 a future regime.
            const plan = timeZonePlan("Australia/Sydney", JAN_2026, BOTH_MAX);
            expect(plan.regimes.length).to.equal(1);
            expect(plan.regimes[0].offsetSeconds).to.equal(36000); // AEST
            expect(plan.dstWindows[0].offsetSeconds).to.equal(3600);
        });

        it("does not split an ordinary DST zone or a recurring seasonal dip", () => {
            for (const zone of ["Europe/Berlin", "America/New_York", "Africa/Casablanca"]) {
                for (const month of [0, 3, 6, 9]) {
                    const plan = timeZonePlan(zone, Date.UTC(2026, month, 10), BOTH_MAX);
                    expect(plan.regimes.length, `${zone} month ${month}`).to.equal(1);
                }
            }
        });

        it("keeps real DST windows alongside a pending permanent change", () => {
            // Paraguay ran DST and then abolished it, staying on -03 from 2024-10-06. Both facts have
            // to reach the node: the summer window before the change, and the change itself.
            const plan = timeZonePlan("America/Asuncion", Date.UTC(2024, 0, 1, 12), BOTH_MAX);
            expect(plan.regimes.length).to.equal(2);
            expect(plan.regimes[0].offsetSeconds).to.equal(-14400);
            expect(plan.regimes[1].offsetSeconds).to.equal(-10800);
            expect(plan.regimes[1].validFromMs).to.equal(Date.UTC(2024, 9, 6, 4));
            expect(plan.dstWindows[0].offsetSeconds).to.equal(3600);
            expect(plan.dstWindows[0].validUntilMs).to.equal(Date.UTC(2024, 2, 24, 3));
            for (const atMs of [Date.UTC(2024, 0, 1, 12), Date.UTC(2024, 5, 1), Date.UTC(2024, 10, 1)]) {
                expectPlanMatchesZone("America/Asuncion", atMs);
            }
        });

        it("declines to split when the node cannot hold the deltas the split would need", () => {
            // Yukon kept DST until moving permanently to -07 on 2020-03-08, so a split here needs a
            // delta for each remaining summer. Splitting with only one slot would drop the delta the
            // later run depends on and leave the node on a base that does not apply yet.
            const atMs = Date.UTC(2018, 8, 10, 12);
            const roomy = timeZonePlan("America/Dawson", atMs, { maxRegimes: 2, maxWindows: 4 });
            expect(roomy.regimes.length).to.equal(2);
            expect(roomy.dstWindows.filter(window => window.offsetSeconds !== 0).length).to.equal(2);

            const tight = timeZonePlan("America/Dawson", atMs, { maxRegimes: 2, maxWindows: 1 });
            expect(tight.regimes.length).to.equal(1);
            expect(tight.regimes[0].offsetSeconds).to.equal(-28800);
            for (const at of [atMs, Date.UTC(2018, 11, 1), Date.UTC(2019, 5, 1)]) {
                expectPlanMatchesZone("America/Dawson", at, { maxRegimes: 2, maxWindows: 1 });
                expectPlanMatchesZone("America/Dawson", at, { maxRegimes: 2, maxWindows: 4 });
            }
        });

        it("reports a single regime once a permanent change is in the past", () => {
            const plan = timeZonePlan("Asia/Almaty", Date.UTC(2024, 5, 1), BOTH_MAX);
            expect(plan.regimes.length).to.equal(1);
            expect(plan.regimes[0].offsetSeconds).to.equal(18000);
            expect(plan.dstWindows).to.deep.equal([]);
        });
    });

    describe("timeZonePlan regressions", () => {
        it("keeps a past permanent offset change out of the standard offset (#922 / #923)", () => {
            // Europe/Istanbul abolished DST on 2016-09-07, moving permanently to +03:00. A base
            // drawn from before the switch would be +02:00.
            const plan = timeZonePlan("Europe/Istanbul", Date.UTC(2016, 10, 1), BOTH_MAX);
            expect(plan.regimes[0].offsetSeconds).to.equal(10800);
            expectPlanMatchesZone("Europe/Istanbul", Date.UTC(2016, 10, 1));
        });

        it("covers a DST period that began more than 200 days before the sync", () => {
            // US DST runs 238 days, so late in the period the opening transition is far behind the
            // sync instant. Missing it left nothing covering "now" and the node an hour behind.
            const lateInDst = Date.UTC(2026, 9, 1, 12);
            for (const zone of ["America/New_York", "America/Los_Angeles", "Europe/Berlin", "Africa/Casablanca"]) {
                expectPlanMatchesZone(zone, lateInDst);
            }
        });

        it("carries a permanently adopted higher offset instead of claiming the zone has no DST", () => {
            // Turkey's +03 from 2016-03-27 has no closing transition; dropping it made the caller
            // assert DST never applies, leaving the node an hour off from the switch onward.
            expectPlanMatchesZone("Europe/Istanbul", Date.UTC(2016, 0, 15));
            expectPlanMatchesZone("Europe/Istanbul", Date.UTC(2016, 5, 1));
        });

        it("handles a permanent offset reduction scheduled inside the horizon", () => {
            // Kazakhstan moved Asia/Almaty +06 -> +05 permanently on 2024-03-01. A base taken as the
            // minimum over the next 12 months alone would push +05 while the zone is still on +06.
            expectPlanMatchesZone("Asia/Almaty", Date.UTC(2024, 0, 15));
            expectPlanMatchesZone("Asia/Almaty", Date.UTC(2024, 1, 20));
            expectPlanMatchesZone("Asia/Almaty", Date.UTC(2024, 3, 1));
        });

        it("agrees with the zone's true offset across behaviours, dates and list sizes", function () {
            this.timeout(20_000);
            // One zone per behaviour the decomposition has to get right. Breadth across every IANA
            // zone and year is covered by the offline sweep, not here, so this stays inside the
            // per-test timeout on a slow runner: each plan day-steps its whole scan range.
            const zones = [
                "Europe/Berlin", // northern seasonal DST
                "Australia/Sydney", // southern, window spans New Year
                "America/Phoenix", // no DST
                "Asia/Kolkata", // half-hour offset, no DST
                "Pacific/Chatham", // 45-minute DST delta
                "Africa/Casablanca", // recurring dip below the base
            ];
            let checked = 0;
            for (const zone of zones) {
                for (const month of [0, 3, 6, 9]) {
                    for (const maxWindows of [1, 2]) {
                        expectPlanMatchesZone(zone, Date.UTC(2026, month, 5, 6), { maxRegimes: 2, maxWindows });
                        checked++;
                    }
                }
            }
            expect(checked).to.equal(zones.length * 4 * 2);
        });

        it("produces lists SetTimeZone and SetDstOffset accept", function () {
            this.timeout(20_000);
            // One case per shape the lists can take, rather than a cross-product: each plan day-steps
            // its whole scan range, so breadth here would cost more than the per-test timeout allows.
            const cases: Array<[string, number]> = [
                ["Europe/Berlin", Date.UTC(2026, 0, 10)], // seasonal, next window ahead
                ["Europe/Berlin", Date.UTC(2026, 6, 10)], // seasonal, window active now
                ["Australia/Sydney", Date.UTC(2026, 0, 10)], // southern, window spans New Year
                ["Asia/Almaty", Date.UTC(2024, 0, 10)], // pending permanent reduction
                ["Europe/Istanbul", Date.UTC(2016, 0, 10)], // pending permanent adoption
                ["America/Asuncion", Date.UTC(2024, 0, 10)], // real DST plus a pending change
                ["Africa/Casablanca", Date.UTC(2026, 3, 10)], // recurring dip below the base
            ];
            let checked = 0;
            for (const [zone, atMs] of cases) {
                for (const maxRegimes of [1, 2]) {
                    for (const maxWindows of [1, 2, 3]) {
                        const { regimes, dstWindows } = timeZonePlan(zone, atMs, { maxRegimes, maxWindows });
                        const label = `${zone} @ ${new Date(atMs).toISOString()} tz=${maxRegimes} dst=${maxWindows}`;
                        checked++;

                        expect(regimes.length, label).to.be.at.least(1);
                        expect(regimes.length, label).to.be.at.most(maxRegimes);
                        // The cluster requires entry 0 at the Matter epoch and any later entry strictly
                        // after it, in ascending order.
                        expect(regimes[0].validFromMs, label).to.equal(null);
                        regimes.slice(1).forEach((regime, index) => {
                            expect(regime.validFromMs, label).to.not.equal(null);
                            const previous = regimes[index].validFromMs;
                            if (previous !== null) {
                                expect(regime.validFromMs, label).to.be.greaterThan(previous);
                            }
                        });

                        expect(dstWindows.length, label).to.be.at.most(maxWindows);
                        dstWindows.forEach((window, index) => {
                            // Only the final entry may be open-ended, and ValidUntil must follow ValidStarting.
                            if (window.validUntilMs === null) {
                                expect(index, label).to.equal(dstWindows.length - 1);
                            } else {
                                // A window with no known start is pushed as the Matter epoch, so the only
                                // bound left to check it against is the sync instant.
                                expect(window.validUntilMs, label).to.be.greaterThan(window.validStartingMs ?? atMs);
                            }
                            // Entries must be sorted and must not overlap the previous one.
                            const previous = dstWindows[index - 1];
                            if (previous !== undefined) {
                                expect(window.validStartingMs, label).to.be.at.least(previous.validUntilMs ?? 0);
                            }
                        });
                    }
                }
            }
            expect(checked).to.equal(cases.length * 2 * 3);
        });
    });

    describe("nextOffsetChangeMs", () => {
        it("finds an imminent seasonal change", () => {
            const beforeSpringForward = Date.UTC(2026, 2, 28, 12);
            const plan = timeZonePlan("Europe/Berlin", beforeSpringForward, BOTH_MAX);
            expect(nextOffsetChangeMs(plan, beforeSpringForward)).to.equal(Date.UTC(2026, 2, 29, 1));
        });

        it("finds an imminent permanent change", () => {
            // Asia/Almaty dropped +06 -> +05 at 2024-03-01 00:00 local (2024-02-29 18:00 UTC).
            const beforeChange = Date.UTC(2024, 1, 29, 12);
            const plan = timeZonePlan("Asia/Almaty", beforeChange, BOTH_MAX);
            expect(nextOffsetChangeMs(plan, beforeChange)).to.equal(Date.UTC(2024, 1, 29, 18));
        });

        it("returns the window end when mid-DST rather than a boundary already passed", () => {
            const midDst = Date.UTC(2026, 5, 1, 12);
            const plan = timeZonePlan("Europe/Berlin", midDst, BOTH_MAX);
            expect(nextOffsetChangeMs(plan, midDst)).to.equal(Date.UTC(2026, 9, 25, 1));
        });

        it("returns null for a zone whose offset never changes", () => {
            const plan = timeZonePlan("America/Phoenix", JAN_2026, BOTH_MAX);
            expect(nextOffsetChangeMs(plan, JAN_2026)).to.equal(null);
        });
    });

    describe("resolveHostTimeZone", () => {
        it("returns a non-empty IANA zone string", () => {
            expect(resolveHostTimeZone().length).to.be.greaterThan(0);
        });
    });
});
