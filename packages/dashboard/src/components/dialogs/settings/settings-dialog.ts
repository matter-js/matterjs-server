/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/filled-button";
import "@material/web/button/text-button";
import "@material/web/dialog/dialog";
import "@material/web/divider/divider";
import "@material/web/iconbutton/icon-button";
import "@material/web/switch/switch";
import type { MdDialog } from "@material/web/dialog/dialog.js";
import type { MdSwitch } from "@material/web/switch/switch.js";
import { consume } from "@lit/context";
import "@material/web/textfield/outlined-text-field";
import type { MdOutlinedTextField } from "@material/web/textfield/outlined-text-field.js";
import { MatterClient } from "@matter-server/ws-client";
import { mdiAccessPoint, mdiEye, mdiEyeOff, mdiWifi } from "@mdi/js";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { handleAsync } from "../../../util/async-handler.js";
import { clientContext, tickContext } from "../../../client/client-context.js";
import { DevModeService } from "../../../util/dev-mode-service.js";
import { preventDefault } from "../../../util/prevent_default.js";
import "../../../components/ha-svg-icon.js";
import { showAlertDialog } from "../../dialog-box/show-dialog-box.js";
import "./log-level-section.js";

@customElement("settings-dialog")
export class SettingsDialog extends LitElement {
    @consume({ context: clientContext })
    public client!: MatterClient;

    @consume({ context: tickContext, subscribe: true })
    protected _tick = 0;

    @state() private _devMode = DevModeService.active;

    private _unsubscribeDev?: () => void;

    @property({ attribute: false }) public scrollToSection?: string;

    @state() private _expandedRow: "wifi" | "thread" | null = null;
    @state() private _credLoading = false;
    @state() private _showPassword = false;

    @query("#cred-wifi-ssid") private _wifiSsidField!: MdOutlinedTextField;
    @query("#cred-wifi-password") private _wifiPasswordField!: MdOutlinedTextField;
    @query("#cred-thread-dataset") private _threadDatasetField!: MdOutlinedTextField;

    override connectedCallback() {
        super.connectedCallback();
        this._unsubscribeDev = DevModeService.subscribe(active => {
            this._devMode = active;
        });
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubscribeDev?.();
    }

