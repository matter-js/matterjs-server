/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterNode, SignalLevel, ThreadConnection, ThreadEdgePair } from "@matter-server/ws-client";
import { getEdgeSignalScore, getThreadExtendedAddressHex } from "@matter-server/ws-client";
import { getCssVar } from "../../util/shared-styles.js";

// The network topology data model + derivation moved to @matter-server/ws-client so
// the server can reuse it. Re-exported here so existing dashboard imports from
// "./network-utils.js" keep resolving unchanged. Color/theme, display-string and
// side-panel (NodeConnection) helpers stay below — those are render concerns.
export {
    buildDiagnosticRloc16Map,
    buildExtAddrMap,
    buildMatterRloc16ByXp,
    buildRloc16Map,
    buildThreadEdgePairs,
    categorizeDevices,
    diagnosticNodeId,
    findDiagnosticMeshNodes,
    findRouteByExtAddress,
    findUnknownDevices,
    getEdgeSignalScore,
    getNeighborTableLength,
    getNetworkType,
    getRoutableDestinationsCount,
    getRouteBidirectionalLqi,
    getSignalLevel,
    getSignalLevelFromLqi,
    getThreadChannel,
    getThreadExtendedAddress,
    getThreadExtendedAddressHex,
    getThreadExtendedPanId,
    getThreadRloc16,
    getThreadRole,
    getThreadVersion,
    getWiFiDiagnostics,
    makeDiagnosticRloc16Resolver,
    makePairKey,
    mergeDiagnosticEdges,
    parseNeighborTable,
    parseRouteTable,
} from "@matter-server/ws-client";
export type { WiFiDiagnostics } from "@matter-server/ws-client";

export { getDeviceName } from "../../util/node-name.js";

// WiFi RSSI thresholds (dBm). Used only for the WiFi diagnostics graph; Thread
// neighbor/route edges are LQI-driven and classified in ws-client.
const SIGNAL_STRONG_THRESHOLD = -70;
const SIGNAL_MEDIUM_THRESHOLD = -85;

// Signal colors — read from CSS variables for theme awareness
function getSignalColorStrong(): string {
    return getCssVar("--signal-color-strong", "#4caf50");
}
function getSignalColorMedium(): string {
    return getCssVar("--signal-color-medium", "#ff9800");
}
function getSignalColorWeak(): string {
    return getCssVar("--signal-color-weak", "#f44336");
}
function getSignalColorNone(): string {
    return getCssVar("--signal-color-none", "#9e9e9e");
}

/** Map a signal level to its theme-aware color. */
export function signalLevelToColor(level: SignalLevel): string {
    switch (level) {
        case "strong":
            return getSignalColorStrong();
        case "medium":
            return getSignalColorMedium();
        case "weak":
            return getSignalColorWeak();
        case "none":
            return getSignalColorNone();
    }
}

/**
 * Get signal color from an LQI value (0-3 in practice on OpenThread).
 * 0 = grey (no link), 1 = red, 2 = orange, 3 = green.
 */
export function getSignalColorFromLqi(lqi: number): string {
    return signalLevelToColor(lqi <= 0 ? "none" : lqi > 2 ? "strong" : lqi > 1 ? "medium" : "weak");
}

/**
 * Gets the signal color for a given RSSI value.
 */
export function getSignalColorFromRssi(rssi: number | null): string {
    if (rssi === null) {
        return getSignalColorMedium(); // Default to medium if unknown
    }
    if (rssi > SIGNAL_STRONG_THRESHOLD) {
        return getSignalColorStrong();
    }
    if (rssi > SIGNAL_MEDIUM_THRESHOLD) {
        return getSignalColorMedium();
    }
    return getSignalColorWeak();
}

// NetworkCommissioning ThreadVersion (attr 0x0A) follows the Thread spec
// "Version TLV" mapping. Spec is open-ended; unknown values render with the
// raw TLV so newer-than-table devices stay visible.
const THREAD_VERSION_NAMES: Record<number, string> = {
    1: "1.0",
    2: "1.1",
    3: "1.2",
    4: "1.3",
    5: "1.4",
};

