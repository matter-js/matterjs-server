/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/filled-button";
import "@material/web/button/outlined-button";
import { html } from "lit";
import { customElement } from "lit/decorators.js";
import { handleAsync } from "../../../util/async-handler.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

const CLUSTER_ID = 6; // OnOff cluster

/**
 * Command panel for OnOff cluster (ID: 6).
 * Provides On, Off, and Toggle commands.
 */
@customElement("on-off-cluster-commands")
class OnOffClusterCommands extends BaseClusterCommands {
    override render() {
        return html`
            <details class="command-panel">
                <summary>OnOff Commands</summary>
                <div class="command-content">
                    <div class="command-row">
                        <md-outlined-button @click=${handleAsync(() => this._handleOn())}>On</md-outlined-button>
                        <md-outlined-button @click=${handleAsync(() => this._handleOff())}>Off</md-outlined-button>
                        <md-outlined-button @click=${handleAsync(() => this._handleToggle())}>Toggle</md-outlined-button>
                    </div>
                </div>
            </details>
        `;
    }

    private async _handleOn() {
        await this.sendCommand("On");
    }

    private async _handleOff() {
        await this.sendCommand("Off");
    }

    private async _handleToggle() {
        await this.sendCommand("Toggle");
    }
}

// Register this component for cluster ID 6
registerClusterCommands(CLUSTER_ID, "on-off-cluster-commands");

declare global {
    interface HTMLElementTagNameMap {
        "on-off-cluster-commands": OnOffClusterCommands;
    }
}
