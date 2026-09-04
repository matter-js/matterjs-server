/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterClient } from "@matter-server/ws-client";
import {
    clearChargingTargets,
    decodeChargingTargetSchedules,
    disableEvse,
    enableCharging,
    energyEvseInfo,
    getChargingTargets,
    setChargingTargets,
    startDiagnostics,
    type EditableChargingSchedule,
} from "../src/util/energy-evse.js";
import { fromLocalDateTimeInputValue, toLocalDateTimeInputValue } from "../src/util/time.js";

const FEATURE_V2X = 0b10000;
const FEATURE_SOC = 0b10;
const FEATURE_PNC = 0b100;

const BASE_ATTRS: Record<string, unknown> = {
    "1/153/0": 3, // State: PluggedInCharging
    "1/153/1": 1, // SupplyState: ChargingEnabled
    "1/153/2": 0, // FaultState: NoError
    "1/153/3": null, // ChargingEnabledUntil: no expiry
    "1/153/5": 32000, // CircuitCapacity mA
    "1/153/6": 6000, // MinimumChargeCurrent mA
    "1/153/7": 16000, // MaximumChargeCurrent mA
    "1/153/64": 42, // SessionId
    "1/153/65": 3661, // SessionDuration s
    "1/153/66": 12_345_678, // SessionEnergyCharged mWh
    "1/153/65532": 0, // FeatureMap
};

