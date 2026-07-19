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
    });
});
