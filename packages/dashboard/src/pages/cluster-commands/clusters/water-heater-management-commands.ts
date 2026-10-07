/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/filled-button";
import "@material/web/button/outlined-button";
import { css, html, nothing, type CSSResultGroup, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { handleAsync } from "../../../util/async-handler.js";
import { errorText } from "../../../util/error-text.js";
import {
    cancelBoost,
    formatEnergyKwh,
    heatSourcesText,
    parseBoostForm,
    startBoost,
    waterHeaterManagementInfo,
    WATER_HEATER_MANAGEMENT_CLUSTER_ID,
    type BoostForm,
    type WaterHeaterManagementInfo,
} from "../../../util/water-heater-management.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

const EMPTY_FORM: BoostForm = {
    duration: "3600",
    oneShot: false,
    emergencyBoost: false,
    temporarySetpoint: "",
    targetPercentage: "",
};

@customElement("water-heater-management-cluster-commands")
export class WaterHeaterManagementClusterCommands extends BaseClusterCommands {
    @state() private _form: BoostForm = { ...EMPTY_FORM };
    @state() private _busy = false;
    @state() private _error?: string;

    private _info?: WaterHeaterManagementInfo;
    /** node/endpoint/cluster the form belongs to; the element is reused across navigation. */
    private _formContext?: string;
    private _invokeGeneration = 0;

    override willUpdate(changedProperties: Map<string, unknown>) {
        super.willUpdate(changedProperties);
        if (!this.node || this.cluster !== WATER_HEATER_MANAGEMENT_CLUSTER_ID) {
            this._info = undefined;
            return;
        }
        const context = `${String(this.node.node_id)}/${this.endpoint}/${this.cluster}`;
        if (this._formContext !== undefined && this._formContext !== context) {
            this._form = { ...EMPTY_FORM };
            this._error = undefined;
            this._busy = false;
            this._invokeGeneration++;
        }
        this._formContext = context;
        this._info = waterHeaterManagementInfo(this.node.attributes, this.endpoint);
    }

    override render() {
        const info = this._info;
        if (!this.node || !info?.supported) return nothing;

        return html`
            <details class="command-panel">
                <summary>Water Heater Management</summary>
                <div class="command-content">
                    ${this._renderStatus(info)} ${this._renderEnergy(info)} ${this._renderBoost(info)}
                    ${this._error ? html`<div class="result-error" role="alert">${this._error}</div>` : nothing}
                </div>
            </details>
        `;
    }

    private _renderStatus(info: WaterHeaterManagementInfo): TemplateResult {
        return html`
            <dl>
                <dt>Heater types</dt>
                <dd>${heatSourcesText(info.heaterTypes)}</dd>
                <dt>Heat demand</dt>
                <dd>${heatSourcesText(info.heatDemandTypes)}</dd>
                ${
                    info.supportsTankPercent
                        ? html`<dt>Tank level</dt>
                              <dd>${info.tankPercentage !== undefined ? `${info.tankPercentage}%` : "—"}</dd>`
                        : nothing
                }
                <dt>Boost</dt>
                <dd>${info.boostState ?? "—"}</dd>
            </dl>
        `;
    }

    private _renderEnergy(info: WaterHeaterManagementInfo): TemplateResult | typeof nothing {
        if (!info.supportsEnergyManagement) return nothing;
        return html`
            <dl>
                ${
                    info.tankVolumeL !== undefined
                        ? html`<dt>Tank volume</dt>
                              <dd>${info.tankVolumeL} L</dd>`
                        : nothing
                }
                ${
                    info.estimatedHeatRequiredMilliWh !== undefined
                        ? html`<dt>Estimated heat required</dt>
                              <dd>${formatEnergyKwh(info.estimatedHeatRequiredMilliWh)}</dd>`
                        : nothing
                }
            </dl>
        `;
    }

    private _renderBoost(info: WaterHeaterManagementInfo): TemplateResult {
        if (info.boostActive) {
            return html`
                <div class="actions">
                    <md-outlined-button ?disabled=${this._busy} @click=${handleAsync(() => this._cancelBoost())}>
                        Cancel boost
                    </md-outlined-button>
                </div>
            `;
        }
        const form = this._form;
        return html`
            <div class="boost-form">
                <label>
                    Duration (s)
                    <input
                        type="text"
                        inputmode="numeric"
                        .value=${live(form.duration)}
                        @input=${(e: Event) => this._update({ duration: (e.target as HTMLInputElement).value })}
                    />
                </label>
                <label>
                    Temporary setpoint (°C)
                    <input
                        type="text"
                        inputmode="decimal"
                        placeholder="optional"
                        .value=${live(form.temporarySetpoint)}
                        @input=${(e: Event) =>
                            this._update({ temporarySetpoint: (e.target as HTMLInputElement).value })}
                    />
                </label>
                ${
                    info.supportsTankPercent
                        ? html`<label>
                              Target tank level (%)
                              <input
                                  type="text"
                                  inputmode="numeric"
                                  placeholder="optional"
                                  .value=${live(form.targetPercentage)}
                                  @input=${(e: Event) =>
                                      this._update({ targetPercentage: (e.target as HTMLInputElement).value })}
                              />
                          </label>`
                        : nothing
                }
                <label>
                    <input
                        type="checkbox"
                        .checked=${live(form.oneShot)}
                        @change=${(e: Event) => this._update({ oneShot: (e.target as HTMLInputElement).checked })}
                    />
                    One shot
                </label>
                <label>
                    <input
                        type="checkbox"
                        .checked=${live(form.emergencyBoost)}
                        @change=${(e: Event) =>
                            this._update({ emergencyBoost: (e.target as HTMLInputElement).checked })}
                    />
                    Emergency boost
                </label>
                <div class="actions">
                    <md-filled-button ?disabled=${this._busy} @click=${handleAsync(() => this._startBoost())}>
                        Start boost
                    </md-filled-button>
                </div>
            </div>
        `;
    }

    private _update(change: Partial<BoostForm>) {
        this._form = { ...this._form, ...change };
        this._error = undefined;
    }

    private async _startBoost() {
        const parsed = parseBoostForm(this._form, this._info?.supportsTankPercent ?? false);
        if ("error" in parsed) {
            this._error = parsed.error;
            return;
        }
        await this._invoke((nodeId, endpoint) => startBoost(this.client, nodeId, endpoint, parsed.params));
    }

    private async _cancelBoost() {
        await this._invoke((nodeId, endpoint) => cancelBoost(this.client, nodeId, endpoint));
    }

    private async _invoke(command: (nodeId: number | bigint, endpoint: number) => Promise<void>) {
        if (!this.node) return;
        const node = this.node;
        const endpoint = this.endpoint;
        const generation = ++this._invokeGeneration;
        const isCurrent = () => this._invokeGeneration === generation && this.isSameContext(node, endpoint);
        this._busy = true;
        this._error = undefined;
        try {
            await command(node.node_id, endpoint);
        } catch (err) {
            if (isCurrent()) this._error = errorText(err);
        } finally {
            if (isCurrent()) this._busy = false;
        }
    }

    static override styles: CSSResultGroup = [
        BaseClusterCommands.styles,
        css`
            dl {
                margin: 0 0 12px;
                display: grid;
                grid-template-columns: auto 1fr;
                gap: 4px 16px;
            }
            dt {
                color: var(--md-sys-color-on-surface-variant);
            }
            dd {
                margin: 0;
            }
            .boost-form {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .boost-form label {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .boost-form input[type="text"] {
                width: 96px;
                padding: 6px;
                border: 1px solid var(--md-sys-color-outline);
                border-radius: 4px;
                background: var(--md-sys-color-surface);
                color: var(--md-sys-color-on-surface);
            }
            .actions {
                display: flex;
                gap: 8px;
            }
            .result-error {
                margin-top: 8px;
                padding: 8px 10px;
                border-radius: 6px;
                background: var(--md-sys-color-error-container);
                color: var(--md-sys-color-on-error-container);
            }
        `,
    ];
}

registerClusterCommands(WATER_HEATER_MANAGEMENT_CLUSTER_ID, "water-heater-management-cluster-commands");
