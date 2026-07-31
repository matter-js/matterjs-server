/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/filled-button";
import "@material/web/button/text-button";
import "@material/web/checkbox/checkbox";
import "@material/web/dialog/dialog";
import { consume } from "@lit/context";
import {
    isLongIdleTimeDevice,
    THREAD_TOPOLOGY_ATTRIBUTE_PATHS,
    type MatterClient,
    type MatterNode,
} from "@matter-server/ws-client";
import { mdiLoading } from "@mdi/js";
import { LitElement, css, html, nothing, svg } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { clientContext, tickContext } from "../../client/client-context.js";
import { reducedMotionStyles } from "../../util/shared-styles.js";
import { getNetworkType } from "./network-utils.js";

declare global {
    interface HTMLElementTagNameMap {
        "update-connections-dialog": UpdateConnectionsDialog;
    }
}

/** WiFi network attributes to read */
const WIFI_ATTRIBUTE_PATHS = ["0/54/0", "0/54/3", "0/54/4"]; // BSSID, Channel, RSSI

// A LIT node answers when it next polls, which can be hours away. Give it a short grace period once
// the other nodes are done, capped so one sleepy device cannot hold the dialog open.
const LIT_GRACE_MS = 10_000;
const LIT_MAX_WAIT_MS = 20_000;

@customElement("update-connections-dialog")
export class UpdateConnectionsDialog extends LitElement {
    @consume({ context: clientContext })
    public client!: MatterClient;

    @consume({ context: tickContext, subscribe: true })
    protected _tick = 0;

    @property({ type: Object })
    public nodes: Record<string, MatterNode> = {};

    @property({ type: String })
    public selectedNodeType: "online" | "offline" | "unknown" = "online";

    @property({ type: String })
    public selectedNodeName: string = "";

    @property()
    public selectedNodeId: number | string | null = null;

    @property({ type: Array })
    public onlineNeighborIds: string[] = [];

    @state()
    private _includeNeighbors: boolean = false;

    @state()
    private _isUpdating: boolean = false;

    /** Timeout ID for auto-close */
    private _timeoutId: ReturnType<typeof setTimeout> | null = null;

    private _litTimeoutId: ReturnType<typeof setTimeout> | null = null;

    private _litGraceResolve: (() => void) | null = null;

    /** Track if we've already dispatched close event to prevent double-firing */
    private _hasClosedEvent: boolean = false;

    override firstUpdated(): void {
        // A sleeping node cannot report its own link data in time, so its neighbours — which can — are
        // the default target rather than an opt-in extra.
        if (this._selectedIsLongIdleTime) {
            this._includeNeighbors = true;
        }

        // Open dialog when component is first rendered
        const dialog = this.shadowRoot?.querySelector("md-dialog") as HTMLElement & { show: () => void };
        dialog?.show();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        // Clean up timeout when component is removed
        if (this._timeoutId) {
            clearTimeout(this._timeoutId);
            this._timeoutId = null;
        }
        this._endLongIdleTimeGrace();
    }

    /**
     * Get the number of nodes that will be updated.
     */
    private get _updateCount(): number {
        if (this.selectedNodeType === "online") {
            return this._includeNeighbors ? 1 + this.onlineNeighborIds.length : 1;
        }
        // offline and unknown: update neighbors only
        return this.onlineNeighborIds.length;
    }

    /**
     * Get the attribute paths to read for a node based on its network type.
     */
    private _getAttributePathsForNode(nodeId: string): string[] {
        const node = this.nodes[nodeId];
        if (!node) return [];

        const networkType = getNetworkType(node);

        if (networkType === "thread") {
            return [...THREAD_TOPOLOGY_ATTRIBUTE_PATHS];
        }
        if (networkType === "wifi") {
            return WIFI_ATTRIBUTE_PATHS;
        }
        // Ethernet and unknown have no dynamic network data
        return [];
    }

    /**
     * Get the list of node IDs to update based on current state.
     */
    private _getNodeIdsToUpdate(): string[] {
        if (this.selectedNodeType === "online") {
            const nodeIds = [String(this.selectedNodeId)];
            if (this._includeNeighbors) {
                nodeIds.push(...this.onlineNeighborIds);
            }
            return nodeIds;
        }
        // offline and unknown: update neighbors only
        return this.onlineNeighborIds;
    }

    private _longIdleTimeGrace(startedAt: number): Promise<void> {
        const budget = Math.min(LIT_GRACE_MS, LIT_MAX_WAIT_MS - (Date.now() - startedAt));
        if (budget <= 0) return Promise.resolve();
        return new Promise<void>(resolve => {
            this._litGraceResolve = resolve;
            this._litTimeoutId = setTimeout(resolve, budget);
        });
    }

