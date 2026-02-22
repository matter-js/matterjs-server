/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/button/filled-button";
import "@material/web/button/text-button";
import "@material/web/checkbox/checkbox";
import "@material/web/dialog/dialog";
import type { MatterClient, MatterNode } from "@matter-server/ws-client";
import { mdiLoading } from "@mdi/js";
import { LitElement, css, html, nothing, svg } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { getNetworkType } from "./network-utils.js";

declare global {
    interface HTMLElementTagNameMap {
        "update-connections-dialog": UpdateConnectionsDialog;
    }
}

/** Thread network attributes to read */
const THREAD_ATTRIBUTE_PATHS = ["0/53/7", "0/53/8", "0/51/0"]; // NeighborTable, RouteTable, NetworkInterfaces

/** WiFi network attributes to read */
const WIFI_ATTRIBUTE_PATHS = ["0/54/0", "0/54/3", "0/54/4"]; // BSSID, Channel, RSSI

@customElement("update-connections-dialog")
export class UpdateConnectionsDialog extends LitElement {
    @property({ type: Object })
    public client!: MatterClient;

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

    /** Track if we've already dispatched close event to prevent double-firing */
    private _hasClosedEvent: boolean = false;

    override firstUpdated(): void {
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
            return THREAD_ATTRIBUTE_PATHS;
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

    private async _executeUpdate(): Promise<void> {
        if (this._isUpdating || this._updateCount === 0) return;

        this._isUpdating = true;

        // Set up 30s timeout to auto-close dialog
        this._timeoutId = setTimeout(() => {
            console.warn("Update connections timed out after 30s");
            this._closeDialog();
        }, 30000);

        try {
            const nodeIds = this._getNodeIdsToUpdate();

            // Build promises for all node updates
            const updatePromises = nodeIds.map(async nodeIdStr => {
                const node = this.nodes[nodeIdStr];
                if (!node) return;

                const paths = this._getAttributePathsForNode(nodeIdStr);
                if (paths.length === 0) return;

                // Use the actual node_id from the node object (number | bigint)
                await this.client.readAttribute(node.node_id, paths);
            });

            // Wait for all to complete (results come via events, we just need completion)
            await Promise.all(updatePromises);

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
        return html`
            <p>Refresh network information for "<strong>${this.selectedNodeName}</strong>".</p>
            ${
                this.onlineNeighborIds.length > 0
                    ? html`
                      <label class="checkbox-row">
                          <md-checkbox
                              ?checked=${this._includeNeighbors}
                              @change=${this._handleCheckboxChange}
                              ?disabled=${this._isUpdating}
                          ></md-checkbox>
                          <span
                              >Include ${this.onlineNeighborIds.length} connected online
                              neighbor${this.onlineNeighborIds.length !== 1 ? "s" : ""}</span
                          >
                      </label>
                  `
                    : nothing
            }
        `;
    }

    private _renderOfflineContent(): unknown {
        return html`
            <p>"<strong>${this.selectedNodeName}</strong>" appears to be offline.</p>
            ${
                this.onlineNeighborIds.length > 0
                    ? html`
                      <p>
                          Update network data from its ${this.onlineNeighborIds.length} online
                          neighbor${this.onlineNeighborIds.length !== 1 ? "s" : ""} to refresh connection info.
                      </p>
                  `
                    : html`
                          <p>No online neighbors available to update.</p>
                      `
            }
        `;
    }

    private _renderUnknownContent(): unknown {
        return html`
            <p>This device is not commissioned to this fabric and cannot be queried directly.</p>
            ${
                this.onlineNeighborIds.length > 0
                    ? html`
                      <p>
                          Update network data from ${this.onlineNeighborIds.length}
                          node${this.onlineNeighborIds.length !== 1 ? "s" : ""} that
                          see${this.onlineNeighborIds.length === 1 ? "s" : ""} this device to refresh info.
                      </p>
                  `
                    : html`
                          <p>No online nodes available that see this device.</p>
                      `
            }
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
                    ${
                        this.selectedNodeType === "online"
                            ? this._renderOnlineContent()
                            : this.selectedNodeType === "offline"
                              ? this._renderOfflineContent()
                              : this._renderUnknownContent()
                    }
                </div>
                <div slot="actions">
                    <md-text-button @click=${this._closeDialog} ?disabled=${this._isUpdating}>Cancel</md-text-button>
                    <md-filled-button
                        @click=${this._executeUpdate}
                        ?disabled=${this._isUpdating || this._updateCount === 0}
                    >
                        ${
                            this._isUpdating
                                ? html`<span class="updating-content"
                                  >${svg`<svg class="spinner" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="${mdiLoading}"/></svg>`}Updating...</span
                              >`
                                : buttonText
                        }
                    </md-filled-button>
                </div>
            </md-dialog>
        `;
    }

    static override styles = css`
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
    `;
}
