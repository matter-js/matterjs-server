/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/outlined-button";
import { MdCheckbox } from "@material/web/checkbox/checkbox.js";
import { css, html, nothing, type CSSResultGroup } from "lit";
import { customElement, state } from "lit/decorators.js";
import { handleAsync } from "../../../util/async-handler.js";
import { formatDuration } from "../../../util/duration.js";
import { errorText } from "../../../util/error-text.js";
import {
    SERVICE_AREA_CLUSTER_ID,
    areaLabel,
    decodeSelectAreasResult,
    decodeSkipAreaResult,
    describeOperationalStatus,
    isSkippable,
    OperationalStatus,
    remainingSeconds,
    remainingTimeLabel,
    serviceAreaInfo,
    type AreaInfo,
    type CommandResult,
    type MapInfo,
    type ProgressInfo,
    type ServiceAreaInfo,
} from "../../../util/service-area.js";
import { formatEpochTime } from "../../../util/time.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

const CLUSTER_ID = SERVICE_AREA_CLUSTER_ID;

const COUNTDOWN_INTERVAL_MS = 1000;

@customElement("service-area-cluster-commands")
class ServiceAreaClusterCommands extends BaseClusterCommands {
    @state() private _selectedAreaIds = new Set<number>();
    @state() private _busy = false;
    @state() private _result?: { command: "SelectAreas" | "SkipArea"; result: CommandResult };
    @state() private _error?: string;
    private _formContext?: string;
    /** An invoke started before a reset must not write its outcome into the panel that replaced it. */
    private _invokeGeneration = 0;
    /** Until the user picks areas, the checkboxes follow the device's own SelectedAreas. */
    private _selectionEdited = false;
    private _info?: ServiceAreaInfo;
    private _countdownTimer?: ReturnType<typeof setInterval>;

    override connectedCallback() {
        super.connectedCallback();
        // A reconnected element gets no property change, so nothing else would restart the countdown.
        if (this._info !== undefined) this._syncCountdown(this._info);
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this._stopCountdown();
    }

    override willUpdate(changedProperties: Map<string, unknown>) {
        super.willUpdate(changedProperties);
        if (!this.node) {
            this._stopCountdown();
            return;
        }
        const context = `${String(this.node.node_id)}/${this.endpoint}/${this.cluster}`;
        if (this._formContext !== undefined && this._formContext !== context) {
            this._selectedAreaIds = new Set();
            this._selectionEdited = false;
            this._result = undefined;
            this._error = undefined;
            this._busy = false;
            this._invokeGeneration++;
        }
        this._formContext = context;

        if (this.cluster !== CLUSTER_ID) {
            this._info = undefined;
            this._stopCountdown();
            return;
        }

        const info = serviceAreaInfo(this.node.attributes, this.endpoint);
        this._info = info;
        this._syncSelection(info);
        this._syncCountdown(info);
    }

    /**
     * SelectAreas replaces the device's whole selection, so a panel that starts empty would cancel
     * whatever is running the moment the user submits. An edited selection still drops areas the
     * device no longer supports, which it would only reject as UnsupportedArea.
     */
    private _syncSelection(info: ServiceAreaInfo) {
        const supported = new Set(info.supportedAreas.map(area => area.areaId));
        const next = new Set(
            (this._selectionEdited ? [...this._selectedAreaIds] : info.selectedAreas).filter(areaId =>
                supported.has(areaId),
            ),
        );
        if (next.size !== this._selectedAreaIds.size || [...next].some(id => !this._selectedAreaIds.has(id))) {
            this._selectedAreaIds = next;
        }
    }

    private _syncCountdown(info: ServiceAreaInfo) {
        const needed = typeof info.estimatedEndTime === "number" && remainingSeconds(info.estimatedEndTime) > 0;
        if (needed && this._countdownTimer === undefined) {
            this._countdownTimer = setInterval(() => this.requestUpdate(), COUNTDOWN_INTERVAL_MS);
        } else if (!needed) {
            this._stopCountdown();
        }
    }

    private _stopCountdown() {
        if (this._countdownTimer !== undefined) {
            clearInterval(this._countdownTimer);
            this._countdownTimer = undefined;
        }
    }

    private _toggleArea(areaId: number, checked: boolean) {
        const next = new Set(this._selectedAreaIds);
        if (checked) next.add(areaId);
        else next.delete(areaId);
        this._selectionEdited = true;
        this._selectedAreaIds = next;
    }

