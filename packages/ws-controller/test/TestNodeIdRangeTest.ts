/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { TEST_NODE_END, TEST_NODE_START } from "@matter-server/ws-client";
import { NodeId, UINT32_MAX } from "@matter/main";
import { TestNodeCommandHandler } from "../src/controller/TestNodeCommandHandler.js";

describe("test node range", () => {
    // ws-client cannot depend on matter.js, so it states the range as literals. This is the only
    // place both spellings meet: a drift here would silently move which ids route to the test-node
    // registry.
    it("is exactly matter.js's Temporary Local range", () => {
        expect(TEST_NODE_START).to.equal(NodeId.fromTemporaryLocalNodeId(0));
        expect(TEST_NODE_END).to.equal(NodeId.fromTemporaryLocalNodeId(UINT32_MAX));
    });

    it("routes a Group Node ID away from the test node handler", () => {
        expect(TestNodeCommandHandler.isTestNodeId(NodeId.fromGroupId(1))).to.equal(false);
        expect(TestNodeCommandHandler.isTestNodeId(NodeId.fromTemporaryLocalNodeId(UINT32_MAX))).to.equal(true);
    });
});