/**
 * Human-readable Thread version string from the Version TLV value.
 * Unmapped TLVs render as `Thread unknown (N)` so the raw value stays
 * visible for diagnostics.
 */
export function formatThreadVersion(tlv: number): string {
    const name = THREAD_VERSION_NAMES[tlv];
    return name !== undefined ? `Thread ${name}` : `Thread unknown (${tlv})`;
}

/**
 * Gets the human-readable name for a Thread routing role.
 */
export function getThreadRoleName(role: number | undefined): string {
    switch (role) {
        case 0:
            return "Unspecified";
        case 1:
            return "Unassigned";
        case 2:
            return "Sleepy End Device";
        case 3:
            return "End Device";
        case 4:
            return "REED";
        case 5:
            return "Router";
        case 6:
            return "Leader";
        default:
            return "Unknown";
    }
}

/**
 * Gets WiFi security type name.
 */
export function getWiFiSecurityTypeName(securityType: number | null): string {
    switch (securityType) {
        case 0:
            return "Unspecified";
        case 1:
            return "None";
        case 2:
            return "WEP";
        case 3:
            return "WPA Personal";
        case 4:
            return "WPA2 Personal";
        case 5:
            return "WPA3 Personal";
        default:
            return "Unknown";
    }
}

/**
 * Gets WiFi version name.
 */
export function getWiFiVersionName(version: number | null): string {
    switch (version) {
        case 0:
            return "802.11a";
        case 1:
            return "802.11b";
        case 2:
            return "802.11g";
        case 3:
            return "802.11n";
        case 4:
            return "802.11ac";
        case 5:
            return "802.11ax";
        case 6:
            return "802.11ah";
        default:
            return "Unknown";
    }
}

/** Strips trailing dot and `.local` suffix from an mDNS hostname. */
export function stripMdnsHostname(hostname: string): string {
    return hostname.replace(/\.$/, "").replace(/\.local$/i, "");
}

/**
 * Decoded form of the MeshCoP `_meshcop` TXT `sb` (state bitmap) field. Layout per
 * OpenThread's `border_agent_txt_data.hpp` (`openthread/openthread`, the de-facto reference
 * implementation for Thread Border Router service publication):
 *
 *   bits 0-2   Connection Mode         (0=Disabled, 1=PSKc/DTLS, 2=PSKd/DTLS, 3=Vendor, 4=X.509)
 *   bits 3-4   Thread Interface State  (0=NotInit, 1=Init/inactive, 2=Init/active)
 *   bits 5-6   Availability            (0=Infrequent, 1=High)
 *   bit  7     BBR Active              (0/1)
 *   bit  8     BBR Is Primary          (0=secondary, 1=primary; only meaningful when BBR Active)
 *   bits 9-10  Thread Role             (0=Detached, 1=Child, 2=Router, 3=Leader)
 *   bit  11    ePSKc Supported         (0/1)
 *   bits 12-13 Multi-AIL State         (0=Disabled, 1=Not detected, 2=Detected)
 *   bits 14-31 Reserved
 */
export interface DecodedStateBitmap {
    connectionMode?: string;
    connectionModeValue: number;
    threadInterfaceStatus?: string;
    threadInterfaceStatusValue: number;
    availability?: string;
    availabilityValue: number;
    bbr: boolean;
    /** "primary" / "secondary" — only meaningful when {@link bbr} is true. */
    bbrFunction?: string;
    threadRole?: string;
    threadRoleValue: number;
    epskcSupported: boolean;
    multiAilState?: string;
    multiAilStateValue: number;
    /** Hex of any bits beyond bit 13 (reserved/future). Undefined when zero. */
    reservedHex?: string;
}

const CONNECTION_MODE_LABELS: Record<number, string> = {
    0: "disabled",
    1: "PSKc / DTLS",
    2: "PSKd / DTLS",
    3: "vendor-defined",
    4: "X.509",
};

const THREAD_INTERFACE_STATUS_LABELS: Record<number, string> = {
    0: "not initialized",
    1: "initialized, inactive",
    2: "initialized, active",
};

const AVAILABILITY_LABELS: Record<number, string> = {
    0: "infrequent",
    1: "high",
};

const THREAD_ROLE_LABELS: Record<number, string> = {
    0: "detached",
    1: "child",
    2: "router",
    3: "leader",
};

