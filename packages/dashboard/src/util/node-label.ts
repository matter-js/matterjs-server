/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterClient, MatterNode } from "@matter-server/ws-client";

// BasicInformation cluster (0x28 / 40), always on endpoint 0 per Matter specification.
export const NODE_LABEL_CLUSTER_ID = 0x28;
export const NODE_LABEL_ATTRIBUTE_ID = 5;
export const MAX_NODE_LABEL_LENGTH = 32;

export const NODE_LABEL_ATTRIBUTE_PATH = `0/${NODE_LABEL_CLUSTER_ID}/${NODE_LABEL_ATTRIBUTE_ID}`;

/**
 * Write the BasicInformation NodeLabel attribute for a node.
 * Trims surrounding whitespace so the stored value matches what MatterNode.nodeLabel reads back.
 */
export function writeNodeLabel(client: MatterClient, node: MatterNode, label: string): Promise<unknown> {
    return client.writeAttribute(node.node_id, NODE_LABEL_ATTRIBUTE_PATH, label.trim());
}
