/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Environment, MockStorageService } from "@matter/general";
import { AccessControl, GroupKeyManagement, Groups } from "@matter/main/clusters";
import { ClusterId, EndpointNumber, FabricIndex, GroupId, NodeId, Status } from "@matter/main/types";
import type { CommissioningController } from "@project-chip/matter.js";
import { GroupManager, GroupMemberOps } from "../src/controller/GroupManager.js";
import { GroupRegistry } from "../src/controller/GroupRegistry.js";

interface RecordedInvoke {
    nodeId: NodeId;
    endpointId: EndpointNumber;
    clusterId: ClusterId;
    commandName: string;
    fields: unknown;
}
interface RecordedWrite {
    endpointId: EndpointNumber;
    clusterId: ClusterId;
    attributeName: string;
    value: Record<string, unknown>[];
}

async function* emptyInvokeResult(): AsyncGenerator<never> {
    // Groupcast yields no responses.
}

function fakeController() {
    const installedKeySets: { groupKeySetId: number }[] = [];
    const removedKeySetIds: number[] = [];
    const sentInvokes: unknown[] = [];
    const forAddressCalls: { fabricIndex: FabricIndex; nodeId: NodeId }[] = [];
    let groupKeyIdMap = new Map<GroupId, number>();

    const groups = {
        setFromGroupKeySet: async (keySet: { groupKeySetId: number }) => {
            installedKeySets.push(keySet);
        },
        removeGroupKeySet: (id: number) => {
            removedKeySetIds.push(id);
            return true;
        },
        get groupKeyIdMap() {
            return groupKeyIdMap;
        },
        set groupKeyIdMap(map: Map<GroupId, number>) {
            groupKeyIdMap = map;
        },
    };

    const controller = {
        node: {
            env: { get: () => ({ randomBytes: (n: number) => new Uint8Array(n).fill(7) }) },
            peers: {
                forAddress: async (addr: { fabricIndex: FabricIndex; nodeId: NodeId }) => {
                    forAddressCalls.push(addr);
                    return { interaction: { invoke: (req: unknown) => (sentInvokes.push(req), emptyInvokeResult()) } };
                },
            },
        },
        fabric: { fabricIndex: FabricIndex(1), groups },
    };

    return {
        controller: controller as unknown as CommissioningController,
        installedKeySets,
        removedKeySetIds,
        sentInvokes,
        forAddressCalls,
        groups,
    };
}

function fakeOps(config: {
    acl?: Record<string, unknown>[];
    groupKeyMap?: Record<string, unknown>[];
    groupTable?: Record<string, unknown>[];
    available?: boolean;
    addGroupStatus?: number;
}) {
    const invokes: RecordedInvoke[] = [];
    const writes: RecordedWrite[] = [];
    const ops: GroupMemberOps = {
        invokeNative: async (nodeId, endpointId, clusterId, commandName, fields) => {
            invokes.push({ nodeId, endpointId, clusterId, commandName, fields });
            if (commandName === "addGroup") {
                return { status: config.addGroupStatus ?? Status.Success, groupId: 0 };
            }
            return undefined;
        },
        writeNative: async (_nodeId, endpointId, clusterId, attributeName, value) => {
            writes.push({ endpointId, clusterId, attributeName, value: value as Record<string, unknown>[] });
            return { status: 0 };
        },
        readNativeAttribute: async (_nodeId, _endpointId, clusterId, attributeId) => {
            if (clusterId === AccessControl.id) return config.acl ?? [];
            if (clusterId === GroupKeyManagement.id) {
                return attributeId === GroupKeyManagement.attributes.groupTable.id
                    ? (config.groupTable ?? [])
                    : (config.groupKeyMap ?? []);
            }
            return undefined;
        },
        currentFabricIndex: () => FabricIndex(1),
        isAvailable: () => config.available ?? true,
    };
    return { ops, invokes, writes };
}

const NODE = NodeId(0x1234n);
const EP = EndpointNumber(1);