    /**
     * Ends the grace period. Resolving is what matters: dropping the timer alone would leave the raced
     * promise pending on a LIT read that only settles on the client's command timeout, holding this
     * element and its node map alive for as long as that takes.
     */
    private _endLongIdleTimeGrace(): void {
        if (this._litTimeoutId) {
            clearTimeout(this._litTimeoutId);
            this._litTimeoutId = null;
        }
        this._litGraceResolve?.();
        this._litGraceResolve = null;
    }

    private get _selectedIsLongIdleTime(): boolean {
        if (this.selectedNodeType !== "online" || this.selectedNodeId === null) return false;
        const node = this.nodes[String(this.selectedNodeId)];
        return node !== undefined && isLongIdleTimeDevice(node.attributes);
    }

    private get _longIdleTimeNodeIds(): string[] {
        return this._getNodeIdsToUpdate().filter(nodeId => {
            const node = this.nodes[nodeId];
            return node !== undefined && isLongIdleTimeDevice(node.attributes);
        });
    }

    private _readNode(nodeIdStr: string): Promise<void> {
        const node = this.nodes[nodeIdStr];
        if (!node) return Promise.resolve();

        const paths = this._getAttributePathsForNode(nodeIdStr);
        if (paths.length === 0) return Promise.resolve();

        // fabric_filtered must match the node subscription's filter (true), else matter.js
        // discards the read and no attribute_updated fires, leaving the store stale.
        return this.client.readAttribute(node.node_id, paths, undefined, true).then(() => undefined);
    }

    private async _executeUpdate(): Promise<void> {
        if (this._isUpdating || this._updateCount === 0) return;

        this._isUpdating = true;

        // Set up 30s timeout to auto-close dialog
        this._timeoutId = setTimeout(() => {
            console.warn("Update connections timed out after 30s");
            this._closeDialog();
        }, 30000);

        const startedAt = Date.now();

        try {
            const longIdleTime = new Set(this._longIdleTimeNodeIds);
            const nodeIds = this._getNodeIdsToUpdate();

            // A LIT node answers only when it next polls, so its read is started but never waited out:
            // the value still lands in the store via attribute_updated whenever the node wakes up.
            const litReads = new Array<Promise<void>>();
            const reads = new Array<Promise<void>>();
            let failures = 0;
            for (const nodeId of nodeIds) {
                const sleepy = longIdleTime.has(nodeId);
                const read = this._readNode(nodeId).catch(error => {
                    // Only the awaited reads count: a LIT failure cannot say anything about the ones
                    // this update actually reported on.
                    if (!sleepy) failures++;
                    console.warn(`Failed to refresh network data of node ${nodeId}:`, error);
                });
                (sleepy ? litReads : reads).push(read);
            }

            // Return values are discarded; refreshed data arrives via attribute_updated events.
            await Promise.all(reads);

            if (reads.length > 0 && failures === reads.length) {
                console.error(`Refreshing network data failed for all ${failures} nodes`);
            }

            // Only worth a grace period when other nodes were waited for anyway; a selection of LIT
            // nodes alone would just spin for the full budget, which is what the dialog says it won't do.
            if (litReads.length > 0 && reads.length > 0) {
                await Promise.race([Promise.all(litReads), this._longIdleTimeGrace(startedAt)]);
            }

            // Close dialog on success
            this._closeDialog();
        } catch (error) {
            console.error("Failed to update connections:", error);
            // Close dialog on error too - don't leave user stuck
            this._closeDialog();
        } finally {
            // Clear timeout if we finished before 30s
            if (this._timeoutId) {
                clearTimeout(this._timeoutId);
                this._timeoutId = null;
            }
            this._endLongIdleTimeGrace();
            this._isUpdating = false;
        }
    }

    private _closeDialog(): void {
        // Prevent double-firing the close event
        if (this._hasClosedEvent) return;
        this._hasClosedEvent = true;

        const dialog = this.shadowRoot?.querySelector("md-dialog") as HTMLElement & { close: () => void };
        dialog?.close();
        // Use 'dialog-closed' to avoid conflicting with network-details 'close' event
        this.dispatchEvent(new CustomEvent("dialog-closed", { bubbles: true, composed: true }));
    }

    /** Handle native dialog closed event (ESC key, backdrop click, etc.) */
    private _handleDialogClosed(): void {
        this._closeDialog();
    }

    private _handleCheckboxChange(e: Event): void {
        const checkbox = e.target as HTMLInputElement;
        this._includeNeighbors = checkbox.checked;
    }

