/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterNode } from "@matter-server/ws-client";
import type {
    CategorizedDevices,
    NetworkType,
    ThreadConnection,
    ThreadNeighbor,
    ThreadRoute,
    UnknownThreadDevice,
} from "./network-types.js";

// NetworkCommissioning cluster feature map bits (cluster 0x31/49)
const WIFI_FEATURE = 1 << 0; // Bit 0: WiFi Network Interface
const THREAD_FEATURE = 1 << 1; // Bit 1: Thread Network Interface
const ETHERNET_FEATURE = 1 << 2; // Bit 2: Ethernet Network Interface

// Signal strength thresholds (dBm)
const SIGNAL_STRONG_THRESHOLD = -70;
const SIGNAL_MEDIUM_THRESHOLD = -85;

// LQI thresholds (0-255)
const LQI_STRONG_THRESHOLD = 200;
const LQI_MEDIUM_THRESHOLD = 100;

// Signal colors
const SIGNAL_COLOR_STRONG = "#4caf50"; // Green
const SIGNAL_COLOR_MEDIUM = "#ff9800"; // Orange
const SIGNAL_COLOR_WEAK = "#f44336"; // Red

/**
 * WiFi Diagnostics info from cluster 0x36/54.
 */
export interface WiFiDiagnostics {
    /** BSSID as hex string */
    bssid: string | null;
    /** RSSI in dBm (-120 to 0) */
    rssi: number | null;
    /** WiFi channel */
    channel: number | null;
    /** Security type */
    securityType: number | null;
    /** WiFi version */
    wifiVersion: number | null;
}

/**
 * Converts a base64-encoded extended address to BigInt.
 * Extended addresses are 8 bytes (64 bits) stored as big-endian.
 * Some Matter implementations include a TLV prefix byte that we need to skip.
 */
function base64ToBigInt(base64: string): bigint {
    try {
        const binary = atob(base64);
        let result = 0n;

        // If we have 9 bytes, skip the first byte (likely a TLV type prefix)
        // EUI-64 should be exactly 8 bytes
        const start = binary.length > 8 ? binary.length - 8 : 0;

        for (let i = start; i < binary.length; i++) {
            result = (result << 8n) | BigInt(binary.charCodeAt(i));
        }
        return result;
    } catch {
        return 0n;
    }
}

/**
 * Normalizes an extended address to BigInt for comparison.
 * Handles: BigInt, base64 strings, numbers.
 */
function normalizeExtAddress(value: unknown): bigint {
    if (typeof value === "bigint") {
        return value;
    }
    if (typeof value === "string") {
        return base64ToBigInt(value);
    }
    if (typeof value === "number") {
        return BigInt(value);
    }
    return 0n;
}

/**
 * Detects the network type from the NetworkCommissioning cluster feature map.
 * Uses attribute 0/49/65532 (FeatureMap).
 */
export function getNetworkType(node: MatterNode): NetworkType {
    const featureMap = node.attributes["0/49/65532"] as number | undefined;

    if (featureMap === undefined) {
        return "unknown";
    }

    // Check in priority order: Thread > WiFi > Ethernet
    if (featureMap & THREAD_FEATURE) {
        return "thread";
    }
    if (featureMap & WIFI_FEATURE) {
        return "wifi";
    }
    if (featureMap & ETHERNET_FEATURE) {
        return "ethernet";
    }

    return "unknown";
}

/**
 * Categorizes nodes by their network type.
 */
export function categorizeDevices(nodes: Record<string, MatterNode>): CategorizedDevices {
    const result: CategorizedDevices = {
        thread: [],
        wifi: [],
        ethernet: [],
        unknown: [],
    };

    for (const node of Object.values(nodes)) {
        const nodeId = typeof node.node_id === "bigint" ? Number(node.node_id) : node.node_id;
        const networkType = getNetworkType(node);
        result[networkType].push(nodeId);
    }

    return result;
}

/**
 * Gets the Thread routing role for a node.
 * Uses attribute 0/53/1 (RoutingRole).
 */
export function getThreadRole(node: MatterNode): number | undefined {
    return node.attributes["0/53/1"] as number | undefined;
}

/**
 * Gets the Thread channel for a node.
 * Uses attribute 0/53/0 (Channel).
 */
export function getThreadChannel(node: MatterNode): number | undefined {
    return node.attributes["0/53/0"] as number | undefined;
}

/**
 * Gets the Thread extended PAN ID for a node.
 * Uses attribute 0/53/4 (ExtendedPanId).
 */
export function getThreadExtendedPanId(node: MatterNode): bigint | undefined {
    return node.attributes["0/53/4"] as bigint | undefined;
}

