/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { powerSourceInfo, powerSourceSections, type PowerSourceInfo } from "../src/util/power-source.js";

const WIRED_ATTRS: Record<string, unknown> = {
    "1/47/0": 1, // Status: Active
    "1/47/1": 0, // Order
    "1/47/2": "Mains",
    "1/47/65532": 0b1, // FeatureMap: WIRED
    "1/47/3": 230_000, // WiredAssessedInputVoltage (mV)
    "1/47/4": 50, // WiredAssessedInputFrequency (Hz)
    "1/47/5": 1, // WiredCurrentType: DC
    "1/47/6": 1500, // WiredAssessedCurrent (mA)
    "1/47/7": 240_000, // WiredNominalVoltage (mV)
    "1/47/8": 10_000, // WiredMaximumCurrent (mA)
    "1/47/9": true, // WiredPresent
    "1/47/10": [1, 2], // ActiveWiredFaults
    "1/47/31": [1, 2], // EndpointList
};

const BATTERY_ATTRS: Record<string, unknown> = {
    "1/47/0": 2, // Status: Standby
    "1/47/1": 1, // Order
    "1/47/2": "Battery pack A",
    "1/47/65532": 0b1110, // FeatureMap: BAT | RECHG | REPLC
    "1/47/11": 3700, // BatVoltage (mV)
    "1/47/12": 175, // BatPercentRemaining (half-percent units)
    "1/47/13": 3600, // BatTimeRemaining (s)
    "1/47/14": 1, // BatChargeLevel: Warning
    "1/47/15": true, // BatReplacementNeeded
    "1/47/16": 3, // BatReplaceability: Factory replaceable
    "1/47/17": false, // BatPresent
    "1/47/18": [1], // ActiveBatFaults
    "1/47/19": "CR123A", // BatReplacementDescription
    "1/47/21": "5003LC", // BatANSIDesignation
    "1/47/22": "CR17345", // BatIECDesignation
    "1/47/24": 2000, // BatCapacity (mAh)
    "1/47/25": 2, // BatQuantity
    "1/47/26": 2, // BatChargeState: At full charge
    "1/47/27": 1800, // BatTimeToFullCharge (s)
    "1/47/28": true, // BatFunctionalWhileCharging
    "1/47/29": 500, // BatChargingCurrent (mA)
    "1/47/30": [3, 7], // ActiveBatChargeFaults
    "1/47/31": [1, 3], // EndpointList
};

