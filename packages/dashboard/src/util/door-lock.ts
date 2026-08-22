/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterClient, MatterNode } from "@matter-server/ws-client";
import { clusters } from "../client/models/descriptions.js";
import { asObject, pickNumber, pickString } from "./attribute-shapes.js";
import { computeActiveClusterFeatures } from "./cluster-features.js";

/** Door Lock cluster (Matter spec §5.2). */
export const DOOR_LOCK_CLUSTER_ID = 257; // 0x0101

const ATTR_LOCK_STATE = 0x00;
const ATTR_LOCK_TYPE = 0x01;
const ATTR_ACTUATOR_ENABLED = 0x02;
const ATTR_DOOR_STATE = 0x03;
const ATTR_NUMBER_OF_TOTAL_USERS_SUPPORTED = 0x11;
const ATTR_NUMBER_OF_WEEK_DAY_SCHEDULES_SUPPORTED_PER_USER = 0x14;
const ATTR_NUMBER_OF_YEAR_DAY_SCHEDULES_SUPPORTED_PER_USER = 0x15;
const ATTR_REQUIRE_PIN_FOR_REMOTE_OPERATION = 0x33;
const ATTR_ACCEPTED_COMMAND_LIST = 0xfff9;
const ATTR_FEATURE_MAP = 0xfffc;

/** UnlockWithTimeout is optional even on locks that support unlocking (spec §5.2.10.4). */
export const UNLOCK_WITH_TIMEOUT_COMMAND_ID = 0x03;

/** ClearWeekDaySchedule and ClearYearDaySchedule wipe every slot of a user when addressed with this index. */
export const SCHEDULE_INDEX_ALL = 0xfe;

/** UserStatusEnum.Available — a slot the lock reports as free (spec §5.2.6.14). */
const USER_STATUS_AVAILABLE = 0;

/** Days in display order (Mon..Sun) mapped to their DaysMaskBitmap bit (Sunday=0 .. Saturday=6). */
export const DAY_BITS = [1, 2, 3, 4, 5, 6, 0];
export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const WEEKDAYS_MASK = 0b0111110;
const WEEKEND_MASK = 0b1000001;
const ALL_DAYS_MASK = 0b1111111;

const LOCK_STATE_LABELS: Record<number, string> = {
    0: "Not Fully Locked",
    1: "Locked",
    2: "Unlocked",
    3: "Unlatched",
};

const LOCK_TYPE_LABELS: Record<number, string> = {
    0: "Dead Bolt",
    1: "Magnetic",
    2: "Other",
    3: "Mortise",
    4: "Rim",
    5: "Latch Bolt",
    6: "Cylindrical Lock",
    7: "Tubular Lock",
    8: "Interconnected Lock",
    9: "Dead Latch",
    10: "Door Furniture",
    11: "Eurocylinder",
};

const DOOR_STATE_LABELS: Record<number, string> = {
    0: "Open",
    1: "Closed",
    2: "Jammed",
    3: "Forced Open",
    4: "Unspecified Error",
    5: "Ajar",
};

const USER_STATUS_LABELS: Record<number, string> = {
    0: "Available",
    1: "Enabled",
    3: "Disabled",
};

const USER_TYPE_LABELS: Record<number, string> = {
    0: "Unrestricted",
    1: "Year Day Schedule",
    2: "Week Day Schedule",
    3: "Programming",
    4: "No Access",
    5: "Forced",
    6: "Disposable",
    7: "Expiring",
    8: "Schedule Restricted",
    9: "Remote Only",
};

/** A Week Day schedule slot holding a window, as reported by GetWeekDayScheduleResponse. */
export interface WeekDaySchedule {
    weekDayIndex: number;
    daysMask: number;
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
}

/** One of a user's schedule slots: `schedule` is null when the lock reported a non-success status. */
export interface WeekDayScheduleSlot {
    weekDayIndex: number;
    status: number;
    schedule: WeekDaySchedule | null;
}

/**
 * A Year Day schedule slot holding a fixed date range. Both bounds are Unix seconds: the cluster carries
 * them as epoch-s, which the server converts in both directions, and they mean local time at the lock.
 */
export interface YearDaySchedule {
    yearDayIndex: number;
    localStartTime: number;
    localEndTime: number;
}

export interface YearDayScheduleSlot {
    yearDayIndex: number;
    status: number;
    schedule: YearDaySchedule | null;
}

export interface DoorLockUser {
    userIndex: number;
    userName: string | null;
    userStatus: number | null;
    userType: number | null;
    nextUserIndex: number | null;
    occupied: boolean;
}

