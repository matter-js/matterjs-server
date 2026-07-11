/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { FabricIndex, NodeId } from "@matter/main";
import { TimeSynchronization } from "@matter/main/clusters";
import { PeerAddress, PeerAddressSet } from "@matter/main/protocol";
import { Status, StatusResponseError } from "@matter/main/types";
import {
    dstOffsetListMaxSize,
    hasTimeSyncCluster,
    hasTimeZoneFeature,
    TimeSyncConnector,
    TimeSyncManager,
} from "../src/controller/TimeSyncManager.js";
import { AttributesData } from "../src/types/CommandHandler.js";

const TIME_SYNC_CLUSTER_ID = 0x0038; // 56 decimal
const ONE_MINUTE_MS = 60_000;
const ONE_DAY_MS = 24 * 60 * ONE_MINUTE_MS;

// Startup delay is random 30–60 min; advancing 61 min always fires it
const PAST_STARTUP_MS = 61 * ONE_MINUTE_MS;

const PEER_1 = PeerAddress({ fabricIndex: FabricIndex(1), nodeId: NodeId(1) });
const PEER_2 = PeerAddress({ fabricIndex: FabricIndex(1), nodeId: NodeId(2) });

function makeTimeSyncAttrs(): AttributesData {
    return { [`0/${TIME_SYNC_CLUSTER_ID}/1`]: 1 };
}

class StubConnector implements TimeSyncConnector {
    readonly syncCalls: PeerAddress[] = [];
    private readonly _connected = new PeerAddressSet();
    slowSync = false;
    /** When true, the next syncTime() call rejects instead of succeeding (auto-resets after firing). */
    failNext = false;
    /** When set, the next syncTime() call rejects with this specific error (auto-resets after firing). */
    failNextWith: Error | undefined = undefined;
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
        if (this.failNext) {
            this.failNext = false;
            throw new Error("simulated sync failure");
        }
        if (this.failNextWith !== undefined) {
            const error = this.failNextWith;
            this.failNextWith = undefined;
            throw error;
        }
    }

    resolveAll(): void {
        const resolvers = this.syncResolvers.splice(0);
        resolvers.forEach(r => r());
    }
}

describe("hasTimeSyncCluster", () => {
    it("returns true when Granularity attribute (1) is present", () => {
        expect(hasTimeSyncCluster({ [`0/${TIME_SYNC_CLUSTER_ID}/1`]: 1 })).to.equal(true);
    });

    it("returns false when only non-Granularity attributes are present", () => {
        expect(hasTimeSyncCluster({ [`0/${TIME_SYNC_CLUSTER_ID}/0`]: 1 })).to.equal(false);
    });

    it("returns false when no attributes are present", () => {
        expect(hasTimeSyncCluster({})).to.equal(false);
    });

    it("returns false for attributes on a different cluster", () => {
        expect(hasTimeSyncCluster({ "0/40/0": 1 })).to.equal(false);
    });

    it("only matches endpoint 0 per Matter spec", () => {
        expect(hasTimeSyncCluster({ [`1/${TIME_SYNC_CLUSTER_ID}/1`]: 1 })).to.equal(false);
    });
});

describe("hasTimeZoneFeature", () => {
    it("returns true when the TimeZone attribute (5) is present", () => {
        expect(hasTimeZoneFeature({ [`0/${TIME_SYNC_CLUSTER_ID}/5`]: [] })).to.equal(true);
    });

    it("returns false when the TimeZone attribute is absent", () => {
        expect(hasTimeZoneFeature({ [`0/${TIME_SYNC_CLUSTER_ID}/1`]: 1 })).to.equal(false);
    });

    it("only matches endpoint 0", () => {
        expect(hasTimeZoneFeature({ [`1/${TIME_SYNC_CLUSTER_ID}/5`]: [] })).to.equal(false);
    });
});

