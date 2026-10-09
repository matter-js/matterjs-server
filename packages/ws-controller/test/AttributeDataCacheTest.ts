/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClientNode, NodeId } from "@matter/main";
import { AttributeDataCache } from "../src/controller/AttributeDataCache.js";

type NodeShape = {
    commissioned?: boolean;
    ready?: boolean;
    seeded?: boolean;
    endpointNumbers?: number[];
};

/** A peer as the model presents it: endpoints with one readable OnOff cluster each. */
function clientNode(nodeId: NodeId, shape: NodeShape = {}): ClientNode {
    const { commissioned = true, ready = true, seeded = false, endpointNumbers = [0, 1] } = shape;
    const onOff = { cluster: { id: 6, schema: { attributes: [{ id: 0, propertyName: "onOff" }] } } };
    const endpoints = endpointNumbers.map(number => ({
        number,
        behaviors: { active: [onOff] },
        stateOf: () => ({ onOff: true }),
    }));
    return {
        id: `peer-${nodeId}`,
        peerAddress: { fabricIndex: 1, nodeId },
        lifecycle: { isCommissioned: commissioned, isReady: ready, isSeeded: seeded },
        endpoints: Object.assign(endpoints, { size: endpoints.length }),
    } as unknown as ClientNode;
}

const NODE_ID = NodeId(1);

describe("AttributeDataCache", () => {
    describe("hasStructure", () => {
        it("accepts a peer whose structure is loaded but which has not been read this runtime", () => {
            // The shape of a peer restored from storage: endpoints present, never seeded.
            expect(AttributeDataCache.hasStructure(clientNode(NODE_ID, { seeded: false }))).to.equal(true);
        });

        it("rejects a peer that carries nothing but its root endpoint", () => {
            expect(AttributeDataCache.hasStructure(clientNode(NODE_ID, { endpointNumbers: [0] }))).to.equal(false);
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

            await cache.add(clientNode(NODE_ID, { endpointNumbers: [0] }));

            expect(cache.has(NODE_ID)).to.equal(false);
        });
    });
});
