/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/filled-button";
import "@material/web/button/outlined-button";
import "@material/web/button/text-button";
import { css, html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { showAlertDialog, showPromptDialog } from "../../../components/dialog-box/show-dialog-box.js";
import { handleAsync } from "../../../util/async-handler.js";
import { formatDuration } from "../../../util/duration.js";
import {
    clearChargingTargets,
    disableEvse,
    ENERGY_EVSE_CLUSTER_ID,
    enableCharging,
    enableDischarging,
    energyEvseInfo,
    EVSE_WEEKDAYS,
    getChargingTargets,
    setChargingTargets,
    startDiagnostics,
    type EditableChargingSchedule,
    type EditableChargingTarget,
    type EvseWeekday,
    type SessionInfo,
} from "../../../util/energy-evse.js";
import { errorText } from "../../../util/error-text.js";
import { formatEpochTime, fromLocalDateTimeInputValue } from "../../../util/time.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

const MAX_SCHEDULES = 7;
const MAX_TARGETS_PER_SCHEDULE = 10;

/** Matter only reports a status code (e.g. "Failure(1)"), not the device's reason, so name the likely cause. */
const DIAGNOSTICS_OR_ALREADY_ENABLED_HINT =
    "If the EVSE is in self-diagnostics mode, or already enabled for charging/discharging, click Disable first and try again.";

function minutesToTimeInputValue(minutes: number): string {
    const hours = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function timeInputValueToMinutes(value: string): number | undefined {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (match === null) return undefined;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours * 60 + minutes;
}

/**
 * Decoding and command panel for the EnergyEvse cluster (ID: 0x99 / 153).
 */
@customElement("energy-evse-cluster-commands")
export class EnergyEvseClusterCommands extends BaseClusterCommands {
    @state() private _busy = false;
    @state() private _formError?: string;

    @state() private _chargeNoExpiry = true;
    @state() private _chargeUntil = "";
    @state() private _minChargeCurrentA = 6;
    @state() private _maxChargeCurrentA = 16;

    @state() private _dischargeNoExpiry = true;
    @state() private _dischargeUntil = "";
    @state() private _maxDischargeCurrentA = 16;

    @state() private _schedules?: EditableChargingSchedule[];
    @state() private _scheduleBusy = false;
    @state() private _scheduleError?: string;

    #context?: string;
    /** Bumped only on a node/endpoint context change, so a command run against the old context can't clobber the new one's UI state. */
    #busyGeneration = 0;

    override willUpdate(changedProperties: PropertyValues) {
        super.willUpdate(changedProperties);
        if (!this.node || this.cluster !== ENERGY_EVSE_CLUSTER_ID) return;

        const context = `${String(this.node.node_id)}/${this.endpoint}`;
        if (this.#context === context) return;
        this.#context = context;
        this.#busyGeneration++;
        this._busy = false;
        this._formError = undefined;
        this._chargeNoExpiry = true;
        this._chargeUntil = "";
        this._dischargeNoExpiry = true;
        this._dischargeUntil = "";
        this._schedules = undefined;
        this._scheduleBusy = false;
        this._scheduleError = undefined;

        const info = energyEvseInfo(this.node.attributes, this.endpoint);
        this._minChargeCurrentA = info.minimumChargeCurrentA ?? this._minChargeCurrentA;
        this._maxChargeCurrentA = info.maximumChargeCurrentA ?? this._maxChargeCurrentA;
        this._maxDischargeCurrentA = info.maximumDischargeCurrentA ?? this._maxDischargeCurrentA;
    }

    override render() {
        if (!this.node || this.cluster !== ENERGY_EVSE_CLUSTER_ID) return nothing;
        const info = energyEvseInfo(this.node.attributes, this.endpoint);
        if (!info.supported) return nothing;

        return html`
            <details class="command-panel" open>
                <summary>Energy EVSE</summary>
                <div class="command-content">
                    <dl class="info-grid">
                        ${
                            info.state
                                ? html`<dt>State</dt>
                                      <dd>${info.state}</dd>`
                                : nothing
                        }
                        ${
                            info.supplyState
                                ? html`<dt>Supply state</dt>
                                      <dd>${info.supplyState}</dd>`
                                : nothing
                        }
                        ${
                            info.faultState
                                ? html`<dt>Fault state</dt>
                                      <dd class=${info.faultActive ? "fault" : ""}>${info.faultState}</dd>`
                                : nothing
                        }
                        ${
                            info.chargingEnabledUntil !== undefined
                                ? html`<dt>Charging enabled until</dt>
                                      <dd>
                                          ${
                                              info.chargingEnabledUntil === null
                                                  ? "No expiry"
                                                  : formatEpochTime(info.chargingEnabledUntil)
                                          }
                                      </dd>`
                                : nothing
                        }
                        ${
                            info.circuitCapacityA !== undefined
                                ? html`<dt>Circuit capacity</dt>
                                      <dd>${info.circuitCapacityA} A</dd>`
                                : nothing
                        }
                        ${
                            info.minimumChargeCurrentA !== undefined
                                ? html`<dt>Minimum charge current</dt>
                                      <dd>${info.minimumChargeCurrentA} A</dd>`
                                : nothing
                        }
                        ${
                            info.maximumChargeCurrentA !== undefined
                                ? html`<dt>Maximum charge current</dt>
                                      <dd>${info.maximumChargeCurrentA} A</dd>`
                                : nothing
                        }
                        ${
                            info.userMaximumChargeCurrentA !== undefined
                                ? html`<dt>User maximum charge current</dt>
                                      <dd>${info.userMaximumChargeCurrentA} A</dd>`
                                : nothing
                        }
                        ${
                            info.randomizationDelayWindowS !== undefined
                                ? html`<dt>Randomization delay window</dt>
                                      <dd>${formatDuration(info.randomizationDelayWindowS)}</dd>`
                                : nothing
                        }
                    </dl>

                    ${this._renderChargingActions(info.diagnosticsActive, info.canStartDiagnostics)}
                    ${this._renderSession(info.session, info.v2xSupported)}
                    ${
                        info.v2xSupported
                            ? this._renderV2x(
                                  info.dischargingEnabledUntil,
                                  info.maximumDischargeCurrentA,
                                  info.diagnosticsActive,
                              )
                            : nothing
                    }
                    ${
                        info.chargingPreferencesSupported
                            ? this._renderChargingPreferences(info, info.soCReportingSupported)
                            : nothing
                    }
                    ${
                        info.soCReportingSupported
                            ? html`
                                  <h4>Vehicle state of charge</h4>
                                  <dl class="info-grid">
                                      ${
                                          info.stateOfCharge !== undefined
                                              ? html`<dt>State of charge</dt>
                                                    <dd>
                                                        ${info.stateOfCharge === null ? "Unknown" : `${info.stateOfCharge}%`}
                                                    </dd>`
                                              : nothing
                                      }
                                      ${
                                          info.batteryCapacityKWh !== undefined
                                              ? html`<dt>Battery capacity</dt>
                                                    <dd>
                                                        ${
                                                            info.batteryCapacityKWh === null
                                                                ? "Unknown"
                                                                : `${info.batteryCapacityKWh} kWh`
                                                        }
                                                    </dd>`
                                              : nothing
                                      }
                                  </dl>
                              `
                            : nothing
                    }
                    ${
                        info.plugAndChargeSupported && info.vehicleId !== undefined
                            ? html`
                                  <h4>Plug and Charge</h4>
                                  <dl class="info-grid">
                                      <dt>Vehicle ID</dt>
                                      <dd>${info.vehicleId ?? "Unknown"}</dd>
                                  </dl>
                              `
                            : nothing
                    }
                </div>
            </details>
        `;
    }

    private _renderSession(session: SessionInfo | undefined, v2xSupported: boolean) {
        if (!session) return nothing;
        return html`
            <h4>Session</h4>
            <dl class="info-grid">
                <dt>Session ID</dt>
                <dd>${session.id}</dd>
                ${
                    session.durationS !== undefined
                        ? html`<dt>Duration</dt>
                              <dd>${formatDuration(session.durationS)}</dd>`
                        : nothing
                }
                ${
                    session.energyChargedKWh !== undefined
                        ? html`<dt>Energy charged</dt>
                              <dd>${session.energyChargedKWh} kWh</dd>`
                        : nothing
                }
                ${
                    v2xSupported && session.energyDischargedKWh !== undefined
                        ? html`<dt>Energy discharged</dt>
                              <dd>${session.energyDischargedKWh} kWh</dd>`
                        : nothing
                }
            </dl>
        `;
    }

    private _renderChargingActions(diagnosticsActive: boolean, canStartDiagnostics: boolean): TemplateResult {
        return html`
            <h4>Charging control</h4>
            <div class="command-row">
                <md-outlined-button @click=${handleAsync(() => this._handleDisable())} ?disabled=${this._busy}>
                    Disable
                </md-outlined-button>
                <md-outlined-button
                    @click=${handleAsync(() => this._handleStartDiagnostics())}
                    ?disabled=${this._busy || !canStartDiagnostics}
                    title=${canStartDiagnostics ? nothing : "Only available while charging is disabled"}
                >
                    Start Diagnostics
                </md-outlined-button>
            </div>
            <div class="action-form">
                <label class="checkbox-row">
                    <input
                        type="checkbox"
                        .checked=${this._chargeNoExpiry}
                        @change=${(e: Event) => (this._chargeNoExpiry = (e.target as HTMLInputElement).checked)}
                    />
                    No expiry
                </label>
                ${
                    !this._chargeNoExpiry
                        ? html`<input
                              type="datetime-local"
                              .value=${this._chargeUntil}
                              @input=${(e: Event) => (this._chargeUntil = (e.target as HTMLInputElement).value)}
                          />`
                        : nothing
                }
                <label>
                    Min
                    <input
                        type="number"
                        min="0"
                        step="0.1"
                        .value=${String(this._minChargeCurrentA)}
                        @input=${(e: Event) => (this._minChargeCurrentA = this.#parsePositiveNumber(e, this._minChargeCurrentA))}
                    />
                    A
                </label>
                <label>
                    Max
                    <input
                        type="number"
                        min="0"
                        step="0.1"
                        .value=${String(this._maxChargeCurrentA)}
                        @input=${(e: Event) => (this._maxChargeCurrentA = this.#parsePositiveNumber(e, this._maxChargeCurrentA))}
                    />
                    A
                </label>
                <md-filled-button
                    @click=${handleAsync(() => this._handleEnableCharging())}
                    ?disabled=${this._busy || diagnosticsActive}
                    title=${diagnosticsActive ? "Not available while self-diagnostics are active — click Disable first" : nothing}
                >
                    Enable Charging
                </md-filled-button>
            </div>
            ${this._formError !== undefined ? html`<p class="error">${this._formError}</p>` : nothing}
        `;
    }

    private _renderV2x(
        dischargingEnabledUntil: number | null | undefined,
        maximumDischargeCurrentA: number | undefined,
        diagnosticsActive: boolean,
    ): TemplateResult {
        return html`
            <h4>Bidirectional charging (V2X)</h4>
            <dl class="info-grid">
                ${
                    dischargingEnabledUntil !== undefined
                        ? html`<dt>Discharging enabled until</dt>
                              <dd>
                                  ${dischargingEnabledUntil === null ? "No expiry" : formatEpochTime(dischargingEnabledUntil)}
                              </dd>`
                        : nothing
                }
                ${
                    maximumDischargeCurrentA !== undefined
                        ? html`<dt>Maximum discharge current</dt>
                              <dd>${maximumDischargeCurrentA} A</dd>`
                        : nothing
                }
            </dl>
            <div class="action-form">
                <label class="checkbox-row">
                    <input
                        type="checkbox"
                        .checked=${this._dischargeNoExpiry}
                        @change=${(e: Event) => (this._dischargeNoExpiry = (e.target as HTMLInputElement).checked)}
                    />
                    No expiry
                </label>
                ${
                    !this._dischargeNoExpiry
                        ? html`<input
                              type="datetime-local"
                              .value=${this._dischargeUntil}
                              @input=${(e: Event) => (this._dischargeUntil = (e.target as HTMLInputElement).value)}
                          />`
                        : nothing
                }
                <label>
                    Max
                    <input
                        type="number"
                        min="0"
                        step="0.1"
                        .value=${String(this._maxDischargeCurrentA)}
                        @input=${(e: Event) =>
                            (this._maxDischargeCurrentA = this.#parsePositiveNumber(e, this._maxDischargeCurrentA))}
                    />
                    A
                </label>
                <md-filled-button
                    @click=${handleAsync(() => this._handleEnableDischarging())}
                    ?disabled=${this._busy || diagnosticsActive}
                    title=${diagnosticsActive ? "Not available while self-diagnostics are active — click Disable first" : nothing}
                >
                    Enable Discharging
                </md-filled-button>
            </div>
        `;
    }

    private _renderChargingPreferences(
        info: {
            nextChargeStartTime?: number | null;
            nextChargeTargetTime?: number | null;
            nextChargeRequiredEnergyKWh?: number | null;
            nextChargeTargetSoC?: number | null;
            approximateEvEfficiencyKmPerKWh?: number | null;
        },
        soCSupported: boolean,
    ): TemplateResult {
        return html`
            <h4>Charging preferences</h4>
            <dl class="info-grid">
                ${
                    info.nextChargeStartTime !== undefined
                        ? html`<dt>Next charge start</dt>
                              <dd>
                                  ${info.nextChargeStartTime === null ? "None scheduled" : formatEpochTime(info.nextChargeStartTime)}
                              </dd>`
                        : nothing
                }
                ${
                    info.nextChargeTargetTime !== undefined
                        ? html`<dt>Next charge target</dt>
                              <dd>
                                  ${
                                      info.nextChargeTargetTime === null
                                          ? "None scheduled"
                                          : formatEpochTime(info.nextChargeTargetTime)
                                  }
                              </dd>`
                        : nothing
                }
                ${
                    info.nextChargeRequiredEnergyKWh !== undefined
                        ? html`<dt>Next charge required energy</dt>
                              <dd>
                                  ${info.nextChargeRequiredEnergyKWh === null ? "None" : `${info.nextChargeRequiredEnergyKWh} kWh`}
                              </dd>`
                        : nothing
                }
                ${
                    info.nextChargeTargetSoC !== undefined
                        ? html`<dt>Next charge target SoC</dt>
                              <dd>${info.nextChargeTargetSoC === null ? "None" : `${info.nextChargeTargetSoC}%`}</dd>`
                        : nothing
                }
                ${
                    info.approximateEvEfficiencyKmPerKWh !== undefined
                        ? html`<dt>Approximate EV efficiency</dt>
                              <dd>
                                  ${
                                      info.approximateEvEfficiencyKmPerKWh === null
                                          ? "Unknown"
                                          : `${info.approximateEvEfficiencyKmPerKWh} km/kWh`
                                  }
                              </dd>`
                        : nothing
                }
            </dl>
            <details class="schedule-editor">
                <summary>Weekly charging schedule</summary>
                <div class="command-row">
                    <md-outlined-button
                        @click=${handleAsync(() => this._handleLoadSchedule())}
                        ?disabled=${this._scheduleBusy}
                    >
                        Load current
                    </md-outlined-button>
                    <md-outlined-button
                        @click=${handleAsync(() => this._handleClearSchedule())}
                        ?disabled=${this._scheduleBusy}
                    >
                        Clear all
                    </md-outlined-button>
                </div>
                ${
                    this._schedules === undefined
                        ? html`<p class="hint">
                              Load the schedule currently stored on the EVSE, or build a new one below.
                          </p>`
                        : nothing
                }
                ${(this._schedules ?? []).map((schedule, index) => this._renderScheduleEditor(schedule, index, soCSupported))}
                <div class="command-row">
                    <md-text-button
                        @click=${() => this._handleAddSchedule()}
                        ?disabled=${(this._schedules ?? []).length >= MAX_SCHEDULES}
                    >
                        Add schedule
                    </md-text-button>
                    <md-filled-button
                        @click=${handleAsync(() => this._handleSaveSchedule())}
                        ?disabled=${this._scheduleBusy || !this._schedules || this._schedules.length === 0}
                    >
                        Save schedule
                    </md-filled-button>
                </div>
                ${this._scheduleError !== undefined ? html`<p class="error">${this._scheduleError}</p>` : nothing}
            </details>
        `;
    }

    private _renderScheduleEditor(
        schedule: EditableChargingSchedule,
        scheduleIndex: number,
        soCSupported: boolean,
    ): TemplateResult {
        return html`
            <div class="schedule-card">
                <div class="schedule-days">
                    ${EVSE_WEEKDAYS.map(
                        ({ key, label }) => html`
                            <button
                                type="button"
                                class="day-chip ${schedule.days[key] ? "selected" : ""}"
                                aria-pressed=${schedule.days[key] ? "true" : "false"}
                                @click=${() => this._handleToggleDay(scheduleIndex, key)}
                            >
                                ${label}
                            </button>
                        `,
                    )}
                    <md-text-button @click=${() => this._handleRemoveSchedule(scheduleIndex)}>Remove</md-text-button>
                </div>
                ${schedule.targets.map((target, targetIndex) =>
                    this._renderTargetEditor(scheduleIndex, targetIndex, target, soCSupported),
                )}
                <md-text-button
                    @click=${() => this._handleAddTarget(scheduleIndex)}
                    ?disabled=${schedule.targets.length >= MAX_TARGETS_PER_SCHEDULE}
                >
                    Add target
                </md-text-button>
            </div>
        `;
    }

    private _renderTargetEditor(
        scheduleIndex: number,
        targetIndex: number,
        target: EditableChargingTarget,
        soCSupported: boolean,
    ): TemplateResult {
        return html`
            <div class="target-row">
                <input
                    type="time"
                    .value=${minutesToTimeInputValue(target.timeMinutes)}
                    @change=${(e: Event) => this._handleTargetTimeChange(scheduleIndex, targetIndex, e)}
                />
                ${
                    soCSupported
                        ? html`<label>
                              <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  .value=${target.targetSoC !== undefined ? String(target.targetSoC) : ""}
                                  @input=${(e: Event) => this._handleTargetSoCChange(scheduleIndex, targetIndex, e)}
                              />
                              % SoC
                          </label>`
                        : html`<label>
                              <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  .value=${target.addedEnergyKWh !== undefined ? String(target.addedEnergyKWh) : ""}
                                  @input=${(e: Event) => this._handleTargetEnergyChange(scheduleIndex, targetIndex, e)}
                              />
                              kWh
                          </label>`
                }
                <md-text-button @click=${() => this._handleRemoveTarget(scheduleIndex, targetIndex)}
                    >Remove</md-text-button
                >
            </div>
        `;
    }

    #parsePositiveNumber(e: Event, previous: number): number {
        const value = Number((e.target as HTMLInputElement).value);
        return Number.isFinite(value) && value >= 0 ? value : previous;
    }

    private async _handleDisable() {
        if (this._busy) return;
        const node = this.node;
        const endpoint = this.endpoint;
        const busyGeneration = this.#busyGeneration;
        this._busy = true;
        try {
            await disableEvse(this.client, node.node_id, endpoint);
        } catch (error) {
            this.#reportFailure("Disable failed", error);
        } finally {
            if (this.#busyGeneration === busyGeneration) this._busy = false;
        }
    }

    private async _handleStartDiagnostics() {
        if (this._busy) return;
        const node = this.node;
        const endpoint = this.endpoint;
        const busyGeneration = this.#busyGeneration;
        this._busy = true;
        try {
            await startDiagnostics(this.client, node.node_id, endpoint);
        } catch (error) {
            this.#reportFailure("Start diagnostics failed", error, DIAGNOSTICS_OR_ALREADY_ENABLED_HINT);
        } finally {
            if (this.#busyGeneration === busyGeneration) this._busy = false;
        }
    }

    private async _handleEnableCharging() {
        if (this._busy) return;
        this._formError = undefined;
        let chargingEnabledUntil: number | null = null;
        if (!this._chargeNoExpiry) {
            const parsed = fromLocalDateTimeInputValue(this._chargeUntil);
            if (parsed === undefined) {
                this._formError = "Enter a charging end time, or choose no expiry.";
                return;
            }
            chargingEnabledUntil = parsed;
        }
        if (this._minChargeCurrentA > this._maxChargeCurrentA) {
            this._formError = "The minimum current cannot exceed the maximum current.";
            return;
        }
        const node = this.node;
        const endpoint = this.endpoint;
        const busyGeneration = this.#busyGeneration;
        this._busy = true;
        try {
            await enableCharging(this.client, node.node_id, endpoint, {
                chargingEnabledUntil,
                minimumChargeCurrentA: this._minChargeCurrentA,
                maximumChargeCurrentA: this._maxChargeCurrentA,
            });
        } catch (error) {
            this.#reportFailure("Enable charging failed", error, DIAGNOSTICS_OR_ALREADY_ENABLED_HINT);
        } finally {
            if (this.#busyGeneration === busyGeneration) this._busy = false;
        }
    }

    private async _handleEnableDischarging() {
        if (this._busy) return;
        this._formError = undefined;
        let dischargingEnabledUntil: number | null = null;
        if (!this._dischargeNoExpiry) {
            const parsed = fromLocalDateTimeInputValue(this._dischargeUntil);
            if (parsed === undefined) {
                this._formError = "Enter a discharging end time, or choose no expiry.";
                return;
            }
            dischargingEnabledUntil = parsed;
        }
        const node = this.node;
        const endpoint = this.endpoint;
        const busyGeneration = this.#busyGeneration;
        this._busy = true;
        try {
            await enableDischarging(this.client, node.node_id, endpoint, {
                dischargingEnabledUntil,
                maximumDischargeCurrentA: this._maxDischargeCurrentA,
            });
        } catch (error) {
            this.#reportFailure("Enable discharging failed", error, DIAGNOSTICS_OR_ALREADY_ENABLED_HINT);
        } finally {
            if (this.#busyGeneration === busyGeneration) this._busy = false;
        }
    }

    /**
     * `hint` adds a line of general guidance below the raw failure: Matter only sends the controller a
     * status code (e.g. "Failure(1)"), never the descriptive reason the device logged locally.
     */
    #reportFailure(title: string, error: unknown, hint?: string) {
        const text = hint
            ? html`<p>${errorText(error)}</p>
                  <p>${hint}</p>`
            : errorText(error);
        showAlertDialog({ title, text }).catch(alertError => console.error("Failed to show alert dialog:", alertError));
    }

    private async _handleLoadSchedule() {
        if (this._scheduleBusy) return;
        const node = this.node;
        const endpoint = this.endpoint;
        const busyGeneration = this.#busyGeneration;
        this._scheduleBusy = true;
        this._scheduleError = undefined;
        try {
            const schedules = await getChargingTargets(this.client, node.node_id, endpoint);
            if (this.#busyGeneration !== busyGeneration) return;
            this._schedules = schedules;
        } catch (error) {
            if (this.#busyGeneration !== busyGeneration) return;
            this._scheduleError = errorText(error);
        } finally {
            if (this.#busyGeneration === busyGeneration) this._scheduleBusy = false;
        }
    }

    private async _handleSaveSchedule() {
        const schedules = this._schedules;
        if (!schedules || schedules.length === 0 || this._scheduleBusy) return;
        if (schedules.some(schedule => Object.values(schedule.days).every(selected => selected !== true))) {
            this._scheduleError = "Select at least one day for every schedule.";
            return;
        }
        if (schedules.some(schedule => schedule.targets.length === 0)) {
            this._scheduleError = "Add at least one target time to every schedule.";
            return;
        }
        const node = this.node;
        const endpoint = this.endpoint;
        const busyGeneration = this.#busyGeneration;
        this._scheduleBusy = true;
        this._scheduleError = undefined;
        try {
            await setChargingTargets(this.client, node.node_id, endpoint, schedules);
        } catch (error) {
            if (this.#busyGeneration !== busyGeneration) return;
            this._scheduleError = errorText(error);
        } finally {
            if (this.#busyGeneration === busyGeneration) this._scheduleBusy = false;
        }
    }

    private async _handleClearSchedule() {
        const node = this.node;
        const endpoint = this.endpoint;
        const confirmed = await showPromptDialog({
            title: "Clear charging schedule",
            text: "Every stored charging target will be removed from the EVSE.",
            confirmText: "Clear",
        });
        if (!confirmed || !this.isSameContext(node, endpoint) || this._scheduleBusy) return;
        const busyGeneration = this.#busyGeneration;
        this._scheduleBusy = true;
        this._scheduleError = undefined;
        try {
            await clearChargingTargets(this.client, node.node_id, endpoint);
            if (this.#busyGeneration !== busyGeneration) return;
            this._schedules = [];
        } catch (error) {
            if (this.#busyGeneration !== busyGeneration) return;
            this._scheduleError = errorText(error);
        } finally {
            if (this.#busyGeneration === busyGeneration) this._scheduleBusy = false;
        }
    }

    private _handleAddSchedule() {
        const schedules = this._schedules ?? [];
        if (schedules.length >= MAX_SCHEDULES) return;
        this._schedules = [...schedules, { days: {}, targets: [{ timeMinutes: 360 }] }];
    }

    private _handleRemoveSchedule(scheduleIndex: number) {
        if (!this._schedules) return;
        this._schedules = this._schedules.filter((_, index) => index !== scheduleIndex);
    }

    private _handleToggleDay(scheduleIndex: number, day: EvseWeekday) {
        this.#updateSchedule(scheduleIndex, schedule => ({
            ...schedule,
            days: { ...schedule.days, [day]: schedule.days[day] !== true },
        }));
    }

    private _handleAddTarget(scheduleIndex: number) {
        this.#updateSchedule(scheduleIndex, schedule =>
            schedule.targets.length >= MAX_TARGETS_PER_SCHEDULE
                ? schedule
                : { ...schedule, targets: [...schedule.targets, { timeMinutes: 360 }] },
        );
    }

    private _handleRemoveTarget(scheduleIndex: number, targetIndex: number) {
        this.#updateSchedule(scheduleIndex, schedule => ({
            ...schedule,
            targets: schedule.targets.filter((_, index) => index !== targetIndex),
        }));
    }

    private _handleTargetTimeChange(scheduleIndex: number, targetIndex: number, e: Event) {
        const minutes = timeInputValueToMinutes((e.target as HTMLInputElement).value);
        if (minutes === undefined) return;
        this.#updateTarget(scheduleIndex, targetIndex, target => ({ ...target, timeMinutes: minutes }));
    }

    private _handleTargetSoCChange(scheduleIndex: number, targetIndex: number, e: Event) {
        const value = Number((e.target as HTMLInputElement).value);
        const targetSoC = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : undefined;
        this.#updateTarget(scheduleIndex, targetIndex, target => ({
            timeMinutes: target.timeMinutes,
            targetSoC,
        }));
    }

    private _handleTargetEnergyChange(scheduleIndex: number, targetIndex: number, e: Event) {
        const value = Number((e.target as HTMLInputElement).value);
        const addedEnergyKWh = Number.isFinite(value) && value >= 0 ? value : undefined;
        this.#updateTarget(scheduleIndex, targetIndex, target => ({
            timeMinutes: target.timeMinutes,
            addedEnergyKWh,
        }));
    }

    #updateSchedule(scheduleIndex: number, updater: (schedule: EditableChargingSchedule) => EditableChargingSchedule) {
        if (!this._schedules) return;
        this._schedules = this._schedules.map((schedule, index) =>
            index === scheduleIndex ? updater(schedule) : schedule,
        );
    }

    #updateTarget(
        scheduleIndex: number,
        targetIndex: number,
        updater: (target: EditableChargingTarget) => EditableChargingTarget,
    ) {
        this.#updateSchedule(scheduleIndex, schedule => ({
            ...schedule,
            targets: schedule.targets.map((target, index) => (index === targetIndex ? updater(target) : target)),
        }));
    }

    static override styles: CSSResultGroup = [
        BaseClusterCommands.styles,
        css`
            h4 {
                margin: 16px 0 6px 0;
                font-size: 13px;
                color: var(--md-sys-color-on-surface-variant);
            }
            .info-grid {
                display: grid;
                /* Fixed, not auto: several separate <dl>s share this panel, and each auto-sized
                   column would size to its own widest label, misaligning the value column across sections. */
                grid-template-columns: 190px 1fr;
                gap: 6px 16px;
                margin: 0;
            }
            .info-grid dt {
                color: var(--text-color, rgba(0, 0, 0, 0.6));
                font-size: 13px;
            }
            .info-grid dd {
                margin: 0;
                font-weight: 500;
            }
            .info-grid dd.fault {
                color: var(--danger-color, #d32f2f);
            }
            .action-form {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 10px;
                margin-top: 10px;
                font-size: 13px;
            }
            .action-form label {
                display: flex;
                align-items: center;
                gap: 4px;
                color: var(--text-color, rgba(0, 0, 0, 0.6));
            }
            .action-form input[type="number"] {
                width: 64px;
                padding: 6px;
                border: 1px solid var(--md-sys-color-outline);
                border-radius: 4px;
                background: var(--md-sys-color-surface);
                color: var(--md-sys-color-on-surface);
            }
            .action-form input[type="datetime-local"] {
                padding: 6px;
                border: 1px solid var(--md-sys-color-outline);
                border-radius: 4px;
                background: var(--md-sys-color-surface);
                color: var(--md-sys-color-on-surface);
            }
            .checkbox-row {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .schedule-editor {
                margin-top: 12px;
            }
            .schedule-editor summary {
                cursor: pointer;
                color: var(--md-sys-color-primary);
                font-size: 13px;
            }
            .schedule-card {
                margin-top: 10px;
                padding: 10px;
                border-radius: 8px;
                background: var(--md-sys-color-surface-container-high);
            }
            .schedule-days {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 6px;
                margin-bottom: 8px;
            }
            .day-chip {
                border: 1px solid var(--md-sys-color-outline);
                border-radius: 16px;
                background: transparent;
                color: var(--md-sys-color-on-surface);
                padding: 4px 10px;
                font-size: 12px;
                cursor: pointer;
            }
            .day-chip.selected {
                background: var(--md-sys-color-primary);
                border-color: var(--md-sys-color-primary);
                color: var(--md-sys-color-on-primary);
            }
            .target-row {
                display: flex;
                align-items: center;
                gap: 10px;
                margin: 6px 0;
                font-size: 13px;
            }
            .target-row input[type="time"],
            .target-row input[type="number"] {
                padding: 6px;
                border: 1px solid var(--md-sys-color-outline);
                border-radius: 4px;
                background: var(--md-sys-color-surface);
                color: var(--md-sys-color-on-surface);
                width: 90px;
            }
            .hint {
                color: var(--text-color, rgba(0, 0, 0, 0.6));
                font-size: 13px;
            }
            .error {
                color: var(--danger-color);
                margin: 8px 0 0 0;
                font-size: 0.85rem;
            }
        `,
    ];
}

registerClusterCommands(ENERGY_EVSE_CLUSTER_ID, "energy-evse-cluster-commands", {
    renderWhenOffline: true,
});

declare global {
    interface HTMLElementTagNameMap {
        "energy-evse-cluster-commands": EnergyEvseClusterCommands;
    }
}
