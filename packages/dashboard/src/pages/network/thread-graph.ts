/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BorderRouterEntry, ThreadDiagnosticsBatch, ThreadDiagnosticsNode } from "@matter-server/ws-client";
import { html } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
    createBorderRouterIconDataUrl,
    createNodeIconDataUrl,
    createUnknownDeviceIconDataUrl,
} from "../../util/device-icons.js";
import { BaseNetworkGraph } from "./base-network-graph.js";
import type {
    NetworkGraphEdge,
    NetworkGraphNode,
    ThreadConnection,
    ThreadEdgePair,
    ThreadExternalDevice,
} from "./network-types.js";
import {
    buildDiagnosticRloc16Map,
    buildExtAddrMap,
    buildMatterRloc16ByXp,
    buildRloc16Map,
    buildThreadEdgePairs,
    decodeMeshcopStateBitmap,
    findDiagnosticMeshNodes,
    findUnknownDevices,
    makeDiagnosticRloc16Resolver,
    getDeviceName,
    getEdgeSignalScore,
    getNeighborTableLength,
    getNetworkType,
    getThreadExtendedAddressHex,
    getThreadRole,
    mergeDiagnosticEdges,
    stripMdnsHostname,
} from "./network-utils.js";

declare global {
    interface HTMLElementTagNameMap {
        "thread-graph": ThreadGraph;
    }
}

/** Reason an edge is hidden in base state */
type EdgeHiddenReason = "visible" | "filter" | "dedup";

/** Stored base state for each edge (after filter+dedup, before highlight) */
interface EdgeBaseState {
    hiddenReason: EdgeHiddenReason;
    width: number;
    color: { color: string; highlight: string };
    dashes: boolean;
}

@customElement("thread-graph")
export class ThreadGraph extends BaseNetworkGraph {
    @property({ attribute: false }) borderRouters: ReadonlyMap<string, BorderRouterEntry> = new Map();

    @property({ attribute: false }) threadDiagnostics: ReadonlyMap<string, ThreadDiagnosticsBatch> = new Map();

    @property({ type: Boolean })
    public hideOfflineNodes = false;

    @property({ type: Boolean })
    public hideWeakSignalEdges = false;

    @property({ type: Boolean })
    public hideMediumSignalEdges = false;

    @property({ type: Boolean })
    public hideStrongSignalEdges = false;

    /** Cache of external Thread devices (Border Routers and unknown) for the current render */
    private _unknownDevices: ThreadExternalDevice[] = [];

    /** Cached map of external Thread devices (rebuilt in _updateGraph) */
    private _unknownDevicesMapCache: Map<string, ThreadExternalDevice> = new Map();

    /** All computed edge pairs (rebuilt in _updateGraph) */
    private _edgePairs: Map<string, ThreadEdgePair> = new Map();

    /** Base state of each edge after filter+dedup, before highlight */
    private _edgeBaseState: Map<string | number, EdgeBaseState> = new Map();

    /** Whether highlight is currently active */
    private _isHighlighted = false;

    /** Node ID currently highlighted (for icon restoration on clear) */
    private _highlightedNodeId: string | null = null;

    /** Get external Thread devices as a map for use by details panel */
    public get unknownDevicesMap(): ReadonlyMap<string, ThreadExternalDevice> {
        return this._unknownDevicesMapCache;
    }

    /** Get computed edge pairs (for potential use by other components) */
    public get edgePairs(): Map<string, ThreadEdgePair> {
        return this._edgePairs;
    }

    /**
     * Locate a diagnostic node entry across all known batches by uppercase extMacAddress hex.
     * Returns undefined if no batch reports a node with that MAC.
     */
    private _findDiagnosticNode(extAddressHex: string): ThreadDiagnosticsNode | undefined {
        const target = extAddressHex.toUpperCase();
        for (const batch of this.threadDiagnostics.values()) {
            for (const node of batch.nodes) {
                if (node.extMacAddress?.toUpperCase() === target) return node;
            }
        }
        return undefined;
    }

    /**
     * True when the BR identified by graph node id `br_<extAddr>` has a recent
     * non-partial diagnostic batch. Such BRs are "verified" — we successfully
     * queried them via REST or MeshCoP — and edges to them should render solid
     * (not dotted as for purely-inferred unknown devices).
     */
    private _brHasValidDiagnostic(graphNodeId: string): boolean {
        return this._brBatch(graphNodeId) !== undefined;
    }