/**
 * Gets the Thread extended address (EUI-64) for a node.
 *
 * Uses General Diagnostics cluster (0x0033/51) NetworkInterfaces attribute (0/51/0).
 * The NetworkInterface struct has:
 * - Field 4: HardwareAddress (base64 encoded EUI-64)
 * - Field 7: Type (4 = Thread)
 *
 * Returns as BigInt. Only upper 48 bits should be used for matching due to JSON precision loss.
 */
export function getThreadExtendedAddress(node: MatterNode): bigint | undefined {
    // Get NetworkInterfaces from General Diagnostics cluster (0/51/0)
    const networkInterfaces = node.attributes["0/51/0"] as Array<Record<string, unknown>> | undefined;

    if (!Array.isArray(networkInterfaces) || networkInterfaces.length === 0) {
        return undefined;
    }

    // Find Thread interface (type 7 field = 4) or use first with hardware address
    const threadIface = networkInterfaces.find(i => i["7"] === 4) || networkInterfaces[0];

    if (!threadIface) {
        return undefined;
    }

    // HardwareAddress is field 4, base64 encoded
    const hwAddrB64 = threadIface["4"];

    if (typeof hwAddrB64 !== "string" || !hwAddrB64) {
        return undefined;
    }

    // Decode base64 to get EUI-64
    const extAddr = base64ToBigInt(hwAddrB64);
    return extAddr !== 0n ? extAddr : undefined;
}

/**
 * Gets the Thread extended address as a hex string for display.
 * Uses General Diagnostics NetworkInterfaces (0/51/0).
 */
export function getThreadExtendedAddressHex(node: MatterNode): string | undefined {
    const extAddr = getThreadExtendedAddress(node);
    if (extAddr !== undefined) {
        return extAddr.toString(16).padStart(16, "0").toUpperCase();
    }
    return undefined;
}

/**
 * Parses the Thread neighbor table from a node's attributes.
 * Attribute 0/53/7 (NeighborTable) is an array of neighbor objects.
 * The data uses numeric keys matching the Matter spec field IDs.
 */
export function parseNeighborTable(node: MatterNode): ThreadNeighbor[] {
    const neighborTable = node.attributes["0/53/7"];

    if (!Array.isArray(neighborTable)) {
        return [];
    }

    return neighborTable.map((entry: Record<string, unknown>) => {
        // Field 0: extAddress - can be BigInt or base64 string
        const rawExtAddr = entry["0"] ?? entry.extAddress;
        const extAddress = normalizeExtAddress(rawExtAddr);

        return {
            extAddress,
            // Field 1: age
            age: (entry["1"] ?? entry.age ?? 0) as number,
            // Field 2: rloc16
            rloc16: (entry["2"] ?? entry.rloc16 ?? 0) as number,
            // Field 3: linkFrameCounter
            linkFrameCounter: (entry["3"] ?? entry.linkFrameCounter ?? 0) as number,
            // Field 4: mleFrameCounter
            mleFrameCounter: (entry["4"] ?? entry.mleFrameCounter ?? 0) as number,
            // Field 5: lqi
            lqi: (entry["5"] ?? entry.lqi ?? 0) as number,
            // Field 6: averageRssi (nullable)
            avgRssi: (entry["6"] ?? entry.averageRssi ?? null) as number | null,
            // Field 7: lastRssi (nullable)
            lastRssi: (entry["7"] ?? entry.lastRssi ?? null) as number | null,
            // Field 8: frameErrorRate
            frameErrorRate: (entry["8"] ?? entry.frameErrorRate ?? 0) as number,
            // Field 9: messageErrorRate
            messageErrorRate: (entry["9"] ?? entry.messageErrorRate ?? 0) as number,
            // Field 10: rxOnWhenIdle
            rxOnWhenIdle: (entry["10"] ?? entry.rxOnWhenIdle ?? false) as boolean,
            // Field 11: fullThreadDevice
            fullThreadDevice: (entry["11"] ?? entry.fullThreadDevice ?? false) as boolean,
            // Field 12: fullNetworkData
            fullNetworkData: (entry["12"] ?? entry.fullNetworkData ?? false) as boolean,
            // Field 13: isChild
            isChild: (entry["13"] ?? entry.isChild ?? false) as boolean,
        };
    });
}

/**
 * Parses the Thread route table from a node's attributes.
 * Attribute 0/53/8 (RouteTable) is an array of route objects.
 * The data uses numeric keys matching the Matter spec field IDs.
 */
