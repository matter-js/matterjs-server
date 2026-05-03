/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { FabricIndex, NodeId } from "@matter/main";
import { PeerAddress, PeerAddressSet } from "@matter/main/protocol";
import { hasTimeSyncCluster, TimeSyncConnector, TimeSyncManager } from "../src/controller/TimeSyncManager.js";
import { AttributesData } from "../src/types/CommandHandler.js";

const TIME_SYNC_CLUSTER_ID = 0x0038; // 56 decimal
const ONE_MINUTE_MS = 60_000;
const ONE_DAY_MS = 24 * 60 * ONE_MINUTE_MS;

// Startup delay is random 30–60 min; advancing 61 min always fires it
const PAST_STARTUP_MS = 61 * ONE_MINUTE_MS;

const PEER_1 = PeerAddress({ fabricIndex: FabricIndex(1), nodeId: NodeId(1) });
const PEER_2 = PeerAddress({ fabricIndex: FabricIndex(1), nodeId: NodeId(2) });

function makeTimeSyncAttrs(): AttributesData {
    return { [`0/${TIME_SYNC_CLUSTER_ID}/0`]: 1 };
}

class StubConnector implements TimeSyncConnector {
    readonly syncCalls: PeerAddress[] = [];
    private readonly _connected = new PeerAddressSet();
    slowSync = false;
    readonly syncResolvers: Array<() => void> = [];

    setConnected(peer: PeerAddress): void {
        this._connected.add(peer);
    }

    nodeConnected(peer: PeerAddress): boolean {
        return this._connected.has(peer);
    }

    async syncTime(peer: PeerAddress): Promise<void> {
        if (this.slowSync) {
            await new Promise<void>(resolve => this.syncResolvers.push(resolve));
        }
        this.syncCalls.push(peer);
    }

    resolveAll(): void {
        const resolvers = this.syncResolvers.splice(0);
        resolvers.forEach(r => r());
    }
}

describe("hasTimeSyncCluster", () => {
    it("returns true when TimeSynchronization cluster attributes are present", () => {
        expect(hasTimeSyncCluster({ [`0/${TIME_SYNC_CLUSTER_ID}/0`]: 1 })).to.equal(true);
    });

    it("returns true for any attribute index on the cluster", () => {
        expect(hasTimeSyncCluster({ [`0/${TIME_SYNC_CLUSTER_ID}/255`]: "x" })).to.equal(true);
    });

    it("returns false when no attributes are present", () => {
        expect(hasTimeSyncCluster({})).to.equal(false);
    });

    it("returns false for attributes on a different cluster", () => {
        expect(hasTimeSyncCluster({ "0/40/0": 1 })).to.equal(false);
    });

    it("only matches endpoint 0 per Matter spec", () => {
        expect(hasTimeSyncCluster({ [`1/${TIME_SYNC_CLUSTER_ID}/0`]: 1 })).to.equal(false);
    });
});

