/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, html, nothing, type CSSResultGroup, type TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { renderSemanticTagChips } from "../../../components/semantic-tag-chips.js";
import {
    AMBIENT_CONTEXT_SENSING_CLUSTER_ID,
    ambientContextSensingInfo,
    type AmbientContextSensingInfo,
} from "../../../util/ambient-context-sensing.js";
import { formatEpochTime } from "../../../util/time.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

/**
 * Read-only decoding panel for the AmbientContextSensing cluster (ID: 0x0431 / 1073).
 */
@customElement("ambient-context-sensing-cluster-commands")
export class AmbientContextSensingClusterCommands extends BaseClusterCommands {
    override render() {
        if (!this.node || this.cluster !== AMBIENT_CONTEXT_SENSING_CLUSTER_ID) return nothing;
        const info = ambientContextSensingInfo(this.node.attributes, this.endpoint);
        if (!info.supported) return nothing;

        return html`
            <details class="command-panel" open>
                <summary>Ambient Context Sensing</summary>
                <div class="command-content">
                    ${this._renderDetectionBadges(info)} ${this._renderAmbientContextType(info)}
                    ${this._renderObjectCounting(info)} ${this._renderPredictedActivity(info)}
                    ${this._renderGeneralInfo(info)}
                </div>
            </details>
        `;
    }

    private _renderDetectionBadges(info: AmbientContextSensingInfo): TemplateResult | typeof nothing {
        const badges: TemplateResult[] = [];
        if (info.features.humanActivity && info.humanActivityDetected !== undefined) {
            badges.push(this._badge("Human activity", info.humanActivityDetected));
        }
        if (info.features.objectIdentification && info.objectIdentified !== undefined) {
            badges.push(this._badge("Object identified", info.objectIdentified));
        }
        if (info.features.soundIdentification && info.audioContextDetected !== undefined) {
            badges.push(this._badge("Audio context", info.audioContextDetected));
        }
        if (badges.length === 0) return nothing;
        return html`<div class="badge-row">${badges}</div>`;
    }

    private _badge(label: string, active: boolean): TemplateResult {
        return html`<span class="badge ${active ? "active" : ""}">${label}: ${active ? "Yes" : "No"}</span>`;
    }

    private _renderAmbientContextType(info: AmbientContextSensingInfo): TemplateResult | typeof nothing {
        if (info.ambientContextType.length === 0 && info.ambientContextTypeSupported.length === 0) return nothing;
        return html`
            <div class="info-section">
                ${
                    info.ambientContextType.length > 0
                        ? html`
                              <div class="info-section-header">Detected context</div>
                              ${info.ambientContextType.map(entry => renderSemanticTagChips(entry.ambientContextSensed))}
                          `
                        : nothing
                }
                ${
                    info.ambientContextTypeSupported.length > 0
                        ? html`
                              <div class="info-section-header">Supported context types</div>
                              ${renderSemanticTagChips(info.ambientContextTypeSupported)}
                          `
                        : nothing
                }
            </div>
        `;
    }

    private _renderObjectCounting(info: AmbientContextSensingInfo): TemplateResult | typeof nothing {
        if (!info.features.objectCounting) return nothing;
        return html`
            <div class="info-section">
                <div class="info-section-header">Object counting</div>
                <dl class="info-grid">
                    ${
                        info.objectCountThresholdReached !== undefined
                            ? html`<dt>Threshold reached</dt>
                                  <dd>${info.objectCountThresholdReached ? "Yes" : "No"}</dd>`
                            : nothing
                    }
                    ${
                        info.objectCount !== undefined
                            ? html`<dt>Object count</dt>
                                  <dd>${info.objectCount}</dd>`
                            : nothing
                    }
                    ${
                        info.objectCountConfig?.countingObject
                            ? html`<dt>Counting object</dt>
                                  <dd>${renderSemanticTagChips([info.objectCountConfig.countingObject])}</dd>`
                            : nothing
                    }
                    ${
                        info.objectCountConfig?.objectCountThreshold !== undefined
                            ? html`<dt>Count threshold</dt>
                                  <dd>${info.objectCountConfig.objectCountThreshold}</dd>`
                            : nothing
                    }
                </dl>
            </div>
        `;
    }