    /** Returns the BR's diagnostic batch if one is available and non-partial. */
    private _brBatch(graphNodeId: string): ThreadDiagnosticsBatch | undefined {
        if (!graphNodeId.startsWith("br_")) return undefined;
        const extAddr = graphNodeId.slice(3).toUpperCase();
        const br = this.borderRouters.get(extAddr);
        const xp = br?.extendedPanIdHex;
        if (xp === undefined) return undefined;
        const batch = this.threadDiagnostics.get(xp.toUpperCase());
        if (batch === undefined || batch.partialReason !== undefined || batch.nodes.length === 0) return undefined;
        return batch;
    }

    /**
     * BR's view of a peer node via Route64 / ChildTable, if any.
     * Returns `undefined` when the BR has no diagnostic batch, when the peer
     * is not present in the batch, or when the peer is in the batch but has
     * no Route64 / ChildTable entry on the BR itself (i.e. multi-hop).
     */
    private _brViewOfPeer(
        brGraphNodeId: string,
        peerExtMacHex: string,
    ): { linkQualityIn?: number; linkQualityOut?: number; routeCost?: number; isChild?: boolean } | undefined {
        const batch = this._brBatch(brGraphNodeId);
        if (batch === undefined) return undefined;
        const brExtAddr = brGraphNodeId.slice(3).toUpperCase();
        const target = peerExtMacHex.toUpperCase();

        const brNode = batch.nodes.find(n => n.extMacAddress?.toUpperCase() === brExtAddr);
        const peerNode = batch.nodes.find(n => n.extMacAddress?.toUpperCase() === target);
        if (peerNode?.rloc16 === undefined || brNode === undefined) return undefined;

        const peerRouterId = (peerNode.rloc16 >> 10) & 0x3f;
        const peerChildId = peerNode.rloc16 & 0x3ff;

        const routeEntry = brNode.route64?.entries.find(e => e.routerId === peerRouterId);
        if (routeEntry !== undefined) {
            return {
                linkQualityIn: routeEntry.linkQualityIn,
                linkQualityOut: routeEntry.linkQualityOut,
                routeCost: routeEntry.routeCost,
            };
        }

        if (peerChildId !== 0) {
            const childEntry = brNode.childTable?.find(c => c.childId === peerChildId);
            if (childEntry !== undefined) {
                return { isChild: true };
            }
        }

        return undefined;
    }

    override updated(changedProperties: Map<string, unknown>): void {
        super.updated(changedProperties);

        // Trigger graph update when any hide option changes, or when the BR registry
        // refreshes (BaseNetworkGraph only watches `nodes`, so a BR-only change would
        // otherwise leave stale labels/icons).
        if (
            changedProperties.has("hideOfflineNodes") ||
            changedProperties.has("hideWeakSignalEdges") ||
            changedProperties.has("hideMediumSignalEdges") ||
            changedProperties.has("hideStrongSignalEdges") ||
            changedProperties.has("borderRouters") ||
            changedProperties.has("threadDiagnostics")
        ) {
            this._debouncedUpdateGraph();
        }
    }

    /**
     * Searches for a Thread node (known or unknown) and selects it. Matches, in priority order:
     * 1. Extended address (EUI-64), accepting `AABBCCDDEEFF0011`, `AA:BB:...`, or `0x...` forms.
     * 2. Node id (exact).
     * 3. Visible device label (case-insensitive substring).
     * Returns true when a match is found.
     */
    public selectBySearch(query: string): boolean {
        const trimmed = query.trim();
        if (!trimmed) {
            return false;
        }

        // Only visible nodes are selectable — focusing a hidden node would report a
        // match the user can't see on the graph.
        const threadNodes = Object.values(this.nodes).filter(
            node => getNetworkType(node) === "thread" && !(this.hideOfflineNodes && node.available === false),
        );

        // 1. Extended address — commissioned devices first, then unknown/external neighbors.
        const normalized = normalizeExtendedAddressInput(trimmed);
        if (normalized) {
            for (const node of threadNodes) {
                const extAddressHex = getThreadExtendedAddressHex(node);
                if (extAddressHex && extAddressHex === normalized) {
                    this.selectNode(String(node.node_id));
                    return true;
                }
            }

            for (const [unknownId, unknown] of this._unknownDevicesMapCache) {
                if (normalizeExtendedAddressInput(unknown.extAddressHex) === normalized) {
                    this.selectNode(unknownId);
                    return true;
                }
            }
        }

        // 2. Node id (exact).
        for (const node of threadNodes) {
            if (String(node.node_id) === trimmed) {
                this.selectNode(String(node.node_id));
                return true;
            }
        }

        // 3. Device label as shown on the graph (case-insensitive substring).
        const needle = trimmed.toLowerCase();
        for (const node of threadNodes) {
            if (getDeviceName(node).toLowerCase().includes(needle)) {
                this.selectNode(String(node.node_id));
                return true;
            }
        }

        return false;
    }

