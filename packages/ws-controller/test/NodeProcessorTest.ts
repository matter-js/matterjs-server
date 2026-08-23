/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { FabricIndex, Minutes, NodeId } from "@matter/main";
import { PeerAddress, PeerAddressMap } from "@matter/main/protocol";
import { NodeProcessor } from "../src/controller/NodeProcessor.js";

const CYCLE_DELAY = Minutes(1);
const PAST_CYCLE_DELAY_MS = 61_000;
// The base class spaces serial nodes two seconds apart.
const PAST_NODE_DELAY_MS = 2_100;

const PEER_1 = PeerAddress({ fabricIndex: FabricIndex(1), nodeId: NodeId(1) });
const PEER_2 = PeerAddress({ fabricIndex: FabricIndex(1), nodeId: NodeId(2) });
const LIT_PEER_1 = PeerAddress({ fabricIndex: FabricIndex(1), nodeId: NodeId(11) });
const LIT_PEER_2 = PeerAddress({ fabricIndex: FabricIndex(1), nodeId: NodeId(12) });

class TestProcessor extends NodeProcessor {
    readonly started = new Array<NodeId>();
    /** While set, processNode blocks on LIT peers until they are released. */
    gate = false;
    connected = true;
    #releases = new PeerAddressMap<() => void>();

    constructor() {
        super("test-processor", CYCLE_DELAY, CYCLE_DELAY);
    }

    register(peer: PeerAddress, longIdleTime = false): void {
        this.registerPeer(peer, longIdleTime);
        this.scheduleIfNeeded();
    }

    unregister(peer: PeerAddress): void {
        this.unregisterPeer(peer);
    }

    get inFlight(): number {
        return this.#releases.size;
    }

    release(peer: PeerAddress): void {
        const release = this.#releases.get(peer);
        this.#releases.delete(peer);
        release?.();
    }

