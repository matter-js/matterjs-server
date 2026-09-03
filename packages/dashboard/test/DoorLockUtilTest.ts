/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterNode, type MatterClient, type MatterNodeData } from "@matter-server/ws-client";
import {
    attachPinCredential,
    buildDaySegments,
    decodeHolidayScheduleResponse,
    decodeUserResponse,
    decodeWeekDayScheduleResponse,
    decodeYearDayScheduleResponse,
    encodePinCode,
    formatDaysMask,
    formatExpiringTimeoutHint,
    formatOperatingMode,
    formatScheduleStatus,
    formatTimeOfDay,
    formatUserLabel,
    formatUserStatus,
    formatUserType,
    defaultHolidayMode,
    formatWallClock,
    hasPinCredential,
    holidayModeChoices,
    fromDateTimeInputValue,
    holidayScheduleRangeError,
    isFeatureActive,
    maskHasDay,
    nextFreeUserIndex,
    nowAsWallClock,
    parseTimeOfDay,
    pinCodeLengthError,
    readExpiringUserTimeout,
    readHolidaySchedulesSupported,
    readMaxPinCodeLength,
    readMinPinCodeLength,
    readNumberOfPinUsersSupported,
    readTotalUsersSupported,
    readUsers,
    readWeekDaySchedulesPerUser,
    readYearDaySchedulesPerUser,
    requiresPinForRemoteOperation,
    supportedOperatingModes,
    supportsCommand,
    toDateTimeInputValue,
    toggleMaskDay,
    UNLOCK_WITH_TIMEOUT_COMMAND_ID,
    userNameLengthError,
    weekDayScheduleRangeError,
    yearDayScheduleRangeError,
    type WeekDayScheduleSlot,
} from "../src/util/door-lock.js";

function node(attributes: Record<string, unknown>, node_id: number | bigint = 1): MatterNode {
    const data: MatterNodeData = {
        node_id,
        date_commissioned: "",
        last_interview: "",
        interview_version: 1,
        available: true,
        is_bridge: false,
        attributes,
        attribute_subscriptions: [],
    };
    return new MatterNode(data);
}

// DaysMaskBitmap bits (Sunday = bit 0 .. Saturday = bit 6).
const SUN = 1 << 0;
const MON = 1 << 1;
const TUE = 1 << 2;
const WED = 1 << 3;
const THU = 1 << 4;
const FRI = 1 << 5;
const SAT = 1 << 6;

function weekDaySlot(weekDayIndex: number, daysMask: number, start: [number, number], end: [number, number]) {
    return {
        weekDayIndex,
        status: 0,
        schedule: {
            weekDayIndex,
            daysMask,
            startHour: start[0],
            startMinute: start[1],
            endHour: end[0],
            endMinute: end[1],
        },
    } satisfies WeekDayScheduleSlot;
}

