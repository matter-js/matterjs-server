/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { FabricIndex, NodeId } from "@matter/main";
import { PeerAddress } from "@matter/main/protocol";
import { SubscriptionWatchdog, SubscriptionWatchdogContext } from "../src/controller/SubscriptionWatchdog.js";

const PEER_1 = PeerAddress({ fabricIndex: FabricIndex(1), nodeId: NodeId(1) });

// threshold for interval 61s = 61*1000*1.5 + 60000 = 151_500 ms (like the Eve plugs: 1m1s)
const THRESHOLD_MS = 151_500;
// Stays comfortably clear of the NodeProcessor timer's next 30s auto-cycle boundary (180_000),
// so the explicit checkNow() call -- not the background timer -- is what detects the trip.
const JUST_PAST_THRESHOLD_MS = THRESHOLD_MS + 500;
// Backoff for the 61s-interval case: max(2 * 151_500, 600_000) = 600_000 (the 10 min floor wins).
const BACKOFF_FLOOR_MS = 10 * 60_000;
const FALLBACK_THRESHOLD_MS = 15 * 60_000;

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

describe("SubscriptionWatchdog", () => {
    let watchdog: SubscriptionWatchdog | undefined;

    beforeEach(() => {
        MockTime.reset();
    });

    afterEach(async () => {
        await watchdog?.stop();
        watchdog = undefined;
    });

    it("does not trip while alive events keep arriving", async () => {
        const { context, calls } = fakeContext();
        watchdog = new SubscriptionWatchdog(context);
        watchdog.registerNode(PEER_1);

        await MockTime.advance(100_000);
        await MockTime.yield3();
        watchdog.recordAlive(PEER_1);

        await MockTime.advance(100_000);
        await MockTime.yield3();
        await watchdog.checkNow();

        expect(calls).to.deep.equal({ forceUnavailable: 0, notifyUnavailable: 0, triggerReconnect: 0 });
    });

    it("trips exactly once past threshold: forceUnavailable, notify (transition-gated), triggerReconnect", async () => {
        const { context, calls } = fakeContext();
        watchdog = new SubscriptionWatchdog(context);
        watchdog.registerNode(PEER_1);

        await MockTime.advance(JUST_PAST_THRESHOLD_MS);
        await MockTime.yield3();
        await watchdog.checkNow();

        expect(calls).to.deep.equal({ forceUnavailable: 1, notifyUnavailable: 1, triggerReconnect: 1 });
        expect(watchdog.consumePendingRepair(PEER_1)).to.equal(true);
        expect(watchdog.consumePendingRepair(PEER_1)).to.equal(false);
    });

    it("suppresses re-trip inside backoff, re-trips after max(2×threshold, 10min) of continued silence", async () => {
        const { context, calls } = fakeContext();
        watchdog = new SubscriptionWatchdog(context);
        watchdog.registerNode(PEER_1);

        // First trip.
        await MockTime.advance(JUST_PAST_THRESHOLD_MS);
        await MockTime.yield3();
        await watchdog.checkNow();
        expect(calls.forceUnavailable).to.equal(1);

        // 5 min into the 10 min backoff floor -- still suppressed.
        await MockTime.advance(5 * 60_000);
        await MockTime.yield3();
        await watchdog.checkNow();
        expect(calls.forceUnavailable).to.equal(1);

        // Push total silence since the first trip past the 10 min backoff floor (still short of
        // the NodeProcessor timer's next 30s cycle boundary, so checkNow() is what catches it).
        await MockTime.advance(BACKOFF_FLOOR_MS - 5 * 60_000 + 8_000);
        await MockTime.yield3();
        await watchdog.checkNow();

        expect(calls.forceUnavailable).to.equal(2);
        expect(calls.triggerReconnect).to.equal(2);
        expect(calls.notifyUnavailable).to.equal(1); // forceUnavailable returned false on the 2nd trip
    });

    it("fresh connectionAlive resets lastAliveAt and backoff", async () => {
        const { context, calls } = fakeContext();
        watchdog = new SubscriptionWatchdog(context);
        watchdog.registerNode(PEER_1);

        // First trip.
        await MockTime.advance(JUST_PAST_THRESHOLD_MS);
        await MockTime.yield3();
        await watchdog.checkNow();
        expect(calls.forceUnavailable).to.equal(1);

        // Fresh data arrives: clears lastAliveAt AND the backoff gate.
        watchdog.recordAlive(PEER_1);

        // Cross the threshold again immediately -- no need to wait out the 10 min backoff.
        await MockTime.advance(JUST_PAST_THRESHOLD_MS);
        await MockTime.yield3();
        await watchdog.checkNow();

        expect(calls.forceUnavailable).to.equal(2);
        expect(calls.triggerReconnect).to.equal(2);
    });

    it("re-registration on Connected re-initializes lastAliveAt to now", async () => {
        const { context, calls } = fakeContext();
        watchdog = new SubscriptionWatchdog(context);
        watchdog.registerNode(PEER_1);

        // Advance past the threshold WITHOUT ever calling checkNow() or letting the background
        // timer catch up (next auto-cycle boundary is 180_000, well past this advance).
        await MockTime.advance(JUST_PAST_THRESHOLD_MS);
        await MockTime.yield3();

        watchdog.registerNode(PEER_1); // re-registration resets lastAliveAt to now
        await watchdog.checkNow();

        expect(calls).to.deep.equal({ forceUnavailable: 0, notifyUnavailable: 0, triggerReconnect: 0 });
    });

    it("undefined interval uses the 15-minute fallback", async () => {
        const { context, calls } = fakeContext({ subscriptionIntervalSeconds: () => undefined });
        watchdog = new SubscriptionWatchdog(context);
        watchdog.registerNode(PEER_1);

        await MockTime.advance(10 * 60_000);
        await MockTime.yield3();
        await watchdog.checkNow();
        expect(calls.forceUnavailable).to.equal(0);

        // Push total silence past the 15 min fallback threshold, still short of the next 30s
        // auto-cycle boundary (930_000), so checkNow() is what catches it.
        await MockTime.advance(FALLBACK_THRESHOLD_MS - 10 * 60_000 + 10_000);
        await MockTime.yield3();
        await watchdog.checkNow();

        expect(calls.forceUnavailable).to.equal(1);
    });

    it("skips nodes that are not Connected", async () => {
        const { context, calls } = fakeContext({ nodeConnected: () => false });
        watchdog = new SubscriptionWatchdog(context);
        watchdog.registerNode(PEER_1);

        await MockTime.advance(JUST_PAST_THRESHOLD_MS);
        await MockTime.yield3();
        await watchdog.checkNow();

        expect(calls).to.deep.equal({ forceUnavailable: 0, notifyUnavailable: 0, triggerReconnect: 0 });
    });

    it("unregisterNode clears all state", async () => {
        const { context, calls } = fakeContext();
        watchdog = new SubscriptionWatchdog(context);
        watchdog.registerNode(PEER_1);

        await MockTime.advance(JUST_PAST_THRESHOLD_MS);
        await MockTime.yield3();

        watchdog.unregisterNode(PEER_1);
        await watchdog.checkNow();

        expect(calls).to.deep.equal({ forceUnavailable: 0, notifyUnavailable: 0, triggerReconnect: 0 });
        expect(watchdog.consumePendingRepair(PEER_1)).to.equal(false);
    });

    it("a throwing notifyUnavailable still triggers reconnect and checkNow resolves", async () => {
        const { context, calls } = fakeContext({
            notifyUnavailable: () => {
                throw new Error("ws dead");
            },
        });
        watchdog = new SubscriptionWatchdog(context);
        watchdog.registerNode(PEER_1);

        await MockTime.advance(JUST_PAST_THRESHOLD_MS);
        await MockTime.yield3();

        await watchdog.checkNow(); // must not reject

        expect(calls.forceUnavailable).to.equal(1);
        expect(calls.triggerReconnect).to.equal(1);
    });
});
