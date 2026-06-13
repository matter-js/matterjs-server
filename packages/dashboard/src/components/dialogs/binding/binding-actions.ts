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
    isWholeNode,
    nodeIdKey,
    subjectsInclude,
} from "../../../util/access-control.js";
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

async function freshAcl(client: MatterClient, nodeId: number | bigint): Promise<AccessControlEntryStruct[]> {
    const res = await client.readAttribute(nodeId, "0/31/0");
    return attributeArray(res["0/31/0"]).map(v => AccessControlEntryDataTransformer.transform(v));
}

async function freshBindings(
    client: MatterClient,
    nodeId: number | bigint,
    endpoint: number,
): Promise<BindingEntryStruct[]> {
    const res = await client.readAttribute(nodeId, `${endpoint}/30/0`);
    return attributeArray(res[`${endpoint}/30/0`]).map(v => BindingEntryDataTransformer.transform(v));
}

/**
 * Grant the source Operate access to the target (merging into an existing subject entry where
 * possible so no extra ACL slot is consumed), then add the binding. Both writes read the current
 * list fresh first to avoid clobbering concurrent changes.
 */
export async function addBinding(
    client: MatterClient,
    sourceNode: MatterNode,
    sourceEndpoint: number,
    targetNodeId: number | bigint,
    targetEndpoint: number,
    cluster: number | undefined,
    fabricIndex?: number,
): Promise<void> {
    const acl = entriesForFabric(await freshAcl(client, targetNodeId), fabricIndex);
    const targetsMax = aclTargetsMax(client, targetNodeId);
    const reusable = acl.find(
        e =>
            e.authMode === AuthMode.Case &&
            e.privilege >= Privilege.Operate &&
            subjectsInclude(e, sourceNode.node_id) &&
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
            subjects: [sourceNode.node_id],
            targets: [{ endpoint: targetEndpoint, cluster, deviceType: undefined }],
            fabricIndex: 0,
        });
    }
    await client.setACLEntry(targetNodeId, acl.map(toApiAcl));

    const bindings = await freshBindings(client, sourceNode.node_id, sourceEndpoint);
    bindings.push({ node: targetNodeId, group: undefined, endpoint: targetEndpoint, cluster, fabricIndex: undefined });
    await client.setNodeBinding(sourceNode.node_id, sourceEndpoint, bindings.map(toBindingTarget));
}

function hasTarget(e: AccessControlEntryStruct, endpoint: number, cluster: number | undefined): boolean {
    return (e.targets ?? []).some(t => t.endpoint === endpoint && (t.cluster ?? undefined) === cluster);
}

function aclTargetsMax(client: MatterClient, nodeId: number | bigint): number {
    const raw = client.nodes[nodeIdKey(nodeId)]?.attributes["0/31/3"];
    return typeof raw === "number" && raw > 0 ? raw : Number.MAX_SAFE_INTEGER;
}

/**
 * Remove the binding at `index`, then drop the matching target endpoint from the source's ACL
 * entry on the (binding) target node. Matches on the binding's TARGET endpoint.
 */
export async function deleteBindingAtIndex(
    client: MatterClient,
    sourceNode: MatterNode,
    sourceEndpoint: number,
    index: number,
    fabricIndex?: number,
): Promise<void> {
    const bindings = await freshBindings(client, sourceNode.node_id, sourceEndpoint);
    const removed = bindings[index];
    if (!removed) return;
    const updated = [...bindings.slice(0, index), ...bindings.slice(index + 1)];
    await client.setNodeBinding(sourceNode.node_id, sourceEndpoint, updated.map(toBindingTarget));

    if (removed.node == null || removed.endpoint == null) return;
    const targetEndpoint = removed.endpoint;
    const removedCluster = removed.cluster ?? undefined;
    const acl = entriesForFabric(await freshAcl(client, removed.node), fabricIndex);
    const kept = acl
        .map(e => {
            if (!subjectsInclude(e, sourceNode.node_id) || isWholeNode(e)) return e;
            const targets = e.targets!.filter(
                t => !(t.endpoint === targetEndpoint && (t.cluster ?? undefined) === removedCluster),
            );
            if (targets.length === 0) return undefined;
            return { ...e, targets };
        })
        .filter((e): e is AccessControlEntryStruct => e !== undefined);
    await client.setACLEntry(removed.node, kept.map(toApiAcl));
}
