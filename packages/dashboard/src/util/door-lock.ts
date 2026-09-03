/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterClient, MatterNode } from "@matter-server/ws-client";
import { clusters } from "../client/models/descriptions.js";
import { asObject, pickArray, pickNumber, pickString } from "./attribute-shapes.js";
import { computeActiveClusterFeatures } from "./cluster-features.js";
import { getMatterStatusName, requireAttributeWriteSuccess } from "./matter-status.js";
import { MATTER_EPOCH_MAX_SECONDS, MATTER_EPOCH_OFFSET_SECONDS } from "./time.js";

/** Door Lock cluster (Matter spec §5.2). */
export const DOOR_LOCK_CLUSTER_ID = 257; // 0x0101

const ATTR_LOCK_STATE = 0x00;
const ATTR_LOCK_TYPE = 0x01;
const ATTR_ACTUATOR_ENABLED = 0x02;
const ATTR_DOOR_STATE = 0x03;
const ATTR_NUMBER_OF_TOTAL_USERS_SUPPORTED = 0x11;
const ATTR_NUMBER_OF_PIN_USERS_SUPPORTED = 0x12;
const ATTR_NUMBER_OF_WEEK_DAY_SCHEDULES_SUPPORTED_PER_USER = 0x14;
const ATTR_NUMBER_OF_YEAR_DAY_SCHEDULES_SUPPORTED_PER_USER = 0x15;
const ATTR_NUMBER_OF_HOLIDAY_SCHEDULES_SUPPORTED = 0x16;
const ATTR_MAX_PIN_CODE_LENGTH = 0x17;
const ATTR_MIN_PIN_CODE_LENGTH = 0x18;
const ATTR_SUPPORTED_OPERATING_MODES = 0x26;
const ATTR_REQUIRE_PIN_FOR_REMOTE_OPERATION = 0x33;
const ATTR_EXPIRING_USER_TIMEOUT = 0x35;
const ATTR_ACCEPTED_COMMAND_LIST = 0xfff9;
const ATTR_FEATURE_MAP = 0xfffc;

/** UnlockWithTimeout is optional even on locks that support unlocking (spec §5.2.10.3). */
export const UNLOCK_WITH_TIMEOUT_COMMAND_ID = 0x03;

/**
 * Wipes every slot of the addressed table: a user's week day or year day schedules, or — since the
 * holiday table is lock-wide — every holiday schedule on the lock.
 */
export const SCHEDULE_INDEX_ALL = 0xfe;

/** UserStatusEnum.Available — a slot the lock reports as free (spec §5.2.6.17). */
const USER_STATUS_AVAILABLE = 0;

/** DataOperationTypeEnum.Add — the SetUser/SetCredential operation that creates a new entry (spec §5.2.6.10). */
const OPERATION_TYPE_ADD = 0;

/** UserTypeEnum.ExpiringUser — access expires ExpiringUserTimeout minutes after the credential's first use. */
export const USER_TYPE_EXPIRING = 7;

/** UserStatusEnum.OccupiedEnabled — the status a newly created, active user is given (spec §5.2.6.17). */
export const USER_STATUS_OCCUPIED_ENABLED = 1;

/** CredentialTypeEnum.PIN — the only credential type this panel manages (spec §5.2.6.9). */
const CREDENTIAL_TYPE_PIN = 1;

/** SetUser's UserName constraint (spec §5.2.10.34.3), enforced here instead of round-tripping it. */
export const USER_NAME_MAX_LENGTH = 10;

/**
 * Why the lock will reject this PIN, or null when it will accept it. `minLength`/`maxLength` are the lock's
 * own MinPinCodeLength/MaxPinCodeLength, unknown on a lock that doesn't report them — in that case only
 * non-emptiness is checked, same fallback as the schedule capacity attributes elsewhere in this file.
 */
export function pinCodeLengthError(pin: string, minLength: number | null, maxLength: number | null): string | null {
    if (pin === "") return "Enter a PIN.";
    const length = new TextEncoder().encode(pin).length;
    if (minLength !== null && length < minLength) return `The PIN must be at least ${minLength} bytes.`;
    if (maxLength !== null && length > maxLength) return `The PIN must be at most ${maxLength} bytes.`;
    return null;
}

