/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { FabricIndex, LogDestination, Logger, NodeId } from "@matter/main";
import { PeerAddress } from "@matter/main/protocol";
import { SubscriptionWatchdog, SubscriptionWatchdogContext } from "../src/controller/SubscriptionWatchdog.js";

const PEER_1 = PeerAddress({ fabricIndex: FabricIndex(1), nodeId: NodeId(1) });
const PEER_2 = PeerAddress({ fabricIndex: FabricIndex(1), nodeId: NodeId(2) });

// threshold for interval 61s = 61*1000*1.5 + 60000 = 151_500 ms (like the Eve plugs: 1m1s)
const THRESHOLD_MS = 151_500;
const JUST_PAST_THRESHOLD_MS = THRESHOLD_MS + 1_000;
// Backoff for the 61s-interval case: max(2 * 151_500, 600_000) = 600_000 (the 10 min floor wins).
const BACKOFF_FLOOR_MS = 10 * 60_000;
const FALLBACK_THRESHOLD_MS = 15 * 60_000;
const SNAPSHOT_INTERVAL_MS = 60 * 60_000;

function fakeContext(overrides: Partial<SubscriptionWatchdogContext> = {}) {
    const calls = { forceUnavailable: 0, notifyUnavailable: 0, triggerReconnect: 0 };
    const context: SubscriptionWatchdogContext = {
        nodeConnected: () => true,
        subscriptionIntervalSeconds: () => 61, // like the Eve plugs: 1m1s
        forceUnavailable: () => {
            calls.forceUnavailable++;
            return calls.forceUnavailable === 1;
        },
        notifyUnavailable: () => {
            calls.notifyUnavailable++;
        },
        triggerReconnect: () => {
            calls.triggerReconnect++;
        },
        ...overrides,
    };
    return { context, calls };
}

/** Capture every log line emitted while the actor runs (via a temporary Logger destination). */
async function captureLog(actor: () => Promise<void>): Promise<string[]> {
    const lines: string[] = [];
    Logger.destinations.subscriptionWatchdogTestCapture = LogDestination({
        write(text) {
            lines.push(text);
        },
    });
    try {
        await actor();
    } finally {
        delete Logger.destinations.subscriptionWatchdogTestCapture;
    }
    return lines;
}

