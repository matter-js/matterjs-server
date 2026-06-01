/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/text-button";
import "@material/web/dialog/dialog";
import "@material/web/textfield/outlined-text-field";
import type { MdDialog } from "@material/web/dialog/dialog.js";
import type { MatterClient, MatterNode } from "@matter-server/ws-client";
import { html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { MAX_NODE_LABEL_LENGTH, writeNodeLabel } from "../../../util/node-label.js";
import { preventDefault } from "../../../util/prevent_default.js";
import { showAlertDialog } from "../../dialog-box/show-dialog-box.js";

@customElement("node-label-dialog")
export class NodeLabelDialog extends LitElement {
    @property({ attribute: false })
    public client!: MatterClient;

    @property({ attribute: false })
    public node!: MatterNode;

    @state()
    private _nodeLabel: string = "";

    @state()
    private _saving: boolean = false;

    protected override firstUpdated() {
        this._nodeLabel = this.node.nodeLabel;
    }

    protected override render() {
        return html`
            <md-dialog open @cancel=${preventDefault} @closed=${this._handleClosed}>
                <div slot="headline">Edit Node Label</div>
                <div slot="content">
                    <md-outlined-text-field
                        label="Node Label"
                        .value=${this._nodeLabel}
                        @input=${this._handleInput}
                        maxlength=${MAX_NODE_LABEL_LENGTH}
                        ?disabled=${this._saving}
                        supporting-text="Max ${MAX_NODE_LABEL_LENGTH} characters"
                        style="width: 100%; margin-top: 8px;"
                    ></md-outlined-text-field>
                </div>
                <div slot="actions">
                    <md-text-button @click=${this._close} ?disabled=${this._saving}>Cancel</md-text-button>
                    <md-text-button @click=${this._save} ?disabled=${this._saving}>Save</md-text-button>
                </div>
            </md-dialog>
        `;
    }

    private _handleInput(e: Event) {
        const input = e.target as HTMLInputElement;
        this._nodeLabel = input.value;
    }

    private _close() {
        this.shadowRoot!.querySelector<MdDialog>("md-dialog")!.close();
    }

    private _handleClosed() {
        this.parentNode!.removeChild(this);
    }

    private async _save() {
        this._saving = true;
        try {
            await writeNodeLabel(this.client, this.node, this._nodeLabel);
            this._close();
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
}

declare global {
    interface HTMLElementTagNameMap {
        "node-label-dialog": NodeLabelDialog;
    }
}
