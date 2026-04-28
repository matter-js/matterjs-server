/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { FabricIndex, NodeId } from "@matter/main";
import { PeerAddress } from "@matter/main/protocol";

/**
 * Format a NodeId or PeerAddress as a string for logging.
 * Uses the Matter address format: @fabricIndexDecimal:nodeIdHex (e.g., "@1:a", "@10:1f").
 *
 * @returns Formatted PeerAddress string like "@1:a", "@10:1f", or "@?:1f" when fabric index is unknown.
 */
export function formatNodeId(peer: PeerAddress): string;
export function formatNodeId(nodeId: NodeId, fabricIndex?: FabricIndex): string;
export function formatNodeId(arg: NodeId | PeerAddress, fabricIndex?: FabricIndex): string {
    const [nodeId, resolvedFabricIndex] = typeof arg === "object" ? [arg.nodeId, arg.fabricIndex] : [arg, fabricIndex];
    const fabricIndexPart = resolvedFabricIndex === undefined ? "?" : resolvedFabricIndex.toString(10);
    return `@${fabricIndexPart}:${nodeId.toString(16)}`;
}