const MULTI_AIL_STATE_LABELS: Record<number, string> = {
    0: "disabled",
    1: "not detected",
    2: "detected",
};

/**
 * Decodes a MeshCoP state bitmap hex string (e.g. "000005B1") per the OpenThread reference
 * layout. Returns undefined if the input is not a valid hex value.
 */
export function decodeMeshcopStateBitmap(hex: string | undefined): DecodedStateBitmap | undefined {
    if (hex === undefined || !/^[0-9a-fA-F]{1,8}$/.test(hex)) return undefined;
    const value = parseInt(hex, 16);
    if (!Number.isFinite(value)) return undefined;

    const connectionModeValue = value & 0x7;
    const threadInterfaceStatusValue = (value >> 3) & 0x3;
    const availabilityValue = (value >> 5) & 0x3;
    const bbr = ((value >> 7) & 0x1) === 1;
    const bbrIsPrimary = ((value >> 8) & 0x1) === 1;
    const threadRoleValue = (value >> 9) & 0x3;
    const epskcSupported = ((value >> 11) & 0x1) === 1;
    const multiAilStateValue = (value >> 12) & 0x3;
    const reserved = (value >>> 14) >>> 0;

    return {
        connectionModeValue,
        connectionMode: CONNECTION_MODE_LABELS[connectionModeValue],
        threadInterfaceStatusValue,
        threadInterfaceStatus: THREAD_INTERFACE_STATUS_LABELS[threadInterfaceStatusValue],
        availabilityValue,
        availability: AVAILABILITY_LABELS[availabilityValue],
        bbr,
        bbrFunction: bbr ? (bbrIsPrimary ? "primary" : "secondary") : undefined,
        threadRoleValue,
        threadRole: THREAD_ROLE_LABELS[threadRoleValue],
        epskcSupported,
        multiAilStateValue,
        multiAilState: MULTI_AIL_STATE_LABELS[multiAilStateValue],
        reservedHex: reserved !== 0 ? reserved.toString(16).toUpperCase() : undefined,
    };
}

/**
 * Represents a connection from the perspective of a specific node.
 * Includes both neighbors this node reports AND nodes that report this node as their neighbor.
 */
export interface NodeConnection {
    /** The connected node ID (number for known nodes, string for unknown devices) */
    connectedNodeId: number | string;
    /** The connected MatterNode if it's a known device */
    connectedNode?: MatterNode;
    /** Extended address hex string for display */
    extAddressHex: string;
    /** Signal strength info (if available) */
    signalColor: string;
    signalLevel: SignalLevel;
    lqi: number | null;
    rssi: number | null;
    /** Whether this connection is from THIS node's neighbor table (true) or from the OTHER node's table (false) */
    isOutgoing: boolean;
    /** True when only the peer reports this edge — this node has no matching neighbor-table entry. Surfaces true asymmetric visibility, distinct from a reverse view caused by filtering. */
    isReverseOnly: boolean;
    /** Whether this is an unknown/external device */
    isUnknown: boolean;
    /** Path cost from route table (1 = direct, higher = multi-hop). Only available for routers. */
    pathCost?: number;
    /** Bidirectional LQI from route table (average of lqiIn and lqiOut) */
    bidirectionalLqi?: number;
}

/**
 * Filter options for edge visibility, matching the graph's filter pipeline.
 */
export interface EdgeFilterOptions {
    hideOfflineNodes?: boolean;
    hideWeakSignalEdges?: boolean;
    hideMediumSignalEdges?: boolean;
    hideStrongSignalEdges?: boolean;
}

/**
 * Derives NodeConnection[] from pre-computed edge pairs for a given node.
 * Uses the same edge pairs as the graph, ensuring the side panel and the
 * graph always agree on which connections exist.
 *
 * The function mirrors the graph's exact pipeline:
 *   1. Filter each edge independently (offline cascade + signal level)
 *   2. Among survivors per pair, prefer the outgoing edge (matches graph
 *      highlight swap); fall back to worst signal (matches graph dedup)
 *
 * When filters are omitted, no filtering is applied and the outgoing
 * edge is preferred (useful for the "update connections" dialog).
 *
 * One entry per connected peer (no duplicates).
 */
