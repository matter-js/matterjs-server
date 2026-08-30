/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/filled-button";
import "@material/web/button/outlined-button";
import "@material/web/select/outlined-select";
import "@material/web/select/select-option";
import "@material/web/textfield/outlined-text-field";
import { css, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { handleAsync } from "../../../util/async-handler.js";
import {
    CLOSURE_DIMENSION_CLUSTER_ID,
    CLOSURE_UNIT_LABELS,
    type ClosureDimensionFeatures,
    type DimensionState,
    MODULATION_TYPE_LABELS,
    OVERFLOW_LABELS,
    ROTATION_AXIS_LABELS,
    SPEED_LABELS,
    STEP_DIRECTION_LABELS,
    TRANSLATION_DIRECTION_LABELS,
    formatPercent100ths,
    readCurrentState,
    readFeatures,
    readLatchControlModes,
    readLimitRange,
    readModulationType,
    readOverflow,
    readResolution,
    readRotationAxis,
    readStepValue,
    readTargetState,
    readTranslationDirection,
    readUnit,
    readUnitRange,
    setTarget,
    step as sendStep,
} from "../../../util/closure-dimension.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

@customElement("closure-dimension-cluster-commands")
class ClosureDimensionClusterCommands extends BaseClusterCommands {
    @state() private _setTargetPosition = "";
    @state() private _setTargetLatch = "";
    @state() private _setTargetSpeed = "";
    @state() private _stepDirection = "1";
    @state() private _stepCount = 1;
    @state() private _stepSpeed = "";
    private _unsubscribeNodes?: () => void;
    private _formContext?: string;

    override willUpdate(changedProperties: Map<string, unknown>) {
        super.willUpdate(changedProperties);
        if (!this.node) return;
        const context = `${String(this.node.node_id)}/${this.endpoint}/${this.cluster}`;
        if (this._formContext !== undefined && this._formContext !== context) {
            this._setTargetPosition = "";
            this._setTargetLatch = "";
            this._setTargetSpeed = "";
            this._stepDirection = "1";
            this._stepCount = 1;
            this._stepSpeed = "";
        }
        this._formContext = context;
    }

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
        this._unsubscribeNodes = undefined;
    }

    override render() {
        if (!this.node || this.cluster !== CLOSURE_DIMENSION_CLUSTER_ID) return nothing;
        const features = readFeatures(this.node, this.endpoint);
        const current = readCurrentState(this.node, this.endpoint);
        const target = readTargetState(this.node, this.endpoint);
        const latchControlModes = readLatchControlModes(this.node, this.endpoint);
        const targetPositionValue = this._setTargetPosition !== "" ? Number(this._setTargetPosition) : null;
        const isTargetPositionInvalid =
            targetPositionValue !== null &&
            (Number.isNaN(targetPositionValue) || targetPositionValue < 0 || targetPositionValue > 100);

        return html`
            <details class="command-panel" open>
                <summary>Closure Dimension</summary>
                <div class="command-content">
                    <div class="states-grid">
                        <div class="state-block state-block--current">
                            <div class="state-block-header">Current</div>
                            ${this._renderState(current, features)}
                        </div>
                        <div class="state-block state-block--target">
                            <div class="state-block-header">Target</div>
                            ${this._renderState(target, features)}
                        </div>
                    </div>

                    ${this._renderStaticInfo(features)}

                    <div class="set-target">
                        <div class="set-target-header">Set target</div>
                        <div class="set-target-controls">
                            ${
                                features.positioning
                                    ? html`
                                          <md-outlined-text-field
                                              type="number"
                                              label="Position (%)"
                                              min="0"
                                              max="100"
                                              step="0.01"
                                              placeholder="(unchanged)"
                                              .value=${this._setTargetPosition}
                                              @input=${(e: Event) => {
                                                  this._setTargetPosition = (e.target as HTMLInputElement).value;
                                              }}
                                          ></md-outlined-text-field>
                                      `
                                    : nothing
                            }
                            ${
                                features.motionLatching &&
                                (latchControlModes.remoteLatching || latchControlModes.remoteUnlatching)
                                    ? html`
                                          <md-outlined-select
                                              label="Latch"
                                              .value=${this._setTargetLatch}
                                              @change=${(e: Event) => {
                                                  this._setTargetLatch = (e.target as HTMLSelectElement).value;
                                              }}
                                          >
                                              <md-select-option value="">
                                                  <div slot="headline">(unchanged)</div>
                                              </md-select-option>
                                              ${
                                                  latchControlModes.remoteLatching
                                                      ? html`<md-select-option value="true">
                                                            <div slot="headline">Latch</div>
                                                        </md-select-option>`
                                                      : nothing
                                              }
                                              ${
                                                  latchControlModes.remoteUnlatching
                                                      ? html`<md-select-option value="false">
                                                            <div slot="headline">Unlatch</div>
                                                        </md-select-option>`
                                                      : nothing
                                              }
                                          </md-outlined-select>
                                      `
                                    : nothing
                            }
                            ${
                                features.speed
                                    ? html`
                                          <md-outlined-select
                                              label="Speed"
                                              .value=${this._setTargetSpeed}
                                              @change=${(e: Event) => {
                                                  this._setTargetSpeed = (e.target as HTMLSelectElement).value;
                                              }}
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
                                    : nothing
                            }
                            <md-filled-button
                                ?disabled=${
                                    isTargetPositionInvalid ||
                                    (this._setTargetPosition === "" &&
                                        this._setTargetLatch === "" &&
                                        this._setTargetSpeed === "")
                                }
                                @click=${handleAsync(() => this._handleSetTarget())}
                            >
                                Set
                            </md-filled-button>
                        </div>
                    </div>

                    ${
                        features.positioning
                            ? html`
                                  <div class="step">
                                      <div class="step-header">Step</div>
                                      <div class="step-controls">
                                          <md-outlined-select
                                              label="Direction"
                                              .value=${this._stepDirection}
                                              @change=${(e: Event) => {
                                                  this._stepDirection = (e.target as HTMLSelectElement).value;
                                              }}
                                          >
                                              ${Object.entries(STEP_DIRECTION_LABELS).map(
                                                  ([id, label]) => html`
                                                      <md-select-option value=${id}>
                                                          <div slot="headline">${label}</div>
                                                      </md-select-option>
                                                  `,
                                              )}
                                          </md-outlined-select>
                                          <md-outlined-text-field
                                              type="number"
                                              label="Steps"
                                              min="1"
                                              .value=${String(this._stepCount)}
                                              @input=${(e: Event) => {
                                                  const value = parseInt((e.target as HTMLInputElement).value, 10);
                                                  this._stepCount = Number.isFinite(value) && value > 0 ? value : 1;
                                              }}
                                          ></md-outlined-text-field>
                                          ${
                                              features.speed
                                                  ? html`
                                                        <md-outlined-select
                                                            label="Speed"
                                                            .value=${this._stepSpeed}
                                                            @change=${(e: Event) => {
                                                                this._stepSpeed = (e.target as HTMLSelectElement).value;
                                                            }}
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
                                                  : nothing
                                          }
                                          <md-outlined-button @click=${handleAsync(() => this._handleStep())}>
                                              Step
                                          </md-outlined-button>
                                      </div>
                                  </div>
                              `
                            : nothing
                    }
                </div>
            </details>
        `;
    }

    private _renderState(state: DimensionState | null, features: ClosureDimensionFeatures) {
        if (!state) return html`<div class="muted empty">Unknown</div>`;
        return html`
            <div class="state-fields">
                ${
                    features.positioning
                        ? html`<div class="state-field">
                              <span class="muted">Position:</span>
                              <span>${formatPercent100ths(state.position)}</span>
                          </div>`
                        : nothing
                }
                ${
                    features.motionLatching
                        ? html`<div class="state-field">
                              <span class="muted">Latch:</span>
                              <span>${state.latch === null ? "Unknown" : state.latch ? "Latched" : "Unlatched"}</span>
                          </div>`
                        : nothing
                }
                ${
                    features.speed
                        ? html`<div class="state-field">
                              <span class="muted">Speed:</span>
                              <span
                                  >${
                                      state.speed !== null
                                          ? (SPEED_LABELS[state.speed] ?? `#${state.speed}`)
                                          : "Unknown"
                                  }</span
                              >
                          </div>`
                        : nothing
                }
            </div>
        `;
    }

    private _renderStaticInfo(features: ClosureDimensionFeatures) {
        const resolution = features.positioning ? readResolution(this.node, this.endpoint) : null;
        const stepValue = features.positioning ? readStepValue(this.node, this.endpoint) : null;
        const unit = features.unit ? readUnit(this.node, this.endpoint) : null;
        const unitRange = features.unit ? readUnitRange(this.node, this.endpoint) : null;
        const limitRange = features.limitation ? readLimitRange(this.node, this.endpoint) : null;
        const translationDirection = features.translation ? readTranslationDirection(this.node, this.endpoint) : null;
        const rotationAxis = features.rotation ? readRotationAxis(this.node, this.endpoint) : null;
        const overflow = features.rotation ? readOverflow(this.node, this.endpoint) : null;
        const modulationType = features.modulation ? readModulationType(this.node, this.endpoint) : null;

        const rows: Array<[string, string]> = [];
        if (resolution !== null) rows.push(["Resolution", formatPercent100ths(resolution)]);
        if (stepValue !== null) rows.push(["Step size", formatPercent100ths(stepValue)]);
        if (unit !== null) rows.push(["Unit", CLOSURE_UNIT_LABELS[unit] ?? `#${unit}`]);
        if (unitRange !== null) rows.push(["Unit range", `${unitRange.min} – ${unitRange.max}`]);
        if (limitRange !== null)
            rows.push([
                "Limit range",
                `${formatPercent100ths(limitRange.min)} – ${formatPercent100ths(limitRange.max)}`,
            ]);
        if (translationDirection !== null)
            rows.push([
                "Translation",
                TRANSLATION_DIRECTION_LABELS[translationDirection] ?? `#${translationDirection}`,
            ]);
        if (rotationAxis !== null)
            rows.push(["Rotation axis", ROTATION_AXIS_LABELS[rotationAxis] ?? `#${rotationAxis}`]);
        if (overflow !== null) rows.push(["Overflow", OVERFLOW_LABELS[overflow] ?? `#${overflow}`]);
        if (modulationType !== null)
            rows.push(["Modulation", MODULATION_TYPE_LABELS[modulationType] ?? `#${modulationType}`]);

        if (rows.length === 0) return nothing;
        return html`
            <div class="static-info">
                ${rows.map(
                    ([label, value]) => html`
                        <div class="static-info-row">
                            <span class="muted">${label}:</span>
                            <span>${value}</span>
                        </div>
                    `,
                )}
            </div>
        `;
    }

    private async _handleSetTarget() {
        await setTarget(this.client, this.node.node_id, this.endpoint, {
            position: this._setTargetPosition !== "" ? Math.round(Number(this._setTargetPosition) * 100) : undefined,
            latch: this._setTargetLatch !== "" ? this._setTargetLatch === "true" : undefined,
            speed: this._setTargetSpeed !== "" ? Number(this._setTargetSpeed) : undefined,
        });
    }

    private async _handleStep() {
        await sendStep(this.client, this.node.node_id, this.endpoint, {
            direction: Number(this._stepDirection),
            numberOfSteps: this._stepCount,
            speed: this._stepSpeed !== "" ? Number(this._stepSpeed) : undefined,
        });
    }

    static override styles = [
        ...(Array.isArray(BaseClusterCommands.styles) ? BaseClusterCommands.styles : [BaseClusterCommands.styles]),
        css`
            .muted {
                color: var(--md-sys-color-on-surface-variant);
            }
            .states-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                gap: 16px;
                padding-bottom: 12px;
            }
            .state-block {
                padding: 8px 12px;
                border-radius: 8px;
                background: var(--md-sys-color-surface-container-highest);
                border-left: 3px solid var(--md-sys-color-outline-variant);
            }
            .state-block--target {
                border-left-color: var(--md-sys-color-primary);
            }
            .state-block-header {
                font-weight: 500;
                margin-bottom: 6px;
            }
            .state-block--target .state-block-header {
                color: var(--md-sys-color-primary);
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
            .static-info {
                display: flex;
                flex-direction: column;
                gap: 4px;
                border-top: 1px solid var(--md-sys-color-outline-variant);
                border-bottom: 1px solid var(--md-sys-color-outline-variant);
                padding: 12px 0;
                margin-bottom: 12px;
            }
            .static-info-row {
                display: flex;
                gap: 6px;
            }
            .set-target,
            .step {
                border-top: 1px solid var(--md-sys-color-outline-variant);
                padding-top: 12px;
            }
            .step {
                margin-top: 12px;
            }
            .set-target-header,
            .step-header {
                font-weight: 500;
                margin-bottom: 8px;
            }
            .set-target-controls,
            .step-controls {
                display: flex;
                align-items: center;
                gap: 12px;
                flex-wrap: wrap;
            }
            .set-target-controls md-outlined-text-field,
            .step-controls md-outlined-text-field {
                width: 140px;
            }
            /* md-outlined-select's own shadow styles set :host{min-width:210px}, which wins over a plain
               external width/min-width; !important is required to match the text fields' width. */
            .set-target-controls md-outlined-select,
            .step-controls md-outlined-select {
                width: 140px !important;
                min-width: 140px !important;
            }
        `,
    ];
}

registerClusterCommands(CLOSURE_DIMENSION_CLUSTER_ID, "closure-dimension-cluster-commands");

declare global {
    interface HTMLElementTagNameMap {
        "closure-dimension-cluster-commands": ClosureDimensionClusterCommands;
    }
}
