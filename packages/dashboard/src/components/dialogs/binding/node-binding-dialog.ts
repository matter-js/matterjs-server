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
import { MatterClient, MatterNode } from "@matter-server/ws-client";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { clientContext } from "../../../client/client-context.js";
import { clusters } from "../../../client/models/descriptions.js";
import { nodeIdKey } from "../../../util/access-control.js";
import { handleAsync } from "../../../util/async-handler.js";
import { bindableClusters, targetAclCapacityForBinding } from "../../../util/binding.js";
import { getEndpointDeviceTypes } from "../../../util/endpoints.js";
import { getDeviceName } from "../../../util/node-name.js";
import { preventDefault } from "../../../util/prevent_default.js";
import { showAlertDialog } from "../../dialog-box/show-dialog-box.js";
import { addBinding } from "./binding-actions.js";

const ALL_CLUSTERS = "all";
const CUSTOM_CLUSTER = "custom";

@customElement("node-binding-dialog")
export class NodeBindingDialog extends LitElement {
    @consume({ context: clientContext, subscribe: true })
    @property({ attribute: false })
    public client!: MatterClient;

    @property()
    public node?: MatterNode;

    @property({ attribute: false })
    endpoint!: number;

    @state() private _nodeIdInput = "";
    @state() private _endpointInput = "";
    @state() private _clusterSelection = ALL_CLUSTERS;
    @state() private _customClusterInput = "";
    @state() private _busy = false;

    private _knownNodes(): MatterNode[] {
        return Object.values(this.client.nodes)
            .filter(n => nodeIdKey(n.node_id) !== nodeIdKey(this.node!.node_id))
            .sort((a, b) => {
                const x = BigInt(a.node_id);
                const y = BigInt(b.node_id);
                return x < y ? -1 : x > y ? 1 : 0;
            });
    }

    private _resolveTarget(): MatterNode | undefined {
        const raw = this._nodeIdInput.trim();
        if (!/^\d+$/.test(raw)) return undefined;
        return this.client.nodes[nodeIdKey(BigInt(raw))];
    }

    private _nodeEndpoints(target: MatterNode): number[] {
        const eps = new Set<number>();
        for (const key of Object.keys(target.attributes)) {
            const m = /^(\d+)\/29\/0$/.exec(key);
            if (m) eps.add(Number(m[1]));
        }
        return Array.from(eps).sort((a, b) => a - b);
    }

    private _clusterLabel(id: number): string {
        return `${clusters[id]?.label ?? "Cluster"} (0x${id.toString(16).padStart(2, "0").toUpperCase()})`;
    }

    private _onNodeSelect(e: Event) {
        const select = e.target as HTMLSelectElement;
        this._nodeIdInput = select.value;
        this._endpointInput = "";
        this._clusterSelection = ALL_CLUSTERS;
    }

