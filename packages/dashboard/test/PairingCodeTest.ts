/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { formatManualPairingCode, renderPairingQrCodeDataUri } from "../src/util/pairing-code.js";

describe("formatManualPairingCode", () => {
    it("groups an 11-digit code as XXXX-XXX-XXXX", () => {
        expect(formatManualPairingCode("34315849284")).to.equal("3431-584-9284");
    });
    it("strips non-digit characters before grouping", () => {
        expect(formatManualPairingCode("3431-584-9284")).to.equal("3431-584-9284");
    });
    it("returns digits only for non-11-digit codes", () => {
        expect(formatManualPairingCode("749701123365521327694")).to.equal("749701123365521327694");
    });
    it("returns the original string when it holds no digits", () => {
        expect(formatManualPairingCode("no-digits")).to.equal("no-digits");
    });
});

describe("renderPairingQrCodeDataUri", () => {
    it("returns an SVG data URI containing an <svg> tag", () => {
        const uri = renderPairingQrCodeDataUri("MT:Y.K9042C00KA0648G00");
        expect(uri).to.match(/^data:image\/svg\+xml,/);
        expect(decodeURIComponent(uri)).to.contain("<svg");
    });
});
