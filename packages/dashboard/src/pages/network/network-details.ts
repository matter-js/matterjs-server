/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import "@material/web/divider/divider";
import type { MatterNode } from "@matter-server/ws-client";
import { mdiClose, mdiSignal, mdiSignalCellular1, mdiSignalCellular2 } from "@mdi/js";
import { LitElement, TemplateResult, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import "../../components/ha-svg-icon";
import type { ThreadNeighbor } from "./network-types.js";
import type { NodeConnection } from "./network-utils.js";
import {
    buildExtAddrMap,
    getDeviceName,
    getNetworkType,
    getNodeConnections,
    getSignalColor,
    getSignalColorFromRssi,
    getThreadChannel,
    getThreadExtendedAddressHex,
    getThreadRole,
    getThreadRoleName,
    getWiFiDiagnostics,
    getWiFiSecurityTypeName,
    getWiFiVersionName,
    parseNeighborTable,
} from "./network-utils.js";

declare global {
    interface HTMLElementTagNameMap {
        "network-details": NetworkDetails;
    }
}

@customElement("network-details")
export class NetworkDetails extends LitElement {
    @property()
    public selectedNodeId: number | string | null = null;

    @property({ type: Object })
    public nodes: Record<string, MatterNode> = {};

    @property({ type: Object })
    public unknownDevices: Map<
        string,
        { extAddressHex: string; isRouter: boolean; seenBy: number[]; bestRssi: number | null }
    > = new Map();

    @property({ type: Object })
    public wifiAccessPoints: Map<string, { bssid: string; connectedNodes: number[] }> = new Map();

    private _handleClose(): void {
        this.dispatchEvent(
            new CustomEvent("close", {
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _handleSelectNode(nodeId: number | string): void {
        this.dispatchEvent(
            new CustomEvent("select-node", {
                detail: { nodeId },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _formatExtAddress(extAddr: bigint | string | undefined): string {
        if (extAddr === undefined || extAddr === "") return "Unknown";
        if (typeof extAddr === "bigint") {
            return extAddr.toString(16).toUpperCase().padStart(16, "0");
        }
        return extAddr;
    }

    private _getSignalIcon(neighbor: ThreadNeighbor): string {
        const color = getSignalColor(neighbor);
        if (color === "#4caf50") return mdiSignal; // Strong
        if (color === "#ff9800") return mdiSignalCellular2; // Medium
        return mdiSignalCellular1; // Weak
    }

    private _getSignalIconFromColor(color: string): string {
        if (color === "#4caf50") return mdiSignal; // Strong
        if (color === "#ff9800") return mdiSignalCellular2; // Medium
        return mdiSignalCellular1; // Weak
    }

    private _renderWiFiInfo(node: MatterNode): TemplateResult | typeof nothing {
        const wifiDiag = getWiFiDiagnostics(node);

        if (!wifiDiag.bssid && wifiDiag.rssi === null) {
            return nothing;
        }

        const signalColor = getSignalColorFromRssi(wifiDiag.rssi);

        return html`
            <div class="section">
                <h4>WiFi Network</h4>
                ${wifiDiag.bssid
                    ? html`
                          <div class="info-row">
                              <span class="label">BSSID:</span>
                              <span class="value mono">${wifiDiag.bssid}</span>
                          </div>
                      `
                    : nothing}
                ${wifiDiag.rssi !== null
                    ? html`
                          <div class="info-row">
                              <span class="label">Signal:</span>
                              <span class="value" style="color: ${signalColor}">${wifiDiag.rssi} dBm</span>
                          </div>
                      `
                    : nothing}
                ${wifiDiag.channel !== null
                    ? html`
                          <div class="info-row">
                              <span class="label">Channel:</span>
                              <span class="value">${wifiDiag.channel}</span>
                          </div>
                      `
                    : nothing}
                ${wifiDiag.securityType !== null
                    ? html`
                          <div class="info-row">
                              <span class="label">Security:</span>
                              <span class="value">${getWiFiSecurityTypeName(wifiDiag.securityType)}</span>
                          </div>
                      `
                    : nothing}
                ${wifiDiag.wifiVersion !== null
                    ? html`
                          <div class="info-row">
                              <span class="label">WiFi Version:</span>
                              <span class="value">${getWiFiVersionName(wifiDiag.wifiVersion)}</span>
                          </div>
                      `
                    : nothing}
            </div>
        `;
    }

    private _renderThreadInfo(node: MatterNode): TemplateResult | typeof nothing {
        const threadRole = getThreadRole(node);
        const channel = getThreadChannel(node);
        const extAddressHex = getThreadExtendedAddressHex(node);
        const extAddrMap = buildExtAddrMap(this.nodes);

        // Get all connections (bidirectional) - this matches what the graph shows
        const nodeId = typeof node.node_id === "bigint" ? Number(node.node_id) : node.node_id;
        const connections = getNodeConnections(nodeId, this.nodes, extAddrMap);

        return html`
            <div class="section">
                <h4>Thread Network</h4>
                <div class="info-row">
                    <span class="label">Role:</span>
                    <span class="value">${getThreadRoleName(threadRole)}</span>
                </div>
                ${channel !== undefined
                    ? html`
                          <div class="info-row">
                              <span class="label">Channel:</span>
                              <span class="value">${channel}</span>
                          </div>
                      `
                    : nothing}
                ${extAddressHex
                    ? html`
                          <div class="info-row">
                              <span class="label">Extended Address:</span>
                              <span class="value mono">${extAddressHex}</span>
                          </div>
                      `
                    : nothing}
            </div>

            ${connections.length > 0
                ? html`
                      <md-divider></md-divider>
                      <div class="section">
                          <h4>Connections (${connections.length})</h4>
                          <div class="neighbors-list">
                              ${connections.map((conn: NodeConnection) => {
                                  return html`
                                      <div
                                          class="neighbor-item clickable"
                                          @click=${() => this._handleSelectNode(conn.connectedNodeId)}
                                      >
                                          <ha-svg-icon
                                              .path=${this._getSignalIconFromColor(conn.signalColor)}
                                              style="--icon-primary-color: ${conn.signalColor}"
                                          ></ha-svg-icon>
                                          <div class="neighbor-info">
                                              <div class="neighbor-name">
                                                  ${conn.connectedNode
                                                      ? html`Node ${conn.connectedNodeId}:
                                                        ${getDeviceName(conn.connectedNode)}`
                                                      : html`External: <span class="mono">${conn.extAddressHex}</span>`}
                                              </div>
                                              <div class="neighbor-signal">
                                                  ${conn.rssi !== null ? html`RSSI: ${conn.rssi} dBm, ` : nothing}
                                                  ${conn.lqi !== null ? html`LQI: ${conn.lqi}` : nothing}
                                                  ${!conn.isOutgoing
                                                      ? html`<span class="direction-hint">(reverse)</span>`
                                                      : nothing}
                                              </div>
                                          </div>
                                      </div>
                                  `;
                              })}
                          </div>
                      </div>
                  `
                : nothing}
        `;
    }

    private _renderNodeInfo(node: MatterNode): TemplateResult | typeof nothing {
        const networkType = getNetworkType(node);

        return html`
            <div class="section">
                <h4>Device Info</h4>
                <div class="info-row">
                    <span class="label">Name:</span>
                    <span class="value">${getDeviceName(node)}</span>
                </div>
                <div class="info-row">
                    <span class="label">Vendor:</span>
                    <span class="value">${node.vendorName ?? "Unknown"}</span>
                </div>
                <div class="info-row">
                    <span class="label">Product:</span>
                    <span class="value">${node.productName ?? "Unknown"}</span>
                </div>
                ${node.serialNumber
                    ? html`
                          <div class="info-row">
                              <span class="label">Serial:</span>
                              <span class="value mono">${node.serialNumber}</span>
                          </div>
                      `
                    : nothing}
                <div class="info-row">
                    <span class="label">Network:</span>
                    <span class="value">${networkType.charAt(0).toUpperCase() + networkType.slice(1)}</span>
                </div>
                <div class="info-row">
                    <span class="label">Status:</span>
                    <span class="value ${node.available ? "status-online" : "status-offline"}"
                        >${node.available ? "Online" : "Offline"}</span
                    >
                </div>
            </div>

            ${networkType === "thread"
                ? html`
                      <md-divider></md-divider>
                      ${this._renderThreadInfo(node)}
                  `
                : nothing}
            ${networkType === "wifi"
                ? html`
                      <md-divider></md-divider>
                      ${this._renderWiFiInfo(node)}
                  `
                : nothing}
        `;
    }

    /**
     * Find the neighbor entry for an unknown device from a node's neighbor table.
     */
    private _findNeighborEntry(node: MatterNode, unknownExtAddrHex: string): ThreadNeighbor | null {
        const neighbors = parseNeighborTable(node);
        for (const neighbor of neighbors) {
            const neighborHex = this._formatExtAddress(neighbor.extAddress);
            if (neighborHex === unknownExtAddrHex) {
                return neighbor;
            }
        }
        return null;
    }

    private _renderUnknownDeviceInfo(deviceId: string): TemplateResult | typeof nothing {
        const unknown = this.unknownDevices.get(deviceId);
        if (!unknown) {
            return html`<p>Unknown device data not available</p>`;
        }

        return html`
            <div class="section">
                <h4>Unknown Device</h4>
                <div class="info-row">
                    <span class="label">Type:</span>
                    <span class="value">${unknown.isRouter ? "Router (external)" : "End Device (external)"}</span>
                </div>
                <div class="info-row">
                    <span class="label">Extended Address:</span>
                    <span class="value mono">${unknown.extAddressHex}</span>
                </div>
                ${unknown.bestRssi !== null
                    ? html`
                          <div class="info-row">
                              <span class="label">Best RSSI:</span>
                              <span class="value">${unknown.bestRssi} dBm</span>
                          </div>
                      `
                    : nothing}
            </div>

            ${unknown.seenBy.length > 0
                ? html`
                      <md-divider></md-divider>
                      <div class="section">
                          <h4>Neighbors (${unknown.seenBy.length})</h4>
                          <div class="neighbors-list">
                              ${unknown.seenBy.map(nodeId => {
                                  const node = this.nodes[nodeId.toString()];
                                  if (!node) return nothing;

                                  // Find the neighbor entry to get RSSI/LQI
                                  const neighborEntry = this._findNeighborEntry(node, unknown.extAddressHex);
                                  const signalColor = neighborEntry ? getSignalColor(neighborEntry) : "#999";
                                  const rssi = neighborEntry?.avgRssi ?? neighborEntry?.lastRssi ?? null;
                                  const lqi = neighborEntry?.lqi;

                                  return html`
                                      <div
                                          class="neighbor-item clickable"
                                          @click=${() => this._handleSelectNode(nodeId)}
                                      >
                                          ${neighborEntry
                                              ? html`
                                                    <ha-svg-icon
                                                        .path=${this._getSignalIcon(neighborEntry)}
                                                        style="--icon-primary-color: ${signalColor}"
                                                    ></ha-svg-icon>
                                                `
                                              : nothing}
                                          <div class="neighbor-info">
                                              <div class="neighbor-name">Node ${nodeId}: ${getDeviceName(node)}</div>
                                              ${neighborEntry
                                                  ? html`
                                                        <div class="neighbor-signal">
                                                            ${rssi !== null ? html`RSSI: ${rssi} dBm, ` : nothing}
                                                            ${lqi !== undefined ? html`LQI: ${lqi}` : nothing}
                                                        </div>
                                                    `
                                                  : nothing}
                                          </div>
                                      </div>
                                  `;
                              })}
                          </div>
                      </div>
                  `
                : nothing}

            <md-divider></md-divider>
            <div class="section">
                <p class="hint-text">
                    This device appears in Thread neighbor tables but is not commissioned to this fabric. It may be a
                    Thread Border Router or a device from another Matter ecosystem.
                </p>
            </div>
        `;
    }

    private _renderWiFiAccessPointInfo(apId: string): TemplateResult | typeof nothing {
        const ap = this.wifiAccessPoints.get(apId);
        if (!ap) {
            return html`<p>Access point data not available</p>`;
        }

        return html`
            <div class="section">
                <h4>WiFi Access Point</h4>
                <div class="info-row">
                    <span class="label">BSSID:</span>
                    <span class="value mono">${ap.bssid}</span>
                </div>
                <div class="info-row">
                    <span class="label">Connected devices:</span>
                    <span class="value">${ap.connectedNodes.length}</span>
                </div>
            </div>
            ${ap.connectedNodes.length > 0
                ? html`
                      <md-divider></md-divider>
                      <div class="section">
                          <h4>Connected Nodes</h4>
                          <div class="connected-nodes-list">
                              ${ap.connectedNodes.map(nodeId => {
                                  const node = this.nodes[nodeId.toString()];
                                  if (!node) return nothing;
                                  const wifiDiag = getWiFiDiagnostics(node);
                                  const signalColor = getSignalColorFromRssi(wifiDiag.rssi);

                                  return html`
                                      <div
                                          class="connected-node-item clickable"
                                          @click=${() => this._handleSelectNode(nodeId)}
                                      >
                                          <div class="node-name">Node ${nodeId}: ${getDeviceName(node)}</div>
                                          ${wifiDiag.rssi !== null
                                              ? html`<div class="node-signal" style="color: ${signalColor}">
                                                    ${wifiDiag.rssi} dBm
                                                </div>`
                                              : nothing}
                                      </div>
                                  `;
                              })}
                          </div>
                      </div>
                  `
                : nothing}
            <md-divider></md-divider>
            <div class="section">
                <p class="hint-text">
                    This is a WiFi access point that Matter devices connect to. It is not a Matter device itself.
                </p>
            </div>
        `;
    }

    override render() {
        if (this.selectedNodeId === null) {
            return html`
                <div class="empty-state">
                    <p>Select a device to view details</p>
                </div>
            `;
        }

        // Check if this is an unknown Thread device
        const isUnknown = typeof this.selectedNodeId === "string" && this.selectedNodeId.startsWith("unknown_");

        if (isUnknown) {
            return html`
                <div class="details-panel">
                    <div class="header">
                        <h3>External Device</h3>
                        <button class="close-button" @click=${this._handleClose} aria-label="Close details panel">
                            <ha-svg-icon .path=${mdiClose}></ha-svg-icon>
                        </button>
                    </div>
                    <div class="content">${this._renderUnknownDeviceInfo(this.selectedNodeId as string)}</div>
                </div>
            `;
        }

        // Check if this is a WiFi access point
        const isAccessPoint = typeof this.selectedNodeId === "string" && this.selectedNodeId.startsWith("ap_");

        if (isAccessPoint) {
            return html`
                <div class="details-panel">
                    <div class="header">
                        <h3>Access Point</h3>
                        <button class="close-button" @click=${this._handleClose} aria-label="Close details panel">
                            <ha-svg-icon .path=${mdiClose}></ha-svg-icon>
                        </button>
                    </div>
                    <div class="content">${this._renderWiFiAccessPointInfo(this.selectedNodeId as string)}</div>
                </div>
            `;
        }

        const node = this.nodes[this.selectedNodeId.toString()];
        if (!node) {
            return html`
                <div class="empty-state">
                    <p>Device not found</p>
                </div>
            `;
        }

        return html`
            <div class="details-panel">
                <div class="header">
                    <h3>Node ${this.selectedNodeId}</h3>
                    <button class="close-button" @click=${this._handleClose} aria-label="Close details panel">
                        <ha-svg-icon .path=${mdiClose}></ha-svg-icon>
                    </button>
                </div>
                <div class="content">${this._renderNodeInfo(node)}</div>
                <div class="footer">
                    <a href="#node/${this.selectedNodeId}" class="view-link">View node details</a>
                </div>
            </div>
        `;
    }

    static override styles = css`
        :host {
            display: block;
            height: 100%;
        }

        .empty-state {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--md-sys-color-on-surface-variant, #666);
            text-align: center;
            padding: 24px;
        }

        .details-panel {
            display: flex;
            flex-direction: column;
            height: 100%;
            background-color: var(--md-sys-color-surface, #fff);
            border-radius: 8px;
            border: 1px solid var(--md-sys-color-outline-variant, #ccc);
            overflow: hidden;
        }

        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background-color: var(--md-sys-color-surface-container, #f5f5f5);
            border-bottom: 1px solid var(--md-sys-color-outline-variant, #ccc);
        }

        .header h3 {
            margin: 0;
            font-size: 1rem;
            font-weight: 500;
            color: var(--md-sys-color-on-surface, #333);
        }

        .close-button {
            background: none;
            border: none;
            padding: 4px;
            cursor: pointer;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .close-button:hover {
            background-color: var(--md-sys-color-surface-container-high, #e8e8e8);
        }

        .close-button ha-svg-icon {
            --icon-primary-color: var(--md-sys-color-on-surface-variant, #666);
        }

        .content {
            flex: 1;
            overflow-y: auto;
            padding: 0;
        }

        .section {
            padding: 16px;
        }

        .section h4 {
            margin: 0 0 12px 0;
            font-size: 0.875rem;
            font-weight: 500;
            color: var(--md-sys-color-primary, #6200ee);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            font-size: 0.875rem;
        }

        .label {
            color: var(--md-sys-color-on-surface-variant, #666);
        }

        .value {
            color: var(--md-sys-color-on-surface, #333);
            font-weight: 500;
            text-align: right;
            word-break: break-all;
            max-width: 60%;
        }

        .value.mono {
            font-family: monospace;
            font-size: 0.8rem;
        }

        .status-online {
            color: #4caf50;
        }

        .status-offline {
            color: var(--danger-color, #f44336);
        }

        .neighbors-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .neighbor-item {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 8px;
            background-color: var(--md-sys-color-surface-container, #f5f5f5);
            border-radius: 4px;
        }

        .neighbor-item.clickable {
            cursor: pointer;
            transition: background-color 0.15s;
        }

        .neighbor-item.clickable:hover {
            background-color: var(--md-sys-color-surface-container-high, #e8e8e8);
        }

        .neighbor-item ha-svg-icon {
            flex-shrink: 0;
            margin-top: 2px;
        }

        .neighbor-info {
            flex: 1;
            min-width: 0;
        }

        .neighbor-name {
            font-size: 0.875rem;
            color: var(--md-sys-color-on-surface, #333);
            word-break: break-word;
        }

        .neighbor-signal {
            font-size: 0.75rem;
            color: var(--md-sys-color-on-surface-variant, #666);
            margin-top: 2px;
        }

        .direction-hint {
            font-style: italic;
            opacity: 0.8;
        }

        .footer {
            padding: 12px 16px;
            border-top: 1px solid var(--md-sys-color-outline-variant, #ccc);
            text-align: center;
        }

        .view-link {
            color: var(--md-sys-color-primary, #6200ee);
            text-decoration: none;
            font-size: 0.875rem;
            font-weight: 500;
        }

        .view-link:hover {
            text-decoration: underline;
        }

        md-divider {
            --md-divider-color: var(--md-sys-color-outline-variant, #ccc);
        }

        .hint-text {
            font-size: 0.8rem;
            color: var(--md-sys-color-on-surface-variant, #666);
            line-height: 1.4;
            margin: 0;
        }

        .connected-nodes-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .connected-node-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px;
            background-color: var(--md-sys-color-surface-container, #f5f5f5);
            border-radius: 4px;
        }

        .connected-node-item.clickable {
            cursor: pointer;
            transition: background-color 0.15s;
        }

        .connected-node-item.clickable:hover {
            background-color: var(--md-sys-color-surface-container-high, #e8e8e8);
        }

        .connected-node-item .node-name {
            font-size: 0.875rem;
            color: var(--md-sys-color-on-surface, #333);
            word-break: break-word;
        }

        .connected-node-item .node-signal {
            font-size: 0.8rem;
            font-weight: 500;
            flex-shrink: 0;
            margin-left: 8px;
        }
    `;
}
