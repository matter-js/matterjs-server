/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { FabricIndex, NodeId } from "@matter/main";

/**
 * Format a NodeId as a PeerAddress string for logging.
 * Uses the Matter address format: @fabricIndexDecimal:nodeIdHex (e.g., "@1:a", "@10:1f").
 *
 * @param nodeId The node ID to format (rendered in hexadecimal)
 * @param fabricIndex The fabric index (rendered in decimal). If omitted or unknown, "?" is used.
 * @returns Formatted PeerAddress string like "@1:a", "@10:1f", or "@?:1f" when fabric index is unknown.
 */
export function formatNodeId(nodeId: NodeId, fabricIndex?: FabricIndex): string {
    const fabricIndexPart = fabricIndex === undefined ? "?" : fabricIndex.toString(10);
    return `@${fabricIndexPart}:${nodeId.toString(16)}`;
}
