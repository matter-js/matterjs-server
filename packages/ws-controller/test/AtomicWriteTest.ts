/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Millis } from "@matter/main";
import { AttributeModel } from "@matter/main/model";
import { writesTimed } from "../src/util/atomicWrite.js";

describe("writesTimed", () => {
    const untimed = new AttributeModel({ id: 1, name: "Untimed", type: "uint8", access: "RW VM" });
    const timed = new AttributeModel({ id: 2, name: "Timed", type: "uint8", access: "RW VM T" });

    it("is false for an attribute without the timed access and no timeout", () => {
        expect(writesTimed(untimed, undefined)).equals(false);
    });

    it("is true when the request states a timeout", () => {
        expect(writesTimed(untimed, Millis(2000))).equals(true);
    });

    it("is true when the attribute requires timed writes", () => {
        expect(writesTimed(timed, undefined)).equals(true);
    });
});
