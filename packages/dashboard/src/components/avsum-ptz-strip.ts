/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import "@material/web/iconbutton/icon-button";
import type { MatterClient, MatterNode } from "@matter-server/ws-client";
import { mdiArrowDown, mdiArrowLeft, mdiArrowRight, mdiArrowUp, mdiMinus, mdiPlus } from "@mdi/js";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { clientContext } from "../client/client-context.js";
import { handleAsync, handleAsyncEvent } from "../util/async-handler.js";
import {
    dptzRelativeMove,
    hasAvsumOnEndpoint,
    moveToPreset,
    readFeatures,
    readMovementState,
    readPosition,
    readPresets,
    relativeMove,
} from "../util/avsum.js";
import "./ha-svg-icon.js";

type MoveMode = "mech" | "digital";

@customElement("avsum-ptz-strip")
export class AvsumPtzStrip extends LitElement {
    @consume({ context: clientContext, subscribe: true })
    @property({ attribute: false })
    client?: MatterClient;

    @property({ attribute: false }) nodeId!: number | bigint;
    @property({ type: Number }) endpointId!: number;
    /** Active VideoStreamID for DPTZ moves; required when DPTZ is selected mode. */
    @property({ type: Number, attribute: false }) activeVideoStreamId: number | null = null;
    @property({ type: Object, attribute: false }) sensorSize: { width: number; height: number } | null = null;

    @state() private _mode: MoveMode = "mech";
    @state() private _toast: string | null = null;
    private _unsubscribeNodes?: () => void;
    private _toastTimer?: ReturnType<typeof setTimeout>;

    private get _node(): MatterNode | null {
        if (!this.client) return null;
        return this.client.nodes[String(this.nodeId)] ?? null;
    }

    override connectedCallback() {
        super.connectedCallback();
        if (this.client) {
            this._unsubscribeNodes = this.client.addEventListener("nodes_changed", () => this.requestUpdate());
        }
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubscribeNodes?.();
        if (this._toastTimer) {
            clearTimeout(this._toastTimer);
            this._toastTimer = undefined;
        }
    }

