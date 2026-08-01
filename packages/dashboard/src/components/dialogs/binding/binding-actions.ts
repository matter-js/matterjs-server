/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { AccessControlEntry, BindingTarget, MatterClient, MatterNode } from "@matter-server/ws-client";
import {
    AuthMode,
    Privilege,
    attributeArray,
    entriesForFabric,
    entryMatchesTarget,
    isWholeNode,
    nodeIdKey,
    subjectsInclude,
} from "../../../util/access-control.js";
import { BINDING_CLUSTER_ID, sameBindingTarget } from "../../../util/binding.js";
import { requireWriteSuccess } from "../../../util/matter-status.js";
import { AccessControlEntryDataTransformer, type AccessControlEntryStruct } from "../acl/model.js";
import { BindingEntryDataTransformer, type BindingEntryStruct } from "./model.js";

function toBindingTarget(e: BindingEntryStruct): BindingTarget {
    return { node: e.node ?? null, group: e.group ?? null, endpoint: e.endpoint ?? null, cluster: e.cluster ?? null };
}

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

function requireFabricIndex(res: Record<string, unknown>, nodeId: number | bigint): number {
    const fi = res["0/62/5"];
    if (typeof fi !== "number") {
        throw new Error(`Cannot determine the current fabric index (0/62/5) for node ${nodeId}`);
    }
    return fi;
}

/**
 * A read reports per-path failures by omitting the path, and these lists are rewritten whole — an
 * absent list would be written back as an empty one, wiping every entry of our fabric.
 */
function requireList(res: Record<string, unknown>, path: string, nodeId: number | bigint): unknown {
    if (!(path in res)) {
        throw new Error(`Could not read ${path} from node ${nodeId}`);
    }
    return res[path];
}

/**
 * Read the node's ACL + CurrentFabricIndex fresh and narrow to our fabric. Fails rather than risk
 * writing back other fabrics' entries if the index is unknown.
 */
async function freshOurAcl(client: MatterClient, nodeId: number | bigint): Promise<AccessControlEntryStruct[]> {
    const res = await client.readAttribute(nodeId, ["0/31/0", "0/62/5"], undefined, true);
    const all = attributeArray(requireList(res, "0/31/0", nodeId)).map(v =>
        AccessControlEntryDataTransformer.transform(v),
    );
    return entriesForFabric(all, requireFabricIndex(res, nodeId));
}

async function freshOurBindings(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
): Promise<BindingEntryStruct[]> {
    const path = `${endpoint}/${BINDING_CLUSTER_ID}/0`;
    const res = await client.readAttribute(nodeId, [path, "0/62/5"], undefined, true);
    const all = attributeArray(requireList(res, path, nodeId)).map(v => BindingEntryDataTransformer.transform(v));
    const fabricIndex = requireFabricIndex(res, nodeId);
    return all.filter(b => b.fabricIndex === fabricIndex);
}

function hasTarget(e: AccessControlEntryStruct, endpoint: number, cluster: number | undefined): boolean {
    return (e.targets ?? []).some(t => t.endpoint === endpoint && t.cluster === cluster);
}

function aclTargetsMax(client: MatterClient, nodeId: number | bigint): number {
    const raw = client.nodes[nodeIdKey(nodeId)]?.attributes["0/31/3"];
    return typeof raw === "number" && raw > 0 ? raw : Number.MAX_SAFE_INTEGER;
}

/** Ensure the target grants the source an Operate ACL for {endpoint, cluster}, merging where possible. */
export async function ensureBindingAcl(
    client: MatterClient,
    sourceNodeId: number | bigint,
    targetNodeId: number | bigint,
    targetEndpoint: number,
    cluster: number | undefined,
): Promise<void> {
    // A self-binding (source == target) needs no ACL — a node always has access to itself.
    if (nodeIdKey(targetNodeId) === nodeIdKey(sourceNodeId)) return;

    const acl = await freshOurAcl(client, targetNodeId);

    const alreadyGranted = acl.some(
        e =>
            e.authMode === AuthMode.Case &&
            e.privilege >= Privilege.Operate &&
            subjectsInclude(e, sourceNodeId) &&
            entryMatchesTarget(e, targetEndpoint, cluster),
    );
    if (alreadyGranted) return;

    const targetsMax = aclTargetsMax(client, targetNodeId);
    const reusable = acl.find(
        e =>
            e.authMode === AuthMode.Case &&
            e.privilege >= Privilege.Operate &&
            subjectsInclude(e, sourceNodeId) &&
            (isWholeNode(e) || hasTarget(e, targetEndpoint, cluster) || (e.targets?.length ?? 0) < targetsMax),
    );
    if (reusable) {
        if (!isWholeNode(reusable) && !hasTarget(reusable, targetEndpoint, cluster)) {
            reusable.targets = reusable.targets ?? [];
            reusable.targets.push({ endpoint: targetEndpoint, cluster, deviceType: undefined });
        }
    } else {
        acl.push({
            privilege: Privilege.Operate,
            authMode: AuthMode.Case,
            subjects: [sourceNodeId],
            targets: [{ endpoint: targetEndpoint, cluster, deviceType: undefined }],
            fabricIndex: 0,
        });
    }
    requireWriteSuccess(
        await client.setACLEntry(targetNodeId, acl.map(toApiAcl)),
        "Writing the access control list on the target node failed",
    );
}

