/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/outlined-button";
import "@material/web/iconbutton/outlined-icon-button";
import {
    mdiArrowDown,
    mdiArrowLeft,
    mdiArrowRight,
    mdiArrowUp,
    mdiCircleMedium,
    mdiContentSaveOutline,
    mdiMinus,
    mdiPencil,
    mdiPlus,
    mdiTrashCan,
} from "@mdi/js";
import { css, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import "../../../components/ha-svg-icon.js";
import { showAlertDialog, showPromptDialog } from "../../../components/dialog-box/show-dialog-box.js";
import { handleAsync, handleAsyncEvent } from "../../../util/async-handler.js";
import {
    AVSUM_CLUSTER_ID,
    clampMptzDelta,
    moveToPreset,
    readDptzStreams,
    readFeatures,
    readMovementState,
    readPosition,
    readPresets,
    readRanges,
    relativeMove,
    removePreset,
    savePreset,
} from "../../../util/avsum.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

@customElement("avsum-cluster-commands")
class AvsumClusterCommands extends BaseClusterCommands {
    private _unsubscribeNodes?: () => void;
    @state() private _toast: string | null = null;
    private _toastTimer?: ReturnType<typeof setTimeout>;
    @state() private _newPresetName = "";

    override updated(changedProperties: Map<string, unknown>) {
        super.updated(changedProperties);
        if (changedProperties.has("client") && this.client && !this._unsubscribeNodes) {
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
                                      aria-label="Tilt up"
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
                                      aria-label="Pan left"
                                      @click=${handleAsyncEvent((e: MouseEvent) =>
                                          this._move({ panDelta: this._stepFromEvent(e, -10) }),
                                      )}
                                  >
                                      <ha-svg-icon .path=${mdiArrowLeft}></ha-svg-icon>
                                  </md-outlined-icon-button>
                                  <span class="dpad-center" aria-hidden="true">
                                      <ha-svg-icon .path=${mdiCircleMedium}></ha-svg-icon>
                                  </span>
                                  <md-outlined-icon-button
                                      ?disabled=${!features.mPan || movement === "moving"}
                                      title="Pan right (Shift = fine)"
                                      aria-label="Pan right"
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
                                      aria-label="Tilt down"
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
                                            aria-label="Zoom in"
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
                                            aria-label="Zoom out"
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
                    ${features.mPresets
                        ? (() => {
                              const { items, max } = readPresets(this.node, this.endpoint);
                              return html`
                                  <div class="presets-frame">
                                      <div class="presets-header">
                                          <span>Presets</span>
                                          <span class="muted small">${items.length} / ${max}</span>
                                      </div>
                                      <div class="chip-row">
                                          ${items.map(
                                              p => html`<button
                                                  class="chip"
                                                  title="p=${this._fmtDeg(p.settings.pan ?? 0)} · t=${this._fmtDeg(
                                                      p.settings.tilt ?? 0,
                                                  )} · z=${p.settings.zoom ?? 1}×"
                                                  @click=${handleAsync(() => this._goPreset(p.presetId))}
                                              >
                                                  ${p.name}
                                              </button>`,
                                          )}
                                          ${items.length === 0
                                              ? html`<span class="muted small">No presets saved.</span>`
                                              : nothing}
                                      </div>
                                      <details class="manager">
                                          <summary>Manage presets…</summary>
                                          ${items.map(
                                              p => html`<div class="preset-row">
                                                  <span class="pid">#${p.presetId}</span>
                                                  <span class="pname">${p.name}</span>
                                                  <span class="pcoord">
                                                      p=${this._fmtDeg(p.settings.pan ?? 0)} ·
                                                      t=${this._fmtDeg(p.settings.tilt ?? 0)} ·
                                                      z=${p.settings.zoom ?? 1}×
                                                  </span>
                                                  <span class="grow"></span>
                                                  <md-outlined-icon-button
                                                      title="Overwrite with current MPTZ"
                                                      @click=${handleAsync(() => this._savePresetUpdate(p.presetId))}
                                                  >
                                                      <ha-svg-icon .path=${mdiContentSaveOutline}></ha-svg-icon>
                                                  </md-outlined-icon-button>
                                                  <md-outlined-icon-button
                                                      title="Rename (also overwrites position with current MPTZ)"
                                                      aria-label="Rename preset"
                                                      @click=${handleAsync(() =>
                                                          this._renamePreset(p.presetId, p.name),
                                                      )}
                                                  >
                                                      <ha-svg-icon .path=${mdiPencil}></ha-svg-icon>
                                                  </md-outlined-icon-button>
                                                  <md-outlined-icon-button
                                                      title="Remove"
                                                      @click=${handleAsync(() =>
                                                          this._removePreset(p.presetId, p.name),
                                                      )}
                                                  >
                                                      <ha-svg-icon .path=${mdiTrashCan}></ha-svg-icon>
                                                  </md-outlined-icon-button>
                                              </div>`,
                                          )}
                                          <div class="add-bar">
                                              <input
                                                  class="add-input"
                                                  placeholder="New preset name…"
                                                  .value=${this._newPresetName}
                                                  @input=${(e: Event) =>
                                                      (this._newPresetName = (e.target as HTMLInputElement).value)}
                                              />
                                              <md-outlined-button
                                                  ?disabled=${!this._newPresetName.trim() || items.length >= max}
                                                  @click=${handleAsync(() => this._saveNewPreset())}
                                              >
                                                  Save current MPTZ
                                              </md-outlined-button>
                                          </div>
                                      </details>
                                  </div>
                              `;
                          })()
                        : nothing}
                    ${features.dptz
                        ? (() => {
                              const streams = readDptzStreams(this.node, this.endpoint);
                              return html`<div class="dptz-note">
                                  Digital PTZ: <b>${streams.length}</b> active stream${streams.length === 1 ? "" : "s"}
                                  <span class="muted small">(controls available during live view)</span>
                              </div>`;
                          })()
                        : nothing}
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
        this._scheduleToastClear();
    }

    private _isBusy(err: unknown): boolean {
        const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
        return msg.includes("busy");
    }

    private _stepFromEvent(e: MouseEvent, base: number): number {
        return e.shiftKey ? Math.sign(base) : base;
    }

    private async _move(delta: { panDelta?: number; tiltDelta?: number; zoomDelta?: number }) {
        const node = this.node;
        const endpoint = this.endpoint;
        const clamped = clampMptzDelta(delta, readPosition(node, endpoint), readRanges(node, endpoint));
        try {
            await relativeMove(this.client, node.node_id, endpoint, clamped);
        } catch (err) {
            if (!this.isSameContext(node, endpoint)) return;
            if (this._isBusy(err)) {
                this._showBusy();
                return;
            }
            showAlertDialog({ title: "Move failed", text: err instanceof Error ? err.message : String(err) });
        }
    }

    private async _goPreset(presetId: number) {
        const node = this.node;
        const endpoint = this.endpoint;
        try {
            await moveToPreset(this.client, node.node_id, endpoint, presetId);
        } catch (err) {
            if (!this.isSameContext(node, endpoint)) return;
            const msg = err instanceof Error ? err.message : String(err);
            if (this._isBusy(err)) return this._showBusy();
            if (msg.toLowerCase().includes("not_found")) {
                this._toast = "Preset removed";
                this._scheduleToastClear();
                return;
            }
            showAlertDialog({ title: "Move failed", text: msg });
        }
    }

    private _scheduleToastClear() {
        if (this._toastTimer) clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            this._toast = null;
        }, 2000);
    }

    private async _savePresetUpdate(presetId: number) {
        if (!this.node) return;
        const node = this.node;
        const endpoint = this.endpoint;
        const preset = readPresets(node, endpoint).items.find(p => p.presetId === presetId);
        if (!preset) return;
        try {
            await savePreset(this.client, node.node_id, endpoint, preset.name, presetId);
        } catch (err) {
            if (this.isSameContext(node, endpoint)) {
                showAlertDialog({ title: "Update failed", text: err instanceof Error ? err.message : String(err) });
            }
        }
    }

    private async _renamePreset(presetId: number, currentName: string) {
        const node = this.node;
        const endpoint = this.endpoint;
        const next = window.prompt("New name (max 32 chars)", currentName);
        if (typeof next !== "string" || !next.trim()) return;
        try {
            await savePreset(this.client, node.node_id, endpoint, next.trim().slice(0, 32), presetId);
        } catch (err) {
            if (this.isSameContext(node, endpoint)) {
                showAlertDialog({ title: "Rename failed", text: err instanceof Error ? err.message : String(err) });
            }
        }
    }

    private async _removePreset(presetId: number, name: string) {
        const node = this.node;
        const endpoint = this.endpoint;
        const ok = await showPromptDialog({
            title: "Remove preset",
            text: `Remove "${name}"?`,
            confirmText: "Remove",
        });
        if (!ok || !this.isSameContext(node, endpoint)) return;
        try {
            await removePreset(this.client, node.node_id, endpoint, presetId);
        } catch (err) {
            if (this.isSameContext(node, endpoint)) {
                showAlertDialog({ title: "Remove failed", text: err instanceof Error ? err.message : String(err) });
            }
        }
    }

    private async _saveNewPreset() {
        if (!this.node) return;
        const node = this.node;
        const endpoint = this.endpoint;
        const name = this._newPresetName.trim().slice(0, 32);
        if (!name) return;
        try {
            await savePreset(this.client, node.node_id, endpoint, name);
            if (this.isSameContext(node, endpoint)) this._newPresetName = "";
        } catch (err) {
            if (!this.isSameContext(node, endpoint)) return;
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.toLowerCase().includes("resource_exhausted")) {
                const max = readPresets(node, endpoint).max;
                this._toast = `Preset list full (${max})`;
                this._scheduleToastClear();
                return;
            }
            showAlertDialog({ title: "Save failed", text: msg });
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
            md-outlined-icon-button {
                --md-outlined-icon-button-icon-color: var(--md-sys-color-on-surface);
                --md-outlined-icon-button-outline-color: var(--md-sys-color-outline);
            }
            md-outlined-icon-button[disabled] {
                opacity: 0.6;
            }
            .dpad-grid {
                display: grid;
                grid-template-columns: 40px 40px 40px;
                grid-template-rows: 40px 40px 40px;
                gap: 4px;
            }
            .dpad-center {
                display: grid;
                place-items: center;
                color: var(--md-sys-color-on-surface-variant);
                opacity: 0.4;
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
            .presets-frame {
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid var(--md-sys-color-outline-variant);
            }
            .presets-header {
                display: flex;
                justify-content: space-between;
                font-weight: 500;
                margin-bottom: 8px;
            }
            .chip-row {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
                margin-bottom: 8px;
            }
            .chip {
                padding: 6px 14px;
                border-radius: 16px;
                background: var(--md-sys-color-primary-container);
                color: var(--md-sys-color-on-primary-container);
                border: none;
                cursor: pointer;
                font-size: 0.85rem;
                font-family: inherit;
            }
            .chip:hover {
                filter: brightness(1.05);
            }
            details.manager summary {
                cursor: pointer;
                font-size: 0.85rem;
                color: var(--md-sys-color-on-surface-variant);
                padding: 4px 0;
            }
            .preset-row {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 4px 8px;
                border-radius: 4px;
            }
            .preset-row:hover {
                background: var(--md-sys-color-surface-container-high);
            }
            .pid {
                font-family: var(--monospace-font, monospace);
                color: var(--md-sys-color-on-surface-variant);
                font-size: 0.85rem;
                min-width: 32px;
            }
            .pname {
                font-weight: 500;
            }
            .pcoord {
                font-family: var(--monospace-font, monospace);
                font-size: 0.75rem;
                color: var(--md-sys-color-on-surface-variant);
            }
            .grow {
                flex: 1;
            }
            .add-bar {
                display: flex;
                gap: 8px;
                align-items: center;
                padding-top: 8px;
                margin-top: 8px;
                border-top: 1px solid var(--md-sys-color-outline-variant);
            }
            .add-input {
                flex: 1;
                padding: 6px 8px;
                border: 1px solid var(--md-sys-color-outline);
                border-radius: 4px;
                background: var(--md-sys-color-surface);
                color: var(--md-sys-color-on-surface);
                font-family: inherit;
                font-size: 0.85rem;
            }
            .dptz-note {
                margin-top: 12px;
                padding: 8px 12px;
                background: var(--md-sys-color-surface-container);
                border-radius: 4px;
                font-size: 0.85rem;
            }
            .dptz-note b {
                font-weight: 500;
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
