/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ThreadDiagnosticsBatch } from "../src/controller/ThreadDiagnosticsService.js";
import { serializeBatch } from "../src/server/serializeBatch.js";

function batch(overrides: Partial<ThreadDiagnosticsBatch> = {}): ThreadDiagnosticsBatch {
    return {
        extPanIdHex: "1122334455667788",
        networkName: "TestNet",
        collectedAt: 1_000,
        source: "meshcop",
        nodes: [],
        ...overrides,
    };
}

describe("serializeBatch", () => {
    it("uppercases the extPanId for the wire", () => {
        expect(serializeBatch(batch()).extPanIdHex).to.equal("1122334455667788".toUpperCase());
    });

    it("carries the remaining lifetime when one is given", () => {
        expect(serializeBatch(batch(), 42_000).expiresInMs).to.equal(42_000);
    });

    it("omits the lifetime for a batch that never expires", () => {
        const wire = serializeBatch(batch({ partialReason: "border_router_unreachable" }), undefined);
        expect("expiresInMs" in wire).to.equal(false);
        expect(wire.partialReason).to.equal("border_router_unreachable");
    });
});
