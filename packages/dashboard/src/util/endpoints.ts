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
 * Orders endpoints into parent-first tree order using each endpoint's Descriptor PartsList
 * (attribute 29/3). PartsList on an ancestor also lists indirect descendants, so for each
 * endpoint we keep only the closest parent (the one whose own PartsList doesn't contain
 * another candidate parent that also lists the endpoint).
 */
export function getEndpointTree(node: MatterNode, endpointIds: number[]): EndpointTreeNode[] {
    const idSet = new Set(endpointIds);
    const partsList = new Map<number, number[]>(
        endpointIds.map(id => {
            const raw = node.attributes[`${id}/29/3`];
            const list = Array.isArray(raw) ? (raw as number[]) : [];
            return [id, list.filter(childId => idSet.has(childId) && childId !== id)];
        }),
    );
    const partsSet = new Map<number, Set<number>>([...partsList].map(([id, list]) => [id, new Set(list)]));

    const children = new Map<number, number[]>();
    const hasParent = new Set<number>();
    for (const id of endpointIds) {
        const descendants = partsList.get(id)!;
        const directChildren = descendants
            .filter(child => !descendants.some(other => other !== child && partsSet.get(other)!.has(child)))
            .sort((a, b) => a - b);
        children.set(id, directChildren);
        for (const child of directChildren) hasParent.add(child);
    }

    const roots = endpointIds.filter(id => !hasParent.has(id)).sort((a, b) => a - b);
    const ordered: EndpointTreeNode[] = [];
    const visited = new Set<number>();
    const visit = (id: number, depth: number) => {
        if (visited.has(id)) return;
        visited.add(id);
        ordered.push({ endpointId: id, depth });
        for (const child of children.get(id)!) visit(child, depth + 1);
    };
    for (const root of roots) visit(root, 0);
    // PartsList cycles can leave every endpoint marked as someone's child (no roots) or
    // strand nodes unreached; fall back to emitting anything still unvisited as a root
    // so malformed device data never makes endpoints disappear from the list.
    for (const id of [...endpointIds].sort((a, b) => a - b)) visit(id, 0);
    return ordered;
}
