/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import "@material/web/progress/circular-progress";
import "@material/web/select/outlined-select";
import "@material/web/select/select-option";
import "@material/web/textfield/outlined-text-field";
import type { MdOutlinedTextField } from "@material/web/textfield/outlined-text-field.js";
import { AllCredentialsSummary, MatterClient } from "@matter-server/ws-client";
import { mdiWifi } from "@mdi/js";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { clientContext } from "../../../client/client-context.js";
import { handleAsync } from "../../../util/async-handler.js";
import { fireEvent } from "../../../util/fire_event.js";
import { showAlertDialog } from "../../dialog-box/show-dialog-box.js";
import "../../ha-svg-icon.js";

@customElement("commission-node-wifi")
export class CommissionNodeWifi extends LitElement {
    static override styles = css`
        .cred-chip {
            display: flex;
            width: fit-content;
            align-items: center;
            gap: 6px;
            background: var(--md-sys-color-surface-container);
            color: var(--md-sys-color-on-surface-variant);
            border-radius: 16px;
            padding: 4px 10px 4px 6px;
            font-size: 0.85em;
            margin-bottom: 12px;
        }
        .cred-chip ha-svg-icon {
            width: 18px;
            height: 18px;
            flex-shrink: 0;
        }
        .cred-chip .sep {
            opacity: 0.5;
        }
        .cred-chip .edit-link {
            cursor: pointer;
            color: var(--md-sys-color-primary);
            background: none;
            border: none;
            padding: 0;
            font: inherit;
            font-size: inherit;
        }
    `;
    @consume({ context: clientContext, subscribe: true })
    @property({ attribute: false })
    public client!: MatterClient;

    @state()
    private _loading: boolean = false;

    @state()
    private _credentials: AllCredentialsSummary | null = null;

    @state()
    private _selectedId: string = "default";

    @query("md-outlined-text-field[label='SSID']")
    private _ssidField!: MdOutlinedTextField;
    @query("md-outlined-text-field[label='Password']")
    private _passwordField!: MdOutlinedTextField;
    @query("md-outlined-text-field[label='Pairing code']")
    private _pairingCodeField!: MdOutlinedTextField;

    private _pairingFocused = false;
    private _credsFocused = false;

    override connectedCallback(): void {
        super.connectedCallback();
        void this._loadCredentials().catch(err => console.warn("Failed to load credentials:", err));
    }

    private async _loadCredentials(): Promise<void> {
        if (this._credentials !== null) return;
        if (!this.client || this.client.serverInfo.schema_version < 12) return;
        try {
            this._credentials = await this.client.getAllCredentials();
        } catch {
            // Leave _credentials null → no picker shown
        }
    }

    protected override updated(): void {
        void this._maybeAutofocus().catch(err => console.warn("Autofocus failed:", err));
    }

    private async _maybeAutofocus(): Promise<void> {
        if (this._pairingCodeField && !this._pairingFocused) {
            this._pairingFocused = true;
            await this._pairingCodeField.updateComplete;
            this._pairingCodeField.focus();
        } else if (this._ssidField && !this._credsFocused) {
            this._credsFocused = true;
            await this._ssidField.updateComplete;
            this._ssidField.focus();
        }
    }

    protected override render() {
        if (!this.client.serverInfo.wifi_credentials_set) {
            return html`<md-outlined-text-field
                    label="SSID"
                    .disabled="${this._loading}"
                    supporting-text="Network name"
                >
                </md-outlined-text-field>
                <md-outlined-text-field label="Password" type="password" .disabled="${this._loading}">
                </md-outlined-text-field>
                <br />
                <br />
                <md-outlined-button @click=${handleAsync(() => this._setWifiCredentials())} .disabled="${this._loading}"
                    >Set WiFi Credentials</md-outlined-button
                >${this._loading ? html`<md-circular-progress indeterminate></md-circular-progress>` : nothing}`;
        }
        const wifiList = this._credentials?.wifi ?? [];
        const showPicker = wifiList.length > 1;
        return html`<div class="cred-chip">
                <ha-svg-icon .path=${mdiWifi}></ha-svg-icon>
                <span>WiFi: ${this.client.serverInfo.wifi_ssid ?? "network set"}</span>
                <span class="sep">·</span>
                <button class="edit-link" @click=${() => fireEvent(this, "request-settings", {})}>
                    Edit in Settings
                </button>
            </div>
            ${showPicker
                ? html`<md-outlined-select
                          label="WiFi network"
                          .disabled=${this._loading}
                          .value=${this._selectedId}
                          @change=${(e: Event) => {
                              this._selectedId = (e.target as HTMLSelectElement).value;
                          }}
                      >
                          ${wifiList.map(
                              entry => html`
                                  <md-select-option value=${entry.id}>
                                      <div slot="headline">${entry.ssid || entry.id}</div>
                                  </md-select-option>
                              `,
                          )}
                      </md-outlined-select>
                      <br />
                      <br />`
                : nothing}
            <md-outlined-text-field label="Pairing code" .disabled="${this._loading}"> </md-outlined-text-field>
            <br />
            <br />
            <md-outlined-button @click=${handleAsync(() => this._commissionNode())} .disabled="${this._loading}"
                >Commission</md-outlined-button
            >${this._loading ? html` <md-circular-progress indeterminate></md-circular-progress> ` : nothing}`;
    }

    private async _setWifiCredentials() {
        const ssid = this._ssidField.value;
        if (!ssid) {
            showAlertDialog({ title: "Validation error", text: "SSID is required" });
            return;
        }
        const password = this._passwordField.value;
        if (!password) {
            showAlertDialog({ title: "Validation error", text: "Password is required" });
            return;
        }
        this._loading = true;
        try {
            await this.client.setWifiCredentials(ssid, password);
        } catch (err) {
            showAlertDialog({ title: "Error setting WiFi credentials", text: (err as Error).message });
        } finally {
            this._loading = false;
        }
    }

    private async _commissionNode() {
        try {
            if (!this._pairingCodeField.value) {
                showAlertDialog({ title: "Validation error", text: "Pairing code is required" });
                return;
            }
            this._loading = true;
            const opts = this._selectedId !== "default" ? { wifiCredentialsId: this._selectedId } : undefined;
            const node = await this.client.commissionWithCode(this._pairingCodeField.value, false, opts);
            fireEvent(this, "node-commissioned", node);
        } catch (err) {
            showAlertDialog({ title: "Error commissioning node", text: (err as Error).message });
        } finally {
            this._loading = false;
        }
    }
}

declare global {
    interface HASSDomEvents {
        "request-settings": Record<string, never>;
    }
}
