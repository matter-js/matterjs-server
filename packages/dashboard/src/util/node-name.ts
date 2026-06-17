/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterNode } from "@matter-server/ws-client";

/**
 * Human-readable display name for a node: nodeLabel, else productName (serialNumber), else a
 * generic fallback. Shared so node pickers and tables name devices consistently.
 */
export function getDeviceName(node: MatterNode): string {
    if (node.nodeLabel) return node.nodeLabel;
    const productName = node.productName || "Unknown Device";
    const serialNumber = node.serialNumber;
    return serialNumber ? `${productName} (${serialNumber})` : productName;
}
