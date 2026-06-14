/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Environment, MockStorageService } from "@matter/general";
import { ConfigStorage } from "../src/server/ConfigStorage.js";

async function createConfig(): Promise<ConfigStorage> {
    const env = new Environment("test");
    new MockStorageService(env);
    return ConfigStorage.create(env);
}

describe("ConfigStorage", () => {
    describe("allocateNodeId", () => {
        let config: ConfigStorage;

        beforeEach(async () => {
            config = await createConfig();
        });

        afterEach(async () => {
            await config.close();
        });

        it("returns the current counter and advances it", async () => {
            expect(config.nextNodeId).to.equal(1);

            const first = await config.allocateNodeId(() => false);
            expect(first).to.equal(1);
            expect(config.nextNodeId).to.equal(2);

            const second = await config.allocateNodeId(() => false);
            expect(second).to.equal(2);
            expect(config.nextNodeId).to.equal(3);
        });

        it("skips ids that are already in use", async () => {
            const inUse = new Set<number | bigint>([1, 2, 3]);
            const allocated = await config.allocateNodeId(id => inUse.has(id));
            expect(allocated).to.equal(4);
            expect(config.nextNodeId).to.equal(5);
        });

        it("serializes concurrent allocations so ids never collide", async () => {
            const results = await Promise.all(Array.from({ length: 10 }, () => config.allocateNodeId(() => false)));

            const unique = new Set(results.map(id => id.toString()));
            expect(unique.size).to.equal(results.length);
            expect([...unique].sort((a, b) => Number(a) - Number(b))).to.deep.equal(
                Array.from({ length: 10 }, (_, i) => String(i + 1)),
            );
            expect(config.nextNodeId).to.equal(11);
        });

        it("preserves the bigint counter type when advancing", async () => {
            await config.set({ nextNodeId: 100n });

            const allocated = await config.allocateNodeId(() => false);
            expect(allocated).to.equal(100n);
            expect(config.nextNodeId).to.equal(101n);
            expect(typeof config.nextNodeId).to.equal("bigint");
        });
    });
});
