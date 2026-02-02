/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/text-button";
import "@material/web/dialog/dialog";
import type { MdDialog } from "@material/web/dialog/dialog.js";
import "@material/web/list/list";
import "@material/web/list/list-item";
import "@material/web/textfield/outlined-text-field";
import type { MdOutlinedTextField } from "@material/web/textfield/outlined-text-field.js";
import "../../../components/ha-svg-icon";

import { AccessControlEntry, BindingTarget, MatterClient, MatterNode } from "@matter-server/ws-client";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { handleAsync } from "../../../util/async-handler.js";
import { preventDefault } from "../../../util/prevent_default.js";
import { BindingEntryDataTransformer, BindingEntryStruct, InputType } from "./model.js";

import {
    AccessControlEntryDataTransformer,
    AccessControlEntryStruct,
    AccessControlTargetStruct,
} from "../acl/model.js";

import { consume } from "@lit/context";
import { clientContext } from "../../../client/client-context.js";
import { analyzeBatchResults, type MatterBatchResult } from "../../../util/matter-status.js";

@customElement("node-binding-dialog")
export class NodeBindingDialog extends LitElement {
    @consume({ context: clientContext, subscribe: true })
    @property({ attribute: false })
    public client!: MatterClient;

    @property()
    public node?: MatterNode;

    @property({ attribute: false })
    endpoint!: number;

    @query("md-outlined-text-field[name='NodeId']")
    private _targetNodeId!: MdOutlinedTextField;

    @query("md-outlined-text-field[name='Endpoint']")
    private _targetEndpoint!: MdOutlinedTextField;

    @query("md-outlined-text-field[name='Cluster']")
    private _targetCluster!: MdOutlinedTextField;

    private fetchBindingEntry(): BindingEntryStruct[] {
        const bindings_raw = this.node!.attributes[this.endpoint + "/30/0"] as InputType[] | undefined;
        if (!bindings_raw) return [];
        return Object.values(bindings_raw).map(value => BindingEntryDataTransformer.transform(value));
    }

    private fetchACLEntry(targetNodeId: number): AccessControlEntryStruct[] {
        const acl_cluster_raw = this.client.nodes[targetNodeId]?.attributes["0/31/0"] as InputType[] | undefined;
        if (!acl_cluster_raw) return [];
        return Object.values(acl_cluster_raw).map((value: InputType) =>
            AccessControlEntryDataTransformer.transform(value),
        );
    }

    private async deleteBindingHandler(index: number): Promise<void> {
        const rawBindings = this.fetchBindingEntry();
        try {
            const targetNodeId = rawBindings[index].node;
            const endpoint = rawBindings[index].endpoint;
            if (targetNodeId === undefined || endpoint === undefined) return;
            await this.removeNodeAtACLEntry(this.getNodeIdAsNumber(), endpoint, targetNodeId);
            const updatedBindings = this.removeBindingAtIndex(rawBindings, index);
            await this.syncBindingUpdates(updatedBindings, index);
        } catch (error) {
            this.handleBindingDeletionError(error);
        }
    }

    /** Helper to convert node_id (number | bigint) to number for API calls */
    private getNodeIdAsNumber(): number {
        const nodeId = this.node!.node_id;
        return typeof nodeId === "bigint" ? Number(nodeId) : nodeId;
    }

    private async removeNodeAtACLEntry(
        sourceNodeId: number,
        sourceEndpoint: number,
        targetNodeId: number,
    ): Promise<void> {
        const aclEntries = this.fetchACLEntry(targetNodeId);

        const updatedACLEntries = aclEntries
            .map(entry => this.removeEntryAtACL(sourceNodeId, sourceEndpoint, entry))
            .filter((entry): entry is AccessControlEntryStruct => entry !== undefined);

        // Convert to API format (without fabricIndex - server handles it)
        const apiEntries = updatedACLEntries.map(e => this.toAccessControlEntry(e));
        await this.client.setACLEntry(targetNodeId, apiEntries);
    }