describe("door-lock util", () => {
    describe("isFeatureActive", () => {
        it("resolves WDSCH and YDSCH against the real DoorLock FeatureMap", () => {
            const weekDayOnly = node({ "1/257/65532": 1 << 4 });
            expect(isFeatureActive(weekDayOnly, 1, "WDSCH")).to.equal(true);
            expect(isFeatureActive(weekDayOnly, 1, "YDSCH")).to.equal(false);
            expect(isFeatureActive(node({ "1/257/65532": 1 << 10 }), 1, "YDSCH")).to.equal(true);
            expect(isFeatureActive(node({ "1/257/65532": 1 << 8 }), 1, "USR")).to.equal(true);
        });
        it("is false when FeatureMap is absent", () => {
            expect(isFeatureActive(node({}), 1, "WDSCH")).to.equal(false);
        });
    });

    describe("attribute readers", () => {
        it("reads the per-user schedule capacities and the user total", () => {
            const lock = node({ "1/257/17": 10, "1/257/20": 4, "1/257/21": 3, "1/257/22": 2 });
            expect(readTotalUsersSupported(lock, 1)).to.equal(10);
            expect(readWeekDaySchedulesPerUser(lock, 1)).to.equal(4);
            expect(readYearDaySchedulesPerUser(lock, 1)).to.equal(3);
            expect(readHolidaySchedulesSupported(lock, 1)).to.equal(2);
        });
        it("reports absent attributes as null", () => {
            expect(readWeekDaySchedulesPerUser(node({}), 1)).to.equal(null);
        });
        it("reads RequirePinForRemoteOperation as a flag", () => {
            expect(requiresPinForRemoteOperation(node({ "1/257/51": true }), 1)).to.equal(true);
            expect(requiresPinForRemoteOperation(node({ "1/257/51": false }), 1)).to.equal(false);
            expect(requiresPinForRemoteOperation(node({}), 1)).to.equal(false);
        });
        it("reads the PIN credential capacity and length bounds", () => {
            const lock = node({ "1/257/18": 8, "1/257/23": 8, "1/257/24": 4 });
            expect(readNumberOfPinUsersSupported(lock, 1)).to.equal(8);
            expect(readMaxPinCodeLength(lock, 1)).to.equal(8);
            expect(readMinPinCodeLength(lock, 1)).to.equal(4);
            expect(readNumberOfPinUsersSupported(node({}), 1)).to.equal(null);
        });
        it("reads ExpiringUserTimeout", () => {
            expect(readExpiringUserTimeout(node({ "1/257/53": 1440 }), 1)).to.equal(1440);
            expect(readExpiringUserTimeout(node({}), 1)).to.equal(null);
        });
    });

    describe("supportsCommand", () => {
        it("checks the endpoint's AcceptedCommandList", () => {
            expect(supportsCommand(node({ "1/257/65529": [0, 1, 3] }), 1, UNLOCK_WITH_TIMEOUT_COMMAND_ID)).to.equal(
                true,
            );
            expect(supportsCommand(node({ "1/257/65529": [0, 1] }), 1, UNLOCK_WITH_TIMEOUT_COMMAND_ID)).to.equal(false);
            expect(supportsCommand(node({}), 1, UNLOCK_WITH_TIMEOUT_COMMAND_ID)).to.equal(false);
        });
    });

    describe("formatDaysMask", () => {
        it("names the common day sets", () => {
            expect(formatDaysMask(MON | TUE | WED | THU | FRI)).to.equal("Mon–Fri");
            expect(formatDaysMask(SAT | SUN)).to.equal("Sat–Sun");
            expect(formatDaysMask(MON | TUE | WED | THU | FRI | SAT | SUN)).to.equal("Every day");
            expect(formatDaysMask(0)).to.equal("No day");
        });
        it("lists other combinations in display order", () => {
            expect(formatDaysMask(MON | WED | SUN)).to.equal("Mon, Wed, Sun");
        });
    });

    describe("maskHasDay / toggleMaskDay", () => {
        it("adds and removes a day", () => {
            const withMonday = toggleMaskDay(0, 1);
            expect(maskHasDay(withMonday, 1)).to.equal(true);
            expect(maskHasDay(toggleMaskDay(withMonday, 1), 1)).to.equal(false);
        });
    });

    describe("time of day", () => {
        it("formats zero-padded", () => {
            expect(formatTimeOfDay(8, 5)).to.equal("08:05");
        });
        it("parses HH:MM", () => {
            expect(parseTimeOfDay("18:30")).to.deep.equal({ hour: 18, minute: 30 });
            expect(parseTimeOfDay(" 7:05 ")).to.deep.equal({ hour: 7, minute: 5 });
        });
        it("rejects out-of-range and malformed values", () => {
            expect(parseTimeOfDay("24:00")).to.equal(null);
            expect(parseTimeOfDay("10:60")).to.equal(null);
            expect(parseTimeOfDay("1030")).to.equal(null);
            expect(parseTimeOfDay("")).to.equal(null);
        });
        it("accepts the seconds an input at second precision emits, and drops them", () => {
            expect(parseTimeOfDay("18:30:45")).to.deep.equal({ hour: 18, minute: 30 });
        });
    });

    describe("weekDayScheduleRangeError", () => {
        const window = { daysMask: MON, startHour: 8, startMinute: 0, endHour: 18, endMinute: 0 };
        it("accepts a window inside one day", () => {
            expect(weekDayScheduleRangeError(window)).to.equal(null);
        });
        it("requires at least one day", () => {
            expect(weekDayScheduleRangeError({ ...window, daysMask: 0 })).to.equal("Select at least one day.");
        });
        it("rejects a window that does not end after it starts", () => {
            expect(weekDayScheduleRangeError({ ...window, endHour: 8, endMinute: 0 })).to.not.equal(null);
            expect(weekDayScheduleRangeError({ ...window, endHour: 7 })).to.not.equal(null);
        });
        it("accepts an end minute later within the start hour", () => {
            expect(weekDayScheduleRangeError({ ...window, endHour: 8, endMinute: 30 })).to.equal(null);
        });
    });

    describe("yearDayScheduleRangeError", () => {
        it("accepts an increasing range", () => {
            expect(yearDayScheduleRangeError({ localStartTime: 1000, localEndTime: 2000 })).to.equal(null);
        });
        it("rejects an end at or before the start", () => {
            expect(yearDayScheduleRangeError({ localStartTime: 2000, localEndTime: 2000 })).to.not.equal(null);
        });
        it("rejects a range that is not fully entered", () => {
            expect(yearDayScheduleRangeError({ localStartTime: NaN, localEndTime: 2000 })).to.not.equal(null);
        });
        it("rejects a bound the uint32 epoch-s field cannot carry", () => {
            // Asserted on the message so the earlier "enter both dates" branch cannot satisfy this.
            expect(yearDayScheduleRangeError({ localStartTime: -1, localEndTime: 2000 })).to.contain("2136-02-07");
            expect(yearDayScheduleRangeError({ localStartTime: 0, localEndTime: 0x1_0000_0000 })).to.contain(
                "2136-02-07",
            );
        });
    });

    describe("holidayScheduleRangeError", () => {
        it("accepts an increasing range", () => {
            expect(holidayScheduleRangeError({ localStartTime: 1000, localEndTime: 2000, operatingMode: 1 })).to.equal(
                null,
            );
        });
        it("rejects an end at or before the start", () => {
            expect(
                holidayScheduleRangeError({ localStartTime: 2000, localEndTime: 2000, operatingMode: 1 }),
            ).to.not.equal(null);
        });
        it("rejects a range that is not fully entered", () => {
            expect(
                holidayScheduleRangeError({ localStartTime: NaN, localEndTime: 2000, operatingMode: 1 }),
            ).to.not.equal(null);
        });
    });

    describe("buildDaySegments", () => {
        const slots = [
            weekDaySlot(1, MON | TUE | WED | THU | FRI, [8, 0], [18, 0]),
            weekDaySlot(2, SAT | SUN, [10, 30], [12, 0]),
            { weekDayIndex: 3, status: 139, schedule: null } satisfies WeekDayScheduleSlot,
        ];
        it("projects the windows covering a display day", () => {
            expect(buildDaySegments(slots, 0)).to.deep.equal([{ weekDayIndex: 1, startMin: 480, endMin: 1080 }]);
            expect(buildDaySegments(slots, 6)).to.deep.equal([{ weekDayIndex: 2, startMin: 630, endMin: 720 }]);
        });
        it("returns nothing for a day no schedule covers", () => {
            expect(buildDaySegments([slots[1]], 0)).to.deep.equal([]);
        });
        it("orders overlapping windows by start time", () => {
            const evening = weekDaySlot(2, MON, [20, 0], [22, 0]);
            const segments = buildDaySegments([evening, slots[0]], 0);
            expect(segments.map(segment => segment.weekDayIndex)).to.deep.equal([1, 2]);
        });
    });

    describe("decodeWeekDayScheduleResponse", () => {
        it("decodes a populated slot", () => {
            const slot = decodeWeekDayScheduleResponse(
                {
                    weekDayIndex: 1,
                    userIndex: 2,
                    status: 0,
                    daysMask: MON | FRI,
                    startHour: 8,
                    startMinute: 15,
                    endHour: 17,
                    endMinute: 45,
                },
                1,
            );
            expect(slot.status).to.equal(0);
            expect(slot.schedule).to.deep.equal({
                weekDayIndex: 1,
                daysMask: MON | FRI,
                startHour: 8,
                startMinute: 15,
                endHour: 17,
                endMinute: 45,
            });
        });
        it("reports an empty slot without a schedule", () => {
            const slot = decodeWeekDayScheduleResponse({ weekDayIndex: 2, userIndex: 2, status: 139 }, 2);
            expect(slot.status).to.equal(139);
            expect(slot.schedule).to.equal(null);
        });
        it("keeps the requested index when the lock omits it", () => {
            const slot = decodeWeekDayScheduleResponse(
                { status: 0, daysMask: SUN, startHour: 0, startMinute: 0, endHour: 1, endMinute: 0 },
                3,
            );
            expect(slot.schedule?.weekDayIndex).to.equal(3);
        });
        it("reports a Success response with a partial window as unreadable, not as free", () => {
            // Half a window is not a 00:00 schedule, and rendering it as Empty offers a "+" over a slot
            // that may well be occupied.
            const slot = decodeWeekDayScheduleResponse({ status: 0, daysMask: SUN, startHour: 8 }, 4);
            expect(slot.schedule).to.equal(null);
            expect(slot.status).to.equal(null);
        });
        it("distinguishes a response carrying no status from a successful empty slot", () => {
            // An empty slot is one the lock answered for; this is one it did not.
            expect(decodeWeekDayScheduleResponse({}, 5).status).to.equal(null);
            expect(decodeWeekDayScheduleResponse("nonsense", 5).status).to.equal(null);
            expect(decodeYearDayScheduleResponse({}, 5).status).to.equal(null);
            expect(decodeHolidayScheduleResponse({}, 5).status).to.equal(null);
        });
        it("reports a truncated Success from the year day and holiday responses as unreadable too", () => {
            // Same spec sentence as the week day case: SUCCESS obliges the lock to send the fields.
            expect(decodeYearDayScheduleResponse({ status: 0, localStartTime: 100 }, 6).status).to.equal(null);
            expect(
                decodeHolidayScheduleResponse({ status: 0, localStartTime: 100, localEndTime: 200 }, 6).status,
            ).to.equal(null);
        });
    });

    describe("decodeYearDayScheduleResponse", () => {
        it("decodes a populated slot", () => {
            const slot = decodeYearDayScheduleResponse(
                {
                    yearDayIndex: 1,
                    userIndex: 2,
                    status: 0,
                    localStartTime: 1_700_000_000,
                    localEndTime: 1_700_086_400,
                },
                1,
            );
            expect(slot.schedule).to.deep.equal({
                yearDayIndex: 1,
                localStartTime: 1_700_000_000,
                localEndTime: 1_700_086_400,
            });
        });
        it("reports a slot whose optional times are absent as empty", () => {
            expect(decodeYearDayScheduleResponse({ yearDayIndex: 2, status: 0 }, 2).schedule).to.equal(null);
            expect(decodeYearDayScheduleResponse({ yearDayIndex: 2, status: 139 }, 2).schedule).to.equal(null);
        });
    });

    describe("decodeHolidayScheduleResponse", () => {
        it("decodes a populated slot", () => {
            const slot = decodeHolidayScheduleResponse(
                {
                    holidayIndex: 1,
                    status: 0,
                    localStartTime: 1_700_000_000,
                    localEndTime: 1_700_086_400,
                    operatingMode: 1,
                },
                1,
            );
            expect(slot.schedule).to.deep.equal({
                holidayIndex: 1,
                localStartTime: 1_700_000_000,
                localEndTime: 1_700_086_400,
                operatingMode: 1,
            });
        });
        it("reports a slot whose optional fields are absent as empty", () => {
            expect(decodeHolidayScheduleResponse({ holidayIndex: 2, status: 0 }, 2).schedule).to.equal(null);
            expect(decodeHolidayScheduleResponse({ holidayIndex: 2, status: 139 }, 2).schedule).to.equal(null);
        });
    });

    describe("decodeUserResponse", () => {
        it("decodes an occupied user", () => {
            const user = decodeUserResponse({
                userIndex: 1,
                userName: "Alice",
                userStatus: 1,
                userType: 2,
                nextUserIndex: 4,
            });
            expect(user).to.deep.equal({
                userIndex: 1,
                userName: "Alice",
                userStatus: 1,
                userType: 2,
                nextUserIndex: 4,
                occupied: true,
                credentials: [],
            });
        });
        it("decodes the user's credentials", () => {
            const user = decodeUserResponse({
                userIndex: 1,
                userStatus: 1,
                credentials: [{ credentialType: 1, credentialIndex: 3 }],
            })!;
            expect(user.credentials).to.deep.equal([{ credentialType: 1, credentialIndex: 3 }]);
            expect(hasPinCredential(user)).to.equal(true);
        });
        it("reports no PIN credential when credentials are absent or of another type", () => {
            expect(hasPinCredential(decodeUserResponse({ userIndex: 1, userStatus: 1 })!)).to.equal(false);
            const rfidOnly = decodeUserResponse({
                userIndex: 1,
                userStatus: 1,
                credentials: [{ credentialType: 2, credentialIndex: 0 }],
            })!;
            expect(hasPinCredential(rfidOnly)).to.equal(false);
        });
        it("treats a null and an Available status as a free slot", () => {
            expect(decodeUserResponse({ userIndex: 2, userStatus: null })?.occupied).to.equal(false);
            expect(decodeUserResponse({ userIndex: 2, userStatus: 0 })?.occupied).to.equal(false);
        });
        it("rejects a response without a user index", () => {
            expect(decodeUserResponse({ userStatus: 1 })).to.equal(null);
            expect(decodeUserResponse(null)).to.equal(null);
        });
    });

    describe("nextFreeUserIndex", () => {
        it("picks index 1 on an empty database", () => {
            expect(nextFreeUserIndex([], 10)).to.equal(1);
        });
        it("skips occupied indices, including out of order", () => {
            const users = [
                decodeUserResponse({ userIndex: 2, userStatus: 1 })!,
                decodeUserResponse({ userIndex: 1, userStatus: 1 })!,
            ];
            expect(nextFreeUserIndex(users, 10)).to.equal(3);
        });
        it("fills a gap left by a removed user before extending the range", () => {
            const users = [1, 3, 4].map(userIndex => decodeUserResponse({ userIndex, userStatus: 1 })!);
            expect(nextFreeUserIndex(users, 10)).to.equal(2);
        });
        it("returns null once every slot up to maxUsers is occupied", () => {
            const users = [1, 2, 3].map(userIndex => decodeUserResponse({ userIndex, userStatus: 1 })!);
            expect(nextFreeUserIndex(users, 3)).to.equal(null);
        });
    });

    describe("user labels", () => {
        it("prefers the user's own name", () => {
            const user = decodeUserResponse({ userIndex: 3, userName: "Bob", userStatus: 1 })!;
            expect(formatUserLabel(user)).to.equal("Bob");
        });
        it("falls back to the index", () => {
            const user = decodeUserResponse({ userIndex: 3, userStatus: 1 })!;
            expect(formatUserLabel(user)).to.equal("User 3");
        });
        it("names the status and type enums", () => {
            expect(formatUserStatus(1)).to.equal("Enabled");
            expect(formatUserStatus(3)).to.equal("Disabled");
            expect(formatUserType(8)).to.equal("Schedule Restricted");
            expect(formatUserType(null)).to.equal(null);
        });
    });

    describe("formatOperatingMode", () => {
        it("names the known operating modes", () => {
            expect(formatOperatingMode(0)).to.equal("Normal");
            expect(formatOperatingMode(1)).to.equal("Vacation");
            expect(formatOperatingMode(4)).to.equal("Passage");
        });
        it("passes null through and falls back for an unknown mode", () => {
            expect(formatOperatingMode(null)).to.equal(null);
            expect(formatOperatingMode(99)).to.equal("Mode 99");
        });
    });

    describe("datetime-local values", () => {
        // 2026-08-22T09:30 on the lock's own clock. Anchored to the literal wire number rather than to a
        // round-trip: the conversion this pins is exactly the one a self-consistent round-trip cannot see.
        const WALL_CLOCK_2026_08_22_0930 = 840706200;

        it("encodes the lock's wall clock as Matter epoch-s, not Unix seconds", () => {
            expect(fromDateTimeInputValue("2026-08-22T09:30")).to.equal(WALL_CLOCK_2026_08_22_0930);
            expect(toDateTimeInputValue(WALL_CLOCK_2026_08_22_0930)).to.equal("2026-08-22T09:30");
        });
        describe("in a viewer time zone that is not UTC", () => {
            // A UTC host cannot tell a local-getter bug from a correct one, so the zone is forced here.
            let originalTimeZone: string | undefined;
            before(() => {
                originalTimeZone = process.env["TZ"];
                process.env["TZ"] = "America/New_York";
            });
            after(() => {
                if (originalTimeZone === undefined) delete process.env["TZ"];
                else process.env["TZ"] = originalTimeZone;
            });

            it("shows the lock's wall clock rather than converting it to the viewer's zone", () => {
                const asViewerLocalTime = new Date((WALL_CLOCK_2026_08_22_0930 + 946_684_800) * 1000).toLocaleString();
                expect(formatWallClock(WALL_CLOCK_2026_08_22_0930)).to.not.equal(asViewerLocalTime);
                expect(formatWallClock(WALL_CLOCK_2026_08_22_0930)).to.contain("09:30");
            });
            it("reads a value back unshifted", () => {
                expect(toDateTimeInputValue(WALL_CLOCK_2026_08_22_0930)).to.equal("2026-08-22T09:30");
                expect(fromDateTimeInputValue("2026-08-22T09:30")).to.equal(WALL_CLOCK_2026_08_22_0930);
            });
            it("reads the browser's own wall clock, not its UTC instant", () => {
                // getUTC* here would name the New York date/time as if it were the local one. The clock is
                // sampled on both sides so a minute rolling over mid-test cannot fail it.
                const stamp = (at: Date) =>
                    `${at.toLocaleDateString("en-CA")}T${at.toLocaleTimeString("en-GB").slice(0, 5)}`;
                const before = stamp(new Date());
                const actual = toDateTimeInputValue(nowAsWallClock()).slice(0, 16);
                expect(actual).to.be.oneOf([before, stamp(new Date())]);
            });
        });
        it("keeps seconds a lock reported rather than truncating them on the next save", () => {
            const withSeconds = WALL_CLOCK_2026_08_22_0930 + 45;
            expect(toDateTimeInputValue(withSeconds)).to.equal("2026-08-22T09:30:45");
            expect(fromDateTimeInputValue("2026-08-22T09:30:45")).to.equal(withSeconds);
        });
        it("reads the epoch start and the field's last representable second", () => {
            expect(fromDateTimeInputValue("2000-01-01T00:00:00")).to.equal(0);
            expect(fromDateTimeInputValue("2136-02-07T06:28:15")).to.equal(0xffffffff);
        });
        it("reads an empty, malformed or impossible value as absent", () => {
            expect(fromDateTimeInputValue("")).to.equal(null);
            expect(fromDateTimeInputValue("not a date")).to.equal(null);
            // Date.UTC would roll this into March rather than rejecting it.
            expect(fromDateTimeInputValue("2026-02-30T09:30")).to.equal(null);
        });
        it("rejects an out-of-range time component the picker cannot produce but a script can", () => {
            expect(fromDateTimeInputValue("2026-08-22T24:00")).to.equal(null);
            expect(fromDateTimeInputValue("2026-08-22T12:99")).to.equal(null);
            expect(fromDateTimeInputValue("2026-08-22T12:30:99")).to.equal(null);
        });
    });

    describe("formatScheduleStatus", () => {
        it("reads Success and NotFound as an empty slot", () => {
            expect(formatScheduleStatus(0)).to.equal("Empty");
            expect(formatScheduleStatus(0x8b)).to.equal("Empty");
        });
        it("names the interaction-model status the Status field actually carries", () => {
            // The field is typed `status`, and the spec names INVALID_COMMAND for an out-of-range index.
            expect(formatScheduleStatus(0x85)).to.equal("InvalidCommand");
            expect(formatScheduleStatus(0x7e)).to.equal("UnsupportedAccess");
        });
        it("distinguishes a response that carried no status from a successful empty slot", () => {
            expect(formatScheduleStatus(null)).to.equal("Unreadable");
        });
        it("falls back for an unknown status", () => {
            expect(formatScheduleStatus(0x42)).to.equal("Unknown(66)");
        });
    });

    describe("supportedOperatingModes", () => {
        const endpointAttr = "1/257/38";

        it("treats a cleared bit as supported, per the inverted bitmap", () => {
            // Normal (bit 0) and Privacy (bit 2) clear; everything else set, i.e. unsupported.
            expect(supportedOperatingModes(node({ [endpointAttr]: 0b11111010 }), 1)).to.deep.equal([0, 2]);
        });
        it("offers every mode when the lock does not report the attribute", () => {
            expect(supportedOperatingModes(node({}), 1)).to.deep.equal([0, 1, 2, 3, 4]);
        });
        it("offers every mode rather than none when the lock reports all of them unsupported", () => {
            expect(supportedOperatingModes(node({ [endpointAttr]: 0xff }), 1)).to.deep.equal([0, 1, 2, 3, 4]);
        });
    });

    describe("holidayModeChoices", () => {
        it("offers the supported modes unchanged when the current one is among them", () => {
            expect(holidayModeChoices([0, 1, 3], 1)).to.deep.equal([0, 1, 3]);
        });
        it("keeps a stored mode the lock no longer advertises", () => {
            // Otherwise the picker shows its first entry while a save still writes the stored mode.
            expect(holidayModeChoices([0, 3], 1)).to.deep.equal([1, 0, 3]);
        });
    });

    describe("defaultHolidayMode", () => {
        it("starts a new holiday schedule on Vacation", () => {
            expect(defaultHolidayMode([0, 1, 2, 3, 4])).to.equal(1);
        });
        it("falls back to the first supported mode when Vacation is not implemented", () => {
            expect(defaultHolidayMode([0, 3])).to.equal(0);
        });
        it("falls back to Normal, which every lock implements, for an empty list", () => {
            expect(defaultHolidayMode([])).to.equal(0);
        });
    });

    describe("userNameLengthError", () => {
        it("accepts a name inside the constraint", () => {
            expect(userNameLengthError("Alice")).to.equal(null);
            expect(userNameLengthError("0123456789")).to.equal(null);
        });
        it("rejects an empty name", () => {
            expect(userNameLengthError("")).to.equal("Enter a name for the user.");
        });
        it("counts UTF-8 bytes, not characters", () => {
            // Ten characters, but the lock measures the encoded octets and rejects this one.
            expect(userNameLengthError("Zoë Müller")).to.contain("bytes");
            expect(userNameLengthError("01234567890")).to.contain("bytes");
        });
    });

    describe("pinCodeLengthError", () => {
        it("rejects an empty PIN", () => {
            expect(pinCodeLengthError("", null, null)).to.equal("Enter a PIN.");
        });
        it("accepts any non-empty PIN when the lock reports no length bounds", () => {
            expect(pinCodeLengthError("1", null, null)).to.equal(null);
        });
        it("enforces known bounds", () => {
            expect(pinCodeLengthError("123", 4, 8)).to.contain("at least 4");
            expect(pinCodeLengthError("123456789", 4, 8)).to.contain("at most 8");
            expect(pinCodeLengthError("1234", 4, 8)).to.equal(null);
        });
    });

    describe("formatExpiringTimeoutHint", () => {
        it("phrases the lock-wide timeout", () => {
            expect(formatExpiringTimeoutHint(1440)).to.equal("Disables 1440 min after first PIN use");
        });
        it("is absent when the lock does not report the attribute", () => {
            expect(formatExpiringTimeoutHint(null)).to.equal(null);
        });
    });

    describe("encodePinCode", () => {
        it("encodes the PIN as base64 for the octstr field", () => {
            expect(encodePinCode("1234")).to.equal("MTIzNA==");
        });
    });

    describe("readUsers", () => {
        function fakeUserClient(responses: Record<number, unknown>) {
            const calls = new Array<number>();
            const client = {
                deviceCommand: (
                    _nodeId: number | bigint,
                    _endpointId: number,
                    _clusterId: number,
                    _commandName: string,
                    payload: Record<string, unknown> = {},
                ) => {
                    const userIndex = payload["userIndex"] as number;
                    calls.push(userIndex);
                    return Promise.resolve(responses[userIndex]);
                },
            } as unknown as MatterClient;
            return { client, calls };
        }

        it("skips a free slot and follows NextUserIndex to the occupied users", async () => {
            const { client, calls } = fakeUserClient({
                1: { userIndex: 1, userStatus: null, nextUserIndex: 2 },
                2: { userIndex: 2, userName: "Bob", userStatus: 1, nextUserIndex: null },
            });
            const users = await readUsers(client, 1, 6, 10);
            expect(users.map(user => user.userIndex)).to.deep.equal([2]);
            expect(calls).to.deep.equal([1, 2]);
        });

        it("stops on a repeated index instead of looping forever", async () => {
            const { client, calls } = fakeUserClient({
                1: { userIndex: 1, userName: "A", userStatus: 1, nextUserIndex: 1 },
            });
            const users = await readUsers(client, 1, 6, 10);
            expect(users.map(user => user.userIndex)).to.deep.equal([1]);
            expect(calls).to.deep.equal([1]);
        });

        it("bounds the walk at maxUsers on a lock that never terminates the chain", async () => {
            const responses: Record<number, unknown> = {};
            for (let index = 1; index <= 5; index++) {
                responses[index] = { userIndex: index, userName: `U${index}`, userStatus: 1, nextUserIndex: index + 1 };
            }
            const { client, calls } = fakeUserClient(responses);
            const users = await readUsers(client, 1, 6, 2);
            expect(users.map(user => user.userIndex)).to.deep.equal([1, 2]);
            expect(calls).to.deep.equal([1, 2]);
        });
    });

    describe("attachPinCredential", () => {
        /** `occupiedChain` maps an occupied PIN credential index to the next occupied one (or null). */
        function fakeCredentialClient(options: {
            occupiedChain: Record<number, number | null>;
            setCredentialResponse?: unknown;
        }) {
            const setCredentialCalls = new Array<Record<string, unknown>>();
            const client = {
                deviceCommand: (
                    _nodeId: number | bigint,
                    _endpointId: number,
                    _clusterId: number,
                    commandName: string,
                    payload: Record<string, unknown> = {},
                ) => {
                    if (commandName === "GetCredentialStatus") {
                        const { credentialIndex } = payload["credential"] as { credentialIndex: number };
                        const exists = credentialIndex in options.occupiedChain;
                        return Promise.resolve({
                            credentialExists: exists,
                            nextCredentialIndex: exists ? options.occupiedChain[credentialIndex] : null,
                        });
                    }
                    if (commandName === "SetCredential") {
                        setCredentialCalls.push(payload);
                        return Promise.resolve(options.setCredentialResponse ?? { status: 0, userIndex: null });
                    }
                    throw new Error(`unexpected command ${commandName}`);
                },
            } as unknown as MatterClient;
            return { client, setCredentialCalls };
        }

        it("attaches the PIN at the first free credential index", async () => {
            const { client, setCredentialCalls } = fakeCredentialClient({ occupiedChain: { 1: 2, 2: null } });
            await attachPinCredential(client, 1, 6, 3, "1234", 5);
            expect(setCredentialCalls).to.have.length(1);
            expect(setCredentialCalls[0]?.["credential"]).to.deep.equal({ credentialType: 1, credentialIndex: 3 });
            expect(setCredentialCalls[0]?.["credentialData"]).to.equal(encodePinCode("1234"));
            expect(setCredentialCalls[0]?.["userIndex"]).to.equal(3);
            expect(setCredentialCalls[0]?.["userStatus"]).to.equal(null);
            expect(setCredentialCalls[0]?.["userType"]).to.equal(null);
        });

        it("throws once every slot up to capacity is occupied", async () => {
            const { client } = fakeCredentialClient({ occupiedChain: { 1: 2, 2: null } });
            await expect(attachPinCredential(client, 1, 6, 3, "1234", 2)).to.be.rejectedWith("full");
        });

        it("throws the lock's status name when SetCredential reports failure", async () => {
            const { client } = fakeCredentialClient({ occupiedChain: {}, setCredentialResponse: { status: 2 } });
            await expect(attachPinCredential(client, 1, 6, 3, "1234", 5)).to.be.rejectedWith("Unknown(2)");
        });
    });
});
