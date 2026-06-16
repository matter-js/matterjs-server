/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Environment, Logger, StorageContext, StorageService, SupportedStorageTypes } from "@matter/main";
import { MatterGroupData, MatterGroupMember } from "../types/WebSocketMessageTypes.js";

const logger = new Logger("GroupRegistry");

/**
 * Persisted record for a single group.
 *
 * Extends the wire-facing {@link MatterGroupData} with the operational epoch key,
 * which the controller must re-install onto its own fabric on every startup and
 * which is therefore persisted here. The epoch key is sensitive and is never sent
 * over the WebSocket API (it is stripped by {@link toPublic}).
 */
export interface GroupRecord extends MatterGroupData {
    /** 16-byte operational epoch key, hex-encoded. */
    epoch_key_hex: string;
}

/** Strip the sensitive epoch key, yielding the API-facing shape. */
export function toPublic(record: GroupRecord): MatterGroupData {
    const { epoch_key_hex: _omit, ...rest } = record;
    return { ...rest, members: rest.members.map(m => ({ ...m })) };
}

/**
 * Durable store for controller-managed Matter groups.
 *
 * Backed by the same {@link StorageService} the rest of the controller uses, under
 * a dedicated `groups` storage. Holds an in-memory map mirrored to disk so the
 * controller can re-provision its own fabric key material after a restart.
 */
export class GroupRegistry {
    #store: StorageContext;
    readonly #groups = new Map<number, GroupRecord>();

    static async create(env: Environment): Promise<GroupRegistry> {
        const storage = await env.get(StorageService).open("groups");
        const store = storage.createContext("values");
        const instance = new GroupRegistry(store);
        await instance.#load();
        return instance;
    }

    private constructor(store: StorageContext) {
        this.#store = store;
    }

    async #load() {
        const records = (await this.#store.get("groups", [])) as unknown as GroupRecord[];
        for (const record of records) {
            this.#groups.set(record.group_id, record);
        }
        logger.info(`Loaded ${this.#groups.size} group(s) from storage`);
    }

    async #persist() {
        // matter.js storage accepts an index-signature shape; GroupRecord only holds
        // strings/numbers/arrays at runtime, so it round-trips safely.
        await this.#store.set("groups", [...this.#groups.values()] as unknown as SupportedStorageTypes);
    }

    has(groupId: number): boolean {
        return this.#groups.has(groupId);
    }

    get(groupId: number): GroupRecord | undefined {
        return this.#groups.get(groupId);
    }

    all(): GroupRecord[] {
        return [...this.#groups.values()];
    }

    /**
     * Lowest unused application Group ID (0x0001..0xFEFF), or throw if exhausted.
     * The 0xFF00..0xFFFF range is reserved for universal groups and never allocated.
     */
    allocateGroupId(): number {
        for (let candidate = 1; candidate <= 0xfeff; candidate++) {
            if (!this.#groups.has(candidate)) {
                return candidate;
            }
        }
        throw new Error("No free application group id available (0x0001..0xFEFF exhausted)");
    }

    /** Lowest unused group key set id (1.. ; 0 is reserved for the IPK). */
    allocateGroupKeySetId(): number {
        const used = new Set([...this.#groups.values()].map(g => g.group_key_set_id));
        for (let candidate = 1; candidate <= 0xffff; candidate++) {
            if (!used.has(candidate)) {
                return candidate;
            }
        }
        throw new Error("No free group key set id available");
    }

    async upsert(record: GroupRecord): Promise<void> {
        this.#groups.set(record.group_id, record);
        await this.#persist();
    }

    async delete(groupId: number): Promise<void> {
        this.#groups.delete(groupId);
        await this.#persist();
    }

    /** Add a member to a group if not already present. Returns the updated record. */
    async addMember(groupId: number, member: MatterGroupMember): Promise<GroupRecord> {
        const record = this.#require(groupId);
        const exists = record.members.some(m => m.node_id === member.node_id && m.endpoint_id === member.endpoint_id);
        if (!exists) {
            record.members.push({ ...member });
            await this.#persist();
        }
        return record;
    }

    /** Remove a member from a group. Returns the updated record. */
    async removeMember(groupId: number, member: MatterGroupMember): Promise<GroupRecord> {
        const record = this.#require(groupId);
        const before = record.members.length;
        record.members = record.members.filter(
            m => !(m.node_id === member.node_id && m.endpoint_id === member.endpoint_id),
        );
        if (record.members.length !== before) {
            await this.#persist();
        }
        return record;
    }

    #require(groupId: number): GroupRecord {
        const record = this.#groups.get(groupId);
        if (record === undefined) {
            throw new Error(`Group ${groupId} does not exist`);
        }
        return record;
    }
}
