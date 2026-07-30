/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { FabricIndex, NodeId } from "@matter/main";
import { PeerAddress } from "@matter/main/protocol";
import { NodeAttributeReader } from "../src/controller/NodeProcessor.js";
import { threadDetailPaths, ThreadDetailsPoller } from "../src/controller/ThreadDetailsPoller.js";
import { AttributesData } from "../src/types/CommandHandler.js";

// Initial delay is twice the three minute time sync startup window.
const PAST_INITIAL_DELAY_MS = 361_000;
// Cycles after the first one are armed with the 24 h poll interval.
const PAST_POLL_INTERVAL_MS = 24 * 60 * 60_000 + 60_000;

const PEER_1 = PeerAddress({ fabricIndex: FabricIndex(1), nodeId: NodeId(1) });
const PEER_2 = PeerAddress({ fabricIndex: FabricIndex(1), nodeId: NodeId(2) });

// NetworkCommissioning FeatureMap (0/49/65532) bit 1 = Thread, bit 0 = WiFi
const THREAD_FEATURE_MAP = 2;
const WIFI_FEATURE_MAP = 1;

function threadAttributes(): AttributesData {
    return {
        "0/49/65532": THREAD_FEATURE_MAP,
        "0/53/7": [],
        "0/53/8": [],
        "0/51/0": [{ name: "thread0" }],
    };
}

class StubReader implements NodeAttributeReader {
    readonly reads = new Array<{ peer: PeerAddress; paths: string[]; fabricFiltered?: boolean }>();
    slowRead = false;
    failRead = false;
    connected = true;
    #resolvers = new Array<(value: AttributesData) => void>();

    nodeConnected(): boolean {
        return this.connected;
    }

    async handleReadAttributes(peer: PeerAddress, paths: string[], fabricFiltered?: boolean): Promise<AttributesData> {
        this.reads.push({ peer, paths, fabricFiltered });
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

describe("ThreadDetailsPoller", () => {
    describe("threadDetailPaths", () => {
        it("selects the topology attributes of a Thread node", () => {
            expect(threadDetailPaths(threadAttributes())).to.deep.equal(["0/53/7", "0/53/8", "0/51/0"]);
        });

        it("omits NetworkInterfaces when the node does not expose it", () => {
            expect(threadDetailPaths({ "0/49/65532": THREAD_FEATURE_MAP, "0/53/7": [], "0/53/8": [] })).to.deep.equal([
                "0/53/7",
                "0/53/8",
            ]);
        });

        it("returns nothing for a node on another network type", () => {
            expect(threadDetailPaths({ "0/49/65532": WIFI_FEATURE_MAP, "0/51/0": [], "0/54/0": null })).to.deep.equal(
                [],
            );
        });

        it("returns nothing for a node whose network type is unknown", () => {
            expect(threadDetailPaths({ "0/53/7": [], "0/53/8": [] })).to.deep.equal([]);
        });
    });

    describe("polling", () => {
        let reader: StubReader;
        let poller: ThreadDetailsPoller;

        beforeEach(() => {
            MockTime.reset();
            reader = new StubReader();
            poller = new ThreadDetailsPoller(reader);
        });

        afterEach(async () => {
            reader.resolveAll();
            await poller.stop();
        });

        it("polls a registered Thread node once the initial delay elapses", async () => {
            poller.registerNode(PEER_1, threadAttributes());
            await MockTime.yield3();
            expect(reader.reads.length).to.equal(0);

            await MockTime.advance(PAST_INITIAL_DELAY_MS);
            await MockTime.yield3();
            expect(reader.reads.length).to.equal(1);
            expect(reader.reads[0].paths).to.deep.equal(["0/53/7", "0/53/8", "0/51/0"]);
            // A mismatched filter makes matter.js discard the read without updating the cache.
            expect(reader.reads[0].fabricFiltered).to.equal(true);
        });

        it("ignores a node that is not on Thread", async () => {
            poller.registerNode(PEER_1, { "0/49/65532": WIFI_FEATURE_MAP });
            await MockTime.advance(PAST_INITIAL_DELAY_MS);
            await MockTime.yield3();
            expect(reader.reads.length).to.equal(0);
        });

        it("keeps polling the remaining nodes after a read fails", async () => {
            reader.failRead = true;
            poller.registerNode(PEER_1, threadAttributes());
            poller.registerNode(PEER_2, threadAttributes());

            await MockTime.advance(PAST_INITIAL_DELAY_MS);
            await MockTime.yield3();
            reader.failRead = false;
            // The base class spaces nodes two seconds apart.
            await MockTime.advance(3_000);
            await MockTime.yield3();
            expect(reader.reads.map(read => read.peer.nodeId)).to.deep.equal([PEER_1.nodeId, PEER_2.nodeId]);
        });

        it("does not return from stop() while a read is still in flight", async () => {
            reader.slowRead = true;
            poller.registerNode(PEER_1, threadAttributes());

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

        it("polls again on the next cycle", async () => {
            poller.registerNode(PEER_1, threadAttributes());
            await MockTime.advance(PAST_INITIAL_DELAY_MS);
            await MockTime.yield3();
            expect(reader.reads.length).to.equal(1);

            await MockTime.advance(PAST_POLL_INTERVAL_MS);
            await MockTime.yield3();
            expect(reader.reads.length, "the cycle must re-arm itself").to.equal(2);
        });

        it("skips a node that is not connected", async () => {
            reader.connected = false;
            poller.registerNode(PEER_1, threadAttributes());

            await MockTime.advance(PAST_INITIAL_DELAY_MS);
            await MockTime.yield3();
            expect(reader.reads.length).to.equal(0);

            reader.connected = true;
            await MockTime.advance(PAST_POLL_INTERVAL_MS);
            await MockTime.yield3();
            expect(reader.reads.length, "a reconnected node must be polled again").to.equal(1);
        });

        it("stops polling a node that unregisters", async () => {
            poller.registerNode(PEER_1, threadAttributes());
            await MockTime.advance(PAST_INITIAL_DELAY_MS);
            await MockTime.yield3();
            const afterFirst = reader.reads.length;
            expect(afterFirst, "the node must have been polled for this to prove anything").to.equal(1);

            poller.unregisterNode(PEER_1);
            for (let i = 0; i < 3; i++) {
                await MockTime.advance(PAST_POLL_INTERVAL_MS);
                await MockTime.yield3();
            }
            expect(reader.reads.length).to.equal(afterFirst);
        });

        it("drops a node that re-registers as a non-Thread node", async () => {
            poller.registerNode(PEER_1, threadAttributes());
            poller.registerNode(PEER_1, { "0/49/65532": WIFI_FEATURE_MAP });

            await MockTime.advance(PAST_INITIAL_DELAY_MS);
            await MockTime.yield3();
            expect(reader.reads.length).to.equal(0);
        });
    });
});
