/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, html, nothing, type CSSResultGroup } from "lit";
import { customElement } from "lit/decorators.js";
import { formatDuration } from "../../../util/duration.js";
import { POWER_SOURCE_CLUSTER_ID, powerSourceInfo } from "../../../util/power-source.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

/**
 * Read-only decoding panel for the PowerSource cluster (ID: 0x2F / 47).
 */
@customElement("power-source-cluster-commands")
export class PowerSourceClusterCommands extends BaseClusterCommands {
    override render() {
        if (!this.node || this.cluster !== POWER_SOURCE_CLUSTER_ID) return nothing;
        const info = powerSourceInfo(this.node.attributes, this.endpoint);
        if (!info.supported) return nothing;

        return html`
            <details class="command-panel" open>
                <summary>Power Source</summary>
                <div class="command-content">
                    <dl class="info-grid">
                        ${
                            info.status
                                ? html`<dt>Status</dt>
                                      <dd>${info.status}</dd>`
                                : nothing
                        }
                        ${
                            info.order !== undefined
                                ? html`<dt>Order</dt>
                                      <dd>${info.order}</dd>`
                                : nothing
                        }
                        ${
                            info.description
                                ? html`<dt>Description</dt>
                                      <dd>${info.description}</dd>`
                                : nothing
                        }
                        ${this._renderWired(info)} ${this._renderBattery(info)}
                    </dl>
                </div>
            </details>
        `;
    }

    private _renderWired(info: ReturnType<typeof powerSourceInfo>) {
        if (!info.wiredSupported) return nothing;
        return html`
            <dt>Wired source</dt>
            <dd>${info.wiredCurrentType ?? "Supported"}</dd>
            ${
                info.wiredPresent !== undefined
                    ? html`<dt>Present</dt>
                          <dd>${info.wiredPresent ? "Yes" : "No"}</dd>`
                    : nothing
            }
            ${
                info.wiredAssessedInputVoltageV != null
                    ? html`<dt>Input voltage</dt>
                          <dd>${info.wiredAssessedInputVoltageV} V</dd>`
                    : nothing
            }
            ${
                info.wiredAssessedCurrentA != null
                    ? html`<dt>Input current</dt>
                          <dd>${info.wiredAssessedCurrentA} A</dd>`
                    : nothing
            }
            ${
                info.wiredAssessedInputFrequencyHz != null
                    ? html`<dt>Input frequency</dt>
                          <dd>${info.wiredAssessedInputFrequencyHz} Hz</dd>`
                    : nothing
            }
            ${
                info.wiredNominalVoltageV !== undefined
                    ? html`<dt>Nominal voltage</dt>
                          <dd>${info.wiredNominalVoltageV} V</dd>`
                    : nothing
            }
            ${
                info.wiredMaximumCurrentA !== undefined
                    ? html`<dt>Maximum current</dt>
                          <dd>${info.wiredMaximumCurrentA} A</dd>`
                    : nothing
            }
        `;
    }

    private _renderBattery(info: ReturnType<typeof powerSourceInfo>) {
        if (!info.batterySupported) return nothing;
        return html`
            <dt>Battery</dt>
            <dd>${info.batPercentRemaining != null ? `${info.batPercentRemaining}%` : "Supported"}</dd>
            ${
                info.batPresent !== undefined
                    ? html`<dt>Present</dt>
                          <dd>${info.batPresent ? "Yes" : "No"}</dd>`
                    : nothing
            }
            ${
                info.batChargeLevel
                    ? html`<dt>Charge level</dt>
                          <dd>${info.batChargeLevel}</dd>`
                    : nothing
            }
            ${
                info.batChargeState
                    ? html`<dt>Charge state</dt>
                          <dd>${info.batChargeState}</dd>`
                    : nothing
            }
            ${
                info.batVoltageV != null
                    ? html`<dt>Voltage</dt>
                          <dd>${info.batVoltageV} V</dd>`
                    : nothing
            }
            ${
                info.batChargingCurrentA != null
                    ? html`<dt>Charging current</dt>
                          <dd>${info.batChargingCurrentA} A</dd>`
                    : nothing
            }
            ${
                info.batTimeRemainingS != null
                    ? html`<dt>Time remaining</dt>
                          <dd>${formatDuration(info.batTimeRemainingS)}</dd>`
                    : nothing
            }
            ${
                info.batTimeToFullChargeS != null
                    ? html`<dt>Time to full charge</dt>
                          <dd>${formatDuration(info.batTimeToFullChargeS)}</dd>`
                    : nothing
            }
            ${
                info.batCapacityMAh !== undefined
                    ? html`<dt>Capacity</dt>
                          <dd>${info.batCapacityMAh} mAh</dd>`
                    : nothing
            }
            ${
                info.batQuantity !== undefined
                    ? html`<dt>Quantity</dt>
                          <dd>${info.batQuantity}</dd>`
                    : nothing
            }
            ${
                info.batReplaceability
                    ? html`<dt>Replaceability</dt>
                          <dd>${info.batReplaceability}</dd>`
                    : nothing
            }
            ${
                info.batReplacementNeeded === true
                    ? html`<dt>Replacement needed</dt>
                          <dd>${info.batReplacementDescription ?? "Yes"}</dd>`
                    : nothing
            }
        `;
    }

    static override styles: CSSResultGroup = [
        BaseClusterCommands.styles,
        css`
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
        `,
    ];
}

registerClusterCommands(POWER_SOURCE_CLUSTER_ID, "power-source-cluster-commands", {
    renderWhenOffline: true,
});

declare global {
    interface HTMLElementTagNameMap {
        "power-source-cluster-commands": PowerSourceClusterCommands;
    }
}
