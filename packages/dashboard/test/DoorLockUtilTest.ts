/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterNode, type MatterNodeData } from "@matter-server/ws-client";
import {
    buildDaySegments,
    decodeUserResponse,
    decodeWeekDayScheduleResponse,
    decodeYearDayScheduleResponse,
    encodePinCode,
    formatDaysMask,
    formatTimeOfDay,
    formatUserLabel,
    formatUserStatus,
    formatUserType,
    fromDateTimeInputValue,
    isFeatureActive,
    maskHasDay,
    parseTimeOfDay,
    readTotalUsersSupported,
    readWeekDaySchedulesPerUser,
    readYearDaySchedulesPerUser,
    requiresPinForRemoteOperation,
    supportsCommand,
    toDateTimeInputValue,
    toggleMaskDay,
    UNLOCK_WITH_TIMEOUT_COMMAND_ID,
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
            const lock = node({ "1/257/17": 10, "1/257/20": 4, "1/257/21": 3 });
            expect(readTotalUsersSupported(lock, 1)).to.equal(10);
            expect(readWeekDaySchedulesPerUser(lock, 1)).to.equal(4);
            expect(readYearDaySchedulesPerUser(lock, 1)).to.equal(3);
        });
        it("reports absent attributes as null", () => {
            expect(readWeekDaySchedulesPerUser(node({}), 1)).to.equal(null);
        });
        it("reads RequirePinForRemoteOperation as a flag", () => {
            expect(requiresPinForRemoteOperation(node({ "1/257/51": true }), 1)).to.equal(true);
            expect(requiresPinForRemoteOperation(node({ "1/257/51": false }), 1)).to.equal(false);
            expect(requiresPinForRemoteOperation(node({}), 1)).to.equal(false);
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
            const slot = decodeWeekDayScheduleResponse({ status: 0, daysMask: SUN }, 3);
            expect(slot.schedule?.weekDayIndex).to.equal(3);
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
            });
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

    describe("datetime-local values", () => {
        it("round-trips a whole-minute instant through the input format", () => {
            const seconds = Math.floor(Date.UTC(2026, 7, 22, 9, 30) / 1000);
            expect(fromDateTimeInputValue(toDateTimeInputValue(seconds))).to.equal(seconds);
        });
        it("reads an empty or malformed value as absent", () => {
            expect(fromDateTimeInputValue("")).to.equal(null);
            expect(fromDateTimeInputValue("not a date")).to.equal(null);
        });
    });

    describe("encodePinCode", () => {
        it("encodes the PIN as base64 for the octstr field", () => {
            expect(encodePinCode("1234")).to.equal("MTIzNA==");
        });
    });
});
