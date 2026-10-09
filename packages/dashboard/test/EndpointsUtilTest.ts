/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterNode, type MatterNodeData } from "@matter-server/ws-client";
import { getEndpointTree } from "../src/util/endpoints.js";

function node(attributes: Record<string, unknown>, node_id: number | bigint = 1): MatterNode {
    const data: MatterNodeData = {
        node_id,
        date_commissioned: "",
        last_interview: "",
        interview_version: 1,
        available: true,
        is_bridge: false,
        attributes,
        attribute_subscriptions: [],
    };
    return new MatterNode(data);
}

describe("endpoints util", () => {
    describe("getEndpointTree", () => {
        it("orders a flat node (no PartsList) as a single root level", () => {
            const n = node({});
            expect(getEndpointTree(n, [0, 1, 2])).to.deep.equal([
                { endpointId: 0, depth: 0 },
                { endpointId: 1, depth: 0 },
                { endpointId: 2, depth: 0 },
            ]);
        });

        it("nests direct children under their parent, keeping numeric order among siblings", () => {
            // Root (0) lists everything, bridge (1) lists only its two panels.
            const n = node({
                "0/29/3": [1, 2, 3],
                "1/29/3": [2, 3],
                "2/29/3": [],
                "3/29/3": [],
            });
            expect(getEndpointTree(n, [0, 1, 2, 3])).to.deep.equal([
                { endpointId: 0, depth: 0 },
                { endpointId: 1, depth: 1 },
                { endpointId: 2, depth: 2 },
                { endpointId: 3, depth: 2 },
            ]);
        });

        it("resolves multi-level nesting via transitive reduction of indirect ancestors", () => {
            // 1 (Aggregator) -> 3 (Thermostat) -> {4 (TemperatureSensor), 5 (HumiditySensor)}
            const n = node({
                "1/29/3": [3, 4, 5],
                "3/29/3": [4, 5],
                "4/29/3": [],
                "5/29/3": [],
            });
            expect(getEndpointTree(n, [1, 3, 4, 5])).to.deep.equal([
                { endpointId: 1, depth: 0 },
                { endpointId: 3, depth: 1 },
                { endpointId: 4, depth: 2 },
                { endpointId: 5, depth: 2 },
            ]);
        });

        it("ignores PartsList entries that reference endpoints outside the given set", () => {
            const n = node({ "0/29/3": [1, 99] });
            expect(getEndpointTree(n, [0, 1])).to.deep.equal([
                { endpointId: 0, depth: 0 },
                { endpointId: 1, depth: 1 },
            ]);
        });

        it("ignores a self-referencing PartsList entry instead of recursing forever", () => {
            const n = node({ "0/29/3": [0, 1] });
            expect(getEndpointTree(n, [0, 1])).to.deep.equal([
                { endpointId: 0, depth: 0 },
                { endpointId: 1, depth: 1 },
            ]);
        });

        it("nests a Tree-pattern chain where each parent lists only its direct child", () => {
            // Tree pattern (not Full-Family): every PartsList holds only the immediate child.
            const n = node({
                "0/29/3": [1],
                "1/29/3": [2],
                "2/29/3": [3],
                "3/29/3": [],
            });
            expect(getEndpointTree(n, [0, 1, 2, 3])).to.deep.equal([
                { endpointId: 0, depth: 0 },
                { endpointId: 1, depth: 1 },
                { endpointId: 2, depth: 2 },
                { endpointId: 3, depth: 3 },
            ]);
        });

        it("surfaces endpoints as roots when their only listed parent is outside the given set", () => {
            // Endpoint 2 (excluded) is the aggregator listing 4 and 5; with 2 out of the set,
            // nothing inside the set claims 4/5, so both are roots.
            const n = node({ "2/29/3": [4, 5] });
            expect(getEndpointTree(n, [4, 5])).to.deep.equal([
                { endpointId: 4, depth: 0 },
                { endpointId: 5, depth: 0 },
            ]);
        });

        it("keeps every endpoint once for a (spec-violating) diamond, closest parent winning", () => {
            // 0 -> {1, 2}; both 1 and 2 list 3. 3 is demoted under its closest parent (1),
            // reached first in sibling order; the second path (via 2) is skipped as already visited.
            const n = node({
                "0/29/3": [1, 2, 3],
                "1/29/3": [3],
                "2/29/3": [3],
                "3/29/3": [],
            });
            expect(getEndpointTree(n, [0, 1, 2, 3])).to.deep.equal([
                { endpointId: 0, depth: 0 },
                { endpointId: 1, depth: 1 },
                { endpointId: 3, depth: 2 },
                { endpointId: 2, depth: 1 },
            ]);
        });

        it("keeps a PartsList cycle a tree, listing every endpoint once", () => {
            // 1 and 2 list each other as children. The first relation is accepted, the one that
            // would close the cycle is not, so 2 stays a root and every endpoint appears once.
            const n = node({ "1/29/3": [2], "2/29/3": [1] });
            expect(getEndpointTree(n, [1, 2])).to.deep.equal([
                { endpointId: 2, depth: 0 },
                { endpointId: 1, depth: 1 },
            ]);
        });

        it("nests a bridge that lists the whole family below its aggregators", () => {
            // The shape of packages/matter-server/test/fixtures/TestBridgeDevice.ts: endpoint 2
            // lists every descendant, endpoint 4 its two parts, endpoint 7 its bridged children.
            const n = node({
                "0/29/3": [1, 2, 3, 4, 5, 6, 7, 8],
                "1/29/3": [],
                "2/29/3": [3, 4, 5, 6, 7, 8],
                "3/29/3": [],
                "4/29/3": [5, 6],
                "5/29/3": [],
                "6/29/3": [],
                "7/29/3": [8],
                "8/29/3": [],
            });
            expect(getEndpointTree(n, [0, 1, 2, 3, 4, 5, 6, 7, 8])).to.deep.equal([
                { endpointId: 0, depth: 0 },
                { endpointId: 1, depth: 1 },
                { endpointId: 2, depth: 1 },
                { endpointId: 3, depth: 2 },
                { endpointId: 4, depth: 2 },
                { endpointId: 5, depth: 3 },
                { endpointId: 6, depth: 3 },
                { endpointId: 7, depth: 2 },
                { endpointId: 8, depth: 3 },
            ]);
        });

        it("keeps a part with its own device when an ancestor lists only some of the family", () => {
            // Endpoint 1 lists 30 and 31 but not 32, so only the relation between the candidates
            // decides: 30 lists 31, 1 does not list 30's other parts.
            const n = node({
                "0/29/3": [1, 30, 31, 32],
                "1/29/3": [30, 31],
                "30/29/3": [31, 32],
                "31/29/3": [],
                "32/29/3": [],
            });
            expect(getEndpointTree(n, [0, 1, 30, 31, 32])).to.deep.equal([
                { endpointId: 0, depth: 0 },
                { endpointId: 1, depth: 1 },
                { endpointId: 30, depth: 2 },
                { endpointId: 31, depth: 3 },
                { endpointId: 32, depth: 3 },
            ]);
        });
    });
});