export function parseRouteTable(node: MatterNode): ThreadRoute[] {
    const routeTable = node.attributes["0/53/8"];

    if (!Array.isArray(routeTable)) {
        return [];
    }

    return routeTable.map((entry: Record<string, unknown>) => {
        // Field 0: extAddress - can be BigInt or base64 string
        const rawExtAddr = entry["0"] ?? entry.extAddress;
        const extAddress = normalizeExtAddress(rawExtAddr);

        return {
            extAddress,
            // Field 1: rloc16
            rloc16: (entry["1"] ?? entry.rloc16 ?? 0) as number,
            // Field 2: routerId
            routerId: (entry["2"] ?? entry.routerId ?? 0) as number,
            // Field 3: nextHop
            nextHop: (entry["3"] ?? entry.nextHop ?? 0) as number,
            // Field 4: pathCost
            pathCost: (entry["4"] ?? entry.pathCost ?? 0) as number,
            // Field 5: lqiIn
            lqiIn: (entry["5"] ?? entry.lqiIn ?? 0) as number,
            // Field 6: lqiOut
            lqiOut: (entry["6"] ?? entry.lqiOut ?? 0) as number,
            // Field 7: age
            age: (entry["7"] ?? entry.age ?? 0) as number,
            // Field 8: allocated
            allocated: (entry["8"] ?? entry.allocated ?? false) as boolean,
            // Field 9: linkEstablished
            linkEstablished: (entry["9"] ?? entry.linkEstablished ?? false) as boolean,
        };
    });
}

/**
 * Gets the RLOC16 (short address) for a Thread node.
 * Uses attribute 0/53/64 (Rloc16, 0x0040).
 */
export function getThreadRloc16(node: MatterNode): number | undefined {
    const value = node.attributes["0/53/64"];
    if (typeof value === "number") {
        return value;
    }
    return undefined;
}

/**
 * Builds a map of extended addresses (BigInt) to node IDs for Thread devices.
 * Uses General Diagnostics NetworkInterfaces (0/51/0) for the hardware address.
 */
export function buildExtAddrMap(nodes: Record<string, MatterNode>): Map<bigint, number> {
    const extAddrMap = new Map<bigint, number>();

    for (const node of Object.values(nodes)) {
        const nodeId = typeof node.node_id === "bigint" ? Number(node.node_id) : node.node_id;
        const extAddr = getThreadExtendedAddress(node);

        if (extAddr !== undefined) {
            extAddrMap.set(extAddr, nodeId);
        }
    }

    return extAddrMap;
}

/**
 * Builds a map of RLOC16 (short addresses) to node IDs for Thread devices.
 * Used as fallback when ExtAddress is not available.
 */
export function buildRloc16Map(nodes: Record<string, MatterNode>): Map<number, number> {
    const rloc16Map = new Map<number, number>();

    for (const node of Object.values(nodes)) {
        const nodeId = typeof node.node_id === "bigint" ? Number(node.node_id) : node.node_id;
        const rloc16 = getThreadRloc16(node);

        if (rloc16 !== undefined) {
            rloc16Map.set(rloc16, nodeId);
        }
    }

    return rloc16Map;
}

/**
 * Finds unknown Thread devices - addresses seen in neighbor tables
 * that don't match any known commissioned device.
 * These are typically Thread Border Routers or devices from other ecosystems.
 */
export function findUnknownDevices(
    nodes: Record<string, MatterNode>,
    extAddrMap: Map<bigint, number>,
): UnknownThreadDevice[] {
    const unknownMap = new Map<string, UnknownThreadDevice>();

    for (const node of Object.values(nodes)) {
        const nodeId = typeof node.node_id === "bigint" ? Number(node.node_id) : node.node_id;
        const neighbors = parseNeighborTable(node);

        for (const neighbor of neighbors) {
            // Check if this neighbor is in our known devices
            if (extAddrMap.has(neighbor.extAddress)) {
                continue;
            }

            const extAddressHex = neighbor.extAddress.toString(16).padStart(16, "0").toUpperCase();
            const id = `unknown_${extAddressHex}`;

            if (!unknownMap.has(id)) {
                unknownMap.set(id, {
                    id,
                    extAddressHex,
                    extAddress: neighbor.extAddress,
                    seenBy: [],
                    isRouter: false,
                    bestRssi: null,
                });
            }

            const unknown = unknownMap.get(id)!;

            // Add this node to seenBy if not already there
            if (!unknown.seenBy.includes(nodeId)) {
                unknown.seenBy.push(nodeId);
            }

            // Update router status (field 10 = rxOnWhenIdle, indicates router-like behavior)
            if (neighbor.rxOnWhenIdle) {
                unknown.isRouter = true;
            }

            // Track best signal
            const rssi = neighbor.avgRssi ?? neighbor.lastRssi;
            if (rssi !== null && (unknown.bestRssi === null || rssi > unknown.bestRssi)) {
                unknown.bestRssi = rssi;
            }
        }
    }

    return Array.from(unknownMap.values());
}

