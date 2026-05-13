/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import "@material/web/button/filled-button.js";
import "@material/web/button/text-button.js";
import "@material/web/iconbutton/icon-button.js";
import type { MatterClient } from "@matter-server/ws-client";
import { mdiClose } from "@mdi/js";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { clientContext } from "../client/client-context.js";
import "../components/ha-svg-icon.js";
import "../components/webrtc-stream-view.js";
import type { WebRtcStreamView } from "../components/webrtc-stream-view.js";

type StreamState = "idle" | "connecting" | "streaming" | "error";

@customElement("camera-overlay")
export class CameraOverlay extends LitElement {
    @consume({ context: clientContext, subscribe: true })
    @property({ attribute: false })
    client?: MatterClient;

    @property({ type: Number }) nodeId!: number;
    @property({ type: Number }) endpointId!: number;

    @state() private _state: StreamState = "idle";
    @state() private _errorMessage: string | null = null;

    private _streamViewRef = createRef<WebRtcStreamView>();

    private _close(): void {
        const view = this._streamViewRef.value;
        if (view) {
            void view.stop();
        }
        this.remove();
    }

    private _onStreamState(ev: CustomEvent<{ state: StreamState; errorMessage: string | null }>): void {
        this._state = ev.detail.state;
        this._errorMessage = ev.detail.errorMessage;
    }

    private _start(): void {
        const view = this._streamViewRef.value;
        if (view) {
            void view.start();
        }
    }

    private _stop(): void {
        const view = this._streamViewRef.value;
        if (view) {
            void view.stop();
        }
    }

    override render() {
        const canStart = this._state === "idle" || this._state === "error";

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
                    ${this.client
                        ? html`<webrtc-stream-view
                              ${ref(this._streamViewRef)}
                              .nodeId=${this.nodeId}
                              .endpointId=${this.endpointId}
                              .resolution=${null}
                              @streamstate=${this._onStreamState}
                          ></webrtc-stream-view>`
                        : html`<div class="status error">No Matter client available.</div>`}
                </main>
                <footer>
                    ${this._state === "connecting" ? html`<span class="footer-status">Connecting…</span>` : nothing}
                    ${this._state === "error" && this._errorMessage
                        ? html`<span class="footer-status error">${this._errorMessage}</span>`
                        : nothing}
                    ${canStart
                        ? html`<md-filled-button @click=${this._start} ?disabled=${!this.client}>
                              ${this._state === "error" ? "Retry" : "Start"}
                          </md-filled-button>`
                        : nothing}
                    ${this._state === "streaming"
                        ? html`<md-filled-button @click=${this._stop}>End</md-filled-button>`
                        : nothing}
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
            display: block;
            background: black;
            min-height: 0;
        }
        webrtc-stream-view {
            width: 100%;
            height: 100%;
        }
        .status.error {
            color: var(--danger-color);
            text-align: center;
            padding: 16px;
        }
        footer {
            padding: 8px 16px;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 12px;
            border-top: 1px solid var(--md-sys-color-outline-variant);
        }
        .footer-status {
            margin-right: auto;
            color: var(--md-sys-color-on-surface-variant);
            font-style: italic;
        }
        .footer-status.error {
            color: var(--danger-color);
            font-style: normal;
        }
    `;
}

declare global {
    interface HTMLElementTagNameMap {
        "camera-overlay": CameraOverlay;
    }
}
