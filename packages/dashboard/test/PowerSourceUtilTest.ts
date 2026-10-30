/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { powerSourceInfo } from "../src/util/power-source.js";

const POWER_SOURCE_ATTRS: Record<string, unknown> = {
    "1/47/0": 1, // Status: Active
    "1/47/1": 0, // Order
    "1/47/2": "Battery pack A",
    "1/47/9": true, // WiredPresent
    "1/47/5": 0, // WiredCurrentType: AC
    "1/47/3": 230_000, // WiredAssessedInputVoltage (mV)
    "1/47/4": 50, // WiredAssessedInputFrequency (Hz)
    "1/47/6": 1500, // WiredAssessedCurrent (mA)
    "1/47/7": 230_000, // WiredNominalVoltage (mV)
    "1/47/8": 10_000, // WiredMaximumCurrent (mA)
    "1/47/17": true, // BatPresent
    "1/47/11": 3700, // BatVoltage (mV)
    "1/47/12": 175, // BatPercentRemaining (half-percent units)
    "1/47/13": 3600, // BatTimeRemaining (s)
    "1/47/14": 0, // BatChargeLevel: OK
    "1/47/15": false, // BatReplacementNeeded
    "1/47/16": 2, // BatReplaceability: User replaceable
    "1/47/19": "Replace with CR2032", // BatReplacementDescription
    "1/47/24": 2000, // BatCapacity (mAh)
    "1/47/25": 1, // BatQuantity
    "1/47/26": 1, // BatChargeState: Charging
    "1/47/27": 1800, // BatTimeToFullCharge (s)
    "1/47/29": 500, // BatChargingCurrent (mA)
};

describe("power source util", () => {
    it("reports unsupported when the cluster is absent", () => {
        const info = powerSourceInfo({ "1/40/5": "label" }, 1);
        expect(info.supported).to.equal(false);
        expect(info.status).to.equal(undefined);
    });

    it("decodes status, order and description", () => {
        const info = powerSourceInfo(POWER_SOURCE_ATTRS, 1);
        expect(info.supported).to.equal(true);
        expect(info.status).to.equal("Active");
        expect(info.order).to.equal(0);
        expect(info.description).to.equal("Battery pack A");
    });

    it("decodes wired-source readings and scales mV/mA to V/A", () => {
        const info = powerSourceInfo(POWER_SOURCE_ATTRS, 1);
        expect(info.wiredPresent).to.equal(true);
        expect(info.wiredCurrentType).to.equal("AC");
        expect(info.wiredAssessedInputVoltageV).to.equal(230);
        expect(info.wiredAssessedCurrentA).to.equal(1.5);
        expect(info.wiredAssessedInputFrequencyHz).to.equal(50);
        expect(info.wiredNominalVoltageV).to.equal(230);
        expect(info.wiredMaximumCurrentA).to.equal(10);
    });

    it("decodes battery readings, halving BatPercentRemaining to a percent", () => {
        const info = powerSourceInfo(POWER_SOURCE_ATTRS, 1);
        expect(info.batPresent).to.equal(true);
        expect(info.batPercentRemaining).to.equal(87.5);
        expect(info.batVoltageV).to.equal(3.7);
        expect(info.batChargeLevel).to.equal("OK");
        expect(info.batChargeState).to.equal("Charging");
        expect(info.batTimeRemainingS).to.equal(3600);
        expect(info.batTimeToFullChargeS).to.equal(1800);
        expect(info.batChargingCurrentA).to.equal(0.5);
        expect(info.batCapacityMAh).to.equal(2000);
        expect(info.batQuantity).to.equal(1);
        expect(info.batReplaceability).to.equal("User replaceable");
        expect(info.batReplacementNeeded).to.equal(false);
    });

    it("names an unknown BatReplaceability value", () => {
        const info = powerSourceInfo({ ...POWER_SOURCE_ATTRS, "1/47/16": 9 }, 1);
        expect(info.batReplaceability).to.equal("Unknown (9)");
    });

    it("names an unknown BatChargeLevel and BatChargeState value", () => {
        const info = powerSourceInfo({ ...POWER_SOURCE_ATTRS, "1/47/14": 7, "1/47/26": 9 }, 1);
        expect(info.batChargeLevel).to.equal("Unknown (7)");
        expect(info.batChargeState).to.equal("Unknown (9)");
    });

    it("surfaces the replacement description only when a replacement is needed", () => {
        const info = powerSourceInfo({ ...POWER_SOURCE_ATTRS, "1/47/15": true }, 1);
        expect(info.batReplacementNeeded).to.equal(true);
        expect(info.batReplacementDescription).to.equal("Replace with CR2032");
    });

    it("distinguishes an unreported nullable attribute from its explicit null value", () => {
        const unreported = powerSourceInfo({ "1/47/0": 1 }, 1);
        expect(unreported.batVoltageV).to.equal(undefined);
        expect(unreported.batTimeRemainingS).to.equal(undefined);

        const explicitNull = powerSourceInfo({ "1/47/0": 1, "1/47/11": null, "1/47/13": null }, 1);
        expect(explicitNull.batVoltageV).to.equal(null);
        expect(explicitNull.batTimeRemainingS).to.equal(null);
    });

    it("reports wired and battery sources as absent when their Present flags are not set", () => {
        const info = powerSourceInfo({ "1/47/0": 1 }, 1);
        expect(info.wiredPresent).to.equal(undefined);
        expect(info.batPresent).to.equal(undefined);
    });

    it("reads attributes scoped to the given endpoint only", () => {
        const info = powerSourceInfo({ "2/47/0": 1, "2/47/12": 100 }, 1);
        expect(info.supported).to.equal(false);
        expect(info.batPercentRemaining).to.equal(undefined);
    });
});
