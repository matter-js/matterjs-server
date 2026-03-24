/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

const MAX_SAFE_NODE_ID = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Safely converts a node ID (which may be a bigint) to a number.
 * Throws if the value exceeds Number.MAX_SAFE_INTEGER.
 */
export function safeNodeIdToNumber(nodeId: number | bigint): number {
    if (typeof nodeId === "number") return nodeId;
    if (nodeId > MAX_SAFE_NODE_ID) {
        throw new Error(`Node ID ${nodeId} exceeds Number.MAX_SAFE_INTEGER and cannot be safely converted`);
    }
    return Number(nodeId);
}
