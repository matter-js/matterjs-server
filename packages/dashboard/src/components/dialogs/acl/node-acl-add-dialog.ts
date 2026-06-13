/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/text-button";
import "@material/web/dialog/dialog";
import "@material/web/select/outlined-select";
import "@material/web/select/select-option";
import "@material/web/textfield/outlined-text-field";
import { consume } from "@lit/context";
import type { MdDialog } from "@material/web/dialog/dialog.js";
import { mdiClose } from "@mdi/js";
import { MatterClient, MatterNode } from "@matter-server/ws-client";
import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "../../../components/ha-svg-icon.js";
import { clientContext } from "../../../client/client-context.js";
import { AuthMode, Privilege, PRIVILEGE_NAMES, aclCapacity, nodeIdKey } from "../../../util/access-control.js";
import { handleAsync } from "../../../util/async-handler.js";
import { preventDefault } from "../../../util/prevent_default.js";
import { showAlertDialog } from "../../dialog-box/show-dialog-box.js";
import { addAclEntry } from "./acl-actions.js";
import type { AccessControlEntryStruct, AccessControlTargetStruct } from "./model.js";

@customElement("node-acl-add-dialog")
export class NodeAclAddDialog extends LitElement {
    @consume({ context: clientContext, subscribe: true })
    @property({ attribute: false })
    public client!: MatterClient;

    @property({ attribute: false })
    public node!: MatterNode;

    @state() private _privilege = Privilege.Operate;
    @state() private _subjects = new Array<number | bigint>();
    @state() private _subjectInput = "";
    @state() private _targets = new Array<AccessControlTargetStruct>();
    @state() private _targetEndpoint = "";
    @state() private _targetCluster = "";
    @state() private _busy = false;

    private _knownNodes(): MatterNode[] {
        return Object.values(this.client.nodes).sort((a, b) => (a.nodeLabel || "").localeCompare(b.nodeLabel || ""));
    }

    private _addSubject(raw: string) {
        const value = raw.trim();
        if (!/^\d+$/.test(value)) return;
        const id = BigInt(value);
        const key = nodeIdKey(id);
        if (this._subjects.some(s => nodeIdKey(s) === key)) return;
        const max = aclCapacity(this.node).subjectsMax;
        if (max > 0 && this._subjects.length >= max) {
            void showAlertDialog({ title: "Limit reached", text: `At most ${max} subjects per entry.` });
            return;
        }
        this._subjects = [...this._subjects, id];
        this._subjectInput = "";
    }

    private _removeSubject(key: string) {
        this._subjects = this._subjects.filter(s => nodeIdKey(s) !== key);
    }

    private _addTarget() {
        const ep = parseInt(this._targetEndpoint, 10);
        if (Number.isNaN(ep) || ep < 0 || ep > 0xfffe) {
            void showAlertDialog({ title: "Validation error", text: "Enter a valid endpoint." });
            return;
        }
        const max = aclCapacity(this.node).targetsMax;
        if (max > 0 && this._targets.length >= max) {
            void showAlertDialog({ title: "Limit reached", text: `At most ${max} targets per entry.` });
            return;
        }
        const clusterRaw = this._targetCluster.trim();
        let cluster: number | undefined;
        if (clusterRaw !== "") {
            const c = parseInt(clusterRaw, 10);
            if (Number.isNaN(c) || c < 0 || c > 0x7fff) {
                void showAlertDialog({ title: "Validation error", text: "Enter a valid cluster id (or leave empty)." });
                return;
            }
            cluster = c;
        }
        this._targets = [...this._targets, { endpoint: ep, cluster, deviceType: undefined }];
        this._targetEndpoint = "";
        this._targetCluster = "";
    }

    private _removeTarget(index: number) {
        this._targets = this._targets.filter((_, i) => i !== index);
    }

    private async _save() {
        if (this._subjects.length === 0) {
            await showAlertDialog({ title: "Validation error", text: "Add at least one subject node." });
            return;
        }
        const entry: AccessControlEntryStruct = {
            privilege: this._privilege,
            authMode: AuthMode.Case,
            subjects: this._subjects,
            targets: this._targets.length ? this._targets : undefined,
            fabricIndex: 0,
        };
        this._busy = true;
        try {
            await addAclEntry(this.client, this.node.node_id, entry);
            this._close();
        } catch (err) {
            await showAlertDialog({ title: "Failed to add entry", text: err instanceof Error ? err.message : String(err) });
        } finally {
            this._busy = false;
        }
    }

    private _close() {
        this.shadowRoot!.querySelector<MdDialog>("md-dialog")!.close();
    }

    private _handleClosed() {
        this.parentNode?.removeChild(this);
    }

