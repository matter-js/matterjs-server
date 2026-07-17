/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Loader for a controller-side groups configuration file. Reads a JSON document
 * describing group key sets and group-to-keyset bindings, and applies them to the
 * underlying CommissioningController's FabricGroups at startup.
 *
 * Intended for certification / test setups that need chip-tool's `groupsettings`
 * equivalents pre-configured on the controller. Not part of the public WebSocket API.
 */

import { MatterController } from "@matter-server/ws-controller";
import { Bytes, Logger } from "@matter/main";
import { GroupId } from "@matter/main/types";
import { GroupKeyManagement } from "@matter/types/clusters/group-key-management";
import { readFile } from "node:fs/promises";

const logger = Logger.get("GroupsConfig");

type SecurityPolicy = "TrustFirst" | "CacheAndSync";
type MulticastPolicy = "PerGroupId" | "AllNodes";
type AddressPolicy = "IanaAddr" | "PerGroupId";

interface RawKeySet {
    groupKeySetId: number;
    epochKey0: string;
    epochStartTime0: number | null;
    epochKey1?: string | null;
    epochStartTime1?: number | null;
    epochKey2?: string | null;
    epochStartTime2?: number | null;
    groupKeySecurityPolicy: SecurityPolicy;
    groupKeyMulticastPolicy?: MulticastPolicy | null;
    label?: string;
}

interface RawGroupKeyMap {
    groupId: number;
    groupKeySetId: number;
    addressPolicy?: AddressPolicy | null;
    label?: string;
}

interface RawGroupsConfig {
    keySets: RawKeySet[];
    groupKeyMap: RawGroupKeyMap[];
}

function toSecurityPolicy(value: SecurityPolicy): GroupKeyManagement.GroupKeySecurityPolicy {
    switch (value) {
        case "TrustFirst":
            return GroupKeyManagement.GroupKeySecurityPolicy.TrustFirst;
        case "CacheAndSync":
            return GroupKeyManagement.GroupKeySecurityPolicy.CacheAndSync;
        default:
            throw new Error(`Unknown groupKeySecurityPolicy: ${value as string}`);
    }
}

function toMulticastPolicy(
    value: MulticastPolicy | null | undefined,
): GroupKeyManagement.GroupKeyMulticastPolicy | undefined {
    if (value === null || value === undefined) return undefined;
    switch (value) {
        case "PerGroupId":
            return GroupKeyManagement.GroupKeyMulticastPolicy.PerGroupId;
        case "AllNodes":
            return GroupKeyManagement.GroupKeyMulticastPolicy.AllNodes;
        default:
            throw new Error(`Unknown groupKeyMulticastPolicy: ${value as string}`);
    }
}

function toAddressPolicy(value: AddressPolicy | null | undefined): "ianaAddr" | "perGroupId" | undefined {
    if (value === null || value === undefined) return undefined;
    switch (value) {
        case "IanaAddr":
            return "ianaAddr";
        case "PerGroupId":
            return "perGroupId";
        default:
            throw new Error(`Unknown addressPolicy: ${value as string}`);
    }
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(`Invalid groups config: ${message}`);
}

function parseConfig(raw: unknown): RawGroupsConfig {
    assert(typeof raw === "object" && raw !== null, "top-level must be an object");
    const obj = raw as Record<string, unknown>;
    assert(Array.isArray(obj.keySets), "`keySets` must be an array");
    assert(Array.isArray(obj.groupKeyMap), "`groupKeyMap` must be an array");

    const keySets: RawKeySet[] = (obj.keySets as unknown[]).map((entry, index) => {
        assert(typeof entry === "object" && entry !== null, `keySets[${index}] must be an object`);
        const k = entry as Record<string, unknown>;
        assert(typeof k.groupKeySetId === "number", `keySets[${index}].groupKeySetId must be a number`);
        assert(typeof k.epochKey0 === "string", `keySets[${index}].epochKey0 must be a hex string`);
        assert(
            typeof k.groupKeySecurityPolicy === "string",
            `keySets[${index}].groupKeySecurityPolicy must be a string`,
        );
        return {
            groupKeySetId: k.groupKeySetId,
            epochKey0: k.epochKey0,
            epochStartTime0: (k.epochStartTime0 as number | null) ?? null,
            epochKey1: (k.epochKey1 as string | null | undefined) ?? null,
            epochStartTime1: (k.epochStartTime1 as number | null | undefined) ?? null,
            epochKey2: (k.epochKey2 as string | null | undefined) ?? null,
            epochStartTime2: (k.epochStartTime2 as number | null | undefined) ?? null,
            groupKeySecurityPolicy: k.groupKeySecurityPolicy as SecurityPolicy,
            groupKeyMulticastPolicy: (k.groupKeyMulticastPolicy as MulticastPolicy | null | undefined) ?? null,
            label: (k.label as string | undefined) ?? (k._comment as string | undefined),
        };
    });

    const groupKeyMap: RawGroupKeyMap[] = (obj.groupKeyMap as unknown[]).map((entry, index) => {
        assert(typeof entry === "object" && entry !== null, `groupKeyMap[${index}] must be an object`);
        const m = entry as Record<string, unknown>;
        assert(typeof m.groupId === "number", `groupKeyMap[${index}].groupId must be a number`);
        assert(typeof m.groupKeySetId === "number", `groupKeyMap[${index}].groupKeySetId must be a number`);
        return {
            groupId: m.groupId,
            groupKeySetId: m.groupKeySetId,
            addressPolicy: (m.addressPolicy as AddressPolicy | null | undefined) ?? null,
            label: (m.label as string | undefined) ?? (m._comment as string | undefined),
        };
    });

    return { keySets, groupKeyMap };
}

