/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    commodityTariffInfo,
    formatMinutesOfDay,
    formatPrice,
    type CurrencyInfo,
} from "../src/util/commodity-tariff.js";
import { formatEpochTime } from "../src/util/time.js";

const MATTER_EPOCH_OFFSET_SECONDS = 946_684_800;

const EUR: CurrencyInfo = { code: 978, decimalPoints: 4, symbol: "€" };

/**
 * A two-period tariff: peak 07:00–22:00 split across day entries 2 and 4, off-peak 22:00–07:00 modeled as
 * entries 3 (22:00) and 1 (00:00) because DayEntry.startTime cannot cross midnight. Entries 10 and 11 come
 * from a second day pattern (weekend) that neither today nor tomorrow uses.
 */
const DAY_ENTRIES = [
    { "0": 1, "1": 0 }, // 00:00 off-peak, continues yesterday's block
    { "0": 2, "1": 420 }, // 07:00 peak
    { "0": 4, "1": 720 }, // 12:00 peak, second block
    { "0": 3, "1": 1320 }, // 22:00 off-peak
    { "0": 10, "1": 1380 }, // weekend pattern only
    { "0": 11, "1": 600 }, // weekend pattern only
];

/** Both periods carry the same label, so period identity cannot be derived from labels. */
const TARIFF_PERIODS = [
    { "0": "Tariff", "1": [1, 3], "2": [100, 101] },
    { "0": "Tariff", "1": [2, 4, 10, 11], "2": [200] },
];

const TARIFF_COMPONENTS = [
    { "0": 100, "6": 0, "7": "Off-peak threshold" }, // no Price field
    { "0": 101, "1": { "0": 0, "1": 1200 }, "6": 0, "7": "Off-peak" },
    { "0": 200, "1": { "0": 1, "1": 3500 }, "6": 0, "7": "Peak" },
];

const DAY_ENTRY_IDS = [1, 2, 4, 3];

/** Matter epoch-s midnight the CurrentDay struct reports; entry start times are offsets from it. */
const TODAY_DATE = 838_339_200;
/** Day entry 2 (07:00) is active, day entry 4 (12:00) comes next. */
const CURRENT_DAY_ENTRY_DATE = TODAY_DATE + 420 * 60;
const NEXT_DAY_ENTRY_DATE = CURRENT_DAY_ENTRY_DATE + 5 * 3600;
/** The period the 22:00 off-peak entry starts ends at 07:00 the following day. */
const OFF_PEAK_START = CURRENT_DAY_ENTRY_DATE + 15 * 3600;

const TARIFF_ATTRS: Record<string, unknown> = {
    "1/1792/0": { "0": "Tempo", "1": "EDF", "2": { "0": 978, "1": 4 }, "3": 1 },
    "1/1792/1": 0, // TariffUnit kWh
    "1/1792/2": 820_454_400, // StartDate
    "1/1792/3": DAY_ENTRIES,
    "1/1792/7": { "0": TODAY_DATE, "1": 0, "2": DAY_ENTRY_IDS }, // CurrentDay, Standard
    "1/1792/8": { "0": TODAY_DATE + 86_400, "1": 1, "2": DAY_ENTRY_IDS }, // NextDay, Holiday
    "1/1792/9": { "0": 2, "1": 420 }, // CurrentDayEntry
    "1/1792/10": CURRENT_DAY_ENTRY_DATE,
    "1/1792/11": { "0": 4, "1": 720 }, // NextDayEntry
    "1/1792/12": NEXT_DAY_ENTRY_DATE,
    "1/1792/13": TARIFF_COMPONENTS,
    "1/1792/14": TARIFF_PERIODS,
    "1/1792/15": [TARIFF_COMPONENTS[2]],
    "1/1792/16": [TARIFF_COMPONENTS[2]],
    "1/1792/65532": 0b100001, // PRICE | RNDM
};

/** Same tariff, but the 22:00 off-peak entry is the one coming up next. */
const OFF_PEAK_NEXT_ATTRS: Record<string, unknown> = {
    ...TARIFF_ATTRS,
    "1/1792/9": { "0": 4, "1": 720 },
    "1/1792/10": NEXT_DAY_ENTRY_DATE,
    "1/1792/11": { "0": 3, "1": 1320 },
    "1/1792/12": OFF_PEAK_START,
    "1/1792/16": [TARIFF_COMPONENTS[1]],
};

