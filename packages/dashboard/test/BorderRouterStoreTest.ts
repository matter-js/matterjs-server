/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterClient, ThreadDiagnosticsBatch } from "@matter-server/ws-client";
import { BorderRouterStore, monotonicNow } from "../src/pages/network/border-router-store.js";

const XP_A = "1122334455667788";
const XP_B = "8877665544332211";

function batch(extPanIdHex: string, expiresInMs?: number): ThreadDiagnosticsBatch {
    return {
        extPanIdHex,
        networkName: "TestNet",
        collectedAt: 0,
        source: "meshcop",
        nodes: [],
        ...(expiresInMs === undefined ? {} : { expiresInMs }),
    };
}

/** Minimal stand-in: the store only ever calls sendCommand. */
function clientReturning(diagnostics: unknown): MatterClient {
    const client = {
        sendCommand: async (command: string) => (command === "get_thread_border_routers" ? [] : diagnostics),
    };
    return client as unknown as MatterClient;
}

describe("BorderRouterStore", () => {
    describe("diagnostics expiry", () => {
        it("keeps a batch while its stated lifetime is unspent", () => {
            const store = new BorderRouterStore();
            store.applyBatch(batch(XP_A, 60_000));

            expect(store.pruneExpired(store.nextExpiryAt! - 1_000)).to.equal(false);
            expect(store.diagnostics.has(XP_A)).to.equal(true);
        });

        it("drops a batch once its stated lifetime has run out", () => {
            const store = new BorderRouterStore();
            store.applyBatch(batch(XP_A, 60_000));

            expect(store.pruneExpired(store.nextExpiryAt! + 1)).to.equal(true);
            expect(store.diagnostics.has(XP_A)).to.equal(false);
        });

        it("keeps a batch that states no lifetime", () => {
            const store = new BorderRouterStore();
            store.applyBatch(batch(XP_A));

            expect(store.nextExpiryAt).to.equal(undefined);
            expect(store.pruneExpired(monotonicNow() + 86_400_000)).to.equal(false);
            expect(store.diagnostics.has(XP_A)).to.equal(true);
        });

        it("expires each network on its own deadline", () => {
            const store = new BorderRouterStore();
            store.applyBatch(batch(XP_A, 10_000));
            store.applyBatch(batch(XP_B, 60_000));

            expect(store.pruneExpired(monotonicNow() + 20_000)).to.equal(true);
            expect(store.diagnostics.has(XP_A)).to.equal(false);
            expect(store.diagnostics.has(XP_B)).to.equal(true);
        });

        it("reports the earliest deadline as the next expiry", () => {
            const store = new BorderRouterStore();
            const before = monotonicNow();
            store.applyBatch(batch(XP_A, 60_000));
            store.applyBatch(batch(XP_B, 10_000));

            const nextAt = store.nextExpiryAt;
            expect(nextAt).to.not.equal(undefined);
            expect(nextAt! - before).to.be.at.most(10_100);
        });

        it("restarts the lifetime when a network reports again", () => {
            const store = new BorderRouterStore();
            store.applyBatch(batch(XP_A, 10_000));
            const now = monotonicNow();

            store.applyBatch(batch(XP_A, 60_000));

            expect(store.pruneExpired(now + 20_000)).to.equal(false);
            expect(store.diagnostics.has(XP_A)).to.equal(true);
        });

        it("replaces a deadline with none when a network reports a batch that never expires", () => {
            const store = new BorderRouterStore();
            store.applyBatch(batch(XP_A, 10_000));

            store.applyBatch(batch(XP_A));

            expect(store.nextExpiryAt).to.equal(undefined);
            expect(store.pruneExpired(monotonicNow() + 86_400_000)).to.equal(false);
        });

        it("tracks deadlines for batches taken from a refresh", async () => {
            const store = new BorderRouterStore();
            await store.refresh(clientReturning([batch(XP_A, 10_000)]));

            expect(store.diagnostics.has(XP_A)).to.equal(true);
            expect(store.pruneExpired(store.nextExpiryAt! + 1)).to.equal(true);
            expect(store.diagnostics.has(XP_A)).to.equal(false);
        });

        it("forgets the deadline of a network a refresh no longer reports", async () => {
            const store = new BorderRouterStore();
            store.applyBatch(batch(XP_A, 10_000));

            await store.refresh(clientReturning([batch(XP_B, 60_000)]));

            expect(store.diagnostics.has(XP_A)).to.equal(false);
            expect(store.pruneExpired(monotonicNow() + 20_000)).to.equal(false);
        });

        it("drops a batch whose stated lifetime is already spent", () => {
            const store = new BorderRouterStore();

            // The server clamps the remaining lifetime at zero, and a send delayed past the TTL
            // delivers exactly that. Zero is spent, not absent.
            store.applyBatch(batch(XP_A, 0));

            expect(store.nextExpiryAt).to.not.equal(undefined);
            expect(store.pruneExpired()).to.equal(true);
            expect(store.diagnostics.has(XP_A)).to.equal(false);
        });

        it("drops a batch whose stated lifetime is negative", () => {
            const store = new BorderRouterStore();
            store.applyBatch(batch(XP_A, -1_000));

            expect(store.pruneExpired()).to.equal(true);
            expect(store.diagnostics.has(XP_A)).to.equal(false);
        });

        it("ignores a lifetime that is not a finite number", () => {
            const store = new BorderRouterStore();

            for (const lifetime of [Number.NaN, Number.POSITIVE_INFINITY]) {
                store.applyBatch(batch(XP_A, lifetime));
                expect(store.nextExpiryAt, `lifetime ${lifetime}`).to.equal(undefined);
            }
            expect(store.diagnostics.has(XP_A)).to.equal(true);
        });

        it("keeps batches expirable when a refresh throws midway", async () => {
            const store = new BorderRouterStore();
            store.applyBatch(batch(XP_A, 10_000));
            const deadline = store.nextExpiryAt;

            // A batch whose extPanIdHex is absent makes the refresh loop throw; the store swallows
            // that, and must not be left holding batches it can no longer expire.
            await store.refresh(clientReturning([{ networkName: "broken" }]));

            expect(store.nextExpiryAt).to.equal(deadline);
            expect(store.pruneExpired(deadline! + 1)).to.equal(true);
        });

        it("clears deadlines on reset", () => {
            const store = new BorderRouterStore();
            store.applyBatch(batch(XP_A, 10_000));

            store.reset();

            expect(store.nextExpiryAt).to.equal(undefined);
            expect(store.diagnostics.size).to.equal(0);
        });
    });
});
