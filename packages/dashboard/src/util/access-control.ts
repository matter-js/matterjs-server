/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterNode } from "@matter-server/ws-client";
import { AccessControlEntryDataTransformer, type AccessControlEntryStruct } from "../components/dialogs/acl/model.js";

export enum Privilege {
    View = 1,
    ProxyView = 2,
    Operate = 3,
    Manage = 4,
    Administer = 5,
}

export enum AuthMode {
    Pase = 1,
    Case = 2,
    Group = 3,
}

export const PRIVILEGE_NAMES: Record<number, string> = {
    [Privilege.View]: "View",
    [Privilege.ProxyView]: "ProxyView",
    [Privilege.Operate]: "Operate",
    [Privilege.Manage]: "Manage",
    [Privilege.Administer]: "Administer",
};

export const AUTH_MODE_NAMES: Record<number, string> = {
    [AuthMode.Pase]: "PASE",
    [AuthMode.Case]: "CASE",
    [AuthMode.Group]: "Group",
};

export function nodeIdKey(id: number | bigint): string {
    return String(id);
}

/** Normalize a raw attribute value (array or index-keyed object, or absent) into an element array. */
export function attributeArray(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return Object.values(value);
    return new Array<unknown>();
}

export function readAclEntries(node: MatterNode): AccessControlEntryStruct[] {
    return attributeArray(node.attributes["0/31/0"]).map(value => AccessControlEntryDataTransformer.transform(value));
}

export function entriesForFabric(
    entries: AccessControlEntryStruct[],
    fabricIndex: number | undefined,
): AccessControlEntryStruct[] {
    if (fabricIndex === undefined) return entries;
    return entries.filter(e => e.fabricIndex === fabricIndex);
}

/**
 * The device-side fabric index for our controller's fabric, read from CurrentFabricIndex (0/62/5).
 * ACL/Binding entries carry this index in their fabricIndex field — NOT the controller's own
 * fabric-table index (serverInfo.fabric_index), which lives in a different numbering space.
 */
export function nodeFabricIndex(node: MatterNode): number | undefined {
    const v = node.attributes["0/62/5"];
    return typeof v === "number" ? v : undefined;
}

export function isWholeNode(entry: AccessControlEntryStruct): boolean {
    return !entry.targets || entry.targets.length === 0;
}

/**
 * Whether the entry grants access to (endpoint, cluster). A null target endpoint/cluster is an ACL
 * wildcard (grants all). Cluster matching is directional: a wildcard *request* (cluster undefined,
 * i.e. an all-clusters binding) is only covered by a wildcard ACL target — a cluster-specific grant
 * does not cover "all clusters".
 */
export function entryMatchesTarget(
    entry: AccessControlEntryStruct,
    endpoint: number,
    cluster: number | undefined,
): boolean {
    if (isWholeNode(entry)) return true;
    return entry.targets!.some(t => {
        const endpointMatch = t.endpoint == null || t.endpoint === endpoint;
        const clusterMatch = cluster == null ? t.cluster == null : t.cluster == null || t.cluster === cluster;
        return endpointMatch && clusterMatch;
    });
}

export interface AclCapacity {
    max: number;
    subjectsMax: number;
    targetsMax: number;
}

export function aclCapacity(node: MatterNode): AclCapacity {
    const num = (key: string, fallback: number) => {
        const v = node.attributes[key];
        return typeof v === "number" ? v : fallback;
    };
    return { max: num("0/31/4", 0), subjectsMax: num("0/31/2", 0), targetsMax: num("0/31/3", 0) };
}

/**
 * Stable structural identity for an ACL entry, used to re-locate it in a freshly-read list before a
 * write (the cache copy and the fresh copy are different objects).
 */
export function aclEntryKey(entry: AccessControlEntryStruct): string {
    const subjects = (entry.subjects ?? []).map(nodeIdKey).sort();
    const targets = (entry.targets ?? [])
        .map(t => `${t.endpoint ?? ""}:${t.cluster ?? ""}:${t.deviceType ?? ""}`)
        .sort();
    return JSON.stringify([entry.fabricIndex, entry.privilege, entry.authMode, subjects, targets]);
}

export function subjectsInclude(entry: AccessControlEntryStruct, nodeId: number | bigint): boolean {
    const key = nodeIdKey(nodeId);
    return (entry.subjects ?? []).some(s => nodeIdKey(s) === key);
}

export function isProtectedAdmin(
    entry: AccessControlEntryStruct,
    controllerNodeId: number | bigint | undefined,
): boolean {
    if (controllerNodeId === undefined) return false;
    return (
        entry.privilege === Privilege.Administer &&
        entry.authMode === AuthMode.Case &&
        subjectsInclude(entry, controllerNodeId)
    );
}