    private removeEntryAtACL(
        nodeId: number,
        sourceEndpoint: number,
        entry: AccessControlEntryStruct,
    ): AccessControlEntryStruct | undefined {
        const hasSubject = entry.subjects.includes(nodeId);
        if (!hasSubject) return entry;

        const hasTarget = entry.targets!.filter(item => item.endpoint === sourceEndpoint);
        return hasTarget.length > 0 ? undefined : entry;
    }

    private removeBindingAtIndex(bindings: BindingEntryStruct[], index: number): BindingEntryStruct[] {
        return [...bindings.slice(0, index), ...bindings.slice(index + 1)];
    }

    private async syncBindingUpdates(updatedBindings: BindingEntryStruct[], index: number): Promise<void> {
        // Convert to API format (without fabricIndex - server handles it)
        const apiBindings = updatedBindings.map(b => this.toBindingTarget(b));
        await this.client.setNodeBinding(this.getNodeIdAsNumber(), this.endpoint, apiBindings);

        const attributePath = `${this.endpoint}/30/0`;
        const currentBindings = this.node!.attributes[attributePath] as BindingEntryStruct[] | undefined;
        const updatedAttributes = {
            ...this.node!.attributes,
            [attributePath]: currentBindings ? this.removeBindingAtIndex(currentBindings, index) : [],
        };

        this.node!.attributes = updatedAttributes;
        this.requestUpdate();
    }

    private handleBindingDeletionError(error: unknown): void {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Binding deletion failed: ${errorMessage}`);
    }

    private async add_target_acl(targetNodeId: number, entry: AccessControlEntryStruct): Promise<MatterBatchResult> {
        try {
            // Fetch existing ACL entries and transform to local struct format
            const rawEntries = this.client.nodes[targetNodeId]?.attributes["0/31/0"] as InputType[] | undefined;
            const entries = rawEntries
                ? Object.values(rawEntries).map(v => AccessControlEntryDataTransformer.transform(v))
                : [];
            entries.push(entry);

            // Convert to API format (without fabricIndex - server handles it)
            const apiEntries = entries.map(e => this.toAccessControlEntry(e));
            const results = await this.client.setACLEntry(targetNodeId, apiEntries);

            const batchResult = analyzeBatchResults(results ?? []);
            if (batchResult.outcome !== "all_success") {
                console.error(`Set ACL entry: ${batchResult.message}`);
            }
            return batchResult;
        } catch (err) {
            console.error("Add ACL error:", err);
            return {
                outcome: "all_failed",
                successCount: 0,
                failureCount: 1,
                errorCounts: { 1: 1 },
                message: `Exception: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }

    /** Convert local BindingEntryStruct to API BindingTarget (without fabricIndex) */
    private toBindingTarget(entry: BindingEntryStruct): BindingTarget {
        return {
            node: entry.node ?? null,
            group: entry.group ?? null,
            endpoint: entry.endpoint ?? null,
            cluster: entry.cluster ?? null,
        };
    }

    /** Convert local AccessControlEntryStruct to API AccessControlEntry (without fabricIndex) */
    private toAccessControlEntry(entry: AccessControlEntryStruct): AccessControlEntry {
        return {
            privilege: entry.privilege,
            auth_mode: entry.authMode,
            subjects: entry.subjects ?? null,
            targets:
                entry.targets?.map(t => ({
                    cluster: t.cluster ?? null,
                    endpoint: t.endpoint ?? null,
                    device_type: t.deviceType ?? null,
                })) ?? null,
        };
    }

