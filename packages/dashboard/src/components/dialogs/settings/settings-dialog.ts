/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/text-button";
import "@material/web/dialog/dialog";
import type { MdDialog } from "@material/web/dialog/dialog.js";
import "@material/web/divider/divider";
import "@material/web/switch/switch";
import type { MdSwitch } from "@material/web/switch/switch.js";
import { MatterClient } from "@matter-server/ws-client";
import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { DevModeService } from "../../../util/dev-mode-service.js";
import { preventDefault } from "../../../util/prevent_default.js";
import "./log-level-section.js";

@customElement("settings-dialog")
export class SettingsDialog extends LitElement {
    @property({ attribute: false })
    public client!: MatterClient;

    @state() private _devMode = DevModeService.active;

    private _unsubscribeDev?: () => void;

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
                        <log-level-section .client=${this.client}></log-level-section>
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
    `;
}

declare global {
    interface HTMLElementTagNameMap {
        "settings-dialog": SettingsDialog;
    }
}
