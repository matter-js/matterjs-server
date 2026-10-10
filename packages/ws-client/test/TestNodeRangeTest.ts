/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { isTestNodeId, TEST_NODE_END, TEST_NODE_START } from "../src/index.js";

/** The first Group Node ID, `0xFFFF_FFFF_FFFF_0000` (Matter Core § 2.5.5, Table 4). */
const FIRST_GROUP_NODE_ID = 0xffff_ffff_ffff_0000n;

describe("isTestNodeId", () => {
    it("spans the whole Temporary Local range", () => {
        expect(TEST_NODE_END - TEST_NODE_START + 1n).to.equal(1n << 32n);
        expect(isTestNodeId(TEST_NODE_START)).to.equal(true);
        expect(isTestNodeId(TEST_NODE_END)).to.equal(true);
    });

    it("stops below the Temporary Local range", () => {
        expect(isTestNodeId(TEST_NODE_START - 1n)).to.equal(false);
    });

    it("stops above the Temporary Local range", () => {
        expect(isTestNodeId(TEST_NODE_END + 1n)).to.equal(false);
    });

    it("does not claim a Group Node ID", () => {
        expect(isTestNodeId(FIRST_GROUP_NODE_ID)).to.equal(false);
        expect(isTestNodeId(0xffff_ffff_ffff_ffffn)).to.equal(false);
    });

    // The range starts above Number.MAX_SAFE_INTEGER, so a node id stated as a number is never one.
    it("claims no node id stated as a number", () => {
        expect(TEST_NODE_START > BigInt(Number.MAX_SAFE_INTEGER)).to.equal(true);
        expect(isTestNodeId(1)).to.equal(false);
        expect(isTestNodeId(Number.MAX_SAFE_INTEGER)).to.equal(false);
    });
});
