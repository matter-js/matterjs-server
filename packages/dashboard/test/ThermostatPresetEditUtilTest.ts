/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterNode, type MatterClient, type MatterNodeData } from "@matter-server/ws-client";
import {
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

/** Records every AtomicRequest/write_attribute call and answers them in order from `responses`. */
function fakeAtomicClient(responses: { atomic?: unknown[]; write?: unknown }) {
    const atomicRequests = new Array<Record<string, unknown>>();
    let writeValue: unknown;
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
            return Promise.resolve(atomicResponses.shift() ?? { statusCode: 0, attributeStatus: [] });
        },
        writeAttribute: (_nodeId: unknown, _path: string, value: unknown) => {
            writeValue = value;
            return Promise.resolve(
                responses.write ?? [{ Path: { EndpointId: 0, ClusterId: 513, AttributeId: 80 }, Status: 0 }],
            );
        },
    } as unknown as MatterClient;
    return { client, atomicRequests, writtenValue: () => writeValue };
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
        const edit = [toPresetEdit(preset(HANDLE_1, { scenario: 1, builtIn: true }))];

        it("begins, writes, and commits the atomic write in order", async () => {
            const { client, atomicRequests, writtenValue } = fakeAtomicClient({});
            await writeThermostatPresets(client, 1, 6, edit);
            expect(atomicRequests.map(r => r["requestType"])).to.deep.equal([0, 1]);
            expect(writtenValue()).to.deep.equal(edit);
        });

        it("throws without writing when BeginWrite fails", async () => {
            const { client, atomicRequests } = fakeAtomicClient({
                atomic: [{ statusCode: 135, attributeStatus: [{ attributeId: 80, statusCode: 135 }] }],
            });
            await expect(writeThermostatPresets(client, 1, 6, edit)).to.be.rejectedWith("ConstraintError");
            // Only the failed BeginWrite call: the write and a CommitWrite never happen, and a failed begin needs no rollback.
            expect(atomicRequests).to.have.length(1);
        });

        it("rolls back and throws when the write fails", async () => {
            const { client, atomicRequests } = fakeAtomicClient({
                write: [{ Path: { EndpointId: 6, ClusterId: 513, AttributeId: 80 }, Status: 135 }],
            });
            await expect(writeThermostatPresets(client, 1, 6, edit)).to.be.rejectedWith("ConstraintError");
            expect(atomicRequests.map(r => r["requestType"])).to.deep.equal([0, 2]);
        });

        it("throws when CommitWrite fails", async () => {
            const { client } = fakeAtomicClient({
                atomic: [
                    { statusCode: 0, attributeStatus: [] },
                    { statusCode: 1, attributeStatus: [] },
                ],
            });
            await expect(writeThermostatPresets(client, 1, 6, edit)).to.be.rejectedWith("Failure");
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
