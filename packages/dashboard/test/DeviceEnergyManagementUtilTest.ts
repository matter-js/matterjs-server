/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { deviceEnergyManagementInfo, formatEnergy, formatPower } from "../src/util/device-energy-management.js";

/**
 * ForecastStruct is field-tag keyed: "0" ForecastId, "1" ActiveSlotNumber, "2" StartTime, "3" EndTime,
 * "4" EarliestStartTime, "5" LatestEndTime, "6" IsPausable, "7" Slots, "8" ForecastUpdateReason.
 * SlotStruct: "0"–"2" min/max/default duration, "3" ElapsedSlotTime, "4" RemainingSlotTime,
 * "5" SlotIsPausable, "8" ManufacturerESAState, "9"–"11" nominal/min/max power (mW),
 * "12" NominalEnergy (mWh), "13" Costs, "14"–"17" adjustment limits.
 */
const FORECAST_START = 800_000_000;

const DISHWASHER_ATTRS: Record<string, unknown> = {
    "1/152/0": 9, // Dishwasher
    "1/152/1": false,
    "1/152/2": 1, // Online
    "1/152/3": 0,
    "1/152/4": 2_000_000n,
    "1/152/6": {
        "0": 12,
        "1": 1,
        "2": FORECAST_START,
        "3": FORECAST_START + 4980,
        "6": true,
        "7": [
            { "0": 300, "1": 400, "2": 360, "3": 360, "4": 0, "8": 1, "9": 180_000n, "12": 18_000n },
            { "0": 2000, "1": 3000, "2": 2400, "3": 1320, "4": 1080, "5": true, "8": 2, "9": 1_900_000n },
            { "0": 600, "2": 720, "3": 0, "4": 0, "8": 3, "9": 150_000n, "12": 30_000n },
            { "0": 1200, "2": 1500, "3": 0, "4": 0, "8": 4, "9": 900_000n, "12": 400_000n },
        ],
        "8": 1, // Local optimization
    },
    "1/152/7": 0,
    "1/152/65532": 0b0001_1110, // PFR | SFR | STA | PAU
};

const SOLAR_ATTRS: Record<string, unknown> = {
    "1/152/0": 6, // Solar PV
    "1/152/1": true,
    "1/152/2": 1,
    "1/152/6": {
        "0": 7,
        "1": 0,
        "2": FORECAST_START,
        "3": FORECAST_START + 7200,
        "7": [
            { "2": 3600, "3": 600, "4": 3000, "9": -2_500_000n, "10": -3_000_000n, "11": -1_000_000n },
            {
                "2": 3600,
                "9": -1_200_000n,
                "12": -1_200_000n,
                "13": [{ "0": 0, "1": 1579, "2": 4, "3": 978 }],
            },
        ],
        "8": 0,
    },
    "1/152/65532": 0b0000_0010, // PFR
};

const EVSE_ATTRS: Record<string, unknown> = {
    "1/152/0": 0, // EV Supply Equipment
    "1/152/1": false,
    "1/152/2": 1,
    "1/152/3": 1_400_000n,
    "1/152/4": 7_400_000n,
    "1/152/6": {
        "0": 3,
        "1": null,
        "2": FORECAST_START + 3600,
        "3": FORECAST_START + 14_400,
        "4": FORECAST_START,
        "5": FORECAST_START + 28_800,
        "6": true,
        "7": [
            {
                "0": 3600,
                "1": 14_400,
                "2": 10_800,
                "3": 0,
                "4": 0,
                "5": true,
                "9": 7_400_000n,
                "12": 22_200_000n,
                "14": 1_400_000n,
                "15": 7_400_000n,
                "16": 1800,
                "17": 21_600,
            },
        ],
        "8": 2, // Grid optimization
    },
    "1/152/7": 1,
    "1/152/65532": 0b0010_1011, // PA | PFR | STA | FA
};

