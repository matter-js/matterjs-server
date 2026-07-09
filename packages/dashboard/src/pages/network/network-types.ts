/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NetworkType, ThreadRoutingRole } from "@matter-server/ws-client";

// The network topology data model + derivation now lives in @matter-server/ws-client
// so the server can reuse it. Re-exported here so existing dashboard imports of
// "./network-types.js" keep resolving unchanged.
export type {
    CategorizedDevices,
    DiagnosticMeshNode,
    KnownBorderRouter,
    NetworkType,
    SignalLevel,
    ThreadConnection,
    ThreadEdgePair,
    ThreadExternalDevice,
    ThreadNeighbor,
    ThreadRoute,
    UnknownThreadDevice,
    WiFiDiagnostics,
} from "@matter-server/ws-client";
export { ThreadRoutingRole } from "@matter-server/ws-client";

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
