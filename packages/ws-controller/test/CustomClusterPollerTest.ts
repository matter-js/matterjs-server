/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { FabricIndex, NodeId } from "@matter/main";
import { PeerAddress } from "@matter/main/protocol";
import { CustomClusterPoller, NodeAttributeReader } from "../src/controller/CustomClusterPoller.js";
import { AttributesData } from "../src/types/CommandHandler.js";

const ONE_MINUTE_MS = 60_000;
// The initial delay is 30 s plus up to 30 s of jitter; 61 s clears either.
const PAST_INITIAL_DELAY_MS = 61_000;

const PEER_1 = PeerAddress({ fabricIndex: FabricIndex(1), nodeId: NodeId(1) });

const EVE_VENDOR_ID = 4874;
const EVE_CLUSTER_ID = 0x130afc01;

/** An Eve device with the custom cluster and no standard ElectricalPowerMeasurement. */
function eveAttributes(): AttributesData {
    return {
        "0/40/2": EVE_VENDOR_ID,
        [`1/${EVE_CLUSTER_ID}/${0x130a000a}`]: 0,
    };
}

class StubReader implements NodeAttributeReader {
    readonly reads: PeerAddress[] = [];
    slowRead = false;
    failRead = false;
    #resolvers = new Array<(value: AttributesData) => void>();

    nodeConnected(): boolean {
        return true;
    }

    async handleReadAttributes(peer: PeerAddress): Promise<AttributesData> {
        this.reads.push(peer);
        if (this.failRead) {
            throw new Error("read exploded");
        }
        if (this.slowRead) {
            return new Promise<AttributesData>(resolve => this.#resolvers.push(resolve));
        }
        return {};
    }

    get pending(): number {
        return this.#resolvers.length;
    }

    resolveAll(): void {
        this.#resolvers.splice(0).forEach(resolve => resolve({}));
    }
}

describe("CustomClusterPoller", () => {
    let reader: StubReader;
    let poller: CustomClusterPoller;

    beforeEach(() => {
        MockTime.reset();
        reader = new StubReader();
        poller = new CustomClusterPoller(reader);
    });

    afterEach(async () => {
        reader.resolveAll();
        await poller.stop();
    });

    it("polls a registered Eve node once the initial delay elapses", async () => {
        poller.registerNode(PEER_1, eveAttributes());
        await MockTime.yield3();
        expect(reader.reads.length).to.equal(0);

        await MockTime.advance(PAST_INITIAL_DELAY_MS);
        await MockTime.yield3();
        expect(reader.reads.length).to.equal(1);
    });

    it("ignores a node that is not an Eve device", async () => {
        poller.registerNode(PEER_1, { "0/40/2": 1, "1/6/0": true });
        await MockTime.advance(PAST_INITIAL_DELAY_MS);
        await MockTime.yield3();
        expect(reader.reads.length).to.equal(0);
    });

    it("does not return from stop() while a read is still in flight", async () => {
        reader.slowRead = true;
        poller.registerNode(PEER_1, eveAttributes());

        await MockTime.advance(PAST_INITIAL_DELAY_MS);
        await MockTime.yield3();
        expect(reader.pending, "a read must be in flight for this to prove anything").to.equal(1);

        let stopped = false;
        const stopping = poller.stop().then(() => {
            stopped = true;
        });
        await MockTime.yield3();
        expect(stopped, "stop() must await the in-flight read").to.equal(false);

        reader.resolveAll();
        await stopping;
        expect(stopped).to.equal(true);
    });

    it("keeps polling after a read fails", async () => {
        reader.failRead = true;
        poller.registerNode(PEER_1, eveAttributes());

        await MockTime.advance(PAST_INITIAL_DELAY_MS);
        await MockTime.yield3();
        expect(reader.reads.length).to.equal(1);

        reader.failRead = false;
        for (let i = 0; i < 3; i++) {
            await MockTime.advance(ONE_MINUTE_MS);
            await MockTime.yield3();
        }
        expect(reader.reads.length, "a failed read must not stop the cycle").to.be.greaterThan(1);
    });

    it("stops polling a node that unregisters", async () => {
        poller.registerNode(PEER_1, eveAttributes());
        await MockTime.advance(PAST_INITIAL_DELAY_MS);
        await MockTime.yield3();
        const afterFirst = reader.reads.length;

        poller.unregisterNode(PEER_1);
        for (let i = 0; i < 3; i++) {
            await MockTime.advance(ONE_MINUTE_MS);
            await MockTime.yield3();
        }
        expect(reader.reads.length).to.equal(afterFirst);
    });
});