    override render() {
        const node = this._node;
        if (!node || !hasAvsumOnEndpoint(node, this.endpointId)) return nothing;
        const features = readFeatures(node, this.endpointId);
        if (!features.mPan && !features.mTilt && !features.mZoom && !features.dptz && !features.mPresets)
            return nothing;

        const hasMech = features.mPan || features.mTilt || features.mZoom;
        const effective: MoveMode = hasMech && features.dptz ? this._mode : hasMech ? "mech" : "digital";

        const pos = readPosition(node, this.endpointId);
        const movement = readMovementState(node, this.endpointId);
        const presets = features.mPresets ? readPresets(node, this.endpointId).items : [];

        return html`
            <div class="strip">
                ${hasMech || features.dptz
                    ? html`<div class="group movement">
                          <div class="dpad">
                              <span></span>
                              <md-icon-button
                                  ?disabled=${this._isDisabled(effective, "tilt", features, movement)}
                                  title="Tilt up"
                                  @click=${handleAsyncEvent((e: MouseEvent) =>
                                      this._move(effective, "tilt", this._step(e, 10)),
                                  )}
                              >
                                  <ha-svg-icon .path=${mdiArrowUp}></ha-svg-icon>
                              </md-icon-button>
                              <span></span>
                              <md-icon-button
                                  ?disabled=${this._isDisabled(effective, "pan", features, movement)}
                                  title="Pan left"
                                  @click=${handleAsyncEvent((e: MouseEvent) =>
                                      this._move(effective, "pan", this._step(e, -10)),
                                  )}
                              >
                                  <ha-svg-icon .path=${mdiArrowLeft}></ha-svg-icon>
                              </md-icon-button>
                              <span></span>
                              <md-icon-button
                                  ?disabled=${this._isDisabled(effective, "pan", features, movement)}
                                  title="Pan right"
                                  @click=${handleAsyncEvent((e: MouseEvent) =>
                                      this._move(effective, "pan", this._step(e, 10)),
                                  )}
                              >
                                  <ha-svg-icon .path=${mdiArrowRight}></ha-svg-icon>
                              </md-icon-button>
                              <span></span>
                              <md-icon-button
                                  ?disabled=${this._isDisabled(effective, "tilt", features, movement)}
                                  title="Tilt down"
                                  @click=${handleAsyncEvent((e: MouseEvent) =>
                                      this._move(effective, "tilt", this._step(e, -10)),
                                  )}
                              >
                                  <ha-svg-icon .path=${mdiArrowDown}></ha-svg-icon>
                              </md-icon-button>
                              <span></span>
                          </div>
                          <div class="zoom">
                              <md-icon-button
                                  ?disabled=${this._isDisabled(effective, "zoom", features, movement)}
                                  title="Zoom in"
                                  @click=${handleAsyncEvent((e: MouseEvent) =>
                                      this._move(effective, "zoom", this._step(e, 10)),
                                  )}
                              >
                                  <ha-svg-icon .path=${mdiPlus}></ha-svg-icon>
                              </md-icon-button>
                              <md-icon-button
                                  ?disabled=${this._isDisabled(effective, "zoom", features, movement)}
                                  title="Zoom out"
                                  @click=${handleAsyncEvent((e: MouseEvent) =>
                                      this._move(effective, "zoom", this._step(e, -10)),
                                  )}
                              >
                                  <ha-svg-icon .path=${mdiMinus}></ha-svg-icon>
                              </md-icon-button>
                          </div>
                          ${hasMech && features.dptz
                              ? html`<div class="mode-toggle">
                                    <button
                                        class=${this._mode === "mech" ? "active" : ""}
                                        @click=${() => (this._mode = "mech")}
                                    >
                                        Mech
                                    </button>
                                    <button
                                        class=${this._mode === "digital" ? "active" : ""}
                                        @click=${() => (this._mode = "digital")}
                                    >
                                        Digital
                                    </button>
                                </div>`
                              : nothing}
                          ${effective === "digital" && this.activeVideoStreamId === null
                              ? html`<span class="mode-hint">Start stream to enable DPTZ</span>`
                              : nothing}
                      </div>`
                    : nothing}
                ${features.mPresets && presets.length > 0
                    ? html`<div class="group presets">
                          ${presets.map(
                              p => html`<button
                                  class="chip"
                                  title="p=${p.settings.pan ?? 0}° · t=${p.settings.tilt ?? 0}° · z=${p.settings.zoom ??
                                  1}×"
                                  @click=${handleAsync(() => this._handleGoPreset(p.presetId))}
                              >
                                  ${p.name}
                              </button>`,
                          )}
                      </div>`
                    : nothing}
                <div class="group readout">
                    ${features.mPan && pos.pan !== null ? html`<span>Pan ${this._fmt(pos.pan)}°</span>` : nothing}
                    ${features.mTilt && pos.tilt !== null ? html`<span>Tilt ${this._fmt(pos.tilt)}°</span>` : nothing}
                    ${features.mZoom && pos.zoom !== null ? html`<span>Zoom ${pos.zoom}×</span>` : nothing}
                </div>
                ${this._toast ? html`<div class="toast">${this._toast}</div>` : nothing}
            </div>
        `;
    }

    private _fmt(v: number): string {
        return v >= 0 ? `+${v}` : `${v}`;
    }

    private _step(e: MouseEvent, base: number): number {
        return e.shiftKey ? Math.sign(base) : base;
    }

    private _isDisabled(
        mode: MoveMode,
        axis: "pan" | "tilt" | "zoom",
        f: ReturnType<typeof readFeatures>,
        movement: ReturnType<typeof readMovementState>,
    ): boolean {
        if (mode === "mech") {
            if (movement === "moving") return true;
            if (axis === "pan") return !f.mPan;
            if (axis === "tilt") return !f.mTilt;
            return !f.mZoom;
        }
        if (!f.dptz) return true;
        if (this.activeVideoStreamId === null) return true;
        return false;
    }

