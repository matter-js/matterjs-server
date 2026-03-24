/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { getErrorMessage } from "../../src/util/errorUtils.js";

describe("getErrorMessage", () => {
    it("returns the string directly for string errors", () => {
        expect(getErrorMessage("something went wrong")).to.equal("something went wrong");
    });

    it("returns empty string for empty string errors", () => {
        expect(getErrorMessage("")).to.equal("");
    });

    it("returns message from Error instances", () => {
        expect(getErrorMessage(new Error("test error"))).to.equal("test error");
    });

    it("returns message from Error subclasses", () => {
        expect(getErrorMessage(new TypeError("type error"))).to.equal("type error");
        expect(getErrorMessage(new RangeError("range error"))).to.equal("range error");
    });

    it("returns message from Error-like objects with string message", () => {
        expect(getErrorMessage({ message: "error-like" })).to.equal("error-like");
    });

    it("returns nested message from Error-like objects with Error message", () => {
        expect(getErrorMessage({ message: new Error("nested") })).to.equal("nested");
    });

    it("returns stringified message for non-string, non-Error message properties", () => {
        expect(getErrorMessage({ message: 42 })).to.equal("42");
        expect(getErrorMessage({ message: true })).to.equal("true");
    });

    it("returns JSON stringified result for objects without message", () => {
        expect(getErrorMessage({ code: 404, detail: "not found" })).to.equal(
            '{"code":404,"detail":"not found"}',
        );
    });

    it("falls back to Object.prototype.toString for non-serializable objects", () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        expect(getErrorMessage(circular)).to.equal("[object Object]");
    });

    it("uses String() for numbers", () => {
        expect(getErrorMessage(42)).to.equal("42");
        expect(getErrorMessage(0)).to.equal("0");
        expect(getErrorMessage(NaN)).to.equal("NaN");
    });

    it("uses String() for booleans", () => {
        expect(getErrorMessage(true)).to.equal("true");
        expect(getErrorMessage(false)).to.equal("false");
    });

    it("uses String() for null and undefined", () => {
        expect(getErrorMessage(null)).to.equal("null");
        expect(getErrorMessage(undefined)).to.equal("undefined");
    });

    it("handles Symbol values", () => {
        expect(getErrorMessage(Symbol("test"))).to.equal("Symbol(test)");
    });
});
