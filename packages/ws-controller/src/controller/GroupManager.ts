/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes, camelize, Crypto, isObject, Logger, Mutex, NodeId, Observable } from "@matter/main";
import { AccessControl, GroupKeyManagement, Groups } from "@matter/main/clusters";
import { Invoke, PeerAddress, Specifier } from "@matter/main/protocol";
import { ClusterId, ClusterType, DeviceTypeId, EndpointNumber, FabricIndex, GroupId, Status } from "@matter/main/types";
import { CommissioningController } from "@project-chip/matter.js";
import { ClusterMap } from "../model/ModelMapper.js";
import { convertCommandDataToMatter } from "../server/Converters.js";
import {
    AccessControlTarget,
    GroupReconciliation,
    MatterGroupData,
    ServerError,
} from "../types/WebSocketMessageTypes.js";
import { GroupRecord, GroupRegistry, toPublic } from "./GroupRegistry.js";

const logger = new Logger("GroupManager");

/**
 * Epoch start time for the single operational epoch key we provision. Units are
 * epoch-us (microseconds since 2000-01-01 UTC, Matter 1.4 Core §11.2.5.4); a value
 * of 1 keeps the key always-active. Per §11.2.7.1 only 0 is illegal in KeySetWrite.
 */
const EPOCH_START_TIME = 1;
/** Operational group key length in bytes. */
const GROUP_KEY_LENGTH = 16;
/** Maximum length of a group name, per the Groups cluster spec. */
const MAX_GROUP_NAME_LENGTH = 16;
/** AccessControl::ACL attribute id (0x0000). */
const ACL_ATTRIBUTE_ID = AccessControl.attributes.acl.id;
/** GroupKeyManagement::GroupKeyMap attribute id (0x0000). */
const GROUP_KEY_MAP_ATTRIBUTE_ID = GroupKeyManagement.attributes.groupKeyMap.id;
/** GroupKeyManagement::GroupTable attribute id (0x0001) — authoritative on-device membership. */
const GROUP_TABLE_ATTRIBUTE_ID = GroupKeyManagement.attributes.groupTable.id;

/**
 * Operations the {@link GroupManager} performs against individual member nodes.
 *
 * Implemented by {@link ControllerCommandHandler}, which owns the node interaction
 * primitives. Values passed/returned here are native (already Matter-shaped), not
 * the WebSocket tag-based representation.
 */
export interface GroupMemberOps {
    /** Invoke a command on a member node with native fields. Returns the response payload, if any. */
    invokeNative(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        clusterId: ClusterId,
        commandName: string,
        fields: unknown,
    ): Promise<unknown>;
    /** Write a native attribute value on a member node. Returns the interaction status. */
    writeNative(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        clusterId: ClusterId,
        attributeName: string,
        value: unknown,
    ): Promise<{ status: number; clusterStatus?: number }>;
    /**
     * Read a single attribute's raw native value over the wire (fabric-filtered).
     * Used for read-modify-write of fabric-scoped lists so existing entries are
     * never lost to a stale cache.
     */
    readNativeAttribute(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        clusterId: ClusterId,
        attributeId: number,
    ): Promise<unknown>;
    /** Current fabric index a node is commissioned on. */
    currentFabricIndex(nodeId: NodeId): FabricIndex;
    /** Whether the node is currently reachable. */
    isAvailable(nodeId: NodeId): boolean;
}

/**
 * Manages standards-compliant Matter multicast groups.
 *
 * Responsibilities:
 * - Owns the operational group key on the controller's OWN fabric so the controller
 *   can encrypt group (multicast) commands.
 * - Provisions the same key, the GroupId->KeySet mapping, group membership and a
 *   group-subject ACL entry onto each member device via unicast interaction.
 * - Sends group-addressed (IPv6 multicast) commands via the matter.js `ClientGroup`
 *   send path, so a single command reaches every member.
 *
 * Group definitions are persisted in a {@link GroupRegistry}; on startup the
 * controller's fabric key material is re-installed from it via {@link restore}.
 */
export class GroupManager {
    readonly #controller: CommissioningController;
    readonly #registry: GroupRegistry;
    readonly #ops: GroupMemberOps;
    /**
     * Serializes group mutations. Allocation (group id / key set id) and the controller
     * fabric `groupKeyIdMap` rebuild are read-then-write, so concurrent commands could
     * otherwise collide — mirrors {@link ConfigStorage}'s node-id allocation mutex.
     */
    readonly #mutex = new Mutex(this);
    readonly events = {
        groupAdded: new Observable<[MatterGroupData]>(),
        groupUpdated: new Observable<[MatterGroupData]>(),
        groupRemoved: new Observable<[number]>(),
    };