    private async _move(mode: MoveMode, axis: "pan" | "tilt" | "zoom", step: number) {
        if (!this.client) return;
        try {
            if (mode === "mech") {
                const delta: { panDelta?: number; tiltDelta?: number; zoomDelta?: number } = {};
                if (axis === "pan") delta.panDelta = step;
                else if (axis === "tilt") delta.tiltDelta = step;
                else delta.zoomDelta = step;
                await relativeMove(this.client, this.nodeId, this.endpointId, delta);
            } else {
                if (this.activeVideoStreamId === null) return;
                // step magnitude (10 or 1) scales the sensor-relative pixel delta so Shift gives 1% nudges.
                const scale = step / 10;
                const dx = this.sensorSize ? Math.round(this.sensorSize.width * 0.1 * scale) : Math.round(100 * scale);
                const dy = this.sensorSize ? Math.round(this.sensorSize.height * 0.1 * scale) : Math.round(100 * scale);
                const delta: { deltaX?: number; deltaY?: number; zoomDelta?: number } = {};
                if (axis === "pan") delta.deltaX = dx;
                else if (axis === "tilt") delta.deltaY = dy;
                else delta.zoomDelta = step;
                await dptzRelativeMove(this.client, this.nodeId, this.endpointId, this.activeVideoStreamId, delta);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
            if (msg.includes("busy")) {
                this._toast = "Camera busy";
            } else {
                console.warn("PTZ move failed:", err);
                this._toast = "Move failed";
            }
            this._scheduleToastClear();
        }
    }

    private async _handleGoPreset(presetId: number) {
        if (!this.client) return;
        try {
            await moveToPreset(this.client, this.nodeId, this.endpointId, presetId);
        } catch (err) {
            const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
            if (msg.includes("busy")) {
                this._toast = "Camera busy";
            } else if (msg.includes("not_found")) {
                this._toast = "Preset removed";
            } else {
                console.warn("Preset move failed:", err);
                this._toast = "Move failed";
            }
            this._scheduleToastClear();
        }
    }

    private _scheduleToastClear() {
        if (this._toastTimer) clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            this._toast = null;
        }, 2000);
    }

    static override styles = css`
        :host {
            display: block;
            color: white;
        }
        .strip {
            background: rgba(0, 0, 0, 0.6);
            padding: 8px 12px;
            display: flex;
            gap: 16px;
            align-items: center;
            flex-wrap: wrap;
        }
        .group {
            display: flex;
            align-items: center;
            gap: 8px;
            padding-right: 16px;
            border-right: 1px solid rgba(255, 255, 255, 0.15);
        }
        .group:last-child {
            border-right: none;
        }
        .movement {
            gap: 12px;
        }
        .dpad {
            display: grid;
            grid-template-columns: 32px 32px 32px;
            grid-template-rows: 32px 32px 32px;
            gap: 2px;
        }
        .zoom {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        md-icon-button {
            --md-icon-button-icon-color: white;
            --md-icon-button-state-layer-color: white;
            width: 32px;
            height: 32px;
        }
        md-icon-button[disabled] {
            opacity: 0.55;
        }
        .mode-toggle {
            display: flex;
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            overflow: hidden;
        }
        .mode-toggle button {
            background: transparent;
            border: none;
            padding: 4px 10px;
            cursor: pointer;
            color: rgba(255, 255, 255, 0.7);
            font-size: 0.75rem;
            font-family: inherit;
        }
        .mode-toggle button.active {
            background: rgba(255, 255, 255, 0.2);
            color: white;
        }
        .mode-hint {
            color: rgba(255, 255, 255, 0.6);
            font-size: 0.7rem;
            font-style: italic;
        }
        .presets {
            flex-wrap: wrap;
        }
        .chip {
            padding: 4px 12px;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.15);
            color: white;
            border: none;
            cursor: pointer;
            font-size: 0.8rem;
            font-family: inherit;
        }
        .chip:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        .readout {
            color: rgba(255, 255, 255, 0.85);
            font-family: var(--monospace-font, monospace);
            font-size: 0.8rem;
            gap: 12px;
        }
        .toast {
            background: rgba(0, 0, 0, 0.85);
            color: white;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 0.8rem;
            margin-left: auto;
        }
        @media (max-width: 900px) {
            .readout {
                display: none;
            }
        }
    `;
}

declare global {
    interface HTMLElementTagNameMap {
        "avsum-ptz-strip": AvsumPtzStrip;
    }
}