    protected override _updateGraph(): void {
        if (!this._nodesDataSet || !this._edgesDataSet) return;

        // Clear stored state since we're rebuilding everything
        this._clearOriginalEdgeColors();
        this._edgeBaseState.clear();
        this._isHighlighted = false;

        // Filter to Thread devices only
        const threadNodes = Object.values(this.nodes).filter(node => getNetworkType(node) === "thread");

        if (threadNodes.length === 0) {
            this._nodesDataSet.clear();
            this._edgesDataSet.clear();
            this._unknownDevices = [];
            this._unknownDevicesMapCache.clear();
            this._edgePairs.clear();
            return;
        }

        // Build address maps for connection matching
        const extAddrMap = buildExtAddrMap(this.nodes);
        const rloc16Map = buildRloc16Map(this.nodes);

        // Find external Thread devices (seen in neighbor tables but not commissioned),
        // classified against the BR registry so mDNS-known routers render distinctly.
        this._unknownDevices = findUnknownDevices(this.nodes, extAddrMap, rloc16Map, this.borderRouters);

        this._unknownDevicesMapCache.clear();
        for (const device of this._unknownDevices) {
            this._unknownDevicesMapCache.set(device.id, device);
        }

        // Build ALL edge pairs (0-2 edges per connected pair, no dedup)
        this._edgePairs = buildThreadEdgePairs(this.nodes, extAddrMap, rloc16Map, this._unknownDevices);

        // Diagnostic references (route64/childTable) are rloc16-based and only unique
        // within a network, so resolve them against a per-extPanId Matter map.
        const matterRloc16ByXp = buildMatterRloc16ByXp(this.nodes);
        const diagRloc16Map = buildDiagnosticRloc16Map(
            this.threadDiagnostics,
            matterRloc16ByXp,
            extAddrMap,
            this.borderRouters,
            this._unknownDevices,
        );
        const diagnosticMeshNodes = findDiagnosticMeshNodes(
            this.threadDiagnostics,
            matterRloc16ByXp,
            extAddrMap,
            this.borderRouters,
            this._unknownDevices,
        );
        const resolveRloc16 = makeDiagnosticRloc16Resolver(matterRloc16ByXp, diagRloc16Map);
        mergeDiagnosticEdges(this._edgePairs, this.threadDiagnostics, resolveRloc16);

        // Track which nodes should be hidden
        const hiddenNodeIds = new Set<string>();

        // --- Build graph nodes ---

        // Known Thread devices
        const graphNodes: NetworkGraphNode[] = threadNodes.map(node => {
            const nodeId = String(node.node_id);
            const threadRole = getThreadRole(node);
            const isOffline = node.available === false;
            const shouldHide = this.hideOfflineNodes && isOffline;

            if (shouldHide) {
                hiddenNodeIds.add(nodeId);
            }

            return {
                id: nodeId,
                label: getDeviceName(node),
                image: createNodeIconDataUrl(node, threadRole, false, isOffline),
                shape: "image" as const,
                networkType: "thread" as const,
                threadRole,
                offline: isOffline,
                hidden: shouldHide,
            };
        });

        // External Thread devices: known Border Routers get a friendly label/icon,
        // unidentified neighbors keep the generic question-mark style.
        for (const device of this._unknownDevices) {
            const isSelected = device.id === this._selectedNodeId;

            // Unknown externals are pure neighbor-table inference. Two stale-cache
            // signatures we always filter, regardless of the offline-nodes toggle:
            //   1. every observer is offline — entry can no longer be re-confirmed.
            //   2. exactly one observer that has other neighbors — single-source
            //      ghost from a node that's clearly otherwise reachable.
            // BRs have independent mDNS evidence — honor only the user toggle for them.
            const hasOnlineObserver = device.seenBy.some(nodeId => {
                const node = this.nodes[nodeId];
                return node !== undefined && node.available !== false;
            });
            let shouldHide: boolean;
            if (device.kind === "unknown") {
                shouldHide = !hasOnlineObserver;
                if (!shouldHide && device.seenBy.length === 1) {
                    const observer = this.nodes[device.seenBy[0]];
                    if (observer !== undefined && getNeighborTableLength(observer) > 1) {
                        shouldHide = true;
                    }
                }
            } else {
                shouldHide = this.hideOfflineNodes && !hasOnlineObserver;
            }

            if (shouldHide) {
                hiddenNodeIds.add(device.id);
            }

            const diagNode = this._findDiagnosticNode(device.extAddressHex);

            if (device.kind === "br") {
                const hostname = device.hostname !== undefined ? stripMdnsHostname(device.hostname) : undefined;
                // Only show network name on a second line when the first line came from a
                // distinct hostname; otherwise `top` would already be the (possibly truncated)
                // network name and the second line would just repeat it.
                const top = (hostname ?? device.networkName ?? "Border Router").slice(0, 24);
                const childCount = diagNode?.childTable?.length;
                const suffixParts = new Array<string>();
                if (hostname !== undefined && device.networkName !== undefined && device.networkName !== top) {
                    suffixParts.push(device.networkName);
                }
                if (childCount !== undefined && childCount > 0) {
                    suffixParts.push(`${childCount} ${childCount === 1 ? "child" : "children"}`);
                }
                const label = suffixParts.length > 0 ? `${top}\n${suffixParts.join(" · ")}` : top;
                const decodedState = decodeMeshcopStateBitmap(device.stateBitmapHex);
                const isLeader = decodedState?.threadRoleValue === 3;
                const isPrimaryBbr = decodedState?.bbr === true && decodedState.bbrFunction === "primary";
                graphNodes.push({
                    id: device.id,
                    label,
                    image: createBorderRouterIconDataUrl(isSelected, isLeader, isPrimaryBbr),
                    shape: "image" as const,
                    networkType: "thread" as const,
                    isUnknown: false,
                    hidden: shouldHide,
                });
            } else {
                const baseType = device.isRouter ? "External Router" : "External Device";
                const typeLabel =
                    diagNode?.vendorName !== undefined ? `${baseType} (${diagNode.vendorName})` : baseType;
                const suffix = device.networkName !== undefined ? `\n${device.networkName}` : "";
                graphNodes.push({
                    id: device.id,
                    label: `${typeLabel} [${device.extAddressHex.slice(-8)}]${suffix}`,
                    image: createUnknownDeviceIconDataUrl(device.isRouter, isSelected),
                    shape: "image" as const,
                    networkType: "thread" as const,
                    isUnknown: true,
                    hidden: shouldHide,
                });
            }
        }

        // Diagnostic-only mesh nodes: nodes seen in route64/childTable diagnostics that
        // are not yet commissioned or present in neighbor tables. Only show when they
        // have at least one cross-witnessed edge (connectedIds guard below).
        const connectedIds = new Set<string>();
        for (const pair of this._edgePairs.values()) {
            // A no-link (LQI=0 -> "none") edge is filtered out before render, so it
            // does not count as cross-witness — otherwise its endpoints would show as
            // isolated orphans.
            const live =
                (pair.edgeAB !== undefined && pair.edgeAB.signalLevel !== "none") ||
                (pair.edgeBA !== undefined && pair.edgeBA.signalLevel !== "none");
            if (live) {
                connectedIds.add(pair.nodeA);
                connectedIds.add(pair.nodeB);
            }
        }
        for (const meshNode of diagnosticMeshNodes) {
            const hidden = !connectedIds.has(meshNode.id);
            if (hidden) hiddenNodeIds.add(meshNode.id);
            const idTail =
                meshNode.extAddressHex !== undefined
                    ? meshNode.extAddressHex.slice(-8)
                    : `rloc:${meshNode.rloc16.toString(16)}`;
            const childSuffix =
                meshNode.childCount > 0
                    ? ` · ${meshNode.childCount} ${meshNode.childCount === 1 ? "child" : "children"}`
                    : "";
            const label = `${meshNode.vendorName ?? "Router"} [${idTail}]${childSuffix}\n${meshNode.networkName}`;
            graphNodes.push({
                id: meshNode.id,
                label,
                image: createUnknownDeviceIconDataUrl(meshNode.isRouter, meshNode.id === this._selectedNodeId),
                shape: "image" as const,
                networkType: "thread" as const,
                isUnknown: true,
                hidden,
            });
        }

        // --- Build graph edges from edge pairs ---

        const graphEdges: NetworkGraphEdge[] = [];

        for (const pair of this._edgePairs.values()) {
            // Collect both directional edges for this pair
            const edgesInPair: { conn: ThreadConnection; visEdge: NetworkGraphEdge; filterHidden: boolean }[] = [];
            // Track if any directional edge in this pair was a no-link (LQI=0) report.
            // If exactly one direction reports zero while the other has a real link, the pair
            // is asymmetric — surface the surviving edge as dashed so testers can spot it.
            let hadZeroEdge = false;
            let hadLiveEdge = false;

            for (const conn of [pair.edgeAB, pair.edgeBA]) {
                if (!conn) continue;

                const fromId = String(conn.fromNodeId);
                const toId = String(conn.toNodeId);
                const fromNode = this.nodes[fromId];
                const toNode = this.nodes[toId];
                const hasOfflineEndpoint = fromNode?.available === false || toNode?.available === false;

                // BR's Route64 / ChildTable confirms this exact peer → bidirectional
                // evidence; we can render the edge solid and annotate the tooltip
                // with the BR's view of the link.
                const isToBr = toId.startsWith("br_");
                const fromExtMac = fromNode ? getThreadExtendedAddressHex(fromNode) : undefined;
                const brView = isToBr && fromExtMac !== undefined ? this._brViewOfPeer(toId, fromExtMac) : undefined;

                // Diagnostic-only mesh nodes are inferred (not commissioned) — dash like unknowns.
                const isToDiagnostic = toId.startsWith("thread_") || toId.startsWith("meshrloc_");
                const isToUnknown =
                    toId.startsWith("unknown_") ||
                    isToDiagnostic ||
                    (isToBr && brView === undefined && !this._brHasValidDiagnostic(toId));

                // Apply filters to determine if edge should be hidden
                let filterHidden = false;

                // Cascade from hidden nodes (offline filter)
                if (hiddenNodeIds.has(fromId) || hiddenNodeIds.has(toId)) {
                    filterHidden = true;
                }

                // No-link filter: LQI=0 means stale/dead neighbor entry, never draw.
                if (conn.signalLevel === "none") {
                    filterHidden = true;
                    hadZeroEdge = true;
                } else {
                    hadLiveEdge = true;
                }

                // Signal level filters
                if (!filterHidden && this.hideWeakSignalEdges && conn.signalLevel === "weak") {
                    filterHidden = true;
                }
                if (!filterHidden && this.hideMediumSignalEdges && conn.signalLevel === "medium") {
                    filterHidden = true;
                }
                if (!filterHidden && this.hideStrongSignalEdges && conn.signalLevel === "strong") {
                    filterHidden = true;
                }

                const edgeId = `edge_${fromId}_${toId}`;

                let tooltip = conn.rssi !== null ? `RSSI: ${conn.rssi} dBm, LQI: ${conn.lqi}` : `LQI: ${conn.lqi}`;
                if (brView !== undefined) {
                    if (brView.isChild === true) {
                        tooltip += ` (BR sees as child)`;
                    } else if (brView.linkQualityIn !== undefined || brView.linkQualityOut !== undefined) {
                        tooltip += ` (BR view: in=${brView.linkQualityIn ?? "?"} out=${brView.linkQualityOut ?? "?"}${
                            brView.routeCost !== undefined ? ` cost=${brView.routeCost}` : ""
                        })`;
                    }
                }

                const visEdge: NetworkGraphEdge = {
                    id: edgeId,
                    from: fromId,
                    to: toId,
                    color: { color: conn.signalColor, highlight: conn.signalColor },
                    width: 2,
                    title: tooltip,
                    dashes: isToUnknown || hasOfflineEndpoint,
                    hidden: filterHidden,
                    pairKey: pair.pairKey,
                    reportingNodeId: fromId,
                };

                edgesInPair.push({ conn, visEdge, filterHidden });
            }

            // Dedup: among visible edges in this pair, keep the one with
            // the weakest signal (worst case). Hide the rest.
            const visibleInPair = edgesInPair.filter(e => !e.visEdge.hidden);
            if (visibleInPair.length > 1) {
                // Sort ascending by signal score (lowest = weakest = worst case)
                visibleInPair.sort((a, b) => getEdgeSignalScore(a.conn) - getEdgeSignalScore(b.conn));
                // Keep the weakest (index 0), hide the better one(s)
                for (let i = 1; i < visibleInPair.length; i++) {
                    visibleInPair[i].visEdge.hidden = true;
                }
            }

            // Asymmetric link: one direction reported the link as dead while the other
            // saw a live link. Mark the surviving edge dashed and annotate the tooltip.
            if (hadZeroEdge && hadLiveEdge) {
                for (const e of edgesInPair) {
                    if (!e.visEdge.hidden) {
                        e.visEdge.dashes = true;
                        e.visEdge.title = `${e.visEdge.title ?? ""} (asymmetric: peer reports no link)`;
                    }
                }
            }

            // Save base state and collect edges for the dataset
            for (const e of edgesInPair) {
                const isHidden = e.visEdge.hidden ?? false;
                let hiddenReason: EdgeHiddenReason = "visible";
                if (isHidden) {
                    hiddenReason = e.filterHidden ? "filter" : "dedup";
                }

                this._edgeBaseState.set(e.visEdge.id, {
                    hiddenReason,
                    width: e.visEdge.width,
                    color: { color: e.visEdge.color.color, highlight: e.visEdge.color.highlight },
                    dashes: e.visEdge.dashes ?? false,
                });

                graphEdges.push(e.visEdge);
            }
        }

        // --- Update vis.js datasets ---

        const existingNodeIds = this._nodesDataSet.getIds();
        const newNodeIds = new Set(graphNodes.map(n => n.id));

        // Remove nodes that no longer exist
        const nodesToRemove = existingNodeIds.filter((id: string | number) => !newNodeIds.has(id));
        if (nodesToRemove.length > 0) {
            this._nodesDataSet.remove(nodesToRemove);
        }

        // Update or add nodes
        this._nodesDataSet.update(graphNodes);

        // Replace all edges
        this._edgesDataSet.clear();
        this._edgesDataSet.add(graphEdges);

        // Re-apply highlight if a node is selected
        if (this._selectedNodeId !== null) {
            this._highlightConnections(this._selectedNodeId);
        }
    }

