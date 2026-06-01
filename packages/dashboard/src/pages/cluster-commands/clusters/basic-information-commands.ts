/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/filled-button";
import "@material/web/textfield/outlined-text-field";
import { css, html, nothing, type CSSResultGroup } from "lit";
import { customElement, state } from "lit/decorators.js";
import { showAlertDialog } from "../../../components/dialog-box/show-dialog-box.js";
import { handleAsync } from "../../../util/async-handler.js";
import { MAX_NODE_LABEL_LENGTH, NODE_LABEL_CLUSTER_ID, writeNodeLabel } from "../../../util/node-label.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

/**
 * Command panel for BasicInformation cluster (ID: 0x28 / 40).
 * Provides ability to edit the NodeLabel attribute.
 */
@customElement("basic-information-cluster-commands")
export class BasicInformationClusterCommands extends BaseClusterCommands {
    @state()
    private _nodeLabel: string = "";

    @state()
    private _saving: boolean = false;

    override updated(changedProperties: Map<string, unknown>) {
        super.updated(changedProperties);
        // Load node label when node property is first set
        if (changedProperties.has("node") && this.node) {
            this._loadCurrentNodeLabel();
        }
    }

    /**
     * Load the current NodeLabel from the node's cached attributes.
     */
    private _loadCurrentNodeLabel() {
        if (!this.node) {
            return;
        }
        this._nodeLabel = this.node.nodeLabel;
    }

    /**
     * Check if the node is available (not offline).
     */
    private get _isNodeAvailable(): boolean {
        return this.node.available;
    }

    override render() {
        return html`
            <details class="command-panel">
                <summary>Node Label</summary>
                <div class="command-content">
                    ${!this._isNodeAvailable
                        ? html` <div class="offline-warning">Node is offline - cannot edit label</div> `
                        : nothing}
                    <div class="command-row">
                        <md-outlined-text-field
                            label="Node Label"
                            .value=${this._nodeLabel}
                            @input=${this._handleInput}
                            maxlength=${MAX_NODE_LABEL_LENGTH}
                            ?disabled=${!this._isNodeAvailable || this._saving}
                            supporting-text="Max ${MAX_NODE_LABEL_LENGTH} characters"
                        ></md-outlined-text-field>
                        <md-filled-button
                            @click=${handleAsync(() => this._handleSave())}
                            ?disabled=${!this._isNodeAvailable || this._saving}
                        >
                            ${this._saving ? "Saving..." : "Save"}
                        </md-filled-button>
                    </div>
                </div>
            </details>
        `;
    }

    private _handleInput(e: Event) {
        const input = e.target as HTMLInputElement;
        this._nodeLabel = input.value;
    }

    private async _handleSave() {
        if (!this._isNodeAvailable) {
            showAlertDialog({
                title: "Cannot Save",
                text: "Node is offline. Please wait until the node is available.",
            });
            return;
        }

        this._saving = true;

        try {
            const label = this._nodeLabel.trim();
            await writeNodeLabel(this.client, this.node, label);
            this._nodeLabel = label;

            showAlertDialog({
                title: "Success",
                text: `Node label set to "${label}"`,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            showAlertDialog({
                title: "Failed to set node label",
                text: errorMessage,
            });
        } finally {
            this._saving = false;
        }
    }

    static override styles: CSSResultGroup = [
        BaseClusterCommands.styles,
        css`
            .command-row {
                align-items: flex-start;
            }

            md-outlined-text-field {
                width: 36ch; /* 32 chars + some padding for field chrome */
            }

            md-filled-button {
                margin-top: 8px; /* Align with text field input area, accounting for label */
            }

            .offline-warning {
                color: var(--danger-color, #d32f2f);
                font-size: 14px;
                margin-bottom: 12px;
                padding: 8px 12px;
                background-color: var(--md-sys-color-error-container, #fdecea);
                border-radius: 4px;
            }
        `,
    ];
}

registerClusterCommands(NODE_LABEL_CLUSTER_ID, "basic-information-cluster-commands");

declare global {
    interface HTMLElementTagNameMap {
        "basic-information-cluster-commands": BasicInformationClusterCommands;
    }
}
