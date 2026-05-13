/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import "@material/web/button/filled-button.js";
import type { MatterClient } from "@matter-server/ws-client";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { clientContext } from "../client/client-context.js";
import "../pages/camera-overlay.js";

const CAMERA_DEVICE_TYPES = new Set<number>([
    0x0142, // Camera
    0x0143, // VideoDoorbell
]);

@customElement("camera-live-view-button")
export class CameraLiveViewButton extends LitElement {
    @consume({ context: clientContext, subscribe: true })
    @property({ attribute: false })
    client?: MatterClient;

    @property({ type: Number }) nodeId!: number;
    @property({ type: Number }) endpointId!: number;
    @property({ type: Array }) deviceTypes: number[] = [];

    private get _visible(): boolean {
        return this.deviceTypes.some(t => CAMERA_DEVICE_TYPES.has(t));
    }

    private _open(): void {
        const overlay = document.createElement("camera-overlay");
        overlay.nodeId = this.nodeId;
        overlay.endpointId = this.endpointId;
        document.querySelector("matter-dashboard-app")?.renderRoot.appendChild(overlay);
    }

    override willUpdate() {
        this.style.display = this._visible ? "" : "none";
    }

    override render() {
        if (!this._visible) return html``;
        return html`<md-filled-button @click=${this._open} ?disabled=${!this.client}>Live View</md-filled-button>`;
    }

    static override styles = css`
        :host {
            display: block;
            padding: 16px;
            max-width: 95%;
            margin: 0 auto;
        }
    `;
}

declare global {
    interface HTMLElementTagNameMap {
        "camera-live-view-button": CameraLiveViewButton;
    }
}
