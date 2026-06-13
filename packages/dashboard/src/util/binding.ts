/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterNode } from "@matter-server/ws-client";
import { BindingEntryDataTransformer, type BindingEntryStruct } from "../components/dialogs/binding/model.js";
import {
    AuthMode,
    Privilege,
    entriesForFabric,
    entryMatchesTarget,
    readAclEntries,
    subjectsInclude,
} from "./access-control.js";

const BINDING_KEY_RE = /^(\d+)\/30\/0$/;

export function readBindings(node: MatterNode, endpoint: number): BindingEntryStruct[] {
    const raw = node.attributes[`${endpoint}/30/0`] as unknown[] | undefined;
    if (!raw) return new Array<BindingEntryStruct>();
    return Object.values(raw).map(value => BindingEntryDataTransformer.transform(value));
}

export interface EndpointBinding {
    endpoint: number;
    binding: BindingEntryStruct;
}

export function readAllBindings(node: MatterNode): EndpointBinding[] {
    const result = new Array<EndpointBinding>();
    for (const key of Object.keys(node.attributes)) {
        const m = BINDING_KEY_RE.exec(key);
        if (!m) continue;
        const endpoint = Number(m[1]);
        const raw = node.attributes[key] as unknown[] | undefined;
        if (!raw) continue;
        for (const value of Object.values(raw)) {
            result.push({ endpoint, binding: BindingEntryDataTransformer.transform(value) });
        }
    }
    return result;
}

function numberList(node: MatterNode, key: string): number[] {
    const raw = node.attributes[key];
    if (!Array.isArray(raw)) return new Array<number>();
    return raw.map(v => Number(v));
}

export function targetServerClusters(node: MatterNode, endpoint: number): number[] {
    return numberList(node, `${endpoint}/29/1`);
}

export function sourceClientClusters(node: MatterNode, endpoint: number): number[] {
    return numberList(node, `${endpoint}/29/2`);
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

export type ReverseAclState = "present" | "missing" | "cannotVerify";

export interface ReverseAclResult {
    state: ReverseAclState;
}

export function reverseAclState(
    sourceNodeId: number | bigint,
    binding: BindingEntryStruct,
    targetNode: MatterNode | undefined,
    fabricIndex?: number,
): ReverseAclResult {
    if (!targetNode || !targetNode.available) return { state: "cannotVerify" };
    const entries = entriesForFabric(readAclEntries(targetNode), fabricIndex);
    const found = entries.some(
        e =>
            e.authMode === AuthMode.Case &&
            e.privilege >= Privilege.Operate &&
            subjectsInclude(e, sourceNodeId) &&
            entryMatchesTarget(e, binding.endpoint ?? -1, binding.cluster),
    );
    return { state: found ? "present" : "missing" };
}

export interface AddBindingCapacity {
    canAdd: boolean;
    reason?: string;
}

/**
 * A new binding consumes a target ACL slot only when no existing our-fabric Operate+ entry for the
 * source can absorb it — mirrors the merge behavior the writer implements.
 */
export function targetAclCapacityForBinding(
    targetNode: MatterNode,
    sourceNodeId: number | bigint,
    fabricIndex?: number,
): AddBindingCapacity {
    const entries = entriesForFabric(readAclEntries(targetNode), fabricIndex);
    const reusable = entries.some(
        e => e.authMode === AuthMode.Case && e.privilege >= Privilege.Operate && subjectsInclude(e, sourceNodeId),
    );
    if (reusable) return { canAdd: true };
    const maxRaw = targetNode.attributes["0/31/4"];
    const max = typeof maxRaw === "number" ? maxRaw : 0;
    if (max > 0 && entries.length >= max) {
        return { canAdd: false, reason: "Target node's access control list is full." };
    }
    return { canAdd: true };
}
