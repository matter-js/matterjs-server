/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { FabricIndex, Hours, Minutes, NodeId, Seconds } from "@matter/main";
import { PeerAddress, PeerAddressSet } from "@matter/main/protocol";
import {
    dstOffsetListMaxSize,
    hasTimeSyncCluster,
    hasTimeZoneFeature,
    resyncDelayMs,
    startupDelayMs,
    SyncTrigger,
    TimeSyncConnector,
    TimeSyncManager,
} from "../src/controller/TimeSyncManager.js";
import { AttributesData } from "../src/types/CommandHandler.js";

const TIME_SYNC_CLUSTER_ID = 0x0038; // 56 decimal
const ONE_MINUTE_MS = 60_000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

// MockTimer ignores interval assignment, so the startup delay these cases see is the constructor
// seed of 3 min rather than the node-count-scaled value; 61 min is well past either.
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
    nodeCount = 0;
    readonly syncResolvers: Array<() => void> = [];

    setConnected(peer: PeerAddress): void {
        this._connected.add(peer);
    }

    nodeConnected(peer: PeerAddress): boolean {
        return this._connected.has(peer);
    }

    commissionedNodeCount(): number {
        return this.nodeCount;
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

describe("startupDelayMs", () => {
    it("is 3 minutes plus 10 seconds per commissioned node", () => {
        expect(startupDelayMs(0)).to.equal(Minutes(3));
        expect(startupDelayMs(12)).to.equal(Minutes(5));
        expect(startupDelayMs(100)).to.equal(Minutes(3) + Seconds(1000));
    });

    it("is deterministic, so restarts do not vary the first sync", () => {
        expect(startupDelayMs(7)).to.equal(startupDelayMs(7));
    });
});

describe("resyncDelayMs", () => {
    const NOW = 1_700_000_000_000;

    it("uses the full interval when no offset change is in view", () => {
        expect(resyncDelayMs(NOW, null)).to.equal(Hours(24));
    });

    it("lands a minute past an offset change inside the interval", () => {
        expect(resyncDelayMs(NOW, NOW + Hours(5))).to.equal(Hours(5) + Minutes(1));
    });

    it("uses the full interval when the change falls beyond it", () => {
        expect(resyncDelayMs(NOW, NOW + Hours(30))).to.equal(Hours(24));
        // A change exactly at the interval must not schedule past it.
        expect(resyncDelayMs(NOW, NOW + Hours(24))).to.equal(Hours(24));
    });

    it("still clears the floor for a change moments away, via the margin", () => {
        expect(resyncDelayMs(NOW, NOW + 1000)).to.equal(Minutes(1) + 1000);
        expect(resyncDelayMs(NOW, NOW)).to.equal(Minutes(1));
    });

    it("treats a non-finite instant as no change in view", () => {
        // The lookup is injectable, and a NaN delay would otherwise reach the timer and fire at once.
        expect(resyncDelayMs(NOW, NaN)).to.equal(Hours(24));
        expect(resyncDelayMs(NOW, Number.POSITIVE_INFINITY)).to.equal(Hours(24));
    });

    it("defers a change whose instant has already passed", () => {
        expect(resyncDelayMs(NOW, NOW - Hours(1))).to.equal(Hours(24));
        expect(resyncDelayMs(NOW, NOW - Minutes(2))).to.equal(Hours(24));
    });
});

describe("TimeSyncManager", () => {
    let connector: StubConnector;
    let manager: TimeSyncManager;

    beforeEach(() => {
        MockTime.reset();
        connector = new StubConnector();
        // No offset change in view, so these cases see the plain 24 h cadence.
        manager = new TimeSyncManager(connector, () => null);
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

    describe("offset lookup failure", () => {
        it("keeps syncing and rescheduling when the lookup throws", async () => {
            const failing = new TimeSyncManager(connector, () => {
                throw new Error("zone lookup exploded");
            });
            try {
                connector.setConnected(PEER_1);
                failing.registerNode(PEER_1, makeTimeSyncAttrs());

                // The delay is computed before the cycle body and outside its finally, so a throw
                // there must not cost the cycle or the reschedule that keeps the timer alive.
                await MockTime.advance(PAST_STARTUP_MS);
                await MockTime.yield3();
                expect(connector.syncCalls.length, "first cycle must still run").to.be.greaterThan(0);

                const afterFirst = connector.syncCalls.length;
                for (let i = 0; i < 3; i++) {
                    await MockTime.advance(PAST_STARTUP_MS);
                    await MockTime.yield3();
                }
                expect(connector.syncCalls.length, "timer must still be scheduled").to.be.greaterThan(afterFirst);
            } finally {
                connector.resolveAll();
                await failing.stop();
            }
        });
    });

    describe("startup window", () => {
        it("defers a trigger sync until the first periodic cycle", async () => {
            connector.setConnected(PEER_1);
            manager.registerNode(PEER_1, makeTimeSyncAttrs());

            // A restart can leave many nodes reporting timeFailure at once, which is the traffic the
            // window exists to avoid; the first cycle covers all of them together.
            manager.syncNode(PEER_1, SyncTrigger.TimeFailure);
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(0);

            await MockTime.advance(PAST_STARTUP_MS);
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.be.greaterThan(0);
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

        it("answers a timeFailure long before a reconnect would be allowed again", async () => {
            manager.syncNode(PEER_1, SyncTrigger.Reconnect);
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(1);

            await MockTime.advance(ONE_HOUR_MS);
            await MockTime.yield3();
            const afterHour = connector.syncCalls.length;

            manager.syncNode(PEER_1, SyncTrigger.Reconnect);
            await MockTime.yield3();
            expect(connector.syncCalls.length, "reconnect stays held off for 24 h").to.equal(afterHour);

            manager.syncNode(PEER_1, SyncTrigger.TimeFailure);
            await MockTime.yield3();
            expect(connector.syncCalls.length, "a node asking for a time is answered").to.equal(afterHour + 1);
        });

        it("holds off a timeFailure repeated inside the hour", async () => {
            manager.syncNode(PEER_1, SyncTrigger.TimeFailure);
            await MockTime.yield3();
            expect(connector.syncCalls.length).to.equal(1);

            manager.syncNode(PEER_1, SyncTrigger.TimeFailure);
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

    describe("offset-change lookup", () => {
        it("consults the lookup when scheduling the cycle that follows a sync", async () => {
            const lookupCalls = new Array<number>();
            const probed = new TimeSyncManager(connector, fromMs => {
                lookupCalls.push(fromMs);
                return null;
            });
            try {
                connector.setConnected(PEER_1);
                probed.registerNode(PEER_1, makeTimeSyncAttrs());
                expect(lookupCalls.length, "not consulted before the first cycle").to.equal(0);

                await MockTime.advance(PAST_STARTUP_MS);
                await MockTime.yield3();

                expect(connector.syncCalls.length).to.equal(1);
                expect(lookupCalls.length).to.be.greaterThan(0);
                expect(lookupCalls[0]).to.be.greaterThan(0);
            } finally {
                connector.resolveAll();
                await probed.stop();
            }
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