describe("dstOffsetListMaxSize", () => {
    it("returns the numeric attribute value", () => {
        expect(dstOffsetListMaxSize({ [`0/${TIME_SYNC_CLUSTER_ID}/11`]: 4 })).to.equal(4);
    });

    it("returns undefined when absent or non-numeric", () => {
        expect(dstOffsetListMaxSize({})).to.equal(undefined);
        expect(dstOffsetListMaxSize({ [`0/${TIME_SYNC_CLUSTER_ID}/11`]: "x" })).to.equal(undefined);
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

        it("clears the in-flight marker after completion so periodic resync is not blocked", async () => {
            connector.slowSync = true;
            connector.setConnected(PEER_1);

            manager.syncNode(PEER_1); // in-flight
            connector.resolveAll();
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(1);

            // With the in-flight marker cleared, the periodic cycle can process PEER_1 again
            // (the periodic path is not subject to the trigger cooldown).
            connector.slowSync = false;
            await MockTime.advance(ONE_DAY_MS);
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(2);
        });
    });

    describe("trigger sync cooldown", () => {
        beforeEach(() => {
            manager.registerNode(PEER_1, makeTimeSyncAttrs());
            manager.completeStartup();
            connector.setConnected(PEER_1);
        });

        it("skips a second trigger sync within the 24h cooldown", async () => {
            manager.syncNode(PEER_1);
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(1);

            manager.syncNode(PEER_1); // within cooldown — dropped
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(1);
        });

        it("allows a trigger sync after the 24h cooldown elapses", async () => {
            manager.syncNode(PEER_1);
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(1);

            await MockTime.advance(ONE_DAY_MS); // periodic resync fires (does not touch cooldown)
            await MockTime.yield3();
            const afterResync = connector.syncCalls.length;

            manager.syncNode(PEER_1); // 24h since the trigger cooldown was set — allowed
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(afterResync + 1);
        });

        it("does not cool down the periodic resync path", async () => {
            manager.syncNode(PEER_1); // sets trigger cooldown at T=0
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(1);

            await MockTime.advance(ONE_DAY_MS); // periodic still resyncs despite recent trigger sync
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(2);
        });
    });

    describe("trigger sync cooldown after a failed attempt", () => {
        beforeEach(() => {
            manager.registerNode(PEER_1, makeTimeSyncAttrs());
            manager.completeStartup();
            connector.setConnected(PEER_1);
        });

        it("retries a failed trigger sync after the short backoff, well before the 24h cooldown would allow it", async () => {
            connector.failNext = true;
            manager.syncNode(PEER_1);
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(1);

            manager.syncNode(PEER_1); // immediately after — still backed off, dropped
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(1);

            await MockTime.advance(6 * ONE_MINUTE_MS); // past the 5-min failure backoff
            await MockTime.yield3();

            manager.syncNode(PEER_1); // backoff elapsed — retries
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(2);
        });

        it("applies the full 24h cooldown to a TimeNotAccepted refusal, not the short backoff", async () => {
            // TimeNotAccepted is a deliberate, persistent refusal — the node prefers its
            // existing time source. Retrying every 5 minutes would storm a non-retryable
            // response; it must earn the same long cooldown as a success.
            connector.failNextWith = new StatusResponseError(
                "Time not accepted",
                Status.Failure,
                TimeSynchronization.StatusCode.TimeNotAccepted,
            );
            manager.syncNode(PEER_1);
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(1);

            await MockTime.advance(6 * ONE_MINUTE_MS); // past the 5-min failure backoff
            manager.syncNode(PEER_1); // must be dropped — the long cooldown applies
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(1);

            await MockTime.advance(ONE_DAY_MS); // periodic resync may fire in here (no trigger cooldown)
            await MockTime.yield3();
            const afterResync = connector.syncCalls.length;

            manager.syncNode(PEER_1); // cooldown elapsed — allowed again
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(afterResync + 1);
        });

        it("still cools down for the full 24h after a successful sync (not shortened by an earlier failure)", async () => {
            connector.failNext = true;
            manager.syncNode(PEER_1); // fails, short backoff set
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(1);

            await MockTime.advance(6 * ONE_MINUTE_MS); // backoff elapsed
            await MockTime.yield3();

            manager.syncNode(PEER_1); // retry succeeds — full 24h cooldown now applies
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(2);

            manager.syncNode(PEER_1); // well within the new 24h cooldown — dropped
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(2);
        });
    });

    describe("unregisterNode", () => {
        it("clears the trigger cooldown so a re-registered peer syncs again", async () => {
            manager.registerNode(PEER_1, makeTimeSyncAttrs());
            manager.completeStartup();
            connector.setConnected(PEER_1);

            manager.syncNode(PEER_1);
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(1);

            manager.unregisterNode(PEER_1); // clears cooldown
            manager.registerNode(PEER_1, makeTimeSyncAttrs());
            manager.syncNode(PEER_1); // cooldown was cleared — syncs again
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(2);
        });

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

        it("skips a trigger sync while a periodic sync for the same peer is in flight", async () => {
            connector.slowSync = true;
            connector.setConnected(PEER_1);
            manager.registerNode(PEER_1, makeTimeSyncAttrs());

            await MockTime.advance(PAST_STARTUP_MS); // periodic cycle starts
            await MockTime.yield(); // periodic processNode now in-flight (slow)

            manager.syncNode(PEER_1); // must be deduped by the in-flight periodic sync
            await MockTime.yield();

            connector.resolveAll();
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(1); // only the periodic sync ran
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
            await MockTime.yield3(); // let the periodic timer fully reschedule before advancing again

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

        it("interrupts a periodic cycle mid-batch and skips remaining nodes", async () => {
            connector.slowSync = true;
            connector.setConnected(PEER_1);
            connector.setConnected(PEER_2);
            manager.registerNode(PEER_1, makeTimeSyncAttrs());
            manager.registerNode(PEER_2, makeTimeSyncAttrs());

            await MockTime.advance(PAST_STARTUP_MS); // periodic cycle starts, first node sync in-flight
            await MockTime.yield();

            let stopped = false;
            const stopPromise = manager.stop().then(() => {
                stopped = true;
            });

            await MockTime.yield();
            expect(stopped).to.equal(false); // barrier: waiting on the in-flight processNode

            connector.resolveAll(); // first node's sync completes
            await stopPromise;
            expect(stopped).to.equal(true);
            expect(connector.syncCalls.length).to.equal(1); // second node skipped after close
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