    releaseAll(): void {
        for (const peer of Array.from(this.#releases.keys())) {
            this.release(peer);
        }
    }

    protected override shouldProcess(): boolean {
        return this.connected;
    }

    protected override async processNode(peer: PeerAddress): Promise<void> {
        this.started.push(peer.nodeId);
        if (!this.gate || !this.isLongIdleTime(peer)) return;
        await new Promise<void>(resolve => this.#releases.set(peer, resolve));
    }
}

describe("NodeProcessor", () => {
    let processor: TestProcessor;

    beforeEach(() => {
        MockTime.reset();
        processor = new TestProcessor();
    });

    afterEach(async () => {
        processor.releaseAll();
        await processor.stop();
    });

    it("processes registered peers serially, spaced apart", async () => {
        processor.register(PEER_1);
        processor.register(PEER_2);

        await MockTime.advance(PAST_CYCLE_DELAY_MS);
        await MockTime.yield3();
        expect(processor.started).to.deep.equal([PEER_1.nodeId]);

        await MockTime.advance(PAST_NODE_DELAY_MS);
        await MockTime.yield3();
        expect(processor.started).to.deep.equal([PEER_1.nodeId, PEER_2.nodeId]);
    });

    it("processes long idle time peers after the serial loop", async () => {
        processor.register(LIT_PEER_1, true);
        processor.register(PEER_1);

        await MockTime.advance(PAST_CYCLE_DELAY_MS);
        await MockTime.yield3();
        expect(processor.started, "the LIT peer must not delay the serial peer").to.deep.equal([
            PEER_1.nodeId,
            LIT_PEER_1.nodeId,
        ]);
    });

    it("processes long idle time peers concurrently", async () => {
        processor.gate = true;
        processor.register(LIT_PEER_1, true);
        processor.register(LIT_PEER_2, true);

        await MockTime.advance(PAST_CYCLE_DELAY_MS);
        await MockTime.yield3();
        expect(processor.started).to.deep.equal([LIT_PEER_1.nodeId, LIT_PEER_2.nodeId]);
        expect(processor.inFlight, "both must be in flight at once, not spaced apart").to.equal(2);
    });

    it("keeps the cycle running while a long idle time batch is still in flight", async () => {
        processor.gate = true;
        processor.register(LIT_PEER_1, true);
        processor.register(PEER_1);

        await MockTime.advance(PAST_CYCLE_DELAY_MS);
        await MockTime.yield3();
        expect(processor.started).to.deep.equal([PEER_1.nodeId, LIT_PEER_1.nodeId]);

        // The serial peer must be picked up again even though the LIT batch never finished.
        await MockTime.advance(PAST_CYCLE_DELAY_MS);
        await MockTime.yield3();
        expect(processor.started).to.deep.equal([PEER_1.nodeId, LIT_PEER_1.nodeId, PEER_1.nodeId]);
    });

    it("does not stack a second long idle time batch on an unfinished one", async () => {
        processor.gate = true;
        processor.register(LIT_PEER_1, true);

        await MockTime.advance(PAST_CYCLE_DELAY_MS);
        await MockTime.yield3();
        expect(processor.started.length).to.equal(1);

        for (let i = 0; i < 3; i++) {
            await MockTime.advance(PAST_CYCLE_DELAY_MS);
            await MockTime.yield3();
        }
        expect(processor.started.length, "the pending batch must absorb the skipped cycles").to.equal(1);

        processor.release(LIT_PEER_1);
        await MockTime.yield3();
        await MockTime.advance(PAST_CYCLE_DELAY_MS);
        await MockTime.yield3();
        expect(processor.started.length, "a new batch must start once the previous one cleared").to.equal(2);
    });

    it("does not await a long idle time batch on stop()", async () => {
        processor.gate = true;
        processor.register(LIT_PEER_1, true);

        await MockTime.advance(PAST_CYCLE_DELAY_MS);
        await MockTime.yield3();
        expect(processor.inFlight, "a batch must be in flight for this to prove anything").to.equal(1);

        await processor.stop();
        expect(processor.inFlight, "stop() must return with the batch still running").to.equal(1);
    });

    it("moves a peer back into the serial loop when it re-registers as non-LIT", async () => {
        processor.register(PEER_1, true);
        processor.register(PEER_1, false);
        processor.register(PEER_2);

        // A batched PEER_1 would run after the cycle, i.e. ahead of PEER_2's inter-node delay.
        await MockTime.advance(PAST_CYCLE_DELAY_MS);
        await MockTime.yield3();
        expect(processor.started).to.deep.equal([PEER_1.nodeId]);

        await MockTime.advance(PAST_NODE_DELAY_MS);
        await MockTime.yield3();
        expect(processor.started).to.deep.equal([PEER_1.nodeId, PEER_2.nodeId]);
    });

    it("skips a serial peer that unregistered during the inter-node delay", async () => {
        processor.register(PEER_1);
        processor.register(PEER_2);

        await MockTime.advance(PAST_CYCLE_DELAY_MS);
        await MockTime.yield3();
        expect(processor.started).to.deep.equal([PEER_1.nodeId]);

        processor.unregister(PEER_2);
        await MockTime.advance(PAST_NODE_DELAY_MS);
        await MockTime.yield3();
        expect(processor.started, "eligibility must be re-checked after the delay").to.deep.equal([PEER_1.nodeId]);
    });

    it("skips a serial peer that went offline during the inter-node delay", async () => {
        processor.register(PEER_1);
        processor.register(PEER_2);

        await MockTime.advance(PAST_CYCLE_DELAY_MS);
        await MockTime.yield3();
        processor.connected = false;
        await MockTime.advance(PAST_NODE_DELAY_MS);
        await MockTime.yield3();
        expect(processor.started).to.deep.equal([PEER_1.nodeId]);
    });

    it("skips a long idle time peer that unregistered while the cycle was running", async () => {
        processor.register(LIT_PEER_1, true);
        processor.register(PEER_1);
        processor.register(PEER_2);

        await MockTime.advance(PAST_CYCLE_DELAY_MS);
        await MockTime.yield3();
        expect(processor.started).to.deep.equal([PEER_1.nodeId]);

        // Still inside the inter-node delay, so the batch has not been launched yet.
        processor.unregister(LIT_PEER_1);
        await MockTime.advance(PAST_NODE_DELAY_MS);
        await MockTime.yield3();
        expect(processor.started).to.deep.equal([PEER_1.nodeId, PEER_2.nodeId]);
    });
});
