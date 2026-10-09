/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClientNode, InternalError, NodeId } from "@matter/main";

export function nodeIdOf(node: ClientNode): NodeId {
    const nodeId = node.peerAddress?.nodeId;
    if (nodeId === undefined) {
        throw new InternalError(`Node ${node.id} has no peer address`);
    }
    return nodeId;
}
