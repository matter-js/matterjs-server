/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/outlined-button";
import { mdiTrashCan } from "@mdi/js";
import { css, html, nothing, type CSSResultGroup } from "lit";
import { customElement, state } from "lit/decorators.js";
import "../../../components/ha-svg-icon.js";
import { clusters } from "../../../client/models/descriptions.js";
import { showAlertDialog, showPromptDialog } from "../../../components/dialog-box/show-dialog-box.js";
import { deleteBindingAtIndex } from "../../../components/dialogs/binding/binding-actions.js";
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
    @state() private _busy = false;

    override updated(changed: Map<string, unknown>) {
        super.updated(changed);
        if (changed.has("client") && this.client && !this._unsubscribe) {
            this._unsubscribe = this.client.addEventListener("nodes_changed", () => this.requestUpdate());
        }
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubscribe?.();
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

    private async _delete(index: number) {
        const confirmed = await showPromptDialog({
            title: "Remove binding",
            text: "Remove this binding and clean up the matching access control entry on the target node?",
            confirmText: "Remove",
        });
        if (!confirmed) return;
        this._busy = true;
        try {
            await deleteBindingAtIndex(
                this.client,
                this.node,
                this.endpoint,
                index,
                this.client.serverInfo?.fabric_index,
            );
        } catch (err) {
            await showAlertDialog({ title: "Delete failed", text: err instanceof Error ? err.message : String(err) });
        } finally {
            this._busy = false;
        }
    }

    override render() {
        if (!this.node || this.cluster !== CLUSTER_ID) return nothing;
        const bindings = readBindings(this.node, this.endpoint);
        const fabricIndex = this.client.serverInfo?.fabric_index;

        return html`
            <details class="command-panel" open>
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

    private _row(b: ReturnType<typeof readBindings>[number], index: number, fabricIndex?: number) {
        const target = this._targetNode(b.node);
        const aclState: ReverseAclState =
            b.node == null ? "cannotVerify" : reverseAclState(this.node.node_id, b, target, fabricIndex).state;
        const aclChip =
            aclState === "present"
                ? html`<span class="chip ok">ACL present</span>`
                : aclState === "missing"
                  ? html`<span class="chip warn">ACL missing on target</span>`
                  : html`<span class="chip mut">can't verify</span>`;
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
                    <span class="chip"
                        ><b>${name}</b>${b.node != null
                            ? html` · <span class="nid">${b.node.toString()}</span>`
                            : nothing}</span
                    >
                </td>
                <td>${endpointText}</td>
                <td>${this._clusterName(b.cluster)}</td>
                <td>${aclChip}</td>
                <td>
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
                vertical-align: top;
            }
            .empty {
                opacity: 0.6;
                padding: 8px 0 12px;
            }
            .chip {
                display: inline-block;
                padding: 3px 9px;
                border-radius: 6px;
                margin: 2px 4px 2px 0;
                font-size: 12px;
                background: var(--md-sys-color-surface-container-high);
                color: var(--md-sys-color-on-surface);
            }
            .chip.ok {
                background: var(--md-sys-color-tertiary-container);
                color: var(--md-sys-color-on-tertiary-container);
            }
            .chip.warn {
                background: var(--md-sys-color-error-container);
                color: var(--md-sys-color-on-error-container);
            }
            .chip.mut {
                opacity: 0.6;
            }
            .nid {
                font-weight: 600;
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
