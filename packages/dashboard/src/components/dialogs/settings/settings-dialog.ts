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
import { consume } from "@lit/context";
import type { MdDialog } from "@material/web/dialog/dialog.js";
import type { MdSwitch } from "@material/web/switch/switch.js";
import "@material/web/textfield/outlined-text-field";
import type { MdOutlinedTextField } from "@material/web/textfield/outlined-text-field.js";
import { AllCredentialsSummary, MatterClient } from "@matter-server/ws-client";
import { mdiAccessPoint, mdiDelete, mdiEye, mdiEyeOff, mdiPencil, mdiPlus, mdiWifi } from "@mdi/js";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { clientContext, tickContext } from "../../../client/client-context.js";
import { handleAsync } from "../../../util/async-handler.js";
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

    @state() private _creds?: AllCredentialsSummary;

    @state() private _wifiEditId: string | null = null;
    @state() private _wifiAdding = false;
    @state() private _threadEditId: string | null = null;
    @state() private _threadAdding = false;
    @state() private _credError: string | null = null;

    @query("#cred-wifi-ssid") private _wifiSsidField!: MdOutlinedTextField;
    @query("#cred-wifi-password") private _wifiPasswordField!: MdOutlinedTextField;
    @query("#cred-wifi-id") private _wifiIdField?: MdOutlinedTextField;
    @query("#cred-thread-dataset") private _threadDatasetField!: MdOutlinedTextField;
    @query("#cred-thread-id") private _threadIdField?: MdOutlinedTextField;

    private get _supportsCredentialLists() {
        return (this.client.serverInfo?.schema_version ?? 0) >= 12;
    }

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
        void this._loadCredentials();
    }

    private async _loadCredentials() {
        if (!this._supportsCredentialLists) {
            this._creds = undefined;
            return;
        }
        try {
            this._creds = await this.client.getAllCredentials();
        } catch {
            // Fall back to server-info booleans (older/erroring server); single default editor still works.
            this._creds = undefined;
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
        this._resetCredForms();
    }

    private _resetCredForms() {
        this._showPassword = false;
        this._wifiEditId = null;
        this._wifiAdding = false;
        this._threadEditId = null;
        this._threadAdding = false;
        this._credError = null;
    }

    private _cancelCred() {
        this._expandedRow = null;
        this._resetCredForms();
    }

    private _togglePassword() {
        this._showPassword = !this._showPassword;
    }

    private _editWifi(id: string) {
        this._wifiAdding = false;
        this._wifiEditId = id;
        this._showPassword = false;
        this._credError = null;
    }

    private _addWifi() {
        this._wifiEditId = null;
        this._wifiAdding = true;
        this._showPassword = false;
        this._credError = null;
    }

    private _cancelWifiForm() {
        this._wifiEditId = null;
        this._wifiAdding = false;
        this._showPassword = false;
        this._credError = null;
    }

    private _editThread(id: string) {
        this._threadAdding = false;
        this._threadEditId = id;
        this._credError = null;
    }

    private _addThread() {
        this._threadEditId = null;
        this._threadAdding = true;
        this._credError = null;
    }

    private _cancelThreadForm() {
        this._threadEditId = null;
        this._threadAdding = false;
        this._credError = null;
    }

    /** Mirror the server's id validation. Returns the trimmed id, or null after setting an inline error. */
    private _validateNewCredId(raw: string, existing: ReadonlyArray<{ id: string }>): string | null {
        const trimmed = raw.trim();
        if (trimmed === "") {
            this._credError = "Identifier is required";
            return null;
        }
        const lower = trimmed.toLowerCase();
        if (lower === "default" || lower === "delete") {
            this._credError = `'${trimmed}' is a reserved identifier`;
            return null;
        }
        if (existing.some(e => e.id.toLowerCase() === lower)) {
            this._credError = `An entry with identifier '${trimmed}' already exists`;
            return null;
        }
        return trimmed;
    }

    private async _saveWifi(id?: string) {
        const ssid = this._wifiSsidField.value.trim();
        if (!ssid) {
            this._credError = "SSID is required";
            return;
        }
        let targetId = id;
        if (targetId === undefined && this._supportsCredentialLists) {
            const validated = this._validateNewCredId(this._wifiIdField?.value ?? "", this._creds?.wifi ?? []);
            if (validated === null) return;
            targetId = validated;
        }
        const password = this._wifiPasswordField.value;
        // Default entry may be unset, so its stored-secret state comes from the server-info flag, not the list.
        const hasStoredSecret =
            id !== undefined && (id === "default" ? (this.client.serverInfo.wifi_credentials_set ?? false) : true);
        if (!password && !hasStoredSecret) {
            this._credError = "Password is required";
            return;
        }
        this._credLoading = true;
        this._credError = null;
        try {
            await this.client.setWifiCredentials(ssid, password, targetId);
            this._cancelWifiForm();
            await this._loadCredentials();
        } catch (err) {
            showAlertDialog({ title: "Error saving WiFi credentials", text: (err as Error).message });
        } finally {
            this._credLoading = false;
        }
    }

    private async _removeWifi(id?: string) {
        this._credLoading = true;
        try {
            await this.client.removeWifiCredentials(id);
            this._cancelWifiForm();
            await this._loadCredentials();
        } catch (err) {
            showAlertDialog({ title: "Error removing WiFi credentials", text: (err as Error).message });
        } finally {
            this._credLoading = false;
        }
    }

    private async _saveThread(id?: string) {
        const dataset = this._threadDatasetField.value.trim();
        if (!dataset) {
            this._credError = "Thread dataset is required";
            return;
        }
        if (!/^[0-9a-fA-F]*$/.test(dataset) || dataset.length % 2 !== 0) {
            this._credError = "Dataset must be a hex string with even length (each byte is two hex characters)";
            return;
        }
        let targetId = id;
        if (targetId === undefined && this._supportsCredentialLists) {
            const validated = this._validateNewCredId(this._threadIdField?.value ?? "", this._creds?.thread ?? []);
            if (validated === null) return;
            targetId = validated;
        }
        this._credLoading = true;
        this._credError = null;
        try {
            await this.client.setThreadOperationalDataset(dataset, targetId);
            this._cancelThreadForm();
            await this._loadCredentials();
        } catch (err) {
            showAlertDialog({ title: "Error saving Thread dataset", text: (err as Error).message });
        } finally {
            this._credLoading = false;
        }
    }

    private async _removeThread(id?: string) {
        this._credLoading = true;
        try {
            await this.client.removeThreadDataset(id);
            this._cancelThreadForm();
            await this._loadCredentials();
        } catch (err) {
            showAlertDialog({ title: "Error removing Thread dataset", text: (err as Error).message });
        } finally {
            this._credLoading = false;
        }
    }

    private _renderCredError() {
        return this._credError ? html`<p class="cred-error">${this._credError}</p>` : nothing;
    }

    private _renderWifiList() {
        const entries = this._creds?.wifi ?? [];
        return html`
            <div class="cred-group">
                <div class="cred-group-header">
                    <div class="cred-info">
                        <ha-svg-icon .path=${mdiWifi}></ha-svg-icon>
                        <span class="cred-label">WiFi</span>
                    </div>
                    <md-text-button
                        @click=${this._addWifi}
                        .disabled=${this._credLoading || this._wifiAdding || this._wifiEditId !== null}
                    >
                        <ha-svg-icon slot="icon" .path=${mdiPlus}></ha-svg-icon>Add
                    </md-text-button>
                </div>
                ${entries.length === 0 && !this._wifiAdding
                    ? html`<p class="cred-empty">No WiFi credentials configured</p>`
                    : nothing}
                ${entries.map(entry => this._renderWifiEntry(entry))}
                ${this._wifiAdding ? this._renderWifiForm(undefined, "") : nothing}
            </div>
        `;
    }

    private _renderWifiEntry(entry: { id: string; ssid: string }) {
        const isDefault = entry.id === "default";
        if (this._wifiEditId === entry.id) {
            return this._renderWifiForm(entry.id, entry.ssid);
        }
        return html`
            <div class="cred-row">
                <div class="cred-info cred-entry">
                    <span class="cred-value">${entry.ssid || "(no SSID)"}</span>
                    ${isDefault ? html`<span class="cred-badge">Default</span>` : nothing}
                </div>
                <div class="cred-row-actions">
                    <md-icon-button
                        title="Edit"
                        @click=${() => this._editWifi(entry.id)}
                        .disabled=${this._credLoading}
                    >
                        <ha-svg-icon .path=${mdiPencil}></ha-svg-icon>
                    </md-icon-button>
                    ${isDefault
                        ? html`<md-text-button
                              @click=${handleAsync(() => this._removeWifi("default"))}
                              .disabled=${this._credLoading}
                              >Clear</md-text-button
                          >`
                        : html`<md-icon-button
                              title="Delete"
                              @click=${handleAsync(() => this._removeWifi(entry.id))}
                              .disabled=${this._credLoading}
                          >
                              <ha-svg-icon .path=${mdiDelete}></ha-svg-icon>
                          </md-icon-button>`}
                </div>
            </div>
        `;
    }

    private _renderWifiForm(id: string | undefined, ssid: string) {
        const isAdd = id === undefined;
        return html`
            <div class="cred-form">
                ${isAdd
                    ? html`<md-outlined-text-field
                          id="cred-wifi-id"
                          label="Identifier"
                          supporting-text="Unique name (not 'default' or 'delete')"
                          .disabled=${this._credLoading}
                      ></md-outlined-text-field>`
                    : nothing}
                <md-outlined-text-field
                    id="cred-wifi-ssid"
                    label="SSID"
                    .value=${ssid}
                    .disabled=${this._credLoading}
                ></md-outlined-text-field>
                <div class="password-row">
                    <md-outlined-text-field
                        id="cred-wifi-password"
                        label="Password"
                        .type=${this._showPassword ? "text" : "password"}
                        .placeholder=${isAdd ? "" : "leave blank to keep"}
                        .disabled=${this._credLoading}
                    ></md-outlined-text-field>
                    <md-icon-button @click=${this._togglePassword}>
                        <ha-svg-icon .path=${this._showPassword ? mdiEyeOff : mdiEye}></ha-svg-icon>
                    </md-icon-button>
                </div>
                ${this._renderCredError()}
                <div class="form-actions">
                    <md-text-button @click=${this._cancelWifiForm} .disabled=${this._credLoading}
                        >Cancel</md-text-button
                    >
                    <md-filled-button @click=${handleAsync(() => this._saveWifi(id))} .disabled=${this._credLoading}
                        >Save</md-filled-button
                    >
                </div>
            </div>
        `;
    }

    private _renderThreadList() {
        const entries = this._creds?.thread ?? [];
        return html`
            <div class="cred-group cred-group-thread">
                <div class="cred-group-header">
                    <div class="cred-info">
                        <ha-svg-icon .path=${mdiAccessPoint}></ha-svg-icon>
                        <span class="cred-label">Thread</span>
                    </div>
                    <md-text-button
                        @click=${this._addThread}
                        .disabled=${this._credLoading || this._threadAdding || this._threadEditId !== null}
                    >
                        <ha-svg-icon slot="icon" .path=${mdiPlus}></ha-svg-icon>Add
                    </md-text-button>
                </div>
                ${entries.length === 0 && !this._threadAdding
                    ? html`<p class="cred-empty">No Thread datasets configured</p>`
                    : nothing}
                ${entries.map(entry => this._renderThreadEntry(entry))}
                ${this._threadAdding ? this._renderThreadForm(undefined) : nothing}
            </div>
        `;
    }

    private _renderThreadEntry(entry: { id: string; networkName?: string; extPanId?: string }) {
        const isDefault = entry.id === "default";
        if (this._threadEditId === entry.id) {
            return this._renderThreadForm(entry.id);
        }
        const label = entry.networkName ?? entry.extPanId ?? "Thread network set";
        return html`
            <div class="cred-row">
                <div class="cred-info cred-entry">
                    <span class="cred-value">${label}</span>
                    ${isDefault ? html`<span class="cred-badge">Default</span>` : nothing}
                </div>
                <div class="cred-row-actions">
                    <md-icon-button
                        title="Edit"
                        @click=${() => this._editThread(entry.id)}
                        .disabled=${this._credLoading}
                    >
                        <ha-svg-icon .path=${mdiPencil}></ha-svg-icon>
                    </md-icon-button>
                    ${isDefault
                        ? html`<md-text-button
                              @click=${handleAsync(() => this._removeThread("default"))}
                              .disabled=${this._credLoading}
                              >Clear</md-text-button
                          >`
                        : html`<md-icon-button
                              title="Delete"
                              @click=${handleAsync(() => this._removeThread(entry.id))}
                              .disabled=${this._credLoading}
                          >
                              <ha-svg-icon .path=${mdiDelete}></ha-svg-icon>
                          </md-icon-button>`}
                </div>
            </div>
        `;
    }

    private _renderThreadForm(id: string | undefined) {
        const isAdd = id === undefined;
        return html`
            <div class="cred-form">
                ${isAdd
                    ? html`<md-outlined-text-field
                          id="cred-thread-id"
                          label="Identifier"
                          supporting-text="Unique name (not 'default' or 'delete')"
                          .disabled=${this._credLoading}
                      ></md-outlined-text-field>`
                    : nothing}
                <md-outlined-text-field
                    id="cred-thread-dataset"
                    label="Thread dataset"
                    supporting-text="Hex string (e.g. 0E080000...)"
                    .disabled=${this._credLoading}
                ></md-outlined-text-field>
                ${this._renderCredError()}
                <div class="form-actions">
                    <md-text-button @click=${this._cancelThreadForm} .disabled=${this._credLoading}
                        >Cancel</md-text-button
                    >
                    <md-filled-button @click=${handleAsync(() => this._saveThread(id))} .disabled=${this._credLoading}
                        >Save</md-filled-button
                    >
                </div>
            </div>
        `;
    }

    private _renderLegacyWifi() {
        return html`
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
                ? html`<div class="cred-form">
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
                      ${this._renderCredError()}
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
                          <md-filled-button @click=${handleAsync(() => this._saveWifi())} .disabled=${this._credLoading}
                              >Save</md-filled-button
                          >
                      </div>
                  </div>`
                : nothing}
        `;
    }

    private _renderLegacyThread() {
        return html`
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
                ? html`<div class="cred-form">
                      <md-outlined-text-field
                          id="cred-thread-dataset"
                          label="Thread dataset"
                          supporting-text="Hex string (e.g. 0E080000...)"
                          .disabled=${this._credLoading}
                      ></md-outlined-text-field>
                      ${this._renderCredError()}
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
        `;
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

                        ${this._supportsCredentialLists ? this._renderWifiList() : this._renderLegacyWifi()}
                        ${this._supportsCredentialLists ? this._renderThreadList() : this._renderLegacyThread()}

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

        .cred-group {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .cred-group-thread {
            margin-top: 16px;
        }

        .cred-group-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .cred-entry {
            gap: 8px;
        }

        .cred-row-actions {
            display: flex;
            align-items: center;
            gap: 2px;
        }

        .cred-row-actions md-icon-button {
            --md-icon-button-icon-size: 18px;
        }

        .cred-badge {
            font-size: 0.7rem;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 1px 8px;
            border-radius: 10px;
            background: var(--md-sys-color-secondary-container);
            color: var(--md-sys-color-on-secondary-container);
        }

        .cred-empty {
            margin: 4px 0 0 28px;
            font-size: 0.85rem;
            font-style: italic;
            color: var(--md-sys-color-on-surface-variant);
        }

        .cred-error {
            margin: 0;
            font-size: 0.8rem;
            color: var(--md-sys-color-error);
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
