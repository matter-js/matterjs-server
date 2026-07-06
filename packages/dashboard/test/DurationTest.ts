/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { formatDuration } from "../src/util/duration.js";

describe("formatDuration", () => {
    it("formats seconds", () => {
        expect(formatDuration(45)).to.equal("45 s");
    });
    it("formats whole minutes", () => {
        expect(formatDuration(300)).to.equal("5 min");
    });
    it("formats minutes and seconds", () => {
        expect(formatDuration(90)).to.equal("1 min 30 s");
    });
    it("formats hours and minutes", () => {
        expect(formatDuration(3900)).to.equal("1 h 5 min");
    });
    it("formats whole hours", () => {
        expect(formatDuration(7200)).to.equal("2 h");
    });
    it("caps at two units, dropping seconds when hours present", () => {
        expect(formatDuration(3661)).to.equal("1 h 1 min");
    });
    it("handles zero", () => {
        expect(formatDuration(0)).to.equal("0 s");
    });
});
