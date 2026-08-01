/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterNode } from "@matter-server/ws-client";
import type { AccessControlEntryStruct } from "../components/dialogs/acl/model.js";
import { BindingEntryDataTransformer, type BindingEntryStruct } from "../components/dialogs/binding/model.js";
import {
    AuthMode,
    Privilege,
    attributeArray,
    entriesForFabric,
    entryMatchesTarget,
    isWholeNode,
    nodeFabricIndex,
    nodeIdKey,
    readAclEntries,
    subjectsInclude,
} from "./access-control.js";

export const BINDING_CLUSTER_ID = 30;

const BINDING_KEY_RE = new RegExp(`^(\\d+)/${BINDING_CLUSTER_ID}/0$`);

export function readBindings(node: MatterNode, endpoint: number): BindingEntryStruct[] {
    return attributeArray(node.attributes[`${endpoint}/${BINDING_CLUSTER_ID}/0`]).map(value =>
        BindingEntryDataTransformer.transform(value),
    );
}

/**
 * The endpoint's binding entries that belong to our fabric, or all of them while the node's
 * CurrentFabricIndex is still uncached. Rendering a binding row uses this so the row set matches
 * what a write's fabric-scoped re-read will act on.
 */
export function readOurBindings(node: MatterNode, endpoint: number): BindingEntryStruct[] {
    const fabricIndex = nodeFabricIndex(node);
    return readBindings(node, endpoint).filter(b => fabricIndex === undefined || b.fabricIndex === fabricIndex);
}

/** Whether two entries name the same binding target — the identity a delete has to match on. */
export function sameBindingTarget(a: BindingEntryStruct, b: BindingEntryStruct): boolean {
    const key = (id: number | bigint | undefined) => (id == null ? "" : nodeIdKey(id));
    return key(a.node) === key(b.node) && a.group === b.group && a.endpoint === b.endpoint && a.cluster === b.cluster;
}

export interface EndpointBinding {
    endpoint: number;
    binding: BindingEntryStruct;
}

/** Every endpoint's binding entries of our fabric, on the same terms as {@link readOurBindings}. */
export function readAllBindings(node: MatterNode): EndpointBinding[] {
    const fabricIndex = nodeFabricIndex(node);
    const result = new Array<EndpointBinding>();
    for (const key of Object.keys(node.attributes)) {
        const m = BINDING_KEY_RE.exec(key);
        if (!m) continue;
        const endpoint = Number(m[1]);
        for (const value of attributeArray(node.attributes[key])) {
            const binding = BindingEntryDataTransformer.transform(value);
            if (fabricIndex !== undefined && binding.fabricIndex !== fabricIndex) continue;
            result.push({ endpoint, binding });
        }
    }
    return result;
}

function numberList(node: MatterNode, key: string): number[] {
    return attributeArray(node.attributes[key]).map(v => Number(v));
}

export function targetServerClusters(node: MatterNode, endpoint: number): number[] {
    return numberList(node, `${endpoint}/29/1`);
}

export function sourceClientClusters(node: MatterNode, endpoint: number): number[] {
    return numberList(node, `${endpoint}/29/2`);
}

/**
 * Client clusters on the endpoint that an existing binding of our fabric already covers.
 *
 * Per the Binding cluster spec an entry with no Cluster field covers every client cluster on the
 * endpoint — whole-endpoint unicast and group bindings both take that form. The fabric filter keeps
 * the result correct even if a caller ever populates the cache from an unfiltered read.
 */
export function boundClientClusterIds(node: MatterNode, endpoint: number): Set<number> {
    const bindings = readOurBindings(node, endpoint);
    const bound = new Set(bindings.map(b => b.cluster).filter((c): c is number => c !== undefined));
    if (bindings.some(b => b.cluster === undefined && (b.group !== undefined || b.endpoint !== undefined))) {
        for (const cluster of sourceClientClusters(node, endpoint)) bound.add(cluster);
    }
    return bound;
}

export interface BindableClusters {
    bindable: number[];
    otherTarget: number[];
}

export function bindableClusters(
    source: MatterNode,
    sourceEndpoint: number,
    target: MatterNode,
    targetEndpoint: number,
): BindableClusters {
    const client = new Set(sourceClientClusters(source, sourceEndpoint));
    const server = targetServerClusters(target, targetEndpoint);
    const bindable = new Array<number>();
    const otherTarget = new Array<number>();
    for (const c of server) {
        if (client.has(c)) bindable.push(c);
        else otherTarget.push(c);
    }
    return { bindable, otherTarget };
}

export type ReverseAclState = "present" | "missing" | "overPrivileged" | "cannotVerify" | "self";

export interface ReverseAclResult {
    state: ReverseAclState;
}

