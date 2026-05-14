/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/iconbutton/outlined-icon-button";
import { mdiArrowDown, mdiArrowLeft, mdiArrowRight, mdiArrowUp, mdiCircleMedium, mdiMinus, mdiPlus } from "@mdi/js";
import { css, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import "../../../components/ha-svg-icon.js";
import { showAlertDialog } from "../../../components/dialog-box/show-dialog-box.js";
import { handleAsyncEvent } from "../../../util/async-handler.js";
import {
    AVSUM_CLUSTER_ID,
    readFeatures,
    readMovementState,
    readPosition,
    readRanges,
    relativeMove,
} from "../../../util/avsum.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

@customElement("avsum-cluster-commands")
class AvsumClusterCommands extends BaseClusterCommands {
    private _unsubscribeNodes?: () => void;
    @state() private _toast: string | null = null;
    private _toastTimer?: ReturnType<typeof setTimeout>;

    override connectedCallback() {
        super.connectedCallback();
        this._unsubscribeNodes = this.client.addEventListener("nodes_changed", () => this.requestUpdate());
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubscribeNodes?.();
    }

    override render() {
        if (!this.node || this.cluster !== AVSUM_CLUSTER_ID) return nothing;
        const features = readFeatures(this.node, this.endpoint);
        const pos = readPosition(this.node, this.endpoint);
        const ranges = readRanges(this.node, this.endpoint);
        const movement = readMovementState(this.node, this.endpoint);

        return html`
            <details class="command-panel" open>
                <summary>Camera AV Settings — Pan / Tilt / Zoom</summary>
                <div class="command-content">
                    <div class="readout">
                        ${features.mPan && pos.pan !== null
                            ? html`<span><b>Pan</b> ${this._fmtDeg(pos.pan)}</span>`
                            : nothing}
                        ${features.mTilt && pos.tilt !== null
                            ? html`<span><b>Tilt</b> ${this._fmtDeg(pos.tilt)}</span>`
                            : nothing}
                        ${features.mZoom && pos.zoom !== null ? html`<span><b>Zoom</b> ${pos.zoom}×</span>` : nothing}
                        ${movement !== "unknown"
                            ? html`<span class="badge ${movement === "moving" ? "moving" : ""}"
                                  >${movement === "moving" ? "Moving…" : "Idle"}</span
                              >`
                            : nothing}
                        ${features.mPan && ranges.panMin !== null && ranges.panMax !== null
                            ? html`<span class="range">P [${ranges.panMin}°, ${ranges.panMax}°]</span>`
                            : nothing}
                        ${features.mTilt && ranges.tiltMin !== null && ranges.tiltMax !== null
                            ? html`<span class="range">T [${ranges.tiltMin}°, ${ranges.tiltMax}°]</span>`
                            : nothing}
                        ${features.mZoom && ranges.zoomMax !== null
                            ? html`<span class="range">Z [1×, ${ranges.zoomMax}×]</span>`
                            : nothing}
                    </div>
                    ${features.mPan || features.mTilt || features.mZoom
                        ? html`<div class="dpad-row">
                              <div class="dpad-grid">
                                  <span></span>
                                  <md-outlined-icon-button
                                      ?disabled=${!features.mTilt || movement === "moving"}
                                      title="Tilt up (Shift = fine)"
                                      @click=${handleAsyncEvent((e: MouseEvent) =>
                                          this._move({ tiltDelta: this._stepFromEvent(e, 10) }),
                                      )}
                                  >
                                      <ha-svg-icon .path=${mdiArrowUp}></ha-svg-icon>
                                  </md-outlined-icon-button>
                                  <span></span>
                                  <md-outlined-icon-button
                                      ?disabled=${!features.mPan || movement === "moving"}
                                      title="Pan left (Shift = fine)"
                                      @click=${handleAsyncEvent((e: MouseEvent) =>
                                          this._move({ panDelta: this._stepFromEvent(e, -10) }),
                                      )}
                                  >
                                      <ha-svg-icon .path=${mdiArrowLeft}></ha-svg-icon>
                                  </md-outlined-icon-button>
                                  <md-outlined-icon-button disabled title="Center (no spec command)">
                                      <ha-svg-icon .path=${mdiCircleMedium}></ha-svg-icon>
                                  </md-outlined-icon-button>
                                  <md-outlined-icon-button
                                      ?disabled=${!features.mPan || movement === "moving"}
                                      title="Pan right (Shift = fine)"
                                      @click=${handleAsyncEvent((e: MouseEvent) =>
                                          this._move({ panDelta: this._stepFromEvent(e, 10) }),
                                      )}
                                  >
                                      <ha-svg-icon .path=${mdiArrowRight}></ha-svg-icon>
                                  </md-outlined-icon-button>
                                  <span></span>
                                  <md-outlined-icon-button
                                      ?disabled=${!features.mTilt || movement === "moving"}
                                      title="Tilt down (Shift = fine)"
                                      @click=${handleAsyncEvent((e: MouseEvent) =>
                                          this._move({ tiltDelta: this._stepFromEvent(e, -10) }),
                                      )}
                                  >
                                      <ha-svg-icon .path=${mdiArrowDown}></ha-svg-icon>
                                  </md-outlined-icon-button>
                                  <span></span>
                              </div>
                              ${features.mZoom
                                  ? html`<div class="zoom-col">
                                        <md-outlined-icon-button
                                            ?disabled=${movement === "moving"}
                                            title="Zoom in (Shift = fine)"
                                            @click=${handleAsyncEvent((e: MouseEvent) =>
                                                this._move({ zoomDelta: this._stepFromEvent(e, 10) }),
                                            )}
                                        >
                                            <ha-svg-icon .path=${mdiPlus}></ha-svg-icon>
                                        </md-outlined-icon-button>
                                        <span class="muted small">zoom</span>
                                        <md-outlined-icon-button
                                            ?disabled=${movement === "moving"}
                                            title="Zoom out (Shift = fine)"
                                            @click=${handleAsyncEvent((e: MouseEvent) =>
                                                this._move({ zoomDelta: this._stepFromEvent(e, -10) }),
                                            )}
                                        >
                                            <ha-svg-icon .path=${mdiMinus}></ha-svg-icon>
                                        </md-outlined-icon-button>
                                    </div>`
                                  : nothing}
                          </div>`
                        : nothing}
                    ${this._toast ? html`<div class="toast">${this._toast}</div>` : nothing}
                </div>
            </details>
        `;
    }

    private _fmtDeg(v: number): string {
        const sign = v >= 0 ? "+" : "";
        return `${sign}${v}°`;
    }

    private _showBusy() {
        this._toast = "Camera busy";
        if (this._toastTimer) clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            this._toast = null;
        }, 2000);
    }

    private _isBusy(err: unknown): boolean {
        const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
        return msg.includes("busy");
    }

    private _stepFromEvent(e: MouseEvent, base: number): number {
        return e.shiftKey ? Math.sign(base) || 1 : base;
    }

    private async _move(delta: { panDelta?: number; tiltDelta?: number; zoomDelta?: number }) {
        try {
            await relativeMove(this.client, this.node.node_id, this.endpoint, delta);
        } catch (err) {
            if (this._isBusy(err)) {
                this._showBusy();
                return;
            }
            showAlertDialog({ title: "Move failed", text: err instanceof Error ? err.message : String(err) });
        }
    }

    static override styles = [
        ...(Array.isArray(BaseClusterCommands.styles) ? BaseClusterCommands.styles : [BaseClusterCommands.styles]),
        css`
            .readout {
                display: flex;
                align-items: center;
                gap: 16px;
                flex-wrap: wrap;
                font-family: var(--monospace-font, monospace);
                font-size: 0.85rem;
                padding: 4px 0 12px;
            }
            .readout b {
                font-weight: 500;
                color: var(--md-sys-color-on-surface-variant);
                margin-right: 4px;
            }
            .badge {
                padding: 2px 8px;
                border-radius: 4px;
                background: var(--md-sys-color-secondary-container);
                color: var(--md-sys-color-on-secondary-container);
                font-size: 0.75rem;
            }
            .badge.moving {
                background: var(--md-sys-color-primary-container);
                color: var(--md-sys-color-on-primary-container);
            }
            .range {
                color: var(--md-sys-color-on-surface-variant);
                font-size: 0.75rem;
            }
            .dpad-row {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 24px;
                padding: 12px 0;
            }
            .dpad-grid {
                display: grid;
                grid-template-columns: 40px 40px 40px;
                grid-template-rows: 40px 40px 40px;
                gap: 4px;
            }
            .zoom-col {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
            }
            .muted.small {
                font-size: 0.7rem;
                color: var(--md-sys-color-on-surface-variant);
            }
            .muted {
                color: var(--md-sys-color-on-surface-variant);
            }
            .toast {
                margin-top: 8px;
                padding: 6px 12px;
                background: var(--md-sys-color-inverse-surface);
                color: var(--md-sys-color-inverse-on-surface);
                border-radius: 4px;
                font-size: 0.85rem;
                text-align: center;
            }
        `,
    ];
}

registerClusterCommands(AVSUM_CLUSTER_ID, "avsum-cluster-commands");

declare global {
    interface HTMLElementTagNameMap {
        "avsum-cluster-commands": AvsumClusterCommands;
    }
}
