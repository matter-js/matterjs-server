/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/text-button";
import "@material/web/dialog/dialog";
import "@material/web/textfield/outlined-text-field";
import type { MdDialog } from "@material/web/dialog/dialog.js";
import type { MdOutlinedTextField } from "@material/web/textfield/outlined-text-field.js";
import type { MatterClient } from "@matter-server/ws-client";
import { html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { preventDefault } from "../../../util/prevent_default.js";
import { showAlertDialog } from "../../dialog-box/show-dialog-box.js";

const MAX_FABRIC_LABEL_LENGTH = 32;

@customElement("fabric-label-dialog")
export class FabricLabelDialog extends LitElement {
    @property({ attribute: false })
    public client!: MatterClient;

    @property({ attribute: false })
    public currentLabel: string = "";

    @property({ attribute: false })
    public onSaved?: () => void;

    @state()
    private _fabricLabel: string = "";

    @state()
    private _saving: boolean = false;

    protected override firstUpdated() {
        this._fabricLabel = this.currentLabel;
    }

    protected override render() {
        return html`
            <md-dialog open @cancel=${preventDefault} @closed=${this._handleClosed}>
                <div slot="headline">Edit Fabric Label</div>
                <div slot="content">
                    <md-outlined-text-field
                        label="Fabric Label"
                        .value=${this._fabricLabel}
                        @input=${this._handleInput}
                        maxlength=${MAX_FABRIC_LABEL_LENGTH}
                        ?disabled=${this._saving}
                        supporting-text="Max ${MAX_FABRIC_LABEL_LENGTH} characters. Applies to the whole fabric."
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
        this._fabricLabel = (e.target as MdOutlinedTextField).value;
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
            await this.client.setDefaultFabricLabel(this._fabricLabel);
            this.onSaved?.();
            this._close();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            showAlertDialog({
                title: "Failed to set fabric label",
                text: errorMessage,
            });
        } finally {
            this._saving = false;
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "fabric-label-dialog": FabricLabelDialog;
    }
}
