/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/outlined-button";
import "@material/web/checkbox/checkbox";
import { css, html, nothing, type CSSResultGroup } from "lit";
import { customElement, state } from "lit/decorators.js";
import { handleAsync } from "../../../util/async-handler.js";
import { errorText } from "../../../util/error-text.js";
import {
    SERVICE_AREA_CLUSTER_ID,
    areaLabel,
    decodeSelectAreasResult,
    decodeSkipAreaResult,
    serviceAreaInfo,
    type AreaInfo,
    type CommandResult,
    type MapInfo,
    type ProgressInfo,
} from "../../../util/service-area.js";
import { MATTER_EPOCH_OFFSET_SECONDS } from "../../../util/time.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

const CLUSTER_ID = SERVICE_AREA_CLUSTER_ID;

function countdownLabel(estimatedEndTimeEpochS: number): string {
    const endMs = (estimatedEndTimeEpochS + MATTER_EPOCH_OFFSET_SECONDS) * 1000;
    const remainingS = Math.round((endMs - Date.now()) / 1000);
    if (remainingS <= 0) return "due now";
    const minutes = Math.floor(remainingS / 60);
    const seconds = remainingS % 60;
    return minutes > 0 ? `~${minutes}m ${seconds}s remaining` : `~${seconds}s remaining`;
}

@customElement("service-area-cluster-commands")
class ServiceAreaClusterCommands extends BaseClusterCommands {
    @state() private _selectedAreaIds = new Set<number>();
    @state() private _busy = false;
    @state() private _result?: { command: "SelectAreas" | "SkipArea"; result: CommandResult };
    @state() private _error?: string;
    private _formContext?: string;
    /** An invoke started before a reset must not write its outcome into the panel that replaced it. */
    private _invokeGeneration = 0;

    override willUpdate(changedProperties: Map<string, unknown>) {
        super.willUpdate(changedProperties);
        if (!this.node) return;
        const context = `${String(this.node.node_id)}/${this.endpoint}/${this.cluster}`;
        if (this._formContext !== undefined && this._formContext !== context) {
            this._selectedAreaIds = new Set();
            this._result = undefined;
            this._error = undefined;
            this._busy = false;
            this._invokeGeneration++;
        }
        this._formContext = context;
    }

    private _toggleArea(areaId: number, checked: boolean) {
        const next = new Set(this._selectedAreaIds);
        if (checked) next.add(areaId);
        else next.delete(areaId);
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
            this._result = { command: "SelectAreas", result: decodeSelectAreasResult(response) };
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

    private _renderArea(area: AreaInfo, info: ReturnType<typeof serviceAreaInfo>) {
        const isCurrent = info.currentArea === area.areaId;
        const progress = info.progress.find(p => p.areaId === area.areaId);
        const canSkip = info.features.progressReporting && progress?.status === "Operating";

        return html`
            <li class="area-row ${isCurrent ? "area-row-current" : ""}">
                <label>
                    <md-checkbox
                        ?checked=${this._selectedAreaIds.has(area.areaId)}
                        ?disabled=${this._busy || !this.node.available}
                        @change=${(e: Event) => this._toggleArea(area.areaId, (e.target as HTMLInputElement).checked)}
                    ></md-checkbox>
                    <span>${areaLabel(area)}${isCurrent ? html` <strong>(current)</strong>` : nothing}</span>
                </label>
                ${progress ? this._renderProgressBadge(progress) : nothing}
                ${
                    canSkip
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
        return html`<span class="progress-badge progress-${progress.status.toLowerCase()}">${progress.status}</span>`;
    }

    private _renderMapGroup(map: MapInfo | undefined, areas: AreaInfo[], info: ReturnType<typeof serviceAreaInfo>) {
        return html`
            ${map ? html`<h4 class="map-name">${map.name}</h4>` : nothing}
            <ul class="area-list">
                ${areas.map(area => this._renderArea(area, info))}
            </ul>
        `;
    }

    override render() {
        if (!this.node || this.cluster !== CLUSTER_ID) return nothing;
        const info = serviceAreaInfo(this.node.attributes, this.endpoint);

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

        return html`
            <details class="command-panel">
                <summary>Service Area</summary>
                <div class="command-content">
                    ${
                        info.estimatedEndTime !== undefined && info.estimatedEndTime !== null
                            ? html`<div class="command-row">
                                  <span>Estimated end: <strong>${countdownLabel(info.estimatedEndTime)}</strong></span>
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
                            ?disabled=${this._busy || !this.node.available}
                            @click=${handleAsync(() => this._selectAreas())}
                            >Select Areas (${this._selectedAreaIds.size})</md-outlined-button
                        >
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
                margin: 0;
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
            }
            .area-row label {
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 1;
                cursor: pointer;
            }
            .area-row-current {
                background-color: var(--md-sys-color-surface-container-high);
                border-radius: 8px;
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
                background: var(--md-sys-color-tertiary-container);
                color: var(--md-sys-color-on-tertiary-container);
            }
            .result-error {
                background: var(--md-sys-color-error-container);
                color: var(--md-sys-color-on-error-container);
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
