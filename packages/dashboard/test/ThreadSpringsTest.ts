/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    applyThreadSprings,
    DEFAULT_NODE_MASS,
    LEAF_EDGE_LENGTH_PENALTY,
    lqiToEdgeLength,
    meshLinkCountToMass,
    type ThreadSpringEdge,
    type ThreadSpringPair,
} from "../src/pages/network/thread-springs.js";

function pair(nodeA: string, nodeB: string, avgLqi: number | undefined, edgeCount = 1): ThreadSpringPair {
    return { nodeA, nodeB, avgLqi, edges: Array.from({ length: edgeCount }, (): ThreadSpringEdge => ({})) };
}

function lengthOf(pairs: ThreadSpringPair[], nodeA: string, nodeB: string): number | undefined {
    return pairs.find(p => p.nodeA === nodeA && p.nodeB === nodeB)?.edges[0].length;
}

describe("meshLinkCountToMass", () => {
    it("keeps mass 1 for a sparse mesh and grows with each further mesh link", () => {
        expect(meshLinkCountToMass(0)).to.equal(1);
        expect(meshLinkCountToMass(4)).to.equal(1);
        expect(meshLinkCountToMass(6)).to.equal(2);
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

    it("sets mass from live mesh links only, not from leaf links or dead pairs, on either side of the pair", () => {
        const routers = ["r1", "r2", "r3", "r4", "r5", "r6"];
        const masses = applyThreadSprings([
            ...routers.map(r => pair("hubA", r, 3)),
            ...routers.map(r => pair(r, "hubB", 3)),
            ...routers.map((r, i) => pair(r, routers[(i + 1) % routers.length], 3)),
            pair("hubA", "leaf1", 3),
            pair("leaf2", "hubB", 3),
            pair("hubA", "deadOnly", undefined),
            pair("deadOnly", "hubB", undefined),
        ]);

        expect(masses.get("hubA")).to.equal(meshLinkCountToMass(6));
        expect(masses.get("hubB")).to.equal(meshLinkCountToMass(6));
        expect(masses.get("leaf1")).to.equal(DEFAULT_NODE_MASS);
        expect(masses.has("deadOnly")).to.equal(false);
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
