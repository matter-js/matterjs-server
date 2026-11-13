/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterNode, type MatterClient, type MatterNodeData } from "@matter-server/ws-client";
import {
    applyPresetEdit,
    formatSetpointInput,
    isPresetUsedBySchedule,
    parseSetpointInput,
    presetNameConflict,
    presetTypeSupportsNames,
    readNumberOfPresets,
    readPresetTypes,
    setActivePreset,
    toPresetEdit,
    writeThermostatPresets,
} from "../src/util/thermostat-preset-edit.js";
import type { ThermostatPreset } from "../src/util/thermostat-schedule.js";

function node(attributes: Record<string, unknown>, node_id: number | bigint = 1): MatterNode {
    const data: MatterNodeData = {
        node_id,
        date_commissioned: "",
        last_interview: "",
        interview_version: 1,
        available: true,
        is_bridge: false,
        attributes,
        attribute_subscriptions: [],
    };
    return new MatterNode(data);
}

// Single-byte preset handle, base64-encoded (0x01 -> "AQ==").
const HANDLE_1 = "AQ==";

function preset(handle: string, overrides: Partial<ThermostatPreset> = {}): ThermostatPreset {
    return {
        handle,
        scenario: null,
        name: null,
        coolingSetpoint: null,
        heatingSetpoint: null,
        builtIn: null,
        ...overrides,
    };
}

const HANDLE_2 = "Ag==";

/**
 * Logs every read and write_atomic_attribute call in order and answers them from `responses`.
 * `devicePresets` is the tag-keyed Presets value the device reports, `dataVersion` the thermostat cluster's version.
 */
/** `write` answers the writes in order; a write past its end succeeds. */
function fakePresetsClient(
    responses: { write?: unknown[]; devicePresets?: unknown; dataVersion?: number | null } = {},
) {
    const writeAnswers = [...(responses.write ?? [])];
    const steps = new Array<string>();
    const reads = new Array<unknown>();
    const writes = new Array<{ path: unknown; value: unknown; dataVersion: unknown }>();
    const client = {
        read: (args: unknown) => {
            steps.push("read");
            reads.push(args);
            const dataVersion = responses.dataVersion === undefined ? 42 : responses.dataVersion;
            return Promise.resolve({
                attributes:
                    "devicePresets" in responses && responses.devicePresets === undefined
                        ? {}
                        : { "6/513/80": responses.devicePresets ?? [{ "0": HANDLE_1, "1": 1, "5": true }] },
                events: [],
                data_versions: dataVersion === null ? {} : { "6/513": dataVersion },
            });
        },
        writeAtomicAttribute: (_nodeId: unknown, path: unknown, value: unknown, dataVersion: unknown) => {
            steps.push("write");
            writes.push({ path, value, dataVersion });
            return Promise.resolve(
                writeAnswers.shift() ?? [{ Path: { EndpointId: 6, ClusterId: 513, AttributeId: 80 }, Status: 0 }],
            );
        },
    } as unknown as MatterClient;
    return { client, steps, reads, writes, writtenValue: () => writes[0]?.value };
}

