/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, html, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { AVSUM_CLUSTER_ID, readFeatures, readMovementState, readPosition, readRanges } from "../../../util/avsum.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

@customElement("avsum-cluster-commands")
class AvsumClusterCommands extends BaseClusterCommands {
    private _unsubscribeNodes?: () => void;

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
                </div>
            </details>
        `;
    }

    private _fmtDeg(v: number): string {
        const sign = v >= 0 ? "+" : "";
        return `${sign}${v}°`;
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
        `,
    ];
}

registerClusterCommands(AVSUM_CLUSTER_ID, "avsum-cluster-commands");

declare global {
    interface HTMLElementTagNameMap {
        "avsum-cluster-commands": AvsumClusterCommands;
    }
}