    private async _selectAreas() {
        const node = this.node;
        const endpoint = this.endpoint;
        const generation = ++this._invokeGeneration;
        const isCurrent = () => this._invokeGeneration === generation && this.isSameContext(node, endpoint);
        this._busy = true;
        this._error = undefined;
        this._result = undefined;
        try {
            const response = await this.client.deviceCommand(node.node_id, endpoint, CLUSTER_ID, "SelectAreas", {
                newAreas: [...this._selectedAreaIds],
            });
            if (!isCurrent()) return;
            const result = decodeSelectAreasResult(response);
            this._result = { command: "SelectAreas", result };
            // The device now owns the selection again, so let SelectedAreas drive the checkboxes.
            if (result.success) this._selectionEdited = false;
        } catch (err) {
            if (isCurrent()) this._error = errorText(err);
        } finally {
            if (isCurrent()) this._busy = false;
        }
    }

    private async _skipArea(areaId: number) {
        const node = this.node;
        const endpoint = this.endpoint;
        const generation = ++this._invokeGeneration;
        const isCurrent = () => this._invokeGeneration === generation && this.isSameContext(node, endpoint);
        this._busy = true;
        this._error = undefined;
        this._result = undefined;
        try {
            const response = await this.client.deviceCommand(node.node_id, endpoint, CLUSTER_ID, "SkipArea", {
                skippedArea: areaId,
            });
            if (!isCurrent()) return;
            this._result = { command: "SkipArea", result: decodeSkipAreaResult(response) };
        } catch (err) {
            if (isCurrent()) this._error = errorText(err);
        } finally {
            if (isCurrent()) this._busy = false;
        }
    }

    private _renderArea(area: AreaInfo, info: ServiceAreaInfo) {
        const isCurrent = info.currentArea === area.areaId;
        const progress = info.progress.find(entry => entry.areaId === area.areaId);

        return html`
            <li class="area-row ${isCurrent ? "area-row-current" : ""}">
                <label>
                    <md-checkbox
                        .checked=${this._selectedAreaIds.has(area.areaId)}
                        ?disabled=${this._busy || !this.node.available || !info.commands.selectAreas}
                        @change=${(e: Event) => {
                            if (e.target instanceof MdCheckbox) this._toggleArea(area.areaId, e.target.checked);
                        }}
                    ></md-checkbox>
                    <span
                        >${areaLabel(area)}${
                            // The map header already conveys the floor once maps group the list; a
                            // per-row number is only informative in the flat, ungrouped fallback.
                            area.floorNumber !== undefined && !info.features.maps
                                ? html` <span>floor ${area.floorNumber}</span>`
                                : nothing
                        }${isCurrent ? html` <strong>(current)</strong>` : nothing}</span
                    >
                </label>
                ${progress ? this._renderProgressBadge(progress) : nothing}
                ${
                    isSkippable(info, area.areaId)
                        ? html`<md-outlined-button
                              ?disabled=${this._busy || !this.node.available}
                              @click=${handleAsync(() => this._skipArea(area.areaId))}
                              >Skip</md-outlined-button
                          >`
                        : nothing
                }
            </li>
        `;
    }

    private _renderProgressBadge(progress: ProgressInfo) {
        const status = describeOperationalStatus(progress.status);
        const times = new Array<string>();
        if (progress.totalOperationalTime !== undefined) {
            times.push(`ran ${formatDuration(progress.totalOperationalTime)}`);
        }
        if (progress.estimatedTime !== undefined) times.push(`~${formatDuration(progress.estimatedTime)} estimated`);

        return html`<span class="progress-badge progress-${status.key}"
            >${status.label}${times.length > 0 ? html` <span class="area-detail">${times.join(", ")}</span>` : nothing}</span
        >`;
    }

    private _renderMapGroup(map: MapInfo | undefined, areas: AreaInfo[], info: ServiceAreaInfo) {
        return html`
            ${map ? html`<h4 class="map-name">${map.name}</h4>` : nothing}
            <ul class="area-list">
                ${areas.map(area => this._renderArea(area, info))}
            </ul>
        `;
    }

