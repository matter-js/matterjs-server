/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterNode } from "@matter-server/ws-client";
import { type DeviceType, device_types } from "../client/models/descriptions.js";

export function getEndpointDeviceTypes(node: MatterNode, endpoint: number): DeviceType[] {
    const rawValues = node.attributes[`${endpoint}/29/0`] as Record<string, number>[] | undefined;
    if (!rawValues) return new Array<DeviceType>();
    return rawValues.map(rawValue => {
        const id = rawValue["0"] ?? rawValue["deviceType"];
        return device_types[id] ?? { id: id ?? -1, label: `Unknown Device Type (${id})`, clusters: [] };
    });
}

export interface EndpointTreeNode {
    endpointId: number;
    depth: number;
}

/**
 * Orders endpoints into parent-first tree order, resolving each endpoint to its closest parent.
 *
 * An endpoint's PartsList may enumerate its whole family - every descendant, not just the direct
 * children - which is the pattern a bridge uses. Of the endpoints listing a given endpoint, the
 * closest one is therefore the endpoint that lists none of the others; on contradictory lists the
 * smaller family wins, then the lower endpoint number, and a parent is only accepted while the
 * relations stay a tree. The Python client resolves the structure of a node by the same rule
 * (`MatterNode._map_endpoint_parents`), so both show the same hierarchy for the same node.
 */
export function getEndpointTree(node: MatterNode, endpointIds: number[]): EndpointTreeNode[] {
    const idSet = new Set(endpointIds);
    const families = new Map<number, Set<number>>(
        endpointIds.map(id => {
            const raw = node.attributes[`${id}/29/3`];
            const list = Array.isArray(raw) ? (raw as number[]) : [];
            return [id, new Set(list.filter(childId => idSet.has(childId) && childId !== id))];
        }),
    );

    const candidates = new Map<number, number[]>();
    for (const [parentId, family] of families) {
        for (const childId of family) {
            const parents = candidates.get(childId);
            if (parents === undefined) {
                candidates.set(childId, [parentId]);
            } else {
                parents.push(parentId);
            }
        }
    }

    const parents = new Map<number, number>();
    for (const childId of [...candidates.keys()].sort((a, b) => a - b)) {
        const parentIds = candidates.get(childId)!;
        const ranked = [...parentIds].sort((a, b) => {
            const depthA = parentIds.filter(other => other !== a && families.get(a)!.has(other)).length;
            const depthB = parentIds.filter(other => other !== b && families.get(b)!.has(other)).length;
            return depthA - depthB || families.get(a)!.size - families.get(b)!.size || a - b;
        });
        for (const parentId of ranked) {
            if (!reaches(parentId, childId, parents)) {
                parents.set(childId, parentId);
                break;
            }
        }
    }

    const children = new Map<number, number[]>(endpointIds.map(id => [id, []]));
    for (const [childId, parentId] of parents) {
        children.get(parentId)!.push(childId);
    }
    for (const list of children.values()) {
        list.sort((a, b) => a - b);
    }

    const ordered = new Array<EndpointTreeNode>();
    const visited = new Set<number>();
    const visit = (id: number, depth: number) => {
        if (visited.has(id)) return;
        visited.add(id);
        ordered.push({ endpointId: id, depth });
        for (const child of children.get(id)!) visit(child, depth + 1);
    };
    for (const id of [...endpointIds].sort((a, b) => a - b)) {
        if (!parents.has(id)) visit(id, 0);
    }
    for (const id of [...endpointIds].sort((a, b) => a - b)) visit(id, 0);
    return ordered;
}

/** Whether walking up the parent chain from an endpoint arrives at another. */
function reaches(startId: number, targetId: number, parents: Map<number, number>): boolean {
    const seen = new Set<number>();
    let current: number | undefined = startId;
    while (current !== undefined && !seen.has(current)) {
        if (current === targetId) return true;
        seen.add(current);
        current = parents.get(current);
    }
    return false;
}