/** A schedule window projected onto one display day, in minutes from midnight. */
export interface DayScheduleSegment {
    weekDayIndex: number;
    startMin: number;
    endMin: number;
}

function readAttr(node: MatterNode, endpoint: number, attrId: number): unknown {
    return node.attributes[`${endpoint}/${DOOR_LOCK_CLUSTER_ID}/${attrId}`];
}

function readNumberAttr(node: MatterNode, endpoint: number, attrId: number): number | null {
    const value = readAttr(node, endpoint, attrId);
    return typeof value === "number" ? value : null;
}

/** Whether the Door Lock cluster's FeatureMap includes the feature with the given code (e.g. "WDSCH", "USR"). */
export function isFeatureActive(node: MatterNode, endpoint: number, code: string): boolean {
    const knownFeatures = Object.values(clusters[DOOR_LOCK_CLUSTER_ID]?.features ?? {});
    const featureMapValue = readAttr(node, endpoint, ATTR_FEATURE_MAP);
    if (featureMapValue === undefined) return false;
    return computeActiveClusterFeatures(featureMapValue, knownFeatures).some(feature => feature.code === code);
}

export function supportsCommand(node: MatterNode, endpoint: number, commandId: number): boolean {
    const accepted = readAttr(node, endpoint, ATTR_ACCEPTED_COMMAND_LIST);
    return Array.isArray(accepted) && accepted.map(value => Number(value)).includes(commandId);
}

export function readLockState(node: MatterNode, endpoint: number): number | null {
    return readNumberAttr(node, endpoint, ATTR_LOCK_STATE);
}

export function readLockType(node: MatterNode, endpoint: number): number | null {
    return readNumberAttr(node, endpoint, ATTR_LOCK_TYPE);
}

export function readDoorState(node: MatterNode, endpoint: number): number | null {
    return readNumberAttr(node, endpoint, ATTR_DOOR_STATE);
}

export function readActuatorEnabled(node: MatterNode, endpoint: number): boolean | null {
    const value = readAttr(node, endpoint, ATTR_ACTUATOR_ENABLED);
    return typeof value === "boolean" ? value : null;
}

export function readTotalUsersSupported(node: MatterNode, endpoint: number): number | null {
    return readNumberAttr(node, endpoint, ATTR_NUMBER_OF_TOTAL_USERS_SUPPORTED);
}

export function readWeekDaySchedulesPerUser(node: MatterNode, endpoint: number): number | null {
    return readNumberAttr(node, endpoint, ATTR_NUMBER_OF_WEEK_DAY_SCHEDULES_SUPPORTED_PER_USER);
}

export function readYearDaySchedulesPerUser(node: MatterNode, endpoint: number): number | null {
    return readNumberAttr(node, endpoint, ATTR_NUMBER_OF_YEAR_DAY_SCHEDULES_SUPPORTED_PER_USER);
}

export function requiresPinForRemoteOperation(node: MatterNode, endpoint: number): boolean {
    return readAttr(node, endpoint, ATTR_REQUIRE_PIN_FOR_REMOTE_OPERATION) === true;
}

export function formatLockState(state: number | null): string {
    if (state === null) return "Unknown";
    return LOCK_STATE_LABELS[state] ?? `State ${state}`;
}

export function formatLockType(type: number | null): string | null {
    if (type === null) return null;
    return LOCK_TYPE_LABELS[type] ?? `Type ${type}`;
}

export function formatDoorState(state: number | null): string | null {
    if (state === null) return null;
    return DOOR_STATE_LABELS[state] ?? `State ${state}`;
}

export function formatUserStatus(status: number | null): string | null {
    if (status === null) return null;
    return USER_STATUS_LABELS[status] ?? `Status ${status}`;
}

export function formatUserType(type: number | null): string | null {
    if (type === null) return null;
    return USER_TYPE_LABELS[type] ?? `Type ${type}`;
}

/** A user's display name: its own UserName when set, else its index. */
export function formatUserLabel(user: DoorLockUser): string {
    return user.userName ?? `User ${user.userIndex}`;
}

export function maskHasDay(mask: number, bit: number): boolean {
    return (mask & (1 << bit)) !== 0;
}

export function toggleMaskDay(mask: number, bit: number): number {
    return mask ^ (1 << bit);
}

export function formatDaysMask(mask: number): string {
    const days = mask & ALL_DAYS_MASK;
    if (days === 0) return "No day";
    if (days === ALL_DAYS_MASK) return "Every day";
    if (days === WEEKDAYS_MASK) return "Mon–Fri";
    if (days === WEEKEND_MASK) return "Sat–Sun";
    return DAY_LABELS.filter((_, index) => maskHasDay(days, DAY_BITS[index])).join(", ");
}

