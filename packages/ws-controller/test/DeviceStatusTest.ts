/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Status, StatusResponseError, ValidationError, ValidationOutOfBoundsError } from "@matter/main/types";
import { deviceStatusOf } from "../src/camera/deviceStatus.js";

describe("deviceStatusOf", () => {
    it("returns the status a device sent", () => {
        expect(deviceStatusOf(new StatusResponseError("busy", Status.Busy))).to.equal(Status.Busy);
    });

    it("finds a device status in the cause chain", () => {
        expect(deviceStatusOf(new Error("wrapped", { cause: StatusResponseError.create(Status.NotFound) }))).to.equal(
            Status.NotFound,
        );
    });

    it("returns the code of a non-matter.js error that carries one", () => {
        expect(deviceStatusOf(Object.assign(new Error("other"), { code: 135 }))).to.equal(135);
    });

    it("does not report a local ValidationError as a device status", () => {
        expect(deviceStatusOf(new ValidationOutOfBoundsError("too big", "field"))).to.equal(undefined);
        expect(deviceStatusOf(new ValidationError("missing", "field", Status.InvalidAction))).to.equal(undefined);
    });

    it("does not report a ValidationError wrapped in another error as a device status", () => {
        expect(deviceStatusOf(new Error("wrapped", { cause: new ValidationOutOfBoundsError("too big") }))).to.equal(
            undefined,
        );
    });
});
