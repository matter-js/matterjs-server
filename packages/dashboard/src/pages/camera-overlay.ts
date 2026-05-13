/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/text-button.js";
import "@material/web/iconbutton/icon-button.js";
import { mdiClose } from "@mdi/js";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import "../components/ha-svg-icon.js";

@customElement("camera-overlay")
export class CameraOverlay extends LitElement {
    @property({ type: Number }) nodeId!: number;
    @property({ type: Number }) endpointId!: number;

    private _close(): void {
        this.remove();
    }

    override render() {
        return html`
            <div class="backdrop" @click=${this._close}></div>
            <div class="frame" @click=${(e: Event) => e.stopPropagation()}>
                <header>
                    <md-icon-button @click=${this._close} aria-label="Close">
                        <ha-svg-icon .path=${mdiClose}></ha-svg-icon>
                    </md-icon-button>
                    <span>Node ${this.nodeId} • Endpoint ${this.endpointId}</span>
                </header>
                <main>
                    <div class="placeholder">Stream and snapshot UI lands in subsequent commits.</div>
                </main>
                <footer>
                    <md-text-button @click=${this._close}>Close</md-text-button>
                </footer>
            </div>
        `;
    }

    static override styles = css`
        :host {
            position: fixed;
            inset: 0;
            display: grid;
            place-items: center;
            z-index: 9999;
        }
        .backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.8);
        }
        .frame {
            position: relative;
            width: min(80vw, 1200px);
            height: min(80vh, 800px);
            background: var(--md-sys-color-surface);
            color: var(--md-sys-color-on-surface);
            display: grid;
            grid-template-rows: auto 1fr auto;
            border-radius: 8px;
            overflow: hidden;
        }
        header {
            display: flex;
            align-items: center;
            padding: 8px 16px;
            gap: 12px;
            border-bottom: 1px solid var(--md-sys-color-outline-variant);
        }
        main {
            display: grid;
            place-items: center;
            padding: 16px;
        }
        .placeholder {
            color: var(--text-color, rgba(0, 0, 0, 0.6));
            font-style: italic;
        }
        footer {
            padding: 8px 16px;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            border-top: 1px solid var(--md-sys-color-outline-variant);
        }
    `;
}

declare global {
    interface HTMLElementTagNameMap {
        "camera-overlay": CameraOverlay;
    }
}