    private _renderPredictedActivity(info: AmbientContextSensingInfo): TemplateResult | typeof nothing {
        if (!info.features.predictedActivity || info.predictedActivity.length === 0) return nothing;
        return html`
            <div class="info-section">
                <div class="info-section-header">Predicted activity</div>
                <ul class="predicted-list">
                    ${info.predictedActivity.map(
                        entry => html`
                            <li class="predicted-row">
                                <span class="predicted-time">
                                    ${entry.startTimestamp !== undefined ? formatEpochTime(entry.startTimestamp) : "?"}
                                    – ${entry.endTimestamp !== undefined ? formatEpochTime(entry.endTimestamp) : "?"}
                                </span>
                                ${renderSemanticTagChips(entry.ambientContextType)}
                                ${
                                    entry.crowdDetected !== undefined
                                        ? html`<span class="muted small"
                                              >Crowd:
                                              ${entry.crowdDetected ? "Yes" : "No"}${
                                                  entry.crowdCount !== undefined ? ` (${entry.crowdCount})` : ""
                                              }</span
                                          >`
                                        : nothing
                                }
                                ${
                                    entry.confidence !== undefined
                                        ? html`<span class="muted small">Confidence: ${entry.confidence}%</span>`
                                        : nothing
                                }
                            </li>
                        `,
                    )}
                </ul>
            </div>
        `;
    }

    private _renderGeneralInfo(info: AmbientContextSensingInfo): TemplateResult | typeof nothing {
        const hasInfo =
            info.simultaneousDetectionLimit !== undefined ||
            info.holdTime !== undefined ||
            info.holdTimeLimits !== undefined;
        if (!hasInfo) return nothing;
        return html`
            <div class="info-section">
                <dl class="info-grid">
                    ${
                        info.simultaneousDetectionLimit !== undefined
                            ? html`<dt>Simultaneous detection limit</dt>
                                  <dd>${info.simultaneousDetectionLimit}</dd>`
                            : nothing
                    }
                    ${
                        info.holdTime !== undefined
                            ? html`<dt>Hold time</dt>
                                  <dd>${info.holdTime} s</dd>`
                            : nothing
                    }
                    ${
                        info.holdTimeLimits
                            ? html`<dt>Hold time limits</dt>
                                  <dd>
                                      ${info.holdTimeLimits.holdTimeMin ?? "?"} –
                                      ${info.holdTimeLimits.holdTimeMax ?? "?"} s (default
                                      ${info.holdTimeLimits.holdTimeDefault ?? "?"} s)
                                  </dd>`
                            : nothing
                    }
                </dl>
            </div>
        `;
    }

    static override styles: CSSResultGroup = [
        BaseClusterCommands.styles,
        css`
            .badge-row {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                margin-bottom: 12px;
            }
            .badge {
                padding: 2px 8px;
                border-radius: 4px;
                background: var(--md-sys-color-surface-container-high);
                color: var(--md-sys-color-on-surface-variant);
                font-size: 0.8rem;
            }
            .badge.active {
                background: var(--md-sys-color-primary-container);
                color: var(--md-sys-color-on-primary-container);
            }
            .info-section {
                margin-bottom: 12px;
            }
            .info-section-header {
                font-weight: 500;
                font-size: 0.85rem;
                color: var(--md-sys-color-on-surface-variant);
                margin: 8px 0 4px;
            }
            .info-grid {
                display: grid;
                grid-template-columns: auto 1fr;
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
            .predicted-list {
                list-style: none;
                margin: 0;
                padding: 0;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .predicted-row {
                display: flex;
                flex-direction: column;
                gap: 4px;
                padding: 8px 12px;
                background: var(--md-sys-color-surface-container-low);
                border-radius: 8px;
            }
            .predicted-time {
                font-family: var(--monospace-font, monospace);
                font-size: 0.85rem;
            }
            .muted.small {
                font-size: 0.75rem;
                color: var(--md-sys-color-on-surface-variant);
            }
        `,
    ];
}

registerClusterCommands(AMBIENT_CONTEXT_SENSING_CLUSTER_ID, "ambient-context-sensing-cluster-commands", {
    renderWhenOffline: true,
});

declare global {
    interface HTMLElementTagNameMap {
        "ambient-context-sensing-cluster-commands": AmbientContextSensingClusterCommands;
    }
}
