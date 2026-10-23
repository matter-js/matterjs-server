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

const ATOMIC_STEP = ["begin", "commit", "rollback"];

/**
 * Logs every AtomicRequest, read_attribute and write_attribute call in order and answers them from `responses`.
 * `devicePresets` is the tag-keyed Presets value the device reports.
 */
function fakeAtomicClient(
    responses: { atomic?: unknown[]; write?: unknown; commitError?: Error; devicePresets?: unknown } = {},
) {
    const steps = new Array<string>();
    const atomicRequests = new Array<Record<string, unknown>>();
    const reads = new Array<{ path: unknown; fabricFiltered: unknown }>();
    let writeValue: unknown;
    let writeOptions: unknown;
    const atomicResponses = [...(responses.atomic ?? [])];
    const client = {
        deviceCommand: (
            _nodeId: unknown,
            _endpointId: unknown,
            _clusterId: unknown,
            commandName: string,
            payload: Record<string, unknown> = {},
        ) => {
            if (commandName !== "AtomicRequest") throw new Error(`unexpected command ${commandName}`);
            atomicRequests.push(payload);
            steps.push(ATOMIC_STEP[Number(payload["requestType"])]);
            if (payload["requestType"] === 1 && responses.commitError) return Promise.reject(responses.commitError);
            return Promise.resolve(
                atomicResponses.shift() ?? {
                    statusCode: 0,
                    attributeStatus: [],
                    timeout: payload["requestType"] === 0 ? payload["timeout"] : undefined,
                },
            );
        },
        readAttribute: (_nodeId: unknown, path: unknown, _timeout: unknown, fabricFiltered: unknown) => {
            steps.push("read");
            reads.push({ path, fabricFiltered });
            return Promise.resolve(
                "devicePresets" in responses && responses.devicePresets === undefined
                    ? {}
                    : { "6/513/80": responses.devicePresets ?? [{ "0": HANDLE_1, "1": 1, "5": true }] },
            );
        },
        writeAttribute: (_nodeId: unknown, _path: string, value: unknown, options: unknown) => {
            steps.push("write");
            writeValue = value;
            writeOptions = options;
            return Promise.resolve(
                responses.write ?? [{ Path: { EndpointId: 6, ClusterId: 513, AttributeId: 80 }, Status: 0 }],
            );
        },
    } as unknown as MatterClient;
    return { client, steps, atomicRequests, reads, writtenValue: () => writeValue, writeOptions: () => writeOptions };
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

        it("begins the atomic write, then reads the device's presets, writes, and commits", async () => {
            const { client, steps, reads } = fakeAtomicClient();
            await writeThermostatPresets(client, 1, 6, keepAll);
            expect(steps).to.deep.equal(["begin", "read", "write", "commit"]);
            expect(reads).to.deep.equal([{ path: "6/513/80", fabricFiltered: true }]);
        });

        it("sends a Timeout with BeginWrite only", async () => {
            const { client, atomicRequests } = fakeAtomicClient();
            await writeThermostatPresets(client, 1, 6, keepAll);
            expect(atomicRequests.map(r => r["timeout"])).to.deep.equal([5000, undefined]);
        });

        it("sends the write as a timed write", async () => {
            const { client, writeOptions } = fakeAtomicClient();
            await writeThermostatPresets(client, 1, 6, keepAll);
            expect(writeOptions()).to.deep.equal({ timedRequestTimeoutMs: 3000 });
        });

        it("builds the written list from the presets the device reports", async () => {
            const { client, writtenValue } = fakeAtomicClient({
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
            const { client, writtenValue } = fakeAtomicClient();
            await writeThermostatPresets(client, 1, 6, () => [
                toPresetEdit(preset(HANDLE_1, { scenario: 1, heatingSetpoint: 2000, builtIn: true })),
                { ...toPresetEdit(preset(HANDLE_1, { scenario: 3, coolingSetpoint: 2600 })), presetHandle: null },
            ]);
            expect(writtenValue()).to.deep.equal([
                { "0": HANDLE_1, "1": 1, "4": 2000, "5": true },
                { "0": null, "1": 3, "3": 2600, "5": false },
            ]);
        });

        const beginWithSharedAttribute = {
            statusCode: 0,
            attributeStatus: [
                { attributeId: 80, statusCode: 0 },
                { attributeId: 81, statusCode: 0 },
            ],
        };

        it("commits the attribute set BeginWrite returned", async () => {
            const { client, atomicRequests } = fakeAtomicClient({ atomic: [beginWithSharedAttribute] });
            await writeThermostatPresets(client, 1, 6, keepAll);
            expect(atomicRequests.map(r => r["attributeRequests"])).to.deep.equal([[80], [80, 81]]);
        });

        it("rolls back the attribute set BeginWrite returned", async () => {
            const { client, steps, atomicRequests } = fakeAtomicClient({
                atomic: [beginWithSharedAttribute],
                write: [{ Path: { EndpointId: 6, ClusterId: 513, AttributeId: 80 }, Status: 135 }],
            });
            await expect(writeThermostatPresets(client, 1, 6, keepAll)).to.be.rejectedWith("ConstraintError");
            expect(steps).to.deep.equal(["begin", "read", "write", "rollback"]);
            expect(atomicRequests.map(r => r["attributeRequests"])).to.deep.equal([[80], [80, 81]]);
        });

        it("throws without writing when BeginWrite fails", async () => {
            const { client, steps, writtenValue } = fakeAtomicClient({
                atomic: [{ statusCode: 1, attributeStatus: [{ attributeId: 80, statusCode: 0x9c }] }],
            });
            await expect(writeThermostatPresets(client, 1, 6, keepAll)).to.be.rejectedWith("(156)");
            // A failed begin leaves no atomic write state on the device, so there is nothing to roll back.
            expect(steps).to.deep.equal(["begin"]);
            expect(writtenValue()).to.equal(undefined);
        });

        it("rolls back without writing when building the list throws", async () => {
            const { client, steps } = fakeAtomicClient();
            await expect(
                writeThermostatPresets(client, 1, 6, () => {
                    throw new Error("name taken");
                }),
            ).to.be.rejectedWith("name taken");
            expect(steps).to.deep.equal(["begin", "read", "rollback"]);
        });

        it("rolls back without writing when the read carries no Presets value", async () => {
            const { client, steps } = fakeAtomicClient({ devicePresets: undefined });
            await expect(writeThermostatPresets(client, 1, 6, keepAll)).to.be.rejectedWith("did not report");
            expect(steps).to.deep.equal(["begin", "read", "rollback"]);
        });

        it("rolls back without reading or writing when the device grants too short a window", async () => {
            const { client, steps, atomicRequests } = fakeAtomicClient({
                atomic: [{ statusCode: 0, attributeStatus: [{ attributeId: 80, statusCode: 0 }], timeout: 1999 }],
            });
            await expect(writeThermostatPresets(client, 1, 6, keepAll)).to.be.rejectedWith("only 1999 ms");
            expect(steps).to.deep.equal(["begin", "rollback"]);
            expect(atomicRequests.map(r => r["attributeRequests"])).to.deep.equal([[80], [80]]);
        });

        it("proceeds when the BeginWrite response carries no Timeout", async () => {
            const { client, steps } = fakeAtomicClient({
                atomic: [{ statusCode: 0, attributeStatus: [{ attributeId: 80, statusCode: 0 }] }],
            });
            await writeThermostatPresets(client, 1, 6, keepAll);
            expect(steps).to.deep.equal(["begin", "read", "write", "commit"]);
        });

        it("accepts a window at the minimum", async () => {
            const { client, steps } = fakeAtomicClient({
                atomic: [{ statusCode: 0, attributeStatus: [{ attributeId: 80, statusCode: 0 }], timeout: 2000 }],
            });
            await writeThermostatPresets(client, 1, 6, keepAll);
            expect(steps).to.deep.equal(["begin", "read", "write", "commit"]);
        });

        it("keeps a preset only the device reports when adding one", async () => {
            const { client, writtenValue } = fakeAtomicClient({
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

        it("throws without a rollback when CommitWrite reports a failure", async () => {
            const { client, steps } = fakeAtomicClient({
                atomic: [
                    { statusCode: 0, attributeStatus: [] },
                    { statusCode: 1, attributeStatus: [{ attributeId: 80, statusCode: 0x92 }] },
                ],
            });
            await expect(writeThermostatPresets(client, 1, 6, keepAll)).to.be.rejectedWith("(146)");
            // The device discards the pending write itself when a commit fails.
            expect(steps).to.deep.equal(["begin", "read", "write", "commit"]);
        });

        it("rolls back and rethrows when the CommitWrite invoke itself fails", async () => {
            const { client, steps } = fakeAtomicClient({ commitError: new Error("connection lost") });
            await expect(writeThermostatPresets(client, 1, 6, keepAll)).to.be.rejectedWith("connection lost");
            expect(steps).to.deep.equal(["begin", "read", "write", "commit", "rollback"]);
        });
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
