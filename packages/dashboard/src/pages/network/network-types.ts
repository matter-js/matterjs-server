/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BorderRouterEntry } from "@matter-server/ws-client";

/**
 * Network type detected from NetworkCommissioning cluster feature map.
 */
export type NetworkType = "thread" | "wifi" | "ethernet" | "unknown";

/**
 * Classification of a Thread mesh link based on LQI.
 * "none" means LQI=0 — neighbor entry exists but no recent valid frames (dead/stale link).
 */
export type SignalLevel = "strong" | "medium" | "weak" | "none";

/**
 * Thread routing role from ThreadNetworkDiagnostics cluster.
 * Attribute 0/53/1 (RoutingRole)
 */
export enum ThreadRoutingRole {
    Unspecified = 0,
    Unassigned = 1,
    SleepyEndDevice = 2,
    EndDevice = 3,
    REED = 4, // Router-Eligible End Device
    Router = 5,
    Leader = 6,
}

/**
 * Thread neighbor table entry from ThreadNetworkDiagnostics cluster.
 * Attribute 0/53/7 (NeighborTable)
 */
export interface ThreadNeighbor {
    /** Extended address of the neighbor (64-bit) */
    extAddress: bigint;
    /** Age of the entry in seconds */
    age: number;
    /** RLOC16 (Router Locator) */
    rloc16: number;
    /** Link frame counter */
    linkFrameCounter: number;
    /** MLE frame counter */
    mleFrameCounter: number;
    /**
     * Link Quality Indicator. Spec types as uint8 (0-255), but OpenThread reports
     * 0-3 in practice. 0 = no recent valid frames (dead/stale link).
     */
    lqi: number;
    /** Average RSSI in dBm (nullable) */
    avgRssi: number | null;
    /** Last RSSI in dBm (nullable) */
    lastRssi: number | null;
    /** Frame error rate (0-255) */
    frameErrorRate: number;
    /** Message error rate (0-255) */
    messageErrorRate: number;
    /** Whether RX is on when idle */
    rxOnWhenIdle: boolean;
    /** Whether this is a full Thread device */
    fullThreadDevice: boolean;
    /** Whether this is a full network data device */
    fullNetworkData: boolean;
    /** Whether the link is established */
    isChild: boolean;
}

/**
 * Thread route table entry from ThreadNetworkDiagnostics cluster.
 * Attribute 0/53/8 (RouteTable)
 */
export interface ThreadRoute {
    /** Extended address of the destination */
    extAddress: bigint;
    /** RLOC16 of the destination */
    rloc16: number;
    /** Router ID */
    routerId: number;
    /** Next hop RLOC16 */
    nextHop: number;
    /** Path cost */
    pathCost: number;
    /** LQI in (0-3 on OpenThread; 0 = no link). */
    lqiIn: number;
    /** LQI out (0-3 on OpenThread; 0 = no link). */
    lqiOut: number;
    /** Age of the route */
    age: number;
    /** Whether this is allocated */
    allocated: boolean;
    /** Whether link is established */
    linkEstablished: boolean;
}

/**
 * Categorized devices by network type.
 * Node IDs are stored as strings to avoid BigInt precision loss.
 */
export interface CategorizedDevices {
    thread: string[];
    wifi: string[];
    ethernet: string[];
    unknown: string[];
}

/**
 * Thread mesh connection between two nodes.
 */
export interface ThreadConnection {
    fromNodeId: number | string;
    toNodeId: number | string;
    signalColor: string;
    signalLevel: SignalLevel;
    lqi: number;
    rssi: number | null;
    /** Path cost from route table (1 = direct, higher = multi-hop). Only available for routers. */
    pathCost?: number;
    /** Bidirectional LQI from route table (average of lqiIn and lqiOut) */
    bidirectionalLqi?: number;
    /** Whether this connection was supplemented by route table data (vs neighbor table only) */
    fromRouteTable?: boolean;
}

/**
 * A pair of Thread nodes with their directional edge data.
 * Each connected pair has 0-2 edges (one per neighbor/route table direction).
 */