/**
 * Gets the signal color based on RSSI or LQI values.
 * Green: Strong signal
 * Orange: Medium signal
 * Red: Weak signal
 */
export function getSignalColor(neighbor: ThreadNeighbor): string {
    // Prefer RSSI if available
    const rssi = neighbor.avgRssi ?? neighbor.lastRssi;

    if (rssi !== null) {
        if (rssi > SIGNAL_STRONG_THRESHOLD) {
            return SIGNAL_COLOR_STRONG;
        }
        if (rssi > SIGNAL_MEDIUM_THRESHOLD) {
            return SIGNAL_COLOR_MEDIUM;
        }
        return SIGNAL_COLOR_WEAK;
    }

    // Fallback to LQI (0-255, higher is better)
    if (neighbor.lqi > LQI_STRONG_THRESHOLD) {
        return SIGNAL_COLOR_STRONG;
    }
    if (neighbor.lqi > LQI_MEDIUM_THRESHOLD) {
        return SIGNAL_COLOR_MEDIUM;
    }
    return SIGNAL_COLOR_WEAK;
}

/**
 * Gets a human-readable display name for a node.
 * Format: nodeLabel || productName (serialNumber)
 */
export function getDeviceName(node: MatterNode): string {
    if (node.nodeLabel) {
        return node.nodeLabel;
    }

    const productName = node.productName || "Unknown Device";
    const serialNumber = node.serialNumber;

    if (serialNumber) {
        return `${productName} (${serialNumber})`;
    }

    return productName;
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
 * Parses WiFi diagnostics from a node's attributes.
 * Cluster 0x36/54 - WiFi Network Diagnostics.
 */
export function getWiFiDiagnostics(node: MatterNode): WiFiDiagnostics {
    // BSSID is attribute 0/54/0, stored as base64
    const bssidRaw = node.attributes["0/54/0"] as string | undefined;
    let bssid: string | null = null;
    if (bssidRaw) {
        try {
            const binary = atob(bssidRaw);
            bssid = Array.from(binary)
                .map(c => c.charCodeAt(0).toString(16).padStart(2, "0").toUpperCase())
                .join(":");
        } catch {
            bssid = null;
        }
    }

    // RSSI is attribute 0/54/4
    const rssi = node.attributes["0/54/4"] as number | null | undefined;

    // Channel is attribute 0/54/3
    const channel = node.attributes["0/54/3"] as number | null | undefined;

    // Security type is attribute 0/54/1
    const securityType = node.attributes["0/54/1"] as number | null | undefined;

    // WiFi version is attribute 0/54/2
    const wifiVersion = node.attributes["0/54/2"] as number | null | undefined;

    return {
        bssid: bssid,
        rssi: rssi ?? null,
        channel: channel ?? null,
        securityType: securityType ?? null,
        wifiVersion: wifiVersion ?? null,
    };
}

/**
 * Gets the signal color for a given RSSI value.
 */
export function getSignalColorFromRssi(rssi: number | null): string {
    if (rssi === null) {
        return SIGNAL_COLOR_MEDIUM; // Default to medium if unknown
    }
    if (rssi > SIGNAL_STRONG_THRESHOLD) {
        return SIGNAL_COLOR_STRONG;
    }
    if (rssi > SIGNAL_MEDIUM_THRESHOLD) {
        return SIGNAL_COLOR_MEDIUM;
    }
    return SIGNAL_COLOR_WEAK;
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

/**
 * Builds Thread mesh connections from neighbor tables.
 * Returns connections with signal information.
 * Includes connections to unknown devices (prefixed with 'unknown_').
 */
export function buildThreadConnections(
    nodes: Record<string, MatterNode>,
    extAddrMap: Map<bigint, number>,
    unknownDevices: UnknownThreadDevice[],
): ThreadConnection[] {
    const connections: ThreadConnection[] = [];
    const seenConnections = new Set<string>();

    // Build map of unknown device extAddress -> id
    const unknownExtAddrMap = new Map<bigint, string>();
    for (const unknown of unknownDevices) {
        unknownExtAddrMap.set(unknown.extAddress, unknown.id);
    }

    for (const node of Object.values(nodes)) {
        const fromNodeId = typeof node.node_id === "bigint" ? Number(node.node_id) : node.node_id;
        const neighbors = parseNeighborTable(node);

        for (const neighbor of neighbors) {
            // Try to find in known devices first
            let toNodeId: number | string | undefined = extAddrMap.get(neighbor.extAddress);

            // If not found, check unknown devices
            if (toNodeId === undefined) {
                toNodeId = unknownExtAddrMap.get(neighbor.extAddress);
            }

            if (toNodeId === undefined) {
                // Should not happen if unknownDevices was built correctly
                continue;
            }

            // Skip self-connections
            if (fromNodeId === toNodeId) {
                continue;
            }

            // Create a unique key for this connection
            const connectionKey = `${fromNodeId}-${toNodeId}`;
            const reverseKey = `${toNodeId}-${fromNodeId}`;

            if (seenConnections.has(connectionKey) || seenConnections.has(reverseKey)) {
                // Already have this connection
                continue;
            }
            seenConnections.add(connectionKey);

            connections.push({
                fromNodeId,
                toNodeId,
                signalColor: getSignalColor(neighbor),
                lqi: neighbor.lqi,
                rssi: neighbor.avgRssi ?? neighbor.lastRssi,
            });
        }
    }

    return connections;
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
    lqi: number | null;
    rssi: number | null;
    /** Whether this connection is from THIS node's neighbor table (true) or from the OTHER node's table (false) */
    isOutgoing: boolean;
    /** Whether this is an unknown/external device */
    isUnknown: boolean;
}

/**
 * Get all connections for a specific node (bidirectional).
 * This includes:
 * 1. Neighbors this node reports in its neighbor table (outgoing)
 * 2. Nodes that report this node as their neighbor (incoming)
 *
 * Returns a deduplicated list - if both directions exist, only the outgoing one is included
 * (since that has signal data from THIS node's perspective).
 */
export function getNodeConnections(
    nodeId: number,
    nodes: Record<string, MatterNode>,
    extAddrMap: Map<bigint, number>,
): NodeConnection[] {
    const connections: NodeConnection[] = [];
    const seenConnectedIds = new Set<number | string>();

    const node = nodes[nodeId.toString()];
    if (!node) return connections;

    // Get this node's extended address for reverse lookups (from General Diagnostics, not Thread Diagnostics)
    const thisExtAddr = getThreadExtendedAddress(node);

    // 1. Add neighbors this node reports (outgoing connections)
    const neighbors = parseNeighborTable(node);
    for (const neighbor of neighbors) {
        const connectedNodeId = extAddrMap.get(neighbor.extAddress);
        const connectedNode = connectedNodeId ? nodes[connectedNodeId.toString()] : undefined;
        const isUnknown = connectedNodeId === undefined;
        const displayId = isUnknown
            ? `unknown_${neighbor.extAddress.toString(16).toUpperCase().padStart(16, "0")}`
            : connectedNodeId;

        seenConnectedIds.add(displayId);

        connections.push({
            connectedNodeId: displayId,
            connectedNode,
            extAddressHex: neighbor.extAddress.toString(16).toUpperCase().padStart(16, "0"),
            signalColor: getSignalColor(neighbor),
            lqi: neighbor.lqi,
            rssi: neighbor.avgRssi ?? neighbor.lastRssi,
            isOutgoing: true,
            isUnknown,
        });
    }

    // 2. Find nodes that report THIS node as their neighbor (incoming connections)
    if (thisExtAddr !== undefined) {
        for (const otherNode of Object.values(nodes)) {
            const otherNodeId = typeof otherNode.node_id === "bigint" ? Number(otherNode.node_id) : otherNode.node_id;
            if (otherNodeId === nodeId) continue; // Skip self

            // Check if already connected via outgoing
            if (seenConnectedIds.has(otherNodeId)) continue;

            // Check if other node reports this node as neighbor
            const otherNeighbors = parseNeighborTable(otherNode);
            const reverseEntry = otherNeighbors.find(n => n.extAddress === thisExtAddr);

            if (reverseEntry) {
                const otherExtAddr = getThreadExtendedAddress(otherNode);
                const extAddrHex = otherExtAddr ? otherExtAddr.toString(16).toUpperCase().padStart(16, "0") : "Unknown";

                connections.push({
                    connectedNodeId: otherNodeId,
                    connectedNode: otherNode,
                    extAddressHex: extAddrHex,
                    signalColor: getSignalColor(reverseEntry),
                    lqi: reverseEntry.lqi,
                    rssi: reverseEntry.avgRssi ?? reverseEntry.lastRssi,
                    isOutgoing: false,
                    isUnknown: false,
                });
            }
        }
    }

    return connections;
}