    /**
     * Highlights edges connected to the selected node with swap/arrow logic.
     *
     * For each visible edge connected to the highlighted node:
     * - If the visible edge comes from the remote node AND there is a
     *   dedup-hidden edge from the highlighted node → SWAP: show the
     *   highlighted node's edge instead (its signal is better or equal,
     *   but we prefer the highlighted node's perspective).
     * - Otherwise → thicken the edge. If the pair is truly one-way (only
     *   one of edgeAB/edgeBA exists), also draw an arrow in the data
     *   direction so asymmetric visibility is visible at a glance.
     */
    protected override _highlightConnections(nodeId: number | string): void {
        if (!this._edgesDataSet || !this._nodesDataSet) return;

        const nodeIdStr = String(nodeId);

        // Re-selecting the same node is a no-op: a full restore + re-highlight
        // would cause a visible flicker on dense graphs.
        if (this._isHighlighted && this._highlightedNodeId === nodeIdStr) return;

        // Restore base state first if already highlighted (e.g. switching nodes)
        if (this._isHighlighted) {
            this._restoreEdgeBaseState();
        }
        const allEdges = this._edgesDataSet.get();
        const dimmedColor = this._getDimmedEdgeColor();

        // Group edges by pair key for swap lookups
        const edgesByPair = new Map<string, NetworkGraphEdge[]>();
        for (const edge of allEdges) {
            if (edge.pairKey) {
                const list = edgesByPair.get(edge.pairKey) ?? [];
                list.push(edge);
                edgesByPair.set(edge.pairKey, list);
            }
        }

        const connectedNodeIds = new Set<string | number>();
        const edgeUpdates: Record<string, Partial<NetworkGraphEdge>> = {};

        for (const edge of allEdges) {
            const fromStr = String(edge.from);
            const toStr = String(edge.to);
            const isConnected = fromStr === nodeIdStr || toStr === nodeIdStr;

            if (!isConnected) {
                // Dim non-connected visible edges
                const baseState = this._edgeBaseState.get(edge.id);
                if (baseState && baseState.hiddenReason === "visible") {
                    edgeUpdates[String(edge.id)] = {
                        id: edge.id,
                        width: 1,
                        color: { color: dimmedColor, highlight: dimmedColor },
                    };
                }
                continue;
            }

            // This edge is connected to the highlighted node.
            // Only process edges that are visible in base state.
            const baseState = this._edgeBaseState.get(edge.id);
            if (!baseState || baseState.hiddenReason !== "visible") {
                // Hidden edge — may be used as a swap target below, but
                // we don't initiate processing from hidden edges.
                continue;
            }

            const remoteId = fromStr === nodeIdStr ? toStr : fromStr;
            const reportingId = String(edge.reportingNodeId ?? edge.from);
            connectedNodeIds.add(remoteId);

            if (reportingId !== nodeIdStr) {
                // Visible edge comes from the REMOTE node.
                // Check if there's a dedup-hidden edge from the highlighted node
                // that we can swap in to show the highlighted node's perspective.
                const pairEdges = edge.pairKey ? edgesByPair.get(edge.pairKey) : undefined;

                const swapCandidate = pairEdges?.find(e => {
                    const rid = String(e.reportingNodeId ?? e.from);
                    if (rid !== nodeIdStr) return false;
                    const bs = this._edgeBaseState.get(e.id);
                    return bs?.hiddenReason === "dedup";
                });

                if (swapCandidate) {
                    // SWAP: hide the remote's edge, show the highlighted node's edge
                    const swapBaseState = this._edgeBaseState.get(swapCandidate.id);
                    edgeUpdates[String(edge.id)] = {
                        id: edge.id,
                        hidden: true,
                    };
                    edgeUpdates[String(swapCandidate.id)] = {
                        id: swapCandidate.id,
                        hidden: false,
                        width: 3,
                        color: swapBaseState
                            ? { color: swapBaseState.color.color, highlight: swapBaseState.color.highlight }
                            : { color: "#999999", highlight: "#999999" },
                    };
                } else {
                    // No swap target means the displayed direction is reverse
                    // from the highlighted node's perspective and we cannot
                    // recover the outgoing direction (truly one-way OR
                    // filter-hidden). Both look the same to the eye, so always
                    // arrow; panel disambiguates via one-way badge vs (reverse).
                    edgeUpdates[String(edge.id)] = this._reverseEdgeUpdate(edge);
                }
            } else {
                // Visible edge comes from the HIGHLIGHTED node. Only mark with
                // an arrow when the peer's direction is genuinely absent — a
                // peer-direction filter-hide here would just add noise to the
                // user's own perspective.
                edgeUpdates[String(edge.id)] = this._asymmetricEdgeUpdate(edge);
            }
        }

        this._edgesDataSet.update(Object.values(edgeUpdates));

        // Update nodes — make neighbors more prominent
        const allNodes = this._nodesDataSet.get();
        const nodeUpdates = allNodes.map((node: NetworkGraphNode) => {
            const isNeighbor = connectedNodeIds.has(node.id);
            const isSelected = node.id === nodeId;
            return {
                id: node.id,
                size: isSelected ? 40 : isNeighbor ? 35 : 25,
                font: {
                    size: isSelected ? 14 : isNeighbor ? 13 : 11,
                    color: this._getFontColor(),
                    bold: isSelected || isNeighbor ? { color: this._getFontColor() } : undefined,
                },
                opacity: isSelected || isNeighbor ? 1 : 0.5,
            };
        });
        this._nodesDataSet.update(nodeUpdates);

        // Switching highlight without a full deselect (e.g. clicking a connection
        // row in the side panel) keeps the previous node's icon in its selected
        // variant unless we reset it here.
        if (this._highlightedNodeId && this._highlightedNodeId !== nodeIdStr) {
            this._setNodeIconHighlight(this._highlightedNodeId, false);
        }

        this._highlightedNodeId = nodeIdStr;
        this._setNodeIconHighlight(nodeIdStr, true);

        this._isHighlighted = true;
    }