describe("device energy management util", () => {
    it("reports unsupported when the cluster is absent", () => {
        const info = deviceEnergyManagementInfo({ "1/40/5": "label" }, 1);
        expect(info.supported).to.equal(false);
        expect(info.forecast).to.equal(undefined);
        expect(info.features.powerForecastReporting).to.equal(false);
    });

    it("decodes the ESA context attributes", () => {
        const info = deviceEnergyManagementInfo(DISHWASHER_ATTRS, 1);
        expect(info.supported).to.equal(true);
        expect(info.esaType).to.equal("Dishwasher");
        expect(info.esaState).to.equal("Online");
        expect(info.canGenerate).to.equal(false);
        expect(info.absMaxPowerW).to.equal(2000);
        expect(info.optOutState).to.equal("No opt-out");
    });

    it("decodes the FeatureMap bits", () => {
        const info = deviceEnergyManagementInfo(DISHWASHER_ATTRS, 1);
        expect(info.features.powerForecastReporting).to.equal(true);
        expect(info.features.stateForecastReporting).to.equal(true);
        expect(info.features.startTimeAdjustment).to.equal(true);
        expect(info.features.pausable).to.equal(true);
        expect(info.features.powerAdjustment).to.equal(false);
        expect(info.features.constraintBasedAdjustment).to.equal(false);
    });

    it("marks each slot completed, active or scheduled around ActiveSlotNumber", () => {
        const slots = deviceEnergyManagementInfo(DISHWASHER_ATTRS, 1).forecast!.slots;
        expect(slots.map(slot => slot.status)).to.deep.equal(["completed", "active", "scheduled", "scheduled"]);
        expect(slots.map(slot => slot.manufacturerEsaState)).to.deep.equal([1, 2, 3, 4]);
    });

    it("converts each slot's power to W and its energy to Wh", () => {
        const slots = deviceEnergyManagementInfo(DISHWASHER_ATTRS, 1).forecast!.slots;
        expect(slots.map(slot => slot.nominalPowerW)).to.deep.equal([180, 1900, 150, 900]);
        expect(slots[0].energyWh).to.equal(18);
        expect(slots[0].energyEstimated).to.equal(false);
        expect(slots[2].energyWh).to.equal(30);
        expect(slots[3].energyWh).to.equal(400);
    });

    it("derives a slot's energy from its nominal power when NominalEnergy is absent", () => {
        const activeSlot = deviceEnergyManagementInfo(DISHWASHER_ATTRS, 1).forecast!.slots[1];
        expect(activeSlot.durationSeconds).to.equal(2400);
        expect(activeSlot.energyWh).to.be.closeTo(1266.67, 0.01);
        expect(activeSlot.energyEstimated).to.equal(true);
    });

    it("times the running slot by its own clock and the others by their default duration", () => {
        const slots = deviceEnergyManagementInfo(DISHWASHER_ATTRS, 1).forecast!.slots;
        expect(slots.map(slot => slot.durationSeconds)).to.deep.equal([360, 2400, 720, 1500]);
        expect(slots[1].elapsedSeconds).to.equal(1320);
        expect(slots[1].remainingSeconds).to.equal(1080);
    });

    it("lays the slots on the clock starting from Forecast.StartTime", () => {
        const slots = deviceEnergyManagementInfo(DISHWASHER_ATTRS, 1).forecast!.slots;
        expect(slots.map(slot => slot.startTime)).to.deep.equal([
            FORECAST_START,
            FORECAST_START + 360,
            FORECAST_START + 2760,
            FORECAST_START + 3480,
        ]);
        expect(slots[3].endTime).to.equal(FORECAST_START + 4980);
    });

    it("stops timing slots once a duration is unknown rather than guessing", () => {
        const forecast = {
            "2": FORECAST_START,
            "7": [{ "2": 600 }, { "8": 1 }, { "2": 600 }],
        };
        const info = deviceEnergyManagementInfo({ ...DISHWASHER_ATTRS, "1/152/6": forecast }, 1).forecast!;
        const slots = info.slots;
        expect(slots[1].startTime).to.equal(FORECAST_START + 600);
        expect(slots[1].endTime).to.equal(undefined);
        expect(slots[2].startTime).to.equal(undefined);
        // The slots that do have a duration sum to 1200 s, which is not the forecast's length.
        expect(info.durationSeconds).to.equal(undefined);
    });

    it("totals the forecast's consumption over its slots", () => {
        const forecast = deviceEnergyManagementInfo(DISHWASHER_ATTRS, 1).forecast!;
        expect(forecast.consumedEnergyWh).to.be.closeTo(1714.67, 0.01);
        expect(forecast.generatedEnergyWh).to.equal(0);
        expect(forecast.consumedEnergyEstimated).to.equal(true);
        expect(forecast.generatedEnergyEstimated).to.equal(false);
        expect(forecast.durationSeconds).to.equal(4980);
        expect(forecast.updateReason).to.equal("Local optimization");
        expect(forecast.isPausable).to.equal(true);
    });

    it("tracks the estimated flag per direction on a mixed forecast", () => {
        const forecast = {
            "2": FORECAST_START,
            // Slot 0 consumes and reports NominalEnergy; slot 1 generates and only reports NominalPower.
            "7": [
                { "2": 3600, "9": 1000, "12": 1000 },
                { "2": 3600, "9": -2000 },
            ],
        };
        const info = deviceEnergyManagementInfo({ ...DISHWASHER_ATTRS, "1/152/6": forecast }, 1).forecast!;
        expect(info.consumedEnergyEstimated).to.equal(false);
        expect(info.generatedEnergyEstimated).to.equal(true);
    });

    it("times the running slot by its own clock even when the device drifts from its plan", () => {
        const forecast = {
            "1": 0,
            "2": FORECAST_START,
            // DefaultDuration says 600 s, but the device reports 900 s elapsed plus 300 s left.
            "7": [{ "2": 600, "3": 900, "4": 300 }, { "2": 600 }],
        };
        const slots = deviceEnergyManagementInfo({ ...DISHWASHER_ATTRS, "1/152/6": forecast }, 1).forecast!.slots;
        expect(slots[0].durationSeconds).to.equal(1200);
        expect(slots[1].startTime).to.equal(FORECAST_START + 1200);
    });

    it("counts a solar forecast's negative power as generation", () => {
        const forecast = deviceEnergyManagementInfo(SOLAR_ATTRS, 1).forecast!;
        expect(forecast.slots[0].nominalPowerW).to.equal(-2500);
        expect(forecast.slots[0].minPowerW).to.equal(-3000);
        expect(forecast.slots[0].maxPowerW).to.equal(-1000);
        expect(forecast.slots[0].energyWh).to.equal(-2500);
        expect(forecast.slots[1].energyWh).to.equal(-1200);
        expect(forecast.generatedEnergyWh).to.equal(3700);
        expect(forecast.consumedEnergyWh).to.equal(0);
        expect(deviceEnergyManagementInfo(SOLAR_ATTRS, 1).canGenerate).to.equal(true);
    });

    it("scales a slot cost by its decimal points and names its currency", () => {
        const costs = deviceEnergyManagementInfo(SOLAR_ATTRS, 1).forecast!.slots[1].costs;
        expect(costs).to.deep.equal([{ type: "Financial", amount: "0.1579 €" }]);
    });

    it("scales a currency-less cost without labelling it as money", () => {
        const forecast = { "2": FORECAST_START, "7": [{ "2": 3600, "13": [{ "0": 1, "1": 2500, "2": 2 }] }] };
        const costs = deviceEnergyManagementInfo({ ...SOLAR_ATTRS, "1/152/6": forecast }, 1).forecast!.slots[0].costs;
        expect(costs).to.deep.equal([{ type: "GHG emissions", amount: "25.00" }]);
    });

    it("drops a cost whose decimal points no scale can render", () => {
        const forecast = { "2": FORECAST_START, "7": [{ "2": 3600, "13": [{ "0": 0, "1": 100, "2": 200 }] }] };
        const costs = deviceEnergyManagementInfo({ ...SOLAR_ATTRS, "1/152/6": forecast }, 1).forecast!.slots[0].costs;
        expect(costs).to.deep.equal([{ type: "Financial", amount: undefined }]);
    });

    it("decodes an EVSE charging session with its shiftable window", () => {
        const info = deviceEnergyManagementInfo(EVSE_ATTRS, 1);
        const forecast = info.forecast!;
        expect(info.esaType).to.equal("EV Supply Equipment");
        expect(info.optOutState).to.equal("Local opt-out");
        expect(forecast.startTime).to.equal(FORECAST_START + 3600);
        expect(forecast.earliestStartTime).to.equal(FORECAST_START);
        expect(forecast.latestEndTime).to.equal(FORECAST_START + 28_800);
        expect(forecast.updateReason).to.equal("Grid optimization");
        expect(forecast.consumedEnergyWh).to.equal(22_200);
    });

    it("leaves every slot scheduled when the device reports no active slot", () => {
        const slots = deviceEnergyManagementInfo(EVSE_ATTRS, 1).forecast!.slots;
        expect(deviceEnergyManagementInfo(EVSE_ATTRS, 1).forecast!.activeSlotNumber).to.equal(undefined);
        expect(slots.map(slot => slot.status)).to.deep.equal(["scheduled"]);
    });

    it("decodes the adjustment limits an EVSE offers", () => {
        const slot = deviceEnergyManagementInfo(EVSE_ATTRS, 1).forecast!.slots[0];
        expect(slot.pausable).to.equal(true);
        expect(slot.minPowerAdjustmentW).to.equal(1400);
        expect(slot.maxPowerAdjustmentW).to.equal(7400);
        expect(slot.minDurationAdjustmentSeconds).to.equal(1800);
        expect(slot.maxDurationAdjustmentSeconds).to.equal(21_600);
    });

    it("treats a null forecast as no forecast", () => {
        expect(deviceEnergyManagementInfo({ ...DISHWASHER_ATTRS, "1/152/6": null }, 1).forecast).to.equal(undefined);
    });

    it("names an ESA type the spec revision does not define", () => {
        expect(deviceEnergyManagementInfo({ ...DISHWASHER_ATTRS, "1/152/0": 42 }, 1).esaType).to.equal("Unknown (42)");
    });

    it("reads the number form of power fields, which small values take on the wire", () => {
        const forecast = { "2": FORECAST_START, "7": [{ "2": 3600, "9": 750_000, "12": 750_000 }] };
        const slot = deviceEnergyManagementInfo({ ...DISHWASHER_ATTRS, "1/152/6": forecast }, 1).forecast!.slots[0];
        expect(slot.nominalPowerW).to.equal(750);
        expect(slot.energyWh).to.equal(750);
        expect(slot.energyEstimated).to.equal(false);
    });

    it("formats power in W below 10 kW and energy in kWh above 1 kWh", () => {
        expect(formatPower(180)).to.equal("180 W");
        expect(formatPower(1900)).to.equal("1900 W");
        expect(formatPower(12_500)).to.equal("12.50 kW");
        expect(formatEnergy(18)).to.equal("18 Wh");
        expect(formatEnergy(1266.67)).to.equal("1.27 kWh");
    });
});
