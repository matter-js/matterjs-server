/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClientNode, MatterError, NodeId } from "@matter/main";
import { AttributeId, ClusterId, EndpointNumber } from "@matter/main/types";
import { AttributeDataCache } from "../src/controller/AttributeDataCache.js";

type NodeShape = {
    commissioned?: boolean;
    ready?: boolean;
    seeded?: boolean;
    /** Whether BasicInformation has been read. */
    basicInformation?: boolean;
    endpointNumbers?: number[];
    /** Owner endpoint number per endpoint number; an endpoint missing here has no owner. */
    owners?: Record<number, number>;
    /** Endpoints whose state cannot be read. */
    unreadable?: number[];
    /** Called when an endpoint's state is read; `remove` takes an endpoint off the node. */
    onRead?: (number: number, remove: (number: number) => void) => void;
};

/** A peer as the model presents it: endpoints with one readable OnOff cluster each. */
function clientNode(nodeId: NodeId, shape: NodeShape = {}): ClientNode {
    const {
        commissioned = true,
        ready = true,
        seeded = false,
        basicInformation = true,
        endpointNumbers = [0, 1],
        owners = {},
        unreadable = [],
        onRead,
    } = shape;
    const onOff = { cluster: { id: 6, schema: { attributes: [{ id: 0, propertyName: "onOff" }] } } };
    const endpoints = endpointNumbers.map(number => ({
        number,
        owner: owners[number] === undefined ? undefined : { maybeNumber: owners[number] },
        behaviors: { active: [onOff] },
        stateOf: () => {
            onRead?.(number, removed =>
                endpoints.splice(
                    endpoints.findIndex(endpoint => endpoint.number === removed),
                    1,
                ),
            );
            if (unreadable.includes(number)) {
                throw new MatterError(`Endpoint ${number} cannot be read`);
            }
            return { onOff: true };
        },
    }));
    return {
        id: `peer-${nodeId}`,
        peerAddress: { fabricIndex: 1, nodeId },
        lifecycle: { isCommissioned: commissioned, isReady: ready, isSeeded: seeded },
        maybeStateOf: () => (basicInformation ? { vendorId: 0xfff1 } : undefined),
        endpoints: Object.assign(endpoints, {
            size: endpoints.length,
            has: (number: number) => endpoints.some(endpoint => endpoint.number === number),
            for: (number: number) => endpoints.find(endpoint => endpoint.number === number),
        }),
    } as unknown as ClientNode;
}

const NODE_ID = NodeId(1);

/** Blocks the event loop, as heavy synchronous work would. */
function busy(ms: number) {
    const until = performance.now() + ms;
    while (performance.now() < until) {
        // spin
    }
}

