/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

// Certification runs only, not an end-user feature: pre-provisions the controller fabric with the group keys a test
// case expects, so the controller can send groupcast. Will be removed again.

import { Bytes, Environment, Filesystem, GroupId, Logger, ServerNode } from "@matter/main";
import { GroupKeyManagement } from "@matter/main/clusters/group-key-management";
import { Fabric, FabricManager, GroupMulticastPolicy } from "@matter/main/protocol";
import { FabricIndex, MATTER_EPOCH_OFFSET_US } from "@matter/main/types";
import { join } from "node:path";

const logger = Logger.get("GroupKeyConfig");

export const CERT_CONTEXT_FILE = "cert-context.json";

export class CertContextError extends Error {}

export interface CertKeySet {
    groupKeySetId: number;
    groupKeySecurityPolicy: GroupKeyManagement.GroupKeySecurityPolicy;
    epochKey0: Bytes;
    epochStartTime0: bigint;
    epochKey1: Bytes | null;
    epochStartTime1: bigint | null;
    epochKey2: Bytes | null;
    epochStartTime2: bigint | null;
}

export interface CertGroupBinding {
    groupId: GroupId;
    groupKeySetId: number;
    addressPolicy?: GroupMulticastPolicy;
}

export interface CertContext {
    keySets: CertKeySet[];
    groupKeyMap: CertGroupBinding[];
}

const TOP_LEVEL_FIELDS = new Set(["keySets", "groupKeyMap", "_comment"]);
const KEY_SET_FIELDS = new Set([
    "groupKeySetId",
    "epochKey0",
    "epochStartTime0",
    "epochKey1",
    "epochStartTime1",
    "epochKey2",
    "epochStartTime2",
    "groupKeySecurityPolicy",
    "label",
    "_comment",
]);
const BINDING_FIELDS = new Set(["groupId", "groupKeySetId", "addressPolicy", "label", "_comment"]);