describe("commodity tariff util", () => {
    describe("formatPrice", () => {
        it("scales by the currency's decimal points", () => {
            expect(formatPrice(1579, EUR)).to.equal("0.1579 €");
        });
        it("names the ISO code when the symbol is unknown", () => {
            expect(formatPrice(1579, { code: 949, decimalPoints: 2 })).to.equal("15.79 (ISO 4217 #949)");
        });
        it("reads a bigint money field", () => {
            expect(formatPrice(12345n, EUR)).to.equal("1.2345 €");
        });
        it("keeps a negative price (export tariff)", () => {
            expect(formatPrice(-500, EUR)).to.equal("-0.0500 €");
        });
        it("is absent without a price", () => {
            expect(formatPrice(undefined, EUR)).to.equal(undefined);
        });
        it("is absent without a currency, since the scale is then unknown", () => {
            expect(formatPrice(1579, undefined)).to.equal(undefined);
        });
        it("is absent for a money value no number can hold exactly", () => {
            expect(formatPrice(9_007_199_254_740_993n, EUR)).to.equal(undefined);
        });
    });

    describe("formatMinutesOfDay", () => {
        it("pads hours and minutes", () => {
            expect(formatMinutesOfDay(425)).to.equal("07:05");
        });
        it("renders end of day as 24:00", () => {
            expect(formatMinutesOfDay(1440)).to.equal("24:00");
        });
        it("keeps the 25th hour of a DST fall-back day readable", () => {
            expect(formatMinutesOfDay(1470)).to.equal("24:30");
        });
    });

    describe("formatEpochTime", () => {
        const localTime = (matterEpochSeconds: number) =>
            new Date((matterEpochSeconds + MATTER_EPOCH_OFFSET_SECONDS) * 1000).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
            });
        const at = (matterEpochSeconds: number) => new Date((matterEpochSeconds + MATTER_EPOCH_OFFSET_SECONDS) * 1000);

        it("shows only the time for the same day", () => {
            expect(formatEpochTime(CURRENT_DAY_ENTRY_DATE, at(CURRENT_DAY_ENTRY_DATE))).to.equal(
                localTime(CURRENT_DAY_ENTRY_DATE),
            );
        });
        it("marks the following day", () => {
            expect(formatEpochTime(CURRENT_DAY_ENTRY_DATE, at(CURRENT_DAY_ENTRY_DATE - 86_400))).to.equal(
                `tomorrow ${localTime(CURRENT_DAY_ENTRY_DATE)}`,
            );
        });
        it("prefixes the date further out in the same year", () => {
            const now = at(CURRENT_DAY_ENTRY_DATE - 5 * 86_400);
            const date = at(CURRENT_DAY_ENTRY_DATE).toLocaleDateString(undefined, {
                month: "2-digit",
                day: "2-digit",
            });
            expect(formatEpochTime(CURRENT_DAY_ENTRY_DATE, now)).to.equal(
                `${date} ${localTime(CURRENT_DAY_ENTRY_DATE)}`,
            );
        });
        it("includes the year for another year, as the StartDate row needs", () => {
            const now = at(CURRENT_DAY_ENTRY_DATE);
            const startDate = CURRENT_DAY_ENTRY_DATE - 3 * 365 * 86_400;
            const expected = at(startDate).toLocaleDateString(undefined, {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
            });
            expect(formatEpochTime(startDate, now)).to.equal(`${expected} ${localTime(startDate)}`);
        });
    });

    describe("commodityTariffInfo", () => {
        it("reports unsupported when the cluster is absent", () => {
            const info = commodityTariffInfo({ "1/40/5": "label" }, 1);
            expect(info.supported).to.equal(false);
            expect(info.todaySchedule).to.have.lengthOf(0);
        });

        it("decodes tariff header, unit and block mode", () => {
            const info = commodityTariffInfo(TARIFF_ATTRS, 1);
            expect(info.supported).to.equal(true);
            expect(info.tariffInfo?.label).to.equal("Tempo");
            expect(info.tariffInfo?.providerName).to.equal("EDF");
            expect(info.tariffInfo?.currency).to.deep.equal({ code: 978, decimalPoints: 4, symbol: "€" });
            expect(info.tariffInfo?.blockMode).to.equal("Combined usage blocks");
            expect(info.tariffUnit).to.equal("kWh");
            expect(info.startDate).to.equal(820_454_400);
        });

        it("treats a blank label as absent", () => {
            const info = commodityTariffInfo({ ...TARIFF_ATTRS, "1/1792/0": { "0": "  ", "1": "EDF", "3": 0 } }, 1);
            expect(info.tariffInfo?.label).to.equal(undefined);
            expect(info.tariffInfo?.providerName).to.equal("EDF");
        });

        it("names unknown enum values", () => {
            const info = commodityTariffInfo({ ...TARIFF_ATTRS, "1/1792/1": 7 }, 1);
            expect(info.tariffUnit).to.equal("Unknown (7)");
        });

        it("keeps the currency of a TariffInfo struct that carries nothing else", () => {
            const info = commodityTariffInfo({ ...TARIFF_ATTRS, "1/1792/0": { "2": { "0": 840, "1": 2 } } }, 1);
            expect(info.tariffInfo?.currency).to.deep.equal({ code: 840, decimalPoints: 2, symbol: "$" });
            expect(info.currentComponent?.price?.amount).to.equal("35.00 $");
        });

        it("drops a decimal point count that no currency uses instead of throwing", () => {
            const info = commodityTariffInfo(
                { ...TARIFF_ATTRS, "1/1792/0": { "0": "Tempo", "2": { "0": 978, "1": 200 }, "3": 0 } },
                1,
            );
            expect(info.tariffInfo?.currency).to.equal(undefined);
            expect(info.currentComponent?.price?.amount).to.equal(undefined);
        });

        it("prefers the priced entry of CurrentTariffComponents", () => {
            const info = commodityTariffInfo(
                { ...TARIFF_ATTRS, "1/1792/15": [TARIFF_COMPONENTS[0], TARIFF_COMPONENTS[2]] },
                1,
            );
            expect(info.currentComponent?.label).to.equal("Peak");
            expect(info.currentComponent?.price?.amount).to.equal("0.3500 €");
        });

        it("collects the components of every period a day entry belongs to", () => {
            const attrs = {
                ...TARIFF_ATTRS,
                "1/1792/14": [
                    { "0": "Peak thresholds", "1": [2, 4], "2": [100] },
                    { "0": "Peak price", "1": [2, 4], "2": [200] },
                    { "0": "Off-peak", "1": [1, 3], "2": [101] },
                ],
            };
            const info = commodityTariffInfo(attrs, 1);
            const peak = info.todaySchedule.find(row => row.entryId === 2);
            expect(peak?.label).to.equal("Peak thresholds");
            expect(peak?.price?.amount).to.equal("0.3500 €");
        });

        it("resolves the next day entry to its occurrence after the current one", () => {
            const attrs = {
                ...TARIFF_ATTRS,
                "1/1792/9": { "0": 4, "1": 720 },
                "1/1792/10": TODAY_DATE + 720 * 60,
                "1/1792/11": { "0": 1, "1": 0 }, // day entry 1 recurs tomorrow at 00:00
                "1/1792/12": TODAY_DATE + 86_400,
                "1/1792/8": { "0": TODAY_DATE + 86_400, "1": 0, "2": [1, 4] }, // tomorrow skips the 07:00 entry
                "1/1792/14": [
                    { "0": "Off-peak", "1": [1], "2": [101] },
                    { "0": "Peak", "1": [2, 4], "2": [200] },
                    { "0": "Evening", "1": [3], "2": [200] },
                ],
            };
            const info = commodityTariffInfo(attrs, 1);
            // Tomorrow off-peak runs 00:00–12:00; today's occurrence of the same entry would end after 7 h.
            expect(info.nextRange?.end).to.equal(TODAY_DATE + 86_400 + 12 * 3600);
        });

        it("reports no end rather than a backwards one for a start time past the day axis", () => {
            const attrs = {
                ...TARIFF_ATTRS,
                "1/1792/3": [
                    { "0": 1, "1": 0 },
                    { "0": 5, "1": 2000 }, // beyond the 1499 the spec allows
                ],
                "1/1792/7": { "0": TODAY_DATE, "1": 0, "2": [1, 5] },
                "1/1792/8": { "0": TODAY_DATE + 86_400, "1": 0, "2": [1] },
                "1/1792/9": { "0": 5, "1": 2000 },
                "1/1792/10": TODAY_DATE + 2000 * 60,
                "1/1792/14": [
                    { "0": "Off-peak", "1": [1], "2": [101] },
                    { "0": "Peak", "1": [5], "2": [200] },
                ],
            };
            const info = commodityTariffInfo(attrs, 1);
            expect(info.currentRange?.end).to.equal(undefined);
        });

        it("keeps ranges forward-running on a 25-hour day", () => {
            const attrs = {
                ...TARIFF_ATTRS,
                "1/1792/3": [
                    { "0": 1, "1": 0 },
                    { "0": 2, "1": 420 },
                    { "0": 3, "1": 1470 }, // the extra hour of a DST fall-back day
                ],
                "1/1792/7": { "0": TODAY_DATE, "1": 0, "2": [1, 2, 3] },
                "1/1792/8": { "0": TODAY_DATE + 90_000, "1": 0, "2": [1, 2, 3] },
                "1/1792/9": { "0": 3, "1": 1470 },
                "1/1792/10": TODAY_DATE + 1470 * 60,
                "1/1792/11": { "0": 1, "1": 0 },
                "1/1792/12": TODAY_DATE + 1500 * 60,
                "1/1792/14": [
                    { "0": "Off-peak", "1": [1, 3], "2": [101] },
                    { "0": "Peak", "1": [2], "2": [200] },
                ],
            };
            const info = commodityTariffInfo(attrs, 1);
            const end = info.currentRange?.end;
            expect(end === undefined || end > (info.currentRange?.start ?? 0)).to.equal(true);
            expect(info.todaySchedule.map(row => [row.startMinutes, row.endMinutes])).to.deep.equal([
                [0, 420],
                [420, 1470],
                [1470, 1500],
            ]);
        });

        it("ends the current range when the period changes, not when the next day entry starts", () => {
            const info = commodityTariffInfo(TARIFF_ATTRS, 1);
            expect(info.currentRange?.start).to.equal(CURRENT_DAY_ENTRY_DATE);
            // Peak continues across the 12:00 day entry and ends at 22:00, 15 h after 07:00.
            expect(info.currentRange?.end).to.equal(CURRENT_DAY_ENTRY_DATE + 15 * 3600);
        });

        it("merges an off-peak block spanning midnight into one next range", () => {
            const info = commodityTariffInfo(OFF_PEAK_NEXT_ATTRS, 1);
            // Off-peak starts 22:00 today and ends 07:00 tomorrow: 9 h, not 2 h to midnight.
            expect(info.nextRange?.start).to.equal(OFF_PEAK_START);
            expect(info.nextRange?.end).to.equal(OFF_PEAK_START + 9 * 3600);
        });

        it("leaves the range end unknown when the next day is not cached", () => {
            const attrs = { ...OFF_PEAK_NEXT_ATTRS };
            delete attrs["1/1792/8"];
            const info = commodityTariffInfo(attrs, 1);
            expect(info.nextRange?.start).to.equal(OFF_PEAK_START);
            expect(info.nextRange?.end).to.equal(undefined);
        });

        it("picks the priced component of a period", () => {
            const info = commodityTariffInfo(TARIFF_ATTRS, 1);
            const offPeak = info.todaySchedule.find(row => row.entryId === 3);
            expect(offPeak?.price?.amount).to.equal("0.1200 €");
            expect(offPeak?.price?.priceType).to.equal("Standard");
        });

        it("orders the day's schedule and closes the last row at 24:00", () => {
            const info = commodityTariffInfo(TARIFF_ATTRS, 1);
            expect(info.todaySchedule.map(row => [row.startMinutes, row.endMinutes])).to.deep.equal([
                [0, 420],
                [420, 720],
                [720, 1320],
                [1320, 1440],
            ]);
            expect(info.todayType).to.equal("Standard");
            expect(info.tomorrowType).to.equal("Holiday");
        });

        it("clamps a duration that overruns the next entry", () => {
            const attrs = {
                ...TARIFF_ATTRS,
                "1/1792/3": [
                    { "0": 1, "1": 0, "2": 600 }, // claims 10 h but the next entry starts after 7 h
                    { "0": 2, "1": 420 },
                    { "0": 4, "1": 720 },
                    { "0": 3, "1": 1320, "2": 300 }, // claims 5 h, i.e. past midnight
                ],
            };
            const info = commodityTariffInfo(attrs, 1);
            expect(info.todaySchedule.map(row => row.endMinutes)).to.deep.equal([420, 720, 1320, 1440]);
        });

        it("sorts a day whose entry ids arrive out of order", () => {
            const attrs = { ...TARIFF_ATTRS, "1/1792/7": { "0": TODAY_DATE, "1": 0, "2": [3, 4, 1, 2] } };
            const info = commodityTariffInfo(attrs, 1);
            expect(info.todaySchedule.map(row => row.startMinutes)).to.deep.equal([0, 420, 720, 1320]);
        });

        it("skips day entry ids the DayEntries attribute does not describe", () => {
            const attrs = { ...TARIFF_ATTRS, "1/1792/7": { "0": TODAY_DATE, "1": 0, "2": [...DAY_ENTRY_IDS, 99] } };
            const info = commodityTariffInfo(attrs, 1);
            expect(info.todaySchedule).to.have.lengthOf(4);
        });
    });
});
