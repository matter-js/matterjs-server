/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import "@material/web/divider/divider";
import { isTestNodeId, type BorderRouterEntry, type MatterClient, type MatterNode } from "@matter-server/ws-client";
import {
    mdiClose,
    mdiLinkVariantOff,
    mdiRefresh,
    mdiSignalCellular1,
    mdiSignalCellular2,
    mdiSignalCellular3,
} from "@mdi/js";
import { LitElement, TemplateResult, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { clientContext } from "../../client/client-context.js";
import "../../components/ha-svg-icon";
import { formatNodeAddressFromAny, getEffectiveFabricIndex } from "../../util/format_hex.js";
import { reducedMotionStyles } from "../../util/shared-styles.js";
import type { SignalLevel, ThreadEdgePair, ThreadExternalDevice } from "./network-types.js";
import type { NodeConnection } from "./network-utils.js";
import {
    decodeMeshcopStateBitmap,
    getDeviceName,
    getNetworkType,
    getNodeConnectionsFromPairs,
    getRoutableDestinationsCount,
    getSignalColorFromRssi,
    getThreadChannel,
    getThreadExtendedAddressHex,
    getThreadRole,
    getThreadRoleName,
    getWiFiDiagnostics,
    getWiFiSecurityTypeName,
    getWiFiVersionName,
    stripMdnsHostname,
} from "./network-utils.js";
import "./update-connections-dialog.js";

declare global {
    interface HTMLElementTagNameMap {
        "network-details": NetworkDetails;
    }
}

@customElement("network-details")
export class NetworkDetails extends LitElement {
    @property()
    public selectedNodeId: number | string | null = null;

    @property({ type: Boolean })
    public hideOfflineNodes = false;

    @property({ type: Boolean })
    public hideWeakSignalEdges = false;

    @property({ type: Boolean })
    public hideMediumSignalEdges = false;

    @property({ type: Boolean })
    public hideStrongSignalEdges = false;

    @property({ type: Object })
    public nodes: Record<string, MatterNode> = {};

    @property({ type: Object })
    public unknownDevices: ReadonlyMap<string, ThreadExternalDevice> = new Map();

    @property({ attribute: false })
    public borderRouters: ReadonlyMap<string, BorderRouterEntry> = new Map();

    @property({ type: Object })
    public wifiAccessPoints: Map<string, { bssid: string; connectedNodes: string[] }> = new Map();

    @property({ type: Object })
    public threadEdgePairs: Map<string, ThreadEdgePair> = new Map();

    @consume({ context: clientContext })
    private client!: MatterClient;

    @state()
    private _showUpdateDialog: boolean = false;

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

    /** Handle keyboard interaction for clickable elements (Enter/Space activates) */
    private _handleKeyDown(event: KeyboardEvent, nodeId: number | string): void {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            this._handleSelectNode(nodeId);
        }
    }

    private _getSignalIcon(level: SignalLevel): string {
        switch (level) {
            case "strong":
                return mdiSignalCellular3;
            case "medium":
                return mdiSignalCellular2;
            case "weak":
                return mdiSignalCellular1;
            case "none":
                return mdiLinkVariantOff;
        }
    }

    /**
     * Format a node ID as hex for Matter log format display.
     * Returns format like "@1:7b" for node ID 123.
     */
    private _formatNodeIdHex(nodeId: number | bigint | string): string {
        // For unknown devices (not in nodes), we can't determine if it's a test node,
        // so we use the fabric index if available
        const node = this.nodes[String(nodeId)];
        const isTestNode = node ? isTestNodeId(node.node_id) : false;
        const fabricIndex = getEffectiveFabricIndex(this.client?.serverInfo?.fabric_index, isTestNode);
        return formatNodeAddressFromAny(fabricIndex, nodeId);
    }

    private _getExternalDeviceLabel(conn: NodeConnection): TemplateResult {
        const device = this.unknownDevices.get(String(conn.connectedNodeId));
        if (device?.kind === "br" && device.hostname) {
            return html`${stripMdnsHostname(device.hostname)}`;
        }
        return html`External: <span class="mono">${conn.extAddressHex}</span>`;
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
        // Get connections from edge pairs with the same filter pipeline as the graph
        const nodeId = String(node.node_id);
        const connections = getNodeConnectionsFromPairs(nodeId, this.threadEdgePairs, this.nodes, {
            hideOfflineNodes: this.hideOfflineNodes,
            hideWeakSignalEdges: this.hideWeakSignalEdges,
            hideMediumSignalEdges: this.hideMediumSignalEdges,
            hideStrongSignalEdges: this.hideStrongSignalEdges,
        });

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
                <div class="info-row">
                    <span class="label">Direct neighbors:</span>
                    <span class="value">${connections.length}</span>
                </div>
                ${(() => {
                    const routableCount = getRoutableDestinationsCount(node);
                    return routableCount > 0
                        ? html`
                              <div class="info-row">
                                  <span class="label">Routable destinations:</span>
                                  <span class="value">${routableCount}</span>
                              </div>
                          `
                        : nothing;
                })()}
            </div>

            ${connections.length > 0
                ? html`
                      <md-divider></md-divider>
                      <div class="section">
                          <h4>Connections (${connections.length})</h4>
                          <div class="neighbors-list">
                              ${connections
                                  .toSorted((a, b) => {
                                      const score = (conn: NodeConnection): number => {
                                          if (conn.rssi !== null && conn.rssi !== undefined) {
                                              return conn.rssi;
                                          }
                                          if (conn.lqi !== null && conn.lqi !== undefined) {
                                              return conn.lqi;
                                          }
                                          return -Infinity;
                                      };
                                      return score(b) - score(a);
                                  })
                                  .map((conn: NodeConnection) => {
                                      return html`
                                          <div
                                              class="neighbor-item clickable"
                                              role="button"
                                              tabindex="0"
                                              @click=${() => this._handleSelectNode(conn.connectedNodeId)}
                                              @keydown=${(e: KeyboardEvent) =>
                                                  this._handleKeyDown(e, conn.connectedNodeId)}
                                          >
                                              <ha-svg-icon
                                                  .path=${this._getSignalIcon(conn.signalLevel)}
                                                  style="--icon-primary-color: ${conn.signalColor}"
                                              ></ha-svg-icon>
                                              <div class="neighbor-info">
                                                  <div class="neighbor-name">
                                                      ${conn.connectedNode
                                                          ? html`Node ${conn.connectedNodeId}
                                                                <span class="node-id-hex"
                                                                    >${this._formatNodeIdHex(
                                                                        conn.connectedNodeId,
                                                                    )}</span
                                                                >: ${getDeviceName(conn.connectedNode)}`
                                                          : this._getExternalDeviceLabel(conn)}
                                                  </div>
                                                  <div class="neighbor-signal">
                                                      ${conn.rssi !== null
                                                          ? html`RSSI: ${conn.rssi} dBm`
                                                          : nothing}${conn.rssi !== null && conn.lqi !== null
                                                          ? ", "
                                                          : nothing}${conn.lqi !== null
                                                          ? html`LQI: ${conn.lqi}`
                                                          : nothing}${conn.bidirectionalLqi !== undefined
                                                          ? html`<span class="route-info"
                                                                >, Bidir: ${conn.bidirectionalLqi}</span
                                                            >`
                                                          : nothing}${conn.pathCost !== undefined
                                                          ? html`<span class="route-info"
                                                                >, Cost: ${conn.pathCost}</span
                                                            >`
                                                          : nothing}
                                                      ${conn.isReverseOnly
                                                          ? html`
                                                                <span
                                                                    class="direction-hint reverse-only"
                                                                    title="Peer reports this node but this node has no matching neighbor-table entry. Possible one-way visibility (range, TX power, or stale neighbor table)."
                                                                    >← one-way</span
                                                                >
                                                            `
                                                          : !conn.isOutgoing
                                                            ? html` <span class="direction-hint">(reverse)</span> `
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

    private _renderUnknownDeviceInfo(deviceId: string): TemplateResult | typeof nothing {
        const device = this.unknownDevices.get(deviceId);
        if (!device || device.kind !== "unknown") {
            return html` <p>Unknown device data not available</p> `;
        }
        const unknown = device;

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
                ${unknown.networkName !== undefined
                    ? html`
                          <div class="info-row">
                              <span class="label">Thread Network:</span>
                              <span class="value">${unknown.networkName}</span>
                          </div>
                      `
                    : nothing}
                ${unknown.extendedPanIdHex !== undefined
                    ? html`
                          <div class="info-row">
                              <span class="label">Extended PAN ID:</span>
                              <span class="value mono">${unknown.extendedPanIdHex}</span>
                          </div>
                      `
                    : nothing}
                ${unknown.bestRssi !== null
                    ? html`
                          <div class="info-row">
                              <span class="label">Best RSSI:</span>
                              <span class="value">${unknown.bestRssi} dBm</span>
                          </div>
                      `
                    : nothing}
            </div>

            ${this._renderExternalDeviceNeighbors(deviceId)}

            <md-divider></md-divider>
            <div class="section">
                <p class="hint-text">
                    This device appears in Thread neighbor tables but is not commissioned to this fabric. It may be a
                    Thread Border Router whose Thread radio MAC differs from its MeshCoP border-agent ID (common with
                    Apple and Aqara), or a device from another Matter ecosystem.
                </p>
            </div>
        `;
    }

    /**
     * Neighbor list shared by external-device panels (unknown + BR). Uses the
     * same edge pairs as the graph so panel and graph agree on which links
     * survive filtering. Sorted by best RSSI/LQI signal, descending.
     */
    private _renderExternalDeviceNeighbors(deviceId: string): TemplateResult | typeof nothing {
        const connections = getNodeConnectionsFromPairs(deviceId, this.threadEdgePairs, this.nodes, {
            hideOfflineNodes: this.hideOfflineNodes,
            hideWeakSignalEdges: this.hideWeakSignalEdges,
            hideMediumSignalEdges: this.hideMediumSignalEdges,
            hideStrongSignalEdges: this.hideStrongSignalEdges,
        });

        if (connections.length === 0) return nothing;

        return html`
            <md-divider></md-divider>
            <div class="section">
                <h4>Neighbors (${connections.length})</h4>
                <div class="neighbors-list">
                    ${connections
                        .toSorted((a, b) => {
                            const score = (conn: NodeConnection): number => {
                                if (conn.rssi !== null && conn.rssi !== undefined) return conn.rssi;
                                if (conn.lqi !== null && conn.lqi !== undefined) return conn.lqi;
                                return -Infinity;
                            };
                            return score(b) - score(a);
                        })
                        .map((conn: NodeConnection) => {
                            if (!conn.connectedNode) return nothing;

                            return html`
                                <div
                                    class="neighbor-item clickable"
                                    role="button"
                                    tabindex="0"
                                    @click=${() => this._handleSelectNode(conn.connectedNodeId)}
                                    @keydown=${(e: KeyboardEvent) => this._handleKeyDown(e, conn.connectedNodeId)}
                                >
                                    <ha-svg-icon
                                        .path=${this._getSignalIcon(conn.signalLevel)}
                                        style="--icon-primary-color: ${conn.signalColor}"
                                    ></ha-svg-icon>
                                    <div class="neighbor-info">
                                        <div class="neighbor-name">
                                            Node ${conn.connectedNodeId}
                                            <span class="node-id-hex"
                                                >${this._formatNodeIdHex(conn.connectedNodeId)}</span
                                            >: ${getDeviceName(conn.connectedNode)}
                                        </div>
                                        <div class="neighbor-signal">
                                            ${conn.rssi !== null ? html`RSSI: ${conn.rssi} dBm, ` : nothing}
                                            ${conn.lqi !== null ? html`LQI: ${conn.lqi}` : nothing}
                                        </div>
                                    </div>
                                </div>
                            `;
                        })}
                </div>
            </div>
        `;
    }

    /**
     * Identity rows for a Border Router (network name, vendor, model, Thread version, ext address).
     * Caller controls the surrounding <div class="section"> + heading.
     */
    private _renderBorderRouterIdentityRows(br: BorderRouterEntry, includeExtAddr: boolean): TemplateResult {
        return html`
            ${br.networkName
                ? html`
                      <div class="info-row">
                          <span class="label">Network name:</span>
                          <span class="value">${br.networkName}</span>
                      </div>
                  `
                : nothing}
            ${br.vendorName
                ? html`
                      <div class="info-row">
                          <span class="label">Vendor:</span>
                          <span class="value">${br.vendorName}</span>
                      </div>
                  `
                : nothing}
            ${br.modelName
                ? html`
                      <div class="info-row">
                          <span class="label">Model:</span>
                          <span class="value">${br.modelName}</span>
                      </div>
                  `
                : nothing}
            ${br.threadVersion
                ? html`
                      <div class="info-row">
                          <span class="label">Thread version:</span>
                          <span class="value">${br.threadVersion}</span>
                      </div>
                  `
                : nothing}
            ${includeExtAddr
                ? html`
                      <div class="info-row">
                          <span class="label">Extended Address:</span>
                          <span class="value mono">${br.extAddressHex}</span>
                      </div>
                  `
                : nothing}
        `;
    }

    /**
     * Render the MeshCoP state bitmap as decoded fields (BBR role, connection mode, Thread
     * interface status, availability, ePSKc) plus the raw hex underneath. Reserved values are
     * rendered as numeric so a future spec extension stays visible.
     */
    private _renderStateBitmap(hex: string | undefined): TemplateResult | typeof nothing {
        if (hex === undefined) return nothing;
        const decoded = decodeMeshcopStateBitmap(hex);
        if (decoded === undefined) {
            return html`
                <div class="info-row">
                    <span class="label">State bitmap:</span>
                    <span class="value mono">${hex}</span>
                </div>
            `;
        }

        const stateParts = new Array<string>();
        stateParts.push(decoded.bbr ? `BBR (${decoded.bbrFunction ?? "?"})` : "not BBR");
        if (decoded.threadRole !== undefined) {
            stateParts.push(`Thread ${decoded.threadRole}`);
        }
        if (decoded.threadInterfaceStatus !== undefined) {
            stateParts.push(decoded.threadInterfaceStatus);
        }

        return html`
            <div class="info-row">
                <span class="label">State:</span>
                <span class="value">${stateParts.join(", ")}</span>
            </div>
            <div class="info-row">
                <span class="label">Connection:</span>
                <span class="value">${decoded.connectionMode ?? `reserved (${decoded.connectionModeValue})`}</span>
            </div>
            <div class="info-row">
                <span class="label">Availability:</span>
                <span class="value">${decoded.availability ?? `reserved (${decoded.availabilityValue})`}</span>
            </div>
            <div class="info-row">
                <span class="label">ePSKc:</span>
                <span class="value">${decoded.epskcSupported ? "supported" : "not supported"}</span>
            </div>
            ${decoded.multiAilStateValue !== 0
                ? html`
                      <div class="info-row">
                          <span class="label">Multi-AIL:</span>
                          <span class="value">
                              ${decoded.multiAilState ?? `reserved (${decoded.multiAilStateValue})`}
                          </span>
                      </div>
                  `
                : nothing}
            <div class="info-row">
                <span class="label">State bitmap (raw):</span>
                <span class="value mono">${hex}</span>
            </div>
        `;
    }

    /**
     * Network-info rows for a Border Router (extended PAN ID, partition, timestamps, state, domain, agent ID).
     * Returns nothing if no fields are populated, so the caller can skip the surrounding section.
     */
    private _renderBorderRouterNetworkRows(br: BorderRouterEntry): TemplateResult | typeof nothing {
        const hasAny =
            br.extendedPanIdHex !== undefined ||
            br.partitionIdHex !== undefined ||
            br.activeTimestampHex !== undefined ||
            br.stateBitmapHex !== undefined ||
            br.domainName !== undefined ||
            br.borderAgentIdHex !== undefined;
        if (!hasAny) return nothing;

        return html`
            ${br.extendedPanIdHex
                ? html`
                      <div class="info-row">
                          <span class="label">Extended PAN ID:</span>
                          <span class="value mono">${br.extendedPanIdHex}</span>
                      </div>
                  `
                : nothing}
            ${br.partitionIdHex
                ? html`
                      <div class="info-row">
                          <span class="label">Partition ID:</span>
                          <span class="value mono">${br.partitionIdHex}</span>
                      </div>
                  `
                : nothing}
            ${br.activeTimestampHex
                ? html`
                      <div class="info-row">
                          <span class="label">Active timestamp:</span>
                          <span class="value mono">${br.activeTimestampHex}</span>
                      </div>
                  `
                : nothing}
            ${this._renderStateBitmap(br.stateBitmapHex)}
            ${br.domainName
                ? html`
                      <div class="info-row">
                          <span class="label">Domain:</span>
                          <span class="value">${br.domainName}</span>
                      </div>
                  `
                : nothing}
            ${br.borderAgentIdHex
                ? html`
                      <div class="info-row">
                          <span class="label">Border agent ID:</span>
                          <span class="value mono">${br.borderAgentIdHex}</span>
                      </div>
                  `
                : nothing}
        `;
    }

    /**
     * Address rows for a Border Router (hostname, IPs, ports, sources).
     */
    private _renderBorderRouterAddressRows(br: BorderRouterEntry): TemplateResult | typeof nothing {
        const hasAny =
            br.hostname !== undefined ||
            br.addresses.length > 0 ||
            br.meshcopPort !== undefined ||
            br.trelPort !== undefined ||
            br.sources.length > 0;
        if (!hasAny) return nothing;

        return html`
            ${br.hostname
                ? html`
                      <div class="info-row">
                          <span class="label">Hostname:</span>
                          <span class="value mono">${br.hostname}</span>
                      </div>
                  `
                : nothing}
            ${br.addresses.map(
                addr => html`
                    <div class="info-row">
                        <span class="label">Address:</span>
                        <span class="value mono">${addr}</span>
                    </div>
                `,
            )}
            ${br.meshcopPort !== undefined
                ? html`
                      <div class="info-row">
                          <span class="label">meshcop port:</span>
                          <span class="value">${br.meshcopPort}</span>
                      </div>
                  `
                : nothing}
            ${br.trelPort !== undefined
                ? html`
                      <div class="info-row">
                          <span class="label">trel port:</span>
                          <span class="value">${br.trelPort}</span>
                      </div>
                  `
                : nothing}
            ${br.sources.length > 0
                ? html`
                      <div class="info-row">
                          <span class="label">Sources:</span>
                          <span class="value">${br.sources.join(", ")}</span>
                      </div>
                  `
                : nothing}
        `;
    }

    private _renderBorderRouterInfo(deviceId: string): TemplateResult | typeof nothing {
        const device = this.unknownDevices.get(deviceId);
        if (!device || device.kind !== "br") {
            return html` <p>Border router data not available</p> `;
        }
        const br = device;
        const networkRows = this._renderBorderRouterNetworkRows(br);
        const addressRows = this._renderBorderRouterAddressRows(br);

        return html`
            <div class="section">
                <h4>Border Router</h4>
                ${this._renderBorderRouterIdentityRows(br, true)}
                ${br.bestRssi !== null
                    ? html`
                          <div class="info-row">
                              <span class="label">Best RSSI:</span>
                              <span class="value">${br.bestRssi} dBm</span>
                          </div>
                      `
                    : nothing}
            </div>

            ${networkRows !== nothing
                ? html`
                      <md-divider></md-divider>
                      <div class="section">
                          <h4>Thread Network</h4>
                          ${networkRows}
                      </div>
                  `
                : nothing}
            ${addressRows !== nothing
                ? html`
                      <md-divider></md-divider>
                      <div class="section">
                          <h4>Addresses</h4>
                          ${addressRows}
                      </div>
                  `
                : nothing}
            ${this._renderExternalDeviceNeighbors(deviceId)}
        `;
    }

    /**
     * Determine if update connections button should be shown.
     */
    private _canUpdateConnections(): boolean {
        if (this.selectedNodeId === null) return false;

        // WiFi APs: no update possible (not a Matter device)
        const isAccessPoint = typeof this.selectedNodeId === "string" && this.selectedNodeId.startsWith("ap_");
        if (isAccessPoint) return false;

        // External devices (unknown or BR) gate on having online seenBy nodes
        const isExternal =
            typeof this.selectedNodeId === "string" &&
            (this.selectedNodeId.startsWith("unknown_") || this.selectedNodeId.startsWith("br_"));
        if (isExternal) {
            return this._getOnlineSeenByNodes().length > 0;
        }

        // Regular nodes: check network type (no update for ethernet)
        const node = this.nodes[this.selectedNodeId.toString()];
        if (!node) return false;

        const networkType = getNetworkType(node);
        if (networkType === "ethernet" || networkType === "unknown") return false;

        return true;
    }

    /**
     * Get the type of the currently selected node for dialog variant.
     */
    private _getSelectedNodeType(): "online" | "offline" | "unknown" {
        if (
            typeof this.selectedNodeId === "string" &&
            (this.selectedNodeId.startsWith("unknown_") || this.selectedNodeId.startsWith("br_"))
        ) {
            return "unknown";
        }

        const node = this.nodes[this.selectedNodeId!.toString()];
        if (!node || node.available === false) {
            return "offline";
        }
        return "online";
    }

    /**
     * Get online neighbors for a Thread node.
     */
    private _getOnlineNeighbors(nodeId: string): string[] {
        const node = this.nodes[nodeId];
        if (!node) return [];

        const networkType = getNetworkType(node);
        if (networkType === "thread") {
            // Use edge pairs without filters to get ALL connections (for update dialog)
            const connections = getNodeConnectionsFromPairs(nodeId, this.threadEdgePairs, this.nodes);
            return connections
                .filter(conn => {
                    if (conn.isUnknown) return false;
                    return conn.connectedNode?.available === true;
                })
                .map(conn => String(conn.connectedNodeId));
        }

        // WiFi nodes don't have peer connections (just AP)
        return [];
    }

    /**
     * Get online nodes that see an unknown device.
     */
    private _getOnlineSeenByNodes(): string[] {
        if (
            typeof this.selectedNodeId !== "string" ||
            (!this.selectedNodeId.startsWith("unknown_") && !this.selectedNodeId.startsWith("br_"))
        ) {
            return [];
        }

        const device = this.unknownDevices.get(this.selectedNodeId);
        if (!device) return [];

        return device.seenBy.filter(nodeId => {
            const node = this.nodes[nodeId.toString()];
            return node?.available === true;
        });
    }

    /**
     * Get the name of the selected node for display in dialog.
     */
    private _getSelectedNodeName(): string {
        if (typeof this.selectedNodeId === "string") {
            if (this.selectedNodeId.startsWith("br_")) {
                const device = this.unknownDevices.get(this.selectedNodeId);
                if (!device || device.kind !== "br") return "Border Router";
                const label = device.networkName ?? device.vendorName ?? "Border Router";
                return `${label} (${device.extAddressHex.slice(-8)})`;
            }
            if (this.selectedNodeId.startsWith("unknown_")) {
                const device = this.unknownDevices.get(this.selectedNodeId);
                if (!device || device.kind !== "unknown") return "External Device";
                const typeLabel = device.isRouter ? "External Router" : "External Device";
                return `${typeLabel} (${device.extAddressHex.slice(-8)})`;
            }
        }

        const node = this.nodes[this.selectedNodeId!.toString()];
        return node ? getDeviceName(node) : "Unknown";
    }

    private _handleUpdateConnections(): void {
        this._showUpdateDialog = true;
    }

    private _handleDialogClose(): void {
        this._showUpdateDialog = false;
        this.dispatchEvent(
            new CustomEvent("connections-updated", {
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _renderWiFiAccessPointInfo(apId: string): TemplateResult | typeof nothing {
        const ap = this.wifiAccessPoints.get(apId);
        if (!ap) {
            return html` <p>Access point data not available</p> `;
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
                              ${ap.connectedNodes
                                  .toSorted((a, b) => {
                                      const nodeA = this.nodes[a.toString()];
                                      const nodeB = this.nodes[b.toString()];
                                      const rssiA = nodeA ? (getWiFiDiagnostics(nodeA)?.rssi ?? -Infinity) : -Infinity;
                                      const rssiB = nodeB ? (getWiFiDiagnostics(nodeB)?.rssi ?? -Infinity) : -Infinity;
                                      return rssiB - rssiA;
                                  })
                                  .map(nodeId => {
                                      const node = this.nodes[nodeId.toString()];
                                      if (!node) return nothing;
                                      const wifiDiag = getWiFiDiagnostics(node);
                                      const signalColor = getSignalColorFromRssi(wifiDiag.rssi);

                                      return html`
                                          <div
                                              class="connected-node-item clickable"
                                              role="button"
                                              tabindex="0"
                                              @click=${() => this._handleSelectNode(nodeId)}
                                              @keydown=${(e: KeyboardEvent) => this._handleKeyDown(e, nodeId)}
                                          >
                                              <div class="node-name">
                                                  Node ${nodeId}
                                                  <span class="node-id-hex">${this._formatNodeIdHex(nodeId)}</span>:
                                                  ${getDeviceName(node)}
                                              </div>
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

    /**
     * Annotation shown on a commissioned Thread node that is also a discovered Border Router.
     * Mirrors the BR Identity/Network/Addresses sections, sans the redundant ext-address row.
     */
    private _renderCommissionedNodeBorderRouterAnnotation(node: MatterNode): TemplateResult | typeof nothing {
        const xaHex = getThreadExtendedAddressHex(node);
        if (!xaHex) return nothing;
        const br = this.borderRouters.get(xaHex);
        if (!br) return nothing;

        const networkRows = this._renderBorderRouterNetworkRows(br);
        const addressRows = this._renderBorderRouterAddressRows(br);

        return html`
            <md-divider></md-divider>
            <div class="section">
                <h4>Also a Border Router</h4>
                ${this._renderBorderRouterIdentityRows(br, false)}
                ${networkRows !== nothing
                    ? html`
                          <div class="subsection-label">Thread Network</div>
                          ${networkRows}
                      `
                    : nothing}
                ${addressRows !== nothing
                    ? html`
                          <div class="subsection-label">Addresses</div>
                          ${addressRows}
                      `
                    : nothing}
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
            const onlineSeenByNodes = this._getOnlineSeenByNodes();
            return html`
                <div class="details-panel">
                    <div class="header">
                        <h3>External Device</h3>
                        <div class="header-actions">
                            ${onlineSeenByNodes.length > 0
                                ? html`
                                      <button
                                          class="action-button"
                                          @click=${this._handleUpdateConnections}
                                          aria-label="Update connection data"
                                          title="Update connection data"
                                      >
                                          <ha-svg-icon .path=${mdiRefresh}></ha-svg-icon>
                                      </button>
                                  `
                                : nothing}
                            <button class="close-button" @click=${this._handleClose} aria-label="Close details panel">
                                <ha-svg-icon .path=${mdiClose}></ha-svg-icon>
                            </button>
                        </div>
                    </div>
                    <div class="content">${this._renderUnknownDeviceInfo(this.selectedNodeId as string)}</div>
                </div>
                ${this._showUpdateDialog
                    ? html`
                          <update-connections-dialog
                              .client=${this.client}
                              .nodes=${this.nodes}
                              selectedNodeType="unknown"
                              .selectedNodeName=${this._getSelectedNodeName()}
                              .selectedNodeId=${this.selectedNodeId}
                              .onlineNeighborIds=${onlineSeenByNodes}
                              @dialog-closed=${this._handleDialogClose}
                          ></update-connections-dialog>
                      `
                    : nothing}
            `;
        }

        // Check if this is a discovered Border Router (mDNS-enriched external device)
        const borderRouterId =
            typeof this.selectedNodeId === "string" && this.selectedNodeId.startsWith("br_")
                ? this.selectedNodeId
                : null;

        if (borderRouterId !== null) {
            const onlineSeenByNodes = this._getOnlineSeenByNodes();
            return html`
                <div class="details-panel">
                    <div class="header">
                        <h3>Border Router</h3>
                        <div class="header-actions">
                            ${onlineSeenByNodes.length > 0
                                ? html`
                                      <button
                                          class="action-button"
                                          @click=${this._handleUpdateConnections}
                                          aria-label="Update connection data"
                                          title="Update connection data"
                                      >
                                          <ha-svg-icon .path=${mdiRefresh}></ha-svg-icon>
                                      </button>
                                  `
                                : nothing}
                            <button class="close-button" @click=${this._handleClose} aria-label="Close details panel">
                                <ha-svg-icon .path=${mdiClose}></ha-svg-icon>
                            </button>
                        </div>
                    </div>
                    <div class="content">${this._renderBorderRouterInfo(borderRouterId)}</div>
                </div>
                ${this._showUpdateDialog
                    ? html`
                          <update-connections-dialog
                              .client=${this.client}
                              .nodes=${this.nodes}
                              selectedNodeType="unknown"
                              .selectedNodeName=${this._getSelectedNodeName()}
                              .selectedNodeId=${this.selectedNodeId}
                              .onlineNeighborIds=${onlineSeenByNodes}
                              @dialog-closed=${this._handleDialogClose}
                          ></update-connections-dialog>
                      `
                    : nothing}
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

        const canUpdate = this._canUpdateConnections();
        const nodeType = this._getSelectedNodeType();
        const onlineNeighbors = this._getOnlineNeighbors(String(this.selectedNodeId));

        return html`
            <div class="details-panel">
                <div class="header">
                    <h3>
                        Node ${this.selectedNodeId}
                        <span class="node-id-hex">${this._formatNodeIdHex(this.selectedNodeId)}</span>
                    </h3>
                    <div class="header-actions">
                        ${canUpdate
                            ? html`
                                  <button
                                      class="action-button"
                                      @click=${this._handleUpdateConnections}
                                      aria-label="Update connection data"
                                      title="Update connection data"
                                  >
                                      <ha-svg-icon .path=${mdiRefresh}></ha-svg-icon>
                                  </button>
                              `
                            : nothing}
                        <button class="close-button" @click=${this._handleClose} aria-label="Close details panel">
                            <ha-svg-icon .path=${mdiClose}></ha-svg-icon>
                        </button>
                    </div>
                </div>
                <div class="content">
                    ${this._renderNodeInfo(node)}${this._renderCommissionedNodeBorderRouterAnnotation(node)}
                </div>
                <div class="footer">
                    <a href="#node/${this.selectedNodeId}" class="view-link">View node details</a>
                </div>
            </div>
            ${this._showUpdateDialog
                ? html`
                      <update-connections-dialog
                          .client=${this.client}
                          .nodes=${this.nodes}
                          .selectedNodeType=${nodeType}
                          .selectedNodeName=${this._getSelectedNodeName()}
                          .selectedNodeId=${this.selectedNodeId}
                          .onlineNeighborIds=${onlineNeighbors}
                          @dialog-closed=${this._handleDialogClose}
                      ></update-connections-dialog>
                  `
                : nothing}
        `;
    }

    static override styles = [
        reducedMotionStyles,
        css`
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

            .node-id-hex {
                font-size: 0.75em;
                font-weight: 400;
                color: var(--md-sys-color-on-surface-variant, #666);
                font-family: var(--monospace-font, monospace);
            }

            .header-actions {
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .action-button {
                background: none;
                border: none;
                padding: 4px;
                cursor: pointer;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .action-button:hover {
                background-color: var(--md-sys-color-surface-container-high, #e8e8e8);
            }

            .action-button ha-svg-icon {
                --icon-primary-color: var(--md-sys-color-on-surface-variant, #666);
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

            .subsection-label {
                margin: 12px 0 4px 0;
                font-size: 0.75rem;
                font-weight: 500;
                color: var(--md-sys-color-on-surface-variant, #666);
                text-transform: uppercase;
                letter-spacing: 0.4px;
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
                font-family: var(--monospace-font, monospace);
                font-size: 0.8rem;
            }

            .status-online {
                color: var(--signal-color-strong, #4caf50);
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

            .direction-hint.reverse-only {
                font-style: normal;
                font-weight: 500;
                opacity: 1;
                color: var(--md-sys-color-error, #b3261e);
                cursor: help;
            }

            .route-info {
                color: var(--md-sys-color-tertiary, #7d5260);
                font-size: 0.85em;
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
        `,
    ];
}