/**
 * Why the lock will reject this user name, or null when it will accept it. The constraint counts UTF-8
 * bytes, so a name well inside the character limit can still be too long.
 */
export function userNameLengthError(userName: string): string | null {
    if (userName === "") return "Enter a name for the user.";
    if (new TextEncoder().encode(userName).length > USER_NAME_MAX_LENGTH) {
        return `The name may be at most ${USER_NAME_MAX_LENGTH} bytes; accented and non-Latin characters take more than one.`;
    }
    return null;
}

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

/** OperatingModeEnum values a Holiday schedule may switch the lock to (spec §5.2.6.15). */
const OPERATING_MODE_LABELS: Record<number, string> = {
    0: "Normal",
    1: "Vacation",
    2: "Privacy",
    3: "No Remote Lock/Unlock",
    4: "Passage",
};

const OPERATING_MODES = [0, 1, 2, 3, 4];

/** OperatingModeEnum.Normal, the only mode every lock must implement. */
const OPERATING_MODE_NORMAL = 0;

/** OperatingModeEnum.Vacation, what a holiday schedule is normally for. */
const OPERATING_MODE_VACATION = 1;

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

/** The interaction-model status of a slot the lock holds nothing in (spec §5.2.10.6.3). */
export const SCHEDULE_STATUS_NOT_FOUND = 0x8b;

/** A Week Day schedule slot holding a window, as reported by GetWeekDayScheduleResponse. */
export interface WeekDaySchedule {
    weekDayIndex: number;
    daysMask: number;
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
}

/**
 * One of a user's schedule slots. `schedule` is null when the lock reported a non-success status or
 * omitted the window.
 *
 * `status` is null when the lock did not say what the slot holds: either no status came back, or it
 * answered SUCCESS without the fields that must accompany it ("If this field is SUCCESS, the optional
 * fields for this command shall be present", spec §5.2.10.6.3). Such a slot reads as unread, and is
 * never collapsed away among the empty ones.
 */
export interface WeekDayScheduleSlot {
    weekDayIndex: number;
    status: number | null;
    schedule: WeekDaySchedule | null;
}

/**
 * A Year Day schedule slot holding a fixed date range. Both bounds are Matter epoch-s (seconds since
 * 2000-01-01) encoding the lock's *local wall clock* rather than a UTC instant, per the spec's "Epoch
 * Time in Seconds with local time offset" — so they are neither Unix seconds nor a viewer-relative time.
 */
export interface YearDaySchedule {
    yearDayIndex: number;
    localStartTime: number;
    localEndTime: number;
}

export interface YearDayScheduleSlot {
    yearDayIndex: number;
    status: number | null;
    schedule: YearDaySchedule | null;
}

/**
 * A Holiday schedule slot: unlike WDSCH/YDSCH, holidays are not scoped to a user — they apply to the whole
 * lock — and switch it to `operatingMode` for the duration of the date range.
 */
export interface HolidaySchedule {
    holidayIndex: number;
    localStartTime: number;
    localEndTime: number;
    operatingMode: number;
}

export interface HolidayScheduleSlot {
    holidayIndex: number;
    status: number | null;
    schedule: HolidaySchedule | null;
}

export interface UserCredential {
    credentialType: number;
    credentialIndex: number;
}