export function formatTimeOfDay(hour: number, minute: number): string {
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseTimeOfDay(value: string): { hour: number; minute: number } | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return null;
    return { hour, minute };
}

/**
 * Why the schedule cannot be set as entered, or null when it is valid.
 * A window may not span midnight: the spec constrains EndHour/EndMinute to follow the start within the day.
 */
export function weekDayScheduleRangeError(schedule: Omit<WeekDaySchedule, "weekDayIndex">): string | null {
    if ((schedule.daysMask & ALL_DAYS_MASK) === 0) return "Select at least one day.";
    const start = schedule.startHour * 60 + schedule.startMinute;
    const end = schedule.endHour * 60 + schedule.endMinute;
    if (end <= start) return "The end time must be later than the start time on the same day.";
    return null;
}

/** Why the date range cannot be set as entered, or null when it is valid. */
export function yearDayScheduleRangeError(schedule: Omit<YearDaySchedule, "yearDayIndex">): string | null {
    if (!Number.isFinite(schedule.localStartTime) || !Number.isFinite(schedule.localEndTime)) {
        return "Enter both a start and an end date.";
    }
    if (schedule.localEndTime <= schedule.localStartTime) return "The end date must be later than the start date.";
    return null;
}

/** Formats a Unix-seconds instant as a local date and time. */
export function formatLocalDateTime(unixSeconds: number): string {
    return new Date(unixSeconds * 1000).toLocaleString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

/** Formats a Unix-seconds instant for an `<input type="datetime-local">`, whose value is local wall time. */
export function toDateTimeInputValue(unixSeconds: number): string {
    const date = new Date(unixSeconds * 1000);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Reads an `<input type="datetime-local">` value back as Unix seconds, or null when it is empty or invalid. */
export function fromDateTimeInputValue(value: string): number | null {
    if (value.trim() === "") return null;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
}

/** The windows covering one display day (0 = Monday .. 6 = Sunday), ordered by start time. */
export function buildDaySegments(slots: WeekDayScheduleSlot[], displayDay: number): DayScheduleSegment[] {
    const bit = DAY_BITS[displayDay];
    if (bit === undefined) return [];
    return slots
        .flatMap(slot => {
            const schedule = slot.schedule;
            if (schedule === null || !maskHasDay(schedule.daysMask, bit)) return [];
            return [
                {
                    weekDayIndex: schedule.weekDayIndex,
                    startMin: schedule.startHour * 60 + schedule.startMinute,
                    endMin: schedule.endHour * 60 + schedule.endMinute,
                },
            ];
        })
        .sort((a, b) => a.startMin - b.startMin);
}

export function decodeWeekDayScheduleResponse(response: unknown, weekDayIndex: number): WeekDayScheduleSlot {
    const obj = asObject(response);
    const status = (obj !== null ? pickNumber(obj, "status") : null) ?? 0;
    if (obj === null || status !== 0) {
        return { weekDayIndex, status, schedule: null };
    }
    return {
        weekDayIndex,
        status,
        schedule: {
            weekDayIndex: pickNumber(obj, "weekDayIndex") ?? weekDayIndex,
            daysMask: pickNumber(obj, "daysMask") ?? 0,
            startHour: pickNumber(obj, "startHour") ?? 0,
            startMinute: pickNumber(obj, "startMinute") ?? 0,
            endHour: pickNumber(obj, "endHour") ?? 0,
            endMinute: pickNumber(obj, "endMinute") ?? 0,
        },
    };
}

export function decodeYearDayScheduleResponse(response: unknown, yearDayIndex: number): YearDayScheduleSlot {
    const obj = asObject(response);
    const status = (obj !== null ? pickNumber(obj, "status") : null) ?? 0;
    const localStartTime = obj !== null ? pickNumber(obj, "localStartTime") : null;
    const localEndTime = obj !== null ? pickNumber(obj, "localEndTime") : null;
    if (status !== 0 || localStartTime === null || localEndTime === null) {
        return { yearDayIndex, status, schedule: null };
    }
    return {
        yearDayIndex,
        status,
        schedule: {
            yearDayIndex: (obj !== null ? pickNumber(obj, "yearDayIndex") : null) ?? yearDayIndex,
            localStartTime,
            localEndTime,
        },
    };
}

export function decodeUserResponse(response: unknown): DoorLockUser | null {
    const obj = asObject(response);
    if (obj === null) return null;
    const userIndex = pickNumber(obj, "userIndex");
    if (userIndex === null) return null;
    const userStatus = pickNumber(obj, "userStatus");
    return {
        userIndex,
        userName: pickString(obj, "userName"),
        userStatus,
        userType: pickNumber(obj, "userType"),
        nextUserIndex: pickNumber(obj, "nextUserIndex"),
        // The spec nulls the whole record for a free slot, but locks in the field also report Available there.
        occupied: userStatus !== null && userStatus !== USER_STATUS_AVAILABLE,
    };
}

/** Encode a PIN for the octstr PinCode field, which reaches the lock as base64. */
export function encodePinCode(pin: string): string {
    return btoa(String.fromCharCode(...new TextEncoder().encode(pin)));
}

export async function readWeekDaySchedule(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    weekDayIndex: number,
    userIndex: number,
): Promise<WeekDayScheduleSlot> {
    const response = await client.deviceCommand(nodeId, endpoint, DOOR_LOCK_CLUSTER_ID, "GetWeekDaySchedule", {
        weekDayIndex,
        userIndex,
    });
    return decodeWeekDayScheduleResponse(response, weekDayIndex);
}

export async function writeWeekDaySchedule(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    userIndex: number,
    schedule: WeekDaySchedule,
): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, DOOR_LOCK_CLUSTER_ID, "SetWeekDaySchedule", {
        weekDayIndex: schedule.weekDayIndex,
        userIndex,
        daysMask: schedule.daysMask,
        startHour: schedule.startHour,
        startMinute: schedule.startMinute,
        endHour: schedule.endHour,
        endMinute: schedule.endMinute,
    });
}

