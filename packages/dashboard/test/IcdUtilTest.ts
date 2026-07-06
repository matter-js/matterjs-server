/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    icdInfo,
    isLitIcd,
    isRegisteredByUs,
    litOfflineHint,
    otherFabricClientCount,
    parseIcdFeatures,
    parseMultiAdminDetails,
    wakeInstruction,
} from "../src/util/icd.js";

const LIT_ATTRS: Record<string, unknown> = {
    "0/70/0": 3600, // IdleModeDuration
    "0/70/3": [{ checkInNodeId: 1234, monitoredSubject: 1234, fabricIndex: 2 }],
    "0/70/6": 0b1, // UserActiveModeTriggerHint: PowerCycle
    "0/70/7": "Press the button 3 times",
    "0/70/8": 1, // OperatingMode LIT
    "0/70/65532": 0b0111, // CIP | UAT | LITS
};

describe("icd util", () => {
    describe("parseIcdFeatures", () => {
        it("decodes all bits", () => {
            expect(parseIcdFeatures(0b1111)).to.deep.equal({
                checkInProtocolSupport: true,
                userActiveModeTrigger: true,
                longIdleTimeSupport: true,
                dynamicSitLitSupport: true,
            });
        });
        it("decodes SIT-only device", () => {
            expect(parseIcdFeatures(0).longIdleTimeSupport).to.equal(false);
        });
    });

    describe("icdInfo", () => {
        it("reads a LIT device", () => {
            const info = icdInfo(LIT_ATTRS);
            expect(info.supported).to.equal(true);
            expect(info.operatingMode).to.equal("LIT");
            expect(info.idleModeDuration).to.equal(3600);
            expect(info.features.longIdleTimeSupport).to.equal(true);
            expect(info.registeredClients).to.have.lengthOf(1);
        });
        it("reports unsupported when cluster absent", () => {
            const info = icdInfo({ "0/40/5": "label" });
            expect(info.supported).to.equal(false);
            expect(info.operatingMode).to.equal(undefined);
        });
    });

    describe("isLitIcd", () => {
        it("true for operating LIT device", () => {
            expect(isLitIcd(LIT_ATTRS)).to.equal(true);
        });
        it("false for SIT device", () => {
            expect(isLitIcd({ ...LIT_ATTRS, "0/70/8": 0 })).to.equal(false);
        });
        it("false without ICD cluster", () => {
            expect(isLitIcd({})).to.equal(false);
        });
    });

    describe("isRegisteredByUs", () => {
        const clients = [{ checkInNodeId: 1234, monitoredSubject: 1234, fabricIndex: 2 }];
        it("matches bigint vs number node id via String()", () => {
            expect(isRegisteredByUs(clients, BigInt(1234))).to.equal(true);
        });
        it("false for other node id", () => {
            expect(isRegisteredByUs(clients, 99)).to.equal(false);
        });
        it("false without controller node id", () => {
            expect(isRegisteredByUs(clients, undefined)).to.equal(false);
        });
    });

    describe("otherFabricClientCount", () => {
        const clients = [
            { checkInNodeId: 1, monitoredSubject: 1, fabricIndex: 1 },
            { checkInNodeId: 2, monitoredSubject: 2, fabricIndex: 2 },
        ];
        it("counts entries from other fabrics", () => {
            expect(otherFabricClientCount(clients, 2)).to.equal(1);
        });
        it("returns full count when our fabric unknown", () => {
            expect(otherFabricClientCount(clients, undefined)).to.equal(2);
        });
    });

    describe("wakeInstruction", () => {
        it("uses custom instruction when CustomInstruction bit set", () => {
            expect(wakeInstruction(0b100, "Tap it twice")).to.equal("Tap it twice");
        });
        it("maps power cycle", () => {
            expect(wakeInstruction(0b1, undefined)).to.equal("power-cycle the device");
        });
        it("falls back to device manual", () => {
            expect(wakeInstruction(undefined, undefined)).to.equal("see the device manual");
        });
    });

    describe("litOfflineHint", () => {
        it("mentions formatted interval", () => {
            expect(litOfflineHint(LIT_ATTRS)).to.contain("1 h");
        });
    });

    describe("parseMultiAdminDetails", () => {
        it("extracts vendor ids", () => {
            expect(parseMultiAdminDetails('{"message":"x","admin_vendor_ids":[4631,4362]}')).to.deep.equal([
                4631, 4362,
            ]);
        });
        it("returns undefined for plain text", () => {
            expect(parseMultiAdminDetails("boom")).to.equal(undefined);
        });
    });
});
