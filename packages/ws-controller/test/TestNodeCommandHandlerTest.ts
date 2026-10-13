/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeId } from "@matter/main";
import { TestNodeCommandHandler } from "../src/controller/TestNodeCommandHandler.js";

function dump(endpointParents: unknown): string {
    return JSON.stringify({
        data: {
            node: {
                node_id: 5,
                date_commissioned: "2026-01-01T00:00:00",
                last_interview: "2026-01-01T00:00:00",
                interview_version: 6,
                available: true,
                is_bridge: false,
                attributes: { "0/29/3": [1], "1/29/3": [] },
                attribute_subscriptions: [],
                endpoint_parents: endpointParents,
            },
        },
    });
}

async function importOne(endpointParents: unknown) {
    const handler = new TestNodeCommandHandler();
    const [nodeId] = handler.importTestNodes(dump(endpointParents));
    return handler.getNodeDetails(NodeId(nodeId));
}

describe("TestNodeCommandHandler", () => {
    describe("importTestNodes", () => {
        it("keeps the endpoint parents of the dump", async function () {
            const node = await importOne({ 1: 0 });

            expect(node.endpoint_parents).to.deep.equal({ 1: 0 });
        });

        it("imports a dump with null endpoint parents as not providing them", async function () {
            const node = await importOne(null);

            expect(node.endpoint_parents).to.equal(undefined);
        });

        it("imports a dump without endpoint parents as not providing them", async function () {
            const node = await importOne(undefined);

            expect(node.endpoint_parents).to.equal(undefined);
        });
    });
});
