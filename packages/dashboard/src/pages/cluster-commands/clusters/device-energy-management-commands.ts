/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, html, nothing, type CSSResultGroup, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import {
    DEVICE_ENERGY_MANAGEMENT_CLUSTER_ID,
    deviceEnergyManagementInfo,
    formatEnergy,
    formatPower,
    type DeviceEnergyManagementInfo,
    type ForecastInfo,
    type ForecastSlotInfo,
} from "../../../util/device-energy-management.js";
import { formatDuration } from "../../../util/duration.js";
import { formatEpochTime } from "../../../util/time.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

const SLOT_MARKERS: Record<ForecastSlotInfo["status"], string> = {
    completed: "✓",
    active: "●",
    scheduled: "○",
};

const STATUS_LABELS: Record<ForecastSlotInfo["status"], string> = {
    completed: "Completed",
    active: "Running",
    scheduled: "Scheduled",
};

/**
 * Read-only decoding panel for the DeviceEnergyManagement cluster (ID: 0x98 / 152), centred on the
 * Forecast attribute: what each slot of the plan draws or generates, and what the whole plan costs.
 */
@customElement("device-energy-management-cluster-commands")
export class DeviceEnergyManagementClusterCommands extends BaseClusterCommands {
    override render() {
        if (!this.node || this.cluster !== DEVICE_ENERGY_MANAGEMENT_CLUSTER_ID) return nothing;
        const info = deviceEnergyManagementInfo(this.node.attributes, this.endpoint);
        if (!info.supported) return nothing;

        return html`
            <details class="command-panel" open>
                <summary>Device Energy Management</summary>
                <div class="command-content">
                    ${this._renderHeader(info)} ${this._renderForecast(info)} ${this._renderDeviceLimits(info)}
                </div>
            </details>
        `;
    }

    private _renderHeader(info: DeviceEnergyManagementInfo): TemplateResult {
        const reporting = info.features.powerForecastReporting
            ? "Power forecast"
            : info.features.stateForecastReporting
              ? "State forecast"
              : undefined;
        const slotCount = info.forecast?.slots.length ?? 0;
        const active = info.forecast?.activeSlotNumber;
        const position = active !== undefined && slotCount > 0 ? `slot ${active + 1} of ${slotCount}` : undefined;

        return html`
            <p class="esa-header">
                <b>${info.esaType ?? "Energy smart appliance"}</b>
                <span class="esa-meta">
                    ${[info.esaState, reporting, position].filter(part => part !== undefined).join(" · ")}
                </span>
            </p>
        `;
    }

    private _renderForecast(info: DeviceEnergyManagementInfo): TemplateResult | typeof nothing {
        const forecast = info.forecast;
        if (!forecast) return html`<p class="empty">No forecast published.</p>`;

        return html`
            ${this._renderWindow(forecast)}
            ${
                forecast.slots.length > 0
                    ? html`<ol class="slots">
                          ${forecast.slots.map(slot => this._renderSlot(slot, info))}
                      </ol>`
                    : html`<p class="empty">The forecast carries no slots.</p>`
            }
            ${this._renderTotals(forecast)} ${this._renderForecastMeta(forecast)}
        `;
    }

    private _renderWindow(forecast: ForecastInfo): TemplateResult | typeof nothing {
        if (forecast.startTime === undefined) return nothing;
        const end = forecast.endTime !== undefined ? html`–${formatEpochTime(forecast.endTime)}` : nothing;
        const flexibility =
            forecast.earliestStartTime !== undefined || forecast.latestEndTime !== undefined
                ? html`<span class="flexibility">
                      can shift within
                      ${
                          forecast.earliestStartTime !== undefined
                              ? formatEpochTime(forecast.earliestStartTime)
                              : "start"
                      }–${forecast.latestEndTime !== undefined ? formatEpochTime(forecast.latestEndTime) : "end"}
                  </span>`
                : nothing;

        return html`
            <div class="window">
                <span class="window-range">${formatEpochTime(forecast.startTime)}${end}</span>
                ${
                    forecast.durationSeconds !== undefined
                        ? html`<span class="window-duration">${formatDuration(forecast.durationSeconds)}</span>`
                        : nothing
                }
                ${flexibility}
            </div>
        `;
    }