describe("energy evse util", () => {
    it("reports unsupported when the cluster is absent", () => {
        const info = energyEvseInfo({ "1/40/5": "label" }, 1);
        expect(info.supported).to.equal(false);
        expect(info.v2xSupported).to.equal(false);
    });

    it("decodes the status enums and current limits", () => {
        const info = energyEvseInfo(BASE_ATTRS, 1);
        expect(info.supported).to.equal(true);
        expect(info.state).to.equal("Plugged in, charging");
        expect(info.supplyState).to.equal("Charging enabled");
        expect(info.faultState).to.equal("No error");
        expect(info.faultActive).to.equal(false);
        expect(info.circuitCapacityA).to.equal(32);
        expect(info.minimumChargeCurrentA).to.equal(6);
        expect(info.maximumChargeCurrentA).to.equal(16);
    });

    it("gates StartDiagnostics and EnableCharging/Discharging on SupplyState", () => {
        const chargingEnabled = energyEvseInfo(BASE_ATTRS, 1); // SupplyState: ChargingEnabled (1)
        expect(chargingEnabled.diagnosticsActive).to.equal(false);
        expect(chargingEnabled.canStartDiagnostics).to.equal(false);

        const disabled = energyEvseInfo({ ...BASE_ATTRS, "1/153/1": 0 }, 1);
        expect(disabled.diagnosticsActive).to.equal(false);
        expect(disabled.canStartDiagnostics).to.equal(true);

        const diagnostics = energyEvseInfo({ ...BASE_ATTRS, "1/153/1": 4 }, 1);
        expect(diagnostics.diagnosticsActive).to.equal(true);
        expect(diagnostics.canStartDiagnostics).to.equal(false);

        const unknown = energyEvseInfo({ ...BASE_ATTRS, "1/153/1": undefined }, 1);
        expect(unknown.diagnosticsActive).to.equal(false);
        expect(unknown.canStartDiagnostics).to.equal(true);
    });

    it("flags an active fault", () => {
        const info = energyEvseInfo({ ...BASE_ATTRS, "1/153/2": 4 }, 1);
        expect(info.faultState).to.equal("Over current");
        expect(info.faultActive).to.equal(true);
    });

    it("names an unknown fault code", () => {
        const info = energyEvseInfo({ ...BASE_ATTRS, "1/153/2": 42 }, 1);
        expect(info.faultState).to.equal("Unknown (42)");
    });

    it("distinguishes a null (no expiry) charging window from one not yet reported", () => {
        const noExpiry = energyEvseInfo(BASE_ATTRS, 1);
        expect(noExpiry.chargingEnabledUntil).to.equal(null);

        const notReported = energyEvseInfo({ ...BASE_ATTRS, "1/153/3": undefined }, 1);
        expect(notReported.chargingEnabledUntil).to.equal(undefined);

        const expiring = energyEvseInfo({ ...BASE_ATTRS, "1/153/3": 946_684_900 }, 1);
        expect(expiring.chargingEnabledUntil).to.equal(946_684_900);
    });

    it("decodes an active session and converts mWh to kWh", () => {
        const info = energyEvseInfo(BASE_ATTRS, 1);
        expect(info.session?.id).to.equal(42);
        expect(info.session?.durationS).to.equal(3661);
        expect(info.session?.energyChargedKWh).to.equal(12.345678);
    });

    it("reports no session while SessionId is still null", () => {
        const info = energyEvseInfo({ ...BASE_ATTRS, "1/153/64": null }, 1);
        expect(info.session).to.equal(undefined);
    });

    it("gates V2X attributes on the V2X feature bit", () => {
        const withoutV2x = energyEvseInfo(BASE_ATTRS, 1);
        expect(withoutV2x.v2xSupported).to.equal(false);

        const withV2x = energyEvseInfo(
            { ...BASE_ATTRS, "1/153/65532": FEATURE_V2X, "1/153/4": null, "1/153/8": 20000 },
            1,
        );
        expect(withV2x.v2xSupported).to.equal(true);
        expect(withV2x.dischargingEnabledUntil).to.equal(null);
        expect(withV2x.maximumDischargeCurrentA).to.equal(20);
    });

    it("decodes charging preferences, distinguishing 'none scheduled' from a target value", () => {
        const noneScheduled = energyEvseInfo(
            { ...BASE_ATTRS, "1/153/35": null, "1/153/36": null, "1/153/37": null, "1/153/38": null },
            1,
        );
        expect(noneScheduled.nextChargeStartTime).to.equal(null);
        expect(noneScheduled.nextChargeRequiredEnergyKWh).to.equal(null);

        const scheduled = energyEvseInfo(
            { ...BASE_ATTRS, "1/153/35": 946_684_900, "1/153/37": 10_000_000, "1/153/38": 80 },
            1,
        );
        expect(scheduled.nextChargeStartTime).to.equal(946_684_900);
        expect(scheduled.nextChargeRequiredEnergyKWh).to.equal(10);
        expect(scheduled.nextChargeTargetSoC).to.equal(80);
    });

    it("gates SoC reporting attributes on the SOC feature bit", () => {
        const info = energyEvseInfo(
            { ...BASE_ATTRS, "1/153/65532": FEATURE_SOC, "1/153/48": 55, "1/153/49": 75_000_000 },
            1,
        );
        expect(info.soCReportingSupported).to.equal(true);
        expect(info.stateOfCharge).to.equal(55);
        expect(info.batteryCapacityKWh).to.equal(75);
    });

    it("gates the vehicle ID on the PlugAndCharge feature bit", () => {
        const info = energyEvseInfo({ ...BASE_ATTRS, "1/153/65532": FEATURE_PNC, "1/153/50": "EMAID-123" }, 1);
        expect(info.plugAndChargeSupported).to.equal(true);
        expect(info.vehicleId).to.equal("EMAID-123");
    });
});

function fakeCommandClient() {
    const calls = new Array<{ commandName: string; payload: Record<string, unknown> }>();
    let response: unknown;
    const client = {
        deviceCommand: (
            _nodeId: number | bigint,
            _endpointId: number,
            _clusterId: number,
            commandName: string,
            payload: Record<string, unknown> = {},
        ) => {
            calls.push({ commandName, payload });
            return Promise.resolve(response);
        },
    } as unknown as MatterClient;
    return { client, calls, setResponse: (value: unknown) => (response = value) };
}

