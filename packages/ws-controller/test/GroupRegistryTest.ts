/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Environment, MockStorageService } from "@matter/general";
import { GroupRecord, GroupRegistry, toPublic } from "../src/controller/GroupRegistry.js";

function makeRecord(overrides: Partial<GroupRecord> = {}): GroupRecord {
    return {
        group_id: 1,
        name: "Living Room",
        group_key_set_id: 1,
        members: [],
        epoch_key_hex: "000102030405060708090a0b0c0d0e0f",
        ...overrides,
    };
}

describe("GroupRegistry", () => {
    let env: Environment;

    beforeEach(() => {
        env = new Environment("test");
        new MockStorageService(env);
    });

    describe("id allocation", () => {
        it("allocates the lowest free group id", async () => {
            const registry = await GroupRegistry.create(env);
            expect(registry.allocateGroupId()).to.equal(1);

            await registry.upsert(makeRecord({ group_id: 1 }));
            expect(registry.allocateGroupId()).to.equal(2);
        });

        it("allocates a group key set id distinct from existing ones", async () => {
            const registry = await GroupRegistry.create(env);
            await registry.upsert(makeRecord({ group_id: 1, group_key_set_id: 1 }));
            await registry.upsert(makeRecord({ group_id: 2, group_key_set_id: 2 }));
            expect(registry.allocateGroupKeySetId()).to.equal(3);
        });
    });

    describe("persistence", () => {
        it("round-trips groups across reloads", async () => {
            const registry = await GroupRegistry.create(env);
            await registry.upsert(makeRecord({ group_id: 5, name: "Kitchen" }));
            await registry.addMember(5, { node_id: 42, endpoint_id: 1 });

            // A fresh registry over the same storage must observe the persisted data.
            const reloaded = await GroupRegistry.create(env);
            const record = reloaded.get(5);
            expect(record).to.not.equal(undefined);
            expect(record!.name).to.equal("Kitchen");
            expect(record!.epoch_key_hex).to.equal("000102030405060708090a0b0c0d0e0f");
            expect(record!.members).to.deep.equal([{ node_id: 42, endpoint_id: 1 }]);
        });
    });

    describe("membership", () => {
        it("adds a member only once", async () => {
            const registry = await GroupRegistry.create(env);
            await registry.upsert(makeRecord({ group_id: 1 }));

            await registry.addMember(1, { node_id: 7, endpoint_id: 1 });
            await registry.addMember(1, { node_id: 7, endpoint_id: 1 });
            expect(registry.get(1)!.members).to.have.length(1);
        });

        it("removes a specific (node, endpoint) member", async () => {
            const registry = await GroupRegistry.create(env);
            await registry.upsert(makeRecord({ group_id: 1 }));
            await registry.addMember(1, { node_id: 7, endpoint_id: 1 });
            await registry.addMember(1, { node_id: 7, endpoint_id: 2 });

            await registry.removeMember(1, { node_id: 7, endpoint_id: 1 });
            expect(registry.get(1)!.members).to.deep.equal([{ node_id: 7, endpoint_id: 2 }]);
        });
    });

    describe("toPublic", () => {
        it("strips the sensitive epoch key", () => {
            const data = toPublic(makeRecord({ group_id: 3 }));
            expect(data).to.deep.equal({
                group_id: 3,
                name: "Living Room",
                group_key_set_id: 1,
                members: [],
            });
            expect("epoch_key_hex" in data).to.equal(false);
        });
    });
});