    private _renderOnlineContent(): unknown {
        const sleepy = this._selectedIsLongIdleTime;
        const neighborCount = this.onlineNeighborIds.length;
        const plural = neighborCount !== 1 ? "s" : "";

        return html`
            ${sleepy
                ? html`
                      <p>
                          "<strong>${this.selectedNodeName}</strong>" is a sleepy device (Matter LIT). It answers only
                          when it next wakes, so its own network data arrives later.
                      </p>
                  `
                : html`<p>Refresh network information for "<strong>${this.selectedNodeName}</strong>".</p>`}
            ${neighborCount > 0
                ? html`
                      <label class="checkbox-row">
                          <md-checkbox
                              ?checked=${this._includeNeighbors}
                              @change=${this._handleCheckboxChange}
                              ?disabled=${this._isUpdating}
                          ></md-checkbox>
                          <span
                              >${sleepy ? "Refresh" : "Include"} ${neighborCount} connected online
                              neighbor${plural}${sleepy ? " for current link data" : ""}</span
                          >
                      </label>
                  `
                : sleepy
                  ? html`<p class="note">No online neighbor can report its current link data either.</p>`
                  : nothing}
        `;
    }

    private _renderOfflineContent(): unknown {
        return html`
            <p>"<strong>${this.selectedNodeName}</strong>" appears to be offline.</p>
            ${this.onlineNeighborIds.length > 0
                ? html`
                      <p>
                          Update network data from its ${this.onlineNeighborIds.length} online
                          neighbor${this.onlineNeighborIds.length !== 1 ? "s" : ""} to refresh connection info.
                      </p>
                  `
                : html` <p>No online neighbors available to update.</p> `}
        `;
    }

    private _renderUnknownContent(): unknown {
        return html`
            <p>This device is not commissioned to this fabric and cannot be queried directly.</p>
            ${this.onlineNeighborIds.length > 0
                ? html`
                      <p>
                          Update network data from ${this.onlineNeighborIds.length}
                          node${this.onlineNeighborIds.length !== 1 ? "s" : ""} that
                          see${this.onlineNeighborIds.length === 1 ? "s" : ""} this device to refresh info.
                      </p>
                  `
                : html` <p>No online nodes available that see this device.</p> `}
        `;
    }

    private _renderLongIdleTimeNote(): unknown {
        // The selected node's own sleep state is already spelled out by _renderOnlineContent.
        const selectedId = String(this.selectedNodeId);
        const count = this._longIdleTimeNodeIds.filter(
            nodeId => !(this._selectedIsLongIdleTime && nodeId === selectedId),
        ).length;
        if (count === 0) return nothing;

        return html`
            <p class="note">
                ${count === 1 ? "One of them is" : `${count} of them are`} a sleepy device (Matter LIT), so the update
                does not wait for ${count === 1 ? "it" : "them"} — ${count === 1 ? "its" : "their"} data appears once
                ${count === 1 ? "it wakes" : "they wake"} up.
            </p>
        `;
    }

    override render() {
        const buttonText =
            this._updateCount === 0
                ? "No nodes to update"
                : `Update ${this._updateCount} node${this._updateCount !== 1 ? "s" : ""}`;

        return html`
            <md-dialog @closed=${this._handleDialogClosed}>
                <div slot="headline">Update Connection Data</div>
                <div slot="content">
                    ${this.selectedNodeType === "online"
                        ? this._renderOnlineContent()
                        : this.selectedNodeType === "offline"
                          ? this._renderOfflineContent()
                          : this._renderUnknownContent()}
                    ${this._renderLongIdleTimeNote()}
                </div>
                <div slot="actions">
                    <md-text-button @click=${this._closeDialog} ?disabled=${this._isUpdating}>Cancel</md-text-button>
                    <md-filled-button
                        @click=${this._executeUpdate}
                        ?disabled=${this._isUpdating || this._updateCount === 0}
                    >
                        ${this._isUpdating
                            ? html`<span class="updating-content"
                                  >${svg`<svg class="spinner" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="${mdiLoading}"/></svg>`}Updating...</span
                              >`
                            : buttonText}
                    </md-filled-button>
                </div>
            </md-dialog>
        `;
    }

    static override styles = [
        reducedMotionStyles,
        css`
            md-dialog {
                --md-dialog-container-color: var(--md-sys-color-surface, #fff);
            }

            [slot="content"] {
                padding: 0 24px;
            }

            [slot="content"] p {
                margin: 0 0 16px 0;
                font-size: 0.875rem;
                line-height: 1.5;
                color: var(--md-sys-color-on-surface, #333);
            }

            [slot="content"] p:last-child {
                margin-bottom: 0;
            }

            [slot="content"] p.note {
                margin-top: 12px;
                font-size: 0.8125rem;
                color: var(--text-color, rgba(0, 0, 0, 0.6));
            }

            .checkbox-row {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                font-size: 0.875rem;
                color: var(--md-sys-color-on-surface, #333);
            }

            .updating-content {
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }

            .spinner {
                animation: spin 1s linear infinite;
                flex-shrink: 0;
            }

            .updating-content svg {
                color: inherit;
            }

            @keyframes spin {
                from {
                    transform: rotate(0deg);
                }
                to {
                    transform: rotate(360deg);
                }
            }

            md-filled-button {
                min-width: 140px;
            }
        `,
    ];
}