export interface DoorLockUser {
    userIndex: number;
    userName: string | null;
    userStatus: number | null;
    userType: number | null;
    nextUserIndex: number | null;
    occupied: boolean;
    credentials: UserCredential[];
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

/** Unlike WDSCH/YDSCH, HolidaySchedules is a lock-wide table: it is not scoped to a user. */
export function readHolidaySchedulesSupported(node: MatterNode, endpoint: number): number | null {
    return readNumberAttr(node, endpoint, ATTR_NUMBER_OF_HOLIDAY_SCHEDULES_SUPPORTED);
}

export function readNumberOfPinUsersSupported(node: MatterNode, endpoint: number): number | null {
    return readNumberAttr(node, endpoint, ATTR_NUMBER_OF_PIN_USERS_SUPPORTED);
}

export function readMinPinCodeLength(node: MatterNode, endpoint: number): number | null {
    return readNumberAttr(node, endpoint, ATTR_MIN_PIN_CODE_LENGTH);
}

export function readMaxPinCodeLength(node: MatterNode, endpoint: number): number | null {
    return readNumberAttr(node, endpoint, ATTR_MAX_PIN_CODE_LENGTH);
}

/**
 * Minutes an ExpiringUser's credential remains valid after its first use, lock-wide rather than per-user
 * (spec §5.2.9.36). Absent on a lock that doesn't support ExpiringUser at all.
 */
export function readExpiringUserTimeout(node: MatterNode, endpoint: number): number | null {
    return readNumberAttr(node, endpoint, ATTR_EXPIRING_USER_TIMEOUT);
}

export async function writeExpiringUserTimeout(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    minutes: number,
): Promise<void> {
    requireAttributeWriteSuccess(
        await client.writeAttribute(
            nodeId,
            `${endpoint}/${DOOR_LOCK_CLUSTER_ID}/${ATTR_EXPIRING_USER_TIMEOUT}`,
            minutes,
        ),
        "Writing the Expiring User Timeout attribute failed",
    );
}

export function requiresPinForRemoteOperation(node: MatterNode, endpoint: number): boolean {
    return readAttr(node, endpoint, ATTR_REQUIRE_PIN_FOR_REMOTE_OPERATION) === true;
}

/**
 * The operating modes a Holiday schedule may switch this lock to. OperatingModesBitmap is inverted —
 * a bit set to zero means the mode IS supported, which the spec itself calls out as "the opposite of
 * most other semantically similar bitmaps" (spec §5.2.9.25).
 */
export function supportedOperatingModes(node: MatterNode, endpoint: number): number[] {
    const bitmap = readNumberAttr(node, endpoint, ATTR_SUPPORTED_OPERATING_MODES);
    if (bitmap === null) return [...OPERATING_MODES];
    const supported = OPERATING_MODES.filter(mode => (bitmap & (1 << mode)) === 0);
    return supported.length > 0 ? supported : [...OPERATING_MODES];
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

export function formatOperatingMode(mode: number | null): string | null {
    if (mode === null) return null;
    return OPERATING_MODE_LABELS[mode] ?? `Mode ${mode}`;
}

/**
 * The modes a holiday mode picker offers. A mode the lock already stored is always among them even when
 * SupportedOperatingModes no longer advertises it: an option list that cannot represent the current value
 * leaves a `<select>` showing its first entry while a save still writes the old one.
 */
export function holidayModeChoices(supported: number[], current: number): number[] {
    return supported.includes(current) ? supported : [current, ...supported];
}

export function defaultHolidayMode(supported: number[]): number {
    if (supported.includes(OPERATING_MODE_VACATION)) return OPERATING_MODE_VACATION;
    return supported[0] ?? OPERATING_MODE_NORMAL;
}

export function formatUserStatus(status: number | null): string | null {
    if (status === null) return null;
    return USER_STATUS_LABELS[status] ?? `Status ${status}`;
}

export function formatUserType(type: number | null): string | null {
    if (type === null) return null;
    return USER_TYPE_LABELS[type] ?? `Type ${type}`;
}

/** Whether the lock answered for this slot and reported it as holding nothing. */
export function isEmptyScheduleStatus(status: number | null): boolean {
    return status === 0 || status === SCHEDULE_STATUS_NOT_FOUND;
}

export function formatScheduleStatus(status: number | null): string {
    if (status === null) return "Unreadable";
    if (isEmptyScheduleStatus(status)) return "Empty";
    return getMatterStatusName(status);
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

/** Accepts the `HH:MM:SS` an `<input type="time">` emits at second precision; the cluster has no seconds. */
export function parseTimeOfDay(value: string): { hour: number; minute: number } | null {
    const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
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

function dateRangeError(localStartTime: number, localEndTime: number): string | null {
    if (!Number.isFinite(localStartTime) || !Number.isFinite(localEndTime)) {
        return "Enter both a start and an end date.";
    }
    // Outside this the value no longer fits the uint32 epoch-s field the cluster carries it in.
    for (const bound of [localStartTime, localEndTime]) {
        if (!Number.isInteger(bound) || bound < 0 || bound > MATTER_EPOCH_MAX_SECONDS) {
            return "Dates must fall between 2000-01-01 and 2136-02-07.";
        }
    }
    if (localEndTime <= localStartTime) return "The end date must be later than the start date.";
    return null;
}

/** Why the date range cannot be set as entered, or null when it is valid. */
export function yearDayScheduleRangeError(schedule: Omit<YearDaySchedule, "yearDayIndex">): string | null {
    return dateRangeError(schedule.localStartTime, schedule.localEndTime);
}

/** Why the holiday schedule cannot be set as entered, or null when it is valid. */
export function holidayScheduleRangeError(schedule: Omit<HolidaySchedule, "holidayIndex">): string | null {
    return dateRangeError(schedule.localStartTime, schedule.localEndTime);
}

const pad = (value: number) => String(value).padStart(2, "0");

/** The instant whose UTC components spell out the wall clock `matterEpochSeconds` encodes. */
function wallClockOf(matterEpochSeconds: number): Date {
    return new Date((matterEpochSeconds + MATTER_EPOCH_OFFSET_SECONDS) * 1000);
}

/** Encodes a wall clock, as the lock encodes its own: UTC components, shifted to the Matter epoch. */
function toMatterEpoch(year: number, month: number, day: number, hour: number, minute: number, second: number) {
    return Math.floor(Date.UTC(year, month - 1, day, hour, minute, second) / 1000) - MATTER_EPOCH_OFFSET_SECONDS;
}

/** Reads the browser's wall clock, encoded the way the lock encodes its own local time. */
export function nowAsWallClock(): number {
    const now = new Date();
    return toMatterEpoch(
        now.getFullYear(),
        now.getMonth() + 1,
        now.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
    );
}

/** Formats the lock's wall clock for display. Deliberately not shifted into the viewer's time zone. */
export function formatWallClock(matterEpochSeconds: number): string {
    return wallClockOf(matterEpochSeconds).toLocaleString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
    });
}

/** Formats the lock's wall clock for an `<input type="datetime-local">`, keeping seconds when it has any. */
export function toDateTimeInputValue(matterEpochSeconds: number): string {
    const date = wallClockOf(matterEpochSeconds);
    const minutes = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
    const seconds = date.getUTCSeconds();
    return seconds === 0 ? minutes : `${minutes}:${pad(seconds)}`;
}

/**
 * Reads an `<input type="datetime-local">` value back as the lock's wall clock, or null when it is
 * empty, malformed, or names a day that does not exist.
 */
export function fromDateTimeInputValue(value: string): number | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
    if (match === null) return null;
    const [year, month, day, hour, minute] = match.slice(1, 6).map(Number);
    const second = match[6] === undefined ? 0 : Number(match[6]);
    if (hour > 23 || minute > 59 || second > 59) return null;
    const matterEpochSeconds = toMatterEpoch(year, month, day, hour, minute, second);
    const roundTrip = wallClockOf(matterEpochSeconds);
    // Date.UTC rolls 2026-02-30 forward into March rather than rejecting it.
    if (
        roundTrip.getUTCFullYear() !== year ||
        roundTrip.getUTCMonth() + 1 !== month ||
        roundTrip.getUTCDate() !== day
    ) {
        return null;
    }
    return matterEpochSeconds;
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
    const status = obj !== null ? pickNumber(obj, "status") : null;
    if (obj === null || status !== 0) {
        return { weekDayIndex, status, schedule: null };
    }
    const daysMask = pickNumber(obj, "daysMask");
    const startHour = pickNumber(obj, "startHour");
    const startMinute = pickNumber(obj, "startMinute");
    const endHour = pickNumber(obj, "endHour");
    const endMinute = pickNumber(obj, "endMinute");
    if (daysMask === null || startHour === null || startMinute === null || endHour === null || endMinute === null) {
        return { weekDayIndex, status: null, schedule: null };
    }
    return {
        weekDayIndex,
        status,
        schedule: {
            weekDayIndex: pickNumber(obj, "weekDayIndex") ?? weekDayIndex,
            daysMask,
            startHour,
            startMinute,
            endHour,
            endMinute,
        },
    };
}

export function decodeYearDayScheduleResponse(response: unknown, yearDayIndex: number): YearDayScheduleSlot {
    const obj = asObject(response);
    const status = obj !== null ? pickNumber(obj, "status") : null;
    const localStartTime = obj !== null ? pickNumber(obj, "localStartTime") : null;
    const localEndTime = obj !== null ? pickNumber(obj, "localEndTime") : null;
    if (status === 0 && (localStartTime === null || localEndTime === null)) {
        return { yearDayIndex, status: null, schedule: null };
    }
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

export function decodeHolidayScheduleResponse(response: unknown, holidayIndex: number): HolidayScheduleSlot {
    const obj = asObject(response);
    const status = obj !== null ? pickNumber(obj, "status") : null;
    const localStartTime = obj !== null ? pickNumber(obj, "localStartTime") : null;
    const localEndTime = obj !== null ? pickNumber(obj, "localEndTime") : null;
    const operatingMode = obj !== null ? pickNumber(obj, "operatingMode") : null;
    if (status === 0 && (localStartTime === null || localEndTime === null || operatingMode === null)) {
        return { holidayIndex, status: null, schedule: null };
    }
    if (status !== 0 || localStartTime === null || localEndTime === null || operatingMode === null) {
        return { holidayIndex, status, schedule: null };
    }
    return {
        holidayIndex,
        status,
        schedule: {
            holidayIndex: (obj !== null ? pickNumber(obj, "holidayIndex") : null) ?? holidayIndex,
            localStartTime,
            localEndTime,
            operatingMode,
        },
    };
}

function decodeCredentials(obj: Record<string, unknown>): UserCredential[] {
    return pickArray(obj, "credentials").flatMap(entry => {
        const obj = asObject(entry);
        if (obj === null) return [];
        const credentialType = pickNumber(obj, "credentialType");
        const credentialIndex = pickNumber(obj, "credentialIndex");
        if (credentialType === null || credentialIndex === null) return [];
        return [{ credentialType, credentialIndex }];
    });
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
        credentials: decodeCredentials(obj),
    };
}

/** Whether a user carries a working PIN credential, as opposed to just a UserType badge. */
export function hasPinCredential(user: DoorLockUser): boolean {
    return user.credentials.some(credential => credential.credentialType === CREDENTIAL_TYPE_PIN);
}

/** The lock-wide ExpiringUserTimeout, phrased for display next to an ExpiringUser's badge. */
export function formatExpiringTimeoutHint(minutes: number | null): string | null {
    if (minutes === null) return null;
    return `Disables ${minutes} min after first PIN use`;
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

export async function readHolidaySchedule(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    holidayIndex: number,
): Promise<HolidayScheduleSlot> {
    const response = await client.deviceCommand(nodeId, endpoint, DOOR_LOCK_CLUSTER_ID, "GetHolidaySchedule", {
        holidayIndex,
    });
    return decodeHolidayScheduleResponse(response, holidayIndex);
}

export async function writeHolidaySchedule(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    schedule: HolidaySchedule,
): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, DOOR_LOCK_CLUSTER_ID, "SetHolidaySchedule", {
        holidayIndex: schedule.holidayIndex,
        localStartTime: schedule.localStartTime,
        localEndTime: schedule.localEndTime,
        operatingMode: schedule.operatingMode,
    });
}

