/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/filled-button";
import "@material/web/button/outlined-button";
import "@material/web/iconbutton/outlined-icon-button";
import "@material/web/textfield/outlined-text-field";
import { mdiPlus, mdiTrashCanOutline } from "@mdi/js";
import { css, html, nothing, type CSSResultGroup, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import "../../../components/ha-svg-icon.js";
import { showAlertDialog } from "../../../components/dialog-box/show-dialog-box.js";
import { nodeIdKey } from "../../../util/access-control.js";
import { handleAsync } from "../../../util/async-handler.js";
import { errorText } from "../../../util/error-text.js";
import type { LabelListItem } from "../../../util/label-list.js";
import { USER_LABEL_CLUSTER_ID } from "../../../util/label-list.js";
import { decodeUserLabelRows, USER_LABEL_MAX_BYTES, writeUserLabelRows } from "../../../util/user-label.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

@customElement("user-label-cluster-commands")
class UserLabelClusterCommands extends BaseClusterCommands {
    private _loadedKey = "";
    private _rawEntries: unknown[] = [];

    @state() private _rows: LabelListItem[] = [];
    @state() private _saving = false;

    override updated(changed: Map<string, unknown>) {
        super.updated(changed);
        this._ensureLoaded();
    }

    /** Reloads the edit state only when node or endpoint changes, so a reused panel keeps in-progress edits. */
    private _ensureLoaded() {
        if (!this.node || this.endpoint === undefined) return;
        const key = `${nodeIdKey(this.node.node_id)}/${this.endpoint}`;
        if (this._loadedKey === key) return;
        this._loadedKey = key;
        const decoded = decodeUserLabelRows(this.node, this.endpoint);
        this._rows = decoded?.rows.map(item => ({ ...item })) ?? [];
        this._rawEntries = decoded?.rawEntries ?? [];
    }

    override render() {
        if (!this.node || this.cluster !== USER_LABEL_CLUSTER_ID) return nothing;
        const online = this.node.available;

        return html`
            <details class="command-panel">
                <summary>User Labels (${this._rows.length})</summary>
                <div class="command-content">
                    ${!online ? html`<div class="offline-warning">Node is offline - cannot edit labels</div>` : nothing}
                    ${
                        this._rawEntries.length > 0
                            ? html`<div class="raw-note">
                                  ${this._rawEntries.length} entr${this._rawEntries.length === 1 ? "y" : "ies"} kept
                                  as-is (not a plain label/value pair, see the attribute list below)
                              </div>`
                            : nothing
                    }
                    ${
                        this._rows.length === 0
                            ? html`<div class="empty">No user labels on this endpoint.</div>`
                            : this._rows.map((row, index) => this._renderRow(row, index, online))
                    }
                    <div class="row-actions">
                        <md-outlined-button ?disabled=${!online || this._saving} @click=${() => this._addRow()}>
                            <ha-svg-icon slot="icon" .path=${mdiPlus}></ha-svg-icon>
                            Add label
                        </md-outlined-button>
                        <md-filled-button
                            ?disabled=${!online || this._saving}
                            @click=${handleAsync(() => this._save())}
                        >
                            ${this._saving ? "Saving..." : "Save"}
                        </md-filled-button>
                    </div>
                </div>
            </details>
        `;
    }

    private _renderRow(row: LabelListItem, index: number, online: boolean): TemplateResult {
        return html`
            <div class="row">
                <md-outlined-text-field
                    label="Label"
                    .value=${row.label}
                    supporting-text="Max ${USER_LABEL_MAX_BYTES} bytes"
                    ?disabled=${!online || this._saving}
                    @input=${(e: Event) => this._handleFieldInput(index, "label", e)}
                ></md-outlined-text-field>
                <md-outlined-text-field
                    label="Value"
                    .value=${row.value}
                    supporting-text="Max ${USER_LABEL_MAX_BYTES} bytes"
                    ?disabled=${!online || this._saving}
                    @input=${(e: Event) => this._handleFieldInput(index, "value", e)}
                ></md-outlined-text-field>
                <md-outlined-icon-button
                    title="Remove label"
                    aria-label="Remove label"
                    ?disabled=${!online || this._saving}
                    @click=${() => this._removeRow(index)}
                >
                    <ha-svg-icon .path=${mdiTrashCanOutline}></ha-svg-icon>
                </md-outlined-icon-button>
            </div>
        `;
    }

    private _handleFieldInput(index: number, field: "label" | "value", e: Event) {
        const value = (e.target as HTMLInputElement).value;
        this._rows = this._rows.map((row, i) => (i === index ? { ...row, [field]: value } : row));
    }

    private _addRow() {
        this._rows = [...this._rows, { label: "", value: "" }];
    }

    private _removeRow(index: number) {
        this._rows = this._rows.filter((_, i) => i !== index);
    }

    private async _save() {
        if (this._saving) return;
        const node = this.node;
        const endpoint = this.endpoint;
        const rows = this._rows;
        const rawEntries = this._rawEntries;
        this._saving = true;
        try {
            await writeUserLabelRows(this.client, node, endpoint, rows, rawEntries);
        } catch (error) {
            if (this.isSameContext(node, endpoint)) {
                await showAlertDialog({ title: "Failed to save user labels", text: errorText(error) });
            }
        } finally {
            this._saving = false;
        }
    }

    static override styles: CSSResultGroup = [
        BaseClusterCommands.styles,
        css`
            .row {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                margin-bottom: 8px;
            }

            .row md-outlined-text-field {
                flex: 1;
                min-width: 0;
            }

            .row md-outlined-icon-button {
                margin-top: 4px;
            }

            .row-actions {
                display: flex;
                gap: 12px;
                margin-top: 8px;
            }

            .empty {
                opacity: 0.6;
                padding: 8px 0 12px;
            }

            .raw-note {
                font-size: 13px;
                opacity: 0.7;
                margin-bottom: 12px;
            }

            .offline-warning {
                color: var(--danger-color, #d32f2f);
                font-size: 14px;
                margin-bottom: 12px;
                padding: 8px 12px;
                background-color: var(--md-sys-color-error-container, #fdecea);
                border-radius: 4px;
            }
        `,
    ];
}

registerClusterCommands(USER_LABEL_CLUSTER_ID, "user-label-cluster-commands");

declare global {
    interface HTMLElementTagNameMap {
        "user-label-cluster-commands": UserLabelClusterCommands;
    }
}