describe("energy evse commands", () => {
    it("sends Disable and StartDiagnostics with no payload", async () => {
        const { client, calls } = fakeCommandClient();
        await disableEvse(client, 1, 1);
        await startDiagnostics(client, 1, 1);
        expect(calls.map(call => call.commandName)).to.deep.equal(["Disable", "StartDiagnostics"]);
        expect(calls[0]?.payload).to.deep.equal({});
    });

    it("converts EnableCharging amps to mA and passes a null expiry through", async () => {
        const { client, calls } = fakeCommandClient();
        await enableCharging(client, 1, 1, {
            chargingEnabledUntil: null,
            minimumChargeCurrentA: 6,
            maximumChargeCurrentA: 16,
        });
        expect(calls[0]?.payload).to.deep.equal({
            chargingEnabledUntil: null,
            minimumChargeCurrent: 6000,
            maximumChargeCurrent: 16000,
        });
    });

    it("sends ClearTargets with no payload", async () => {
        const { client, calls } = fakeCommandClient();
        await clearChargingTargets(client, 1, 1);
        expect(calls[0]?.commandName).to.equal("ClearTargets");
    });
});

describe("charging target schedule decoding", () => {
    it("decodes a GetTargetsResponse, keeping only the selected days", () => {
        const schedules = decodeChargingTargetSchedules({
            chargingTargetSchedules: [
                {
                    dayOfWeekForSequence: { monday: true, wednesday: true, sunday: false },
                    chargingTargets: [
                        { targetTimeMinutesPastMidnight: 360, targetSoC: 80 },
                        { targetTimeMinutesPastMidnight: 1200, addedEnergy: 10_000_000 },
                    ],
                },
            ],
        });
        expect(schedules).to.have.lengthOf(1);
        expect(schedules[0]?.days).to.deep.equal({ monday: true, wednesday: true });
        expect(schedules[0]?.targets).to.deep.equal([
            { timeMinutes: 360, targetSoC: 80, addedEnergyKWh: undefined },
            { timeMinutes: 1200, targetSoC: undefined, addedEnergyKWh: 10 },
        ]);
    });

    it("returns an empty list for a response with no schedules", () => {
        expect(decodeChargingTargetSchedules({ chargingTargetSchedules: [] })).to.deep.equal([]);
        expect(decodeChargingTargetSchedules(null)).to.deep.equal([]);
    });

    it("round-trips through setChargingTargets as named boolean days and scaled energy", async () => {
        const { client, calls } = fakeCommandClient();
        const schedules: EditableChargingSchedule[] = [
            {
                days: { saturday: true, sunday: true },
                targets: [{ timeMinutes: 480, addedEnergyKWh: 12.5 }],
            },
        ];
        await setChargingTargets(client, 1, 1, schedules);
        expect(calls[0]?.payload).to.deep.equal({
            chargingTargetSchedules: [
                {
                    dayOfWeekForSequence: { saturday: true, sunday: true },
                    chargingTargets: [{ targetTimeMinutesPastMidnight: 480, addedEnergy: 12_500_000 }],
                },
            ],
        });
    });

    it("fetches and decodes through getChargingTargets", async () => {
        const { client, setResponse } = fakeCommandClient();
        setResponse({
            chargingTargetSchedules: [
                { dayOfWeekForSequence: { friday: true }, chargingTargets: [{ targetTimeMinutesPastMidnight: 60 }] },
            ],
        });
        const schedules = await getChargingTargets(client, 1, 1);
        expect(schedules).to.deep.equal([
            { days: { friday: true }, targets: [{ timeMinutes: 60, targetSoC: undefined, addedEnergyKWh: undefined }] },
        ]);
    });
});

describe("local datetime-local <-> Matter epoch-s conversion", () => {
    it("round-trips a local datetime-local value through the Matter epoch", () => {
        const input = "2027-03-15T08:30";
        const epoch = fromLocalDateTimeInputValue(input);
        expect(epoch).to.not.equal(undefined);
        expect(toLocalDateTimeInputValue(epoch as number)).to.equal(input);
    });

    it("treats an empty or unparsable value as undefined", () => {
        expect(fromLocalDateTimeInputValue("")).to.equal(undefined);
        expect(fromLocalDateTimeInputValue("not a date")).to.equal(undefined);
    });
});
