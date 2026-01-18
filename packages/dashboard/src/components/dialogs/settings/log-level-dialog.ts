/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/text-button";
import "@material/web/dialog/dialog";
import type { MdDialog } from "@material/web/dialog/dialog.js";
import "@material/web/select/outlined-select";
import type { MdOutlinedSelect } from "@material/web/select/outlined-select.js";
import "@material/web/select/select-option";
import { LogLevelString, MatterClient } from "@matter-server/ws-client";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { preventDefault } from "../../../util/prevent_default.js";

const LOG_LEVELS: { value: LogLevelString; label: string }[] = [
    { value: "critical", label: "Critical" },
    { value: "error", label: "Error" },
    { value: "warning", label: "Warning" },
    { value: "info", label: "Info" },
    { value: "debug", label: "Debug" },
];

@customElement("log-level-dialog")
export class LogLevelDialog extends LitElement {
    @property({ attribute: false })
    public client!: MatterClient;

    @state() private _consoleLevel: LogLevelString = "info";
    @state() private _fileLevel: LogLevelString | null = null;
    @state() private _loading = true;
    @state() private _applying = false;

    @query("md-outlined-select[name='console']")
    private _consoleSelect!: MdOutlinedSelect;

    @query("md-outlined-select[name='file']")
    private _fileSelect?: MdOutlinedSelect;

    override connectedCallback() {
        super.connectedCallback();
        void this._loadLogLevels();
    }

    private async _loadLogLevels() {
        try {
            const result = await this.client.getLogLevel();
            this._consoleLevel = result.console_loglevel;
            this._fileLevel = result.file_loglevel;
        } catch (err) {
            console.error("Failed to load log levels:", err);
        } finally {
            this._loading = false;
        }
    }

    private async _apply() {
        this._applying = true;
        try {
            const consoleLevel = this._consoleSelect.value as LogLevelString;
            const fileLevel = this._fileSelect?.value as LogLevelString | undefined;

            const result = await this.client.setLogLevel(
                consoleLevel,
                this._fileLevel !== null ? fileLevel : undefined,
            );

            this._consoleLevel = result.console_loglevel;
            this._fileLevel = result.file_loglevel;
            this._close();
        } catch (err) {
            console.error("Failed to apply log levels:", err);
            alert("Failed to apply log levels");
        } finally {
            this._applying = false;
        }
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
                <div slot="headline">Server Log Settings</div>
                <div slot="content">
                    ${this._loading
                        ? html`<p class="loading">Loading...</p>`
                        : html`
                              <p class="hint">Changes are temporary and will be reset on the next server restart.</p>
                              <div class="form-field">
                                  <label>Console Log Level</label>
                                  <md-outlined-select name="console" .value=${this._consoleLevel}>
                                      ${LOG_LEVELS.map(
                                          level => html`
                                              <md-select-option
                                                  value=${level.value}
                                                  ?selected=${level.value === this._consoleLevel}
                                              >
                                                  <div slot="headline">${level.label}</div>
                                              </md-select-option>
                                          `,
                                      )}
                                  </md-outlined-select>
                              </div>
                              ${this._fileLevel !== null
                                  ? html`
                                        <div class="form-field">
                                            <label>File Log Level</label>
                                            <md-outlined-select name="file" .value=${this._fileLevel}>
                                                ${LOG_LEVELS.map(
                                                    level => html`
                                                        <md-select-option
                                                            value=${level.value}
                                                            ?selected=${level.value === this._fileLevel}
                                                        >
                                                            <div slot="headline">${level.label}</div>
                                                        </md-select-option>
                                                    `,
                                                )}
                                            </md-outlined-select>
                                        </div>
                                    `
                                  : nothing}
                          `}
                </div>
                <div slot="actions">
                    <md-text-button @click=${this._close}>Cancel</md-text-button>
                    <md-text-button @click=${this._apply} ?disabled=${this._loading || this._applying}>
                        ${this._applying ? "Applying..." : "Apply"}
                    </md-text-button>
                </div>
            </md-dialog>
        `;
    }

    static override styles = css`
        .loading {
            text-align: center;
            padding: 24px;
            color: var(--md-sys-color-on-surface-variant);
        }

        .hint {
            font-size: 0.875rem;
            color: var(--md-sys-color-on-surface-variant);
            margin: 0 0 16px 0;
            font-style: italic;
        }

        .form-field {
            margin-bottom: 16px;
        }

        .form-field label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: var(--md-sys-color-on-surface);
        }

        md-outlined-select {
            width: 100%;
        }
    `;
}

declare global {
    interface HTMLElementTagNameMap {
        "log-level-dialog": LogLevelDialog;
    }
}
