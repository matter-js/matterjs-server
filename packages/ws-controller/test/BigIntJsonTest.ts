/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseBigIntAwareJson, toBigIntAwareJson } from "../src/server/Converters.js";

describe("bigint-aware JSON as exported by ws-controller", () => {
    it("writes a large negative bigint without losing precision", () => {
        expect(toBigIntAwareJson({ v: -0x20_0000_0000_0001n, s: [0xffff_ffff_ffff_ffffn] })).to.equal(
            '{"v":-9007199254740993,"s":[18446744073709551615]}',
        );
    });

    it("reads a client command whose text value starts like a bigint marker", () => {
        expect(
            parseBigIntAwareJson(
                '{"command":"set_node_label","args":{"node_id":18446744073709551615,"label":"__BIGINT__x"}}',
            ),
        ).to.deep.equal({ command: "set_node_label", args: { node_id: 18446744073709551615n, label: "__BIGINT__x" } });
    });
});
