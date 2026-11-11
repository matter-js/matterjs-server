/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { mdiMotionSensor, mdiMotionSensorOff } from "@mdi/js";
import { css, html, nothing, type CSSResultGroup } from "lit";
import { customElement } from "lit/decorators.js";
import "../../../components/ha-svg-icon.js";
import { formatDuration } from "../../../util/duration.js";
import {
    formatHoldTimeLimits,
    OCCUPANCY_SENSING_CLUSTER_ID,
    occupancySensingInfo,
} from "../../../util/occupancy-sensing.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

/**
 * Read-only status panel for the OccupancySensing cluster (ID: 0x0406 / 1030).
 */
@customElement("occupancy-sensing-cluster-commands")
export class OccupancySensingClusterCommands extends BaseClusterCommands {
    override render() {
        if (!this.node || this.cluster !== OCCUPANCY_SENSING_CLUSTER_ID) return nothing;
        const info = occupancySensingInfo(this.node.attributes, this.endpoint);
        if (!info.supported) return nothing;

        const stateText = info.occupied === undefined ? "Unknown" : info.occupied ? "Occupied" : "Clear";

        return html`
            <details class="command-panel" open>
                <summary>
                    <ha-svg-icon .path=${info.occupied === true ? mdiMotionSensor : mdiMotionSensorOff}></ha-svg-icon>
                    Occupancy Sensing
                </summary>
                <div class="command-content">
                    <div class="status-row">
                        <span class="state-chip ${info.occupied === true ? "occupied" : ""}">${stateText}</span>
                        ${
                            info.sensorTypes.length > 0
                                ? html`<span class="meta">${info.sensorTypes.join(", ")}</span>`
                                : nothing
                        }
                    </div>
                    ${
                        info.holdTimeS !== undefined || info.holdTimeLimits !== undefined
                            ? html`
                                  <dl class="info-grid">
                                      ${
                                          info.holdTimeS !== undefined
                                              ? html`<dt>Hold time</dt>
                                                    <dd>${formatDuration(info.holdTimeS)}</dd>`
                                              : nothing
                                      }
                                      ${
                                          info.holdTimeLimits !== undefined
                                              ? html`<dt>Hold time limits</dt>
                                                    <dd>${formatHoldTimeLimits(info.holdTimeLimits)}</dd>`
                                              : nothing
                                      }
                                  </dl>
                              `
                            : nothing
                    }
                </div>
            </details>
        `;
    }

    static override styles: CSSResultGroup = [
        BaseClusterCommands.styles,
        css`
            .status-row {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 8px 12px;
            }

            .state-chip {
                padding: 4px 12px;
                border-radius: 8px;
                font-weight: 500;
                background: var(--md-sys-color-surface-container-highest);
                color: var(--md-sys-color-on-surface);
            }

            .state-chip.occupied {
                background: var(--md-sys-color-secondary-container);
                color: var(--md-sys-color-on-secondary-container);
            }

            .meta {
                font-size: 0.8rem;
                color: var(--md-sys-color-on-surface-variant);
            }

            .info-grid {
                display: grid;
                grid-template-columns: auto 1fr;
                gap: 6px 16px;
                margin: 12px 0 0;
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

registerClusterCommands(OCCUPANCY_SENSING_CLUSTER_ID, "occupancy-sensing-cluster-commands", {
    renderWhenOffline: true,
});

declare global {
    interface HTMLElementTagNameMap {
        "occupancy-sensing-cluster-commands": OccupancySensingClusterCommands;
    }
}