export function getNodeConnectionsFromPairs(
    nodeId: string,
    edgePairs: Map<string, ThreadEdgePair>,
    nodes: Record<string, MatterNode>,
    filters?: EdgeFilterOptions,
): NodeConnection[] {
    const connections: NodeConnection[] = [];

    // Build set of hidden node IDs (offline cascade, same as graph)
    const hiddenNodeIds = new Set<string>();
    if (filters?.hideOfflineNodes) {
        for (const node of Object.values(nodes)) {
            if (node.available === false) {
                hiddenNodeIds.add(String(node.node_id));
            }
        }
    }

    for (const pair of edgePairs.values()) {
        const isA = pair.nodeA === nodeId;
        const isB = pair.nodeB === nodeId;
        if (!isA && !isB) continue;

        const remoteId = isA ? pair.nodeB : pair.nodeA;
        const outgoing = isA ? pair.edgeAB : pair.edgeBA;
        const incoming = isA ? pair.edgeBA : pair.edgeAB;

        // Apply filters to each edge independently (mirrors graph pipeline)
        const survivors: { conn: ThreadConnection; isOutgoing: boolean }[] = [];

        for (const [conn, isOut] of [
            [outgoing, true],
            [incoming, false],
        ] as const) {
            if (!conn) continue;

            if (filters) {
                const fromId = String(conn.fromNodeId);
                const toId = String(conn.toNodeId);

                // Offline cascade: skip if either endpoint is hidden
                if (hiddenNodeIds.has(fromId) || hiddenNodeIds.has(toId)) continue;

                // Signal level filters
                if (filters.hideWeakSignalEdges && conn.signalLevel === "weak") continue;
                if (filters.hideMediumSignalEdges && conn.signalLevel === "medium") continue;
                if (filters.hideStrongSignalEdges && conn.signalLevel === "strong") continue;
            }

            survivors.push({ conn, isOutgoing: isOut });
        }

        if (survivors.length === 0) continue;

        // Mirror graph behavior: zero-LQI edges are hidden in the mesh, so prefer a live
        // survivor here too. Fall back to a "none" survivor only when both directions
        // are dead — then the panel renders a single no-link entry.
        const liveSurvivors = survivors.filter(s => s.conn.signalLevel !== "none");
        const usable = liveSurvivors.length > 0 ? liveSurvivors : survivors;

        // Among usable survivors: prefer outgoing (matches graph highlight swap),
        // fall back to worst signal (matches graph dedup)
        let winner: { conn: ThreadConnection; isOutgoing: boolean };
        const outgoingSurvivor = usable.find(s => s.isOutgoing);
        if (outgoingSurvivor) {
            winner = outgoingSurvivor;
        } else {
            usable.sort((a, b) => getEdgeSignalScore(a.conn) - getEdgeSignalScore(b.conn));
            winner = usable[0];
        }

        const remoteNode = nodes[remoteId];
        const isExternalUnknown = remoteId.startsWith("unknown_");
        const isExternalBr = remoteId.startsWith("br_");
        const isUnknown = isExternalUnknown || isExternalBr;

        // Derive extended address hex for display
        let extAddressHex: string;
        if (isExternalUnknown) {
            extAddressHex = remoteId.slice("unknown_".length);
        } else if (isExternalBr) {
            extAddressHex = remoteId.slice("br_".length);
        } else if (remoteNode) {
            extAddressHex = getThreadExtendedAddressHex(remoteNode) ?? "Unknown";
        } else {
            extAddressHex = "Unknown";
        }

        connections.push({
            connectedNodeId: remoteId,
            connectedNode: remoteNode,
            extAddressHex,
            signalColor: signalLevelToColor(winner.conn.signalLevel),
            signalLevel: winner.conn.signalLevel,
            lqi: winner.conn.lqi,
            rssi: winner.conn.rssi,
            isOutgoing: winner.isOutgoing,
            isReverseOnly: !outgoing,
            isUnknown,
            pathCost: winner.conn.pathCost,
            bidirectionalLqi: winner.conn.bidirectionalLqi,
        });
    }

    return connections;
}