    protected override render() {
        return html`
            <md-dialog open @cancel=${preventDefault} @closed=${this._handleClosed}>
                <div slot="headline">Add ACL entry</div>
                <div slot="content">
                    <div class="form">
                        <md-outlined-select
                            label="Privilege"
                            .value=${String(this._privilege)}
                            ?disabled=${this._busy}
                            @change=${(e: Event) => (this._privilege = Number((e.target as HTMLSelectElement).value))}
                        >
                            ${[Privilege.View, Privilege.Operate, Privilege.Manage, Privilege.Administer].map(
                                p =>
                                    html`<md-select-option value=${String(p)}
                                        ><div slot="headline">${PRIVILEGE_NAMES[p]} · ${p}</div></md-select-option
                                    >`,
                            )}
                        </md-outlined-select>
                        <div class="note">Auth mode: CASE (node). Group subjects are not supported yet.</div>

                        <div class="label">Subjects (nodes)</div>
                        <div class="chips">
                            ${this._subjects.length === 0
                                ? html`<span class="mut">none — add at least one</span>`
                                : this._subjects.map(s => {
                                      const known = this.client.nodes[nodeIdKey(s)];
                                      return html`<span class="chip"
                                          >${known ? known.nodeLabel || "Unknown" : "Node"} · ${s.toString()}
                                          <ha-svg-icon
                                              class="x"
                                              .path=${mdiClose}
                                              @click=${() => this._removeSubject(nodeIdKey(s))}
                                          ></ha-svg-icon
                                      ></span>`;
                                  })}
                        </div>
                        <div class="row">
                            <md-outlined-select
                                label="Known nodes"
                                ?disabled=${this._busy}
                                @change=${(e: Event) => {
                                    const v = (e.target as HTMLSelectElement).value;
                                    if (v) this._addSubject(v);
                                }}
                            >
                                <md-select-option value=""><div slot="headline">— pick —</div></md-select-option>
                                ${this._knownNodes().map(
                                    n =>
                                        html`<md-select-option value=${nodeIdKey(n.node_id)}
                                            ><div slot="headline">
                                                ${n.nodeLabel || "Unknown"} · ${n.node_id.toString()}
                                            </div></md-select-option
                                        >`,
                                )}
                            </md-outlined-select>
                            <md-outlined-text-field
                                label="or raw node id"
                                type="text"
                                pattern="[0-9]+"
                                .value=${this._subjectInput}
                                ?disabled=${this._busy}
                                @input=${(e: Event) => (this._subjectInput = (e.target as HTMLInputElement).value)}
                            ></md-outlined-text-field>
                            <md-text-button ?disabled=${this._busy} @click=${() => this._addSubject(this._subjectInput)}
                                >Add</md-text-button
                            >
                        </div>

                        <div class="label">Targets (optional — none means whole node)</div>
                        <div class="chips">
                            ${this._targets.length === 0
                                ? html`<span class="mut">whole node</span>`
                                : this._targets.map(
                                      (t, i) =>
                                          html`<span class="chip"
                                              >EP ${t.endpoint}${t.cluster != null
                                                  ? ` · 0x${t.cluster.toString(16).toUpperCase()}`
                                                  : " · all clusters"}
                                              <ha-svg-icon
                                                  class="x"
                                                  .path=${mdiClose}
                                                  @click=${() => this._removeTarget(i)}
                                              ></ha-svg-icon
                                          ></span>`,
                                  )}
                        </div>
                        <div class="row">
                            <md-outlined-text-field
                                label="endpoint"
                                type="number"
                                min="0"
                                max="65534"
                                .value=${this._targetEndpoint}
                                ?disabled=${this._busy}
                                @input=${(e: Event) => (this._targetEndpoint = (e.target as HTMLInputElement).value)}
                            ></md-outlined-text-field>
                            <md-outlined-text-field
                                label="cluster id (optional)"
                                type="number"
                                min="0"
                                max="32767"
                                .value=${this._targetCluster}
                                ?disabled=${this._busy}
                                @input=${(e: Event) => (this._targetCluster = (e.target as HTMLInputElement).value)}
                            ></md-outlined-text-field>
                            <md-text-button ?disabled=${this._busy} @click=${() => this._addTarget()}>Add target</md-text-button>
                        </div>
                    </div>
                </div>
                <div slot="actions">
                    <md-text-button ?disabled=${this._busy} @click=${handleAsync(() => this._save())}>Add</md-text-button>
                    <md-text-button ?disabled=${this._busy} @click=${this._close}>Cancel</md-text-button>
                </div>
            </md-dialog>
        `;
    }

    static override styles = css`
        .form {
            display: flex;
            flex-direction: column;
            gap: 10px;
            min-width: 360px;
        }
        .label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            opacity: 0.65;
            margin-top: 6px;
        }
        .note {
            font-size: 12px;
            opacity: 0.7;
        }
        .row {
            display: flex;
            gap: 8px;
            align-items: center;
            flex-wrap: wrap;
        }
        .chips {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }
        .chip {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 12px;
            background: var(--md-sys-color-surface-container-high);
            color: var(--md-sys-color-on-surface);
        }
        .chip .x {
            cursor: pointer;
            --mdc-icon-size: 16px;
            width: 16px;
            height: 16px;
        }
        .mut {
            opacity: 0.6;
            font-size: 12px;
        }
    `;
}

declare global {
    interface HTMLElementTagNameMap {
        "node-acl-add-dialog": NodeAclAddDialog;
    }
}