/**
 * Load and apply the groups configuration file. Safe to call after the controller has started.
 */
export async function loadGroupsConfig(path: string, controller: MatterController): Promise<void> {
    let content: string;
    try {
        content = await readFile(path, "utf-8");
    } catch (err) {
        throw new Error(`Failed to read groups config file '${path}': ${err instanceof Error ? err.message : err}`);
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(content);
    } catch (err) {
        throw new Error(`Groups config '${path}' is not valid JSON: ${err instanceof Error ? err.message : err}`);
    }

    const config = parseConfig(parsed);
    const groups = controller.groups;

    logger.info(
        `Applying groups config from ${path}: ${config.keySets.length} key set(s), ${config.groupKeyMap.length} group binding(s)`,
    );

    for (const keySet of config.keySets) {
        await groups.setFromGroupKeySet({
            groupKeySetId: keySet.groupKeySetId,
            epochKey0: Bytes.fromHex(keySet.epochKey0),
            epochStartTime0: keySet.epochStartTime0,
            epochKey1: keySet.epochKey1 ? Bytes.fromHex(keySet.epochKey1) : null,
            epochStartTime1: keySet.epochStartTime1 ?? null,
            epochKey2: keySet.epochKey2 ? Bytes.fromHex(keySet.epochKey2) : null,
            epochStartTime2: keySet.epochStartTime2 ?? null,
            groupKeySecurityPolicy: toSecurityPolicy(keySet.groupKeySecurityPolicy),
            groupKeyMulticastPolicy: toMulticastPolicy(keySet.groupKeyMulticastPolicy),
        });
        const keyCount = 1 + (keySet.epochKey1 ? 1 : 0) + (keySet.epochKey2 ? 1 : 0);
        const startTimes = [keySet.epochStartTime0, keySet.epochStartTime1, keySet.epochStartTime2]
            .filter(t => t !== null && t !== undefined)
            .join("/");
        const multicast = keySet.groupKeyMulticastPolicy ?? "default";
        const suffix = keySet.label ? ` — ${keySet.label}` : "";
        logger.info(
            `  keyset id=${keySet.groupKeySetId} (0x${keySet.groupKeySetId.toString(16)}), ` +
                `security=${keySet.groupKeySecurityPolicy}, multicast=${multicast}, ` +
                `keys=${keyCount}, startTimes=[${startTimes}]${suffix}`,
        );
    }

    const idMap = new Map<GroupId, number>();
    for (const binding of config.groupKeyMap) {
        const groupId = GroupId(binding.groupId);
        idMap.set(groupId, binding.groupKeySetId);
        const policy = toAddressPolicy(binding.addressPolicy);
        if (policy !== undefined) {
            groups.setGroupMulticastPolicy(groupId, policy);
        }
        const suffix = binding.label ? ` — ${binding.label}` : "";
        const addr = policy !== undefined ? `, address=${policy} (${groups.multicastAddressFor(groupId)})` : "";
        logger.info(
            `  group id=${binding.groupId} (0x${binding.groupId.toString(16)}) -> ` +
                `keyset ${binding.groupKeySetId} (0x${binding.groupKeySetId.toString(16)})${addr}${suffix}`,
        );
    }
    groups.groupKeyIdMap = idMap;

    logger.info("Groups config applied");
}