/**
 * Whether the target node's ACL grants the source the access this binding needs:
 *  - self:           target is the source node itself — no ACL needed
 *  - present:        a matching CASE entry at Operate exists
 *  - overPrivileged: the only matching grant is above Operate (Manage/Administer)
 *  - missing:        no matching grant (or only below Operate)
 *  - cannotVerify:   target node not known / offline
 */
export function reverseAclState(
    sourceNodeId: number | bigint,
    binding: BindingEntryStruct,
    targetNode: MatterNode | undefined,
): ReverseAclResult {
    if (binding.node != null && nodeIdKey(binding.node) === nodeIdKey(sourceNodeId)) return { state: "self" };
    if (!targetNode || !targetNode.available) return { state: "cannotVerify" };
    const matching = entriesForFabric(readAclEntries(targetNode), nodeFabricIndex(targetNode)).filter(
        e =>
            e.authMode === AuthMode.Case &&
            subjectsInclude(e, sourceNodeId) &&
            entryMatchesTarget(e, binding.endpoint ?? -1, binding.cluster),
    );
    const granting = matching.filter(e => e.privilege >= Privilege.Operate);
    if (granting.length === 0) return { state: "missing" };
    if (granting.some(e => e.privilege === Privilege.Operate)) return { state: "present" };
    return { state: "overPrivileged" };
}

export type RelationshipKind = "none" | "backs" | "overPrivileged";

export interface RelationshipResult {
    kind: RelationshipKind;
    sourceNodeId?: number | bigint;
    sourceEndpoint?: number;
}

/**
 * Whether an ACL entry on the viewed node backs a real binding from one of its subjects. Grants
 * above Operate are flagged over-privileged (Operate is sufficient for a binding).
 */
export function detectBindingRelationship(
    entry: AccessControlEntryStruct,
    viewedNodeId: number | bigint,
    allNodes: MatterNode[],
): RelationshipResult {
    if (entry.authMode !== AuthMode.Case) return { kind: "none" };
    const viewedKey = nodeIdKey(viewedNodeId);

    for (const subject of entry.subjects ?? []) {
        const sourceKey = nodeIdKey(subject);
        const source = allNodes.find(n => nodeIdKey(n.node_id) === sourceKey);
        if (!source || !source.available) continue;
        for (const { endpoint, binding } of readAllBindings(source)) {
            if (binding.node == null) continue;
            if (nodeIdKey(binding.node) !== viewedKey) continue;
            if (!entryMatchesTarget(entry, binding.endpoint ?? -1, binding.cluster)) continue;
            const kind: RelationshipKind = entry.privilege > Privilege.Operate ? "overPrivileged" : "backs";
            return { kind, sourceNodeId: source.node_id, sourceEndpoint: endpoint };
        }
    }
    return { kind: "none" };
}

export interface AddBindingCapacity {
    canAdd: boolean;
    reason?: string;
}

/**
 * A new binding consumes a target ACL slot only when no existing our-fabric Operate+ entry for the
 * source can absorb it — mirrors the merge behavior the writer implements.
 */
export function targetAclCapacityForBinding(targetNode: MatterNode, sourceNodeId: number | bigint): AddBindingCapacity {
    // A self-binding (target is the source node) needs no ACL entry, so no capacity is consumed.
    if (nodeIdKey(targetNode.node_id) === nodeIdKey(sourceNodeId)) return { canAdd: true };
    const fabricIndex = nodeFabricIndex(targetNode);
    // Advisory pre-check only. If CurrentFabricIndex isn't cached for this target yet, don't block:
    // the write path (ensureBindingAcl → freshOurAcl) reads 0/62/5 fresh and fails cleanly if absent.
    if (fabricIndex === undefined) return { canAdd: true };
    const entries = entriesForFabric(readAclEntries(targetNode), fabricIndex);
    const targetsMaxRaw = targetNode.attributes["0/31/3"];
    const targetsMax = typeof targetsMaxRaw === "number" && targetsMaxRaw > 0 ? targetsMaxRaw : Number.MAX_SAFE_INTEGER;
    const reusable = entries.some(
        e =>
            e.authMode === AuthMode.Case &&
            e.privilege >= Privilege.Operate &&
            subjectsInclude(e, sourceNodeId) &&
            (isWholeNode(e) || (e.targets?.length ?? 0) < targetsMax),
    );
    if (reusable) return { canAdd: true };
    const maxRaw = targetNode.attributes["0/31/4"];
    const max = typeof maxRaw === "number" ? maxRaw : 0;
    if (max > 0 && entries.length >= max) {
        return { canAdd: false, reason: "Target node's access control list is full." };
    }
    return { canAdd: true };
}