export async function clearWeekDaySchedule(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    userIndex: number,
    weekDayIndex: number,
): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, DOOR_LOCK_CLUSTER_ID, "ClearWeekDaySchedule", {
        weekDayIndex,
        userIndex,
    });
}

export async function readYearDaySchedule(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    yearDayIndex: number,
    userIndex: number,
): Promise<YearDayScheduleSlot> {
    const response = await client.deviceCommand(nodeId, endpoint, DOOR_LOCK_CLUSTER_ID, "GetYearDaySchedule", {
        yearDayIndex,
        userIndex,
    });
    return decodeYearDayScheduleResponse(response, yearDayIndex);
}

export async function writeYearDaySchedule(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    userIndex: number,
    schedule: YearDaySchedule,
): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, DOOR_LOCK_CLUSTER_ID, "SetYearDaySchedule", {
        yearDayIndex: schedule.yearDayIndex,
        userIndex,
        localStartTime: schedule.localStartTime,
        localEndTime: schedule.localEndTime,
    });
}

export async function clearYearDaySchedule(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    userIndex: number,
    yearDayIndex: number,
): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, DOOR_LOCK_CLUSTER_ID, "ClearYearDaySchedule", {
        yearDayIndex,
        userIndex,
    });
}

export async function readUser(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    userIndex: number,
): Promise<DoorLockUser | null> {
    const response = await client.deviceCommand(nodeId, endpoint, DOOR_LOCK_CLUSTER_ID, "GetUser", { userIndex });
    return decodeUserResponse(response);
}

/**
 * The lock's occupied users, walked through NextUserIndex so free slots cost no round-trip.
 * `maxUsers` bounds the walk on a lock that never terminates the chain.
 */
export async function readUsers(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    maxUsers: number,
): Promise<DoorLockUser[]> {
    const users = new Array<DoorLockUser>();
    const visited = new Set<number>();
    let index: number | null = 1;
    while (index !== null && visited.size < maxUsers) {
        // A lock reporting a NextUserIndex it already served would otherwise loop here forever.
        if (visited.has(index)) break;
        visited.add(index);
        const user = await readUser(client, nodeId, endpoint, index);
        if (user === null) break;
        if (user.occupied) users.push(user);
        index = user.nextUserIndex;
    }
    return users;
}

export async function lockDoor(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    pinCode?: string,
): Promise<void> {
    const payload = pinCode ? { pinCode: encodePinCode(pinCode) } : {};
    await client.deviceCommand(nodeId, endpoint, DOOR_LOCK_CLUSTER_ID, "LockDoor", payload);
}

export async function unlockDoor(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    pinCode?: string,
): Promise<void> {
    const payload = pinCode ? { pinCode: encodePinCode(pinCode) } : {};
    await client.deviceCommand(nodeId, endpoint, DOOR_LOCK_CLUSTER_ID, "UnlockDoor", payload);
}

export async function unlockWithTimeout(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    timeoutSeconds: number,
    pinCode?: string,
): Promise<void> {
    const payload: Record<string, unknown> = { timeout: timeoutSeconds };
    if (pinCode) payload["pinCode"] = encodePinCode(pinCode);
    await client.deviceCommand(nodeId, endpoint, DOOR_LOCK_CLUSTER_ID, "UnlockWithTimeout", payload);
}
