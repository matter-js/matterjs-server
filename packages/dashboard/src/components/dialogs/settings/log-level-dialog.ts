/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/text-button";
import "@material/web/dialog/dialog";
import { consume } from "@lit/context";
import type { MdDialog } from "@material/web/dialog/dialog.js";
import { MatterClient } from "@matter-server/ws-client";
import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { clientContext } from "../../../client/client-context.js";
import { preventDefault } from "../../../util/prevent_default.js";
import "./log-level-section.js";

@customElement("log-level-dialog")
export class LogLevelDialog extends LitElement {
    @consume({ context: clientContext, subscribe: true })
    @property({ attribute: false })
    public client!: MatterClient;

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
                    <log-level-section
                        .client=${this.client}
                        @log-level-applied=${this._handleApplied}
                    ></log-level-section>
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
