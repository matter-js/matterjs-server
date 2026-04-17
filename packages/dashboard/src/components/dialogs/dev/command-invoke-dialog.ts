/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/text-button";
import "@material/web/dialog/dialog";
import type { MdDialog } from "@material/web/dialog/dialog.js";
import { MatterClient, toBigIntAwareJson } from "@matter-server/ws-client";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { handleAsync } from "../../../util/async-handler.js";
import { formatHex } from "../../../util/format_hex.js";
import { preventDefault } from "../../../util/prevent_default.js";
import { parseJsonPayload } from "./parse-json-payload.js";

@customElement("command-invoke-dialog")
export class CommandInvokeDialog extends LitElement {
    @property({ attribute: false })
    public client!: MatterClient;

    @property({ type: Number }) public nodeId!: number | bigint;
    @property({ type: Number }) public endpointId!: number;
    @property({ type: Number }) public clusterId!: number;
    @property({ type: String }) public commandName!: string;
    @property({ type: String }) public commandLabel!: string;

    @state() private _busy = false;
    @state() private _error: string | null = null;
    @state() private _response: string | null = null;

    @query("textarea") private _textarea!: HTMLTextAreaElement;

    protected override firstUpdated() {
        // Seed the textarea once, bypassing the render cycle so later state updates
        // (busy/error/response) don't clobber the user's edits.
        if (this._textarea && this._textarea.value === "") {
            this._textarea.value = "{}";
        }
    }

    private _close() {
        this.shadowRoot!.querySelector<MdDialog>("md-dialog")!.close();
    }

    private _handleClosed() {
        this.parentNode!.removeChild(this);
    }

    private async _invoke() {
        this._error = null;
        const parsed = parseJsonPayload(this._textarea.value);
        if (!parsed.ok) {
            this._error = `Invalid JSON: ${parsed.error}`;
            this._response = null;
            return;
        }
        const payload = parsed.value as Record<string, unknown>;
        this._busy = true;
        try {
            const result = await this.client.deviceCommand(
                this.nodeId,
                this.endpointId,
                this.clusterId,
                this.commandName,
                payload,
            );
            this._response = toBigIntAwareJson(result ?? null, 2);
            this._error = null;
        } catch (err) {
            this._error = err instanceof Error ? err.message : String(err);
            this._response = null;
        } finally {
            this._busy = false;
        }
    }

    protected override render() {
        return html`
            <md-dialog open @cancel=${preventDefault} @closed=${this._handleClosed}>
                <div slot="headline">Invoke ${this.commandLabel}</div>
                <div slot="content">
                    <p class="path" id="invoke-path">
                        Cluster <code>${this.clusterId}</code> (${formatHex(this.clusterId)}) · Endpoint
                        <code>${this.endpointId}</code> · Command <code>${this.commandName}</code>
                    </p>
                    <label class="textarea-label" for="payload">Payload (JSON)</label>
                    <textarea
                        id="payload"
                        class="payload"
                        spellcheck="false"
                        autocomplete="off"
                        autocapitalize="off"
                        aria-describedby="invoke-path${this._error ? " invoke-error" : ""}"
                        rows="8"
                    ></textarea>
                    ${this._error
                        ? html`<div id="invoke-error" class="error" role="alert">${this._error}</div>`
                        : nothing}
                    ${this._response !== null
                        ? html`
                              <label class="textarea-label">Response</label>
                              <pre class="response"><code>${this._response}</code></pre>
                          `
                        : nothing}
                </div>
                <div slot="actions">
                    <md-text-button @click=${this._close} ?disabled=${this._busy}>Close</md-text-button>
                    <md-text-button @click=${handleAsync(() => this._invoke())} ?disabled=${this._busy}>
                        ${this._busy ? "Invoking..." : "Invoke"}
                    </md-text-button>
                </div>
            </md-dialog>
        `;
    }

    static override styles = css`
        md-dialog {
            min-width: 520px;
            max-width: 720px;
        }

        .path {
            margin: 0 0 12px 0;
            font-size: 0.85rem;
            color: var(--md-sys-color-on-surface-variant);
        }

        .path code {
            font-family: var(--monospace-font);
            background: var(--md-sys-color-surface-container-high);
            padding: 0 4px;
            border-radius: 3px;
        }

        .textarea-label {
            display: block;
            margin: 6px 0 6px 0;
            font-size: 0.85rem;
            font-weight: 500;
            color: var(--md-sys-color-on-surface);
        }

        .payload {
            width: 100%;
            box-sizing: border-box;
            font-family: var(--monospace-font);
            font-size: 0.9rem;
            padding: 8px;
            background: var(--md-sys-color-surface-container-low);
            color: var(--md-sys-color-on-surface);
            border: 1px solid var(--md-sys-color-outline);
            border-radius: 6px;
            resize: vertical;
            min-height: 120px;
        }

        .payload:focus {
            outline: 2px solid var(--dev-color);
            outline-offset: -1px;
        }

        .error {
            margin-top: 10px;
            padding: 10px 12px;
            background: var(--md-sys-color-error-container);
            color: var(--md-sys-color-on-error-container);
            border-radius: 6px;
            font-size: 0.875rem;
            white-space: pre-wrap;
            word-break: break-word;
        }

        .response {
            margin: 6px 0 0 0;
            padding: 10px 12px;
            background: var(--md-sys-color-surface-container-low);
            color: var(--md-sys-color-on-surface);
            border: 1px solid var(--md-sys-color-outline);
            border-radius: 6px;
            max-height: 260px;
            overflow: auto;
            font-size: 0.85rem;
        }

        .response code {
            font-family: var(--monospace-font);
            white-space: pre-wrap;
            word-break: break-word;
        }
    `;
}

declare global {
    interface HTMLElementTagNameMap {
        "command-invoke-dialog": CommandInvokeDialog;
    }
}
