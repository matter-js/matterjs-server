/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/filled-button";
import { html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

const CLUSTER_ID = 8; // LevelControl cluster

/**
 * Command panel for LevelControl cluster (ID: 8).
 * Provides MoveToLevel command with configurable parameters.
 */
@customElement("level-control-cluster-commands")
class LevelControlClusterCommands extends BaseClusterCommands {
    @state()
    private _targetLevel = 128;

    @state()
    private _transitionTime = 0;

    @state()
    private _executeIfOff = false;

    override render() {
        return html`
            <details class="command-panel">
                <summary>Level Control Commands</summary>
                <div class="command-content">
                    <div class="command-row">
                        <label for="targetLevel">Level:</label>
                        <input
                            id="targetLevel"
                            type="number"
                            min="1"
                            max="254"
                            .value=${String(this._targetLevel)}
                            @input=${this._handleTargetLevelChange}
                        />
                        <label for="transitionTime">Transition (0.1s):</label>
                        <input
                            id="transitionTime"
                            type="number"
                            min="0"
                            max="65535"
                            .value=${String(this._transitionTime)}
                            @input=${this._handleTransitionTimeChange}
                        />
                        <label for="executeIfOff">
                            <input
                                id="executeIfOff"
                                type="checkbox"
                                .checked=${this._executeIfOff}
                                @change=${this._handleExecuteIfOffChange}
                            />
                            Execute if Off
                        </label>
                        <md-outlined-button @click=${this._handleMoveToLevel}>MoveToLevel</md-outlined-button>
                        <md-outlined-button @click=${this._handleMoveToLevelWithOnOff}
                            >MoveToLevelWithOnOff</md-outlined-button
                        >
                    </div>
                </div>
            </details>
        `;
    }

    private _handleTargetLevelChange(e: Event) {
        const input = e.target as HTMLInputElement;
        let value = parseInt(input.value, 10);
        if (isNaN(value)) value = 1;
        if (value < 1) value = 1;
        if (value > 254) value = 254;
        this._targetLevel = value;
    }

    private _handleTransitionTimeChange(e: Event) {
        const input = e.target as HTMLInputElement;
        let value = parseInt(input.value, 10);
        if (isNaN(value)) value = 0;
        if (value < 0) value = 0;
        if (value > 65535) value = 65535;
        this._transitionTime = value;
    }

    private _handleExecuteIfOffChange(e: Event) {
        const input = e.target as HTMLInputElement;
        this._executeIfOff = input.checked;
    }

    private async _handleMoveToLevel() {
        // ExecuteIfOff is bit 0 of the Options bitmap
        const optionsMask = this._executeIfOff ? { executeIfOff: true } : {};
        const optionsOverride = this._executeIfOff ? { executeIfOff: true } : {};

        await this.sendCommand("MoveToLevel", {
            level: this._targetLevel,
            transitionTime: this._transitionTime,
            optionsMask,
            optionsOverride,
        });
    }

    private async _handleMoveToLevelWithOnOff() {
        // ExecuteIfOff is bit 0 of the Options bitmap
        const optionsMask = this._executeIfOff ? { executeIfOff: true } : {};
        const optionsOverride = this._executeIfOff ? { executeIfOff: true } : {};

        await this.sendCommand("MoveToLevelWithOnOff", {
            level: this._targetLevel,
            transitionTime: this._transitionTime,
            optionsMask,
            optionsOverride,
        });
    }
}

// Register this component for cluster ID 8
registerClusterCommands(CLUSTER_ID, "level-control-cluster-commands");

declare global {
    interface HTMLElementTagNameMap {
        "level-control-cluster-commands": LevelControlClusterCommands;
    }
}