/** Downgrade an over-privileged (>Operate) binding ACL on the target back to Operate. */
export async function fixOverPrivilegedBindingAcl(
    client: MatterClient,
    sourceNodeId: number | bigint,
    targetNodeId: number | bigint,
    targetEndpoint: number,
    cluster: number | undefined,
): Promise<void> {
    const acl = await freshOurAcl(client, targetNodeId);
    const updated = acl.map(e =>
        e.authMode === AuthMode.Case &&
        subjectsInclude(e, sourceNodeId) &&
        e.privilege > Privilege.Operate &&
        entryMatchesTarget(e, targetEndpoint, cluster)
            ? { ...e, privilege: Privilege.Operate }
            : e,
    );
    requireWriteSuccess(
        await client.setACLEntry(targetNodeId, updated.map(toApiAcl)),
        "Writing the access control list on the target node failed",
    );
}

export async function addBinding(
    client: MatterClient,
    sourceNode: MatterNode,
    sourceEndpoint: number,
    targetNodeId: number | bigint,
    targetEndpoint: number,
    cluster: number | undefined,
): Promise<void> {
    await ensureBindingAcl(client, sourceNode.node_id, targetNodeId, targetEndpoint, cluster);

    const bindings = await freshOurBindings(client, sourceNode.node_id, sourceEndpoint);
    const targetKey = nodeIdKey(targetNodeId);
    const exists = bindings.some(
        b =>
            b.node != null && nodeIdKey(b.node) === targetKey && b.endpoint === targetEndpoint && b.cluster === cluster,
    );
    if (exists) return;
    bindings.push({ node: targetNodeId, group: undefined, endpoint: targetEndpoint, cluster, fabricIndex: undefined });
    try {
        requireWriteSuccess(
            await client.setNodeBinding(sourceNode.node_id, sourceEndpoint, bindings.map(toBindingTarget)),
            "Writing the binding table failed",
        );
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        throw new Error(
            `${detail}. An access grant for this node was already added on the target and may need cleanup.`,
        );
    }
}

/**
 * Remove the binding naming `target`, then drop the matching target from the source's ACL entry on
 * the (binding) target node — that cleanup matches on the binding's TARGET endpoint + cluster.
 *
 * The binding itself is identified by its fields rather than by a row index: the caller's list comes
 * from the attribute cache while this one is re-read, so the two need not be positionally aligned.
 * A target that is no longer present is the desired end state, so it resolves without writing.
 */
export async function deleteBinding(
    client: MatterClient,
    sourceNode: MatterNode,
    sourceEndpoint: number,
    target: BindingEntryStruct,
): Promise<void> {
    const bindings = await freshOurBindings(client, sourceNode.node_id, sourceEndpoint);
    const index = bindings.findIndex(b => sameBindingTarget(b, target));
    const removed = bindings[index];
    if (!removed) return;
    const updated = [...bindings.slice(0, index), ...bindings.slice(index + 1)];
    requireWriteSuccess(
        await client.setNodeBinding(sourceNode.node_id, sourceEndpoint, updated.map(toBindingTarget)),
        "Writing the binding table failed",
    );

    if (removed.node == null || removed.endpoint == null) return;
    // A self-binding never created an ACL entry, so there is nothing to clean up.
    if (nodeIdKey(removed.node) === nodeIdKey(sourceNode.node_id)) return;
    const targetEndpoint = removed.endpoint;
    const removedCluster = removed.cluster;
    try {
        const acl = await freshOurAcl(client, removed.node);
        const kept = acl
            .map(e => {
                if (!subjectsInclude(e, sourceNode.node_id) || isWholeNode(e)) return e;
                const targets = e.targets!.filter(
                    t => !(t.endpoint === targetEndpoint && t.cluster === removedCluster),
                );
                if (targets.length === 0) return undefined;
                return { ...e, targets };
            })
            .filter((e): e is AccessControlEntryStruct => e !== undefined);
        requireWriteSuccess(
            await client.setACLEntry(removed.node, kept.map(toApiAcl)),
            "Writing the access control list failed",
        );
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        throw new Error(
            `Binding removed, but cleaning up the access control entry on the target node failed: ${detail}. ` +
                "The target may retain a stale access grant.",
        );
    }
}