    private async add_bindings(endpoint: number, bindingEntry: BindingEntryStruct): Promise<MatterBatchResult> {
        const bindings = this.fetchBindingEntry();
        bindings.push(bindingEntry);
        try {
            // Convert to API format (without fabricIndex - server handles it)
            const apiBindings = bindings.map(b => this.toBindingTarget(b));
            const results = await this.client.setNodeBinding(this.getNodeIdAsNumber(), endpoint, apiBindings);

            const batchResult = analyzeBatchResults(results ?? []);
            if (batchResult.outcome !== "all_success") {
                console.error(`Set binding: ${batchResult.message}`);
            }
            return batchResult;
        } catch (err) {
            console.error("Add bindings error:", err);
            return {
                outcome: "all_failed",
                successCount: 0,
                failureCount: 1,
                errorCounts: { 1: 1 },
                message: `Exception: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }

    async addBindingHandler() {
        const targetNodeId = this._targetNodeId.value ? parseInt(this._targetNodeId.value, 10) : undefined;
        const targetEndpoint = this._targetEndpoint.value ? parseInt(this._targetEndpoint.value, 10) : undefined;
        const targetCluster = this._targetCluster.value ? parseInt(this._targetCluster.value, 10) : undefined;

        // Matter Server does not use random NodeIds, so this is ok for now, but needs to be adjusted later
        if (targetNodeId === undefined || targetNodeId <= 0 || targetNodeId > 65535) {
            alert("Please enter a valid target node ID");
            return;
        }

        if (targetEndpoint === undefined || targetEndpoint <= 0 || targetEndpoint > 0xfffe) {
            alert("Please enter a valid target endpoint");
            return;
        }

        // cluster optional
        if (targetCluster !== undefined) {
            // We ignore vendor specific clusters for now
            if (targetCluster < 0 || targetCluster > 0x7fff) {
                alert("Please enter a valid target cluster");
                return;
            }
        }

        const targets: AccessControlTargetStruct = {
            endpoint: targetEndpoint,
            cluster: targetCluster,
            deviceType: undefined,
        };

        // Note: fabricIndex is assigned by the server based on the device's fabric table
        const acl_entry: AccessControlEntryStruct = {
            privilege: 5,
            authMode: 2,
            subjects: [this.getNodeIdAsNumber()],
            targets: [targets],
            fabricIndex: 0, // Placeholder - server will use correct fabric index
        };

        const aclResult = await this.add_target_acl(targetNodeId, acl_entry);
        if (aclResult.outcome === "all_failed") {
            alert(`Failed to add ACL entry:\n${aclResult.message}`);
            return;
        }
        if (aclResult.outcome === "partial") {
            alert(`ACL entry partially failed:\n${aclResult.message}`);
            // Continue with binding attempt since some ACL entries succeeded
        }

        const endpoint = this.endpoint;
        // Note: fabricIndex is assigned by the server based on the device's fabric table
        const bindingEntry: BindingEntryStruct = {
            node: targetNodeId,
            endpoint: targetEndpoint,
            group: undefined,
            cluster: targetCluster,
            fabricIndex: undefined, // Server will use correct fabric index
        };

        const bindingResult = await this.add_bindings(endpoint, bindingEntry);

        if (bindingResult.outcome === "all_success") {
            this._targetNodeId.value = "";
            this._targetEndpoint.value = "";
            this._targetCluster.value = "";
            this.requestUpdate();
        } else if (bindingResult.outcome === "partial") {
            alert(`Binding partially failed:\n${bindingResult.message}`);
            this.requestUpdate(); // Update UI to show what succeeded
        } else {
            alert(`Failed to add binding:\n${bindingResult.message}`);
        }
    }

    private _close() {
        this.shadowRoot!.querySelector<MdDialog>("md-dialog")!.close();
    }

    private _handleClosed() {
        this.parentNode!.removeChild(this);
    }

    private onChange(e: Event) {
        const textfield = e.target as MdOutlinedTextField;
        const value = parseInt(textfield.value, 10);

        if (parseInt(textfield.max, 10) < value || value < parseInt(textfield.min, 10)) {
            textfield.error = true;
            textfield.errorText = "value error";
        } else {
            textfield.error = false;
        }

        // console.log(`value: ${value} error: ${textfield.error}`);
    }

    protected override render() {
        const rawBindings = this.node!.attributes[this.endpoint + "/30/0"] as InputType[] | undefined;
        const bindings = rawBindings
            ? Object.values(rawBindings).map(entry => BindingEntryDataTransformer.transform(entry))
            : [];

        return html`
            <md-dialog open @cancel=${preventDefault} @closed=${this._handleClosed}>
                <div slot="headline">
                    <div>Binding</div>
                </div>
                <div slot="content">
                    <div>
                        <md-list style="padding-bottom:18px;">
                            ${Object.values(bindings).map(
                                (entry, index) => html`
                  <md-list-item class="binding-item">
                    <div style="display:flex;gap:10px;">
                        <div>node:${entry["node"]}</div>
                        <div>endpoint:${entry["endpoint"]}</div>
                        ${entry["cluster"] ? html` <div>cluster:${entry["cluster"]}</div> ` : nothing}
                    </div>
                    <div slot="end">
                      <md-text-button
                        @click=${handleAsync(() => this.deleteBindingHandler(index))}
                      >delete</md-text-button
                    </div>
                  </md-list-item>
                `,
                            )}
                        </md-list>
                        <div class="inline-group">
                            <div class="group-label">target</div>
                            <div class="group-input">
                                <md-outlined-text-field
                                    label="node id"
                                    name="NodeId"
                                    type="number"
                                    min="0"
                                    max="65535"
                                    class="target-item"
                                    @change=${this.onChange}
                                    supporting-text="required"
                                ></md-outlined-text-field>
                                <md-outlined-text-field
                                    label="endpoint"
                                    name="Endpoint"
                                    type="number"
                                    min="0"
                                    max="65534"
                                    @change=${this.onChange}
                                    class="target-item"
                                    supporting-text="required"
                                ></md-outlined-text-field>
                                <md-outlined-text-field
                                    label="cluster"
                                    name="Cluster"
                                    type="number"
                                    min="0"
                                    max="32767"
                                    @change=${this.onChange}
                                    class="target-item"
                                    supporting-text="optional"
                                ></md-outlined-text-field>
                            </div>
                        </div>
                        <div style="margin:8px;">
                            <Text style="font-size: 10px;font-style: italic;font-weight: bold;">
                                Note: The Cluster ID field is optional according to the Matter specification. If you
                                leave it blank, the binding applies to all eligible clusters on the target endpoint.
                                However, some devices may require a specific cluster to be set in order for the binding
                                to function correctly. If you experience unexpected behavior, try specifying the cluster
                                explicitly.
                            </Text>
                        </div>
                    </div>
                </div>
                <div slot="actions">
                    <md-text-button @click=${handleAsync(() => this.addBindingHandler())}>Add</md-text-button>
                    <md-text-button @click=${this._close}>Cancel</md-text-button>
                </div>
            </md-dialog>
        `;
    }

    static override styles = css`
        .binding-item {
            background: var(--md-sys-color-surface-container-high);
        }

        .inline-group {
            display: flex;
            border: 2px solid var(--md-sys-color-primary);
            padding: 1px;
            border-radius: 8px;
            position: relative;
            margin: 8px;
        }

        .group-input {
            display: flex;
            width: -webkit-fill-available;
        }

        .target-item {
            display: inline-block;
            padding: 20px 10px 10px 10px;
            border-radius: 4px;
            vertical-align: middle;
            min-width: 80px;
            text-align: center;
            width: -webkit-fill-available;
        }

        .group-label {
            position: absolute;
            left: 15px;
            top: -12px;
            background: var(--md-sys-color-primary);
            color: var(--md-sys-color-on-primary);
            padding: 3px 15px;
            border-radius: 4px;
        }
    `;
}

declare global {
    interface HTMLElementTagNameMap {
        "node-binding-dialog": NodeBindingDialog;
    }
}
