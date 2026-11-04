/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { mdiMotionSensor, mdiMotionSensorOff } from "@mdi/js";
import { css, html, nothing, type CSSResultGroup } from "lit";
import { customElement } from "lit/decorators.js";
import "../../../components/ha-svg-icon.js";
import {
    formatOccupancySensorType,
    isOccupied,
    OCCUPANCY_SENSING_CLUSTER_ID,
    readOccupancySensorType,
} from "../../../util/occupancy-sensing.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

/**
 * Status panel for the OccupancySensing cluster (ID: 0x0406 / 1030).
 * The cluster defines no commands: occupancy is reported by the device, never invoked.
 */
@customElement("occupancy-sensing-cluster-commands")
class OccupancySensingClusterCommands extends BaseClusterCommands {
    override render() {
        if (!this.node || this.cluster !== OCCUPANCY_SENSING_CLUSTER_ID) return nothing;

        const occupied = isOccupied(this.node, this.endpoint);
        const sensorType = formatOccupancySensorType(readOccupancySensorType(this.node, this.endpoint));

        return html`
            <details class="command-panel" open>
                <summary>
                    <ha-svg-icon .path=${occupied === true ? mdiMotionSensor : mdiMotionSensorOff}></ha-svg-icon>
                    Occupancy Sensing
                </summary>
                <div class="command-content">
                    <div class="status-row">
                        <span class="state-chip ${occupied === true ? "occupied" : ""}">
                            ${occupied === null ? "Unknown" : occupied ? "Occupied" : "Clear"}
                        </span>
                        ${sensorType !== null ? html`<span class="meta">${sensorType}</span>` : nothing}
                    </div>
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
