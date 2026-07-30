/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { AttributesData, isLongIdleTimeDevice } from "@matter-server/ws-client";
import { IcdManagement } from "@matter/main/clusters";

const LITS_FEATURE_MAP = 1 << 2;
const SPEC_VERSION_1_4 = 0x01040000;
const SPEC_VERSION_1_3 = 0x01030000;

function litAttributes(overrides: AttributesData = {}): AttributesData {
    return {
        "0/70/8": IcdManagement.OperatingMode.Lit,
        "0/70/65532": LITS_FEATURE_MAP,
        "0/40/21": SPEC_VERSION_1_4,
        ...overrides,
    };
}

// ws-client spells the attribute paths and enum values out to stay free of the matter.js model, so
// these cases pin them against the cluster definition.
describe("isLongIdleTimeDevice", () => {
    it("detects a LIT-capable node reporting LIT operating mode", () => {
        expect(isLongIdleTimeDevice(litAttributes())).to.equal(true);
    });

    it("rejects a node reporting SIT operating mode", () => {
        expect(isLongIdleTimeDevice(litAttributes({ "0/70/8": IcdManagement.OperatingMode.Sit }))).to.equal(false);
    });

    it("rejects a node without the LongIdleTimeSupport feature", () => {
        expect(isLongIdleTimeDevice(litAttributes({ "0/70/65532": 3 }))).to.equal(false);
    });

    it("rejects a node below the 1.4 specification version, which the controller reaches directly", () => {
        expect(isLongIdleTimeDevice(litAttributes({ "0/40/21": SPEC_VERSION_1_3 }))).to.equal(false);
    });

    it("rejects a node not reporting a specification version", () => {
        expect(isLongIdleTimeDevice(litAttributes({ "0/40/21": undefined }))).to.equal(false);
    });

    it("rejects a node without the IcdManagement cluster", () => {
        expect(isLongIdleTimeDevice({ "0/40/2": 4874, "0/40/21": SPEC_VERSION_1_4 })).to.equal(false);
    });

    it("rejects a null operating mode", () => {
        expect(isLongIdleTimeDevice(litAttributes({ "0/70/8": null }))).to.equal(false);
    });
});
