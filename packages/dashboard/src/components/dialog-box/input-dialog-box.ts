/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/text-button";
import "@material/web/dialog/dialog";
import "@material/web/textfield/outlined-text-field";
import type { MdDialog } from "@material/web/dialog/dialog.js";
import type { MdOutlinedTextField } from "@material/web/textfield/outlined-text-field.js";
import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { preventDefault } from "../../util/prevent_default.js";
import type { InputDialogBoxParams } from "./show-dialog-box.js";

@customElement("input-dialog-box")
export class InputDialogBox extends LitElement {
    @property({ attribute: false }) public params!: InputDialogBoxParams;

    @property({ attribute: false }) public dialogResult!: (result: string | null) => void;

    protected override render() {
        const params = this.params;
        return html`
            <md-dialog open @cancel=${preventDefault} @closed=${this._handleClosed}>
                ${params.title ? html`<div slot="headline">${params.title}</div>` : ""}
                <div slot="content">
                    ${params.text ? html`<p>${params.text}</p>` : ""}
                    <md-outlined-text-field
                        .value=${params.defaultValue ?? ""}
                        .label=${params.label ?? ""}
                        @keydown=${this._handleKeydown}
                    ></md-outlined-text-field>
                </div>
                <div slot="actions">
                    <md-text-button @click=${this._cancel}>${params.cancelText ?? "Cancel"}</md-text-button>
                    <md-text-button @click=${this._confirm}>${params.confirmText ?? "OK"}</md-text-button>
                </div>
            </md-dialog>
        `;
    }

    private _handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            this._confirm();
        }
    }

    private _cancel() {
        if (this._resolved) return;
        this._resolved = true;
        this.dialogResult(null);
        this.shadowRoot!.querySelector<MdDialog>("md-dialog")!.close();
    }

    private _resolved = false;

    private _confirm() {
        if (this._resolved) return;
        this._resolved = true;
        const textField = this.shadowRoot!.querySelector<MdOutlinedTextField>("md-outlined-text-field")!;
        this.dialogResult(textField.value);
        this.shadowRoot!.querySelector<MdDialog>("md-dialog")!.close();
    }

    private _handleClosed() {
        if (!this._resolved) {
            this._resolved = true;
            this.dialogResult(null);
        }
        this.parentElement!.removeChild(this);
    }

    static override styles = css`
        md-outlined-text-field {
            width: 100%;
        }
    `;
}

declare global {
    interface HTMLElementTagNameMap {
        "input-dialog-box": InputDialogBox;
    }
}