    /**
     * Thicken a connected edge and add a directional arrow when the pair is
     * truly one-way in data (only one of edgeAB/edgeBA exists). Used for the
     * highlighted-reports-peer branch where filter-hidden peer directions
     * should not draw an arrow on the user's own perspective.
     *
     * Explicit arrow object (vs the shorthand "to") keeps the head visible
     * on dashed offline edges where some vis.js builds skip the shorthand.
     */
    private _asymmetricEdgeUpdate(edge: NetworkGraphEdge): Partial<NetworkGraphEdge> {
        const pair = edge.pairKey ? this._edgePairs.get(edge.pairKey) : undefined;
        const isAsymmetric = pair ? !pair.edgeAB || !pair.edgeBA : false;
        const update: Partial<NetworkGraphEdge> = {
            id: edge.id,
            width: 3,
        };
        if (isAsymmetric) {
            update.arrows = { to: { enabled: true, scaleFactor: 1 } };
        }
        return update;
    }

    /**
     * Thicken a connected edge and always add a directional arrow. Used for
     * the remote-reports-highlighted branch where the displayed edge is the
     * peer's direction (no swap target available); the user sees the same
     * single line whether the outgoing direction is filter-hidden or absent.
     */
    private _reverseEdgeUpdate(edge: NetworkGraphEdge): Partial<NetworkGraphEdge> {
        return {
            id: edge.id,
            width: 3,
            arrows: { to: { enabled: true, scaleFactor: 1 } },
        };
    }

