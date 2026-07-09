/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BorderRouterEntry, ThreadDiagnosticsBatch, ThreadDiagnosticsNode } from "../models/model.js";
import type {
    CategorizedDevices,
    DiagnosticMeshNode,
    NetworkType,
    SignalLevel,
    ThreadConnection,
    ThreadEdgePair,
    ThreadExternalDevice,
    ThreadNeighbor,
    ThreadRoute,
    TopologySourceNode,
    WiFiDiagnostics,
} from "./topology-types.js";

// NetworkCommissioning cluster feature map bits (cluster 0x31/49)
const WIFI_FEATURE = 1 << 0; // Bit 0: WiFi Network Interface
const THREAD_FEATURE = 1 << 1; // Bit 1: Thread Network Interface
const ETHERNET_FEATURE = 1 << 2; // Bit 2: Ethernet Network Interface

// Thread LQI thresholds. Spec types LQI as uint8 (0-255), but OpenThread — the
// dominant Thread stack — only ever reports 0-3. We classify on the 0-3 scale:
// 3 = strong, 2 = medium, 1 = weak, 0 = no link (stale/dead neighbor entry).
const LQI_STRONG_THRESHOLD = 2;
const LQI_MEDIUM_THRESHOLD = 1;

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
export function getNetworkType(node: TopologySourceNode): NetworkType {
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
 * Thread protocol version supported by the device's Thread interface.
 * Uses NetworkCommissioning cluster (0x31/49) ThreadVersion attribute (0x0A/10).
 */
export function getThreadVersion(node: TopologySourceNode): number | undefined {
    const v = node.attributes["0/49/10"];
    return typeof v === "number" ? v : undefined;
}

/**
 * Categorizes nodes by their network type.
 * Node IDs are stored as strings to avoid BigInt precision loss.
 */
export function categorizeDevices(nodes: Record<string, TopologySourceNode>): CategorizedDevices {
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
 * Uses attribute 0/53/1 (RoutingRole, nullable per Matter spec).
 */
export function getThreadRole(node: TopologySourceNode): number | undefined {
    const v = node.attributes["0/53/1"];
    return typeof v === "number" ? v : undefined;
}

/**
 * Gets the Thread channel for a node.
 * Uses attribute 0/53/0 (Channel, nullable per Matter spec).
 */
export function getThreadChannel(node: TopologySourceNode): number | undefined {
    const v = node.attributes["0/53/0"];
    return typeof v === "number" ? v : undefined;
}

/**
 * Gets the Thread extended PAN ID for a node.
 * Uses attribute 0/53/4 (ExtendedPanId, nullable per Matter spec).
 *
 * The WebSocket JSON reviver only revives integers above Number.MAX_SAFE_INTEGER
 * as bigint; smaller uint64 values arrive as plain number, so accept both.
 */
export function getThreadExtendedPanId(node: TopologySourceNode): bigint | undefined {
    const v = node.attributes["0/53/4"];
    if (typeof v === "bigint") return v;
    if (typeof v === "number" && Number.isInteger(v)) return BigInt(v);
    return undefined;
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
export function getThreadExtendedAddress(node: TopologySourceNode): bigint | undefined {
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
export function getThreadExtendedAddressHex(node: TopologySourceNode): string | undefined {
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
export function getNeighborTableLength(node: TopologySourceNode): number {
    const neighborTable = node.attributes["0/53/7"];
    return Array.isArray(neighborTable) ? neighborTable.length : 0;
}

/**
 * Parses the Thread neighbor table from a node's attributes.
 * Attribute 0/53/7 (NeighborTable) is an array of neighbor objects.
 * The data uses numeric keys matching the Matter spec field IDs.
 */
export function parseNeighborTable(node: TopologySourceNode): ThreadNeighbor[] {
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
export function parseRouteTable(node: TopologySourceNode): ThreadRoute[] {
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
export function findRouteByExtAddress(node: TopologySourceNode, targetExtAddr: bigint): ThreadRoute | undefined {
    const routes = parseRouteTable(node);
    return routes.find(route => route.extAddress === targetExtAddr && route.linkEstablished);
}

/**
 * Count the number of routable destinations for a node (from route table).
 * Only counts entries where allocated=true and linkEstablished=true.
 * This is typically only meaningful for router nodes.
 */
export function getRoutableDestinationsCount(node: TopologySourceNode): number {
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
export function getThreadRloc16(node: TopologySourceNode): number | undefined {
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
export function buildExtAddrMap(nodes: Record<string, TopologySourceNode>): Map<bigint, string> {
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
export function buildRloc16Map(nodes: Record<string, TopologySourceNode>): Map<number, string> {
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

/**
 * Stable graph id for a diagnostic mesh node: prefer the globally-unique extMac,
 * else an rloc16 namespaced by extPanId (rloc16 is only unique within a network).
 */
export function diagnosticNodeId(
    node: Pick<ThreadDiagnosticsNode, "extMacAddress" | "rloc16">,
    extPanIdHex: string,
): string {
    if (node.extMacAddress !== undefined) return `thread_${node.extMacAddress.toUpperCase()}`;
    return `meshrloc_${extPanIdHex.toUpperCase()}_${node.rloc16 ?? "x"}`;
}

/** Resolver key joining a network's extPanId with an rloc16 (rloc16 alone is not unique across networks). */
function diagRlocKey(extPanIdHex: string, rloc16: number): string {
    return `${extPanIdHex.toUpperCase()}:${rloc16}`;
}

/**
 * `extPanId:rloc16` -> Matter node id, scoped per Thread network. rloc16 is only
 * unique within a network, so a global rloc16 map would mis-attach diagnostic
 * edges from one network onto a Matter device on another. Keyed via {@link diagRlocKey}.
 */
export function buildMatterRloc16ByXp(nodes: Record<string, TopologySourceNode>): Map<string, string> {
    const map = new Map<string, string>();
    for (const node of Object.values(nodes)) {
        const rloc16 = getThreadRloc16(node);
        const xp = getThreadExtendedPanId(node);
        if (rloc16 === undefined || xp === undefined) continue;
        map.set(diagRlocKey(xp.toString(16).padStart(16, "0"), rloc16), String(node.node_id));
    }
    return map;
}

/**
 * Resolve a diagnostic node to the graph node id it is actually rendered under:
 * a commissioned Matter device (by extMac), a known Border Router (`br_<xa>`), a
 * neighbor-inferred unknown, or — when it matches none — its own diagnostic id.
 * Mirrors the precedence in {@link findDiagnosticMeshNodes} so edges target the
 * same node those materialize, rather than a phantom `thread_`/`meshrloc_` id.
 */
function diagnosticGraphNodeId(
    node: ThreadDiagnosticsNode,
    extPanIdHex: string,
    matterExtAddrMap: Map<bigint, string>,
    borderRouters: ReadonlyMap<string, BorderRouterEntry>,
    unknownIdByExt: Map<string, string>,
): string {
    const up = node.extMacAddress?.toUpperCase();
    if (up !== undefined) {
        const matterId = matterExtAddrMap.get(BigInt(`0x${up}`));
        if (matterId !== undefined) return matterId;
        if (borderRouters.has(up)) return `br_${up}`;
        const unknownId = unknownIdByExt.get(up);
        if (unknownId !== undefined) return unknownId;
    }
    return diagnosticNodeId(node, extPanIdHex);
}

/**
 * `extPanId:rloc16` -> graph node id across diagnostic batches, layered UNDER the
 * Matter rloc16 map. Resolves route64/childTable references within the referencing
 * node's own network to whatever id that node is drawn as (Matter / `br_` /
 * `unknown_` / diagnostic). Keyed via {@link diagRlocKey}.
 */
export function buildDiagnosticRloc16Map(
    batches: ReadonlyMap<string, ThreadDiagnosticsBatch>,
    matterRloc16ByXp: Map<string, string>,
    matterExtAddrMap: Map<bigint, string>,
    borderRouters: ReadonlyMap<string, BorderRouterEntry>,
    unknownDevices: ThreadExternalDevice[],
): Map<string, string> {
    const unknownIdByExt = new Map<string, string>();
    for (const d of unknownDevices) unknownIdByExt.set(d.extAddressHex.toUpperCase(), d.id);

    const map = new Map<string, string>();
    for (const batch of batches.values()) {
        for (const node of batch.nodes) {
            if (node.rloc16 === undefined) continue;
            // Matter device on THIS network (by rloc16) wins.
            if (matterRloc16ByXp.has(diagRlocKey(batch.extPanIdHex, node.rloc16))) continue;
            map.set(
                diagRlocKey(batch.extPanIdHex, node.rloc16),
                diagnosticGraphNodeId(node, batch.extPanIdHex, matterExtAddrMap, borderRouters, unknownIdByExt),
            );
        }
    }
    return map;
}

/**
 * Build a per-network rloc16 resolver: a Matter device on the same Thread network
 * wins, else the diagnostic node id within the same extPanId. Returns undefined
 * when unresolved. Both lookups are keyed by `extPanId:rloc16` so identical rloc16
 * values across networks never cross-attach.
 */
export function makeDiagnosticRloc16Resolver(
    matterRloc16ByXp: Map<string, string>,
    diagRloc16Map: Map<string, string>,
): (rloc16: number, extPanIdHex: string) => string | undefined {
    return (rloc16, extPanIdHex) =>
        matterRloc16ByXp.get(diagRlocKey(extPanIdHex, rloc16)) ?? diagRloc16Map.get(diagRlocKey(extPanIdHex, rloc16));
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
    nodes: Record<string, TopologySourceNode>,
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

/** Determine signal level from a Thread neighbor's LQI. */
export function getSignalLevel(neighbor: ThreadNeighbor): SignalLevel {
    return getSignalLevelFromLqi(neighbor.lqi);
}

/**
 * Map an LQI value (0-3 in practice on OpenThread) to a signal level.
 * 0 = "none" (no recent valid frames — stale/dead link).
 */
export function getSignalLevelFromLqi(lqi: number): SignalLevel {
    if (lqi <= 0) return "none";
    if (lqi > LQI_STRONG_THRESHOLD) return "strong";
    if (lqi > LQI_MEDIUM_THRESHOLD) return "medium";
    return "weak";
}

/**
 * Materialize mesh nodes that exist only in diagnostics: router records and
 * childTable children whose rloc16/extMac matches no Matter device, BR, or
 * already-found unknown. Matter/BR/unknown matches are enriched in place, not
 * duplicated.
 */
export function findDiagnosticMeshNodes(
    batches: ReadonlyMap<string, ThreadDiagnosticsBatch>,
    matterRloc16ByXp: Map<string, string>,
    matterExtAddrMap: Map<bigint, string>,
    borderRouters: ReadonlyMap<string, BorderRouterEntry>,
    unknownDevices: ThreadExternalDevice[],
): DiagnosticMeshNode[] {
    const unknownExt = new Set<string>(unknownDevices.map(d => d.extAddressHex.toUpperCase()));
    const out = new Map<string, DiagnosticMeshNode>();

    const matchesExisting = (extPanIdHex: string, rloc16: number | undefined, extHex?: string): boolean => {
        if (rloc16 !== undefined && matterRloc16ByXp.has(diagRlocKey(extPanIdHex, rloc16))) return true;
        if (extHex !== undefined) {
            const up = extHex.toUpperCase();
            if (matterExtAddrMap.has(BigInt(`0x${up}`))) return true;
            if (borderRouters.has(up)) return true;
            if (unknownExt.has(up)) return true;
        }
        return false;
    };

    for (const batch of batches.values()) {
        for (const node of batch.nodes) {
            // Only materialize a node for the responding router itself (a route64
            // participant). Its childTable children are leaf end devices — surfaced
            // as a count on the router, not as individual floating nodes — unless a
            // child is itself a commissioned Matter device, which already has a node.
            if (node.rloc16 === undefined) continue;
            if (matchesExisting(batch.extPanIdHex, node.rloc16, node.extMacAddress)) continue;
            const id = diagnosticNodeId(node, batch.extPanIdHex);
            out.set(id, {
                kind: "diagnostic",
                id,
                rloc16: node.rloc16,
                extAddressHex: node.extMacAddress?.toUpperCase(),
                isRouter: (node.rloc16 & 0x3ff) === 0,
                vendorName: node.vendorName,
                childCount: node.childTable?.length ?? 0,
                networkName: batch.networkName,
            });
        }
    }
    return [...out.values()];
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
    nodes: Record<string, TopologySourceNode>,
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
            // No bidirectional LQI = both lqiIn and lqiOut are 0 → treat as no-link.
            const signalLevel: SignalLevel =
                bidirectionalLqi !== undefined ? getSignalLevelFromLqi(bidirectionalLqi) : "none";

            const edge: ThreadConnection = {
                fromNodeId,
                toNodeId,
                signalLevel,
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
 * Merge route64 (router<->router) and childTable (router->child) edges from
 * diagnostics into an existing edge-pair map. Resolves references to graph node
 * ids via `resolveRloc16`; unresolved references are dropped (no phantom nodes).
 * Existing edges (Matter-sourced) take precedence per direction.
 */
export function mergeDiagnosticEdges(
    pairs: Map<string, ThreadEdgePair>,
    batches: ReadonlyMap<string, ThreadDiagnosticsBatch>,
    resolveRloc16: (rloc16: number, extPanIdHex: string) => string | undefined,
): void {
    const addEdge = (fromNodeId: string, toNodeId: string, lqi: number, pathCost?: number): void => {
        if (fromNodeId === toNodeId) return;
        const pairKey = makePairKey(fromNodeId, toNodeId);
        let pair = pairs.get(pairKey);
        if (pair === undefined) {
            const [nodeA, nodeB] = fromNodeId < toNodeId ? [fromNodeId, toNodeId] : [toNodeId, fromNodeId];
            pair = { pairKey, nodeA, nodeB };
            pairs.set(pairKey, pair);
        }
        const isFromA = fromNodeId === pair.nodeA;
        if (isFromA && pair.edgeAB) return; // existing (Matter) edge wins
        if (!isFromA && pair.edgeBA) return;
        const signalLevel = getSignalLevelFromLqi(lqi);
        const edge: ThreadConnection = {
            fromNodeId,
            toNodeId,
            signalLevel,
            lqi,
            rssi: null,
            pathCost,
            fromRouteTable: true,
        };
        if (isFromA) pair.edgeAB = edge;
        else pair.edgeBA = edge;
    };

    for (const batch of batches.values()) {
        for (const node of batch.nodes) {
            if (node.rloc16 === undefined) continue;
            const xp = batch.extPanIdHex;
            const fromId = resolveRloc16(node.rloc16, xp) ?? diagnosticNodeId(node, xp);
            const routerId = (node.rloc16 >> 10) & 0x3f;
            if (node.route64 !== undefined) {
                for (const e of node.route64.entries) {
                    if (e.routerId === routerId) continue;
                    const toId = resolveRloc16((e.routerId << 10) & 0xffff, xp);
                    if (toId === undefined) continue;
                    addEdge(fromId, toId, e.linkQualityIn, e.routeCost);
                }
            }
            if (node.childTable !== undefined) {
                for (const child of node.childTable) {
                    const childRloc16 = ((routerId << 10) | child.childId) & 0xffff;
                    // Only link children that are themselves a real graph node (a
                    // commissioned Matter device). Non-Matter leaves are a count on
                    // the parent, not floating nodes — so don't invent an edge.
                    const toId = resolveRloc16(childRloc16, xp);
                    if (toId === undefined) continue;
                    addEdge(fromId, toId, child.incomingLinkQuality);
                }
            }
        }
    }
}

/**
 * Parses WiFi diagnostics from a node's attributes.
 * Cluster 0x36/54 - WiFi Network Diagnostics.
 */
export function getWiFiDiagnostics(node: TopologySourceNode): WiFiDiagnostics {
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
