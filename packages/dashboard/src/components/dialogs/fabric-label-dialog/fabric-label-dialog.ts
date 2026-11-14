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
import { handleAsync } from "../../../util/async-handler.js";
import { labelLengthError } from "../../../util/label-length.js";
import { onEnter } from "../../../util/on-enter.js";
import { preventDefault } from "../../../util/prevent_default.js";
import { showAlertDialog } from "../../dialog-box/show-dialog-box.js";

const FABRIC_LABEL_MAX_BYTES = 32;

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
                        @keydown=${onEnter(handleAsync(() => this._save()))}
                        ?disabled=${this._saving}
                        supporting-text="Max ${FABRIC_LABEL_MAX_BYTES} bytes. Applies to the whole fabric."
                        style="width: 100%; margin-top: 8px;"
                    ></md-outlined-text-field>
                </div>
                <div slot="actions">
                    <md-text-button @click=${this._close} ?disabled=${this._saving}>Cancel</md-text-button>
                    <md-text-button @click=${handleAsync(() => this._save())} ?disabled=${this._saving}
                        >Save</md-text-button
                    >
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
        if (this._saving) {
            return;
        }
        const label = this._fabricLabel.trim();
        const lengthError = labelLengthError(label, FABRIC_LABEL_MAX_BYTES);
        if (lengthError !== undefined) {
            showAlertDialog({ title: "Failed to set fabric label", text: lengthError });
            return;
        }
        this._saving = true;
        try {
            await this.client.setDefaultFabricLabel(label);
            // The server may silently ignore the change (CLI pin, or another connection owns the label),
            // so read it back and confirm it took before reporting success.
            const expected = label || "HomeAssistant";
            const current = await this.client.getFabricLabel();
            if (current !== expected) {
                this._saving = false;
                showAlertDialog({
                    title: "Failed to set fabric label",
                    text: "Could not set the fabric label — see the server log for details.",
                });
                return;
            }
            this.onSaved?.();
        } catch (error) {
            this._saving = false;
            const errorMessage = error instanceof Error ? error.message : String(error);
            showAlertDialog({
                title: "Failed to set fabric label",
                text: errorMessage,
            });
            return;
        }
        // `_saving` stays set: the dialog is closing and must not accept a second save.
        this._close();
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "fabric-label-dialog": FabricLabelDialog;
    }
}
