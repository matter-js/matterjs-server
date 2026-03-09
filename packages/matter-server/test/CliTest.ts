/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseCliArgs } from "../src/cli.js";

describe("CLI parseCliArgs", () => {
    it("parses defaults without arguments", () => {
        const opts = parseCliArgs(["node", "test"]);
        expect(opts.enableTestNetDcl).to.be.false;
    });

    it("parses --enable-test-net-dcl flag", () => {
        const opts = parseCliArgs(["node", "test", "--enable-test-net-dcl"]);
        expect(opts.enableTestNetDcl).to.be.true;
    });

    it("reads ENABLE_TEST_NET_DCL env var", () => {
        const original = process.env.ENABLE_TEST_NET_DCL;
        try {
            process.env.ENABLE_TEST_NET_DCL = "true";
            const opts = parseCliArgs(["node", "test"]);
            expect(opts.enableTestNetDcl).to.be.true;
        } finally {
            if (original === undefined) {
                delete process.env.ENABLE_TEST_NET_DCL;
            } else {
                process.env.ENABLE_TEST_NET_DCL = original;
            }
        }
    });
});