describe("power source util", () => {
    describe("powerSourceInfo", () => {
        it("reports unsupported when the cluster is absent", () => {
            const info = powerSourceInfo({ "1/40/5": "label" }, 1);
            expect(info.supported).to.equal(false);
            expect(info.status).to.equal(undefined);
        });

        it("reports unsupported when the FeatureMap was removed (null)", () => {
            expect(powerSourceInfo({ ...BATTERY_ATTRS, "1/47/65532": null }, 1).supported).to.equal(false);
        });

        it("reads attributes scoped to the given endpoint only", () => {
            const info = powerSourceInfo({ "2/47/65532": 0b10, "2/47/12": 100 }, 1);
            expect(info.supported).to.equal(false);
            expect(info.batPercentRemaining).to.equal(undefined);
        });

        it("takes wired support from FeatureMap bit 0 only", () => {
            const info = powerSourceInfo(WIRED_ATTRS, 1);
            expect(info.wiredSupported).to.equal(true);
            expect(info.batterySupported).to.equal(false);
        });

        it("takes battery support from FeatureMap bit 1, not from a reported BatPresent", () => {
            expect(powerSourceInfo(BATTERY_ATTRS, 1).batterySupported).to.equal(true);
            const presentOnly = powerSourceInfo({ "1/47/65532": 0, "1/47/17": true }, 1);
            expect(presentOnly.batterySupported).to.equal(false);
            expect(presentOnly.wiredSupported).to.equal(false);
        });

        it("decodes status, order, description and EndpointList", () => {
            const info = powerSourceInfo(WIRED_ATTRS, 1);
            expect(info.supported).to.equal(true);
            expect(info.status).to.equal("Active");
            expect(info.order).to.equal(0);
            expect(info.description).to.equal("Mains");
            expect(info.endpointList).to.deep.equal([1, 2]);
        });

        it("decodes wired-source readings and scales mV/mA to V/A", () => {
            const info = powerSourceInfo(WIRED_ATTRS, 1);
            expect(info.wiredPresent).to.equal(true);
            expect(info.wiredCurrentType).to.equal("DC");
            expect(info.wiredAssessedInputVoltageV).to.equal(230);
            expect(info.wiredAssessedInputFrequencyHz).to.equal(50);
            expect(info.wiredAssessedCurrentA).to.equal(1.5);
            expect(info.wiredNominalVoltageV).to.equal(240);
            expect(info.wiredMaximumCurrentA).to.equal(10);
            expect(info.activeWiredFaults).to.deep.equal(["Over voltage", "Under voltage"]);
        });

        it("decodes battery readings, halving BatPercentRemaining to a percent", () => {
            const info = powerSourceInfo(BATTERY_ATTRS, 1);
            expect(info.batPresent).to.equal(false);
            expect(info.batVoltageV).to.equal(3.7);
            expect(info.batPercentRemaining).to.equal(87.5);
            expect(info.batTimeRemainingS).to.equal(3600);
            expect(info.batChargeLevel).to.equal("Warning");
            expect(info.batReplacementNeeded).to.equal(true);
            expect(info.batReplaceability).to.equal("Factory replaceable");
            expect(info.activeBatFaults).to.deep.equal(["Over temperature"]);
            expect(info.batReplacementDescription).to.equal("CR123A");
            expect(info.batAnsiDesignation).to.equal("5003LC");
            expect(info.batIecDesignation).to.equal("CR17345");
            expect(info.batCapacityMAh).to.equal(2000);
            expect(info.batQuantity).to.equal(2);
            expect(info.batChargeState).to.equal("At full charge");
            expect(info.batTimeToFullChargeS).to.equal(1800);
            expect(info.batFunctionalWhileCharging).to.equal(true);
            expect(info.batChargingCurrentA).to.equal(0.5);
            expect(info.activeBatChargeFaults).to.deep.equal(["Battery too hot", "Battery under voltage"]);
        });

        const enumTables: [string, number, keyof PowerSourceInfo, string[]][] = [
            ["Status", 0, "status", ["Unspecified", "Active", "Standby", "Unavailable"]],
            ["WiredCurrentType", 5, "wiredCurrentType", ["AC", "DC"]],
            ["BatChargeLevel", 14, "batChargeLevel", ["OK", "Warning", "Critical"]],
            [
                "BatReplaceability",
                16,
                "batReplaceability",
                ["Unspecified", "Not replaceable", "User replaceable", "Factory replaceable"],
            ],
            ["BatChargeState", 26, "batChargeState", ["Undetermined", "Charging", "At full charge", "Not charging"]],
        ];
        for (const [name, attributeId, key, names] of enumTables) {
            it(`names every ${name} value and an unknown one`, () => {
                names.forEach((expected, value) => {
                    expect(powerSourceInfo({ [`1/47/${attributeId}`]: value }, 1)[key]).to.equal(expected);
                });
                expect(powerSourceInfo({ [`1/47/${attributeId}`]: 9 }, 1)[key]).to.equal("Unknown (9)");
            });
        }

        it("names every fault value and an unknown one, dropping a non-numeric entry", () => {
            const info = powerSourceInfo(
                {
                    "1/47/10": [0, 1, "x", 2, 9],
                    "1/47/18": [0, 1, 2, 9],
                    "1/47/30": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
                },
                1,
            );
            expect(info.activeWiredFaults).to.deep.equal([
                "Unspecified",
                "Over voltage",
                "Under voltage",
                "Unknown (9)",
            ]);
            expect(info.activeBatFaults).to.deep.equal([
                "Unspecified",
                "Over temperature",
                "Under temperature",
                "Unknown (9)",
            ]);
            expect(info.activeBatChargeFaults).to.deep.equal([
                "Unspecified",
                "Ambient too hot",
                "Ambient too cold",
                "Battery too hot",
                "Battery too cold",
                "Battery absent",
                "Battery over voltage",
                "Battery under voltage",
                "Charger over voltage",
                "Charger under voltage",
                "Safety timeout",
                "Unknown (11)",
            ]);
        });

        const nullableReadings: [number, keyof PowerSourceInfo][] = [
            [3, "wiredAssessedInputVoltageV"],
            [4, "wiredAssessedInputFrequencyHz"],
            [6, "wiredAssessedCurrentA"],
            [11, "batVoltageV"],
            [12, "batPercentRemaining"],
            [13, "batTimeRemainingS"],
            [27, "batTimeToFullChargeS"],
            [29, "batChargingCurrentA"],
        ];
        for (const [attributeId, key] of nullableReadings) {
            it(`keeps a null ${key} apart from an unreported one`, () => {
                expect(powerSourceInfo({}, 1)[key]).to.equal(undefined);
                expect(powerSourceInfo({ [`1/47/${attributeId}`]: null }, 1)[key]).to.equal(null);
            });
        }

        it("treats an unreported nominal voltage or maximum current as absent", () => {
            const info = powerSourceInfo({ "1/47/65532": 0b1 }, 1);
            expect(info.wiredNominalVoltageV).to.equal(undefined);
            expect(info.wiredMaximumCurrentA).to.equal(undefined);
        });

        it("ignores non-boolean or removed flags and blank texts", () => {
            const info = powerSourceInfo({ "1/47/9": 1, "1/47/17": null, "1/47/2": "  ", "1/47/19": "" }, 1);
            expect(info.wiredPresent).to.equal(undefined);
            expect(info.batPresent).to.equal(undefined);
            expect(info.description).to.equal(undefined);
            expect(info.batReplacementDescription).to.equal(undefined);
        });
    });

    describe("powerSourceSections", () => {
        it("shows general and wired rows for a wired source", () => {
            const sections = powerSourceSections(powerSourceInfo(WIRED_ATTRS, 1));
            expect(sections.general).to.deep.equal([
                { label: "Status", value: "Active" },
                { label: "Order", value: "0" },
                { label: "Description", value: "Mains" },
                { label: "Powered endpoints", value: "1, 2" },
            ]);
            expect(sections.wired).to.deep.equal([
                { label: "Current type", value: "DC" },
                { label: "Present", value: "Yes" },
                { label: "Input voltage", value: "230 V" },
                { label: "Input current", value: "1.5 A" },
                { label: "Input frequency", value: "50 Hz" },
                { label: "Nominal voltage", value: "240 V" },
                { label: "Maximum current", value: "10 A" },
                { label: "Active faults", value: "Over voltage, Under voltage" },
            ]);
            expect(sections.battery).to.equal(undefined);
        });

        it("shows battery rows, with the replacement description independent of ReplacementNeeded", () => {
            const sections = powerSourceSections(powerSourceInfo({ ...BATTERY_ATTRS, "1/47/15": false }, 1));
            expect(sections.wired).to.equal(undefined);
            expect(sections.battery).to.deep.equal([
                { label: "Charge remaining", value: "87.5%" },
                { label: "Charge level", value: "Warning" },
                { label: "Present", value: "No" },
                { label: "Voltage", value: "3.7 V" },
                { label: "Time remaining", value: "1 h" },
                { label: "Charge state", value: "At full charge" },
                { label: "Time to full charge", value: "30 min" },
                { label: "Charging current", value: "0.5 A" },
                { label: "Functional while charging", value: "Yes" },
                { label: "Capacity", value: "2000 mAh" },
                { label: "Quantity", value: "2" },
                { label: "Replaceability", value: "Factory replaceable" },
                { label: "Replacement needed", value: "No" },
                { label: "Replacement", value: "CR123A" },
                { label: "ANSI designation", value: "5003LC" },
                { label: "IEC designation", value: "CR17345" },
                { label: "Active faults", value: "Over temperature" },
                { label: "Active charge faults", value: "Battery too hot, Battery under voltage" },
            ]);
        });

        it("shows a reading the device cannot assess (null) as Unknown and a zero reading as zero", () => {
            const sections = powerSourceSections(
                powerSourceInfo({ "1/47/65532": 0b10, "1/47/12": null, "1/47/11": 0, "1/47/18": [] }, 1),
            );
            expect(sections.battery).to.deep.equal([
                { label: "Charge remaining", value: "Unknown" },
                { label: "Voltage", value: "0 V" },
                { label: "Active faults", value: "None" },
            ]);
        });

        it("shows wired readings the device cannot assess (null) as Unknown", () => {
            const sections = powerSourceSections(
                powerSourceInfo({ "1/47/65532": 0b1, "1/47/3": null, "1/47/6": null }, 1),
            );
            expect(sections.wired).to.deep.equal([
                { label: "Input voltage", value: "Unknown" },
                { label: "Input current", value: "Unknown" },
            ]);
        });

        it("shows an empty EndpointList as powering the entire node", () => {
            const sections = powerSourceSections(powerSourceInfo({ ...WIRED_ATTRS, "1/47/31": [] }, 1));
            expect(sections.general).to.deep.include({ label: "Powered endpoints", value: "Entire node" });
        });

        for (const [name, featureMap] of [
            ["wired", 0b1],
            ["battery", 0b10],
        ] as const) {
            it(`leaves out the ${name} section of a non-conformant device that reports none of its attributes`, () => {
                const sections = powerSourceSections(powerSourceInfo({ "1/47/65532": featureMap, "1/47/0": 1 }, 1));
                expect(sections.general).to.deep.equal([{ label: "Status", value: "Active" }]);
                expect(sections.wired).to.equal(undefined);
                expect(sections.battery).to.equal(undefined);
            });
        }
    });
});