    private _renderSlot(slot: ForecastSlotInfo, info: DeviceEnergyManagementInfo): TemplateResult {
        return html`
            <li class="slot ${slot.status}">
                <span class="marker" aria-hidden="true">${SLOT_MARKERS[slot.status]}</span>
                <div class="slot-main">
                    <div class="slot-title">
                        <span class="slot-name">Slot ${slot.index + 1}</span>
                        ${
                            slot.startTime !== undefined
                                ? html`<span class="slot-time">
                                      ${formatEpochTime(slot.startTime)}${
                                          slot.endTime !== undefined ? `–${formatEpochTime(slot.endTime)}` : ""
                                      }
                                  </span>`
                                : nothing
                        }
                        ${
                            slot.manufacturerEsaState !== undefined
                                ? html`<span class="chip" title="Manufacturer-defined ESA state">
                                      state ${slot.manufacturerEsaState}
                                  </span>`
                                : nothing
                        }
                        ${slot.pausable === true ? html`<span class="chip">pausable</span>` : nothing}
                    </div>
                    <div class="slot-sub">${this._slotDetail(slot)}</div>
                    ${
                        this._slotAdjustment(slot) !== undefined
                            ? html`<div class="slot-sub">${this._slotAdjustment(slot)}</div>`
                            : nothing
                    }
                    ${
                        slot.costs.length > 0
                            ? html`<div class="slot-sub">
                                  ${slot.costs
                                      .map(cost => `${cost.type}${cost.amount !== undefined ? ` ${cost.amount}` : ""}`)
                                      .join(" · ")}
                              </div>`
                            : nothing
                    }
                </div>
                <div class="slot-power">${this._slotPower(slot, info)}</div>
            </li>
        `;
    }

    /** Duration and energy for the slot; the running one shows its live clock instead of the plan. */
    private _slotDetail(slot: ForecastSlotInfo): string {
        const parts = new Array<string>();
        parts.push(STATUS_LABELS[slot.status]);
        if (slot.status === "active" && slot.elapsedSeconds !== undefined && slot.remainingSeconds !== undefined) {
            parts.push(
                `${formatDuration(slot.elapsedSeconds)} elapsed`,
                `${formatDuration(slot.remainingSeconds)} left`,
            );
        } else if (slot.durationSeconds !== undefined) {
            parts.push(formatDuration(slot.durationSeconds));
        }
        if (slot.energyWh !== undefined) {
            parts.push(`${formatEnergy(Math.abs(slot.energyWh))}${slot.energyEstimated ? " est." : ""}`);
        }
        return parts.join(" · ");
    }

    /** How far a shiftable load says this slot may be moved, under the ForecastAdjustment feature. */
    private _slotAdjustment(slot: ForecastSlotInfo): string | undefined {
        const parts = new Array<string>();
        if (slot.minPowerAdjustmentW !== undefined && slot.maxPowerAdjustmentW !== undefined) {
            parts.push(`power ${formatPower(slot.minPowerAdjustmentW)}–${formatPower(slot.maxPowerAdjustmentW)}`);
        }
        if (slot.minDurationAdjustmentSeconds !== undefined && slot.maxDurationAdjustmentSeconds !== undefined) {
            parts.push(
                `duration ${formatDuration(slot.minDurationAdjustmentSeconds)}–${formatDuration(
                    slot.maxDurationAdjustmentSeconds,
                )}`,
            );
        }
        return parts.length > 0 ? `Adjustable: ${parts.join(" · ")}` : undefined;
    }

    /** Nominal draw when the device commits to one, otherwise the band it stays inside. */
    private _slotPower(slot: ForecastSlotInfo, info: DeviceEnergyManagementInfo): TemplateResult | typeof nothing {
        const generating = (slot.nominalPowerW ?? slot.energyWh ?? slot.minPowerW ?? slot.maxPowerW ?? 0) < 0;
        const value =
            slot.nominalPowerW !== undefined
                ? formatPower(Math.abs(slot.nominalPowerW))
                : slot.minPowerW !== undefined && slot.maxPowerW !== undefined
                  ? generating
                      ? `${formatPower(Math.abs(slot.maxPowerW))}–${formatPower(Math.abs(slot.minPowerW))}`
                      : `${formatPower(Math.abs(slot.minPowerW))}–${formatPower(Math.abs(slot.maxPowerW))}`
                  : undefined;
        if (value === undefined) return nothing;
        return html`
            <span class=${generating ? "generating" : "consuming"}>${value}</span>
            ${
                generating || info.canGenerate === true
                    ? html`<span class="direction">${generating ? "out" : "in"}</span>`
                    : nothing
            }
        `;
    }

    private _renderTotals(forecast: ForecastInfo): TemplateResult | typeof nothing {
        const { consumedEnergyWh, generatedEnergyWh } = forecast;
        if (consumedEnergyWh === 0 && generatedEnergyWh === 0) return nothing;
        return html`
            <div class="totals">
                ${
                    consumedEnergyWh > 0
                        ? html`<div class="total-row">
                              <span>Forecast consumption${forecast.consumedEnergyEstimated ? " (est.)" : ""}</span>
                              <b>${formatEnergy(consumedEnergyWh)}</b>
                          </div>`
                        : nothing
                }
                ${
                    generatedEnergyWh > 0
                        ? html`<div class="total-row">
                              <span>Forecast generation${forecast.generatedEnergyEstimated ? " (est.)" : ""}</span>
                              <b class="generating">${formatEnergy(generatedEnergyWh)}</b>
                          </div>`
                        : nothing
                }
            </div>
        `;
    }

