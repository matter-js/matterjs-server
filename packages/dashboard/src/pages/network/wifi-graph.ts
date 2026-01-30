/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { html } from "lit";
import { customElement } from "lit/decorators.js";
import { BaseNetworkGraph } from "./base-network-graph.js";
import { createNodeIconDataUrl, createWiFiRouterIconDataUrl } from "./device-icons.js";
import type { NetworkGraphEdge, NetworkGraphNode } from "./network-types.js";
import {
    categorizeDevices,
    getDeviceName,
    getNetworkType,
    getSignalColorFromRssi,
    getWiFiDiagnostics,
} from "./network-utils.js";

declare global {
    interface HTMLElementTagNameMap {
        "wifi-graph": WiFiGraph;
    }
}

/** WiFi access point (router) node info */
interface WiFiAccessPoint {
    bssid: string;
    connectedNodes: number[];
}

@customElement("wifi-graph")
export class WiFiGraph extends BaseNetworkGraph {
    /** Cache of access points for the current render */
    private _accessPoints: Map<string, WiFiAccessPoint> = new Map();

    /** Get access points map for use by details panel */
    public get wifiAccessPointsMap(): Map<string, { bssid: string; connectedNodes: number[] }> {
        return this._accessPoints;
    }

    /**
     * Override physics for WiFi star topology - needs stronger cluster separation.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected override _getPhysicsOptions(): any {
        return {
            enabled: true,
            solver: "forceAtlas2Based",
            forceAtlas2Based: {
                gravitationalConstant: -120, // Stronger repulsion for star topology
                centralGravity: 0.003, // Weaker central pull
                springLength: 100, // Shorter springs keep devices close to their AP
                springConstant: 0.12, // Stronger springs
                damping: 0.4,
                avoidOverlap: 0.8,
            },
            stabilization: {
                enabled: true,
                iterations: 300,
                updateInterval: 25,
            },
        };
    }

    protected override _updateGraph(): void {
        if (!this._nodesDataSet || !this._edgesDataSet) return;

        // Clear stored edge colors since we're rebuilding edges
        this._clearOriginalEdgeColors();

        // Get WiFi and Ethernet devices
        const categorized = categorizeDevices(this.nodes);
        const wifiNodeIds = [...categorized.wifi, ...categorized.ethernet];

        if (wifiNodeIds.length === 0) {
            this._nodesDataSet.clear();
            this._edgesDataSet.clear();
            this._accessPoints.clear();
            return;
        }

        // Build access points map from BSSID, keyed by apId
        this._accessPoints.clear();

        for (const nodeId of wifiNodeIds) {
            const node = this.nodes[nodeId.toString()];
            if (!node) continue;

            const wifiDiag = getWiFiDiagnostics(node);
            if (wifiDiag.bssid) {
                const apId = `ap_${wifiDiag.bssid.replace(/:/g, "")}`;
                if (!this._accessPoints.has(apId)) {
                    this._accessPoints.set(apId, {
                        bssid: wifiDiag.bssid,
                        connectedNodes: [],
                    });
                }
                this._accessPoints.get(apId)!.connectedNodes.push(nodeId);
            }
        }

        // Create graph nodes
        const graphNodes: NetworkGraphNode[] = [];
        const graphEdges: NetworkGraphEdge[] = [];

        // Add access point nodes
        for (const [apId, ap] of this._accessPoints) {
            const bssid = ap.bssid;
            const isSelected = apId === this._selectedNodeId;

            graphNodes.push({
                id: apId,
                label: `AP ${bssid.slice(-8)}`,
                image: createWiFiRouterIconDataUrl(isSelected),
                shape: "image",
                networkType: "wifi",
                isUnknown: true, // Mark as infrastructure
            });
        }

        // Add device nodes and edges
        let edgeIndex = 0;
        for (const nodeId of wifiNodeIds) {
            const node = this.nodes[nodeId.toString()];
            if (!node) continue;

            const isSelected = nodeId === this._selectedNodeId;
            const isOffline = node.available === false;
            const networkType = getNetworkType(node);
            const wifiDiag = getWiFiDiagnostics(node);

            graphNodes.push({
                id: nodeId,
                label: getDeviceName(node),
                image: createNodeIconDataUrl(node, undefined, isSelected, isOffline),
                shape: "image",
                networkType: networkType,
                offline: isOffline,
            });

            // Create edge to access point if we have BSSID
            if (wifiDiag.bssid) {
                const apId = `ap_${wifiDiag.bssid.replace(/:/g, "")}`;
                const signalColor = getSignalColorFromRssi(wifiDiag.rssi);

                graphEdges.push({
                    id: `edge_${edgeIndex++}`,
                    from: nodeId,
                    to: apId,
                    color: {
                        color: signalColor,
                        highlight: signalColor,
                    },
                    width: 2,
                    title: wifiDiag.rssi !== null ? `RSSI: ${wifiDiag.rssi} dBm` : "RSSI: Unknown",
                });
            }
        }

        // Update datasets
        const existingNodeIds = this._nodesDataSet.getIds();
        const newNodeIds = new Set(graphNodes.map(n => n.id));

        const nodesToRemove = existingNodeIds.filter((id: string | number) => !newNodeIds.has(id));
        if (nodesToRemove.length > 0) {
            this._nodesDataSet.remove(nodesToRemove);
        }

        this._nodesDataSet.update(graphNodes);
        this._edgesDataSet.clear();
        this._edgesDataSet.add(graphEdges);
    }

    override render() {
        const categorized = categorizeDevices(this.nodes);
        const wifiCount = categorized.wifi.length + categorized.ethernet.length;

        if (wifiCount === 0) {
            return html`
                <div class="empty-state">
                    <p>No WiFi devices found</p>
                    <p class="hint">WiFi devices will appear here once commissioned</p>
                </div>
            `;
        }

        return html`<div class="graph-container"></div>`;
    }
}