describe("AttributeDataCache", () => {
    describe("hasStructure", () => {
        it("accepts a peer whose structure is loaded but which has not been read this runtime", () => {
            // The shape of a peer restored from storage: endpoints present, never seeded.
            expect(AttributeDataCache.hasStructure(clientNode(NODE_ID, { seeded: false }))).to.equal(true);
        });

        it("accepts a device that has only its root endpoint once BasicInformation is read", () => {
            expect(AttributeDataCache.hasStructure(clientNode(NODE_ID, { endpointNumbers: [0] }))).to.equal(true);
        });

        it("rejects a peer whose structure has not been read", () => {
            expect(
                AttributeDataCache.hasStructure(clientNode(NODE_ID, { endpointNumbers: [0], basicInformation: false })),
            ).to.equal(false);
        });

        it("rejects a node that is not commissioned", () => {
            expect(AttributeDataCache.hasStructure(clientNode(NODE_ID, { commissioned: false }))).to.equal(false);
        });

        it("rejects a node that is not ready", () => {
            expect(AttributeDataCache.hasStructure(clientNode(NODE_ID, { ready: false }))).to.equal(false);
        });
    });

    describe("add", () => {
        it("snapshots a restored peer without waiting for it to be read from the device", async () => {
            const cache = new AttributeDataCache();

            await cache.add(clientNode(NODE_ID, { seeded: false }));

            // Answering an unseeded peer with an empty snapshot is what left `start_listening` reporting
            // a node with no attributes after a restart.
            expect(cache.has(NODE_ID)).to.equal(true);
            expect(cache.get(NODE_ID)?.["1/6/0"]).to.equal(true);
        });

        it("caches nothing for a node without a structure", async () => {
            const cache = new AttributeDataCache();

            await cache.add(clientNode(NODE_ID, { endpointNumbers: [0], basicInformation: false }));

            expect(cache.has(NODE_ID)).to.equal(false);
        });

        it("records the owner of each endpoint but the root", async function () {
            const cache = new AttributeDataCache();
            const node = clientNode(NODE_ID, { endpointNumbers: [0, 1, 2, 3], owners: { 0: 0, 1: 0, 2: 1, 3: 2 } });

            await cache.add(node);

            expect(cache.endpointParents(NODE_ID, node)).to.deep.equal({ 1: 0, 2: 1, 3: 2 });
        });

        it("records no parent for an endpoint without an owner", async function () {
            const cache = new AttributeDataCache();
            const node = clientNode(NODE_ID, { endpointNumbers: [0, 1, 2], owners: { 1: 0 } });

            await cache.add(node);

            expect(cache.endpointParents(NODE_ID, node)).to.deep.equal({ 1: 0 });
        });

        it("records no parent for an endpoint without attributes", async function () {
            const cache = new AttributeDataCache();
            const node = clientNode(NODE_ID, { endpointNumbers: [0, 1, 2], owners: { 1: 0, 2: 1 }, unreadable: [2] });

            await cache.add(node);

            expect(cache.endpointParents(NODE_ID, node)).to.deep.equal({ 1: 0 });
        });
    });

    describe("populateTiming", () => {
        it("counts a finished populate and its collecting time, but not the waits at its yields", async () => {
            const cache = new AttributeDataCache();
            const before = cache.populateTiming;

            await cache.add(
                clientNode(NODE_ID, {
                    endpointNumbers: [0, 1],
                    onRead: number => {
                        busy(5);
                        if (number === 0) {
                            // Queued ahead of the yield after endpoint 0, so that yield waits for it.
                            setTimeout(() => busy(100), 0);
                        }
                    },
                }),
            );

            const after = cache.populateTiming;
            expect(after.populated - before.populated).equals(1);
            const collecting = after.collecting - before.collecting;
            expect(collecting).at.least(8);
            expect(collecting).below(100);
        });

        it("counts a populate that had to run again once", async () => {
            const cache = new AttributeDataCache();
            const before = cache.populateTiming;
            let rebuild: Promise<void> | undefined;
            let passes = 0;
            const node = clientNode(NODE_ID, {
                endpointNumbers: [0, 1],
                onRead: number => {
                    if (number === 0) {
                        passes++;
                    }
                    // After the first yield, so the update finds the populate in flight and asks it to run again.
                    if (number === 1) {
                        rebuild ??= cache.update(node);
                    }
                },
            });

            await cache.add(node);
            await rebuild;

            expect(passes).equals(2);
            expect(cache.populateTiming.populated - before.populated).equals(1);
        });

        it("does not count a populate whose node was deleted meanwhile", async () => {
            const cache = new AttributeDataCache();
            const before = cache.populateTiming;

            await cache.add(
                clientNode(NODE_ID, {
                    endpointNumbers: [0, 1],
                    onRead: number => {
                        // After the first yield, so the populate is already registered as in flight.
                        if (number === 1) {
                            cache.delete(NODE_ID);
                        }
                    },
                }),
            );

            expect(cache.populateTiming.populated).equals(before.populated);
        });
    });

    describe("attributesRemoved", () => {
        function record(cache: AttributeDataCache) {
            const removals = new Array<string[]>();
            cache.attributesRemoved.on((_nodeId, paths) => {
                removals.push(paths);
            });
            return removals;
        }

        it("reports the paths a rebuild dropped, except those of an endpoint the node no longer has", async () => {
            const cache = new AttributeDataCache();
            const node = clientNode(NODE_ID);
            await cache.add(node);
            const stored = cache.get(NODE_ID)!;
            stored["1/6/99"] = 1;
            stored["9/6/0"] = true;
            const removals = record(cache);

            await cache.update(node);

            expect(removals).to.deep.equal([["1/6/99"]]);
        });

        it("reports nothing for a first snapshot or a rebuild that dropped nothing", async () => {
            const cache = new AttributeDataCache();
            const removals = record(cache);
            const node = clientNode(NODE_ID);

            await cache.add(node);
            await cache.update(node);

            expect(removals).to.deep.equal([]);
        });
    });

    describe("updateAttribute", () => {
        const onOff = (endpointId: number, value: unknown) => ({
            path: { endpointId: EndpointNumber(endpointId), clusterId: ClusterId(6), attributeId: AttributeId(0) },
            value,
        });

        it("removes an attribute reported as undefined", async function () {
            const cache = new AttributeDataCache();
            await cache.add(clientNode(NODE_ID));
            expect(cache.get(NODE_ID)?.["1/6/0"]).to.equal(true);

            expect(cache.updateAttribute(NODE_ID, onOff(1, undefined))).to.equal(true);

            expect(cache.get(NODE_ID)).not.to.have.property("1/6/0");
        });

        it("reports no removal for an attribute the snapshot does not hold", async function () {
            const cache = new AttributeDataCache();
            await cache.add(clientNode(NODE_ID));

            expect(cache.updateAttribute(NODE_ID, onOff(2, undefined))).to.equal(false);
        });

        it("stores a value without reporting a removal", async function () {
            const cache = new AttributeDataCache();
            await cache.add(clientNode(NODE_ID));

            expect(cache.updateAttribute(NODE_ID, onOff(1, false))).to.equal(false);

            expect(cache.get(NODE_ID)?.["1/6/0"]).to.equal(false);
        });

        it("does not create a cache entry without a snapshot", function () {
            const cache = new AttributeDataCache();

            expect(cache.updateAttribute(NODE_ID, onOff(1, false))).to.equal(false);
            expect(cache.updateAttribute(NODE_ID, onOff(1, undefined))).to.equal(false);

            expect(cache.has(NODE_ID)).to.equal(false);
        });

        it("replays a removal that arrives during a populate", async function () {
            const cache = new AttributeDataCache();
            const node = clientNode(NODE_ID, {
                onRead: number => {
                    if (number === 1) {
                        cache.updateAttribute(NODE_ID, onOff(0, undefined));
                    }
                },
            });

            await cache.add(node);

            expect(cache.get(NODE_ID)).not.to.have.property("0/6/0");
            expect(cache.get(NODE_ID)?.["1/6/0"]).to.equal(true);
        });

        it("drops a removal from the current snapshot and from a rebuild that is running", async function () {
            const cache = new AttributeDataCache();
            let removed: boolean | undefined;
            let keptInCurrentSnapshot: boolean | undefined;
            let rebuilding = false;
            const node = clientNode(NODE_ID, {
                onRead: number => {
                    if (rebuilding && number === 1 && removed === undefined) {
                        removed = cache.updateAttribute(NODE_ID, onOff(0, undefined));
                        keptInCurrentSnapshot = "0/6/0" in (cache.get(NODE_ID) ?? {});
                    }
                },
            });
            await cache.add(node);

            rebuilding = true;
            await cache.update(node);

            expect(removed).to.equal(true);
            expect(keptInCurrentSnapshot).to.equal(false);
            expect(cache.get(NODE_ID)).not.to.have.property("0/6/0");
        });
    });

    describe("endpointParents", () => {
        it("is empty for a node without a snapshot", function () {
            const cache = new AttributeDataCache();

            expect(cache.endpointParents(NODE_ID, clientNode(NODE_ID, { owners: { 1: 0 } }))).to.deep.equal({});
        });

        it("reads the parent of an endpoint reported since the last populate from the node", async function () {
            const cache = new AttributeDataCache();
            await cache.add(clientNode(NODE_ID, { endpointNumbers: [0, 1], owners: { 1: 0 } }));
            const grown = clientNode(NODE_ID, { endpointNumbers: [0, 1, 2], owners: { 1: 0, 2: 1 } });

            cache.updateAttribute(NODE_ID, {
                path: { endpointId: EndpointNumber(2), clusterId: ClusterId(6), attributeId: AttributeId(0) },
                value: true,
            });

            expect(cache.get(NODE_ID)?.["2/6/0"]).to.equal(true);
            expect(cache.endpointParents(NODE_ID, grown)).to.deep.equal({ 1: 0, 2: 1 });
        });

        it("keeps the recorded parent of an endpoint the node dropped before its removal is announced", async function () {
            const cache = new AttributeDataCache();
            await cache.add(clientNode(NODE_ID, { endpointNumbers: [0, 1, 2], owners: { 1: 0, 2: 1 } }));
            const shrunk = clientNode(NODE_ID, { endpointNumbers: [0, 1], owners: { 1: 0 } });

            expect(cache.endpointParents(NODE_ID, shrunk)).to.deep.equal({ 1: 0, 2: 1 });
        });
    });

    describe("deleteEndpoint", () => {
        it("drops the parent of the endpoint together with its attributes", async function () {
            const cache = new AttributeDataCache();
            const node = clientNode(NODE_ID, { endpointNumbers: [0, 1, 2], owners: { 1: 0, 2: 1 } });
            await cache.add(node);

            cache.deleteEndpoint(NODE_ID, EndpointNumber(2));

            expect(cache.get(NODE_ID)?.["2/6/0"]).to.equal(undefined);
            expect(cache.endpointParents(NODE_ID, node)).to.deep.equal({ 1: 0 });
        });

        it("keeps a running populate from restoring an endpoint it collected or got a report for before the removal", async function () {
            const cache = new AttributeDataCache();
            let removed = false;
            const node = clientNode(NODE_ID, {
                endpointNumbers: [0, 1, 2, 3],
                owners: { 1: 0, 2: 1, 3: 1 },
                onRead: (number, remove) => {
                    if (number === 3 && !removed) {
                        removed = true;
                        cache.updateAttribute(NODE_ID, {
                            path: {
                                endpointId: EndpointNumber(2),
                                clusterId: ClusterId(6),
                                attributeId: AttributeId(0),
                            },
                            value: false,
                        });
                        remove(2);
                        cache.deleteEndpoint(NODE_ID, EndpointNumber(2));
                    }
                },
            });

            await cache.add(node);

            expect(cache.get(NODE_ID)?.["2/6/0"]).to.equal(undefined);
            expect(cache.endpointParents(NODE_ID, node)).to.deep.equal({ 1: 0, 3: 1 });
        });
    });
});
