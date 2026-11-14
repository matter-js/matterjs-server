/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { labelLengthError } from "../src/util/label-length.js";

describe("labelLengthError", () => {
    it("accepts a label of exactly the maximum bytes", () => {
        expect(labelLengthError("ä".repeat(16), 32)).to.equal(undefined);
    });

    it("refuses a label over the maximum bytes that is within the character count", () => {
        expect(labelLengthError("ä".repeat(16) + "x", 32)).to.contain("33 bytes long, the maximum is 32");
    });
});
