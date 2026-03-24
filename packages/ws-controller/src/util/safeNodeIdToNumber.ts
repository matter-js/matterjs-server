/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

const MAX_SAFE_NODE_ID = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Safely converts a node ID (which may be a bigint) to a number.
 * The node ID must be a non-negative safe integer.
 * Throws if the value is negative or exceeds Number.MAX_SAFE_INTEGER.
 */
export function safeNodeIdToNumber(nodeId: number | bigint): number {
    if (typeof nodeId === "number") {
        if (!Number.isSafeInteger(nodeId) || nodeId < 0) {
            throw new RangeError(`Node ID ${nodeId} is not a non-negative safe integer and cannot be safely converted`);
        }
        return nodeId;
    }
    if (nodeId < 0n) {
        throw new RangeError(`Node ID ${nodeId} is negative and cannot be safely converted`);
    }
    if (nodeId > MAX_SAFE_NODE_ID) {
        throw new RangeError(`Node ID ${nodeId} exceeds Number.MAX_SAFE_INTEGER and cannot be safely converted`);
    }
    return Number(nodeId);
}