    override firstUpdated() {
        const knownSections = new Set(["network-credentials"]);
        if (this.scrollToSection && knownSections.has(this.scrollToSection)) {
            requestAnimationFrame(() => {
                this.renderRoot.querySelector(`#${this.scrollToSection}`)?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });
            });
        }
    }

    private _close() {
        this.shadowRoot!.querySelector<MdDialog>("md-dialog")!.close();
    }

    private _handleClosed() {
        this.parentNode!.removeChild(this);
    }

    private _onDevToggle(event: Event) {
        const target = event.target as MdSwitch;
        DevModeService.setActive(target.selected);
    }

    private _copyDevLink() {
        const url = new URL(window.location.href);
        url.searchParams.set("dev", "on");
        navigator.clipboard?.writeText(url.toString()).catch(() => {
            // best-effort; clipboard may be unavailable
        });
    }

    private _toggleExpand(row: "wifi" | "thread") {
        this._expandedRow = this._expandedRow === row ? null : row;
        this._showPassword = false;
    }

    private _cancelCred() {
        this._expandedRow = null;
        this._showPassword = false;
    }

    private _togglePassword() {
        this._showPassword = !this._showPassword;
    }

    private async _saveWifi() {
        const ssid = this._wifiSsidField.value.trim();
        if (!ssid) {
            showAlertDialog({ title: "Validation error", text: "SSID is required" });
            return;
        }
        const password = this._wifiPasswordField.value;
        if (!password) {
            showAlertDialog({ title: "Validation error", text: "Password is required" });
            return;
        }
        this._credLoading = true;
        try {
            await this.client.setWifiCredentials(ssid, password);
            this._expandedRow = null;
            this._showPassword = false;
        } catch (err) {
            showAlertDialog({ title: "Error saving WiFi credentials", text: (err as Error).message });
        } finally {
            this._credLoading = false;
        }
    }

    private async _removeWifi() {
        this._credLoading = true;
        try {
            await this.client.removeWifiCredentials();
            this._expandedRow = null;
            this._showPassword = false;
        } catch (err) {
            showAlertDialog({ title: "Error removing WiFi credentials", text: (err as Error).message });
        } finally {
            this._credLoading = false;
        }
    }

    private async _saveThread() {
        const dataset = this._threadDatasetField.value.trim();
        if (!dataset) {
            showAlertDialog({ title: "Validation error", text: "Thread dataset is required" });
            return;
        }
        if (!/^[0-9a-fA-F]*$/.test(dataset) || dataset.length % 2 !== 0) {
            showAlertDialog({
                title: "Invalid Thread dataset",
                text: "Must be a hex string with even length (each byte is two hex characters)",
            });
            return;
        }
        this._credLoading = true;
        try {
            await this.client.setThreadOperationalDataset(dataset);
            this._expandedRow = null;
        } catch (err) {
            showAlertDialog({ title: "Error saving Thread dataset", text: (err as Error).message });
        } finally {
            this._credLoading = false;
        }
    }

    private async _removeThread() {
        this._credLoading = true;
        try {
            await this.client.removeThreadDataset();
            this._expandedRow = null;
            this._showPassword = false;
        } catch (err) {
            showAlertDialog({ title: "Error removing Thread dataset", text: (err as Error).message });
        } finally {
            this._credLoading = false;
        }
    }

    protected override render() {
        return html`
            <md-dialog open @cancel=${preventDefault} @closed=${this._handleClosed}>
                <div slot="headline">Settings</div>
                <div slot="content">
                    <section class="section">
                        <h3 class="section-title">Developer mode</h3>
                        <div class="toggle-row">
                            <label for="dev-switch" class="toggle-label">
                                Enable developer mode
                                <span class="hint">
                                    Adds raw read/write buttons and a generic command invoker to cluster views.
                                    Activation is reflected in the URL (<code>?dev=on</code>) and does not persist.
                                </span>
                            </label>
                            <md-switch
                                id="dev-switch"
                                ?selected=${this._devMode}
                                @change=${this._onDevToggle}
                            ></md-switch>
                        </div>
                        <div class="aux-row">
                            <md-text-button @click=${this._copyDevLink}>Copy URL with dev enabled</md-text-button>
                        </div>
                    </section>

                    <md-divider></md-divider>

                    <section class="section">
                        <h3 class="section-title">Server log levels</h3>
                        <log-level-section></log-level-section>
                    </section>

                    <md-divider></md-divider>

                    <section id="network-credentials" class="section">
                        <h3 class="section-title">Network credentials</h3>

                        <div class="cred-row">
                            <div class="cred-info">
                                <ha-svg-icon .path=${mdiWifi}></ha-svg-icon>
                                <span class="cred-label">WiFi</span>
                                ${this.client.serverInfo.wifi_credentials_set
                                    ? html`<span class="cred-value">${this.client.serverInfo.wifi_ssid}</span>`
                                    : html`<span class="cred-unset">Not configured</span>`}
                            </div>
                            <md-text-button @click=${() => this._toggleExpand("wifi")} .disabled=${this._credLoading}
                                >Edit</md-text-button
                            >
                        </div>

                        ${this._expandedRow === "wifi"
                            ? html` <div class="cred-form">
                                  <md-outlined-text-field
                                      id="cred-wifi-ssid"
                                      label="SSID"
                                      .value=${this.client.serverInfo.wifi_ssid ?? ""}
                                      .disabled=${this._credLoading}
                                  ></md-outlined-text-field>
                                  <div class="password-row">
                                      <md-outlined-text-field
                                          id="cred-wifi-password"
                                          label="Password"
                                          .type=${this._showPassword ? "text" : "password"}
                                          .disabled=${this._credLoading}
                                      ></md-outlined-text-field>
                                      <md-icon-button @click=${this._togglePassword}>
                                          <ha-svg-icon .path=${this._showPassword ? mdiEyeOff : mdiEye}></ha-svg-icon>
                                      </md-icon-button>
                                  </div>
                                  <div class="form-actions">
                                      <md-text-button @click=${this._cancelCred} .disabled=${this._credLoading}
                                          >Cancel</md-text-button
                                      >
                                      ${this.client.serverInfo.wifi_credentials_set
                                          ? html`<md-text-button
                                                @click=${handleAsync(() => this._removeWifi())}
                                                .disabled=${this._credLoading}
                                                >Remove</md-text-button
                                            >`
                                          : nothing}
                                      <md-filled-button
                                          @click=${handleAsync(() => this._saveWifi())}
                                          .disabled=${this._credLoading}
                                          >Save</md-filled-button
                                      >
                                  </div>
                              </div>`
                            : nothing}

                        <div class="cred-row cred-row-thread">
                            <div class="cred-info">
                                <ha-svg-icon .path=${mdiAccessPoint}></ha-svg-icon>
                                <span class="cred-label">Thread</span>
                                ${this.client.serverInfo.thread_credentials_set
                                    ? html`<span class="cred-value">Thread network set</span>`
                                    : html`<span class="cred-unset">Not configured</span>`}
                            </div>
                            <md-text-button @click=${() => this._toggleExpand("thread")} .disabled=${this._credLoading}
                                >Edit</md-text-button
                            >
                        </div>

                        ${this._expandedRow === "thread"
                            ? html` <div class="cred-form">
                                  <md-outlined-text-field
                                      id="cred-thread-dataset"
                                      label="Thread dataset"
                                      supporting-text="Hex string (e.g. 0E080000...)"
                                      .disabled=${this._credLoading}
                                  ></md-outlined-text-field>
                                  <div class="form-actions">
                                      <md-text-button @click=${this._cancelCred} .disabled=${this._credLoading}
                                          >Cancel</md-text-button
                                      >
                                      ${this.client.serverInfo.thread_credentials_set
                                          ? html`<md-text-button
                                                @click=${handleAsync(() => this._removeThread())}
                                                .disabled=${this._credLoading}
                                                >Remove</md-text-button
                                            >`
                                          : nothing}
                                      <md-filled-button
                                          @click=${handleAsync(() => this._saveThread())}
                                          .disabled=${this._credLoading}
                                          >Save</md-filled-button
                                      >
                                  </div>
                              </div>`
                            : nothing}

                        <p class="cred-hint">Used when commissioning new devices. Existing devices are not affected.</p>
                    </section>
                </div>
                <div slot="actions">
                    <md-text-button @click=${this._close}>Close</md-text-button>
                </div>
            </md-dialog>
        `;
    }

    static override styles = css`
        md-dialog {
            min-width: 480px;
            max-width: 600px;
        }

        .section {
            padding: 8px 0 16px 0;
        }

        .section-title {
            margin: 0 0 12px 0;
            font-size: 0.95rem;
            font-weight: 500;
            color: var(--md-sys-color-on-surface);
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }

        .toggle-row {
            display: flex;
            align-items: center;
            gap: 16px;
            justify-content: space-between;
        }

        .toggle-label {
            display: flex;
            flex-direction: column;
            gap: 4px;
            color: var(--md-sys-color-on-surface);
            font-size: 0.95rem;
        }

        .hint {
            font-size: 0.825rem;
            color: var(--md-sys-color-on-surface-variant);
            font-weight: 400;
        }

        .hint code {
            font-family: var(--monospace-font);
            background: var(--md-sys-color-surface-container-high);
            padding: 0 4px;
            border-radius: 3px;
        }

        .aux-row {
            margin-top: 8px;
            display: flex;
            justify-content: flex-end;
        }

        md-divider {
            margin: 12px 0;
        }

        .cred-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 4px 0;
        }

        .cred-row-thread {
            margin-top: 8px;
        }

        .cred-info {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 0.9rem;
            color: var(--md-sys-color-on-surface);
        }

        .cred-label {
            font-weight: 500;
            min-width: 52px;
        }

        .cred-value {
            color: var(--md-sys-color-on-surface-variant);
        }

        .cred-unset {
            color: var(--md-sys-color-on-surface-variant);
            font-style: italic;
        }

        .cred-form {
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding: 8px 0 4px 0;
        }

        .password-row {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .password-row md-outlined-text-field {
            flex: 1;
        }

        .form-actions {
            display: flex;
            gap: 4px;
            justify-content: flex-end;
        }

        .cred-hint {
            margin: 10px 0 0 0;
            font-size: 0.8rem;
            color: var(--md-sys-color-on-surface-variant);
        }

        .cred-info ha-svg-icon {
            width: 18px;
            height: 18px;
            color: var(--md-sys-color-on-surface-variant);
        }

        .password-row ha-svg-icon {
            width: 18px;
            height: 18px;
            color: var(--md-sys-color-on-surface-variant);
        }
    `;
}

declare global {
    interface HTMLElementTagNameMap {
        "settings-dialog": SettingsDialog;
    }
}
