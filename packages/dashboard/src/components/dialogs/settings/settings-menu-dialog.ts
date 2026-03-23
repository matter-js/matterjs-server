/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/dialog/dialog";
import "@material/web/list/list";
import "@material/web/list/list-item";
import type { MdDialog } from "@material/web/dialog/dialog.js";
import { MatterClient } from "@matter-server/ws-client";
import { mdiHomeAssistant, mdiMathLog } from "@mdi/js";
import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import "../../../components/ha-svg-icon";
import { preventDefault } from "../../../util/prevent_default.js";
import { showHaIntegrationDialog } from "./show-ha-integration-dialog.js";
import { showLogLevelDialog } from "./show-log-level-dialog.js";

@customElement("settings-menu-dialog")
export class SettingsMenuDialog extends LitElement {
    @property({ attribute: false })
    public client!: MatterClient;

    private _openLogLevel() {
        this._close();
        showLogLevelDialog(this.client);
    }

    private _openHaIntegration() {
        this._close();
        showHaIntegrationDialog(this.client);
    }

    private _close() {
        this.shadowRoot!.querySelector<MdDialog>("md-dialog")!.close();
    }

    private _handleClosed() {
        this.parentNode!.removeChild(this);
    }

    protected override render() {
        return html`
            <md-dialog open @cancel=${preventDefault} @closed=${this._handleClosed}>
                <div slot="headline">Settings</div>
                <div slot="content">
                    <md-list>
                        <md-list-item type="button" @click=${this._openLogLevel}>
                            <ha-svg-icon slot="start" .path=${mdiMathLog}></ha-svg-icon>
                            <div slot="headline">Log Level</div>
                            <div slot="supporting-text">Configure server log verbosity</div>
                        </md-list-item>
                        <md-list-item type="button" @click=${this._openHaIntegration}>
                            <ha-svg-icon slot="start" .path=${mdiHomeAssistant}></ha-svg-icon>
                            <div slot="headline">Home Assistant</div>
                            <div slot="supporting-text">Sync device names with Home Assistant</div>
                        </md-list-item>
                    </md-list>
                </div>
            </md-dialog>
        `;
    }

    static override styles = css`
        md-list {
            padding: 0;
        }
    `;
}

declare global {
    interface HTMLElementTagNameMap {
        "settings-menu-dialog": SettingsMenuDialog;
    }
}
