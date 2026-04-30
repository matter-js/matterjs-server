/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { DefaultTlvSet } from "../../src/diagnostic/DefaultTlvSet.js";
import { NetworkDiagTlvType } from "../../src/tlv/networkDiagTlvTypes.js";

describe("DefaultTlvSet", () => {
    it("matches the spec §4.9 default request set", () => {
        expect([...DefaultTlvSet]).to.deep.equal([0, 1, 2, 4, 5, 6, 8, 16, 24, 25, 26, 27]);
    });

    it("contains only known TLV types from NetworkDiagTlvType", () => {
        for (const t of DefaultTlvSet) {
            expect(Object.values(NetworkDiagTlvType)).to.include(t);
        }
    });

    it("has no duplicates", () => {
        expect(new Set(DefaultTlvSet).size).to.equal(DefaultTlvSet.length);
    });
});