describe("GroupManager", () => {
    let env: Environment;
    let registry: GroupRegistry;

    beforeEach(async () => {
        env = new Environment("test");
        new MockStorageService(env);
        registry = await GroupRegistry.create(env);
    });

    describe("createGroup", () => {
        it("installs key material on the controller fabric and persists, without leaking the key", async () => {
            const c = fakeController();
            const { ops } = fakeOps({});
            const mgr = new GroupManager(c.controller, registry, ops);

            const data = await mgr.createGroup("Living Room");

            expect(data).to.deep.equal({ group_id: 1, name: "Living Room", group_key_set_id: 1, members: [] });
            expect("epoch_key_hex" in data).to.equal(false);
            expect(c.installedKeySets).to.have.length(1);
            expect(c.installedKeySets[0].groupKeySetId).to.equal(1);
            expect([...c.groups.groupKeyIdMap.entries()]).to.deep.equal([[GroupId(1), 1]]);
            expect(registry.get(1)?.epoch_key_hex).to.equal("07070707070707070707070707070707");
        });

        it("emits group_added", async () => {
            const c = fakeController();
            const mgr = new GroupManager(c.controller, registry, fakeOps({}).ops);
            let emitted: unknown;
            mgr.events.groupAdded.on(d => {
                emitted = d;
            });
            await mgr.createGroup("Kitchen");
            expect(emitted).to.deep.equal({ group_id: 1, name: "Kitchen", group_key_set_id: 1, members: [] });
        });

        it("rejects group ids outside the application range (0x0001..0xFEFF)", async () => {
            const mgr = new GroupManager(fakeController().controller, registry, fakeOps({}).ops);
            await expect(mgr.createGroup("x", 0)).to.be.rejectedWith(/application range/);
            await expect(mgr.createGroup("x", 0xff00)).to.be.rejectedWith(/application range/);
            await expect(mgr.createGroup("x", 0x10000)).to.be.rejectedWith(/application range/);
        });

        it("rejects invalid names", async () => {
            const mgr = new GroupManager(fakeController().controller, registry, fakeOps({}).ops);
            await expect(mgr.createGroup("")).to.be.rejectedWith(/1\.\.16/);
            await expect(mgr.createGroup("x".repeat(17))).to.be.rejectedWith(/1\.\.16/);
        });
    });

    describe("addMember", () => {
        async function seedGroup(mgr: GroupManager) {
            await mgr.createGroup("Group", 5);
        }

        it("provisions key set, key map, membership and ACL in order", async () => {
            const c = fakeController();
            const { ops, invokes, writes } = fakeOps({});
            const mgr = new GroupManager(c.controller, registry, ops);
            await seedGroup(mgr);

            const data = await mgr.addMember(5, NODE, EP);

            expect(invokes.map(i => i.commandName)).to.deep.equal(["keySetWrite", "addGroup"]);
            const keySetWrite = invokes[0];
            expect(keySetWrite.clusterId).to.equal(GroupKeyManagement.id);
            expect(keySetWrite.endpointId).to.equal(EndpointNumber(0));
            const addGroup = invokes[1];
            expect(addGroup.clusterId).to.equal(Groups.id);
            expect(addGroup.endpointId).to.equal(EP);
            expect(addGroup.fields).to.deep.equal({ groupId: GroupId(5), groupName: "Group" });

            const keyMapWrite = writes.find(w => w.attributeName === "groupKeyMap");
            expect(keyMapWrite?.value).to.deep.equal([
                { groupId: GroupId(5), groupKeySetId: 1, fabricIndex: FabricIndex(1) },
            ]);

            const aclWrite = writes.find(w => w.attributeName === "acl");
            expect(aclWrite?.value).to.deep.equal([
                {
                    privilege: AccessControl.AccessControlEntryPrivilege.Operate,
                    authMode: AccessControl.AccessControlEntryAuthMode.Group,
                    subjects: [GroupId(5)],
                    targets: null,
                    fabricIndex: FabricIndex(1),
                },
            ]);

            expect(data.members).to.deep.equal([{ node_id: NODE, endpoint_id: EP }]);
        });

        it("preserves an existing admin ACL entry (never locks the controller out)", async () => {
            const adminEntry = {
                privilege: AccessControl.AccessControlEntryPrivilege.Administer,
                authMode: AccessControl.AccessControlEntryAuthMode.Case,
                subjects: [112233n],
                targets: null,
                fabricIndex: FabricIndex(1),
            };
            const c = fakeController();
            const { ops, writes } = fakeOps({ acl: [adminEntry] });
            const mgr = new GroupManager(c.controller, registry, ops);
            await seedGroup(mgr);

            await mgr.addMember(5, NODE, EP);

            const aclWrite = writes.find(w => w.attributeName === "acl");
            expect(aclWrite?.value).to.have.length(2);
            expect(aclWrite?.value[0]).to.deep.equal(adminEntry);
            expect(aclWrite?.value[1]).to.include({ authMode: AccessControl.AccessControlEntryAuthMode.Group });
        });

        it("does not duplicate an already-present group ACL entry", async () => {
            const groupEntry = {
                privilege: AccessControl.AccessControlEntryPrivilege.Operate,
                authMode: AccessControl.AccessControlEntryAuthMode.Group,
                subjects: [GroupId(5)],
                targets: null,
                fabricIndex: FabricIndex(1),
            };
            const c = fakeController();
            const { ops, writes } = fakeOps({ acl: [groupEntry] });
            const mgr = new GroupManager(c.controller, registry, ops);
            await seedGroup(mgr);

            await mgr.addMember(5, NODE, EP);
            expect(writes.find(w => w.attributeName === "acl")).to.equal(undefined);
        });

        it("throws when AddGroup returns a non-success status", async () => {
            const c = fakeController();
            const { ops } = fakeOps({ addGroupStatus: Status.ResourceExhausted });
            const mgr = new GroupManager(c.controller, registry, ops);
            await seedGroup(mgr);
            await expect(mgr.addMember(5, NODE, EP)).to.be.rejectedWith(/AddGroup/);
            expect(registry.get(5)?.members).to.have.length(0);
        });

        it("refuses to provision an unreachable node", async () => {
            const c = fakeController();
            const { ops, invokes } = fakeOps({ available: false });
            const mgr = new GroupManager(c.controller, registry, ops);
            await seedGroup(mgr);
            await expect(mgr.addMember(5, NODE, EP)).to.be.rejected;
            expect(invokes).to.have.length(0);
        });
    });

    describe("removeMember", () => {
        it("removes membership and strips the key map and ACL group entry when the last endpoint leaves", async () => {
            const groupEntry = {
                privilege: AccessControl.AccessControlEntryPrivilege.Operate,
                authMode: AccessControl.AccessControlEntryAuthMode.Group,
                subjects: [GroupId(5)],
                targets: null,
                fabricIndex: FabricIndex(1),
            };
            const c = fakeController();
            const { ops, invokes, writes } = fakeOps({
                acl: [groupEntry],
                groupKeyMap: [{ groupId: GroupId(5), groupKeySetId: 1, fabricIndex: FabricIndex(1) }],
            });
            const mgr = new GroupManager(c.controller, registry, ops);
            await mgr.createGroup("Group", 5);
            await mgr.addMember(5, NODE, EP);

            const data = await mgr.removeMember(5, NODE, EP);

            expect(invokes.some(i => i.commandName === "removeGroup")).to.equal(true);
            const aclWrite = [...writes].reverse().find(w => w.attributeName === "acl");
            expect(aclWrite?.value).to.deep.equal([]);
            const keyMapWrite = [...writes].reverse().find(w => w.attributeName === "groupKeyMap");
            expect(keyMapWrite?.value).to.deep.equal([]);
            expect(data.members).to.have.length(0);
        });
    });

    describe("deleteGroup", () => {
        it("removes the key set from the fabric and emits group_removed", async () => {
            const c = fakeController();
            const mgr = new GroupManager(c.controller, registry, fakeOps({}).ops);
            await mgr.createGroup("Group", 5);
            let removed: number | undefined;
            mgr.events.groupRemoved.on(id => {
                removed = id;
            });

            await mgr.deleteGroup(5);

            expect(c.removedKeySetIds).to.deep.equal([1]);
            expect(registry.has(5)).to.equal(false);
            expect(removed).to.equal(5);
        });
    });

    describe("sendCommand", () => {
        it("addresses the group multicast peer and invokes the command", async () => {
            const c = fakeController();
            const mgr = new GroupManager(c.controller, registry, fakeOps({}).ops);
            await mgr.createGroup("Group", 7);

            await mgr.sendCommand(7, OnOffClusterId, "on");

            expect(c.forAddressCalls).to.have.length(1);
            expect(c.forAddressCalls[0].fabricIndex).to.equal(FabricIndex(1));
            expect(c.forAddressCalls[0].nodeId).to.equal(NodeId.fromGroupId(GroupId(7)));
            expect(c.sentInvokes).to.have.length(1);
        });

        it("rejects unknown groups", async () => {
            const mgr = new GroupManager(fakeController().controller, registry, fakeOps({}).ops);
            await expect(mgr.sendCommand(99, OnOffClusterId, "on")).to.be.rejectedWith(/does not exist/);
        });
    });

    describe("scoped ACL targets", () => {
        it("applies group-level acl_targets to the member ACL entry and exposes them", async () => {
            const c = fakeController();
            const { ops, writes } = fakeOps({});
            const mgr = new GroupManager(c.controller, registry, ops);
            const created = await mgr.createGroup("Lights", 5, [{ cluster: 6, endpoint: null, device_type: null }]);
            expect(created.acl_targets).to.deep.equal([{ cluster: 6, endpoint: null, device_type: null }]);

            await mgr.addMember(5, NODE, EP);

            const aclWrite = writes.find(w => w.attributeName === "acl");
            expect(aclWrite?.value[0]).to.deep.include({
                authMode: AccessControl.AccessControlEntryAuthMode.Group,
                targets: [{ cluster: ClusterId(6), endpoint: null, deviceType: null }],
            });
        });

        it("replaces a stale group ACL entry when the target scope differs, preserving other entries", async () => {
            const adminEntry = {
                privilege: AccessControl.AccessControlEntryPrivilege.Administer,
                authMode: AccessControl.AccessControlEntryAuthMode.Case,
                subjects: [112233n],
                targets: null,
                fabricIndex: FabricIndex(1),
            };
            const staleGroupEntry = {
                privilege: AccessControl.AccessControlEntryPrivilege.Operate,
                authMode: AccessControl.AccessControlEntryAuthMode.Group,
                subjects: [GroupId(5)],
                targets: null,
                fabricIndex: FabricIndex(1),
            };
            const c = fakeController();
            const { ops, writes } = fakeOps({ acl: [adminEntry, staleGroupEntry] });
            const mgr = new GroupManager(c.controller, registry, ops);
            await mgr.createGroup("Lights", 5, [{ cluster: 6, endpoint: null, device_type: null }]);

            await mgr.addMember(5, NODE, EP);

            const aclWrite = writes.find(w => w.attributeName === "acl");
            expect(aclWrite?.value).to.have.length(2);
            expect(aclWrite?.value[0]).to.deep.equal(adminEntry);
            expect(aclWrite?.value[1]).to.deep.include({
                targets: [{ cluster: ClusterId(6), endpoint: null, deviceType: null }],
            });
        });
    });

    describe("reconcileGroup", () => {
        async function setup(config: Parameters<typeof fakeOps>[0]) {
            const c = fakeController();
            const f = fakeOps(config);
            const mgr = new GroupManager(c.controller, registry, f.ops);
            await mgr.createGroup("Group", 5);
            await registry.addMember(5, { node_id: NODE, endpoint_id: EP });
            return { mgr, ...f };
        }

        it("reports a member present in the device GroupTable without repairing", async () => {
            const { mgr, invokes } = await setup({ groupTable: [{ groupId: GroupId(5), endpoints: [EP] }] });
            const result = await mgr.reconcileGroup(5);
            expect(result.members).to.deep.equal([
                { node_id: NODE, endpoint_id: EP, reachable: true, on_device: true, repaired: false },
            ]);
            expect(invokes).to.have.length(0);
        });

        it("reports drift but does not repair without the repair flag", async () => {
            const { mgr, invokes } = await setup({ groupTable: [] });
            const result = await mgr.reconcileGroup(5, false);
            expect(result.members[0]).to.deep.include({ on_device: false, repaired: false });
            expect(invokes).to.have.length(0);
        });

        it("re-provisions a drifted member when repair is requested", async () => {
            const { mgr, invokes } = await setup({ groupTable: [] });
            const result = await mgr.reconcileGroup(5, true);
            expect(result.members[0]).to.deep.include({ on_device: true, repaired: true });
            expect(invokes.map(i => i.commandName)).to.deep.equal(["keySetWrite", "addGroup"]);
        });

        it("marks unreachable members and skips them", async () => {
            const { mgr, invokes } = await setup({ available: false, groupTable: [] });
            const result = await mgr.reconcileGroup(5, true);
            expect(result.members[0]).to.deep.include({ reachable: false, on_device: false, repaired: false });
            expect(invokes).to.have.length(0);
        });
    });

    describe("restore", () => {
        it("re-installs key material for persisted groups", async () => {
            await registry.upsert({
                group_id: 9,
                name: "Persisted",
                group_key_set_id: 4,
                members: [],
                epoch_key_hex: "0a0b0c0d0e0f00112233445566778899",
            });
            const c = fakeController();
            const mgr = new GroupManager(c.controller, registry, fakeOps({}).ops);

            await mgr.restore();

            expect(c.installedKeySets).to.have.length(1);
            expect(c.installedKeySets[0].groupKeySetId).to.equal(4);
            expect([...c.groups.groupKeyIdMap.entries()]).to.deep.equal([[GroupId(9), 4]]);
        });
    });
});

/** OnOff cluster id (0x0006) — used as a representative groupcast target. */
const OnOffClusterId = 0x0006;