export async function clearHolidaySchedule(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    holidayIndex: number,
): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, DOOR_LOCK_CLUSTER_ID, "ClearHolidaySchedule", { holidayIndex });
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

/** The lowest user index in `[1, maxUsers]` not already occupied, or null when the user database is full. */
export function nextFreeUserIndex(users: DoorLockUser[], maxUsers: number): number | null {
    const occupied = new Set(users.map(user => user.userIndex));
    for (let index = 1; index <= maxUsers; index++) {
        if (!occupied.has(index)) return index;
    }
    return null;
}

export async function addUser(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    userIndex: number,
    userName: string,
    userType: number | null = null,
    userStatus: number | null = null,
): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, DOOR_LOCK_CLUSTER_ID, "SetUser", {
        operationType: OPERATION_TYPE_ADD,
        userIndex,
        userName,
        userUniqueId: null,
        userStatus,
        userType,
        credentialRule: null,
    });
}

function decodeSetCredentialResponse(response: unknown): { status: number | null; userIndex: number | null } {
    const obj = asObject(response);
    return {
        status: obj !== null ? pickNumber(obj, "status") : null,
        userIndex: obj !== null ? pickNumber(obj, "userIndex") : null,
    };
}

function decodeCredentialStatusResponse(response: unknown): {
    credentialExists: boolean;
    nextCredentialIndex: number | null;
} {
    const obj = asObject(response);
    return {
        credentialExists: obj !== null && obj["credentialExists"] === true,
        nextCredentialIndex: obj !== null ? pickNumber(obj, "nextCredentialIndex") : null,
    };
}