describe("SubscriptionWatchdog", () => {
    let watchdog: SubscriptionWatchdog | undefined;

    /**
     * Create a watchdog with the background NodeProcessor timer permanently detached (stop()
     * halts the timer but leaves registerNode/recordAlive/checkNow/consumePendingRepair fully
     * functional), so ONLY the explicit checkNow() seam drives evaluation. This keeps every
     * test independent of the real 30s auto-cycle schedule.
     */
    async function makeWatchdog(overrides: Partial<SubscriptionWatchdogContext> = {}) {
        const { context, calls } = fakeContext(overrides);
        const dog = new SubscriptionWatchdog(context);
        await dog.stop();
        watchdog = dog; // for afterEach cleanup
        return { dog, calls };
    }

    beforeEach(() => {
        MockTime.reset();
    });

    afterEach(async () => {
        await watchdog?.stop();
        watchdog = undefined;
    });

    it("does not trip while alive events keep arriving", async () => {
        const { dog, calls } = await makeWatchdog();
        dog.registerNode(PEER_1);

        await MockTime.advance(100_000);
        dog.recordAlive(PEER_1);

        await MockTime.advance(100_000);
        await dog.checkNow();

        expect(calls).to.deep.equal({ forceUnavailable: 0, notifyUnavailable: 0, triggerReconnect: 0 });
    });

    it("trips exactly once past threshold: forceUnavailable, notify (transition-gated), triggerReconnect", async () => {
        const { dog, calls } = await makeWatchdog();
        dog.registerNode(PEER_1);

        await MockTime.advance(JUST_PAST_THRESHOLD_MS);
        await dog.checkNow();

        expect(calls).to.deep.equal({ forceUnavailable: 1, notifyUnavailable: 1, triggerReconnect: 1 });
        expect(dog.consumePendingRepair(PEER_1)).to.equal(true);
        expect(dog.consumePendingRepair(PEER_1)).to.equal(false);
    });

    it("suppresses re-trip inside backoff, re-trips after max(2×threshold, 10min) of continued silence", async () => {
        const { dog, calls } = await makeWatchdog();
        dog.registerNode(PEER_1);

        // First trip.
        await MockTime.advance(JUST_PAST_THRESHOLD_MS);
        await dog.checkNow();
        expect(calls.forceUnavailable).to.equal(1);

        // 5 min into the 10 min backoff floor -- still suppressed.
        await MockTime.advance(5 * 60_000);
        await dog.checkNow();
        expect(calls.forceUnavailable).to.equal(1);

        // Past the 10 min backoff floor since the first trip -- re-trips.
        await MockTime.advance(BACKOFF_FLOOR_MS - 5 * 60_000 + 1_000);
        await dog.checkNow();

        expect(calls.forceUnavailable).to.equal(2);
        expect(calls.triggerReconnect).to.equal(2);
        expect(calls.notifyUnavailable).to.equal(1); // forceUnavailable returned false on the 2nd trip
    });

    it("fresh connectionAlive resets lastAliveAt and backoff", async () => {
        const { dog, calls } = await makeWatchdog();
        dog.registerNode(PEER_1);

        // First trip.
        await MockTime.advance(JUST_PAST_THRESHOLD_MS);
        await dog.checkNow();
        expect(calls.forceUnavailable).to.equal(1);

        // Fresh data arrives: clears lastAliveAt AND the backoff gate.
        dog.recordAlive(PEER_1);

        // Cross the threshold again immediately -- no need to wait out the 10 min backoff.
        await MockTime.advance(JUST_PAST_THRESHOLD_MS);
        await dog.checkNow();

        expect(calls.forceUnavailable).to.equal(2);
        expect(calls.triggerReconnect).to.equal(2);
    });

    it("re-registration on Connected re-initializes lastAliveAt to now", async () => {
        const { dog, calls } = await makeWatchdog();
        dog.registerNode(PEER_1);

        // Advance past the threshold WITHOUT running a check cycle.
        await MockTime.advance(JUST_PAST_THRESHOLD_MS);

        dog.registerNode(PEER_1); // re-registration resets lastAliveAt to now
        await dog.checkNow();

        expect(calls).to.deep.equal({ forceUnavailable: 0, notifyUnavailable: 0, triggerReconnect: 0 });
    });

    it("re-registration after a trip starts clean: no pending repair, fresh lastAliveAt, no immediate re-trip", async () => {
        const { dog, calls } = await makeWatchdog();
        dog.registerNode(PEER_1);

        // Trip once (pendingRepair intentionally left unconsumed).
        await MockTime.advance(JUST_PAST_THRESHOLD_MS);
        await dog.checkNow();
        expect(calls.forceUnavailable).to.equal(1);

        dog.unregisterNode(PEER_1);
        dog.registerNode(PEER_1);

        // Fresh lastAliveAt: no immediate re-trip, and the pre-unregister repair flag is gone.
        await dog.checkNow();
        expect(calls.forceUnavailable).to.equal(1);
        expect(dog.consumePendingRepair(PEER_1)).to.equal(false);

        // Silence is measured from the re-registration (and backoff was cleared): trips again.
        await MockTime.advance(JUST_PAST_THRESHOLD_MS);
        await dog.checkNow();
        expect(calls.forceUnavailable).to.equal(2);
    });

    it("undefined interval uses the 15-minute fallback", async () => {
        const { dog, calls } = await makeWatchdog({ subscriptionIntervalSeconds: () => undefined });
        dog.registerNode(PEER_1);

        await MockTime.advance(10 * 60_000);
        await dog.checkNow();
        expect(calls.forceUnavailable).to.equal(0);

        // Past the 15 min fallback threshold -- trips.
        await MockTime.advance(FALLBACK_THRESHOLD_MS - 10 * 60_000 + 1_000);
        await dog.checkNow();

        expect(calls.forceUnavailable).to.equal(1);
    });

    it("skips nodes that are not Connected", async () => {
        const { dog, calls } = await makeWatchdog({ nodeConnected: () => false });
        dog.registerNode(PEER_1);

        await MockTime.advance(JUST_PAST_THRESHOLD_MS);
        await dog.checkNow();

        expect(calls).to.deep.equal({ forceUnavailable: 0, notifyUnavailable: 0, triggerReconnect: 0 });
    });

    it("unregisterNode clears all state", async () => {
        const { dog, calls } = await makeWatchdog();
        dog.registerNode(PEER_1);

        await MockTime.advance(JUST_PAST_THRESHOLD_MS);

        dog.unregisterNode(PEER_1);
        await dog.checkNow();

        expect(calls).to.deep.equal({ forceUnavailable: 0, notifyUnavailable: 0, triggerReconnect: 0 });
        expect(dog.consumePendingRepair(PEER_1)).to.equal(false);
    });

    it("a throwing notifyUnavailable still triggers reconnect and checkNow resolves", async () => {
        const { dog, calls } = await makeWatchdog({
            notifyUnavailable: () => {
                throw new Error("ws dead");
            },
        });
        dog.registerNode(PEER_1);

        await MockTime.advance(JUST_PAST_THRESHOLD_MS);

        await dog.checkNow(); // must not reject

        expect(calls.forceUnavailable).to.equal(1);
        expect(calls.triggerReconnect).to.equal(1);
    });

    it("contains a throwing subscriptionIntervalSeconds: checkNow resolves, no trip, other peers still processed", async () => {
        const reconnected: PeerAddress[] = [];
        const { dog, calls } = await makeWatchdog({
            subscriptionIntervalSeconds: peer => {
                if (PeerAddress.is(peer, PEER_1)) throw new Error("boom");
                return 61;
            },
            triggerReconnect: peer => {
                reconnected.push(peer);
            },
        });
        // PEER_1 registered first, so its throwing evaluation runs before PEER_2's.
        dog.registerNode(PEER_1);
        dog.registerNode(PEER_2);

        await MockTime.advance(JUST_PAST_THRESHOLD_MS);
        await dog.checkNow(); // must not reject

        expect(reconnected).to.deep.equal([PEER_2]); // PEER_1 contained, PEER_2 still processed
        expect(calls.forceUnavailable).to.equal(1);
        expect(dog.consumePendingRepair(PEER_1)).to.equal(false);
        expect(dog.consumePendingRepair(PEER_2)).to.equal(true);
    });

    it("checkNow runs the hourly snapshot exactly once per peer, tolerating a throwing interval getter", async () => {
        const { dog } = await makeWatchdog({
            subscriptionIntervalSeconds: peer => {
                if (PeerAddress.is(peer, PEER_2)) throw new Error("boom");
                return 61;
            },
        });
        dog.registerNode(PEER_1);
        dog.registerNode(PEER_2);

        await MockTime.advance(SNAPSHOT_INTERVAL_MS + 1_000);
        // Keep both peers under threshold so only the snapshot (not a trip) is at play.
        dog.recordAlive(PEER_1);
        dog.recordAlive(PEER_2);

        const first = (await captureLog(() => dog.checkNow())).filter(line => line.includes("Watchdog snapshot"));
        const second = (await captureLog(() => dog.checkNow())).filter(line => line.includes("Watchdog snapshot"));

        expect(first.length).to.equal(2); // exactly one line per registered peer
        expect(first.filter(line => line.includes("@1:1")).length).to.equal(1);
        expect(first.filter(line => line.includes("@1:2")).length).to.equal(1);
        expect(first.find(line => line.includes("@1:1"))).to.include("interval=61s");
        expect(first.find(line => line.includes("@1:2"))).to.include("interval=?s"); // getter threw -- guarded
        expect(second.length).to.equal(0); // #lastSnapshotAt gates the immediate second cycle
    });
});
