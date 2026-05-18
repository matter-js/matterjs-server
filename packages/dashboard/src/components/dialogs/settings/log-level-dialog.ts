/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/text-button";
import "@material/web/dialog/dialog";
import type { MdDialog } from "@material/web/dialog/dialog.js";
import { css, html, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { preventDefault } from "../../../util/prevent_default.js";
import "./log-level-section.js";

@customElement("log-level-dialog")
export class LogLevelDialog extends LitElement {
    private _close() {
        this.shadowRoot!.querySelector<MdDialog>("md-dialog")!.close();
    }

    private _handleClosed() {
        this.parentNode!.removeChild(this);
    }

    private _handleApplied() {
        this._close();
    }

    protected override render() {
        return html`
            <md-dialog open @cancel=${preventDefault} @closed=${this._handleClosed}>
                <div slot="headline">Server Log Settings</div>
                <div slot="content">
                    <log-level-section @log-level-applied=${this._handleApplied}></log-level-section>
                </div>
                <div slot="actions">
                    <md-text-button @click=${this._close}>Close</md-text-button>
                </div>
            </md-dialog>
        `;
    }

    static override styles = css`
        md-dialog {
            min-width: 360px;
        }
    `;
}

declare global {
    interface HTMLElementTagNameMap {
        "log-level-dialog": LogLevelDialog;
    }
}
