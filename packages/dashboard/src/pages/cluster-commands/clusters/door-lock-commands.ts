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
import { css, html, nothing, type CSSResultGroup, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { showAlertDialog, showPromptDialog } from "../../../components/dialog-box/show-dialog-box.js";
import "../../../components/ha-svg-icon.js";
import { handleAsync } from "../../../util/async-handler.js";
import {
    buildDaySegments,
    clearWeekDaySchedule,
    clearYearDaySchedule,
    DAY_BITS,
    DAY_LABELS,
    DOOR_LOCK_CLUSTER_ID,
    formatDaysMask,
    formatDoorState,
    formatLocalDateTime,
    formatLockState,
    formatLockType,
    formatTimeOfDay,
    formatUserLabel,
    formatUserStatus,
    formatUserType,
    fromDateTimeInputValue,
    isFeatureActive,
    lockDoor,
    maskHasDay,
    parseTimeOfDay,
    readActuatorEnabled,
    readDoorState,
    readLockState,
    readLockType,
    readTotalUsersSupported,
    readUser,
    readUsers,
    readWeekDaySchedule,
    readWeekDaySchedulesPerUser,
    readYearDaySchedule,
    readYearDaySchedulesPerUser,
    requiresPinForRemoteOperation,
    SCHEDULE_INDEX_ALL,
    supportsCommand,
    toDateTimeInputValue,
    toggleMaskDay,
    UNLOCK_WITH_TIMEOUT_COMMAND_ID,
    unlockDoor,
    unlockWithTimeout,
    weekDayScheduleRangeError,
    writeWeekDaySchedule,
    writeYearDaySchedule,
    yearDayScheduleRangeError,
    type DoorLockUser,
    type WeekDayScheduleSlot,
    type YearDayScheduleSlot,
} from "../../../util/door-lock.js";
import { getMatterStatusName } from "../../../util/matter-status.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

const HOUR_TICKS = [0, 6, 12, 18, 24];

const DEFAULT_UNLOCK_TIMEOUT_SECONDS = 60;
const DEFAULT_START_TIME = "08:00";
const DEFAULT_END_TIME = "18:00";

/** Bounds the GetUser walk on a lock that leaves NumberOfTotalUsersSupported unreported. */
const USER_SCAN_FALLBACK = 32;

/** DlStatus the lock returns for a schedule slot that holds nothing. */
const STATUS_NOT_FOUND = 139;

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

type ScheduleEditor = WeekDayEditor | YearDayEditor;

/**
 * Command panel for the DoorLock cluster (ID: 0x0101 / 257).
 * Operates the bolt and manages the WDSCH and YDSCH access schedules of a user picked from the lock's
 * user database, which the schedule commands address by index.
 */
@customElement("door-lock-cluster-commands")
class DoorLockClusterCommands extends BaseClusterCommands {
    @state() private _users?: DoorLockUser[];
    @state() private _selectedUserIndex: number | null = null;
    @state() private _weekDaySlots?: WeekDayScheduleSlot[];
    @state() private _yearDaySlots?: YearDayScheduleSlot[];
    @state() private _loadingUsers = false;
    @state() private _loadingSchedules = false;
    @state() private _loadError?: string;
    @state() private _editor: ScheduleEditor | null = null;
    @state() private _editorError?: string;
    @state() private _busy = false;
    @state() private _pinCode = "";
    @state() private _unlockTimeout = String(DEFAULT_UNLOCK_TIMEOUT_SECONDS);

    #context?: string;
    #usersRequested = false;
    /** Bumped whenever the panel's node, endpoint or selected user changes, so stale loads drop their results. */
    #generation = 0;

    override updated(changedProperties: Map<string, unknown>) {
        super.updated(changedProperties);
        if (!this.client || !this.node || this.cluster !== DOOR_LOCK_CLUSTER_ID) return;

        const context = `${String(this.node.node_id)}/${this.endpoint}`;
        if (this.#context !== context) {
            this.#context = context;
            this.#generation++;
            this.#usersRequested = false;
            this._users = undefined;
            this._selectedUserIndex = null;
            this._weekDaySlots = undefined;
            this._yearDaySlots = undefined;
            this._loadingUsers = false;
            this._loadingSchedules = false;
            this._loadError = undefined;
            this._editor = null;
            this._editorError = undefined;
            this._busy = false;
            this._pinCode = "";
            this._unlockTimeout = String(DEFAULT_UNLOCK_TIMEOUT_SECONDS);
        }

        // The attribute cache fills in progressively, so the feature check may only pass on a later update.
        if (!this.#usersRequested && this.#schedulesSupported() && isFeatureActive(this.node, this.endpoint, "USR")) {
            this.#usersRequested = true;
            handleAsync(() => this.#loadUsers())();
        }
    }

    #schedulesSupported(): boolean {
        return isFeatureActive(this.node, this.endpoint, "WDSCH") || isFeatureActive(this.node, this.endpoint, "YDSCH");
    }

    #isCurrent(node: MatterNode, endpoint: number, generation: number): boolean {
        return this.isSameContext(node, endpoint) && this.#generation === generation;
    }

    async #loadUsers() {
        const node = this.node;
        const endpoint = this.endpoint;
        const generation = this.#generation;
        this._loadingUsers = true;
        this._loadError = undefined;
        try {
            const maxUsers = readTotalUsersSupported(node, endpoint) ?? USER_SCAN_FALLBACK;
            const users = await readUsers(this.client, node.node_id, endpoint, maxUsers);
            if (!this.#isCurrent(node, endpoint, generation)) return;
            this._users = users;
            const firstUser = users[0]?.userIndex ?? null;
            this._selectedUserIndex = firstUser;
            if (firstUser !== null) {
                await this.#loadSchedules(node, endpoint, generation, firstUser);
            }
        } catch (error) {
            if (!this.#isCurrent(node, endpoint, generation)) return;
            this._loadError = errorText(error);
        } finally {
            // Generation-scoped: a newer load has already set the flag for itself, and every path that bumps
            // the generation sets or clears it, so this cannot leave the panel wedged.
            if (this.#generation === generation) this._loadingUsers = false;
        }
    }

    async #loadSchedules(node: MatterNode, endpoint: number, generation: number, userIndex: number) {
        this._loadingSchedules = true;
        this._loadError = undefined;
        try {
            const weekDayCount = isFeatureActive(node, endpoint, "WDSCH")
                ? (readWeekDaySchedulesPerUser(node, endpoint) ?? 0)
                : 0;
            const yearDayCount = isFeatureActive(node, endpoint, "YDSCH")
                ? (readYearDaySchedulesPerUser(node, endpoint) ?? 0)
                : 0;

            const weekDaySlots = new Array<WeekDayScheduleSlot>();
            for (let index = 1; index <= weekDayCount; index++) {
                const slot = await readWeekDaySchedule(this.client, node.node_id, endpoint, index, userIndex);
                if (!this.#isCurrent(node, endpoint, generation)) return;
                weekDaySlots.push(slot);
            }

            const yearDaySlots = new Array<YearDayScheduleSlot>();
            for (let index = 1; index <= yearDayCount; index++) {
                const slot = await readYearDaySchedule(this.client, node.node_id, endpoint, index, userIndex);
                if (!this.#isCurrent(node, endpoint, generation)) return;
                yearDaySlots.push(slot);
            }

            this._weekDaySlots = weekDaySlots;
            this._yearDaySlots = yearDaySlots;

            // Setting a schedule may move the user to ScheduleRestrictedUser, so the badges are re-read
            // alongside the slots they describe.
            const user = await readUser(this.client, node.node_id, endpoint, userIndex);
            if (!this.#isCurrent(node, endpoint, generation) || user === null) return;
            this._users = this._users?.map(candidate => (candidate.userIndex === userIndex ? user : candidate));
        } catch (error) {
            if (!this.#isCurrent(node, endpoint, generation)) return;
            this._loadError = errorText(error);
        } finally {
            if (this.#generation === generation) this._loadingSchedules = false;
        }
    }

    #selectUser(userIndex: number) {
        if (userIndex === this._selectedUserIndex) return;
        this.#generation++;
        this._selectedUserIndex = userIndex;
        this._weekDaySlots = undefined;
        this._yearDaySlots = undefined;
        this._editor = null;
        this._editorError = undefined;
        this._loadError = undefined;
        handleAsync(() => this.#loadSchedules(this.node, this.endpoint, this.#generation, userIndex))();
    }

    #reloadSchedules() {
        const userIndex = this._selectedUserIndex;
        if (userIndex === null) return;
        this.#generation++;
        handleAsync(() => this.#loadSchedules(this.node, this.endpoint, this.#generation, userIndex))();
    }

    async #runScheduleCommand(title: string, run: (node: MatterNode, endpoint: number) => Promise<void>) {
        const node = this.node;
        const endpoint = this.endpoint;
        const generation = this.#generation;
        if (this._busy) return;
        this._busy = true;
        try {
            await run(node, endpoint);
            if (!this.#isCurrent(node, endpoint, generation)) return;
            this._editor = null;
            this._editorError = undefined;
            this.#reloadSchedules();
        } catch (error) {
            this.#reportFailure(title, error, node, endpoint);
        } finally {
            this._busy = false;
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

    async #operateLock(action: "lock" | "unlock") {
        const node = this.node;
        const endpoint = this.endpoint;
        if (this._busy) return;
        this._busy = true;
        try {
            const operate = action === "lock" ? lockDoor : unlockDoor;
            await operate(this.client, node.node_id, endpoint, this.#pinForCommand());
        } catch (error) {
            this.#reportFailure(action === "lock" ? "Lock failed" : "Unlock failed", error, node, endpoint);
        } finally {
            this._busy = false;
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
        this._busy = true;
        try {
            await unlockWithTimeout(this.client, node.node_id, endpoint, timeout, this.#pinForCommand());
        } catch (error) {
            this.#reportFailure("Unlock failed", error, node, endpoint);
        } finally {
            this._busy = false;
        }
    }

    #saveEditor() {
        const editor = this._editor;
        const userIndex = this._selectedUserIndex;
        if (editor === null || userIndex === null) return;

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
        if (weekDayIndex === SCHEDULE_INDEX_ALL && !(await this.#confirmClearAll("week day"))) return;
        await this.#runScheduleCommand("Clear week day schedule failed", (node, endpoint) =>
            clearWeekDaySchedule(this.client, node.node_id, endpoint, userIndex, weekDayIndex),
        );
    }

    async #clearYearDay(yearDayIndex: number) {
        const userIndex = this._selectedUserIndex;
        if (userIndex === null) return;
        if (yearDayIndex === SCHEDULE_INDEX_ALL && !(await this.#confirmClearAll("year day"))) return;
        await this.#runScheduleCommand("Clear year day schedule failed", (node, endpoint) =>
            clearYearDaySchedule(this.client, node.node_id, endpoint, userIndex, yearDayIndex),
        );
    }

    #confirmClearAll(kind: string): Promise<boolean> {
        const user = this._users?.find(candidate => candidate.userIndex === this._selectedUserIndex);
        return showPromptDialog({
            title: `Clear all ${kind} schedules`,
            text: `Every ${kind} schedule of ${user ? formatUserLabel(user) : "this user"} will be removed from the lock.`,
            confirmText: "Clear all",
        });
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
        const showPin =
            isFeatureActive(this.node, this.endpoint, "COTA") && isFeatureActive(this.node, this.endpoint, "PIN");
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
        const userActive = isFeatureActive(this.node, this.endpoint, "USR");
        const features = [weekDayActive ? "WDSCH" : undefined, yearDayActive ? "YDSCH" : undefined]
            .filter(code => code !== undefined)
            .join(" · ");

        return html`
            <details class="command-panel" open>
                <summary>
                    <ha-svg-icon .path=${mdiCalendarWeek}></ha-svg-icon>
                    Access Schedules
                    <span class="feature-map-badge">FeatureMap: ${features}</span>
                </summary>
                <div class="command-content">
                    ${
                        userActive
                            ? html`
                                  ${this.#renderUserSelector()}
                                  ${
                                      this._loadError !== undefined
                                          ? html`<p class="error">${this._loadError}</p>`
                                          : nothing
                                  }
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
        if (users !== undefined && users.length === 0) {
            return html`<p class="empty">No users are programmed on this lock.</p>`;
        }
        return html`
            <div class="command-row">
                <label for="doorLockUser">User:</label>
                <select
                    id="doorLockUser"
                    ?disabled=${this._busy || this._loadingUsers || this._loadingSchedules}
                    @change=${(event: Event) => this.#selectUser(Number((event.target as HTMLSelectElement).value))}
                >
                    ${(users ?? []).map(
                        user => html`
                            <option value=${user.userIndex} .selected=${user.userIndex === this._selectedUserIndex}>
                                #${user.userIndex} · ${formatUserLabel(user)}
                            </option>
                        `,
                    )}
                </select>
                ${this.#renderUserBadges()}
                <md-outlined-button
                    ?disabled=${this._busy || this._loadingUsers || this._loadingSchedules}
                    @click=${() => {
                        this.#usersRequested = true;
                        handleAsync(() => this.#loadUsers())();
                    }}
                >
                    <ha-svg-icon slot="icon" .path=${mdiRefresh}></ha-svg-icon>
                    Reload
                </md-outlined-button>
            </div>
        `;
    }

    #renderUserBadges(): TemplateResult | typeof nothing {
        const user = this._users?.find(candidate => candidate.userIndex === this._selectedUserIndex);
        if (user === undefined) return nothing;
        const status = formatUserStatus(user.userStatus);
        const type = formatUserType(user.userType);
        return html`
            ${status !== null ? html`<span class="meta">${status}</span>` : nothing}
            ${type !== null ? html`<span class="meta">${type}</span>` : nothing}
        `;
    }

    #renderWeekDaySection(): TemplateResult {
        const slots = this._weekDaySlots;
        const capacity = readWeekDaySchedulesPerUser(this.node, this.endpoint) ?? 0;
        const used = slots?.filter(slot => slot.schedule !== null).length ?? 0;

        return html`
            <div class="section">
                <div class="section-header">
                    <span>WEEK DAY SCHEDULES · ${used}/${capacity} slots</span>
                    ${
                        used > 0
                            ? html`<button
                                  class="link-action"
                                  ?disabled=${this._busy}
                                  @click=${handleAsync(() => this.#clearWeekDay(SCHEDULE_INDEX_ALL))}
                              >
                                  Clear all
                              </button>`
                            : nothing
                    }
                </div>
                ${
                    slots === undefined
                        ? this.#renderSlotsPlaceholder(capacity)
                        : html`
                              ${used > 0 ? this.#renderWeekTimeline(slots) : nothing}
                              <ul class="slot-list">
                                  ${slots.map(slot => this.#renderWeekDaySlot(slot))}
                              </ul>
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

    #renderWeekDaySlot(slot: WeekDayScheduleSlot): TemplateResult {
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
                        ? html`<span class="slot-empty">${slotStatusLabel(slot.status)}</span>`
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
                        ?disabled=${this._busy}
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
                                  ?disabled=${this._busy}
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
                            return html`<button
                                class="day-toggle ${maskHasDay(editor.daysMask, bit) ? "active" : ""}"
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
                        .value=${live(editor.start)}
                        @input=${(event: Event) => {
                            this._editor = { ...editor, start: (event.target as HTMLInputElement).value };
                        }}
                    />
                    <label for="weekDayEnd">To:</label>
                    <input
                        id="weekDayEnd"
                        type="time"
                        .value=${live(editor.end)}
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

        return html`
            <div class="section">
                <div class="section-header">
                    <span>YEAR DAY SCHEDULES · ${used}/${capacity} slots</span>
                    ${
                        used > 0
                            ? html`<button
                                  class="link-action"
                                  ?disabled=${this._busy}
                                  @click=${handleAsync(() => this.#clearYearDay(SCHEDULE_INDEX_ALL))}
                              >
                                  Clear all
                              </button>`
                            : nothing
                    }
                </div>
                ${
                    slots === undefined
                        ? this.#renderSlotsPlaceholder(capacity)
                        : html`
                              <ul class="slot-list">
                                  ${slots.map(slot => this.#renderYearDaySlot(slot))}
                              </ul>
                              <p class="hint">
                                  <ha-svg-icon .path=${mdiCalendarRange}></ha-svg-icon>
                                  Date ranges are local time at the lock, shown here in this browser's time zone.
                              </p>
                          `
                }
            </div>
        `;
    }

    #renderYearDaySlot(slot: YearDayScheduleSlot): TemplateResult {
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
                        ? html`<span class="slot-empty">${slotStatusLabel(slot.status)}</span>`
                        : html`<span class="slot-window wide">
                              ${formatLocalDateTime(schedule.localStartTime)} →
                              ${formatLocalDateTime(schedule.localEndTime)}
                          </span>`
                }
                <span class="slot-actions">
                    <md-outlined-icon-button
                        title=${schedule === null ? "Set schedule" : "Edit schedule"}
                        ?disabled=${this._busy}
                        @click=${() => {
                            this._editorError = undefined;
                            const now = Math.floor(Date.now() / 1000);
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
                                  ?disabled=${this._busy}
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
                        .value=${live(editor.start)}
                        @input=${(event: Event) => {
                            this._editor = { ...editor, start: (event.target as HTMLInputElement).value };
                        }}
                    />
                    <label for="yearDayEnd">To:</label>
                    <input
                        id="yearDayEnd"
                        type="datetime-local"
                        .value=${live(editor.end)}
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

    #renderEditorActions(): TemplateResult {
        return html`
            <md-outlined-button ?disabled=${this._busy} @click=${() => this.#saveEditor()}>
                <ha-svg-icon slot="icon" .path=${mdiContentSaveOutline}></ha-svg-icon>
                Save
            </md-outlined-button>
            <md-outlined-icon-button
                title="Cancel"
                @click=${() => {
                    this._editor = null;
                    this._editorError = undefined;
                }}
            >
                <ha-svg-icon .path=${mdiClose}></ha-svg-icon>
            </md-outlined-icon-button>
        `;
    }

    #renderSlotsPlaceholder(capacity: number): TemplateResult {
        if (capacity === 0) return html`<p class="empty">The lock reports no schedule slot per user.</p>`;
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

            .editor-row input {
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

function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function slotStatusLabel(status: number): string {
    return status === 0 || status === STATUS_NOT_FOUND ? "Empty" : getMatterStatusName(status);
}

registerClusterCommands(DOOR_LOCK_CLUSTER_ID, "door-lock-cluster-commands");

declare global {
    interface HTMLElementTagNameMap {
        "door-lock-cluster-commands": DoorLockClusterCommands;
    }
}
