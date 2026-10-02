/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    cancelBoost,
    formatEnergyKwh,
    heatSourcesText,
    parseBoostForm,
    startBoost,
    waterHeaterManagementInfo,
} from "../src/util/water-heater-management.js";

const BASE_ATTRS: Record<string, unknown> = {
    "1/148/0": 0b0001, // HeaterTypes: Immersion Element 1
    "1/148/1": 0b0000, // HeatDemand: None currently
    "1/148/4": 85, // TankPercentage: 85%
    "1/148/5": 0, // BoostState: Inactive
    "1/148/65532": 0b11, // FeatureMap: EnergyManagement (bit 0) + TankPercent (bit 1)
};

describe("water heater management util", () => {
    it("reports unsupported when the cluster is absent", () => {
        const info = waterHeaterManagementInfo({ "1/40/5": "label" }, 1);
        expect(info.supported).to.equal(false);
    });

    it("decodes heater types bitmap", () => {
        const info = waterHeaterManagementInfo(BASE_ATTRS, 1);
        expect(info.supported).to.equal(true);
        expect(info.heaterTypesBitmap).to.equal(0b0001);
        expect(info.heaterTypes).to.deep.equal(["Immersion Element 1"]);
    });

    it("decodes heat demand bitmap", () => {
        const info = waterHeaterManagementInfo(BASE_ATTRS, 1);
        expect(info.heatDemandBitmap).to.equal(0b0000);
        expect(info.heatDemandTypes).to.deep.equal([]);

        const withDemandAttrs = { ...BASE_ATTRS, "1/148/1": 0b0101 };
        const demandInfo = waterHeaterManagementInfo(withDemandAttrs, 1);
        expect(demandInfo.heatDemandTypes).to.deep.equal(["Immersion Element 1", "Heat Pump"]);
    });

    it("decodes tank percentage", () => {
        const info = waterHeaterManagementInfo(BASE_ATTRS, 1);
        expect(info.tankPercentage).to.equal(85);
    });

    it("decodes boost state enum", () => {
        const inactiveInfo = waterHeaterManagementInfo(BASE_ATTRS, 1);
        expect(inactiveInfo.boostStateValue).to.equal(0);
        expect(inactiveInfo.boostState).to.equal("Inactive");
        expect(inactiveInfo.boostActive).to.equal(false);

        const activeAttrs = { ...BASE_ATTRS, "1/148/5": 1 };
        const activeInfo = waterHeaterManagementInfo(activeAttrs, 1);
        expect(activeInfo.boostStateValue).to.equal(1);
        expect(activeInfo.boostState).to.equal("Active");
        expect(activeInfo.boostActive).to.equal(true);
    });

    it("detects supported features from FeatureMap", () => {
        const info = waterHeaterManagementInfo(BASE_ATTRS, 1);
        expect(info.supportsEnergyManagement).to.equal(true);
        expect(info.supportsTankPercent).to.equal(true);

        const noFeaturesAttrs = { ...BASE_ATTRS, "1/148/65532": 0 };
        const noFeaturesInfo = waterHeaterManagementInfo(noFeaturesAttrs, 1);
        expect(noFeaturesInfo.supportsEnergyManagement).to.equal(false);
        expect(noFeaturesInfo.supportsTankPercent).to.equal(false);
    });

    it("handles missing optional attributes gracefully", () => {
        const minimalAttrs: Record<string, unknown> = {
            "1/148/0": 0b0001, // Only heater types
        };
        const info = waterHeaterManagementInfo(minimalAttrs, 1);
        expect(info.supported).to.equal(true);
        expect(info.heaterTypes).to.deep.equal(["Immersion Element 1"]);
        expect(info.tankPercentage).to.equal(undefined);
        expect(info.boostState).to.equal(undefined);
    });

    it("handles all heater type bits", () => {
        const heaterTypes = [
            { value: 0b00001, name: "Immersion Element 1" },
            { value: 0b00010, name: "Immersion Element 2" },
            { value: 0b00100, name: "Heat Pump" },
            { value: 0b01000, name: "Boiler" },
            { value: 0b10000, name: "Other" },
        ];

        heaterTypes.forEach(({ value, name }) => {
            const attrs = { ...BASE_ATTRS, "1/148/0": value };
            const info = waterHeaterManagementInfo(attrs, 1);
            expect(info.heaterTypes).to.deep.equal([name]);
        });
    });

    it("handles combined heater type bits", () => {
        const attrs = { ...BASE_ATTRS, "1/148/0": 0b00101 }; // Immersion 1 + Heat Pump
        const info = waterHeaterManagementInfo(attrs, 1);
        expect(info.heaterTypes).to.deep.equal(["Immersion Element 1", "Heat Pump"]);
    });

    it("works with different endpoints", () => {
        const attrs2: Record<string, unknown> = {
            "2/148/0": 0b0100, // Endpoint 2, Heat Pump
            "2/148/5": 1, // Boost active
        };
        const info = waterHeaterManagementInfo(attrs2, 2);
        expect(info.heaterTypes).to.deep.equal(["Heat Pump"]);
        expect(info.boostActive).to.equal(true);
    });

    it("tells an unreported heat demand apart from an empty one", () => {
        expect(heatSourcesText(waterHeaterManagementInfo({ "1/148/0": 0b0001 }, 1).heatDemandTypes)).to.equal("—");
        expect(heatSourcesText(waterHeaterManagementInfo(BASE_ATTRS, 1).heatDemandTypes)).to.equal("None");
        expect(
            heatSourcesText(waterHeaterManagementInfo({ ...BASE_ATTRS, "1/148/1": 0b0100 }, 1).heatDemandTypes),
        ).to.equal("Heat Pump");
    });

    it("reads EstimatedHeatRequired in mWh and formats it as kWh", () => {
        const info = waterHeaterManagementInfo({ ...BASE_ATTRS, "1/148/3": 4_250_000 }, 1);
        expect(info.estimatedHeatRequiredMilliWh).to.equal(4_250_000);
        expect(formatEnergyKwh(4_250_000)).to.equal("4.25 kWh");
    });

    describe("commands", () => {
        function fakeClient(error?: Error) {
            const calls = new Array<{ command: string; payload: Record<string, unknown> | undefined }>();
            const client = {
                deviceCommand: async (
                    _nodeId: number | bigint,
                    _endpointId: number,
                    _clusterId: number,
                    command: string,
                    payload?: Record<string, unknown>,
                ) => {
                    calls.push({ command, payload });
                    if (error) throw error;
                    return undefined;
                },
            };
            return { client, calls };
        }

        it("sends Boost with only the given fields and the setpoint in 0.01 °C", async () => {
            const { client, calls } = fakeClient();
            await startBoost(client, 1, 1, { duration: 600, oneShot: true, temporarySetpoint: 55.5 });
            expect(calls).to.deep.equal([
                {
                    command: "Boost",
                    payload: { boostInfo: { duration: 600, oneShot: true, temporarySetpoint: 5550 } },
                },
            ]);
        });

        it("sends CancelBoost", async () => {
            const { client, calls } = fakeClient();
            await cancelBoost(client, 1, 1);
            expect(calls.map(call => call.command)).to.deep.equal(["CancelBoost"]);
        });

        it("rejects with the device error so the panel can show it", async () => {
            const { client } = fakeClient(new Error("InvalidCommand"));
            await expect(startBoost(client, 1, 1, { duration: 600 })).to.be.rejectedWith("InvalidCommand");
            await expect(cancelBoost(client, 1, 1)).to.be.rejectedWith("InvalidCommand");
        });
    });

    describe("parseBoostForm", () => {
        const form = {
            duration: "600",
            oneShot: false,
            emergencyBoost: false,
            temporarySetpoint: "",
            targetPercentage: "",
        };

        it("leaves empty optional fields out", () => {
            expect(parseBoostForm(form, true)).to.deep.equal({ params: { duration: 600 } });
        });

        it("includes checked flags and filled fields", () => {
            const result = parseBoostForm(
                { ...form, oneShot: true, emergencyBoost: true, temporarySetpoint: "55.5", targetPercentage: "80" },
                true,
            );
            expect(result).to.deep.equal({
                params: {
                    duration: 600,
                    oneShot: true,
                    emergencyBoost: true,
                    temporarySetpoint: 55.5,
                    targetPercentage: 80,
                },
            });
        });

        it("rejects a duration that is empty, zero, negative or fractional", () => {
            for (const duration of ["", "0", "-5", "1.5", "abc"]) {
                expect(parseBoostForm({ ...form, duration }, true), duration).to.have.property("error");
            }
        });

        it("rejects a target tank level outside 0-100 or fractional", () => {
            for (const targetPercentage of ["101", "-1", "50.5"]) {
                expect(parseBoostForm({ ...form, targetPercentage }, true), targetPercentage).to.have.property("error");
            }
        });

        it("rejects a temporary setpoint that is not a number or outside the int16 range in 0.01 °C", () => {
            for (const temporarySetpoint of ["warm", "1-2", "-273.16", "327.68"]) {
                expect(parseBoostForm({ ...form, temporarySetpoint }, true), temporarySetpoint).to.have.property(
                    "error",
                );
            }
            expect(parseBoostForm({ ...form, temporarySetpoint: "327.67" }, true)).to.have.property("params");
        });

        it("rejects a duration above the uint32 range", () => {
            expect(parseBoostForm({ ...form, duration: "4294967296" }, true)).to.have.property("error");
            expect(parseBoostForm({ ...form, duration: "4294967295" }, true)).to.have.property("params");
        });

        it("drops the target tank level without the TankPercent feature", () => {
            expect(parseBoostForm({ ...form, targetPercentage: "80" }, false)).to.deep.equal({
                params: { duration: 600 },
            });
        });
    });
});