async function getCredentialStatus(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    credentialType: number,
    credentialIndex: number,
) {
    const response = await client.deviceCommand(nodeId, endpoint, DOOR_LOCK_CLUSTER_ID, "GetCredentialStatus", {
        credential: { credentialType, credentialIndex },
    });
    return decodeCredentialStatusResponse(response);
}

/**
 * The lowest unoccupied PIN credential index in `[1, maxIndex]`, or null when every slot is taken.
 * Mirrors nextFreeUserIndex/readUsers: GetCredentialStatus's NextCredentialIndex chains through the
 * *occupied* slots only, so free slots are never queried directly — they are whatever is left over once
 * the occupied ones are collected.
 */
async function nextFreePinCredentialIndex(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    maxIndex: number,
): Promise<number | null> {
    const occupied = new Set<number>();
    // Visited is tracked separately from occupied: a lock reporting NextCredentialIndex values that never
    // flag as existing (malformed, or genuinely free slots surfaced by mistake) must not loop forever just
    // because `occupied` never grows.
    const visited = new Set<number>();
    let index: number | null = 1;
    while (index !== null && visited.size <= maxIndex) {
        if (visited.has(index)) break;
        visited.add(index);
        const status = await getCredentialStatus(client, nodeId, endpoint, CREDENTIAL_TYPE_PIN, index);
        if (status.credentialExists) occupied.add(index);
        index = status.nextCredentialIndex;
    }
    for (let candidate = 1; candidate <= maxIndex; candidate++) {
        if (!occupied.has(candidate)) return candidate;
    }
    return null;
}