    /**
     * Swap a node's icon between the default and highlighted variants.
     * Kept separate so both `_highlightConnections` (switching target) and
     * `_clearHighlights` (fully unselecting) reach the same end state.
     */
    private _setNodeIconHighlight(nodeId: string, isHighlighted: boolean): void {
        if (!this._nodesDataSet) return;
        const nodeData = this.nodes[nodeId];
        if (nodeData) {
            const threadRole = getThreadRole(nodeData);
            const isOffline = nodeData.available === false;
            this._nodesDataSet.update({
                id: nodeId,
                image: createNodeIconDataUrl(nodeData, threadRole, isHighlighted, isOffline),
            });
            return;
        }
        const external = this._unknownDevicesMapCache.get(nodeId);
        if (external?.kind === "br") {
            const decodedState = decodeMeshcopStateBitmap(external.stateBitmapHex);
            const isLeader = decodedState?.threadRoleValue === 3;
            const isPrimaryBbr = decodedState?.bbr === true && decodedState.bbrFunction === "primary";
            this._nodesDataSet.update({
                id: nodeId,
                image: createBorderRouterIconDataUrl(isHighlighted, isLeader, isPrimaryBbr),
            });
        } else if (nodeId.startsWith("unknown_") || nodeId.startsWith("br_")) {
            this._nodesDataSet.update({
                id: nodeId,
                image: createUnknownDeviceIconDataUrl(external?.isRouter ?? false, isHighlighted),
            });
        } else if (nodeId.startsWith("thread_") || nodeId.startsWith("meshrloc_")) {
            // Diagnostic mesh node. Router id scheme: `thread_<MAC>` (always a router) or
            // `meshrloc_<rloc16>` where a router has the low 10 child bits clear.
            const isRouter = nodeId.startsWith("thread_") || (Number(nodeId.slice("meshrloc_".length)) & 0x3ff) === 0;
            this._nodesDataSet.update({
                id: nodeId,
                image: createUnknownDeviceIconDataUrl(isRouter, isHighlighted),
            });
        }
    }

