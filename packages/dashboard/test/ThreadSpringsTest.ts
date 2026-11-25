/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    applyThreadSprings,
    LEAF_EDGE_LENGTH_PENALTY,
    lqiToEdgeLength,
    springCountToMass,
    type ThreadSpringEdge,
    type ThreadSpringPair,
} from "../src/pages/network/thread-springs.js";

function pair(nodeA: string, nodeB: string, avgLqi: number | undefined, edgeCount = 1): ThreadSpringPair {
    return { nodeA, nodeB, avgLqi, edges: Array.from({ length: edgeCount }, (): ThreadSpringEdge => ({})) };
}

function lengthOf(pairs: ThreadSpringPair[], nodeA: string, nodeB: string): number | undefined {
    return pairs.find(p => p.nodeA === nodeA && p.nodeB === nodeB)?.edges[0].length;
}

describe("springCountToMass", () => {
    it("keeps mass 1 without springs and grows with the spring count", () => {
        expect(springCountToMass(0)).to.equal(1);
        expect(springCountToMass(4)).to.equal(3);
    });
});

describe("applyThreadSprings", () => {
    it("gives a live pair exactly one spring and the same length on both edges", () => {
        const live = pair("a", "b", 3, 2);
        applyThreadSprings([live]);

        expect(live.edges.map(e => e.physics)).to.deep.equal([true, false]);
        expect(live.edges[0].length).to.equal(live.edges[1].length);
    });

    it("gives a dead pair no spring and no mass", () => {
        const dead = pair("a", "b", undefined, 2);
        const masses = applyThreadSprings([dead]);

        expect(dead.edges.map(e => e.physics)).to.deep.equal([false, false]);
        expect(masses.size).to.equal(0);
    });

    it("sets mass from the live pairs of a node", () => {
        const masses = applyThreadSprings([
            pair("hub", "r1", 3),
            pair("hub", "r2", 2),
            pair("hub", "r3", 1),
            pair("hub", "gone", undefined),
        ]);

        expect(masses.get("hub")).to.equal(springCountToMass(3));
        expect(masses.has("gone")).to.equal(false);
    });

    it("adds the leaf penalty on the edge of a node with one spring, on either side of the pair", () => {
        const pairs = [
            pair("leafA", "r1", 3),
            pair("r2", "leafB", 3),
            pair("r1", "r2", 2),
            pair("r1", "r3", 3),
            pair("r2", "r3", 3),
        ];
        applyThreadSprings(pairs);

        expect(lengthOf(pairs, "leafA", "r1")).to.equal(lqiToEdgeLength(3) + LEAF_EDGE_LENGTH_PENALTY);
        expect(lengthOf(pairs, "r2", "leafB")).to.equal(lqiToEdgeLength(3) + LEAF_EDGE_LENGTH_PENALTY);
        expect(lengthOf(pairs, "r1", "r2")).to.equal(lqiToEdgeLength(2));
    });

    it("does not count a dead pair when deciding whether a node is a leaf", () => {
        const pairs = [pair("sed", "r1", 3), pair("sed", "r2", undefined), pair("r1", "r2", 3), pair("r1", "r3", 3)];
        applyThreadSprings(pairs);

        expect(lengthOf(pairs, "sed", "r1")).to.equal(lqiToEdgeLength(3) + LEAF_EDGE_LENGTH_PENALTY);
    });
});
