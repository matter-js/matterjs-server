/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/filled-button";
import "@material/web/button/outlined-button";
import "@material/web/iconbutton/outlined-icon-button";
import "@material/web/progress/circular-progress";
import type { MatterNode } from "@matter-server/ws-client";
import {
    mdiAccountPlusOutline,
    mdiAccountRemoveOutline,
    mdiCalendarRange,
    mdiCalendarWeek,
    mdiClose,
    mdiContentSaveOutline,
    mdiLock,
    mdiLockOpenVariant,
    mdiPencilOutline,
    mdiPlus,
    mdiRefresh,
    mdiTrashCanOutline,
} from "@mdi/js";
import { css, html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { showAlertDialog, showPromptDialog } from "../../../components/dialog-box/show-dialog-box.js";
import "../../../components/ha-svg-icon.js";
import { handleAsync } from "../../../util/async-handler.js";
import {
    addUser,
    attachPinCredential,
    buildDaySegments,
    clearHolidaySchedule,
    clearWeekDaySchedule,
    clearYearDaySchedule,
    DAY_BITS,
    DAY_LABELS,
    DOOR_LOCK_CLUSTER_ID,
    formatDaysMask,
    formatDoorState,
    formatExpiringTimeoutHint,
    formatScheduleStatus,
    formatLockState,
    formatLockType,
    formatOperatingMode,
    formatWallClock,
    defaultHolidayMode,
    hasPinCredential,
    holidayModeChoices,
    formatTimeOfDay,
    formatUserLabel,
    formatUserStatus,
    formatUserType,
    fromDateTimeInputValue,
    holidayScheduleRangeError,
    isEmptyScheduleStatus,
    isFeatureActive,
    lockDoor,
    maskHasDay,
    nextFreeUserIndex,
    nowAsWallClock,
    parseTimeOfDay,
    pinCodeLengthError,
    readActuatorEnabled,
    readDoorState,
    readExpiringUserTimeout,
    readHolidaySchedule,
    readHolidaySchedulesSupported,
    readLockState,
    readLockType,
    readMaxPinCodeLength,
    readMinPinCodeLength,
    readNumberOfPinUsersSupported,
    readTotalUsersSupported,
    readUser,
    readUsers,
    removeUser,
    readWeekDaySchedule,
    readWeekDaySchedulesPerUser,
    readYearDaySchedule,
    readYearDaySchedulesPerUser,
    requiresPinForRemoteOperation,
    SCHEDULE_INDEX_ALL,
    supportedOperatingModes,
    supportsCommand,
    toDateTimeInputValue,
    toggleMaskDay,
    UNLOCK_WITH_TIMEOUT_COMMAND_ID,
    unlockDoor,
    unlockWithTimeout,
    userNameLengthError,
    USER_NAME_MAX_LENGTH,
    USER_STATUS_OCCUPIED_ENABLED,
    USER_TYPE_EXPIRING,
    weekDayScheduleRangeError,
    writeExpiringUserTimeout,
    writeHolidaySchedule,
    writeWeekDaySchedule,
    writeYearDaySchedule,
    yearDayScheduleRangeError,
    type DoorLockUser,
    type HolidayScheduleSlot,
    type WeekDayScheduleSlot,
    type YearDayScheduleSlot,
} from "../../../util/door-lock.js";
import { errorText } from "../../../util/error-text.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

const HOUR_TICKS = [0, 6, 12, 18, 24];

const DEFAULT_UNLOCK_TIMEOUT_SECONDS = 60;
const DEFAULT_START_TIME = "08:00";
const DEFAULT_END_TIME = "18:00";

/** The window the uint32 epoch-s wire field can represent, as `<input type="datetime-local">` bounds. */
const DATE_TIME_MIN = "2000-01-01T00:00:00";
const DATE_TIME_MAX = "2136-02-07T06:28:15";

/** Bounds the GetUser walk on a lock that leaves NumberOfTotalUsersSupported unreported. */
const USER_SCAN_FALLBACK = 32;

/** Bounds the free PIN credential slot search on a lock that leaves NumberOfPinUsersSupported unreported. */
const PIN_CREDENTIAL_SCAN_FALLBACK = 32;

/** UserTypeEnum.UnrestrictedUser — the default "Standard" choice in the add-user editor. */
const USER_TYPE_STANDARD = 0;

interface WeekDayEditor {
    kind: "weekDay";
    index: number;
    daysMask: number;
    start: string;
    end: string;
}

interface YearDayEditor {
    kind: "yearDay";
    index: number;
    start: string;
    end: string;
}

interface HolidayEditor {
    kind: "holiday";
    index: number;
    start: string;
    end: string;
    operatingMode: number;
}

type ScheduleEditor = WeekDayEditor | YearDayEditor | HolidayEditor;

/**
 * Command panel for the DoorLock cluster (ID: 0x0101 / 257).
 * Operates the bolt, manages the WDSCH and YDSCH access schedules of a user picked from the lock's user
 * database, and the lock-wide HDSCH holiday schedule table (not scoped to a user).
 */
@customElement("door-lock-cluster-commands")
class DoorLockClusterCommands extends BaseClusterCommands {
    @state() private _users?: DoorLockUser[];
    @state() private _selectedUserIndex: number | null = null;
    @state() private _weekDaySlots?: WeekDayScheduleSlot[];
    @state() private _yearDaySlots?: YearDayScheduleSlot[];
    @state() private _holidaySlots?: HolidayScheduleSlot[];
    @state() private _loadingUsers = false;
    @state() private _loadingSchedules = false;
    @state() private _loadingHoliday = false;
    @state() private _userLoadError?: string;
    @state() private _scheduleLoadError?: string;
    @state() private _holidayLoadError?: string;
    @state() private _freeUserIndex: number | null = null;
    @state() private _editor: ScheduleEditor | null = null;
    @state() private _editorError?: string;
    @state() private _addingUser = false;
    @state() private _newUserName = "";
    @state() private _newUserType = USER_TYPE_STANDARD;
    @state() private _newUserPin = "";
    @state() private _userEditorError?: string;
    @state() private _expiringTimeoutInput = "";
    @state() private _showEmptyWeekDay = false;
    @state() private _showEmptyYearDay = false;
    @state() private _showEmptyHoliday = false;
    @state() private _busy = false;
    @state() private _pinCode = "";
    @state() private _unlockTimeout = String(DEFAULT_UNLOCK_TIMEOUT_SECONDS);

    #context?: string;
    #usersRequested = false;
    #holidayRequested = false;
    /**
     * One counter per loader, bumped by that loader when it starts and by a context change. A single
     * shared counter would let an unrelated bump — picking a user, saving a schedule — strand a loader
     * that had already returned as stale, leaving its spinner and disabled buttons up for good.
     */
    #usersGeneration = 0;
    #schedulesGeneration = 0;
    #holidayGeneration = 0;
    /**
     * Bumped only on a node/endpoint context change: a lock/unlock or schedule command run against the
     * old context must not clear `_busy` for a new one.
     */
    #busyGeneration = 0;
    #freeIndexCapacity: number | null = null;
    /** The context `_expiringTimeoutInput` was last synced from the device for, so a user's own edits stick. */
    #expiringTimeoutSyncedFor: string | null = null;

    override willUpdate(changedProperties: PropertyValues) {
        super.willUpdate(changedProperties);
        if (!this.client || !this.node || this.cluster !== DOOR_LOCK_CLUSTER_ID) return;

        const context = `${String(this.node.node_id)}/${this.endpoint}`;
        if (this.#context !== context) {
            this.#context = context;
            this.#usersGeneration++;
            this.#schedulesGeneration++;
            this.#holidayGeneration++;
            this.#busyGeneration++;
            this.#usersRequested = false;
            this.#holidayRequested = false;
            this._users = undefined;
            this._selectedUserIndex = null;
            this._weekDaySlots = undefined;
            this._yearDaySlots = undefined;
            this._holidaySlots = undefined;
            this._loadingUsers = false;
            this._loadingSchedules = false;
            this._loadingHoliday = false;
            this._userLoadError = undefined;
            this._scheduleLoadError = undefined;
            this._holidayLoadError = undefined;
            this._freeUserIndex = null;
            this.#freeIndexCapacity = null;
            this._editor = null;
            this._editorError = undefined;
            this._addingUser = false;
            this._newUserName = "";
            this._newUserType = USER_TYPE_STANDARD;
            this._newUserPin = "";
            this._userEditorError = undefined;
            this._expiringTimeoutInput = "";
            this.#expiringTimeoutSyncedFor = null;
            this._showEmptyWeekDay = false;
            this._showEmptyYearDay = false;
            this._showEmptyHoliday = false;
            this._busy = false;
            this._pinCode = "";
            this._unlockTimeout = String(DEFAULT_UNLOCK_TIMEOUT_SECONDS);
        }

        // NumberOfTotalUsersSupported can arrive after the user list has already been read against
        // USER_SCAN_FALLBACK, which would leave "Add user" offering an index beyond the lock's capacity.
        const userCapacity = readTotalUsersSupported(this.node, this.endpoint);
        if (this._users !== undefined && userCapacity !== this.#freeIndexCapacity) {
            this.#freeIndexCapacity = userCapacity;
            this._freeUserIndex = nextFreeUserIndex(this._users, userCapacity ?? USER_SCAN_FALLBACK);
        }

        // Synced once per context rather than on every render, so a value the operator is mid-edit on isn't
        // clobbered by the attribute simply being re-read.
        if (this.#expiringTimeoutSyncedFor !== context) {
            const expiringTimeout = readExpiringUserTimeout(this.node, this.endpoint);
            if (expiringTimeout !== null) {
                this._expiringTimeoutInput = String(expiringTimeout);
                this.#expiringTimeoutSyncedFor = context;
            }
        }

        // The attribute cache fills in progressively: the feature bits can resolve before the numeric
        // capacity attributes the load depends on. Wait for those too, or the load runs once with fallback
        // values (32 scanned users, 0 schedule slots) and #usersRequested latches true forever, so it never
        // gets a chance to retry with the real numbers.
        if (
            !this.#usersRequested &&
            this.#perUserSchedulesSupported() &&
            isFeatureActive(this.node, this.endpoint, "USR") &&
            this.#scheduleCapacityReady()
        ) {
            this.#usersRequested = true;
            handleAsync(() => this.#loadUsers())();
        }
        // HolidaySchedules is lock-wide, not scoped to a user, so it loads independently of #loadUsers.
        if (
            !this.#holidayRequested &&
            this.#holidaySupported() &&
            readHolidaySchedulesSupported(this.node, this.endpoint) !== null
        ) {
            this.#holidayRequested = true;
            handleAsync(() => this.#loadHolidaySchedules())();
        }
    }

    /**
     * Whether the schedule-capacity attributes #loadSchedules depends on are cached yet.
     *
     * NumberOfTotalUsersSupported is deliberately not checked here: #loadUsers already has a graceful
     * fallback for it (USER_SCAN_FALLBACK), for a lock that never reports it at all — readUsers's walk
     * terminates on NextUserIndex regardless, so an oversized scan bound just costs a few harmless extra
     * round trips. WDSCH/YDSCH capacity has no such fallback: reading it as absent silently substitutes 0
     * slots, hiding a section's content entirely, so those are worth waiting for.
     */
    #scheduleCapacityReady(): boolean {
        if (
            isFeatureActive(this.node, this.endpoint, "WDSCH") &&
            readWeekDaySchedulesPerUser(this.node, this.endpoint) === null
        ) {
            return false;
        }
        if (
            isFeatureActive(this.node, this.endpoint, "YDSCH") &&
            readYearDaySchedulesPerUser(this.node, this.endpoint) === null
        ) {
            return false;
        }
        return true;
    }

    #schedulesSupported(): boolean {
        return (
            isFeatureActive(this.node, this.endpoint, "WDSCH") ||
            isFeatureActive(this.node, this.endpoint, "YDSCH") ||
            this.#holidaySupported()
        );
    }

    #perUserSchedulesSupported(): boolean {
        return isFeatureActive(this.node, this.endpoint, "WDSCH") || isFeatureActive(this.node, this.endpoint, "YDSCH");
    }

    #holidaySupported(): boolean {
        return isFeatureActive(this.node, this.endpoint, "HDSCH");
    }

    /** Whether a load started for `node`/`endpoint` at `generation` still owns its loader's counter. */
    #isCurrent(node: MatterNode, endpoint: number, generation: number, current: number): boolean {
        return this.isSameContext(node, endpoint) && generation === current;
    }

    async #loadUsers() {
        const node = this.node;
        const endpoint = this.endpoint;
        const generation = ++this.#usersGeneration;
        const previousSelection = this._selectedUserIndex;
        this._loadingUsers = true;
        this._userLoadError = undefined;
        try {
            const capacity = readTotalUsersSupported(node, endpoint);
            const maxUsers = capacity ?? USER_SCAN_FALLBACK;
            const users = await readUsers(this.client, node.node_id, endpoint, maxUsers);
            if (!this.#isCurrent(node, endpoint, generation, this.#usersGeneration)) return;
            this._users = users;
            this.#freeIndexCapacity = capacity;
            this._freeUserIndex = nextFreeUserIndex(users, maxUsers);
            // A reload is not a selection change: stay on the user the operator was inspecting.
            const selected = users.some(user => user.userIndex === previousSelection)
                ? previousSelection
                : (users[0]?.userIndex ?? null);
            this._selectedUserIndex = selected;
            if (selected !== null) {
                await this.#loadSchedules(node, endpoint, selected);
            }
        } catch (error) {
            if (!this.#isCurrent(node, endpoint, generation, this.#usersGeneration)) return;
            this._userLoadError = errorText(error);
        } finally {
            if (this.#usersGeneration === generation) this._loadingUsers = false;
        }
    }

    async #loadSchedules(node: MatterNode, endpoint: number, userIndex: number) {
        const generation = ++this.#schedulesGeneration;
        this._loadingSchedules = true;
        this._scheduleLoadError = undefined;
        try {
            const weekDayCount = isFeatureActive(node, endpoint, "WDSCH")
                ? (readWeekDaySchedulesPerUser(node, endpoint) ?? 0)
                : 0;
            const yearDayCount = isFeatureActive(node, endpoint, "YDSCH")
                ? (readYearDaySchedulesPerUser(node, endpoint) ?? 0)
                : 0;

            // One round trip per slot, so the list is published as it fills rather than at the end.
            this._weekDaySlots = [];
            this._yearDaySlots = [];

            const weekDaySlots = new Array<WeekDayScheduleSlot>();
            for (let index = 1; index <= weekDayCount; index++) {
                const slot = await readWeekDaySchedule(this.client, node.node_id, endpoint, index, userIndex);
                if (!this.#isCurrent(node, endpoint, generation, this.#schedulesGeneration)) return;
                weekDaySlots.push(slot);
                this._weekDaySlots = [...weekDaySlots];
            }

            const yearDaySlots = new Array<YearDayScheduleSlot>();
            for (let index = 1; index <= yearDayCount; index++) {
                const slot = await readYearDaySchedule(this.client, node.node_id, endpoint, index, userIndex);
                if (!this.#isCurrent(node, endpoint, generation, this.#schedulesGeneration)) return;
                yearDaySlots.push(slot);
                this._yearDaySlots = [...yearDaySlots];
            }

            // Setting a schedule may move the user to ScheduleRestrictedUser, so the badges are re-read
            // alongside the slots they describe.
            const user = await readUser(this.client, node.node_id, endpoint, userIndex);
            if (!this.#isCurrent(node, endpoint, generation, this.#schedulesGeneration) || user === null) return;
            this._users = this._users?.map(candidate => (candidate.userIndex === userIndex ? user : candidate));
        } catch (error) {
            if (!this.#isCurrent(node, endpoint, generation, this.#schedulesGeneration)) return;
            this._scheduleLoadError = errorText(error);
        } finally {
            if (this.#schedulesGeneration === generation) this._loadingSchedules = false;
        }
    }

    /** HolidaySchedules is a single lock-wide table, so unlike #loadSchedules this needs no userIndex. */
    async #loadHolidaySchedules() {
        const node = this.node;
        const endpoint = this.endpoint;
        const generation = ++this.#holidayGeneration;
        this._loadingHoliday = true;
        this._holidayLoadError = undefined;
        try {
            const capacity = readHolidaySchedulesSupported(node, endpoint) ?? 0;
            const slots = new Array<HolidayScheduleSlot>();
            this._holidaySlots = [];
            for (let index = 1; index <= capacity; index++) {
                const slot = await readHolidaySchedule(this.client, node.node_id, endpoint, index);
                if (!this.#isCurrent(node, endpoint, generation, this.#holidayGeneration)) return;
                slots.push(slot);
                this._holidaySlots = [...slots];
            }
        } catch (error) {
            if (!this.#isCurrent(node, endpoint, generation, this.#holidayGeneration)) return;
            this._holidayLoadError = errorText(error);
        } finally {
            if (this.#holidayGeneration === generation) this._loadingHoliday = false;
        }
    }

    #selectUser(userIndex: number) {
        if (userIndex === this._selectedUserIndex) return;
        this._selectedUserIndex = userIndex;
        this._weekDaySlots = undefined;
        this._yearDaySlots = undefined;
        this._showEmptyWeekDay = false;
        this._showEmptyYearDay = false;
        this._editor = null;
        this._editorError = undefined;
        this._scheduleLoadError = undefined;
        handleAsync(() => this.#loadSchedules(this.node, this.endpoint, userIndex))();
    }

    #reloadSchedules() {
        const userIndex = this._selectedUserIndex;
        if (userIndex === null) return;
        handleAsync(() => this.#loadSchedules(this.node, this.endpoint, userIndex))();
    }

    async #runScheduleCommand(title: string, run: (node: MatterNode, endpoint: number) => Promise<void>) {
        const node = this.node;
        const endpoint = this.endpoint;
        const userIndex = this._selectedUserIndex;
        if (this._busy) return;
        const busyGeneration = this.#busyGeneration;
        this._busy = true;
        try {
            await run(node, endpoint);
            if (!this.isSameContext(node, endpoint) || this._selectedUserIndex !== userIndex) return;
            this._editor = null;
            this._editorError = undefined;
            this.#reloadSchedules();
        } catch (error) {
            this.#reportFailure(title, error, node, endpoint);
        } finally {
            // busyGeneration-scoped, not schedule-generation-scoped: a lock/endpoint switch must clear this
            // for the new context, but merely picking a different user on the same lock must not let a
            // second command start while this one is still in flight.
            if (this.#busyGeneration === busyGeneration) this._busy = false;
        }
    }

    async #runHolidayCommand(title: string, run: (node: MatterNode, endpoint: number) => Promise<void>) {
        const node = this.node;
        const endpoint = this.endpoint;
        if (this._busy) return;
        const busyGeneration = this.#busyGeneration;
        this._busy = true;
        try {
            await run(node, endpoint);
            if (!this.isSameContext(node, endpoint)) return;
            this._editor = null;
            this._editorError = undefined;
            await this.#loadHolidaySchedules();
        } catch (error) {
            this.#reportFailure(title, error, node, endpoint);
        } finally {
            if (this.#busyGeneration === busyGeneration) this._busy = false;
        }
    }

    /** Only alerts while the panel still shows the node the command was sent to; the dialog names no device. */
    #reportFailure(title: string, error: unknown, node: MatterNode, endpoint: number) {
        if (!this.isSameContext(node, endpoint)) {
            console.error(`${title} (panel moved on)`, error);
            return;
        }
        showAlertDialog({ title, text: errorText(error) }).catch(alertError =>
            console.error(`Failed to show the "${title}" dialog`, alertError),
        );
    }

    #pinForCommand(): string | undefined {
        const pin = this._pinCode.trim();
        return pin === "" ? undefined : pin;
    }

    /**
     * Whether the lock supports a PIN sent in a remote Lock/Unlock/UnlockWithTimeout command at all: COTA
     * gates that (spec §5.2.4.7), independently of whether PinCredential is otherwise supported.
     */
    #pinFieldSupported(): boolean {
        return isFeatureActive(this.node, this.endpoint, "COTA") && isFeatureActive(this.node, this.endpoint, "PIN");
    }

    /**
     * Why the lock will refuse this operation without ever being asked, or undefined when it can proceed.
     * Synchronous so callers can claim `_busy` without an await in between, which would otherwise let a
     * second click through the guard. Only reports a missing PIN where one can actually be entered —
     * #pinFieldSupported() gates the field itself, so this must agree with it.
     */
    #missingRequiredPin(): string | undefined {
        if (!this.#pinFieldSupported()) return undefined;
        if (this.#pinForCommand() !== undefined) return undefined;
        if (!requiresPinForRemoteOperation(this.node, this.endpoint)) return undefined;
        return "This lock requires a PIN for remote operations.";
    }

    async #operateLock(action: "lock" | "unlock") {
        const node = this.node;
        const endpoint = this.endpoint;
        const title = action === "lock" ? "Lock failed" : "Unlock failed";
        if (this._busy) return;
        const missingPin = this.#missingRequiredPin();
        if (missingPin !== undefined) {
            await showAlertDialog({ title: "PIN required", text: missingPin });
            return;
        }
        const busyGeneration = this.#busyGeneration;
        this._busy = true;
        try {
            const operate = action === "lock" ? lockDoor : unlockDoor;
            await operate(this.client, node.node_id, endpoint, this.#pinForCommand());
        } catch (error) {
            this.#reportFailure(title, error, node, endpoint);
        } finally {
            if (this.#busyGeneration === busyGeneration) this._busy = false;
        }
    }

    async #unlockWithTimeout() {
        const node = this.node;
        const endpoint = this.endpoint;
        if (this._busy) return;
        const timeout = Number(this._unlockTimeout);
        if (!Number.isInteger(timeout) || timeout < 1 || timeout > 0xffff) {
            await showAlertDialog({ title: "Unlock failed", text: "The timeout must be 1 to 65535 seconds." });
            return;
        }
        const missingPin = this.#missingRequiredPin();
        if (missingPin !== undefined) {
            await showAlertDialog({ title: "PIN required", text: missingPin });
            return;
        }
        const busyGeneration = this.#busyGeneration;
        this._busy = true;
        try {
            await unlockWithTimeout(this.client, node.node_id, endpoint, timeout, this.#pinForCommand());
        } catch (error) {
            this.#reportFailure("Unlock failed", error, node, endpoint);
        } finally {
            if (this.#busyGeneration === busyGeneration) this._busy = false;
        }
    }

    /** Writes the lock-wide ExpiringUserTimeout attribute — how long a new Temporary PIN stays valid. */
    async #saveExpiringTimeout() {
        const node = this.node;
        const endpoint = this.endpoint;
        if (this._busy) return;
        const minutes = Number(this._expiringTimeoutInput);
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 0xffff) {
            await showAlertDialog({ title: "Invalid timeout", text: "The timeout must be 1 to 65535 minutes." });
            return;
        }
        const busyGeneration = this.#busyGeneration;
        this._busy = true;
        try {
            await writeExpiringUserTimeout(this.client, node.node_id, endpoint, minutes);
        } catch (error) {
            this.#reportFailure("Set Temporary PIN expiry failed", error, node, endpoint);
        } finally {
            if (this.#busyGeneration === busyGeneration) this._busy = false;
        }
    }

    #saveEditor() {
        const editor = this._editor;
        if (editor === null) return;

        if (editor.kind === "holiday") {
            const localStartTime = fromDateTimeInputValue(editor.start);
            const localEndTime = fromDateTimeInputValue(editor.end);
            if (localStartTime === null || localEndTime === null) {
                this._editorError = "Enter both a start and an end date.";
                return;
            }
            const schedule = {
                holidayIndex: editor.index,
                localStartTime,
                localEndTime,
                operatingMode: editor.operatingMode,
            };
            const rangeError = holidayScheduleRangeError(schedule);
            if (rangeError !== null) {
                this._editorError = rangeError;
                return;
            }
            handleAsync(() =>
                this.#runHolidayCommand("Set holiday schedule failed", (node, endpoint) =>
                    writeHolidaySchedule(this.client, node.node_id, endpoint, schedule),
                ),
            )();
            return;
        }

        const userIndex = this._selectedUserIndex;
        if (userIndex === null) return;

        if (editor.kind === "weekDay") {
            const start = parseTimeOfDay(editor.start);
            const end = parseTimeOfDay(editor.end);
            if (start === null || end === null) {
                this._editorError = "Enter both times as HH:MM.";
                return;
            }
            const schedule = {
                weekDayIndex: editor.index,
                daysMask: editor.daysMask,
                startHour: start.hour,
                startMinute: start.minute,
                endHour: end.hour,
                endMinute: end.minute,
            };
            const rangeError = weekDayScheduleRangeError(schedule);
            if (rangeError !== null) {
                this._editorError = rangeError;
                return;
            }
            handleAsync(() =>
                this.#runScheduleCommand("Set week day schedule failed", (node, endpoint) =>
                    writeWeekDaySchedule(this.client, node.node_id, endpoint, userIndex, schedule),
                ),
            )();
            return;
        }

        const localStartTime = fromDateTimeInputValue(editor.start);
        const localEndTime = fromDateTimeInputValue(editor.end);
        if (localStartTime === null || localEndTime === null) {
            this._editorError = "Enter both a start and an end date.";
            return;
        }
        const schedule = { yearDayIndex: editor.index, localStartTime, localEndTime };
        const rangeError = yearDayScheduleRangeError(schedule);
        if (rangeError !== null) {
            this._editorError = rangeError;
            return;
        }
        handleAsync(() =>
            this.#runScheduleCommand("Set year day schedule failed", (node, endpoint) =>
                writeYearDaySchedule(this.client, node.node_id, endpoint, userIndex, schedule),
            ),
        )();
    }

    async #clearWeekDay(weekDayIndex: number) {
        const userIndex = this._selectedUserIndex;
        if (userIndex === null) return;
        if (weekDayIndex === SCHEDULE_INDEX_ALL && !(await this.#confirmClearAll("week day", userIndex))) return;
        await this.#runScheduleCommand("Clear week day schedule failed", (node, endpoint) =>
            clearWeekDaySchedule(this.client, node.node_id, endpoint, userIndex, weekDayIndex),
        );
    }

    async #clearYearDay(yearDayIndex: number) {
        const userIndex = this._selectedUserIndex;
        if (userIndex === null) return;
        if (yearDayIndex === SCHEDULE_INDEX_ALL && !(await this.#confirmClearAll("year day", userIndex))) return;
        await this.#runScheduleCommand("Clear year day schedule failed", (node, endpoint) =>
            clearYearDaySchedule(this.client, node.node_id, endpoint, userIndex, yearDayIndex),
        );
    }

    /**
     * Confirms wiping `userIndex`'s whole table, and re-validates afterwards: the panel may have moved to
     * another lock or another user while the dialog was open, and confirming must not act on that one.
     */
    async #confirmClearAll(kind: string, userIndex: number): Promise<boolean> {
        const node = this.node;
        const endpoint = this.endpoint;
        const user = this._users?.find(candidate => candidate.userIndex === userIndex);
        const confirmed = await showPromptDialog({
            title: `Clear all ${kind} schedules`,
            text: `Every ${kind} schedule of ${user ? formatUserLabel(user) : "this user"} will be removed from the lock.`,
            confirmText: "Clear all",
        });
        return confirmed && this.isSameContext(node, endpoint) && this._selectedUserIndex === userIndex;
    }

    async #clearHoliday(holidayIndex: number) {
        if (holidayIndex === SCHEDULE_INDEX_ALL) {
            const node = this.node;
            const endpoint = this.endpoint;
            if (!(await this.#confirmClearAllHoliday())) return;
            if (!this.isSameContext(node, endpoint)) return;
        }
        await this.#runHolidayCommand("Clear holiday schedule failed", (node, endpoint) =>
            clearHolidaySchedule(this.client, node.node_id, endpoint, holidayIndex),
        );
    }

    #confirmClearAllHoliday(): Promise<boolean> {
        return showPromptDialog({
            title: "Clear all holiday schedules",
            text: "Every holiday schedule will be removed from the lock. This applies lock-wide, not to a single user.",
            confirmText: "Clear all",
        });
    }

    #startAddUser() {
        this._userEditorError = undefined;
        this._newUserName = "";
        this._newUserType = USER_TYPE_STANDARD;
        this._newUserPin = "";
        this._addingUser = true;
    }

    #cancelAddUser() {
        this._addingUser = false;
        this._userEditorError = undefined;
    }

    async #saveNewUser() {
        const node = this.node;
        const endpoint = this.endpoint;
        const userName = this._newUserName.trim();
        const nameError = userNameLengthError(userName);
        if (nameError !== null) {
            this._userEditorError = nameError;
            return;
        }
        const canAddExpiring = isFeatureActive(node, endpoint, "PIN") && isFeatureActive(node, endpoint, "USR");
        const expiring = canAddExpiring && this._newUserType === USER_TYPE_EXPIRING;
        const pin = this._newUserPin.trim();
        if (expiring) {
            const pinError = pinCodeLengthError(
                pin,
                readMinPinCodeLength(node, endpoint),
                readMaxPinCodeLength(node, endpoint),
            );
            if (pinError !== null) {
                this._userEditorError = pinError;
                return;
            }
        }
        const userIndex = this._freeUserIndex;
        if (userIndex === null) {
            this._userEditorError = "The lock's user database is full.";
            return;
        }
        if (this._busy) return;
        const busyGeneration = this.#busyGeneration;
        this._busy = true;
        try {
            await addUser(
                this.client,
                node.node_id,
                endpoint,
                userIndex,
                userName,
                expiring ? USER_TYPE_EXPIRING : null,
                expiring ? USER_STATUS_OCCUPIED_ENABLED : null,
            );
            if (!this.isSameContext(node, endpoint)) return;
            // The user record exists at this point regardless of what happens next, so a credential
            // failure is reported without unwinding it — the reload below must still show it. The editor
            // closes either way: leaving it open would let a retry recompute _freeUserIndex onto a new
            // slot and create a duplicate user rather than retrying the credential for this one.
            let credentialError: unknown;
            if (expiring) {
                try {
                    const capacity = readNumberOfPinUsersSupported(node, endpoint) ?? PIN_CREDENTIAL_SCAN_FALLBACK;
                    await attachPinCredential(this.client, node.node_id, endpoint, userIndex, pin, capacity);
                } catch (error) {
                    if (!this.isSameContext(node, endpoint)) return;
                    credentialError = error;
                }
            }
            this._addingUser = false;
            this._newUserName = "";
            this._newUserPin = "";
            this._userEditorError = undefined;
            this.#usersRequested = true;
            // Reload preserves the current selection, so point it at the user that was just created.
            this._selectedUserIndex = userIndex;
            this._weekDaySlots = undefined;
            this._yearDaySlots = undefined;
            await this.#loadUsers();
            if (credentialError !== undefined) {
                this.#reportFailure("User created, but the PIN could not be set", credentialError, node, endpoint);
            }
        } catch (error) {
            if (!this.isSameContext(node, endpoint)) return;
            this._userEditorError = errorText(error);
        } finally {
            if (this.#busyGeneration === busyGeneration) this._busy = false;
        }
    }

    async #removeSelectedUser() {
        const userIndex = this._selectedUserIndex;
        if (userIndex === null) return;
        // Captured before the confirmation dialog's await: if the panel moves to a different lock while it
        // is open, confirming must not delete a same-numbered user on the newly displayed lock.
        const node = this.node;
        const endpoint = this.endpoint;
        const user = this._users?.find(candidate => candidate.userIndex === userIndex);
        const confirmed = await showPromptDialog({
            title: "Remove user",
            text: `${user ? formatUserLabel(user) : "This user"} and all of its schedules will be removed from the lock.`,
            confirmText: "Remove",
        });
        if (!confirmed || !this.isSameContext(node, endpoint)) return;
        if (this._busy) return;
        const busyGeneration = this.#busyGeneration;
        this._busy = true;
        try {
            await removeUser(this.client, node.node_id, endpoint, userIndex);
            if (!this.isSameContext(node, endpoint)) return;
            this.#usersRequested = true;
            await this.#loadUsers();
        } catch (error) {
            this.#reportFailure("Remove user failed", error, node, endpoint);
        } finally {
            if (this.#busyGeneration === busyGeneration) this._busy = false;
        }
    }

    override render() {
        if (!this.node || this.cluster !== DOOR_LOCK_CLUSTER_ID) return nothing;
        return html`${this.#renderLockPanel()}${this.#schedulesSupported() ? this.#renderSchedulePanel() : nothing}`;
    }

    #renderLockPanel(): TemplateResult {
        const lockState = readLockState(this.node, this.endpoint);
        const doorState = formatDoorState(readDoorState(this.node, this.endpoint));
        const lockType = formatLockType(readLockType(this.node, this.endpoint));
        const actuatorEnabled = readActuatorEnabled(this.node, this.endpoint);
        const pinRequired = requiresPinForRemoteOperation(this.node, this.endpoint);
        const showPin = this.#pinFieldSupported();
        const showTimeout = supportsCommand(this.node, this.endpoint, UNLOCK_WITH_TIMEOUT_COMMAND_ID);

        return html`
            <details class="command-panel" open>
                <summary>
                    <ha-svg-icon .path=${lockState === 1 ? mdiLock : mdiLockOpenVariant}></ha-svg-icon>
                    Lock Control
                </summary>
                <div class="command-content">
                    <div class="status-row">
                        <span class="state-chip ${lockState === 1 ? "locked" : lockState === null ? "" : "unlocked"}">
                            ${formatLockState(lockState)}
                        </span>
                        ${doorState !== null ? html`<span class="meta">Door: ${doorState}</span>` : nothing}
                        ${lockType !== null ? html`<span class="meta">${lockType}</span>` : nothing}
                        ${actuatorEnabled === false ? html`<span class="meta warn">Actuator disabled</span>` : nothing}
                    </div>
                    <div class="command-row">
                        ${
                            showPin
                                ? html`
                                      <label for="doorLockPin">PIN${pinRequired ? " (required)" : ""}:</label>
                                      <input
                                          id="doorLockPin"
                                          type="password"
                                          autocomplete="off"
                                          .value=${live(this._pinCode)}
                                          @input=${(event: Event) => {
                                              this._pinCode = (event.target as HTMLInputElement).value;
                                          }}
                                      />
                                  `
                                : nothing
                        }
                        <md-filled-button
                            ?disabled=${this._busy}
                            @click=${handleAsync(() => this.#operateLock("lock"))}
                        >
                            <ha-svg-icon slot="icon" .path=${mdiLock}></ha-svg-icon>
                            Lock
                        </md-filled-button>
                        <md-outlined-button
                            ?disabled=${this._busy}
                            @click=${handleAsync(() => this.#operateLock("unlock"))}
                        >
                            <ha-svg-icon slot="icon" .path=${mdiLockOpenVariant}></ha-svg-icon>
                            Unlock
                        </md-outlined-button>
                        ${
                            showTimeout
                                ? html`
                                      <label for="doorLockTimeout">Timeout (s):</label>
                                      <input
                                          id="doorLockTimeout"
                                          type="number"
                                          min="1"
                                          max="65535"
                                          .value=${live(this._unlockTimeout)}
                                          @input=${(event: Event) => {
                                              this._unlockTimeout = (event.target as HTMLInputElement).value;
                                          }}
                                      />
                                      <md-outlined-button
                                          ?disabled=${this._busy}
                                          @click=${handleAsync(() => this.#unlockWithTimeout())}
                                      >
                                          Unlock with timeout
                                      </md-outlined-button>
                                  `
                                : nothing
                        }
                    </div>
                </div>
            </details>
        `;
    }

    #renderSchedulePanel(): TemplateResult {
        const weekDayActive = isFeatureActive(this.node, this.endpoint, "WDSCH");
        const yearDayActive = isFeatureActive(this.node, this.endpoint, "YDSCH");
        const holidayActive = this.#holidaySupported();
        const userActive = isFeatureActive(this.node, this.endpoint, "USR");
        const perUserActive = weekDayActive || yearDayActive;
        const features = [weekDayActive && "WDSCH", yearDayActive && "YDSCH", holidayActive && "HDSCH"].filter(
            (code): code is string => code !== false,
        );

        return html`
            <details class="command-panel" open>
                <summary>
                    <ha-svg-icon .path=${mdiCalendarWeek}></ha-svg-icon>
                    Access Schedules
                    <span class="feature-map-badge">FeatureMap: ${features.join(" · ")}</span>
                </summary>
                <div class="command-content">
                    ${this._userLoadError !== undefined ? html`<p class="error">${this._userLoadError}</p>` : nothing}
                    ${
                        this._scheduleLoadError !== undefined
                            ? html`<p class="error">${this._scheduleLoadError}</p>`
                            : nothing
                    }
                    ${
                        !perUserActive
                            ? nothing
                            : userActive
                              ? html`
                                    ${this.#renderUserSelector()}
                                    ${
                                        this._selectedUserIndex === null
                                            ? nothing
                                            : html`
                                                  ${weekDayActive ? this.#renderWeekDaySection() : nothing}
                                                  ${yearDayActive ? this.#renderYearDaySection() : nothing}
                                              `
                                    }
                                `
                              : html`<p class="empty">
                                    Schedules are assigned per user, which this lock does not expose: it reports no User
                                    (USR) feature, so its user database cannot be read.
                                </p>`
                    }
                    ${holidayActive ? this.#renderHolidaySection() : nothing}
                </div>
            </details>
        `;
    }

    #renderUserSelector(): TemplateResult {
        const users = this._users;
        if (this._loadingUsers && users === undefined) {
            return html`<div class="loading">
                <md-circular-progress indeterminate></md-circular-progress>
                Reading the user database…
            </div>`;
        }

        const busy = this._busy || this._loadingUsers || this._loadingSchedules;
        // Guessing an index the lock would reject is worse than not offering to add: SetUser constrains
        // UserIndex to NumberOfTotalUsersSupported, and USER_SCAN_FALLBACK only bounds the read walk.
        const capacityKnown = readTotalUsersSupported(this.node, this.endpoint) !== null;
        const canAddUser = users !== undefined && capacityKnown && this._freeUserIndex !== null;

        return html`
            <div class="command-row">
                ${
                    users === undefined || users.length === 0
                        ? html`<span class="empty">No users are programmed on this lock.</span>`
                        : html`
                              <label for="doorLockUser">User:</label>
                              <select
                                  id="doorLockUser"
                                  ?disabled=${busy}
                                  @change=${(event: Event) =>
                                      this.#selectUser(Number((event.target as HTMLSelectElement).value))}
                              >
                                  ${users.map(
                                      user => html`
                                          <option
                                              value=${user.userIndex}
                                              .selected=${user.userIndex === this._selectedUserIndex}
                                          >
                                              #${user.userIndex} · ${formatUserLabel(user)}
                                          </option>
                                      `,
                                  )}
                              </select>
                              ${this.#renderUserBadges()}
                              <md-outlined-icon-button
                                  title="Remove user"
                                  aria-label="Remove user"
                                  ?disabled=${busy || this._selectedUserIndex === null}
                                  @click=${handleAsync(() => this.#removeSelectedUser())}
                              >
                                  <ha-svg-icon .path=${mdiAccountRemoveOutline}></ha-svg-icon>
                              </md-outlined-icon-button>
                          `
                }
                <md-outlined-button
                    ?disabled=${busy}
                    @click=${() => {
                        this.#usersRequested = true;
                        this._editor = null;
                        this._editorError = undefined;
                        handleAsync(() => this.#loadUsers())();
                    }}
                >
                    <ha-svg-icon slot="icon" .path=${mdiRefresh}></ha-svg-icon>
                    Reload
                </md-outlined-button>
                ${
                    canAddUser
                        ? html`<md-outlined-button
                              ?disabled=${busy || this._addingUser}
                              @click=${() => this.#startAddUser()}
                          >
                              <ha-svg-icon slot="icon" .path=${mdiAccountPlusOutline}></ha-svg-icon>
                              Add user
                          </md-outlined-button>`
                        : nothing
                }
            </div>
            ${this.#renderExpiringTimeoutRow()} ${this._addingUser ? this.#renderAddUserEditor() : nothing}
        `;
    }

    /** ExpiringUserTimeout is lock-wide, not per-user, so it is edited independently of the Add user form. */
    #renderExpiringTimeoutRow(): TemplateResult | typeof nothing {
        if (readExpiringUserTimeout(this.node, this.endpoint) === null) return nothing;
        return html`
            <div class="command-row">
                <label for="expiringTimeout">Temporary PIN expiry (min):</label>
                <input
                    id="expiringTimeout"
                    type="number"
                    min="1"
                    max="65535"
                    .value=${live(this._expiringTimeoutInput)}
                    @input=${(event: Event) => {
                        this._expiringTimeoutInput = (event.target as HTMLInputElement).value;
                    }}
                />
                <md-outlined-button ?disabled=${this._busy} @click=${handleAsync(() => this.#saveExpiringTimeout())}>
                    <ha-svg-icon slot="icon" .path=${mdiContentSaveOutline}></ha-svg-icon>
                    Save
                </md-outlined-button>
            </div>
        `;
    }

    #renderAddUserEditor(): TemplateResult {
        // A Temporary PIN is created directly with a working credential (SetCredential's combined-creation
        // use case isn't used here — see attachPinCredential — but the operator still enters the PIN up
        // front), so the option only makes sense where the lock can store PIN credentials at all.
        const canAddExpiring =
            isFeatureActive(this.node, this.endpoint, "PIN") && isFeatureActive(this.node, this.endpoint, "USR");
        const expiring = canAddExpiring && this._newUserType === USER_TYPE_EXPIRING;
        const minPinLength = readMinPinCodeLength(this.node, this.endpoint);
        const maxPinLength = readMaxPinCodeLength(this.node, this.endpoint);
        return html`
            <div class="editor">
                <div class="editor-row">
                    <label for="newUserName">Name:</label>
                    <input
                        id="newUserName"
                        type="text"
                        maxlength=${USER_NAME_MAX_LENGTH}
                        .value=${live(this._newUserName)}
                        @input=${(event: Event) => {
                            this._newUserName = (event.target as HTMLInputElement).value;
                        }}
                    />
                    ${
                        canAddExpiring
                            ? html`
                                  <label for="newUserType">Type:</label>
                                  <select
                                      id="newUserType"
                                      @change=${(event: Event) => {
                                          this._newUserType = Number((event.target as HTMLSelectElement).value);
                                      }}
                                  >
                                      <option value=${USER_TYPE_STANDARD} .selected=${!expiring}>Standard</option>
                                      <option value=${USER_TYPE_EXPIRING} .selected=${expiring}>Temporary PIN</option>
                                  </select>
                              `
                            : nothing
                    }
                    <md-outlined-button ?disabled=${this._busy} @click=${handleAsync(() => this.#saveNewUser())}>
                        <ha-svg-icon slot="icon" .path=${mdiContentSaveOutline}></ha-svg-icon>
                        Save
                    </md-outlined-button>
                    <md-outlined-icon-button title="Cancel" aria-label="Cancel" @click=${() => this.#cancelAddUser()}>
                        <ha-svg-icon .path=${mdiClose}></ha-svg-icon>
                    </md-outlined-icon-button>
                </div>
                ${
                    expiring
                        ? html`
                              <div class="editor-row">
                                  <label for="newUserPin">PIN:</label>
                                  <input
                                      id="newUserPin"
                                      type="password"
                                      autocomplete="off"
                                      maxlength=${maxPinLength ?? nothing}
                                      .value=${live(this._newUserPin)}
                                      @input=${(event: Event) => {
                                          this._newUserPin = (event.target as HTMLInputElement).value;
                                      }}
                                  />
                                  ${
                                      minPinLength !== null || maxPinLength !== null
                                          ? html`<span class="meta">
                                                ${minPinLength ?? 1}–${maxPinLength ?? "?"} characters
                                            </span>`
                                          : nothing
                                  }
                              </div>
                          `
                        : nothing
                }
                ${this._userEditorError !== undefined ? html`<p class="error">${this._userEditorError}</p>` : nothing}
            </div>
        `;
    }

    #renderUserBadges(): TemplateResult | typeof nothing {
        const user = this._users?.find(candidate => candidate.userIndex === this._selectedUserIndex);
        if (user === undefined) return nothing;
        const status = formatUserStatus(user.userStatus);
        const type = formatUserType(user.userType);
        const expiringHint =
            user.userType === USER_TYPE_EXPIRING
                ? formatExpiringTimeoutHint(readExpiringUserTimeout(this.node, this.endpoint))
                : null;
        return html`
            ${status !== null ? html`<span class="meta">${status}</span>` : nothing}
            ${type !== null ? html`<span class="meta">${type}</span>` : nothing}
            ${hasPinCredential(user) ? html`<span class="meta">PIN</span>` : nothing}
            ${expiringHint !== null ? html`<span class="meta">${expiringHint}</span>` : nothing}
        `;
    }

    /**
     * Every occupied slot, plus (unless expanded) just the next empty one — so there is always a visible
     * "+" to add a schedule without listing every empty slot up front. A slot the lock failed to report
     * is never collapsed: it is not an offer to write, and hiding it would hide the failure.
     */
    #visibleSlots<T extends { schedule: unknown; status: number | null }>(slots: T[], expanded: boolean): T[] {
        if (expanded) return slots;
        let shownEmpty = false;
        return slots.filter(slot => {
            if (slot.schedule !== null || !isEmptySlot(slot)) return true;
            if (shownEmpty) return false;
            shownEmpty = true;
            return true;
        });
    }

    /** Toggle for the slot list's collapsed empty slots; hidden when there's nothing meaningful to collapse. */
    #renderEmptySlotsToggle(
        emptyTotal: number,
        expanded: boolean,
        toggle: () => void,
    ): TemplateResult | typeof nothing {
        if (emptyTotal <= 1) return nothing;
        const hiddenCount = expanded ? 0 : emptyTotal - 1;
        return html`<button class="slot-list-toggle" @click=${toggle}>
            ${expanded ? "Hide empty slots" : `Show ${hiddenCount} more empty slot${hiddenCount === 1 ? "" : "s"}`}
        </button>`;
    }

    #renderWeekDaySection(): TemplateResult {
        const slots = this._weekDaySlots;
        const capacity = readWeekDaySchedulesPerUser(this.node, this.endpoint) ?? 0;
        const used = slots?.filter(slot => slot.schedule !== null).length ?? 0;
        const expanded = this._showEmptyWeekDay;
        const loading = this._loadingSchedules;
        // Rows left over from the previous load stay on screen while the next one runs, and a failed walk
        // leaves a partial list: acting on either would address an index the panel has not read.
        const incomplete = loading || this._scheduleLoadError !== undefined;
        const busy = this._busy || incomplete;

        return html`
            <div class="section">
                <div class="section-header">
                    <span>WEEK DAY SCHEDULES · ${this.#slotCountLabel(slots, used, capacity, loading)}</span>
                    ${
                        used > 0
                            ? html`<button
                                  class="link-action"
                                  ?disabled=${busy}
                                  @click=${handleAsync(() => this.#clearWeekDay(SCHEDULE_INDEX_ALL))}
                              >
                                  Clear all
                              </button>`
                            : nothing
                    }
                </div>
                ${
                    slots === undefined || capacity === 0
                        ? this.#renderSlotsPlaceholder(capacity)
                        : html`
                              ${used > 0 ? this.#renderWeekTimeline(slots) : nothing}
                              <ul class="slot-list">
                                  ${this.#visibleSlots(slots, expanded).map(slot =>
                                      this.#renderWeekDaySlot(slot, busy),
                                  )}
                              </ul>
                              ${this.#renderEmptySlotsToggle(countEmptySlots(slots), expanded, () => {
                                  this._showEmptyWeekDay = !expanded;
                              })}
                          `
                }
            </div>
        `;
    }

    #renderWeekTimeline(slots: WeekDayScheduleSlot[]): TemplateResult {
        return html`
            <div class="schedule-grid">
                <div class="grid-ticks">
                    ${HOUR_TICKS.map(hour => html`<span>${String(hour).padStart(2, "0")}:00</span>`)}
                </div>
                ${DAY_LABELS.map((label, day) => {
                    const segments = buildDaySegments(slots, day);
                    return html`
                        <div class="grid-row ${segments.length > 0 ? "" : "dimmed"}">
                            <span class="day-label">${label}</span>
                            <div class="day-timeline">
                                ${segments.map(
                                    segment => html`
                                        <span
                                            class="segment"
                                            style=${`left:${(segment.startMin / 1440) * 100}%;width:${
                                                ((segment.endMin - segment.startMin) / 1440) * 100
                                            }%`}
                                            title=${`#${segment.weekDayIndex} · ${formatTimeOfDay(
                                                Math.floor(segment.startMin / 60),
                                                segment.startMin % 60,
                                            )}–${formatTimeOfDay(
                                                Math.floor(segment.endMin / 60),
                                                segment.endMin % 60,
                                            )}`}
                                        ></span>
                                    `,
                                )}
                            </div>
                        </div>
                    `;
                })}
            </div>
        `;
    }

    #renderWeekDaySlot(slot: WeekDayScheduleSlot, busy: boolean): TemplateResult {
        const editor = this._editor;
        if (editor?.kind === "weekDay" && editor.index === slot.weekDayIndex) {
            return html`<li class="slot-row editing">${this.#renderWeekDayEditor(editor)}</li>`;
        }
        const schedule = slot.schedule;
        return html`
            <li class="slot-row">
                <span class="slot-index">#${slot.weekDayIndex}</span>
                ${
                    schedule === null
                        ? html`<span class="slot-empty">${formatScheduleStatus(slot.status)}</span>`
                        : html`
                              <span class="slot-days">${formatDaysMask(schedule.daysMask)}</span>
                              <span class="slot-window">
                                  ${formatTimeOfDay(schedule.startHour, schedule.startMinute)}–${formatTimeOfDay(
                                      schedule.endHour,
                                      schedule.endMinute,
                                  )}
                              </span>
                          `
                }
                <span class="slot-actions">
                    <md-outlined-icon-button
                        title=${schedule === null ? "Set schedule" : "Edit schedule"}
                        aria-label=${schedule === null ? "Set schedule" : "Edit schedule"}
                        ?disabled=${busy}
                        @click=${() => {
                            this._editorError = undefined;
                            this._editor = {
                                kind: "weekDay",
                                index: slot.weekDayIndex,
                                daysMask: schedule?.daysMask ?? 0,
                                start:
                                    schedule === null
                                        ? DEFAULT_START_TIME
                                        : formatTimeOfDay(schedule.startHour, schedule.startMinute),
                                end:
                                    schedule === null
                                        ? DEFAULT_END_TIME
                                        : formatTimeOfDay(schedule.endHour, schedule.endMinute),
                            };
                        }}
                    >
                        <ha-svg-icon .path=${schedule === null ? mdiPlus : mdiPencilOutline}></ha-svg-icon>
                    </md-outlined-icon-button>
                    ${
                        schedule === null
                            ? nothing
                            : html`<md-outlined-icon-button
                                  title="Clear schedule"
                                  aria-label="Clear schedule"
                                  ?disabled=${busy}
                                  @click=${handleAsync(() => this.#clearWeekDay(slot.weekDayIndex))}
                              >
                                  <ha-svg-icon .path=${mdiTrashCanOutline}></ha-svg-icon>
                              </md-outlined-icon-button>`
                    }
                </span>
            </li>
        `;
    }

    #renderWeekDayEditor(editor: WeekDayEditor): TemplateResult {
        return html`
            <div class="editor">
                <div class="editor-row">
                    <span class="slot-index">#${editor.index}</span>
                    <div class="day-toggles">
                        ${DAY_LABELS.map((label, day) => {
                            const bit = DAY_BITS[day];
                            const active = maskHasDay(editor.daysMask, bit);
                            return html`<button
                                class="day-toggle ${active ? "active" : ""}"
                                aria-pressed=${active ? "true" : "false"}
                                @click=${() => {
                                    this._editor = { ...editor, daysMask: toggleMaskDay(editor.daysMask, bit) };
                                }}
                            >
                                ${label}
                            </button>`;
                        })}
                    </div>
                </div>
                <div class="editor-row">
                    <label for="weekDayStart">From:</label>
                    <input
                        id="weekDayStart"
                        type="time"
                        .value=${editor.start}
                        @input=${(event: Event) => {
                            this._editor = { ...editor, start: (event.target as HTMLInputElement).value };
                        }}
                    />
                    <label for="weekDayEnd">To:</label>
                    <input
                        id="weekDayEnd"
                        type="time"
                        .value=${editor.end}
                        @input=${(event: Event) => {
                            this._editor = { ...editor, end: (event.target as HTMLInputElement).value };
                        }}
                    />
                    ${this.#renderEditorActions()}
                </div>
                ${this._editorError !== undefined ? html`<p class="error">${this._editorError}</p>` : nothing}
            </div>
        `;
    }

    #renderYearDaySection(): TemplateResult {
        const slots = this._yearDaySlots;
        const capacity = readYearDaySchedulesPerUser(this.node, this.endpoint) ?? 0;
        const used = slots?.filter(slot => slot.schedule !== null).length ?? 0;
        const expanded = this._showEmptyYearDay;
        const loading = this._loadingSchedules;
        const incomplete = loading || this._scheduleLoadError !== undefined;
        const busy = this._busy || incomplete;

        return html`
            <div class="section">
                <div class="section-header">
                    <span>YEAR DAY SCHEDULES · ${this.#slotCountLabel(slots, used, capacity, loading)}</span>
                    ${
                        used > 0
                            ? html`<button
                                  class="link-action"
                                  ?disabled=${busy}
                                  @click=${handleAsync(() => this.#clearYearDay(SCHEDULE_INDEX_ALL))}
                              >
                                  Clear all
                              </button>`
                            : nothing
                    }
                </div>
                ${
                    slots === undefined || capacity === 0
                        ? this.#renderSlotsPlaceholder(capacity)
                        : html`
                              <ul class="slot-list">
                                  ${this.#visibleSlots(slots, expanded).map(slot =>
                                      this.#renderYearDaySlot(slot, busy),
                                  )}
                              </ul>
                              ${this.#renderEmptySlotsToggle(countEmptySlots(slots), expanded, () => {
                                  this._showEmptyYearDay = !expanded;
                              })}
                              <p class="hint">
                                  <ha-svg-icon .path=${mdiCalendarRange}></ha-svg-icon>
                                  Date ranges are the lock's own local time, shown here unchanged rather than converted
                                  into this browser's time zone.
                              </p>
                          `
                }
            </div>
        `;
    }

    #renderYearDaySlot(slot: YearDayScheduleSlot, busy: boolean): TemplateResult {
        const editor = this._editor;
        if (editor?.kind === "yearDay" && editor.index === slot.yearDayIndex) {
            return html`<li class="slot-row editing">${this.#renderYearDayEditor(editor)}</li>`;
        }
        const schedule = slot.schedule;
        return html`
            <li class="slot-row">
                <span class="slot-index">#${slot.yearDayIndex}</span>
                ${
                    schedule === null
                        ? html`<span class="slot-empty">${formatScheduleStatus(slot.status)}</span>`
                        : html`<span class="slot-window wide">
                              ${formatWallClock(schedule.localStartTime)} → ${formatWallClock(schedule.localEndTime)}
                          </span>`
                }
                <span class="slot-actions">
                    <md-outlined-icon-button
                        title=${schedule === null ? "Set schedule" : "Edit schedule"}
                        aria-label=${schedule === null ? "Set schedule" : "Edit schedule"}
                        ?disabled=${busy}
                        @click=${() => {
                            this._editorError = undefined;
                            const now = nowAsWallClock();
                            this._editor = {
                                kind: "yearDay",
                                index: slot.yearDayIndex,
                                start: toDateTimeInputValue(schedule?.localStartTime ?? now),
                                end: toDateTimeInputValue(schedule?.localEndTime ?? now + 86400),
                            };
                        }}
                    >
                        <ha-svg-icon .path=${schedule === null ? mdiPlus : mdiPencilOutline}></ha-svg-icon>
                    </md-outlined-icon-button>
                    ${
                        schedule === null
                            ? nothing
                            : html`<md-outlined-icon-button
                                  title="Clear schedule"
                                  aria-label="Clear schedule"
                                  ?disabled=${busy}
                                  @click=${handleAsync(() => this.#clearYearDay(slot.yearDayIndex))}
                              >
                                  <ha-svg-icon .path=${mdiTrashCanOutline}></ha-svg-icon>
                              </md-outlined-icon-button>`
                    }
                </span>
            </li>
        `;
    }

    #renderYearDayEditor(editor: YearDayEditor): TemplateResult {
        return html`
            <div class="editor">
                <div class="editor-row">
                    <span class="slot-index">#${editor.index}</span>
                    <label for="yearDayStart">From:</label>
                    <input
                        id="yearDayStart"
                        type="datetime-local"
                        step="1"
                        min=${DATE_TIME_MIN}
                        max=${DATE_TIME_MAX}
                        .value=${editor.start}
                        @input=${(event: Event) => {
                            this._editor = { ...editor, start: (event.target as HTMLInputElement).value };
                        }}
                    />
                    <label for="yearDayEnd">To:</label>
                    <input
                        id="yearDayEnd"
                        type="datetime-local"
                        step="1"
                        min=${DATE_TIME_MIN}
                        max=${DATE_TIME_MAX}
                        .value=${editor.end}
                        @input=${(event: Event) => {
                            this._editor = { ...editor, end: (event.target as HTMLInputElement).value };
                        }}
                    />
                    ${this.#renderEditorActions()}
                </div>
                ${this._editorError !== undefined ? html`<p class="error">${this._editorError}</p>` : nothing}
            </div>
        `;
    }

    #renderHolidaySection(): TemplateResult {
        const slots = this._holidaySlots;
        const capacity = readHolidaySchedulesSupported(this.node, this.endpoint) ?? 0;
        const used = slots?.filter(slot => slot.schedule !== null).length ?? 0;
        const loading = this._loadingHoliday;
        const incomplete = loading || this._holidayLoadError !== undefined;
        const busy = this._busy || incomplete;
        const expanded = this._showEmptyHoliday;

        return html`
            <div class="section">
                <div class="section-header">
                    <span>HOLIDAY SCHEDULES · ${this.#slotCountLabel(slots, used, capacity, loading)}</span>
                    ${
                        used > 0
                            ? html`<button
                                  class="link-action"
                                  ?disabled=${busy}
                                  @click=${handleAsync(() => this.#clearHoliday(SCHEDULE_INDEX_ALL))}
                              >
                                  Clear all
                              </button>`
                            : nothing
                    }
                </div>
                ${this._holidayLoadError !== undefined ? html`<p class="error">${this._holidayLoadError}</p>` : nothing}
                ${
                    slots === undefined || capacity === 0
                        ? this.#renderSlotsPlaceholder(capacity)
                        : html`
                              <ul class="slot-list">
                                  ${this.#visibleSlots(slots, expanded).map(slot => this.#renderHolidaySlot(slot, busy))}
                              </ul>
                              ${this.#renderEmptySlotsToggle(countEmptySlots(slots), expanded, () => {
                                  this._showEmptyHoliday = !expanded;
                              })}
                              <p class="hint">
                                  <ha-svg-icon .path=${mdiCalendarRange}></ha-svg-icon>
                                  Applies to the whole lock, not a single user. Date ranges are the lock's own local
                                  time, shown here unchanged rather than converted into this browser's time zone.
                              </p>
                          `
                }
            </div>
        `;
    }

    #renderHolidaySlot(slot: HolidayScheduleSlot, busy: boolean): TemplateResult {
        const editor = this._editor;
        if (editor?.kind === "holiday" && editor.index === slot.holidayIndex) {
            return html`<li class="slot-row editing">${this.#renderHolidayEditor(editor)}</li>`;
        }
        const schedule = slot.schedule;
        return html`
            <li class="slot-row">
                <span class="slot-index">#${slot.holidayIndex}</span>
                ${
                    schedule === null
                        ? html`<span class="slot-empty">${formatScheduleStatus(slot.status)}</span>`
                        : html`<span class="slot-window wide">
                              ${formatWallClock(schedule.localStartTime)} → ${formatWallClock(schedule.localEndTime)} ·
                              ${formatOperatingMode(schedule.operatingMode)}
                          </span>`
                }
                <span class="slot-actions">
                    <md-outlined-icon-button
                        title=${schedule === null ? "Set schedule" : "Edit schedule"}
                        aria-label=${schedule === null ? "Set schedule" : "Edit schedule"}
                        ?disabled=${busy}
                        @click=${() => {
                            this._editorError = undefined;
                            const now = nowAsWallClock();
                            this._editor = {
                                kind: "holiday",
                                index: slot.holidayIndex,
                                start: toDateTimeInputValue(schedule?.localStartTime ?? now),
                                end: toDateTimeInputValue(schedule?.localEndTime ?? now + 86400),
                                operatingMode:
                                    schedule?.operatingMode ??
                                    defaultHolidayMode(supportedOperatingModes(this.node, this.endpoint)),
                            };
                        }}
                    >
                        <ha-svg-icon .path=${schedule === null ? mdiPlus : mdiPencilOutline}></ha-svg-icon>
                    </md-outlined-icon-button>
                    ${
                        schedule === null
                            ? nothing
                            : html`<md-outlined-icon-button
                                  title="Clear schedule"
                                  aria-label="Clear schedule"
                                  ?disabled=${busy}
                                  @click=${handleAsync(() => this.#clearHoliday(slot.holidayIndex))}
                              >
                                  <ha-svg-icon .path=${mdiTrashCanOutline}></ha-svg-icon>
                              </md-outlined-icon-button>`
                    }
                </span>
            </li>
        `;
    }

    #renderHolidayEditor(editor: HolidayEditor): TemplateResult {
        return html`
            <div class="editor">
                <div class="editor-row">
                    <span class="slot-index">#${editor.index}</span>
                    <label for="holidayStart">From:</label>
                    <input
                        id="holidayStart"
                        type="datetime-local"
                        step="1"
                        min=${DATE_TIME_MIN}
                        max=${DATE_TIME_MAX}
                        .value=${editor.start}
                        @input=${(event: Event) => {
                            this._editor = { ...editor, start: (event.target as HTMLInputElement).value };
                        }}
                    />
                    <label for="holidayEnd">To:</label>
                    <input
                        id="holidayEnd"
                        type="datetime-local"
                        step="1"
                        min=${DATE_TIME_MIN}
                        max=${DATE_TIME_MAX}
                        .value=${editor.end}
                        @input=${(event: Event) => {
                            this._editor = { ...editor, end: (event.target as HTMLInputElement).value };
                        }}
                    />
                    <label for="holidayMode">Mode:</label>
                    <select
                        id="holidayMode"
                        @change=${(event: Event) => {
                            this._editor = {
                                ...editor,
                                operatingMode: Number((event.target as HTMLSelectElement).value),
                            };
                        }}
                    >
                        ${holidayModeChoices(
                            supportedOperatingModes(this.node, this.endpoint),
                            editor.operatingMode,
                        ).map(
                            mode => html`<option value=${mode} .selected=${mode === editor.operatingMode}>
                                ${formatOperatingMode(mode)}
                            </option>`,
                        )}
                    </select>
                    ${this.#renderEditorActions()}
                </div>
                ${this._editorError !== undefined ? html`<p class="error">${this._editorError}</p>` : nothing}
            </div>
        `;
    }

    #renderEditorActions(): TemplateResult {
        return html`
            <md-outlined-button ?disabled=${this._busy} @click=${() => this.#saveEditor()}>
                <ha-svg-icon slot="icon" .path=${mdiContentSaveOutline}></ha-svg-icon>
                Save
            </md-outlined-button>
            <md-outlined-icon-button
                title="Cancel"
                aria-label="Cancel"
                @click=${() => {
                    this._editor = null;
                    this._editorError = undefined;
                }}
            >
                <ha-svg-icon .path=${mdiClose}></ha-svg-icon>
            </md-outlined-icon-button>
        `;
    }

    #slotCountLabel(slots: { length: number } | undefined, used: number, capacity: number, loading: boolean): string {
        if (loading && slots !== undefined && slots.length < capacity) {
            return `reading ${slots.length + 1} of ${capacity}…`;
        }
        return `${used}/${capacity} slots`;
    }

    #renderSlotsPlaceholder(capacity: number): TemplateResult {
        if (capacity === 0) return html`<p class="empty">The lock reports no schedule slots.</p>`;
        return html`<div class="loading">
            <md-circular-progress indeterminate></md-circular-progress>
            Reading ${capacity} slots…
        </div>`;
    }

    static override styles: CSSResultGroup = [
        BaseClusterCommands.styles,
        css`
            :host {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .feature-map-badge {
                margin-left: auto;
                font-size: 0.75rem;
                font-weight: 400;
                color: var(--md-sys-color-on-surface-variant);
            }

            .status-row {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 8px 12px;
                margin-bottom: 12px;
            }

            .state-chip {
                padding: 4px 12px;
                border-radius: 8px;
                font-weight: 500;
                background: var(--md-sys-color-surface-container-highest);
                color: var(--md-sys-color-on-surface);
            }

            .state-chip.locked {
                background: var(--md-sys-color-secondary-container);
                color: var(--md-sys-color-on-secondary-container);
            }

            .state-chip.unlocked {
                background: color-mix(in srgb, var(--danger-color) 18%, transparent);
                color: var(--md-sys-color-on-surface);
            }

            .meta {
                font-size: 0.8rem;
                color: var(--md-sys-color-on-surface-variant);
            }

            .meta.warn {
                color: var(--danger-color);
            }

            .command-row input[type="password"],
            .command-row input[type="time"],
            .command-row input[type="datetime-local"] {
                padding: 8px;
                border: 1px solid var(--md-sys-color-outline);
                border-radius: 4px;
                background: var(--md-sys-color-surface);
                color: var(--md-sys-color-on-surface);
                font: inherit;
            }

            .command-row select {
                padding: 8px;
                border: 1px solid var(--md-sys-color-outline);
                border-radius: 4px;
                background: var(--md-sys-color-surface);
                color: var(--md-sys-color-on-surface);
                font: inherit;
            }

            .section {
                margin-top: 16px;
            }

            .section-header {
                display: flex;
                align-items: center;
                gap: 12px;
                font-weight: 500;
                font-size: 0.8rem;
                letter-spacing: 0.04em;
                color: var(--md-sys-color-on-surface-variant);
                margin-bottom: 8px;
            }

            .link-action {
                margin-left: auto;
                border: none;
                background: none;
                padding: 0;
                font: inherit;
                font-size: 0.75rem;
                letter-spacing: 0.04em;
                color: var(--danger-color);
                cursor: pointer;
            }

            .link-action[disabled] {
                opacity: 0.5;
                cursor: default;
            }

            .slot-list-toggle {
                display: block;
                margin: 4px 0 0 0;
                border: none;
                background: none;
                padding: 0;
                font: inherit;
                font-size: 0.75rem;
                letter-spacing: 0.04em;
                color: var(--md-sys-color-primary);
                cursor: pointer;
            }

            .schedule-grid {
                margin-bottom: 12px;
            }

            .grid-ticks {
                display: flex;
                justify-content: space-between;
                font-size: 0.7rem;
                color: var(--md-sys-color-on-surface-variant);
                padding: 0 0 4px 48px;
            }

            .grid-row {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 2px 0;
            }

            .grid-row.dimmed {
                opacity: 0.45;
            }

            .day-label {
                width: 40px;
                flex-shrink: 0;
                font-size: 0.8rem;
                font-weight: 500;
            }

            .grid-row:not(.dimmed) .day-label {
                font-weight: 700;
                color: var(--md-sys-color-on-surface);
            }

            .day-timeline {
                position: relative;
                flex: 1;
                height: 18px;
                border-radius: 4px;
                overflow: hidden;
                background: var(--md-sys-color-surface-container-highest);
            }

            .segment {
                position: absolute;
                top: 0;
                bottom: 0;
                min-width: 2px;
                background: var(--md-sys-color-primary);
            }

            .slot-list {
                list-style: none;
                margin: 0;
                padding: 0;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .slot-row {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 8px 12px;
                border-radius: 8px;
                background: var(--md-sys-color-surface-container-highest);
            }

            .slot-row.editing {
                background: var(--md-sys-color-surface-container-high);
            }

            .slot-index {
                font-family: var(--monospace-font);
                font-size: 0.8rem;
                color: var(--md-sys-color-on-surface-variant);
                width: 28px;
                flex-shrink: 0;
            }

            .slot-days {
                min-width: 104px;
                font-weight: 500;
            }

            .slot-window {
                font-family: var(--monospace-font);
                color: var(--md-sys-color-on-surface-variant);
            }

            .slot-window.wide {
                flex: 1;
            }

            .slot-empty {
                flex: 1;
                font-style: italic;
                color: var(--md-sys-color-on-surface-variant);
            }

            .slot-actions {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                margin-left: auto;
                flex-shrink: 0;
            }

            .slot-actions md-outlined-icon-button {
                --md-outlined-icon-button-container-height: 32px;
                --md-outlined-icon-button-container-width: 32px;
                --md-outlined-icon-button-icon-size: 16px;
            }

            .editor {
                display: flex;
                flex-direction: column;
                gap: 8px;
                width: 100%;
            }

            .editor-row {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 8px;
            }

            .editor-row label {
                font-size: 14px;
                color: var(--md-sys-color-on-surface-variant);
            }

            .editor-row input,
            .editor-row select {
                padding: 6px 8px;
                border: 1px solid var(--md-sys-color-outline);
                border-radius: 4px;
                background: var(--md-sys-color-surface);
                color: var(--md-sys-color-on-surface);
                font: inherit;
            }

            .day-toggles {
                display: inline-flex;
                flex-wrap: wrap;
                gap: 4px;
            }

            .day-toggle {
                padding: 4px 10px;
                border-radius: 8px;
                border: 1px solid var(--md-sys-color-outline);
                background: transparent;
                color: var(--md-sys-color-on-surface-variant);
                font: inherit;
                font-size: 0.8rem;
                cursor: pointer;
            }

            .day-toggle.active {
                background: var(--md-sys-color-secondary-container);
                color: var(--md-sys-color-on-secondary-container);
                border-color: transparent;
            }

            .loading {
                display: flex;
                align-items: center;
                gap: 12px;
                color: var(--md-sys-color-on-surface-variant);
                font-size: 0.9rem;
            }

            .loading md-circular-progress {
                --md-circular-progress-size: 24px;
            }

            .hint {
                display: flex;
                align-items: center;
                gap: 6px;
                margin: 8px 0 0 0;
                font-size: 0.75rem;
                color: var(--md-sys-color-on-surface-variant);
            }

            .hint ha-svg-icon {
                --mdc-icon-size: 14px;
            }

            .empty {
                color: var(--md-sys-color-on-surface-variant);
                margin: 0;
            }

            .error {
                color: var(--danger-color);
                margin: 8px 0 0 0;
                font-size: 0.85rem;
            }
        `,
    ];
}

function isEmptySlot(slot: { schedule: unknown; status: number | null }): boolean {
    return slot.schedule === null && isEmptyScheduleStatus(slot.status);
}

function countEmptySlots(slots: { schedule: unknown; status: number | null }[]): number {
    return slots.filter(isEmptySlot).length;
}

registerClusterCommands(DOOR_LOCK_CLUSTER_ID, "door-lock-cluster-commands");

declare global {
    interface HTMLElementTagNameMap {
        "door-lock-cluster-commands": DoorLockClusterCommands;
    }
}
