/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/outlined-button";
import { mdiAlert, mdiLink, mdiLock, mdiTrashCan } from "@mdi/js";
import { css, html, nothing, type CSSResultGroup, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import "../../../components/ha-svg-icon.js";
import { clusters } from "../../../client/models/descriptions.js";
import { showAlertDialog, showPromptDialog } from "../../../components/dialog-box/show-dialog-box.js";
import { deleteAclEntry, downgradeToOperate } from "../../../components/dialogs/acl/acl-actions.js";
import type { AccessControlEntryStruct } from "../../../components/dialogs/acl/model.js";
import { showNodeAclAddDialog } from "../../../components/dialogs/acl/show-node-acl-add-dialog.js";
import {
    AUTH_MODE_NAMES,
    AuthMode,
    PRIVILEGE_NAMES,
    Privilege,
    aclCapacity,
    aclEntryKey,
    entriesForFabric,
    isProtectedAdmin,
    isWholeNode,
    nodeFabricIndex,
    nodeIdKey,
    readAclEntries,
} from "../../../util/access-control.js";
import { handleAsync } from "../../../util/async-handler.js";
import { detectBindingRelationship, type RelationshipResult } from "../../../util/binding.js";
import { getDeviceName } from "../../../util/node-name.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

const CLUSTER_ID = 31;

@customElement("access-control-cluster-commands")
class AccessControlClusterCommands extends BaseClusterCommands {
    private _unsubscribe?: () => void;
    private _loadedKey = "";
    @state() private _busy = false;

    override updated(changed: Map<string, unknown>) {
        super.updated(changed);
        if (changed.has("client") && this.client && !this._unsubscribe) {
            this._unsubscribe = this.client.addEventListener("nodes_changed", () => this.requestUpdate());
        }
        void this._ensureLoaded();
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubscribe?.();
    }

    /** The acl attribute is fabric-scoped and may be absent from the cache until read. Load it on open. */
    private async _ensureLoaded() {
        if (!this.client || !this.node || !this.node.available) return;
        const key = nodeIdKey(this.node.node_id);
        if (this._loadedKey === key) return;
        this._loadedKey = key;
        try {
            const res = await this.client.readAttribute(this.node.node_id, ["0/31/0", "0/62/5"]);
            for (const [k, v] of Object.entries(res)) this.node.attributes[k] = v;
            this.requestUpdate();
        } catch (err) {
            this._loadedKey = ""; // allow retry on the next update after a transient failure
            console.error("Failed to load ACL", err);
        }
    }

    private get _controllerNodeId(): number | bigint | undefined {
        return this.client.serverInfo?.controller_node_id;
    }

    private _entries(): AccessControlEntryStruct[] {
        return entriesForFabric(readAclEntries(this.node), nodeFabricIndex(this.node));
    }

    private _clusterName(id: number | undefined): string {
        if (id == null) return "all clusters";
        return `${clusters[id]?.label ?? "Cluster"} (0x${id.toString(16).padStart(2, "0").toUpperCase()})`;
    }

    private _privilegeClass(p: number): string {
        return `pv pv-${p}`;
    }

    private async _delete(entry: AccessControlEntryStruct) {
        const isAdmin = entry.privilege === Privilege.Administer && entry.authMode === AuthMode.Case;
        const unverified = isAdmin && this._controllerNodeId === undefined;
        const confirmed = await showPromptDialog({
            title: "Delete ACL entry",
            text: unverified
                ? "This is an Administer entry and the controller cannot verify whether it is its own. Deleting the wrong admin entry can lock the controller out of this device. Continue?"
                : "Remove this access control entry? Devices relying on it will lose the granted access.",
            confirmText: "Delete",
        });
        if (!confirmed) return;
        this._busy = true;
        try {
            await deleteAclEntry(this.client, this.node.node_id, aclEntryKey(entry));
        } catch (err) {
            await showAlertDialog({ title: "Delete failed", text: err instanceof Error ? err.message : String(err) });
        } finally {
            this._busy = false;
        }
    }

    private async _fix(keys: Set<string>) {
        this._busy = true;
        try {
            await downgradeToOperate(this.client, this.node.node_id, keys);
        } catch (err) {
            await showAlertDialog({ title: "Fix failed", text: err instanceof Error ? err.message : String(err) });
        } finally {
            this._busy = false;
        }
    }

    private async _openAdd() {
        await showNodeAclAddDialog(this.node);
    }

    private _renderSubjects(entry: AccessControlEntryStruct): TemplateResult {
        const subjects = entry.subjects ?? [];
        if (entry.authMode === AuthMode.Case && subjects.length === 0) {
            return html`<span class="mut">Any node on fabric</span>`;
        }
        if (entry.authMode === AuthMode.Group) {
            return html`${subjects.map(s => html`<div class="ident">Group ${s.toString()}</div>`)}`;
        }
        return html`${subjects.map(s => {
            const known = this.client.nodes[nodeIdKey(s)];
            const protectedMe =
                isProtectedAdmin(entry, this._controllerNodeId) && nodeIdKey(s) === nodeIdKey(this._controllerNodeId!);
            return html`<div class="ident ${protectedMe ? "me" : ""}">
                ${protectedMe ? "This controller" : known ? getDeviceName(known) : "Unknown node"} ·
                <span class="nid">${s.toString()}</span><span class="hex">0x${s.toString(16).toUpperCase()}</span>
            </div>`;
        })}`;
    }

    private _renderTargets(entry: AccessControlEntryStruct): TemplateResult {
        if (isWholeNode(entry)) return html`<span class="mut">Whole node</span>`;
        return html`${entry.targets!.map(t => {
            if (t.cluster != null)
                return html`<span class="chip ep">EP ${t.endpoint ?? "*"} · ${this._clusterName(t.cluster)}</span>`;
            if (t.deviceType != null)
                return html`<span class="chip ep">EP ${t.endpoint ?? "*"} · device type ${t.deviceType}</span>`;
            return html`<span class="chip ep">EP ${t.endpoint ?? "*"}</span>`;
        })}`;
    }

    private _renderRelationship(rel: RelationshipResult): TemplateResult {
        if (rel.kind === "none") return html`<span class="mut">—</span>`;
        const source = rel.sourceNodeId != null ? this.client.nodes[nodeIdKey(rel.sourceNodeId)] : undefined;
        const label = source ? getDeviceName(source) : "node";
        if (rel.kind === "overPrivileged") {
            return html`<span class="chip bug"
                ><ha-svg-icon .path=${mdiAlert}></ha-svg-icon> over-privileged binding ACL</span
            >`;
        }
        return html`<span class="chip link"
            ><ha-svg-icon .path=${mdiLink}></ha-svg-icon> backs binding · ${label} EP${rel.sourceEndpoint}</span
        >`;
    }

    override render() {
        if (!this.node || this.cluster !== CLUSTER_ID) return nothing;
        const entries = this._entries();
        const allNodes = Object.values(this.client.nodes);
        const rels = entries.map(e => detectBindingRelationship(e, this.node.node_id, allNodes));
        const capacity = aclCapacity(this.node);
        const full = capacity.max > 0 && entries.length >= capacity.max;

        const overPrivilegedKeys = new Set<string>();
        entries.forEach((e, i) => {
            if (rels[i].kind === "overPrivileged") overPrivilegedKeys.add(aclEntryKey(e));
        });

        return html`
            <details class="command-panel">
                <summary>Access Control — ACL Entries (${entries.length})</summary>
                <div class="command-content">
                    ${overPrivilegedKeys.size >= 2
                        ? html`<div class="banner">
                              <span
                                  >${overPrivilegedKeys.size} binding ACL entries grant Administer where Operate is
                                  sufficient.</span
                              >
                              <md-outlined-button
                                  ?disabled=${this._busy || !this.node.available}
                                  @click=${handleAsync(() => this._fix(overPrivilegedKeys))}
                                  >Fix all → Operate</md-outlined-button
                              >
                          </div>`
                        : nothing}
                    <table class="acl">
                        <thead>
                            <tr>
                                <th>Privilege</th>
                                <th>Auth</th>
                                <th>Subjects</th>
                                <th>Targets</th>
                                <th>Relationship</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${entries.map((e, i) => this._row(e, rels[i]))}
                        </tbody>
                    </table>
                    <md-outlined-button
                        ?disabled=${this._busy || full || !this.node.available}
                        title=${full ? "Access control list is full" : ""}
                        @click=${handleAsync(() => this._openAdd())}
                        >Add ACL entry</md-outlined-button
                    >
                    ${full ? html`<span class="mut full-note">List full (${capacity.max} entries)</span>` : nothing}
                </div>
            </details>
        `;
    }

    private _row(entry: AccessControlEntryStruct, rel: RelationshipResult): TemplateResult {
        const protectedEntry = isProtectedAdmin(entry, this._controllerNodeId);
        const overPrivileged = rel.kind === "overPrivileged";
        return html`
            <tr class=${overPrivileged ? "row-warn" : ""}>
                <td>
                    <span class=${this._privilegeClass(entry.privilege)}
                        >${PRIVILEGE_NAMES[entry.privilege] ?? entry.privilege} · ${entry.privilege}</span
                    >
                    ${overPrivileged
                        ? html`<div>
                              <md-outlined-button
                                  class="fix"
                                  ?disabled=${this._busy || !this.node.available}
                                  @click=${handleAsync(() => this._fix(new Set([aclEntryKey(entry)])))}
                                  >Fix → Operate</md-outlined-button
                              >
                          </div>`
                        : nothing}
                </td>
                <td>${AUTH_MODE_NAMES[entry.authMode] ?? entry.authMode}</td>
                <td>${this._renderSubjects(entry)}</td>
                <td>${this._renderTargets(entry)}</td>
                <td>${this._renderRelationship(rel)}</td>
                <td>
                    ${protectedEntry
                        ? html`<ha-svg-icon
                              class="lock"
                              .path=${mdiLock}
                              title="Your controller's administrator entry — deleting it would lock you out."
                          ></ha-svg-icon>`
                        : html`<md-outlined-button
                              class="danger"
                              ?disabled=${this._busy || !this.node.available}
                              @click=${handleAsync(() => this._delete(entry))}
                          >
                              <ha-svg-icon .path=${mdiTrashCan} slot="icon"></ha-svg-icon>delete
                          </md-outlined-button>`}
                </td>
            </tr>
        `;
    }

    static override styles: CSSResultGroup = [
        BaseClusterCommands.styles,
        css`
            .acl {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 12px;
            }
            .acl th {
                text-align: left;
                font-size: 11px;
                text-transform: uppercase;
                opacity: 0.6;
                padding: 8px 10px;
                border-bottom: 1px solid var(--md-sys-color-outline-variant);
            }
            .acl td {
                padding: 10px;
                border-bottom: 1px solid var(--md-sys-color-outline-variant);
                vertical-align: middle;
            }
            .ident {
                line-height: 1.4;
            }
            .ident.me {
                color: var(--md-sys-color-primary);
                font-weight: 600;
            }
            .ident .nid {
                font-weight: 600;
            }
            .row-warn td {
                background: var(--md-sys-color-error-container);
                box-shadow: inset 3px 0 0 var(--md-sys-color-error);
            }
            .pv {
                display: inline-block;
                padding: 2px 8px;
                border-radius: 999px;
                font-size: 12px;
                font-weight: 700;
            }
            .pv-5 {
                background: var(--md-sys-color-error-container);
                color: var(--md-sys-color-on-error-container);
            }
            .pv-4 {
                background: var(--md-sys-color-tertiary-container);
                color: var(--md-sys-color-on-tertiary-container);
            }
            .pv-3 {
                background: var(--md-sys-color-primary-container);
                color: var(--md-sys-color-on-primary-container);
            }
            .pv-1,
            .pv-2 {
                background: var(--md-sys-color-surface-container-highest);
                color: var(--md-sys-color-on-surface-variant);
            }
            .chip {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 3px 8px;
                border-radius: 6px;
                margin: 2px 4px 2px 0;
                font-size: inherit;
                background: var(--md-sys-color-surface-container-high);
                color: var(--md-sys-color-on-surface);
            }
            .chip ha-svg-icon {
                --mdc-icon-size: 14px;
                width: 14px;
                height: 14px;
            }
            .chip.ep {
                background: var(--md-sys-color-secondary-container);
                color: var(--md-sys-color-on-secondary-container);
            }
            .chip.me {
                background: var(--md-sys-color-tertiary-container);
                color: var(--md-sys-color-on-tertiary-container);
            }
            .chip.link {
                background: var(--md-sys-color-primary-container);
                color: var(--md-sys-color-on-primary-container);
            }
            .chip.bug {
                background: var(--md-sys-color-error-container);
                color: var(--md-sys-color-on-error-container);
            }
            .nid {
                font-weight: 600;
            }
            .hex {
                font-family: var(--monospace-font, monospace);
                font-size: 10px;
                opacity: 0.6;
                margin-left: 4px;
            }
            .mut {
                opacity: 0.6;
            }
            .full-note {
                margin-left: 8px;
                font-size: 12px;
            }
            .banner {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 10px 12px;
                margin-bottom: 12px;
                border-radius: 8px;
                background: var(--md-sys-color-error-container);
                color: var(--md-sys-color-on-error-container);
            }
            md-outlined-button.danger {
                --md-outlined-button-label-text-color: var(--md-sys-color-error);
                --md-outlined-button-outline-color: var(--md-sys-color-error);
            }
            md-outlined-button.fix {
                margin-top: 4px;
                --md-outlined-button-container-height: 28px;
            }
        `,
    ];
}

registerClusterCommands(CLUSTER_ID, "access-control-cluster-commands");

declare global {
    interface HTMLElementTagNameMap {
        "access-control-cluster-commands": AccessControlClusterCommands;
    }
}
