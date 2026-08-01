/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { AccessControlEntry, MatterClient } from "@matter-server/ws-client";
import { Privilege, aclEntryKey, attributeArray, entriesForFabric } from "../../../util/access-control.js";
import { requireWriteSuccess } from "../../../util/matter-status.js";
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

/**
 * Read the node's ACL + CurrentFabricIndex fresh and narrow to our fabric. Fails rather than risk
 * writing back other fabrics' entries if the index is unknown.
 */
async function freshOurAcl(client: MatterClient, nodeId: number | bigint): Promise<AccessControlEntryStruct[]> {
    const res = await client.readAttribute(nodeId, ["0/31/0", "0/62/5"], undefined, true);
    // A read reports per-path failures by omitting the path, and the ACL is rewritten whole — an
    // absent list would be written back as an empty one, locking every controller out of the node.
    if (!("0/31/0" in res)) {
        throw new Error(`Could not read the access control list (0/31/0) from node ${nodeId}`);
    }
    const all = attributeArray(res["0/31/0"]).map(v => AccessControlEntryDataTransformer.transform(v));
    const fi = res["0/62/5"];
    if (typeof fi !== "number") {
        throw new Error(`Cannot determine the current fabric index (0/62/5) for node ${nodeId}`);
    }
    return entriesForFabric(all, fi);
}

export async function addAclEntry(
    client: MatterClient,
    nodeId: number | bigint,
    entry: AccessControlEntryStruct,
): Promise<void> {
    const acl = await freshOurAcl(client, nodeId);
    acl.push(entry);
    requireWriteSuccess(await client.setACLEntry(nodeId, acl.map(toApiAcl)), "Writing the access control list failed");
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
    requireWriteSuccess(await client.setACLEntry(nodeId, kept.map(toApiAcl)), "Writing the access control list failed");
}

/** Downgrade the given entries (by key) to Operate privilege. */
export async function downgradeToOperate(
    client: MatterClient,
    nodeId: number | bigint,
    keys: Set<string>,
): Promise<void> {
    const acl = await freshOurAcl(client, nodeId);
    const updated = acl.map(e => (keys.has(aclEntryKey(e)) ? { ...e, privilege: Privilege.Operate } : e));
    requireWriteSuccess(
        await client.setACLEntry(nodeId, updated.map(toApiAcl)),
        "Writing the access control list failed",
    );
}
