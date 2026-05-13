/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/text-button";
import "@material/web/select/outlined-select";
import type { MdOutlinedSelect } from "@material/web/select/outlined-select.js";
import "@material/web/select/select-option";
import { LogLevelString, MatterClient } from "@matter-server/ws-client";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { fireAndForget, handleAsync } from "../../../util/async-handler.js";
import { showAlertDialog } from "../../dialog-box/show-dialog-box.js";

const LOG_LEVELS: { value: LogLevelString; label: string }[] = [
    { value: "critical", label: "Critical" },
    { value: "error", label: "Error" },
    { value: "warning", label: "Warning" },
    { value: "info", label: "Info" },
    { value: "debug", label: "Debug" },
];

/**
 * Server log-level form. Shared between the standalone log-level dialog and the
 * combined settings dialog.
 */
@customElement("log-level-section")
export class LogLevelSection extends LitElement {
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
        fireAndForget(this._loadLogLevels());
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
            this.dispatchEvent(new CustomEvent("log-level-applied", { bubbles: true, composed: true }));
        } catch (err) {
            console.error("Failed to apply log levels:", err);
            showAlertDialog({ title: "Error", text: "Failed to apply log levels" });
        } finally {
            this._applying = false;
        }
    }

    protected override render() {
        if (this._loading) {
            return html` <p class="loading">Loading...</p> `;
        }
        return html`
            <p class="hint">Changes are temporary and will be reset on the next server restart.</p>
            <div class="form-field">
                <label>Console Log Level</label>
                <md-outlined-select name="console" .value=${this._consoleLevel}>
                    ${LOG_LEVELS.map(
                        level => html`
                            <md-select-option value=${level.value} ?selected=${level.value === this._consoleLevel}>
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
            <div class="actions">
                <md-text-button @click=${handleAsync(() => this._apply())} ?disabled=${this._applying}>
                    ${this._applying ? "Applying..." : "Apply"}
                </md-text-button>
            </div>
        `;
    }

    static override styles = css`
        :host {
            display: block;
        }

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

        .actions {
            display: flex;
            justify-content: flex-end;
            margin-top: 8px;
        }
    `;
}

declare global {
    interface HTMLElementTagNameMap {
        "log-level-section": LogLevelSection;
    }
}