describe("thermostat-preset-edit util", () => {
    describe("readPresetTypes", () => {
        it("decodes tag-keyed PresetTypeStruct entries, including the SupportsNames bit", () => {
            const types = readPresetTypes(
                node({
                    "6/513/72": [
                        { "0": 1, "1": 1, "2": 0 },
                        { "0": 254, "1": 2, "2": 0x2 },
                    ],
                }),
                6,
            );
            expect(types).to.deep.equal([
                { scenario: 1, numberOfPresets: 1, supportsNames: false },
                { scenario: 254, numberOfPresets: 2, supportsNames: true },
            ]);
        });

        it("returns undefined when the attribute is not cached", () => {
            expect(readPresetTypes(node({}), 6)).to.equal(undefined);
        });
    });

    describe("readNumberOfPresets", () => {
        it("reads the total preset limit, or null when not cached", () => {
            expect(readNumberOfPresets(node({ "6/513/74": 5 }), 6)).to.equal(5);
            expect(readNumberOfPresets(node({}), 6)).to.equal(null);
        });
    });

    describe("presetTypeSupportsNames", () => {
        const types = [
            { scenario: 1, numberOfPresets: 1, supportsNames: false },
            { scenario: 3, numberOfPresets: 1, supportsNames: true },
        ];

        it("follows the matching PresetType's SupportsNames bit", () => {
            expect(presetTypeSupportsNames(types, 3)).to.equal(true);
            expect(presetTypeSupportsNames(types, 1)).to.equal(false);
        });

        it("is false for a scenario PresetTypes does not list", () => {
            expect(presetTypeSupportsNames(types, 2)).to.equal(false);
            expect(presetTypeSupportsNames(types, null)).to.equal(false);
        });
    });

    describe("setpoint input", () => {
        it("round-trips a centidegree value through the input text unchanged", () => {
            expect(formatSetpointInput(2004)).to.equal("20.04");
            expect(parseSetpointInput(formatSetpointInput(2004), null)).to.equal(2004);
            expect(parseSetpointInput(formatSetpointInput(-150), null)).to.equal(-150);
        });

        it("formats a missing setpoint as blank", () => {
            expect(formatSetpointInput(null)).to.equal("");
        });

        it("rounds away float artifacts of the °C to centidegree conversion", () => {
            expect(parseSetpointInput("0.07", null)).to.equal(7);
        });

        it("keeps the fallback for blank or unparsable input", () => {
            expect(parseSetpointInput("", 2000)).to.equal(2000);
            expect(parseSetpointInput("abc", null)).to.equal(null);
        });
    });

    describe("applyPresetEdit", () => {
        const namedType = [{ scenario: 3, numberOfPresets: 2, supportsNames: true }];
        const unnamedType = [{ scenario: 3, numberOfPresets: 2, supportsNames: false }];
        const sleep = preset(HANDLE_1, { scenario: 3, name: "Night", heatingSetpoint: 1804, builtIn: true });

        it("takes the trimmed name when the scenario supports names, and clears it when blank", () => {
            const input = { heating: "", cooling: "" };
            expect(applyPresetEdit(sleep, namedType, { ...input, name: "  Nap " }).name).to.equal("Nap");
            expect(applyPresetEdit(sleep, namedType, { ...input, name: "  " }).name).to.equal(null);
        });

        it("keeps the existing name when the scenario does not support names", () => {
            const edit = applyPresetEdit(sleep, unnamedType, { name: "Nap", heating: "", cooling: "" });
            expect(edit.name).to.equal("Night");
        });

        it("sets a setpoint the preset did not have, and keeps one left blank", () => {
            const edit = applyPresetEdit(sleep, namedType, { name: "Night", heating: "", cooling: "25.5" });
            expect(edit).to.deep.include({ heatingSetpoint: 1804, coolingSetpoint: 2550 });
        });

        it("keeps handle, scenario and the builtIn flag", () => {
            const edit = applyPresetEdit(sleep, namedType, { name: "Night", heating: "19", cooling: "" });
            expect(edit).to.deep.include({ presetHandle: HANDLE_1, presetScenario: 3, builtIn: true });
        });
    });

    describe("presetNameConflict", () => {
        const presets = [
            preset(HANDLE_1, { scenario: 3, name: "Night" }),
            preset(HANDLE_2, { scenario: 3, name: null }),
        ];

        it("accepts a name no other preset of the scenario uses", () => {
            expect(presetNameConflict(presets, 3, "Nap", null)).to.equal(null);
            expect(presetNameConflict(presets, 1, null, null)).to.equal(null);
        });

        it("rejects a name or a missing name another preset of the scenario already has", () => {
            expect(presetNameConflict(presets, 3, "Night", null)).to.include('named "Night"');
            expect(presetNameConflict(presets, 3, null, null)).to.include("no name");
        });

        it("ignores the preset being edited", () => {
            expect(presetNameConflict(presets, 3, "Night", HANDLE_1)).to.equal(null);
        });

        it("requires a name for a user-defined preset", () => {
            expect(presetNameConflict([], 254, null, null)).to.include("needs a name");
        });
    });

    describe("isPresetUsedBySchedule", () => {
        const schedule = (presetHandle: string | null, transitionHandle: string | null) => ({
            handle: "AQ==",
            systemMode: 4,
            name: null,
            presetHandle,
            transitions: [
                {
                    dayOfWeek: 1,
                    transitionTimeMin: 0,
                    presetHandle: transitionHandle,
                    systemMode: null,
                    coolingSetpoint: null,
                    heatingSetpoint: null,
                },
            ],
            builtIn: null,
        });

        it("finds a preset referenced by a schedule transition", () => {
            expect(isPresetUsedBySchedule([schedule(null, HANDLE_1)], HANDLE_1)).to.equal(true);
        });

        it("ignores a schedule's own PresetHandle, which does not block removal", () => {
            expect(isPresetUsedBySchedule([schedule(HANDLE_1, HANDLE_2)], HANDLE_1)).to.equal(false);
        });
    });

    describe("toPresetEdit", () => {
        it("maps a decoded preset to the wire-ready shape", () => {
            const p = preset(HANDLE_1, { scenario: 1, name: "Night", coolingSetpoint: 2600, heatingSetpoint: 2000 });
            expect(toPresetEdit(p)).to.deep.equal({
                presetHandle: HANDLE_1,
                presetScenario: 1,
                name: "Night",
                coolingSetpoint: 2600,
                heatingSetpoint: 2000,
                builtIn: false,
            });
        });

        it("defaults a missing scenario to 0 and a null builtIn to false", () => {
            expect(toPresetEdit(preset(HANDLE_1))).to.deep.include({ presetScenario: 0, builtIn: false });
        });
    });

    describe("writeThermostatPresets", () => {
        const keepAll = (current: ThermostatPreset[]) => current.map(toPresetEdit);

        it("reads the presets with their data version, then writes them with write_atomic_attribute", async () => {
            const { client, steps, reads, writes } = fakePresetsClient();
            await writeThermostatPresets(client, 1, 6, keepAll);
            expect(steps).to.deep.equal(["read", "write"]);
            expect(reads).to.deep.equal([{ node_id: 1, attribute_paths: ["6/513/80"] }]);
            expect(writes.map(({ path, dataVersion }) => ({ path, dataVersion }))).to.deep.equal([
                { path: "6/513/80", dataVersion: 42 },
            ]);
        });

        it("builds the written list from the presets the device reports", async () => {
            const { client, writtenValue } = fakePresetsClient({
                devicePresets: [
                    { "0": HANDLE_1, "1": 1, "5": true },
                    { "0": HANDLE_2, "1": 3, "2": "Night", "5": false },
                ],
            });
            const seen = new Array<string>();
            await writeThermostatPresets(client, 1, 6, current => {
                seen.push(...current.map(p => p.handle));
                return current.filter(p => p.handle !== HANDLE_1).map(toPresetEdit);
            });
            expect(seen).to.deep.equal([HANDLE_1, HANDLE_2]);
            expect(writtenValue()).to.deep.equal([{ "0": HANDLE_2, "1": 3, "2": "Night", "5": false }]);
        });

        it("writes tag-keyed PresetStructs and omits a missing name and setpoint", async () => {
            const { client, writtenValue } = fakePresetsClient();
            await writeThermostatPresets(client, 1, 6, () => [
                toPresetEdit(preset(HANDLE_1, { scenario: 1, heatingSetpoint: 2000, builtIn: true })),
                { ...toPresetEdit(preset(HANDLE_1, { scenario: 3, coolingSetpoint: 2600 })), presetHandle: null },
            ]);
            expect(writtenValue()).to.deep.equal([
                { "0": HANDLE_1, "1": 1, "4": 2000, "5": true },
                { "0": null, "1": 3, "3": 2600, "5": false },
            ]);
        });

        it("keeps a preset only the device reports when adding one", async () => {
            const { client, writtenValue } = fakePresetsClient({
                devicePresets: [
                    { "0": HANDLE_1, "1": 1, "5": true },
                    { "0": HANDLE_2, "1": 3, "2": "Theirs", "5": false },
                ],
            });
            await writeThermostatPresets(client, 1, 6, current => [
                ...current.map(toPresetEdit),
                { ...toPresetEdit(preset(HANDLE_1, { scenario: 3, name: "Mine" })), presetHandle: null },
            ]);
            expect(writtenValue()).to.deep.equal([
                { "0": HANDLE_1, "1": 1, "5": true },
                { "0": HANDLE_2, "1": 3, "2": "Theirs", "5": false },
                { "0": null, "1": 3, "2": "Mine", "5": false },
            ]);
        });

        for (const [status, message] of [
            [0x87, "Writing presets failed: ConstraintError (135)"],
            [
                0x92,
                "Writing presets failed: the thermostat changed since its presets were read, try again (DataVersionMismatch, 146)",
            ],
            [0x9c, "Writing presets failed: another change of the presets is still running, try again (Busy, 156)"],
            [0xcb, "Writing presets failed: the thermostat ended or refused the edit, try again (InvalidInState, 203)"],
        ] as const) {
            it(`throws "${message}" for status ${status}`, async () => {
                const failed = [{ Path: { EndpointId: 6, ClusterId: 513, AttributeId: 80 }, Status: status }];
                const { client } = fakePresetsClient({ write: [failed, failed] });
                await expect(writeThermostatPresets(client, 1, 6, keepAll)).to.be.rejectedWith(message);
            });
        }

        it("writes nothing when building the list throws", async () => {
            const { client, steps } = fakePresetsClient();
            await expect(
                writeThermostatPresets(client, 1, 6, () => {
                    throw new Error("name taken");
                }),
            ).to.be.rejectedWith("name taken");
            expect(steps).to.deep.equal(["read"]);
        });

        it("reads and writes once more after a DATA_VERSION_MISMATCH", async () => {
            const mismatch = [{ Path: { EndpointId: 6, ClusterId: 513, AttributeId: 80 }, Status: 146 }];
            const { client, steps } = fakePresetsClient({ write: [mismatch] });
            await writeThermostatPresets(client, 1, 6, keepAll);
            expect(steps).to.deep.equal(["read", "write", "read", "write"]);
        });

        it("does not try again after another failure", async () => {
            const busy = [{ Path: { EndpointId: 6, ClusterId: 513, AttributeId: 80 }, Status: 156 }];
            const { client, steps } = fakePresetsClient({ write: [busy] });
            await expect(writeThermostatPresets(client, 1, 6, keepAll)).to.be.rejectedWith("(Busy, 156)");
            expect(steps).to.deep.equal(["read", "write"]);
        });

        for (const [label, responses] of [
            ["no Presets value", { devicePresets: undefined }],
            ["no data version", { dataVersion: null }],
        ] as const) {
            it(`writes nothing when the read carries ${label}`, async () => {
                const { client, steps } = fakePresetsClient(responses);
                await expect(writeThermostatPresets(client, 1, 6, keepAll)).to.be.rejectedWith("did not report");
                expect(steps).to.deep.equal(["read"]);
            });
        }
    });

    describe("setActivePreset", () => {
        it("invokes SetActivePresetRequest with the given handle", async () => {
            const calls = new Array<Record<string, unknown>>();
            const client = {
                deviceCommand: (
                    _nodeId: unknown,
                    _endpointId: unknown,
                    _clusterId: unknown,
                    commandName: string,
                    payload: Record<string, unknown> = {},
                ) => {
                    expect(commandName).to.equal("SetActivePresetRequest");
                    calls.push(payload);
                    return Promise.resolve(undefined);
                },
            } as unknown as MatterClient;
            await setActivePreset(client, 1, 6, HANDLE_1);
            expect(calls).to.deep.equal([{ presetHandle: HANDLE_1 }]);
        });
    });
});