export interface ThreadEdgePair {
    /** Canonical pair key (sorted node IDs joined by "|") */
    pairKey: string;
    /** First node ID (lexicographically smaller) */
    nodeA: string;
    /** Second node ID (lexicographically larger) */
    nodeB: string;
    /** Edge where nodeA reports nodeB as neighbor */
    edgeAB?: ThreadConnection;
    /** Edge where nodeB reports nodeA as neighbor */
    edgeBA?: ThreadConnection;
}

/**
 * Unknown Thread device seen in neighbor tables but not commissioned.
 */
export interface UnknownThreadDevice {
    kind: "unknown";
    /** Unique ID for the unknown device (prefixed with 'unknown_') */
    id: string;
    /** Extended address as hex string */
    extAddressHex: string;
    /** Extended address as BigInt */
    extAddress: bigint;
    /** Node IDs that see this device as a neighbor (as strings to avoid BigInt precision loss) */
    seenBy: string[];
    /** Whether this device appears to be a router */
    isRouter: boolean;
    /** Best signal strength seen */
    bestRssi: number | null;
    /**
     * Extended PAN ID (16-char uppercase hex) inherited from the commissioned node that
     * reports this neighbor. All Thread neighbors share the observing node's network.
     */
    extendedPanIdHex?: string;
    /**
     * Friendly Thread network name resolved by joining {@link extendedPanIdHex} against the
     * Border Router registry. Some BR vendors (e.g. Apple, Aqara) use a stable border-agent
     * ID as the MeshCoP `xa` while the actual Thread radio MAC differs, so the BR can show
     * up as both a known BR and an "unknown" router on the same network.
     */
    networkName?: string;
}

/**
 * Thread Border Router enriched via mDNS.
 *
 * Same neighbor-table aggregate fields as UnknownThreadDevice (seenBy, isRouter, bestRssi),
 * plus all BorderRouterEntry fields (network name, vendor, addresses, etc.).
 */
export interface KnownBorderRouter extends BorderRouterEntry {
    kind: "br";
    /** DOM/graph ID, formatted "br_<XAHEX>". */
    id: string;
    /** Convenience copy of extAddressHex as bigint, mirroring UnknownThreadDevice. */
    extAddress: bigint;
    /** Commissioned node IDs whose neighbor table sees this xa. */
    seenBy: string[];
    /** Inferred from neighbor entry. */
    isRouter: boolean;
    /** Best signal strength seen across observers. */
    bestRssi: number | null;
}

/**
 * External Thread device discriminated union — either a recognized Border Router
 * or an unidentified neighbor.
 */
export type ThreadExternalDevice = KnownBorderRouter | UnknownThreadDevice;

/**
 * Network graph node data for vis.js.
 */
export interface NetworkGraphNode {
    id: number | string;
    label: string;
    image: string;
    shape: "image";
    networkType: NetworkType;
    threadRole?: ThreadRoutingRole;
    /** Whether the node is offline */
    offline?: boolean;
    /** Whether this is an unknown/external device */
    isUnknown?: boolean;
    /** Physics group: "connected" or "disconnected" */
    group?: "connected" | "disconnected";
    /** Whether the node should be hidden */
    hidden?: boolean;
}

/**
 * Network graph edge data for vis.js.
 */
export interface NetworkGraphEdge {
    id: number | string;
    from: number | string;
    to: number | string;
    color: {
        color: string;
        highlight: string;
    };
    width: number;
    title?: string;
    /** Whether to show as dashed line */
    dashes?: boolean;
    /** Whether the edge should be hidden */
    hidden?: boolean;
    /** vis.js arrow configuration: shorthand string ("to", "from", "") or
     * object form for explicit head sizing on dashed edges. */
    arrows?: string | { to?: { enabled: boolean; scaleFactor: number } };
    /** The edge pair key this belongs to (Thread graph dedup/highlight) */
    pairKey?: string;
    /** Which node reported this connection from its neighbor/route table */
    reportingNodeId?: number | string;
}