    constructor(controller: CommissioningController, registry: GroupRegistry, ops: GroupMemberOps) {
        this.#controller = controller;
        this.#registry = registry;
        this.#ops = ops;
    }

    /** Re-install fabric key material for all persisted groups after a restart. */
    async restore(): Promise<void> {
        const groups = this.#registry.all();
        for (const record of groups) {
            await this.#installKeySetOnFabric(record);
        }
        this.#syncGroupKeyMapOnFabric();
        if (groups.length > 0) {
            logger.notice(`Restored ${groups.length} group(s) onto the controller fabric`);
        }
    }

    list(): MatterGroupData[] {
        return this.#registry.all().map(toPublic);
    }

    async createGroup(name: string, groupId?: number, aclTargets?: AccessControlTarget[]): Promise<MatterGroupData> {
        this.#validateName(name);
        return this.#mutex.produce(async () => {
            const id = groupId ?? this.#registry.allocateGroupId();
            // Only the application Group ID range (0x0001..0xFEFF) may be assigned by a
            // fabric administrator; 0xFF00..0xFFFF is reserved for universal groups
            // (Matter 1.4 Core §2.5.4 / Table 3).
            if (!GroupId.isApplicationGroupId(GroupId(id, false))) {
                throw ServerError.invalidArguments(`Group id ${id} is outside the application range (0x0001..0xFEFF)`);
            }
            if (this.#registry.has(id)) {
                throw ServerError.invalidArguments(`Group ${id} already exists`);
            }

            const epochKey = this.#controller.node.env.get(Crypto).randomBytes(GROUP_KEY_LENGTH);
            const record: GroupRecord = {
                group_id: id,
                name,
                group_key_set_id: this.#registry.allocateGroupKeySetId(),
                members: [],
                epoch_key_hex: Bytes.toHex(epochKey),
                ...(aclTargets && aclTargets.length > 0 ? { acl_targets: aclTargets } : {}),
            };

            await this.#installKeySetOnFabric(record);
            // Persist before syncing: #syncGroupKeyMapOnFabric rebuilds the fabric map from
            // the registry, so the new group must already be stored.
            await this.#registry.upsert(record);
            this.#syncGroupKeyMapOnFabric();

            const data = toPublic(record);
            logger.notice(`Created group ${id} ("${name}") with key set ${record.group_key_set_id}`);
            this.events.groupAdded.emit(data);
            return data;
        });
    }

    async deleteGroup(groupId: number): Promise<void> {
        return this.#mutex.produce(async () => {
            const record = this.#registry.get(groupId);
            if (record === undefined) {
                throw ServerError.invalidArguments(`Group ${groupId} does not exist`);
            }

            // Best-effort de-provisioning of every member; tolerate offline devices so a
            // group can always be removed from the controller.
            for (const member of [...record.members]) {
                try {
                    await this.#deprovisionMember(
                        record,
                        NodeId(BigInt(member.node_id)),
                        EndpointNumber(member.endpoint_id),
                    );
                } catch (error) {
                    logger.warn(`Failed to de-provision node ${member.node_id} from group ${groupId}:`, error);
                }
            }

            await this.#registry.delete(groupId);
            this.#controller.fabric.groups.removeGroupKeySet(record.group_key_set_id);
            this.#syncGroupKeyMapOnFabric();

            logger.notice(`Deleted group ${groupId}`);
            this.events.groupRemoved.emit(groupId);
        });
    }

    async addMember(groupId: number, nodeId: NodeId, endpointId: EndpointNumber): Promise<MatterGroupData> {
        return this.#mutex.produce(async () => {
            const record = this.#requireGroup(groupId);
            if (!this.#ops.isAvailable(nodeId)) {
                throw ServerError.nodeNotReady(nodeId, new Error("Node is not connected; retry when reachable"));
            }
            await this.#provisionMember(record, nodeId, endpointId);

            const updated = await this.#registry.addMember(groupId, {
                node_id: nodeId,
                endpoint_id: endpointId,
            });
            const data = toPublic(updated);
            logger.notice(`Added node ${nodeId}/${endpointId} to group ${groupId}`);
            this.events.groupUpdated.emit(data);
            return data;
        });
    }

    /**
     * Reconcile a group's registry membership against on-device truth.
     *
     * For each member, reads the device's GroupKeyManagement.GroupTable to determine
     * whether the (groupId, endpoint) membership actually exists. With `repair`, any
     * reachable member whose membership has drifted is re-provisioned.
     */
    async reconcileGroup(groupId: number, repair = false): Promise<GroupReconciliation> {
        return this.#mutex.produce(async () => {
            const record = this.#requireGroup(groupId);
            const members: GroupReconciliation["members"] = [];
            let repairedAny = false;

            for (const member of record.members) {
                const nodeId = NodeId(BigInt(member.node_id));
                const endpointId = EndpointNumber(member.endpoint_id);

                if (!this.#ops.isAvailable(nodeId)) {
                    members.push({ ...member, reachable: false, on_device: false, repaired: false });
                    continue;
                }

                let onDevice = await this.#isMemberOnDevice(nodeId, endpointId, groupId);
                let repaired = false;
                if (!onDevice && repair) {
                    try {
                        await this.#provisionMember(record, nodeId, endpointId);
                        onDevice = true;
                        repaired = true;
                        repairedAny = true;
                    } catch (error) {
                        logger.warn(`Failed to repair node ${nodeId}/${endpointId} in group ${groupId}:`, error);
                    }
                }
                members.push({ ...member, reachable: true, on_device: onDevice, repaired });
            }

            if (repairedAny) {
                this.events.groupUpdated.emit(toPublic(record));
            }
            return { group_id: groupId, members };
        });
    }

    async removeMember(groupId: number, nodeId: NodeId, endpointId: EndpointNumber): Promise<MatterGroupData> {
        return this.#mutex.produce(async () => {
            const record = this.#requireGroup(groupId);
            await this.#deprovisionMember(record, nodeId, endpointId);
            const updated = await this.#registry.removeMember(groupId, {
                node_id: nodeId,
                endpoint_id: endpointId,
            });
            const data = toPublic(updated);
            logger.notice(`Removed node ${nodeId}/${endpointId} from group ${groupId}`);
            this.events.groupUpdated.emit(data);
            return data;
        });
    }

    /**
     * Send a command to all members of a group via IPv6 group multicast.
     *
     * Groupcast is fire-and-forget: responses are suppressed at the protocol layer,
     * so this resolves once the multicast has been emitted, not once members act.
     */
    async sendCommand(groupId: number, clusterId: number, commandName: string, payload?: unknown): Promise<void> {
        this.#requireGroup(groupId);

        const clusterEntry = ClusterMap[clusterId];
        if (clusterEntry === undefined) {
            throw ServerError.invalidArguments(`Cluster Id "${clusterId}" unknown`);
        }
        const command = camelize(commandName);
        const cluster = ClusterType(clusterEntry.model) as Specifier.ClusterLike;

        let fields = payload;
        if (isObject(payload) && Object.keys(payload).length > 0) {
            const model = clusterEntry.commands[command.toLowerCase()];
            if (model) {
                fields = convertCommandDataToMatter(payload, model, clusterEntry.model);
            }
        } else if (isObject(payload) && Object.keys(payload).length === 0) {
            fields = undefined;
        }

        const peerAddress = PeerAddress({
            fabricIndex: this.#controller.fabric.fabricIndex,
            nodeId: NodeId.fromGroupId(GroupId(groupId)),
        });
        const group = await this.#controller.node.peers.forAddress(peerAddress);

        logger.info(`Sending group command ${clusterId}.${command} to group ${groupId}`);
        const invoke = Invoke({ commands: [{ cluster, command, fields }] });
        // Groupcast suppresses responses; the iterator yields nothing.
        for await (const _ of group.interaction.invoke(invoke)) {
            // no-op
        }
    }

    // --- internals ---------------------------------------------------------

    #requireGroup(groupId: number): GroupRecord {
        const record = this.#registry.get(groupId);
        if (record === undefined) {
            throw ServerError.invalidArguments(`Group ${groupId} does not exist`);
        }
        return record;
    }

    #validateName(name: string): void {
        if (name.length === 0 || name.length > MAX_GROUP_NAME_LENGTH) {
            throw ServerError.invalidArguments(`Group name must be 1..${MAX_GROUP_NAME_LENGTH} characters`);
        }
    }

    #buildGroupKeySet(record: GroupRecord): GroupKeyManagement.GroupKeySet {
        return {
            groupKeySetId: record.group_key_set_id,
            // TrustFirst is the only Mandatory group key security policy (Matter 1.4 Core
            // §11.2.5.1); CacheAndSync is gated behind a provisional feature.
            groupKeySecurityPolicy: GroupKeyManagement.GroupKeySecurityPolicy.TrustFirst,
            epochKey0: Bytes.fromHex(record.epoch_key_hex),
            epochStartTime0: EPOCH_START_TIME,
            epochKey1: null,
            epochStartTime1: null,
            epochKey2: null,
            epochStartTime2: null,
            groupKeyMulticastPolicy: GroupKeyManagement.GroupKeyMulticastPolicy.PerGroupId,
        };
    }

    async #installKeySetOnFabric(record: GroupRecord): Promise<void> {
        await this.#controller.fabric.groups.setFromGroupKeySet(this.#buildGroupKeySet(record));
    }

    /** Rebuild the GroupId->KeySetId map on the controller fabric from the registry. */
    #syncGroupKeyMapOnFabric(): void {
        const map = new Map<GroupId, number>();
        for (const record of this.#registry.all()) {
            map.set(GroupId(record.group_id), record.group_key_set_id);
        }
        this.#controller.fabric.groups.groupKeyIdMap = map;
    }

    /**
     * Fresh, fabric-filtered read of a list attribute from a member's endpoint 0, used
     * as the basis for read-modify-write. Reading live (not from cache) guarantees we
     * never drop pre-existing entries — critical for the ACL, where dropping the admin
     * entry would lock the controller out of the device.
     */
    async #readList(nodeId: NodeId, clusterId: ClusterId, attributeId: number): Promise<Record<string, unknown>[]> {
        const value = await this.#ops.readNativeAttribute(nodeId, EndpointNumber(0), clusterId, attributeId);
        return Array.isArray(value) ? [...(value as Record<string, unknown>[])] : [];
    }

    /**
     * Run the full on-device provisioning sequence for one (node, endpoint): install the
     * key set, map the group key, add the endpoint to the group, and grant the group ACL.
     * Shared by {@link addMember} and {@link reconcileGroup}'s repair path.
     */
    async #provisionMember(record: GroupRecord, nodeId: NodeId, endpointId: EndpointNumber): Promise<void> {
        const groupId = record.group_id;
        const fabricIndex = this.#ops.currentFabricIndex(nodeId);

        // 1. Install the operational key set on the member device.
        await this.#ops.invokeNative(nodeId, EndpointNumber(0), GroupKeyManagement.id, "keySetWrite", {
            groupKeySet: this.#buildGroupKeySet(record),
        });

        // 2. Map the GroupId -> KeySetId on the member (read-modify-write, fabric-scoped list).
        const keyMap = (await this.#readList(nodeId, GroupKeyManagement.id, GROUP_KEY_MAP_ATTRIBUTE_ID)).filter(
            entry => Number((entry as { groupId?: number }).groupId) !== groupId,
        );
        keyMap.push({ groupId: GroupId(groupId), groupKeySetId: record.group_key_set_id, fabricIndex });
        await this.#ops.writeNative(nodeId, EndpointNumber(0), GroupKeyManagement.id, "groupKeyMap", keyMap);

        // 3. Add the endpoint to the group via the Groups cluster, and surface a failed
        //    AddGroupResponse status (e.g. RESOURCE_EXHAUSTED) instead of silently succeeding.
        const addResponse = await this.#ops.invokeNative(nodeId, endpointId, Groups.id, "addGroup", {
            groupId: GroupId(groupId),
            groupName: record.name,
        });
        const addStatus = Number((addResponse as { status?: number } | undefined)?.status ?? Status.Success);
        if (addStatus !== Status.Success) {
            throw ServerError.sdkStackError(`AddGroup on node ${nodeId}/${endpointId} failed with status ${addStatus}`);
        }

        // 4. Grant the group its ACL entry (read-modify-write).
        await this.#ensureGroupAcl(record, nodeId, fabricIndex);
    }

    /** Whether the (group, endpoint) membership exists in the device's GroupKeyManagement.GroupTable. */
    async #isMemberOnDevice(nodeId: NodeId, endpointId: EndpointNumber, groupId: number): Promise<boolean> {
        const table = await this.#readList(nodeId, GroupKeyManagement.id, GROUP_TABLE_ATTRIBUTE_ID);
        return table.some(entry => {
            if (Number((entry as { groupId?: number }).groupId) !== groupId) {
                return false;
            }
            const endpoints = (entry as { endpoints?: unknown }).endpoints;
            return Array.isArray(endpoints) && endpoints.some(e => Number(e) === endpointId);
        });
    }

    /** Whether an ACL entry is the group-subject entry for the given group id. */
    #isGroupAclEntry(entry: Record<string, unknown>, groupId: number): boolean {
        return (
            Number((entry as { authMode?: number }).authMode) === AccessControl.AccessControlEntryAuthMode.Group &&
            Array.isArray((entry as { subjects?: unknown[] }).subjects) &&
            (entry as { subjects: unknown[] }).subjects.some(s => Number(s) === groupId)
        );
    }

    /** Build the native ACL targets for a group, or null for an unscoped (all-clusters) grant. */
    #buildAclTargets(record: GroupRecord): unknown[] | null {
        const targets = record.acl_targets;
        if (!targets || targets.length === 0) {
            return null;
        }
        return targets.map((t: AccessControlTarget) => ({
            cluster: t.cluster !== null ? ClusterId(t.cluster) : null,
            endpoint: t.endpoint !== null ? EndpointNumber(t.endpoint) : null,
            deviceType: t.device_type !== null ? DeviceTypeId(t.device_type) : null,
        }));
    }

    /** Order-independent signature of ACL targets, for detecting an unchanged grant. */
    #aclTargetsSignature(targets: unknown): string {
        if (!Array.isArray(targets)) {
            return "null";
        }
        return targets
            .map(t => {
                const o = t as { cluster?: unknown; endpoint?: unknown; deviceType?: unknown };
                return `${o.cluster ?? ""}:${o.endpoint ?? ""}:${o.deviceType ?? ""}`;
            })
            .sort()
            .join(",");
    }

    /**
     * Ensure the group's ACL entry is present with the intended scope. Re-reads the live
     * ACL (so a pre-existing admin/CASE entry is never dropped), and replaces any stale
     * group entry only when its target scope differs — otherwise leaves the ACL untouched.
     *
     * Operate is the minimum privilege to invoke commands and the maximum a Group entry may
     * hold — Matter 1.4 Core §6.6.6.2 forbids granting Administer to a Group. The subject is a
     * uint64 whose low 16 bits carry the Group ID (§9.10.5.6), which is exactly GroupId(groupId).
     * `targets` come from the group's `acl_targets` (least privilege); null grants access on all
     * clusters when the caller did not specify a scope.
     */
    async #ensureGroupAcl(record: GroupRecord, nodeId: NodeId, fabricIndex: FabricIndex): Promise<void> {
        const groupId = record.group_id;
        const acl = await this.#readList(nodeId, AccessControl.id, ACL_ATTRIBUTE_ID);
        const desiredTargets = this.#buildAclTargets(record);

        const existing = acl.find(entry => this.#isGroupAclEntry(entry, groupId));
        if (
            existing !== undefined &&
            this.#aclTargetsSignature(existing.targets) === this.#aclTargetsSignature(desiredTargets)
        ) {
            return;
        }

        const next = acl.filter(entry => !this.#isGroupAclEntry(entry, groupId));
        next.push({
            privilege: AccessControl.AccessControlEntryPrivilege.Operate,
            authMode: AccessControl.AccessControlEntryAuthMode.Group,
            subjects: [GroupId(groupId)],
            targets: desiredTargets,
            fabricIndex,
        });
        await this.#ops.writeNative(nodeId, EndpointNumber(0), AccessControl.id, "acl", next);
    }

    /**
     * Remove a single endpoint from a group on a member device. When the node has no
     * other endpoint left in the group, also strip the GroupKeyMap entry and the
     * group-subject ACL entry. Skips network calls for unreachable nodes.
     */
    async #deprovisionMember(record: GroupRecord, nodeId: NodeId, endpointId: EndpointNumber): Promise<void> {
        if (!this.#ops.isAvailable(nodeId)) {
            logger.info(`Node ${nodeId} not reachable; skipping on-device group cleanup`);
            return;
        }
        const groupId = record.group_id;

        await this.#ops.invokeNative(nodeId, endpointId, Groups.id, "removeGroup", {
            groupId: GroupId(groupId),
        });

        const nodeHasOtherEndpoint = record.members.some(
            m => BigInt(m.node_id) === BigInt(nodeId) && m.endpoint_id !== endpointId,
        );
        if (nodeHasOtherEndpoint) {
            return;
        }

        const keyMap = (await this.#readList(nodeId, GroupKeyManagement.id, GROUP_KEY_MAP_ATTRIBUTE_ID)).filter(
            entry => Number((entry as { groupId?: number }).groupId) !== groupId,
        );
        await this.#ops.writeNative(nodeId, EndpointNumber(0), GroupKeyManagement.id, "groupKeyMap", keyMap);

        const acl = (await this.#readList(nodeId, AccessControl.id, ACL_ATTRIBUTE_ID)).filter(
            entry => !this.#isGroupAclEntry(entry, groupId),
        );
        await this.#ops.writeNative(nodeId, EndpointNumber(0), AccessControl.id, "acl", acl);
    }
}