describe("TimeSyncManager", () => {
    let connector: StubConnector;
    let manager: TimeSyncManager;

    beforeEach(() => {
        MockTime.reset();
        connector = new StubConnector();
        manager = new TimeSyncManager(connector);
    });

    afterEach(async () => {
        connector.resolveAll(); // unblock any pending slow syncs so stop() doesn't hang
        await manager.stop();
    });

    describe("registerNode", () => {
        it("does not sync during the startup window even when connected", async () => {
            connector.setConnected(PEER_1);
            manager.registerNode(PEER_1, makeTimeSyncAttrs());
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(0);
        });

        it("does not sync when node is not connected, even after startup", async () => {
            manager.completeStartup();
            manager.registerNode(PEER_1, makeTimeSyncAttrs());
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(0);
        });

        it("syncs immediately once startupComplete is set and node is connected", async () => {
            connector.setConnected(PEER_1);
            manager.completeStartup();
            manager.registerNode(PEER_1, makeTimeSyncAttrs());
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(1);
        });

        it("does not sync for a node without the TimeSynchronization cluster", async () => {
            connector.setConnected(PEER_1);
            manager.completeStartup();
            manager.registerNode(PEER_1, { "0/40/0": 1 }); // no time sync cluster
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(0);
        });

        it("unregisters the peer when re-registered without TimeSynchronization cluster", async () => {
            manager.registerNode(PEER_1, makeTimeSyncAttrs()); // register
            manager.registerNode(PEER_1, { "0/40/0": 1 }); // no longer has cluster

            manager.completeStartup();
            connector.setConnected(PEER_1);
            manager.syncNode(PEER_1); // should be no-op since unregistered
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(0);
        });
    });

    describe("syncNode", () => {
        beforeEach(() => {
            manager.registerNode(PEER_1, makeTimeSyncAttrs());
            manager.completeStartup();
        });

        it("calls syncTime when peer is registered and connected", async () => {
            connector.setConnected(PEER_1);
            manager.syncNode(PEER_1);
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(1);
        });

        it("does not call syncTime when peer is not connected", async () => {
            manager.syncNode(PEER_1);
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(0);
        });

        it("does not call syncTime for an unregistered peer", async () => {
            connector.setConnected(PEER_2);
            manager.syncNode(PEER_2); // PEER_2 not registered
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(0);
        });

        it("deduplicates when a sync is already in flight", async () => {
            connector.slowSync = true;
            connector.setConnected(PEER_1);

            manager.syncNode(PEER_1); // starts in-flight sync
            manager.syncNode(PEER_1); // duplicate — dropped
            manager.syncNode(PEER_1); // duplicate — dropped

            connector.resolveAll();
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(1);
        });

        it("allows a new sync after the previous one completes", async () => {
            connector.slowSync = true;
            connector.setConnected(PEER_1);

            manager.syncNode(PEER_1);
            connector.resolveAll();
            await MockTime.yield3();

            manager.syncNode(PEER_1);
            connector.resolveAll();
            await MockTime.yield3();

            expect(connector.syncCalls.length).to.equal(2);
        });
    });

    describe("unregisterNode", () => {
        it("makes syncNode a no-op for the removed peer", async () => {
            connector.setConnected(PEER_1);
            manager.registerNode(PEER_1, makeTimeSyncAttrs());
            manager.unregisterNode(PEER_1);
            manager.completeStartup();
            manager.syncNode(PEER_1);
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(0);
        });
    });

    describe("periodic resync (via NodeProcessor timer)", () => {
        it("syncs connected nodes after the startup delay fires", async () => {
            connector.setConnected(PEER_1);
            manager.registerNode(PEER_1, makeTimeSyncAttrs());

            await MockTime.advance(PAST_STARTUP_MS);
            await MockTime.yield3();

            expect(connector.syncCalls.length).to.equal(1);
        });

        it("skips disconnected nodes during resync", async () => {
            connector.setConnected(PEER_1);
            manager.registerNode(PEER_1, makeTimeSyncAttrs());
            manager.registerNode(PEER_2, makeTimeSyncAttrs()); // PEER_2 not connected

            await MockTime.advance(PAST_STARTUP_MS);
            await MockTime.yield3();

            expect(connector.syncCalls.length).to.equal(1);
            expect(connector.syncCalls[0]).to.deep.equal(PEER_1);
        });

        it("skips peers that already have an in-flight sync", async () => {
            connector.slowSync = true;
            connector.setConnected(PEER_1);
            manager.registerNode(PEER_1, makeTimeSyncAttrs());
            manager.completeStartup();

            manager.syncNode(PEER_1); // start in-flight sync
            await MockTime.yield();

            await MockTime.advance(PAST_STARTUP_MS); // periodic cycle fires
            await MockTime.yield3();

            // Only 1 syncTime call total — the periodic cycle skipped PEER_1
            connector.resolveAll();
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(1);
        });

        it("enables immediate syncs on reconnect after the startup cycle completes", async () => {
            manager.registerNode(PEER_1, makeTimeSyncAttrs());

            await MockTime.advance(PAST_STARTUP_MS); // first cycle, no connected nodes
            await MockTime.yield3();

            // After startup, re-registering a connected node syncs immediately
            connector.setConnected(PEER_1);
            manager.registerNode(PEER_1, makeTimeSyncAttrs());
            await MockTime.yield3();

            expect(connector.syncCalls.length).to.equal(1);
        });

        it("resyncs again after 24 hours", async () => {
            connector.setConnected(PEER_1);
            manager.registerNode(PEER_1, makeTimeSyncAttrs());

            await MockTime.advance(PAST_STARTUP_MS); // first cycle
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(1);

            await MockTime.advance(ONE_DAY_MS); // 24h resync
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(2);
        });
    });

    describe("stop", () => {
        it("completes cleanly when no nodes are registered", async () => {
            await manager.stop();
        });

        it("completes cleanly when nodes are registered but no syncs are in flight", async () => {
            manager.registerNode(PEER_1, makeTimeSyncAttrs());
            await manager.stop();
        });

        it("awaits in-flight syncs before completing", async () => {
            connector.slowSync = true;
            connector.setConnected(PEER_1);
            manager.registerNode(PEER_1, makeTimeSyncAttrs());
            manager.completeStartup();
            manager.syncNode(PEER_1);

            let stopped = false;
            const stopPromise = manager.stop().then(() => {
                stopped = true;
            });

            await MockTime.yield();
            expect(stopped).to.equal(false); // still waiting on in-flight sync

            connector.resolveAll();
            await stopPromise;
            expect(stopped).to.equal(true);
        });
    });
});
