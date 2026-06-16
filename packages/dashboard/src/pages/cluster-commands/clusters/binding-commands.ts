/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/outlined-button";
import { mdiTrashCan } from "@mdi/js";
import { css, html, nothing, type CSSResultGroup, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import "../../../components/ha-svg-icon.js";
import { clusters } from "../../../client/models/descriptions.js";
import { showAlertDialog, showPromptDialog } from "../../../components/dialog-box/show-dialog-box.js";
import {
    deleteBindingAtIndex,
    ensureBindingAcl,
    fixOverPrivilegedBindingAcl,
} from "../../../components/dialogs/binding/binding-actions.js";
import type { BindingEntryStruct } from "../../../components/dialogs/binding/model.js";
import { showNodeBindingDialog } from "../../../components/dialogs/binding/show-node-binding-dialog.js";
import { nodeIdKey } from "../../../util/access-control.js";
import { handleAsync } from "../../../util/async-handler.js";
import { readBindings, reverseAclState, type ReverseAclState } from "../../../util/binding.js";
import { getEndpointDeviceTypes } from "../../matter-endpoint-view.js";
import { BaseClusterCommands } from "../base-cluster-commands.js";
import { registerClusterCommands } from "../registry.js";

const CLUSTER_ID = 30;

@customElement("binding-cluster-commands")
class BindingClusterCommands extends BaseClusterCommands {
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

    /** Read the (fabric-scoped) binding attribute and each target's ACL into the cache on open. */
    private async _ensureLoaded() {
        if (!this.client || !this.node || this.endpoint === undefined) return;
        const key = `${nodeIdKey(this.node.node_id)}/${this.endpoint}`;
        if (this._loadedKey === key) return;
        this._loadedKey = key;
        try {
            await this._readInto(this.node.node_id, `${this.endpoint}/30/0`);
            const targets = new Set(
                readBindings(this.node, this.endpoint)
                    .map(b => (b.node != null ? nodeIdKey(b.node) : undefined))
                    .filter((k): k is string => k !== undefined),
            );
            for (const k of targets) {
                const id = this.client.nodes[k]?.node_id;
                if (id != null) await this._readInto(id, "0/31/0");
            }
            this.requestUpdate();
        } catch (err) {
            console.error("Failed to load binding/ACL data", err);
        }
    }

    private async _readInto(nodeId: number | bigint, path: string) {
        const res = await this.client.readAttribute(nodeId, path);
        const node = this.client.nodes[nodeIdKey(nodeId)];
        if (node) for (const [k, v] of Object.entries(res)) node.attributes[k] = v;
    }

    private _clusterName(id: number | undefined): string {
        if (id == null) return "All clusters";
        return `${clusters[id]?.label ?? "Cluster"} (0x${id.toString(16).padStart(2, "0").toUpperCase()})`;
    }

    private _targetNode(nodeId: number | bigint | undefined) {
        if (nodeId == null) return undefined;
        return this.client.nodes[nodeIdKey(nodeId)];
    }

    private async _openAdd() {
        await showNodeBindingDialog(this.node, this.endpoint);
    }

    private async _run(action: () => Promise<void>, failTitle: string) {
        this._busy = true;
        try {
            await action();
        } catch (err) {
            await showAlertDialog({ title: failTitle, text: err instanceof Error ? err.message : String(err) });
        } finally {
            this._busy = false;
        }
    }

    private async _delete(index: number) {
        const confirmed = await showPromptDialog({
            title: "Remove binding",
            text: "Remove this binding and clean up the matching access control entry on the target node?",
            confirmText: "Remove",
        });
        if (!confirmed) return;
        await this._run(
            () =>
                deleteBindingAtIndex(
                    this.client,
                    this.node,
                    this.endpoint,
                    index,
                    this.client.serverInfo?.fabric_index,
                ),
            "Delete failed",
        );
    }

    private async _fixAcl(b: BindingEntryStruct, mode: "missing" | "overPrivileged") {
        if (b.node == null || b.endpoint == null) return;
        const fabricIndex = this.client.serverInfo?.fabric_index;
        await this._run(
            () =>
                mode === "missing"
                    ? ensureBindingAcl(this.client, this.node.node_id, b.node!, b.endpoint!, b.cluster, fabricIndex)
                    : fixOverPrivilegedBindingAcl(
                          this.client,
                          this.node.node_id,
                          b.node!,
                          b.endpoint!,
                          b.cluster,
                          fabricIndex,
                      ),
            "Fix failed",
        );
    }

    override render() {
        if (!this.node || this.cluster !== CLUSTER_ID) return nothing;
        const bindings = readBindings(this.node, this.endpoint);
        const fabricIndex = this.client.serverInfo?.fabric_index;

        return html`
            <details class="command-panel">
                <summary>Bindings (${bindings.length})</summary>
                <div class="command-content">
                    ${bindings.length === 0
                        ? html`<div class="empty">No bindings on this endpoint.</div>`
                        : html`<table class="bt">
                              <thead>
                                  <tr>
                                      <th>Target node</th>
                                      <th>Endpoint</th>
                                      <th>Cluster</th>
                                      <th>ACL on target</th>
                                      <th></th>
                                  </tr>
                              </thead>
                              <tbody>
                                  ${bindings.map((b, i) => this._row(b, i, fabricIndex))}
                              </tbody>
                          </table>`}
                    <md-outlined-button
                        ?disabled=${this._busy || !this.node.available}
                        @click=${handleAsync(() => this._openAdd())}
                        >Add binding</md-outlined-button
                    >
                </div>
            </details>
        `;
    }

    private _row(b: BindingEntryStruct, index: number, fabricIndex?: number): TemplateResult {
        const target = this._targetNode(b.node);
        const aclState: ReverseAclState =
            b.node == null ? "cannotVerify" : reverseAclState(this.node.node_id, b, target, fabricIndex).state;
        const name = b.group != null ? `Group ${b.group}` : target ? target.nodeLabel || "Unknown" : "Unknown node";
        const endpointText =
            b.endpoint == null
                ? "—"
                : target && getEndpointDeviceTypes(target, b.endpoint)[0]
                  ? `EP ${b.endpoint} · ${getEndpointDeviceTypes(target, b.endpoint)[0].label}`
                  : `EP ${b.endpoint}`;
        return html`
            <tr>
                <td>
                    <span class="ident"
                        ><b>${name}</b>${b.node != null
                            ? html` · <span class="nid">${b.node.toString()}</span>`
                            : nothing}</span
                    >
                </td>
                <td>${endpointText}</td>
                <td>${this._clusterName(b.cluster)}</td>
                <td>${this._aclCell(b, aclState)}</td>
                <td class="actions">
                    <md-outlined-button
                        class="danger"
                        ?disabled=${this._busy || !this.node.available}
                        @click=${handleAsync(() => this._delete(index))}
                    >
                        <ha-svg-icon .path=${mdiTrashCan} slot="icon"></ha-svg-icon>delete
                    </md-outlined-button>
                </td>
            </tr>
        `;
    }

    private _aclCell(b: BindingEntryStruct, state: ReverseAclState): TemplateResult {
        if (state === "present") return html`<span class="status ok">ACL present</span>`;
        if (state === "cannotVerify") return html`<span class="status mut">can't verify</span>`;
        const label = state === "missing" ? "ACL missing" : "ACL > Operate";
        const fixLabel = state === "missing" ? "Add ACL" : "→ Operate";
        return html`
            <span class="status warn">${label}</span>
            <md-outlined-button
                class="fix"
                ?disabled=${this._busy || !this.node.available}
                @click=${handleAsync(() => this._fixAcl(b, state))}
                >${fixLabel}</md-outlined-button
            >
        `;
    }

    static override styles: CSSResultGroup = [
        BaseClusterCommands.styles,
        css`
            .bt {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 12px;
            }
            .bt th {
                text-align: left;
                font-size: 11px;
                text-transform: uppercase;
                opacity: 0.6;
                padding: 8px 10px;
                border-bottom: 1px solid var(--md-sys-color-outline-variant);
            }
            .bt td {
                padding: 10px;
                border-bottom: 1px solid var(--md-sys-color-outline-variant);
                vertical-align: middle;
            }
            .empty {
                opacity: 0.6;
                padding: 8px 0 12px;
            }
            .ident .nid {
                font-weight: 600;
            }
            .status {
                font-size: inherit;
            }
            .status.ok {
                color: var(--md-sys-color-primary);
            }
            .status.warn {
                color: var(--md-sys-color-error);
                margin-right: 8px;
            }
            .status.mut {
                opacity: 0.6;
            }
            .actions {
                text-align: right;
                white-space: nowrap;
            }
            md-outlined-button.fix {
                --md-outlined-button-container-height: 28px;
            }
            md-outlined-button.danger {
                --md-outlined-button-label-text-color: var(--md-sys-color-error);
                --md-outlined-button-outline-color: var(--md-sys-color-error);
            }
        `,
    ];
}

registerClusterCommands(CLUSTER_ID, "binding-cluster-commands");

declare global {
    interface HTMLElementTagNameMap {
        "binding-cluster-commands": BindingClusterCommands;
    }
}
