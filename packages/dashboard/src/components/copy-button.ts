/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/iconbutton/icon-button";
import { mdiAlertCircleOutline, mdiCheck, mdiContentCopy } from "@mdi/js";
import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { copyText, copyTextWithSelection } from "../util/clipboard.js";
import "./ha-svg-icon";

const STATUS_RESET_MS = 2000;

type CopyStatus = "idle" | "copied" | "failed";

const STATUS_ICON: Record<CopyStatus, string> = {
    idle: mdiContentCopy,
    copied: mdiCheck,
    failed: mdiAlertCircleOutline,
};

const STATUS_MESSAGE: Record<CopyStatus, string | undefined> = {
    idle: undefined,
    copied: "Copied",
    failed: "Copy failed",
};

/** Icon button that copies {@link value} to the clipboard and shows the result for a short time. */
@customElement("copy-button")
export class CopyButton extends LitElement {
    @property() value = "";

    /** Tooltip and accessible name. */
    @property() label = "Copy";

    @state() private _status: CopyStatus = "idle";

    #resetTimer?: ReturnType<typeof setTimeout>;

    #copying = false;

    override disconnectedCallback() {
        super.disconnectedCallback();
        clearTimeout(this.#resetTimer);
    }

    protected override render() {
        const message = STATUS_MESSAGE[this._status];
        return html`
            <md-icon-button title=${message ?? this.label} aria-label=${this.label} @click=${this._onClick}>
                <ha-svg-icon class=${this._status} .path=${STATUS_ICON[this._status]}></ha-svg-icon>
            </md-icon-button>
            <span class="visually-hidden" role="status">${message ?? ""}</span>
        `;
    }

    private _onClick() {
        this._copy().catch((error: unknown) => console.error("Copy button failed:", error));
    }

    private async _copy() {
        if (this.#copying) {
            return;
        }
        this.#copying = true;
        let status: CopyStatus;
        try {
            await copyText(this.value, text => copyTextWithSelection(text, this.shadowRoot!));
            status = "copied";
        } catch (error) {
            console.warn("Copy to clipboard failed:", error);
            status = "failed";
        } finally {
            this.#copying = false;
        }
        this._showStatus(status);
    }

    private _showStatus(status: CopyStatus) {
        if (!this.isConnected) {
            return;
        }
        this._status = status;
        clearTimeout(this.#resetTimer);
        this.#resetTimer = setTimeout(() => (this._status = "idle"), STATUS_RESET_MS);
    }

    static override styles = css`
        .failed {
            color: var(--danger-color);
        }

        .visually-hidden {
            position: absolute;
            width: 1px;
            height: 1px;
            overflow: hidden;
            clip-path: inset(50%);
            white-space: nowrap;
        }
    `;
}

declare global {
    interface HTMLElementTagNameMap {
        "copy-button": CopyButton;
    }
}