/**
 * Attaches a PIN credential to an existing user (SetCredential's "add a credential to an existing user"
 * use case — UserIndex given, UserStatus/UserType left null since the user already has both). `capacity`
 * bounds the free-slot search, e.g. `readNumberOfPinUsersSupported(node, endpoint) ?? PIN_CREDENTIAL_SCAN_FALLBACK`.
 */
export async function attachPinCredential(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    userIndex: number,
    pin: string,
    capacity: number,
): Promise<void> {
    const credentialIndex = await nextFreePinCredentialIndex(client, nodeId, endpoint, capacity);
    if (credentialIndex === null) {
        throw new Error("The lock's PIN credential database is full.");
    }
    const response = await client.deviceCommand(nodeId, endpoint, DOOR_LOCK_CLUSTER_ID, "SetCredential", {
        operationType: OPERATION_TYPE_ADD,
        credential: { credentialType: CREDENTIAL_TYPE_PIN, credentialIndex },
        credentialData: encodePinCode(pin),
        userIndex,
        userStatus: null,
        userType: null,
    });
    const { status } = decodeSetCredentialResponse(response);
    if (status !== 0) {
        throw new Error(status === null ? "The lock did not report a result." : getMatterStatusName(status));
    }
}

export async function removeUser(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
    userIndex: number,
): Promise<void> {
    await client.deviceCommand(nodeId, endpoint, DOOR_LOCK_CLUSTER_ID, "ClearUser", { userIndex });
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
