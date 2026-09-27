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
 * Names the Node ID class `nodeId` falls in when no command of this server can address it, and
 * `undefined` when a command can. `nodeId` must already be inside the 64 bits a node id has: a wider
 * or negative value is reported as reserved, which is not a class it belongs to.
 *
 * Only two classes name something a command here can reach. An Operational Node ID names a
 * commissioned node. The Temporary Local range is where this server allocates the test nodes it
 * imports from a diagnostic dump, so refusing it would refuse ids this server hands out itself.
 *
 * Every other class identifies something else: an access-control subject (a CASE Authenticated Tag, a
 * PAKE key identifier), a value that never appears in a message (the Unspecified Node ID), a set of
 * nodes (a Group Node ID), or a range the specification has not assigned. Branding one and passing it
 * on reaches a node lookup, which answers `NODE_NOT_EXISTS` — a target no node id could ever name,
 * reported as one this server does not happen to hold.
 *
 * A Group Node ID is refused with the rest although matter.js can groupcast a write and an invoke to
 * one: every command that brands a node id here reports the device's own answer — `write_attribute`
 * its `Status`, `device_command` the command's response payload, `camera_start_stream` the
 * `WebRTCSessionID` — and a groupcast produces none, so accepting one would mean answering with a
 * status no device sent.
 *
 * @see Matter Core specification § 2.5.5, Table 4 "Node Identifier Allocations"
 */
export function unusableNodeIdClass(nodeId: NodeId): string | undefined {
    if (NodeId.isOperationalNodeId(nodeId)) {
        return undefined;
    }
    if (nodeId >= TEMPORARY_LOCAL_MIN && nodeId <= TEMPORARY_LOCAL_MAX) {
        return undefined;
    }
    if (GroupId.isGroupNodeId(nodeId)) {
        return "a Group Node ID";
    }
    if (nodeId === NodeId.UNSPECIFIED_NODE_ID) {
        return "the Unspecified Node ID";
    }
    if (NodeId.isCaseAuthenticatedTag(nodeId)) {
        return "a CASE Authenticated Tag";
    }
    if (nodeId >= PAKE_KEY_MIN && nodeId <= PAKE_KEY_MAX) {
        return "a PAKE key identifier";
    }
    return "a reserved Node ID";
}
