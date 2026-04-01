/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { html } from "lit";
import { customElement } from "lit/decorators.js";
import { createNodeIconDataUrl, createUnknownDeviceIconDataUrl } from "../../util/device-icons.js";
import { BaseNetworkGraph } from "./base-network-graph.js";
import type { NetworkGraphEdge, NetworkGraphNode, UnknownThreadDevice } from "./network-types.js";
import {
    buildExtAddrMap,
    buildRloc16Map,
    buildThreadConnections,
    findUnknownDevices,
    getDeviceName,
    getNetworkType,
    getThreadExtendedAddressHex,
    getThreadRole,
} from "./network-utils.js";

declare global {
    interface HTMLElementTagNameMap {
        "thread-graph": ThreadGraph;
    }
}

@customElement("thread-graph")
export class ThreadGraph extends BaseNetworkGraph {
    /** Cache of unknown devices for the current render */
    private _unknownDevices: UnknownThreadDevice[] = [];

    /** Cached map of unknown devices (rebuilt in _updateGraph) */
    private _unknownDevicesMapCache: Map<
        string,
        { extAddressHex: string; isRouter: boolean; seenBy: string[]; bestRssi: number | null }
    > = new Map();

    /** Get unknown devices as a map for use by details panel */
    public get unknownDevicesMap(): Map<
        string,
        { extAddressHex: string; isRouter: boolean; seenBy: string[]; bestRssi: number | null }
    > {
        return this._unknownDevicesMapCache;
    }

    /**
     * Searches for a Thread node (known or unknown) by extended address and selects it.
     * Accepts formats like:
     * - AABBCCDDEEFF0011
     * - AA:BB:CC:DD:EE:FF:00:11
     * - 0xAABBCCDDEEFF0011
     * Returns true when a match is found.
     */
    public selectByExtendedAddress(address: string): boolean {
        const normalized = normalizeExtendedAddressInput(address);
        if (!normalized) {
            return false;
        }

        // Search commissioned Thread devices first
        for (const node of Object.values(this.nodes)) {
            if (getNetworkType(node) !== "thread") {
                continue;
            }

            const extAddressHex = getThreadExtendedAddressHex(node);
            if (extAddressHex && extAddressHex === normalized) {
                this.selectNode(String(node.node_id));
                return true;
            }
        }

        // Then search unknown/external Thread devices
        for (const [unknownId, unknown] of this._unknownDevicesMapCache) {
            if (normalizeExtendedAddressInput(unknown.extAddressHex) === normalized) {
                this.selectNode(unknownId);
                return true;
            }
        }

        return false;
    }

    protected override _updateGraph(): void {
        if (!this._nodesDataSet || !this._edgesDataSet) return;

        // Clear stored edge colors since we're rebuilding edges
        this._clearOriginalEdgeColors();

        // Filter to Thread devices only
        const threadNodes = Object.values(this.nodes).filter(node => getNetworkType(node) === "thread");

        if (threadNodes.length === 0) {
            this._nodesDataSet.clear();
            this._edgesDataSet.clear();
            this._unknownDevices = [];
            this._unknownDevicesMapCache.clear();
            return;
        }

        // Build address maps for connection matching
        const extAddrMap = buildExtAddrMap(this.nodes);
        const rloc16Map = buildRloc16Map(this.nodes);

        // Find unknown devices (seen in neighbor tables but not commissioned)
        this._unknownDevices = findUnknownDevices(this.nodes, extAddrMap, rloc16Map);

        // Rebuild the cached map
        this._unknownDevicesMapCache.clear();
        for (const device of this._unknownDevices) {
            this._unknownDevicesMapCache.set(device.id, {
                extAddressHex: device.extAddressHex,
                isRouter: device.isRouter,
                seenBy: device.seenBy,
                bestRssi: device.bestRssi,
            });
        }

        // Build Thread connections (including to unknown devices)
        const connections = buildThreadConnections(this.nodes, extAddrMap, rloc16Map, this._unknownDevices);

        // Create node data for vis.js - known Thread devices
        // Use string IDs to avoid precision loss for large bigint node IDs
        const graphNodes: NetworkGraphNode[] = threadNodes.map(node => {
            const nodeId = String(node.node_id);
            const threadRole = getThreadRole(node);
            const isSelected = nodeId === String(this._selectedNodeId);
            const isOffline = node.available === false;

            return {
                id: nodeId,
                label: getDeviceName(node),
                image: createNodeIconDataUrl(node, threadRole, isSelected, isOffline),
                shape: "image",
                networkType: "thread",
                threadRole,
                offline: isOffline,
            };
        });

        // Add external devices with question mark icons
        for (const unknown of this._unknownDevices) {
            const isSelected = unknown.id === this._selectedNodeId;
            const typeLabel = unknown.isRouter ? "External Router" : "External Device";
            graphNodes.push({
                id: unknown.id,
                label: `${typeLabel} (${unknown.extAddressHex.slice(-8)})`,
                image: createUnknownDeviceIconDataUrl(unknown.isRouter, isSelected),
                shape: "image",
                networkType: "thread",
                isUnknown: true,
            });
        }

        // Create edge data for vis.js
        const graphEdges: NetworkGraphEdge[] = connections.map((conn, index) => {
            const isToUnknown = typeof conn.toNodeId === "string" && conn.toNodeId.startsWith("unknown_");

            // Check if either endpoint is offline - connection data may be stale
            const fromNode = this.nodes[String(conn.fromNodeId)];
            const toNode = this.nodes[String(conn.toNodeId)];
            const hasOfflineEndpoint = fromNode?.available === false || toNode?.available === false;

            return {
                id: `edge_${index}`,
                from: conn.fromNodeId,
                to: conn.toNodeId,
                color: {
                    color: conn.signalColor,
                    highlight: conn.signalColor,
                },
                width: 2,
                title: conn.rssi !== null ? `RSSI: ${conn.rssi} dBm, LQI: ${conn.lqi}` : `LQI: ${conn.lqi}`,
                dashes: isToUnknown || hasOfflineEndpoint, // Dashed lines to unknown or offline devices
            };
        });

        // Update datasets
        const existingNodeIds = this._nodesDataSet.getIds();
        const newNodeIds = new Set(graphNodes.map(n => n.id));

        // Remove nodes that no longer exist
        const nodesToRemove = existingNodeIds.filter((id: string | number) => !newNodeIds.has(id));
        if (nodesToRemove.length > 0) {
            this._nodesDataSet.remove(nodesToRemove);
        }

        // Update or add nodes
        this._nodesDataSet.update(graphNodes);

        // Replace all edges (simpler than diff for edge data)
        this._edgesDataSet.clear();
        this._edgesDataSet.add(graphEdges);
    }

    override render() {
        const threadNodes = Object.values(this.nodes).filter(node => getNetworkType(node) === "thread");

        if (threadNodes.length === 0) {
            return html`
                <div class="empty-state">
                    <p>No Thread devices found</p>
                    <p class="hint">Thread devices will appear here once commissioned</p>
                </div>
            `;
        }

        return html` <div class="graph-container"></div> `;
    }
}

function normalizeExtendedAddressInput(address: string): string | null {
    const trimmed = address.trim();
    if (!trimmed) {
        return null;
    }

    const noPrefix = trimmed.startsWith("0x") || trimmed.startsWith("0X") ? trimmed.slice(2) : trimmed;
    const hexOnly = noPrefix.replace(/[^a-fA-F0-9]/g, "");

    if (hexOnly.length !== 16 || !/^[a-fA-F0-9]{16}$/.test(hexOnly)) {
        return null;
    }

    return hexOnly.toUpperCase();
}