    private async _add() {
        const target = this._resolveTarget();
        const rawNodeId = this._nodeIdInput.trim();
        if (!/^\d+$/.test(rawNodeId) || BigInt(rawNodeId) <= 0n) {
            await showAlertDialog({ title: "Validation error", text: "Please enter a valid target node id." });
            return;
        }
        const targetNodeId = BigInt(rawNodeId);
        const endpoint = parseInt(this._endpointInput, 10);
        if (Number.isNaN(endpoint) || endpoint < 0 || endpoint > 0xfffe) {
            await showAlertDialog({ title: "Validation error", text: "Please enter a valid target endpoint." });
            return;
        }

        let cluster: number | undefined;
        if (this._clusterSelection === ALL_CLUSTERS) {
            cluster = undefined;
        } else if (this._clusterSelection === CUSTOM_CLUSTER) {
            const c = parseInt(this._customClusterInput, 10);
            if (Number.isNaN(c) || c < 0 || c > 0x7fff) {
                await showAlertDialog({ title: "Validation error", text: "Please enter a valid cluster id." });
                return;
            }
            cluster = c;
        } else {
            cluster = parseInt(this._clusterSelection, 10);
        }

        if (target) {
            const capacity = targetAclCapacityForBinding(target, this.node!.node_id);
            if (!capacity.canAdd) {
                await showAlertDialog({ title: "Cannot add binding", text: capacity.reason ?? "Target ACL is full." });
                return;
            }
        }

        this._busy = true;
        try {
            await addBinding(this.client, this.node!, this.endpoint, targetNodeId, endpoint, cluster);
            this._close();
        } catch (err) {
            await showAlertDialog({
                title: "Failed to add binding",
                text: err instanceof Error ? err.message : String(err),
            });
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

    private _renderClusterField(target: MatterNode | undefined, endpoint: number | undefined) {
        const known = target !== undefined && endpoint !== undefined && !Number.isNaN(endpoint);
        const split = known ? bindableClusters(this.node!, this.endpoint, target, endpoint) : undefined;
        const nonBindable =
            split !== undefined &&
            this._clusterSelection !== ALL_CLUSTERS &&
            this._clusterSelection !== CUSTOM_CLUSTER &&
            split.otherTarget.includes(parseInt(this._clusterSelection, 10));

        return html`
            <md-outlined-select
                label="Cluster"
                .value=${this._clusterSelection}
                ?disabled=${this._busy}
                @change=${(e: Event) => (this._clusterSelection = (e.target as HTMLSelectElement).value)}
            >
                <md-select-option value=${ALL_CLUSTERS}>
                    <div slot="headline">All clusters (any eligible)</div>
                </md-select-option>
                ${split && split.bindable.length
                    ? html`<md-select-option disabled><div slot="headline">— Bindable —</div></md-select-option>
                          ${split.bindable.map(
                              c =>
                                  html`<md-select-option value=${String(c)}
                                      ><div slot="headline">${this._clusterLabel(c)}</div></md-select-option
                                  >`,
                          )}`
                    : nothing}
                ${split && split.otherTarget.length
                    ? html`<md-select-option disabled
                              ><div slot="headline">— Other target clusters (⚠) —</div></md-select-option
                          >
                          ${split.otherTarget.map(
                              c =>
                                  html`<md-select-option value=${String(c)}
                                      ><div slot="headline">${this._clusterLabel(c)}</div></md-select-option
                                  >`,
                          )}`
                    : nothing}
                <md-select-option value=${CUSTOM_CLUSTER}
                    ><div slot="headline">Custom cluster id…</div></md-select-option
                >
            </md-outlined-select>
            ${this._clusterSelection === CUSTOM_CLUSTER
                ? html`<md-outlined-text-field
                      label="cluster id"
                      type="number"
                      min="0"
                      max="32767"
                      .value=${this._customClusterInput}
                      ?disabled=${this._busy}
                      @input=${(e: Event) => (this._customClusterInput = (e.target as HTMLInputElement).value)}
                  ></md-outlined-text-field>`
                : nothing}
            ${nonBindable
                ? html`<div class="warn">
                      ⚠ This cluster is not a client cluster on the source endpoint. The binding may not function — it
                      will be added anyway on your request.
                  </div>`
                : nothing}
        `;
    }

    protected override render() {
        if (!this.node) return nothing;
        const target = this._resolveTarget();
        const endpoint = this._endpointInput === "" ? undefined : parseInt(this._endpointInput, 10);
        const endpoints = target ? this._nodeEndpoints(target) : [];

        return html`
            <md-dialog open @cancel=${preventDefault} @closed=${this._handleClosed}>
                <div slot="headline">Add binding</div>
                <div slot="content">
                    <div class="form">
                        <md-outlined-select
                            label="Known nodes"
                            ?disabled=${this._busy}
                            .value=${target ? this._nodeIdInput : ""}
                            @change=${this._onNodeSelect}
                        >
                            <md-select-option value=""><div slot="headline">— pick a node —</div></md-select-option>
                            ${this._knownNodes().map(
                                n =>
                                    html`<md-select-option value=${nodeIdKey(n.node_id)}>
                                        <div slot="headline">${n.node_id.toString()} · ${getDeviceName(n)}</div>
                                    </md-select-option>`,
                            )}
                        </md-outlined-select>
                        <md-outlined-text-field
                            label="Target node id"
                            type="text"
                            pattern="[0-9]+"
                            supporting-text="required — pick above or enter a raw node id"
                            .value=${this._nodeIdInput}
                            ?disabled=${this._busy}
                            @input=${(e: Event) => {
                                this._nodeIdInput = (e.target as HTMLInputElement).value;
                                this._endpointInput = "";
                                this._clusterSelection = ALL_CLUSTERS;
                            }}
                        ></md-outlined-text-field>

                        ${target
                            ? html`<md-outlined-select
                                  label="Target endpoint"
                                  ?disabled=${this._busy}
                                  .value=${this._endpointInput}
                                  @change=${(e: Event) => {
                                      this._endpointInput = (e.target as HTMLSelectElement).value;
                                      this._clusterSelection = ALL_CLUSTERS;
                                  }}
                              >
                                  ${endpoints.map(ep => {
                                      const dt = getEndpointDeviceTypes(target, ep)[0];
                                      return html`<md-select-option value=${String(ep)}>
                                          <div slot="headline">EP ${ep}${dt ? ` · ${dt.label}` : ""}</div>
                                      </md-select-option>`;
                                  })}
                              </md-outlined-select>`
                            : html`<md-outlined-text-field
                                  label="Target endpoint"
                                  type="number"
                                  min="0"
                                  max="65534"
                                  supporting-text=${this._nodeIdInput.trim() === ""
                                      ? "enter a node id first"
                                      : "unknown node — enter endpoint manually"}
                                  ?disabled=${this._busy || this._nodeIdInput.trim() === ""}
                                  .value=${this._endpointInput}
                                  @input=${(e: Event) => (this._endpointInput = (e.target as HTMLInputElement).value)}
                              ></md-outlined-text-field>`}
                        ${this._renderClusterField(target, endpoint)}
                    </div>
                </div>
                <div slot="actions">
                    <md-text-button ?disabled=${this._busy} @click=${handleAsync(() => this._add())}
                        >Add</md-text-button
                    >
                    <md-text-button ?disabled=${this._busy} @click=${this._close}>Cancel</md-text-button>
                </div>
            </md-dialog>
        `;
    }

    static override styles = css`
        .form {
            display: flex;
            flex-direction: column;
            gap: 12px;
            min-width: 320px;
        }
        .warn {
            font-size: 12px;
            padding: 8px 10px;
            border-radius: 7px;
            background: var(--md-sys-color-error-container);
            color: var(--md-sys-color-on-error-container);
        }
    `;
}

declare global {
    interface HTMLElementTagNameMap {
        "node-binding-dialog": NodeBindingDialog;
    }
}
