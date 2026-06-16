/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { AccessControlEntry, MatterClient } from "@matter-server/ws-client";
import {
    Privilege,
    aclEntryKey,
    attributeArray,
    entriesForFabric,
    nodeFabricIndex,
    nodeIdKey,
} from "../../../util/access-control.js";
import { AccessControlEntryDataTransformer, type AccessControlEntryStruct } from "./model.js";

function toApiAcl(e: AccessControlEntryStruct): AccessControlEntry {
    return {
        privilege: e.privilege,
        auth_mode: e.authMode,
        subjects: e.subjects ?? null,
        targets:
            e.targets?.map(t => ({
                cluster: t.cluster ?? null,
                endpoint: t.endpoint ?? null,
                device_type: t.deviceType ?? null,
            })) ?? null,
    };
}

/** Read the node's ACL fresh (explicit reads are not fabric-filtered) and narrow to our fabric. */
async function freshOurAcl(client: MatterClient, nodeId: number | bigint): Promise<AccessControlEntryStruct[]> {
    const res = await client.readAttribute(nodeId, "0/31/0");
    const all = attributeArray(res["0/31/0"]).map(v => AccessControlEntryDataTransformer.transform(v));
    const node = client.nodes[nodeIdKey(nodeId)];
    return entriesForFabric(all, node ? nodeFabricIndex(node) : undefined);
}

export async function addAclEntry(
    client: MatterClient,
    nodeId: number | bigint,
    entry: AccessControlEntryStruct,
): Promise<void> {
    const acl = await freshOurAcl(client, nodeId);
    acl.push(entry);
    await client.setACLEntry(nodeId, acl.map(toApiAcl));
}

export async function deleteAclEntry(client: MatterClient, nodeId: number | bigint, key: string): Promise<void> {
    const acl = await freshOurAcl(client, nodeId);
    let removed = false;
    const kept = acl.filter(e => {
        if (!removed && aclEntryKey(e) === key) {
            removed = true;
            return false;
        }
        return true;
    });
    await client.setACLEntry(nodeId, kept.map(toApiAcl));
}

/** Downgrade the given entries (by key) to Operate privilege. */
export async function downgradeToOperate(
    client: MatterClient,
    nodeId: number | bigint,
    keys: Set<string>,
): Promise<void> {
    const acl = await freshOurAcl(client, nodeId);
    const updated = acl.map(e => (keys.has(aclEntryKey(e)) ? { ...e, privilege: Privilege.Operate } : e));
    await client.setACLEntry(nodeId, updated.map(toApiAcl));
}