    override render() {
        const info = this._info;
        if (!this.node || info === undefined) return nothing;

        const knownMapIds = new Set(info.supportedMaps.map(map => map.mapId));
        const groups: { map: MapInfo | undefined; areas: AreaInfo[] }[] = info.features.maps
            ? [
                  ...info.supportedMaps.map(map => ({
                      map,
                      areas: info.supportedAreas.filter(a => a.mapId === map.mapId),
                  })),
                  {
                      map: undefined,
                      areas: info.supportedAreas.filter(a => a.mapId === undefined || !knownMapIds.has(a.mapId)),
                  },
              ].filter(group => group.areas.length > 0)
            : [{ map: undefined, areas: info.supportedAreas }];

        const running = info.progress.some(entry => entry.status === OperationalStatus.Operating);

        return html`
            <details class="command-panel">
                <summary>Service Area</summary>
                <div class="command-content">
                    ${
                        typeof info.estimatedEndTime === "number"
                            ? html`<div class="command-row">
                                  <span
                                      >Estimated end:
                                      <strong>${formatEpochTime(info.estimatedEndTime)}</strong>
                                      <span class="area-detail">${remainingTimeLabel(info.estimatedEndTime)}</span>
                                  </span>
                              </div>`
                            : nothing
                    }
                    ${
                        info.supportedAreas.length === 0
                            ? html`<div class="command-row">No supported areas reported.</div>`
                            : groups.map(group => this._renderMapGroup(group.map, group.areas, info))
                    }
                    <div class="command-row">
                        <md-outlined-button
                            ?disabled=${
                                this._busy ||
                                !this.node.available ||
                                !info.commands.selectAreas ||
                                (running && !info.features.selectWhileRunning)
                            }
                            @click=${handleAsync(() => this._selectAreas())}
                            >Select Areas (${this._selectedAreaIds.size})</md-outlined-button
                        >
                        ${
                            running && !info.features.selectWhileRunning
                                ? html`<span class="area-detail"
                                      >The device rejects a new selection while it is running.</span
                                  >`
                                : nothing
                        }
                    </div>
                    ${
                        this._result
                            ? html`<div
                                  class="result ${this._result.result.success ? "" : "result-error"}"
                                  role=${this._result.result.success ? "status" : "alert"}
                              >
                                  ${this._result.command} → ${this._result.result.statusName}
                                  (${this._result.result.status})${
                                      this._result.result.statusText
                                          ? html`: ${this._result.result.statusText}`
                                          : nothing
                                  }
                              </div>`
                            : nothing
                    }
                    ${this._error ? html`<div class="result result-error" role="alert">${this._error}</div>` : nothing}
                </div>
            </details>
        `;
    }

    static override styles: CSSResultGroup = [
        BaseClusterCommands.styles,
        css`
            .map-name {
                margin: 12px 0 4px 0;
                font-size: 13px;
                font-weight: 500;
                color: var(--md-sys-color-on-surface-variant);
            }
            .area-list {
                list-style: none;
                margin: 0 0 12px 0;
                padding: 0;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .area-row {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 4px 0;
                font-size: 14px;
            }
            .area-row label {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
            }
            .area-row-current {
                background-color: var(--md-sys-color-surface-container-high);
                border-radius: 8px;
            }
            .area-detail {
                font-size: 12px;
                color: var(--md-sys-color-on-surface-variant);
            }
            .progress-badge {
                font-size: 12px;
                padding: 2px 8px;
                border-radius: 8px;
                background-color: var(--md-sys-color-surface-container-highest);
                color: var(--md-sys-color-on-surface-variant);
            }
            .progress-operating {
                background-color: var(--md-sys-color-tertiary-container);
                color: var(--md-sys-color-on-tertiary-container);
            }
            .progress-completed {
                background-color: var(--md-sys-color-secondary-container);
                color: var(--md-sys-color-on-secondary-container);
            }
            .result {
                margin-top: 8px;
                padding: 8px 10px;
                border-radius: 6px;
                background: color-mix(in srgb, var(--success-color) 18%, transparent);
                color: var(--success-color);
                border: 1px solid color-mix(in srgb, var(--success-color) 40%, transparent);
            }
            .result-error {
                background: var(--md-sys-color-error-container);
                color: var(--md-sys-color-on-error-container);
                border: none;
            }
        `,
    ];
}

registerClusterCommands(CLUSTER_ID, "service-area-cluster-commands");

declare global {
    interface HTMLElementTagNameMap {
        "service-area-cluster-commands": ServiceAreaClusterCommands;
    }
}
