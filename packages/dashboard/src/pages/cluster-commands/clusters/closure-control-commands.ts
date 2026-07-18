/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/filled-button";
import "@material/web/button/outlined-button";
import "@material/web/select/outlined-select";
import "@material/web/select/select-option";
import { mdiAlertCircle, mdiCogRefresh, mdiStop } from "@mdi/js";
import { css, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import "../../../components/ha-svg-icon.js";
import { handleAsync, handleAsyncEvent } from "../../../util/async-handler.js";
import {
    CLOSURE_CONTROL_CLUSTER_ID,
    CLOSURE_ERROR_LABELS,
    type ClosureCurrentState,
    type ClosureState,
    MAIN_STATE_LABELS,
    SPEED_LABELS,
    TARGET_POSITION_LABELS,
    calibrate,
    moveTo,
    readCountdownTime,
    readCurrentErrorList,
    readFeatures,
    readLatchControlModes,
    readMainState,
    readOverallCurrentState,
    readOverallTargetState,
    stop,
} from "../../../util/closure-control.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

const MAIN_STATE_ERROR = 3;

@customElement("closure-control-cluster-commands")
class ClosureControlClusterCommands extends BaseClusterCommands {
    @state() private _moveToPosition = "";
    // "" = unchanged, "true" = latch, "false" = unlatch — kept as a select (not a plain switch) so an
    // untouched control never implies an explicit latch/unlatch command in the MoveTo payload.
    @state() private _moveToLatch = "";
    @state() private _moveToSpeed = "";
    private _unsubscribeNodes?: () => void;

    override updated(changedProperties: Map<string, unknown>) {
        super.updated(changedProperties);
        if (changedProperties.has("client") && this.client && !this._unsubscribeNodes) {
            this._unsubscribeNodes = this.client.addEventListener("nodes_changed", () => {
                this.requestUpdate();
            });
        }
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubscribeNodes?.();
    }

    override render() {
        if (!this.node || this.cluster !== CLOSURE_CONTROL_CLUSTER_ID) return nothing;
        const features = readFeatures(this.node, this.endpoint);
        const mainState = readMainState(this.node, this.endpoint);
        const errors = readCurrentErrorList(this.node, this.endpoint);
        const countdownTime = readCountdownTime(this.node, this.endpoint);
        const current = readOverallCurrentState(this.node, this.endpoint);
        const target = readOverallTargetState(this.node, this.endpoint);
        const latchControlModes = readLatchControlModes(this.node, this.endpoint);

        return html`
            <details class="command-panel" open>
                <summary>Closure Control</summary>
                <div class="command-content">
                    <div class="top-row">
                        <span class="state-badge ${mainState === MAIN_STATE_ERROR ? "error" : ""}">
                            ${mainState !== null
                                ? (MAIN_STATE_LABELS[mainState] ?? `Unknown (${mainState})`)
                                : "Unknown"}
                        </span>
                        ${countdownTime !== null
                            ? html`<span class="muted">~${countdownTime}s remaining</span>`
                            : nothing}
                    </div>

                    ${errors.length > 0
                        ? html`
                              <div class="errors">
                                  ${errors.map(
                                      e => html`
                                          <span class="error-chip">
                                              <ha-svg-icon .path=${mdiAlertCircle}></ha-svg-icon>
                                              ${CLOSURE_ERROR_LABELS[e] ?? `Error ${e}`}
                                          </span>
                                      `,
                                  )}
                              </div>
                          `
                        : nothing}

                    <div class="states-grid">
                        <div class="state-block">
                            <div class="state-block-header">Current</div>
                            ${this._renderState(current, features)}
                        </div>
                        <div class="state-block">
                            <div class="state-block-header">Target</div>
                            ${this._renderState(target, features)}
                        </div>
                    </div>

                    <div class="actions">
                        ${!features.instantaneous
                            ? html`<md-outlined-button @click=${handleAsync(() => this._handleStop())}>
                                  <ha-svg-icon slot="icon" .path=${mdiStop}></ha-svg-icon>
                                  Stop
                              </md-outlined-button>`
                            : nothing}
                        ${features.calibration
                            ? html`<md-outlined-button @click=${handleAsync(() => this._handleCalibrate())}>
                                  <ha-svg-icon slot="icon" .path=${mdiCogRefresh}></ha-svg-icon>
                                  Calibrate
                              </md-outlined-button>`
                            : nothing}
                    </div>

                    <div class="move-to">
                        <div class="move-to-header">Move to</div>
                        <div class="move-to-controls">
                            ${features.positioning
                                ? html`
                                      <md-outlined-select
                                          label="Position"
                                          .value=${this._moveToPosition}
                                          @change=${handleAsyncEvent((e: Event) => {
                                              this._moveToPosition = (e.target as HTMLSelectElement).value;
                                              return Promise.resolve();
                                          })}
                                      >
                                          <md-select-option value="">
                                              <div slot="headline">(unchanged)</div>
                                          </md-select-option>
                                          ${Object.entries(TARGET_POSITION_LABELS)
                                              .filter(
                                                  ([id]) =>
                                                      (id !== "2" || features.pedestrian) &&
                                                      (id !== "3" || features.ventilation),
                                              )
                                              .map(
                                                  ([id, label]) => html`
                                                      <md-select-option value=${id}>
                                                          <div slot="headline">${label}</div>
                                                      </md-select-option>
                                                  `,
                                              )}
                                      </md-outlined-select>
                                  `
                                : nothing}
                            ${features.motionLatching &&
                            (latchControlModes.remoteLatching || latchControlModes.remoteUnlatching)
                                ? html`
                                      <md-outlined-select
                                          label="Latch"
                                          .value=${this._moveToLatch}
                                          @change=${handleAsyncEvent((e: Event) => {
                                              this._moveToLatch = (e.target as HTMLSelectElement).value;
                                              return Promise.resolve();
                                          })}
                                      >
                                          <md-select-option value="">
                                              <div slot="headline">(unchanged)</div>
                                          </md-select-option>
                                          ${latchControlModes.remoteLatching
                                              ? html`<md-select-option value="true">
                                                    <div slot="headline">Latch</div>
                                                </md-select-option>`
                                              : nothing}
                                          ${latchControlModes.remoteUnlatching
                                              ? html`<md-select-option value="false">
                                                    <div slot="headline">Unlatch</div>
                                                </md-select-option>`
                                              : nothing}
                                      </md-outlined-select>
                                  `
                                : nothing}
                            ${features.speed
                                ? html`
                                      <md-outlined-select
                                          label="Speed"
                                          .value=${this._moveToSpeed}
                                          @change=${handleAsyncEvent((e: Event) => {
                                              this._moveToSpeed = (e.target as HTMLSelectElement).value;
                                              return Promise.resolve();
                                          })}
                                      >
                                          <md-select-option value="">
                                              <div slot="headline">(unchanged)</div>
                                          </md-select-option>
                                          ${Object.entries(SPEED_LABELS).map(
                                              ([id, label]) => html`
                                                  <md-select-option value=${id}>
                                                      <div slot="headline">${label}</div>
                                                  </md-select-option>
                                              `,
                                          )}
                                      </md-outlined-select>
                                  `
                                : nothing}
                            <md-filled-button @click=${handleAsync(() => this._handleMoveTo())}>
                                Move
                            </md-filled-button>
                        </div>
                    </div>
                </div>
            </details>
        `;
    }

    private _renderState(state: ClosureState | ClosureCurrentState | null, features: ReturnType<typeof readFeatures>) {
        if (!state) return html`<div class="muted empty">Unknown</div>`;
        return html`
            <div class="state-fields">
                ${features.positioning
                    ? html`<div class="state-field">
                          <span class="muted">Position:</span>
                          <span>
                              ${state.position !== null
                                  ? (TARGET_POSITION_LABELS[state.position] ?? `#${state.position}`)
                                  : "Unknown"}
                          </span>
                      </div>`
                    : nothing}
                ${features.motionLatching
                    ? html`<div class="state-field">
                          <span class="muted">Latch:</span>
                          <span>${state.latch === null ? "Unknown" : state.latch ? "Latched" : "Unlatched"}</span>
                      </div>`
                    : nothing}
                ${features.speed
                    ? html`<div class="state-field">
                          <span class="muted">Speed:</span>
                          <span
                              >${state.speed !== null
                                  ? (SPEED_LABELS[state.speed] ?? `#${state.speed}`)
                                  : "Unknown"}</span
                          >
                      </div>`
                    : nothing}
                ${"secureState" in state
                    ? html`<div class="state-field">
                          <span class="muted">Secure:</span>
                          <span>
                              ${state.secureState === null ? "Unknown" : state.secureState ? "Secure" : "Not secure"}
                          </span>
                      </div>`
                    : nothing}
            </div>
        `;
    }

    private async _handleStop() {
        await stop(this.client, this.node.node_id, this.endpoint);
    }

    private async _handleCalibrate() {
        await calibrate(this.client, this.node.node_id, this.endpoint);
    }

    private async _handleMoveTo() {
        await moveTo(this.client, this.node.node_id, this.endpoint, {
            position: this._moveToPosition !== "" ? Number(this._moveToPosition) : undefined,
            latch: this._moveToLatch !== "" ? this._moveToLatch === "true" : undefined,
            speed: this._moveToSpeed !== "" ? Number(this._moveToSpeed) : undefined,
        });
    }

    static override styles = [
        ...(Array.isArray(BaseClusterCommands.styles) ? BaseClusterCommands.styles : [BaseClusterCommands.styles]),
        css`
            .top-row {
                display: flex;
                align-items: center;
                gap: 16px;
                flex-wrap: wrap;
                padding-bottom: 12px;
            }
            .state-badge {
                font-weight: 500;
                padding: 4px 10px;
                border-radius: 8px;
                background: var(--md-sys-color-secondary-container);
                color: var(--md-sys-color-on-secondary-container);
            }
            .state-badge.error {
                background: var(--md-sys-color-error-container);
                color: var(--md-sys-color-on-error-container);
            }
            .muted {
                color: var(--md-sys-color-on-surface-variant);
            }
            .errors {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                padding-bottom: 12px;
            }
            .error-chip {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 4px 10px;
                border-radius: 8px;
                background: var(--md-sys-color-error-container);
                color: var(--md-sys-color-on-error-container);
                font-size: 0.85rem;
            }
            .error-chip ha-svg-icon {
                --mdc-icon-size: 16px;
            }
            .states-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                gap: 16px;
                border-top: 1px solid var(--md-sys-color-outline-variant);
                border-bottom: 1px solid var(--md-sys-color-outline-variant);
                padding: 12px 0;
                margin-bottom: 12px;
            }
            .state-block-header {
                font-weight: 500;
                margin-bottom: 6px;
            }
            .state-fields {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .state-field {
                display: flex;
                gap: 6px;
            }
            .actions {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                padding-bottom: 12px;
            }
            .move-to {
                border-top: 1px solid var(--md-sys-color-outline-variant);
                padding-top: 12px;
            }
            .move-to-header {
                font-weight: 500;
                margin-bottom: 8px;
            }
            .move-to-controls {
                display: flex;
                align-items: center;
                gap: 12px;
                flex-wrap: wrap;
            }
        `,
    ];
}

registerClusterCommands(CLOSURE_CONTROL_CLUSTER_ID, "closure-control-cluster-commands");

declare global {
    interface HTMLElementTagNameMap {
        "closure-control-cluster-commands": ClosureControlClusterCommands;
    }
}