const SECURITY_POLICIES: Record<string, GroupKeyManagement.GroupKeySecurityPolicy> = {
    TrustFirst: GroupKeyManagement.GroupKeySecurityPolicy.TrustFirst,
    CacheAndSync: GroupKeyManagement.GroupKeySecurityPolicy.CacheAndSync,
};
const ADDRESS_POLICIES: Record<string, GroupMulticastPolicy> = {
    IanaAddr: "ianaAddr",
    PerGroupId: "perGroupId",
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUint(value: unknown, max: number): value is number {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= max;
}

function errorText(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

class Parser {
    constructor(readonly source: string) {}

    fail(path: string, problem: string): never {
        throw new CertContextError(`Invalid group key configuration ${this.source}: ${path} ${problem}`);
    }

    record(value: unknown, path: string, allowed: Set<string>) {
        if (!isRecord(value)) {
            this.fail(path, "must be an object");
        }
        for (const key of Object.keys(value)) {
            if (!allowed.has(key)) {
                this.fail(`${path}.${key}`, "is not a known field");
            }
        }
        return value;
    }

    array(value: unknown, path: string) {
        if (!Array.isArray(value)) {
            this.fail(path, "must be an array");
        }
        return value;
    }

    uint(value: unknown, path: string, max: number) {
        if (!isUint(value, max)) {
            this.fail(path, `must be an integer from 0 to ${max}`);
        }
        return value;
    }

    epochKey(value: unknown, path: string) {
        if (typeof value !== "string" || !/^[0-9a-fA-F]{32}$/.test(value)) {
            this.fail(path, "must be a 32 digit hex string (16 bytes)");
        }
        return Bytes.fromHex(value);
    }

    /**
     * Unix epoch microseconds, the unit matter.js keeps. Values before 2000-01-01, which matter.js cannot hold, count
     * from the Matter epoch instead, as chip-tool style files use them.
     */
    epochStartTime(value: unknown, path: string) {
        const time = BigInt(this.uint(value, path, Number.MAX_SAFE_INTEGER));
        return time < MATTER_EPOCH_OFFSET_US ? MATTER_EPOCH_OFFSET_US + time : time;
    }

    optionalEpoch(entry: Record<string, unknown>, path: string, slot: 1 | 2) {
        const key = entry[`epochKey${slot}`];
        const startTime = entry[`epochStartTime${slot}`];
        const keyAbsent = key === undefined || key === null;
        const startTimeAbsent = startTime === undefined || startTime === null;
        if (keyAbsent !== startTimeAbsent) {
            this.fail(`${path}.epochKey${slot}`, `and epochStartTime${slot} must be set together`);
        }
        if (keyAbsent) {
            return { key: null, startTime: null };
        }
        return {
            key: this.epochKey(key, `${path}.epochKey${slot}`),
            startTime: this.epochStartTime(startTime, `${path}.epochStartTime${slot}`),
        };
    }

    enumValue<T>(value: unknown, path: string, values: Record<string, T>) {
        if (typeof value !== "string" || !Object.hasOwn(values, value)) {
            this.fail(path, `must be one of ${Object.keys(values).join(", ")}`);
        }
        return values[value];
    }

    keySet(value: unknown, path: string): CertKeySet {
        const entry = this.record(value, path, KEY_SET_FIELDS);
        const groupKeySetId = this.uint(entry.groupKeySetId, `${path}.groupKeySetId`, 0xffff);
        if (groupKeySetId === 0) {
            this.fail(`${path}.groupKeySetId`, "must not be 0, which is the fabric IPK");
        }
        const epoch1 = this.optionalEpoch(entry, path, 1);
        const epoch2 = this.optionalEpoch(entry, path, 2);
        const keySet: CertKeySet = {
            groupKeySetId,
            groupKeySecurityPolicy: this.enumValue(
                entry.groupKeySecurityPolicy,
                `${path}.groupKeySecurityPolicy`,
                SECURITY_POLICIES,
            ),
            epochKey0: this.epochKey(entry.epochKey0, `${path}.epochKey0`),
            epochStartTime0: this.epochStartTime(entry.epochStartTime0, `${path}.epochStartTime0`),
            epochKey1: epoch1.key,
            epochStartTime1: epoch1.startTime,
            epochKey2: epoch2.key,
            epochStartTime2: epoch2.startTime,
        };
        if (keySet.epochStartTime1 === null && keySet.epochStartTime2 !== null) {
            this.fail(`${path}.epochKey2`, "needs epochKey1");
        }
        // matter.js sends with the newest started epoch key and expects the slots in start time order
        if (keySet.epochStartTime1 !== null && keySet.epochStartTime1 <= keySet.epochStartTime0) {
            this.fail(`${path}.epochStartTime1`, "must be greater than epochStartTime0");
        }
        if (
            keySet.epochStartTime1 !== null &&
            keySet.epochStartTime2 !== null &&
            keySet.epochStartTime2 <= keySet.epochStartTime1
        ) {
            this.fail(`${path}.epochStartTime2`, "must be greater than epochStartTime1");
        }
        return keySet;
    }

    binding(value: unknown, path: string, keySetIds: Set<number>): CertGroupBinding {
        const entry = this.record(value, path, BINDING_FIELDS);
        const groupId = GroupId(this.uint(entry.groupId, `${path}.groupId`, 0xffff));
        if (!GroupId.isApplicationGroupId(groupId)) {
            this.fail(`${path}.groupId`, "must be an application group id (1 to 0xfeff)");
        }
        const groupKeySetId = this.uint(entry.groupKeySetId, `${path}.groupKeySetId`, 0xffff);
        if (groupKeySetId === 0) {
            this.fail(`${path}.groupKeySetId`, "must not be 0, which is the fabric IPK");
        }
        if (!keySetIds.has(groupKeySetId)) {
            this.fail(`${path}.groupKeySetId`, `references key set ${groupKeySetId}, which keySets does not define`);
        }
        const binding: CertGroupBinding = { groupId, groupKeySetId };
        if (entry.addressPolicy !== undefined) {
            binding.addressPolicy = this.enumValue(entry.addressPolicy, `${path}.addressPolicy`, ADDRESS_POLICIES);
        }
        return binding;
    }

    context(value: unknown): CertContext {
        const root = this.record(value, "file", TOP_LEVEL_FIELDS);

        const keySets = new Array<CertKeySet>();
        const keySetIds = new Set<number>();
        this.array(root.keySets, "keySets").forEach((entry, index) => {
            const keySet = this.keySet(entry, `keySets[${index}]`);
            if (keySetIds.has(keySet.groupKeySetId)) {
                this.fail(`keySets[${index}].groupKeySetId`, `duplicates key set ${keySet.groupKeySetId}`);
            }
            keySetIds.add(keySet.groupKeySetId);
            keySets.push(keySet);
        });

        const groupKeyMap = new Array<CertGroupBinding>();
        const groupIds = new Set<number>();
        this.array(root.groupKeyMap, "groupKeyMap").forEach((entry, index) => {
            const binding = this.binding(entry, `groupKeyMap[${index}]`, keySetIds);
            if (groupIds.has(binding.groupId)) {
                this.fail(`groupKeyMap[${index}].groupId`, `duplicates group ${binding.groupId}`);
            }
            groupIds.add(binding.groupId);
            groupKeyMap.push(binding);
        });

        return { keySets, groupKeyMap };
    }
}

/** Parse and validate a certification context. Throws {@link CertContextError} naming the source and the problem. */
export function parseCertContext(text: string, source: string): CertContext {
    const parser: Parser = new Parser(source);
    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch (error) {
        parser.fail("file", `is not valid JSON: ${errorText(error)}`);
    }
    return parser.context(value);
}

/**
 * Read {@link CERT_CONTEXT_FILE} from the storage directory. Returns undefined when there is none, or when the server
 * subscribes on its own: certification runs drive every interaction themselves.
 */
export async function loadCertContext(
    environment: Environment,
    disableAutoSubscription: boolean,
): Promise<CertContext | undefined> {
    const fs = environment.maybeGet(Filesystem);
    if (fs === undefined) {
        return undefined;
    }
    const file = fs.file(CERT_CONTEXT_FILE);
    const path = join(fs.path, CERT_CONTEXT_FILE);
    if (!(await file.exists())) {
        return undefined;
    }
    if (!disableAutoSubscription) {
        logger.notice(`${path} ignored: only read with --disable-auto-subscription`);
        return undefined;
    }

    let text: string;
    try {
        text = await file.readAllText();
    } catch (error) {
        throw new CertContextError(`Cannot read group key configuration ${path}: ${errorText(error)}`);
    }

    const context = parseCertContext(text, path);
    logger.notice(
        `Loaded group key configuration from ${path}: ${context.keySets.length} key sets, ${context.groupKeyMap.length} groups`,
    );
    return context;
}

/**
 * Install the context into the runtime groups of the controller fabric, the ones the group send path reads. Nothing is
 * persisted and the GroupKeyManagement cluster state stays untouched, so its device limits do not apply; matter.js only
 * writes these runtime groups from that state, and it is empty on a controller. A fabric that matter.js replaces, as at
 * a NOC rotation, keeps these groups.
 */
export async function applyCertContext(node: ServerNode, fabricIndex: FabricIndex, context: CertContext) {
    try {
        await installInto(node.env.get(FabricManager).for(fabricIndex), context);
    } catch (error) {
        throw new CertContextError(`Cannot install group key configuration: ${errorText(error)}`);
    }
}

async function installInto({ groups }: Fabric, context: CertContext) {
    for (const keySet of context.keySets) {
        await groups.setFromGroupKeySet(keySet);
    }
    groups.groupKeyIdMap = new Map(context.groupKeyMap.map(({ groupId, groupKeySetId }) => [groupId, groupKeySetId]));
    for (const { groupId, addressPolicy } of context.groupKeyMap) {
        if (addressPolicy !== undefined) {
            groups.setGroupMulticastPolicy(groupId, addressPolicy);
        }
    }
}
