/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/outlined-button";
import { css, type CSSResultGroup, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { handleAsync } from "../../../util/async-handler.js";
import { errorText } from "../../../util/error-text.js";
import {
    CALIBRATION_IN_PROGRESS,
    IKEA_VALVE_CALIBRATION_CLUSTER_ID,
    valveCalibrationInfo,
} from "../../../util/ikea-valve-calibration.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

@customElement("ikea-valve-calibration-cluster-commands")
class IkeaValveCalibrationClusterCommands extends BaseClusterCommands {
    @state() private _busy = false;
    @state() private _error?: string;
    private _context?: string;
    private _invokeGeneration = 0;

    override willUpdate(changedProperties: Map<string, unknown>) {
        super.willUpdate(changedProperties);
        if (!this.node) return;
        const context = `${String(this.node.node_id)}/${this.endpoint}`;
        if (this._context !== undefined && this._context !== context) {
            this._error = undefined;
            this._busy = false;
            this._invokeGeneration++;
        }
        this._context = context;
    }

    override render() {
        if (!this.node || this.cluster !== IKEA_VALVE_CALIBRATION_CLUSTER_ID) return nothing;
        const { status, lastError } = valveCalibrationInfo(this.node.attributes, this.endpoint);
        const inProgress = status?.value === CALIBRATION_IN_PROGRESS;

        return html`
            <details class="command-panel" open>
                <summary>Valve Calibration</summary>
                <div class="command-content">
                    <dl class="info-grid">
                        <dt>Status</dt>
                        <dd>${status?.label ?? "—"}</dd>
                        <dt>Last error</dt>
                        <dd class=${lastError?.isError ? "error" : ""}>${lastError?.label ?? "—"}</dd>
                    </dl>
                    <div class="command-row">
                        <md-outlined-button
                            ?disabled=${this._busy || inProgress || !this.node.available}
                            @click=${handleAsync(() => this._triggerCalibration())}
                        >
                            Start calibration
                        </md-outlined-button>
                    </div>
                    ${this._error ? html`<div class="result-error" role="alert">${this._error}</div>` : nothing}
                </div>
            </details>
        `;
    }

    private async _triggerCalibration() {
        const node = this.node;
        const endpoint = this.endpoint;
        const generation = ++this._invokeGeneration;
        const isCurrent = () => this._invokeGeneration === generation && this.isSameContext(node, endpoint);
        this._busy = true;
        this._error = undefined;
        try {
            await this.client.deviceCommand(
                node.node_id,
                endpoint,
                IKEA_VALVE_CALIBRATION_CLUSTER_ID,
                "TriggerCalibration",
                {},
            );
        } catch (err) {
            if (isCurrent()) this._error = `Start calibration: ${errorText(err)}`;
        } finally {
            if (isCurrent()) this._busy = false;
        }
    }

    static override styles: CSSResultGroup = [
        BaseClusterCommands.styles,
        css`
            .info-grid {
                display: grid;
                grid-template-columns: auto 1fr;
                gap: 6px 16px;
                margin: 0 0 12px 0;
            }
            .info-grid dt {
                color: var(--text-color, rgba(0, 0, 0, 0.6));
                font-size: 13px;
            }
            .info-grid dd {
                margin: 0;
                font-weight: 500;
            }
            .info-grid dd.error {
                color: var(--md-sys-color-error);
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

registerClusterCommands(IKEA_VALVE_CALIBRATION_CLUSTER_ID, "ikea-valve-calibration-cluster-commands", {
    renderWhenOffline: true,
});

declare global {
    interface HTMLElementTagNameMap {
        "ikea-valve-calibration-cluster-commands": IkeaValveCalibrationClusterCommands;
    }
}
