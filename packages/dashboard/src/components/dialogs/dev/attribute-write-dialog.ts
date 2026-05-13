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

@customElement("attribute-write-dialog")
export class AttributeWriteDialog extends LitElement {
    @property({ attribute: false })
    public client!: MatterClient;

    @property({ type: Number }) public nodeId!: number | bigint;
    @property({ type: Number }) public endpointId!: number;
    @property({ type: Number }) public clusterId!: number;
    @property({ type: Number }) public attributeId!: number;
    @property({ type: String }) public label!: string;
    @property({ attribute: false }) public currentValue: unknown = null;

    @state() private _busy = false;
    @state() private _error: string | null = null;

    @query("textarea") private _textarea!: HTMLTextAreaElement;

    protected override firstUpdated() {
        // Seed the textarea once, bypassing the render cycle so later state updates
        // (busy/error) don't clobber the user's edits.
        if (this._textarea && this._textarea.value === "") {
            this._textarea.value = toBigIntAwareJson(this.currentValue ?? null, 2);
        }
    }

    private get _attributePath(): string {
        return `${this.endpointId}/${this.clusterId}/${this.attributeId}`;
    }

    private _close() {
        this.shadowRoot!.querySelector<MdDialog>("md-dialog")!.close();
    }

    private _handleClosed() {
        this.parentNode!.removeChild(this);
    }

    private async _write() {
        this._error = null;
        const parsed = parseJsonPayload(this._textarea.value);
        if (!parsed.ok) {
            this._error = `Invalid JSON: ${parsed.error}`;
            return;
        }
        this._busy = true;
        try {
            await this.client.writeAttribute(this.nodeId, this._attributePath, parsed.value);
            this._close();
        } catch (err) {
            this._error = err instanceof Error ? err.message : String(err);
        } finally {
            this._busy = false;
        }
    }

    protected override render() {
        return html`
            <md-dialog open @cancel=${preventDefault} @closed=${this._handleClosed}>
                <div slot="headline">Write ${this.label}</div>
                <div slot="content">
                    <p class="path" id="write-path">
                        Path <code>${this._attributePath}</code>
                        (${formatHex(this.endpointId)}/${formatHex(this.clusterId)}/${formatHex(this.attributeId)})
                    </p>
                    <label class="textarea-label" for="write-payload">Value (JSON)</label>
                    <textarea
                        id="write-payload"
                        class="payload"
                        spellcheck="false"
                        autocomplete="off"
                        autocapitalize="off"
                        aria-describedby="write-path${this._error ? " write-error" : ""}"
                        rows="10"
                    ></textarea>
                    ${this._error
                        ? html`<div id="write-error" class="error" role="alert">${this._error}</div>`
                        : nothing}
                </div>
                <div slot="actions">
                    <md-text-button @click=${this._close} ?disabled=${this._busy}>Cancel</md-text-button>
                    <md-text-button @click=${handleAsync(() => this._write())} ?disabled=${this._busy}>
                        ${this._busy ? "Writing..." : "Write"}
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
            margin: 0 0 6px 0;
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
            min-height: 140px;
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
    `;
}

declare global {
    interface HTMLElementTagNameMap {
        "attribute-write-dialog": AttributeWriteDialog;
    }
}
