/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { dstWindows, offsetSecondsAt, resolveHostTimeZone, standardOffsetSeconds } from "../src/util/hostTimeZone.js";

const JAN_2026 = Date.UTC(2026, 0, 15);
const JUL_2026 = Date.UTC(2026, 6, 1);

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

    describe("standardOffsetSeconds", () => {
        it("returns the non-DST base offset in both hemispheres", () => {
            expect(standardOffsetSeconds("Europe/Berlin", JUL_2026)).to.equal(3600);
            expect(standardOffsetSeconds("Australia/Sydney", JAN_2026)).to.equal(36000); // AEST base
            expect(standardOffsetSeconds("America/Phoenix", JUL_2026)).to.equal(-25200);
        });
    });

    describe("dstWindows", () => {
        it("returns the upcoming DST window for a northern-hemisphere zone", () => {
            const windows = dstWindows("Europe/Berlin", JAN_2026, 2);
            expect(windows.length).to.equal(1);
            expect(windows[0].offsetSeconds).to.equal(3600);
            // DST 2026 begins 2026-03-29 01:00 UTC, ends 2026-10-25 01:00 UTC
            expect(windows[0].validStartingMs).to.equal(Date.UTC(2026, 2, 29, 1, 0, 0));
            expect(windows[0].validUntilMs).to.equal(Date.UTC(2026, 9, 25, 1, 0, 0));
        });

        it("returns the currently-active window when already in DST", () => {
            const windows = dstWindows("Europe/Berlin", JUL_2026, 2);
            expect(windows.length).to.be.greaterThan(0);
            expect(windows[0].validStartingMs).to.equal(Date.UTC(2026, 2, 29, 1, 0, 0));
            expect(windows[0].validUntilMs).to.equal(Date.UTC(2026, 9, 25, 1, 0, 0));
        });

        it("returns an empty list for a zone without DST", () => {
            expect(dstWindows("America/Phoenix", JAN_2026, 2)).to.deep.equal([]);
        });

        it("respects the max cap", () => {
            expect(dstWindows("Europe/Berlin", JUL_2026, 1).length).to.equal(1);
            expect(dstWindows("Europe/Berlin", JAN_2026, 0)).to.deep.equal([]);
        });

        it("returns the currently-active window for a southern-hemisphere zone spanning New Year", () => {
            const windows = dstWindows("Australia/Sydney", JAN_2026, 2);
            expect(windows.length).to.be.greaterThan(0);
            expect(windows[0].offsetSeconds).to.equal(3600);
            expect(windows[0].validStartingMs).to.be.lessThan(JAN_2026);
            expect(windows[0].validUntilMs).to.be.greaterThan(JAN_2026);
        });
    });

    describe("resolveHostTimeZone", () => {
        it("returns a non-empty IANA zone string", () => {
            expect(resolveHostTimeZone().length).to.be.greaterThan(0);
        });
    });
});
