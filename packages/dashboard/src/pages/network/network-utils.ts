/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BorderRouterEntry, MatterNode } from "@matter-server/ws-client";
import { getCssVar } from "../../util/shared-styles.js";
import type {
    CategorizedDevices,
    NetworkType,
    SignalLevel,
    ThreadConnection,
    ThreadEdgePair,
    ThreadExternalDevice,
    ThreadNeighbor,
    ThreadRoute,
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
 * Node IDs are stored as strings to avoid BigInt precision loss.
 */
export function categorizeDevices(nodes: Record<string, MatterNode>): CategorizedDevices {
    const result: CategorizedDevices = {
        thread: [],
        wifi: [],
        ethernet: [],
        unknown: [],
    };

    for (const node of Object.values(nodes)) {
        const nodeId = String(node.node_id);
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
 * Counts entries in the Thread neighbor table without normalizing each entry.
 * Use this in hot paths where only the cardinality matters; the full parse
 * does a base64 decode per entry that adds up across re-renders.
 */
export function getNeighborTableLength(node: MatterNode): number {
    const neighborTable = node.attributes["0/53/7"];
    return Array.isArray(neighborTable) ? neighborTable.length : 0;
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
 * Find a route table entry for a specific destination by extended address.
 * Returns the route entry if found, undefined otherwise.
 */
export function findRouteByExtAddress(node: MatterNode, targetExtAddr: bigint): ThreadRoute | undefined {
    const routes = parseRouteTable(node);
    return routes.find(route => route.extAddress === targetExtAddr && route.linkEstablished);
}

/**
 * Count the number of routable destinations for a node (from route table).
 * Only counts entries where allocated=true and linkEstablished=true.
 * This is typically only meaningful for router nodes.
 */
export function getRoutableDestinationsCount(node: MatterNode): number {
    const routes = parseRouteTable(node);
    return routes.filter(route => route.allocated && route.linkEstablished).length;
}

/**
 * Calculate combined bidirectional LQI from route table entry.
 * Returns average of lqiIn and lqiOut if both are non-zero.
 */
export function getRouteBidirectionalLqi(route: ThreadRoute): number | undefined {
    if (route.lqiIn > 0 && route.lqiOut > 0) {
        return Math.round((route.lqiIn + route.lqiOut) / 2);
    }
    if (route.lqiIn > 0) return route.lqiIn;
    if (route.lqiOut > 0) return route.lqiOut;
    return undefined;
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
 * Node IDs are stored as strings to avoid BigInt precision loss.
 */
export function buildExtAddrMap(nodes: Record<string, MatterNode>): Map<bigint, string> {
    const extAddrMap = new Map<bigint, string>();

    for (const node of Object.values(nodes)) {
        const nodeId = String(node.node_id);
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
 * Node IDs are stored as strings to avoid BigInt precision loss.
 */
export function buildRloc16Map(nodes: Record<string, MatterNode>): Map<number, string> {
    const rloc16Map = new Map<number, string>();

    for (const node of Object.values(nodes)) {
        const nodeId = String(node.node_id);
        const rloc16 = getThreadRloc16(node);

        if (rloc16 !== undefined) {
            rloc16Map.set(rloc16, nodeId);
        }
    }

    return rloc16Map;
}

interface ExternalAggregate {
    extAddressHex: string;
    extAddress: bigint;
    seenBy: string[];
    isRouter: boolean;
    bestRssi: number | null;
    /** xp of the first observing matter node; all neighbors of a Thread node share its xp. */
    extendedPanIdHex?: string;
}

/**
 * Finds external Thread devices - addresses seen in neighbor tables that don't match
 * any commissioned device. Classifies each against the optional Border Router registry:
 * matched ones are emitted as kind:"br" with full mDNS enrichment; the rest stay as
 * kind:"unknown". Uses RLOC16 as fallback when extended address matching fails.
 */
export function findUnknownDevices(
    nodes: Record<string, MatterNode>,
    extAddrMap: Map<bigint, string>,
    rloc16Map: Map<number, string>,
    borderRouters?: ReadonlyMap<string, BorderRouterEntry>,
): ThreadExternalDevice[] {
    const aggregates = new Map<string, ExternalAggregate>();

    for (const node of Object.values(nodes)) {
        const nodeId = String(node.node_id);
        const neighbors = parseNeighborTable(node);
        const observerXp = getThreadExtendedPanId(node);
        const observerXpHex =
            observerXp !== undefined ? observerXp.toString(16).padStart(16, "0").toUpperCase() : undefined;

        for (const neighbor of neighbors) {
            if (extAddrMap.has(neighbor.extAddress)) {
                continue;
            }
            if (neighbor.rloc16 !== 0 && rloc16Map.has(neighbor.rloc16)) {
                continue;
            }

            const extAddressHex = neighbor.extAddress.toString(16).padStart(16, "0").toUpperCase();

            let agg = aggregates.get(extAddressHex);
            if (agg === undefined) {
                agg = {
                    extAddressHex,
                    extAddress: neighbor.extAddress,
                    seenBy: [],
                    isRouter: false,
                    bestRssi: null,
                    extendedPanIdHex: observerXpHex,
                };
                aggregates.set(extAddressHex, agg);
            } else if (agg.extendedPanIdHex === undefined && observerXpHex !== undefined) {
                agg.extendedPanIdHex = observerXpHex;
            }

            if (!agg.seenBy.includes(nodeId)) {
                agg.seenBy.push(nodeId);
            }
            if (neighbor.rxOnWhenIdle) {
                agg.isRouter = true;
            }
            const rssi = neighbor.avgRssi ?? neighbor.lastRssi;
            if (rssi !== null && (agg.bestRssi === null || rssi > agg.bestRssi)) {
                agg.bestRssi = rssi;
            }
        }
    }

    // Pre-compute xp → networkName from the BR registry so we can label unknowns by network.
    const networkNameByXp = new Map<string, string>();
    if (borderRouters !== undefined) {
        for (const br of borderRouters.values()) {
            if (br.extendedPanIdHex !== undefined && br.networkName !== undefined) {
                networkNameByXp.set(br.extendedPanIdHex, br.networkName);
            }
        }
    }

    const out = new Array<ThreadExternalDevice>();
    for (const agg of aggregates.values()) {
        const br = borderRouters?.get(agg.extAddressHex);
        if (br !== undefined) {
            out.push({
                kind: "br",
                ...br,
                id: `br_${agg.extAddressHex}`,
                extAddressHex: agg.extAddressHex,
                extAddress: agg.extAddress,
                seenBy: agg.seenBy,
                isRouter: agg.isRouter,
                bestRssi: agg.bestRssi,
            });
        } else {
            const networkName =
                agg.extendedPanIdHex !== undefined ? networkNameByXp.get(agg.extendedPanIdHex) : undefined;
            out.push({
                kind: "unknown",
                id: `unknown_${agg.extAddressHex}`,
                extAddressHex: agg.extAddressHex,
                extAddress: agg.extAddress,
                seenBy: agg.seenBy,
                isRouter: agg.isRouter,
                bestRssi: agg.bestRssi,
                extendedPanIdHex: agg.extendedPanIdHex,
                networkName,
            });
        }
    }
    return out;
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

/** Determine signal level from a Thread neighbor's RSSI/LQI. */
export function getSignalLevel(neighbor: ThreadNeighbor): SignalLevel {
    const rssi = neighbor.avgRssi ?? neighbor.lastRssi;
    if (rssi !== null) {
        if (rssi > SIGNAL_STRONG_THRESHOLD) return "strong";
        if (rssi > SIGNAL_MEDIUM_THRESHOLD) return "medium";
        return "weak";
    }
    return getSignalLevelFromLqi(neighbor.lqi);
}

/** Determine signal level from an LQI value alone (e.g. route table entries without RSSI). */
export function getSignalLevelFromLqi(lqi: number): SignalLevel {
    if (lqi > LQI_STRONG_THRESHOLD) return "strong";
    if (lqi > LQI_MEDIUM_THRESHOLD) return "medium";
    return "weak";
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
    }
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
            return getSignalColorStrong();
        }
        if (rssi > SIGNAL_MEDIUM_THRESHOLD) {
            return getSignalColorMedium();
        }
        return getSignalColorWeak();
    }

    // Fallback to LQI (0-255, higher is better)
    if (neighbor.lqi > LQI_STRONG_THRESHOLD) {
        return getSignalColorStrong();
    }
    if (neighbor.lqi > LQI_MEDIUM_THRESHOLD) {
        return getSignalColorMedium();
    }
    return getSignalColorWeak();
}

/**
 * Get signal color based on LQI value alone.
 * Used for route table entries where only LQI is available.
 * @param lqi Link Quality Indicator (0-255, higher is better)
 */
export function getSignalColorFromLqi(lqi: number): string {
    if (lqi > LQI_STRONG_THRESHOLD) {
        return getSignalColorStrong();
    }
    if (lqi > LQI_MEDIUM_THRESHOLD) {
        return getSignalColorMedium();
    }
    return getSignalColorWeak();
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
    /** Undefined when link strength is unknown. */
    signalLevel?: SignalLevel;
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
 * Creates a canonical pair key from two node IDs.
 * The key is always ordered so that the same pair produces the same key regardless of direction.
 */
export function makePairKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Computes a numeric signal score for edge comparison.
 * Lower score = weaker signal (worst case).
 */
export function getEdgeSignalScore(conn: ThreadConnection): number {
    const levelScore =
        conn.signalLevel === "strong"
            ? 3000
            : conn.signalLevel === "medium"
              ? 2000
              : conn.signalLevel === "weak"
                ? 1000
                : 0;
    const detail = conn.rssi !== null ? conn.rssi + 200 : conn.lqi;
    return levelScore + detail;
}

/**
 * Builds edge pairs for all Thread connections.
 * Each pair represents two connected nodes with up to 2 directional edges
 * (one from each node's neighbor/route table). No dedup is performed —
 * callers are responsible for selecting which edge to display per pair.
 */
export function buildThreadEdgePairs(
    nodes: Record<string, MatterNode>,
    extAddrMap: Map<bigint, string>,
    rloc16Map: Map<number, string>,
    unknownDevices: ThreadExternalDevice[],
): Map<string, ThreadEdgePair> {
    const pairs = new Map<string, ThreadEdgePair>();

    const unknownExtAddrMap = new Map<bigint, string>();
    for (const unknown of unknownDevices) {
        unknownExtAddrMap.set(unknown.extAddress, unknown.id);
    }

    for (const node of Object.values(nodes)) {
        const fromNodeId = String(node.node_id);
        const neighbors = parseNeighborTable(node);

        for (const neighbor of neighbors) {
            let toNodeId: string | undefined = extAddrMap.get(neighbor.extAddress);
            if (toNodeId === undefined && neighbor.rloc16 !== 0) {
                toNodeId = rloc16Map.get(neighbor.rloc16);
            }
            if (toNodeId === undefined) {
                toNodeId = unknownExtAddrMap.get(neighbor.extAddress);
            }
            if (toNodeId === undefined || fromNodeId === toNodeId) continue;

            const pairKey = makePairKey(fromNodeId, toNodeId);
            if (!pairs.has(pairKey)) {
                const [nodeA, nodeB] = fromNodeId < toNodeId ? [fromNodeId, toNodeId] : [toNodeId, fromNodeId];
                pairs.set(pairKey, { pairKey, nodeA, nodeB });
            }

            const pair = pairs.get(pairKey)!;
            const isFromA = fromNodeId === pair.nodeA;

            // Neighbor table entry takes precedence — skip if already present for this direction
            if (isFromA && pair.edgeAB) continue;
            if (!isFromA && pair.edgeBA) continue;

            const routeEntry = findRouteByExtAddress(node, neighbor.extAddress);
            const bidirectionalLqi = routeEntry ? getRouteBidirectionalLqi(routeEntry) : undefined;

            const edge: ThreadConnection = {
                fromNodeId,
                toNodeId,
                signalColor: getSignalColor(neighbor),
                signalLevel: getSignalLevel(neighbor),
                lqi: neighbor.lqi,
                rssi: neighbor.avgRssi ?? neighbor.lastRssi,
                pathCost: routeEntry?.pathCost,
                bidirectionalLqi,
            };

            if (isFromA) {
                pair.edgeAB = edge;
            } else {
                pair.edgeBA = edge;
            }
        }

        // Supplementary: route table entries not already covered by neighbor table
        const routes = parseRouteTable(node);
        for (const route of routes) {
            if (!route.linkEstablished || !route.allocated) continue;

            let toNodeId: string | undefined = extAddrMap.get(route.extAddress);
            if (toNodeId === undefined && route.rloc16 !== 0) {
                toNodeId = rloc16Map.get(route.rloc16);
            }
            if (toNodeId === undefined) {
                toNodeId = unknownExtAddrMap.get(route.extAddress);
            }
            if (toNodeId === undefined || toNodeId === fromNodeId) continue;

            const pairKey = makePairKey(fromNodeId, toNodeId);
            if (!pairs.has(pairKey)) {
                const [nodeA, nodeB] = fromNodeId < toNodeId ? [fromNodeId, toNodeId] : [toNodeId, fromNodeId];
                pairs.set(pairKey, { pairKey, nodeA, nodeB });
            }

            const pair = pairs.get(pairKey)!;
            const isFromA = fromNodeId === pair.nodeA;

            // Only add from route table if no neighbor table edge for this direction
            if (isFromA && pair.edgeAB) continue;
            if (!isFromA && pair.edgeBA) continue;

            const bidirectionalLqi = getRouteBidirectionalLqi(route);
            const signalColor =
                bidirectionalLqi !== undefined
                    ? getSignalColorFromLqi(bidirectionalLqi)
                    : "var(--md-sys-color-outline, grey)";

            const edge: ThreadConnection = {
                fromNodeId,
                toNodeId,
                signalColor,
                signalLevel: bidirectionalLqi !== undefined ? getSignalLevelFromLqi(bidirectionalLqi) : undefined,
                lqi: bidirectionalLqi ?? 0,
                rssi: null,
                pathCost: route.pathCost,
                bidirectionalLqi,
                fromRouteTable: true,
            };

            if (isFromA) {
                pair.edgeAB = edge;
            } else {
                pair.edgeBA = edge;
            }
        }
    }

    return pairs;
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

        // Among survivors: prefer outgoing (matches graph highlight swap),
        // fall back to worst signal (matches graph dedup)
        let winner: { conn: ThreadConnection; isOutgoing: boolean };
        const outgoingSurvivor = survivors.find(s => s.isOutgoing);
        if (outgoingSurvivor) {
            winner = outgoingSurvivor;
        } else {
            survivors.sort((a, b) => getEdgeSignalScore(a.conn) - getEdgeSignalScore(b.conn));
            winner = survivors[0];
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
            signalColor: winner.conn.signalColor,
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
