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
import { MatterClient } from "@matter-server/ws-client";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { handleAsync } from "../../../util/async-handler.js";

@customElement("ha-integration-dialog")
export class HaIntegrationDialog extends LitElement {
    @property({ attribute: false })
    public client!: MatterClient;

    @state() private _saving = false;
    @state() private _syncing = false;
    @state() private _syncResult: string | null = null;

    @query("#ha-url")
    private _urlField!: MdOutlinedTextField;

    @query("#ha-token")
    private _tokenField!: MdOutlinedTextField;

    private get _haConfigured(): boolean {
        return this.client.serverInfo.ha_credentials_set === true;
    }

    private async _save() {
        const url = this._urlField.value.trim();
        const token = this._tokenField.value.trim();

        if (!url || !token) {
            this._syncResult = "Please enter both URL and token.";
            return;
        }

        this._saving = true;
        this._syncResult = null;
        try {
            await this.client.setHaCredentials(url, token);
            this._syncResult = "Credentials saved.";
            // Clear the token field after saving (it's stored server-side)
            this._tokenField.value = "";
        } catch (err) {
            this._syncResult = `Failed to save: ${err instanceof Error ? err.message : String(err)}`;
        } finally {
            this._saving = false;
        }
    }

    private async _sync() {
        this._syncing = true;
        this._syncResult = null;
        try {
            const result = await this.client.syncHaNames();
            if (result.errors.length > 0) {
                this._syncResult = `Synced ${result.synced} name(s) with ${result.errors.length} error(s).`;
            } else if (result.synced === 0) {
                this._syncResult = "No new names to sync.";
            } else {
                this._syncResult = `Synced ${result.synced} name(s) from Home Assistant.`;
            }
        } catch (err) {
            this._syncResult = `Sync failed: ${err instanceof Error ? err.message : String(err)}`;
        } finally {
            this._syncing = false;
        }
    }

    private async _clear() {
        this._saving = true;
        this._syncResult = null;
        try {
            await this.client.setHaCredentials("", "");
            this._syncResult = "Stored credentials cleared.";
            this._urlField.value = "";
            this._tokenField.value = "";
        } catch (err) {
            this._syncResult = `Failed to clear: ${err instanceof Error ? err.message : String(err)}`;
        } finally {
            this._saving = false;
        }
    }

    private _close() {
        this.shadowRoot!.querySelector<MdDialog>("md-dialog")!.close();
    }

    private _handleClosed() {
        this.remove();
    }

    protected override render() {
        return html`
            <md-dialog open @closed=${this._handleClosed}>
                <div slot="headline">Home Assistant Integration</div>
                <div slot="content">
                    <p class="hint">
                        Connect to Home Assistant to sync device names.
                        ${
                            this._haConfigured
                                ? html`
                                      <br /><span class="status-ok">Credentials saved</span>
                                  `
                                : nothing
                        }
                    </p>
                    <div class="form-field">
                        <md-outlined-text-field
                            id="ha-url"
                            label="Home Assistant URL"
                            placeholder="http://homeassistant.local:8123"
                            type="url"
                        ></md-outlined-text-field>
                    </div>
                    <div class="form-field">
                        <md-outlined-text-field
                            id="ha-token"
                            label="Access Token"
                            placeholder="Long-lived access token"
                            type="password"
                        ></md-outlined-text-field>
                    </div>
                    ${this._syncResult ? html`<p class="sync-result">${this._syncResult}</p>` : nothing}
                </div>
                <div slot="actions">
                    <md-text-button
                        @click=${handleAsync(() => this._sync())}
                        ?disabled=${!this._haConfigured || this._syncing}
                    >
                        ${this._syncing ? "Syncing..." : "Sync Names from HA"}
                    </md-text-button>
                    <md-text-button
                        @click=${handleAsync(() => this._clear())}
                        ?disabled=${!this._haConfigured || this._saving}
                    >
                        Clear
                    </md-text-button>
                    <md-text-button @click=${this._close}>Cancel</md-text-button>
                    <md-text-button
                        @click=${handleAsync(() => this._save())}
                        ?disabled=${this._saving}
                    >
                        ${this._saving ? "Saving..." : "Save"}
                    </md-text-button>
                </div>
            </md-dialog>
        `;
    }

    static override styles = css`
        .hint {
            font-size: 0.875rem;
            color: var(--md-sys-color-on-surface-variant);
            margin: 0 0 16px 0;
        }

        .status-ok {
            color: var(--md-sys-color-primary);
            font-weight: 500;
        }

        .form-field {
            margin-bottom: 16px;
        }

        md-outlined-text-field {
            width: 100%;
        }

        .sync-result {
            font-size: 0.875rem;
            color: var(--md-sys-color-on-surface-variant);
            margin: 8px 0 0 0;
            font-style: italic;
        }
    `;
}

declare global {
    interface HTMLElementTagNameMap {
        "ha-integration-dialog": HaIntegrationDialog;
    }
}
