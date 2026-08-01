/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { requireAttributeWriteSuccess, requireWriteSuccess } from "../src/util/matter-status.js";

describe("write status checks", () => {
    it("requireWriteSuccess accepts a batch where every write succeeded", () => {
        requireWriteSuccess([{ status: 0 }, { status: 0 }], "Writing failed");
    });

    it("requireWriteSuccess names the status of a single rejected write without batch phrasing", () => {
        expect(() => requireWriteSuccess([{ status: 135 }], "Writing the access control list failed")).to.throw(
            "Writing the access control list failed: ConstraintError (135)",
        );
    });

    it("requireWriteSuccess summarizes a genuine multi-result batch", () => {
        expect(() => requireWriteSuccess([{ status: 0 }, { status: 126 }], "Writing failed")).to.throw(
            /1 failed.*UnsupportedAccess \(126\)/,
        );
    });

    it("requireWriteSuccess rejects a missing or empty result", () => {
        expect(() => requireWriteSuccess(null, "Writing failed")).to.throw(/No response/);
        expect(() => requireWriteSuccess([], "Writing failed")).to.throw(/No response/);
    });

    it("requireAttributeWriteSuccess reads the Python-cased Status key", () => {
        requireAttributeWriteSuccess([{ Status: 0 }], "Write failed");
        expect(() => requireAttributeWriteSuccess([{ Status: 137 }], "Write failed")).to.throw(
            "Write failed: ResourceExhausted (137)",
        );
    });
});