    /**
     * Clears all highlights and restores the graph to its base state
     * (after filter+dedup, before highlight modifications).
     */
    protected override _clearHighlights(): void {
        if (!this._edgesDataSet || !this._nodesDataSet) return;

        // Restore edges to their base state
        this._restoreEdgeBaseState();

        if (this._highlightedNodeId) {
            this._setNodeIconHighlight(this._highlightedNodeId, false);
            this._highlightedNodeId = null;
        }

        // Restore nodes to default styling
        const allNodes = this._nodesDataSet.get();
        const nodeUpdates = allNodes.map((node: NetworkGraphNode) => ({
            id: node.id,
            size: 30,
            font: {
                size: 12,
                color: this._getFontColor(),
                bold: undefined,
            },
            opacity: 1,
        }));
        this._nodesDataSet.update(nodeUpdates);

        this._isHighlighted = false;
    }

    /**
     * Restores all edges to their base state (undoes highlight modifications).
     * This resets hidden/visible state, width, color, and dashes.
     */
    private _restoreEdgeBaseState(): void {
        if (!this._edgesDataSet) return;

        const edgeUpdates: Partial<NetworkGraphEdge>[] = [];
        for (const [id, baseState] of this._edgeBaseState) {
            edgeUpdates.push({
                id,
                hidden: baseState.hiddenReason !== "visible",
                width: baseState.width,
                color: { color: baseState.color.color, highlight: baseState.color.highlight },
                dashes: baseState.dashes,
                arrows: "",
            });
        }
        this._edgesDataSet.update(edgeUpdates);
    }

    override render() {
        const threadNodes = Object.values(this.nodes).filter(node => getNetworkType(node) === "thread");
        const visibleThreadNodes = this.hideOfflineNodes
            ? threadNodes.filter(node => node.available !== false)
            : threadNodes;

        if (visibleThreadNodes.length === 0) {
            const allOfflineFiltered = threadNodes.length > 0 && this.hideOfflineNodes;
            return html`
                <div class="empty-state">
                    <p>${allOfflineFiltered ? "No online Thread devices" : "No Thread devices found"}</p>
                    <p class="hint">
                        ${allOfflineFiltered
                            ? 'Disable the "Offline nodes" filter to show offline devices'
                            : "Thread devices will appear here once commissioned"}
                    </p>
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