    private _renderForecastMeta(forecast: ForecastInfo): TemplateResult {
        return html`
            <dl class="info-grid">
                ${
                    forecast.forecastId !== undefined
                        ? html`<dt>Forecast ID</dt>
                              <dd>${forecast.forecastId}</dd>`
                        : nothing
                }
                ${
                    forecast.updateReason !== undefined
                        ? html`<dt>Updated for</dt>
                              <dd>${forecast.updateReason}</dd>`
                        : nothing
                }
                ${
                    forecast.isPausable !== undefined
                        ? html`<dt>Pausable</dt>
                              <dd>${forecast.isPausable ? "Yes" : "No"}</dd>`
                        : nothing
                }
            </dl>
        `;
    }

    private _renderDeviceLimits(info: DeviceEnergyManagementInfo): TemplateResult {
        const range =
            info.absMinPowerW !== undefined && info.absMaxPowerW !== undefined
                ? `${formatPower(info.absMinPowerW)}–${formatPower(info.absMaxPowerW)}`
                : undefined;
        return html`
            <dl class="info-grid">
                ${
                    range !== undefined
                        ? html`<dt>Power range</dt>
                              <dd>${range}</dd>`
                        : nothing
                }
                ${
                    info.canGenerate !== undefined
                        ? html`<dt>Can generate</dt>
                              <dd>${info.canGenerate ? "Yes" : "No"}</dd>`
                        : nothing
                }
                ${
                    info.optOutState !== undefined
                        ? html`<dt>Opt-out</dt>
                              <dd>${info.optOutState}</dd>`
                        : nothing
                }
            </dl>
        `;
    }

    static override styles: CSSResultGroup = [
        BaseClusterCommands.styles,
        css`
            .command-content {
                font-size: 14px;
            }
            .esa-header {
                margin: 0 0 8px 0;
                display: flex;
                flex-wrap: wrap;
                align-items: baseline;
                gap: 8px;
            }
            .esa-meta,
            .empty {
                color: var(--text-color, rgba(0, 0, 0, 0.6));
            }
            .window {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-bottom: 12px;
                color: var(--text-color, rgba(0, 0, 0, 0.6));
            }
            .window-range {
                font-weight: 500;
                color: var(--md-sys-color-on-surface);
            }
            .slots {
                list-style: none;
                margin: 0 0 12px 0;
                padding: 0;
            }
            .slot {
                display: flex;
                align-items: flex-start;
                gap: 12px;
                padding: 8px 0;
                border-bottom: 1px solid var(--md-sys-color-outline-variant);
            }
            .slot .marker {
                width: 16px;
                text-align: center;
                color: var(--text-color, rgba(0, 0, 0, 0.6));
            }
            .slot.active .marker {
                color: var(--md-sys-color-primary);
            }
            .slot.active .slot-name {
                font-weight: 700;
            }
            .slot.completed .slot-name {
                color: var(--text-color, rgba(0, 0, 0, 0.6));
            }
            .slot-main {
                flex: 1;
                min-width: 0;
            }
            .slot-title {
                display: flex;
                flex-wrap: wrap;
                align-items: baseline;
                gap: 8px;
            }
            .slot-time,
            .slot-sub {
                color: var(--text-color, rgba(0, 0, 0, 0.6));
            }
            .chip {
                font-size: 12px;
                padding: 1px 6px;
                border-radius: 8px;
                background: var(--md-sys-color-secondary-container);
                color: var(--md-sys-color-on-secondary-container);
            }
            .slot-power {
                text-align: right;
                white-space: nowrap;
                font-weight: 500;
            }
            .slot-power .generating,
            .totals .generating {
                color: var(--md-sys-color-primary);
            }
            .slot-power .direction {
                display: block;
                font-size: 12px;
                font-weight: 400;
                color: var(--text-color, rgba(0, 0, 0, 0.6));
            }
            .totals {
                margin-bottom: 12px;
            }
            .total-row {
                display: flex;
                justify-content: space-between;
                gap: 16px;
                padding: 4px 0;
            }
            .info-grid {
                display: grid;
                grid-template-columns: auto 1fr;
                gap: 6px 16px;
                margin: 0;
            }
            .info-grid dt {
                color: var(--text-color, rgba(0, 0, 0, 0.6));
            }
            .info-grid dd {
                margin: 0;
                font-weight: 500;
            }
        `,
    ];
}

registerClusterCommands(DEVICE_ENERGY_MANAGEMENT_CLUSTER_ID, "device-energy-management-cluster-commands", {
    renderWhenOffline: true,
});

declare global {
    interface HTMLElementTagNameMap {
        "device-energy-management-cluster-commands": DeviceEnergyManagementClusterCommands;
    }
}
