/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { GroupId, NodeId, UINT32_MAX } from "@matter/main";

const TEMPORARY_LOCAL_MIN = NodeId.fromTemporaryLocalNodeId(0);
const TEMPORARY_LOCAL_MAX = NodeId.fromTemporaryLocalNodeId(UINT32_MAX);

const PAKE_KEY_MIN = NodeId.getFromPakeKeyIdentifier(0);
const PAKE_KEY_MAX = NodeId.getFromPakeKeyIdentifier(UINT32_MAX);

/**
 * What a Node ID names, as far as the commands of this server can act on it.
 *
 * @see Matter Core specification § 2.5.5, Table 4 "Node Identifier Allocations"
 */
export type NodeIdTarget =
    /**
     * One node: the Operational range names a commissioned node, and the Temporary Local range is
     * where this server allocates the test nodes it imports from a diagnostic dump.
     */
    | { readonly kind: "node" }
    /**
     * A set of nodes. `write_attribute` and `device_command` multicast to it; every other command
     * needs one node's answer and refuses it.
     */
    | { readonly kind: "group"; readonly className: string }
    /**
     * Nothing a command can act on: an access-control subject (a CASE Authenticated Tag, a PAKE key
     * identifier), a value that names nothing (the Unspecified Node ID, the Null Group ID), or a
     * range the specification has not assigned.
     */
    | { readonly kind: "unusable"; readonly className: string };

/**
 * Classify `nodeId`. It must already be inside the 64 bits a node id has: a wider or negative value
 * is reported as reserved, which is not a class it belongs to.
 *
 * @see Matter Core specification § 2.5.5, Table 4 "Node Identifier Allocations"
 */
export function nodeIdTarget(nodeId: NodeId): NodeIdTarget {
    if (NodeId.isOperationalNodeId(nodeId)) {
        return { kind: "node" };
    }
    if (nodeId >= TEMPORARY_LOCAL_MIN && nodeId <= TEMPORARY_LOCAL_MAX) {
        return { kind: "node" };
    }
    if (GroupId.isGroupNodeId(nodeId)) {
        if (GroupId.fromNodeId(nodeId) === GroupId.NO_GROUP_ID) {
            return { kind: "unusable", className: "the Null Group ID" };
        }
        return { kind: "group", className: "a Group Node ID" };
    }
    if (nodeId === NodeId.UNSPECIFIED_NODE_ID) {
        return { kind: "unusable", className: "the Unspecified Node ID" };
    }
    if (NodeId.isCaseAuthenticatedTag(nodeId)) {
        return { kind: "unusable", className: "a CASE Authenticated Tag" };
    }
    if (nodeId >= PAKE_KEY_MIN && nodeId <= PAKE_KEY_MAX) {
        return { kind: "unusable", className: "a PAKE key identifier" };
    }
    return { kind: "unusable", className: "a reserved Node ID" };
}
