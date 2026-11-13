/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeId } from "@matter/main";
import { EndpointNumber, Status } from "@matter/main/types";
import {
    clearThermostatPreset,
    setActivePreset,
    setThermostatPreset,
    type ThermostatPresetHandler,
} from "../src/controller/ThermostatPresets.js";
import {
    AttributeResponseStatus,
    AttributesData,
    InvokeRequest,
    WriteAttributeRequest,
} from "../src/types/CommandHandler.js";

const NODE_ID = NodeId(1);
const ENDPOINT = EndpointNumber(1);
const THERMOSTAT_CLUSTER_ID = 513;
const ATTR_PRESET_TYPES = 0x48;
const ATTR_ACTIVE_PRESET_HANDLE = 0x4e;
const ATTR_PRESETS = 0x50;
const ATTR_SCHEDULES = 0x51;

function path(attributeId: number): string {
    return `${ENDPOINT}/${THERMOSTAT_CLUSTER_ID}/${attributeId}`;
}

/** PresetTypeFeaturesBitmap bit 1 (§4.3.10.3). */
const SUPPORTS_NAMES = 0x2;

function presetType(scenario: number, numberOfPresets: number, supportsNames = true): Record<string, unknown> {
    return { "0": scenario, "1": numberOfPresets, "2": supportsNames ? SUPPORTS_NAMES : 0 };
}

function preset(
    handle: string,
    scenario: number,
    opts: { name?: string | null; heating?: number | null; cooling?: number | null; builtIn?: boolean } = {},
): Record<string, unknown> {
    const struct: Record<string, unknown> = { "0": handle, "1": scenario, "5": opts.builtIn ?? false };
    if (opts.name !== undefined && opts.name !== null) struct["2"] = opts.name;
    if (opts.cooling !== undefined && opts.cooling !== null) struct["3"] = opts.cooling;
    if (opts.heating !== undefined && opts.heating !== null) struct["4"] = opts.heating;
    return struct;
}

type RecordedCall =
    | { kind: "invoke"; commandName: string; data: unknown }
    | { kind: "read"; paths: string[] }
    | { kind: "write"; value: unknown };

/** A minimal device double: answers the atomic-write handshake and the attribute reads/writes it drives. */
class FakeThermostat implements ThermostatPresetHandler {
    calls: RecordedCall[] = [];

    presetTypes: Record<string, unknown>[] = [];
    presets: Record<string, unknown>[] = [];
    activePresetHandle: string | null = null;
    schedules: Record<string, unknown>[] = [];

    beginStatus = 0;
    beginTimeout: number | null = null;
    beginAttributeStatus: Array<{ attributeId: number; statusCode: number }> = [];
    commitStatus = 0;
    writeStatus: Status = Status.Success;
    reportPresets = true;

    async handleInvoke(data: InvokeRequest): Promise<unknown> {
        this.calls.push({ kind: "invoke", commandName: data.commandName, data: data.data });
        if (data.commandName === "AtomicRequest") {
            const { requestType } = data.data as { requestType: number };
            if (requestType === 0) {
                return {
                    statusCode: this.beginStatus,
                    attributeStatus: this.beginAttributeStatus,
                    timeout: this.beginTimeout,
                };
            }
            if (requestType === 1) {
                return { statusCode: this.commitStatus, attributeStatus: [] };
            }
            return { statusCode: 0, attributeStatus: [] };
        }
        if (data.commandName === "SetActivePresetRequest") {
            return undefined;
        }
        throw new Error(`FakeThermostat: unexpected command ${data.commandName}`);
    }

    async handleReadAttributes(_nodeId: NodeId, paths: string[]): Promise<AttributesData> {
        this.calls.push({ kind: "read", paths });
        const result: AttributesData = {};
        for (const p of paths) {
            if (p === path(ATTR_PRESET_TYPES)) result[p] = this.presetTypes;
            else if (p === path(ATTR_PRESETS)) {
                if (this.reportPresets) result[p] = this.presets;
            } else if (p === path(ATTR_ACTIVE_PRESET_HANDLE)) {
                if (this.activePresetHandle !== null) result[p] = this.activePresetHandle;
            } else if (p === path(ATTR_SCHEDULES)) result[p] = this.schedules;
        }
        return result;
    }

    async handleWriteAttribute(data: WriteAttributeRequest): Promise<AttributeResponseStatus[]> {
        this.calls.push({ kind: "write", value: data.value });
        if (this.writeStatus === Status.Success) this.presets = data.value as Record<string, unknown>[];
        return [
            {
                endpointId: data.endpointId ?? ENDPOINT,
                clusterId: data.clusterId,
                attributeId: data.attributeId,
                status: this.writeStatus,
            },
        ];
    }

    /** The AtomicRequest.requestType of every invoke, in order. */
    atomicSequence(): number[] {
        return this.calls
            .filter(
                (c): c is RecordedCall & { kind: "invoke" } => c.kind === "invoke" && c.commandName === "AtomicRequest",
            )
            .map(c => (c.data as { requestType: number }).requestType);
    }
}

describe("setThermostatPreset", () => {
    it("adds a new preset, writing the full list with the addition appended", async () => {
        const device = new FakeThermostat();
        device.presetTypes = [presetType(1, 4), presetType(254, 4)];
        device.presets = [preset("h1", 1, { name: "Home", heating: 2000, builtIn: true })];

        await setThermostatPreset(device, {
            nodeId: NODE_ID,
            endpointId: ENDPOINT,
            presetHandle: null,
            presetScenario: 254,
            name: "Eco",
            heatingSetpoint: 1800,
        });

        expect(device.atomicSequence()).to.deep.equal([0, 1]); // BeginWrite, CommitWrite
        const written = device.calls.find(c => c.kind === "write") as { kind: "write"; value: unknown };
        expect(written.value).to.deep.equal([
            preset("h1", 1, { name: "Home", heating: 2000, builtIn: true }),
            { "0": null, "1": 254, "2": "Eco", "4": 1800, "5": false },
        ]);
    });

    it("edits an existing preset, keeping omitted fields and applying given ones", async () => {
        const device = new FakeThermostat();
        device.presetTypes = [presetType(1, 4)];
        device.presets = [preset("h1", 1, { name: "Home", heating: 2000, cooling: 2600, builtIn: true })];

        await setThermostatPreset(device, {
            nodeId: NODE_ID,
            endpointId: ENDPOINT,
            presetHandle: "h1",
            heatingSetpoint: 2100,
            // name and coolingSetpoint omitted: must be kept
        });

        const written = device.calls.find(c => c.kind === "write") as { kind: "write"; value: unknown };
        expect(written.value).to.deep.equal([
            preset("h1", 1, { name: "Home", heating: 2100, cooling: 2600, builtIn: true }),
        ]);
    });

    it("clears a preset's name with an explicit null where the scenario supports names", async () => {
        const device = new FakeThermostat();
        device.presetTypes = [presetType(1, 4, true)];
        device.presets = [preset("h1", 1, { name: "Home" })];

        await setThermostatPreset(device, { nodeId: NODE_ID, endpointId: ENDPOINT, presetHandle: "h1", name: null });

        const written = device.calls.find(c => c.kind === "write") as { kind: "write"; value: unknown };
        expect(written.value).to.deep.equal([preset("h1", 1, { name: null })]);
    });

    it("drops the name instead of sending an explicit null for a scenario without names", async () => {
        const device = new FakeThermostat();
        device.presetTypes = [presetType(1, 4, false)];
        device.presets = [preset("h1", 1, {})];

        await setThermostatPreset(device, { nodeId: NODE_ID, endpointId: ENDPOINT, presetHandle: "h1", name: "Nope" });

        const written = device.calls.find(c => c.kind === "write") as { kind: "write"; value: unknown };
        expect((written.value as Array<Record<string, unknown>>)[0]).to.not.have.property("2");
    });

    it("refuses preset_scenario together with an existing preset's handle, before touching the device", async () => {
        const device = new FakeThermostat();

        await expect(
            setThermostatPreset(device, {
                nodeId: NODE_ID,
                endpointId: ENDPOINT,
                presetHandle: "h1",
                presetScenario: 1,
            }),
        ).rejectedWith("preset_scenario cannot be changed");
        expect(device.calls).to.deep.equal([]);
    });

    it("requires preset_scenario to add a preset, and rolls back", async () => {
        const device = new FakeThermostat();

        await expect(
            setThermostatPreset(device, { nodeId: NODE_ID, endpointId: ENDPOINT, presetHandle: null }),
        ).rejectedWith("preset_scenario is required");
        expect(device.atomicSequence()).to.deep.equal([0, 2]); // BeginWrite, RollbackWrite
    });

    it("refuses a new preset once the scenario's limit is reached, and rolls back", async () => {
        const device = new FakeThermostat();
        device.presetTypes = [presetType(1, 1)];
        device.presets = [preset("h1", 1, { builtIn: true })];

        await expect(
            setThermostatPreset(device, {
                nodeId: NODE_ID,
                endpointId: ENDPOINT,
                presetHandle: null,
                presetScenario: 1,
            }),
        ).rejectedWith("does not allow more presets");
        expect(device.atomicSequence()).to.deep.equal([0, 2]);
    });

    it("refuses a UserDefined preset without a name", async () => {
        const device = new FakeThermostat();
        device.presetTypes = [presetType(254, 4)];

        await expect(
            setThermostatPreset(device, {
                nodeId: NODE_ID,
                endpointId: ENDPOINT,
                presetHandle: null,
                presetScenario: 254,
            }),
        ).rejectedWith("needs a name");
    });

    it("refuses a name already used by another preset of the same scenario", async () => {
        const device = new FakeThermostat();
        device.presetTypes = [presetType(1, 4)];
        device.presets = [preset("h1", 1, { name: "Home", builtIn: true }), preset("h2", 2, { name: "Away" })];

        await expect(
            setThermostatPreset(device, {
                nodeId: NODE_ID,
                endpointId: ENDPOINT,
                presetHandle: null,
                presetScenario: 1,
                name: "Home",
            }),
        ).rejectedWith('already named "Home"');
    });

    it("refuses editing a handle the device no longer reports, and rolls back", async () => {
        const device = new FakeThermostat();
        device.presets = [preset("h1", 1, { builtIn: true })];

        await expect(
            setThermostatPreset(device, { nodeId: NODE_ID, endpointId: ENDPOINT, presetHandle: "missing" }),
        ).rejectedWith("no longer exists");
        expect(device.atomicSequence()).to.deep.equal([0, 2]);
    });

    it("does not roll back when BeginWrite itself is refused", async () => {
        const device = new FakeThermostat();
        device.beginStatus = 1; // any non-success Matter status

        await expect(
            setThermostatPreset(device, {
                nodeId: NODE_ID,
                endpointId: ENDPOINT,
                presetHandle: null,
                presetScenario: 1,
            }),
        ).rejectedWith("Could not start editing presets");
        expect(device.atomicSequence()).to.deep.equal([0]); // no RollbackWrite: nothing pending to discard
    });

    it("rolls back a BeginWrite window too short to use", async () => {
        const device = new FakeThermostat();
        device.beginTimeout = 1_000; // below the 2s minimum

        await expect(
            setThermostatPreset(device, {
                nodeId: NODE_ID,
                endpointId: ENDPOINT,
                presetHandle: null,
                presetScenario: 1,
            }),
        ).rejectedWith("too short to write them");
        expect(device.atomicSequence()).to.deep.equal([0, 2]);
        expect(device.calls.some(c => c.kind === "write")).to.equal(false);
    });

    it("rolls back when the device does not report Presets inside the write window", async () => {
        const device = new FakeThermostat();
        device.presetTypes = [presetType(1, 4)];
        device.reportPresets = false;

        await expect(
            setThermostatPreset(device, {
                nodeId: NODE_ID,
                endpointId: ENDPOINT,
                presetHandle: null,
                presetScenario: 1,
            }),
        ).rejectedWith("did not report its presets");
        expect(device.atomicSequence()).to.deep.equal([0, 2]);
    });

    it("rolls back when the Presets write itself fails", async () => {
        const device = new FakeThermostat();
        device.presetTypes = [presetType(1, 4)];
        device.writeStatus = Status.Failure;

        await expect(
            setThermostatPreset(device, {
                nodeId: NODE_ID,
                endpointId: ENDPOINT,
                presetHandle: null,
                presetScenario: 1,
            }),
        ).rejectedWith("Writing presets failed");
        expect(device.atomicSequence()).to.deep.equal([0, 2]);
    });

    it("does not roll back a failed commit: the device already discarded the pending write", async () => {
        const device = new FakeThermostat();
        device.presetTypes = [presetType(1, 4)];
        device.commitStatus = 1;

        await expect(
            setThermostatPreset(device, {
                nodeId: NODE_ID,
                endpointId: ENDPOINT,
                presetHandle: null,
                presetScenario: 1,
            }),
        ).rejectedWith("Could not commit preset changes");
        expect(device.atomicSequence()).to.deep.equal([0, 1]); // no RollbackWrite after a failed CommitWrite
    });

    it("names every attribute the device added to the atomic window on CommitWrite", async () => {
        const device = new FakeThermostat();
        device.presetTypes = [presetType(1, 4)];
        device.beginAttributeStatus = [
            { attributeId: ATTR_PRESETS, statusCode: 0 },
            { attributeId: ATTR_SCHEDULES, statusCode: 0 },
        ];

        await setThermostatPreset(device, {
            nodeId: NODE_ID,
            endpointId: ENDPOINT,
            presetHandle: null,
            presetScenario: 1,
        });

        const atomicInvokes = device.calls.filter(
            (c): c is RecordedCall & { kind: "invoke" } => c.kind === "invoke" && c.commandName === "AtomicRequest",
        );
        const commit = atomicInvokes.find(c => (c.data as { requestType: number }).requestType === 1);
        expect(commit).to.not.equal(undefined);
        expect((commit!.data as { attributeRequests: number[] }).attributeRequests).to.deep.equal([
            ATTR_PRESETS,
            ATTR_SCHEDULES,
        ]);
    });
});

describe("clearThermostatPreset", () => {
    it("removes a preset, writing the list without it", async () => {
        const device = new FakeThermostat();
        device.presets = [preset("h1", 1, { builtIn: true }), preset("h2", 254, { name: "Eco" })];

        await clearThermostatPreset(device, { nodeId: NODE_ID, endpointId: ENDPOINT, presetHandle: "h2" });

        const written = device.calls.find(c => c.kind === "write") as { kind: "write"; value: unknown };
        expect(written.value).to.deep.equal([preset("h1", 1, { builtIn: true })]);
    });

    it("refuses to remove a built-in preset, and rolls back", async () => {
        const device = new FakeThermostat();
        device.presets = [preset("h1", 1, { builtIn: true })];

        await expect(
            clearThermostatPreset(device, { nodeId: NODE_ID, endpointId: ENDPOINT, presetHandle: "h1" }),
        ).rejectedWith("Built-in presets cannot be removed");
        expect(device.atomicSequence()).to.deep.equal([0, 2]);
    });

    it("refuses to remove the active preset", async () => {
        const device = new FakeThermostat();
        device.presets = [preset("h1", 254, { name: "Eco" })];
        device.activePresetHandle = "h1";

        await expect(
            clearThermostatPreset(device, { nodeId: NODE_ID, endpointId: ENDPOINT, presetHandle: "h1" }),
        ).rejectedWith("active preset cannot be removed");
    });

    it("refuses to remove a preset a schedule's default PresetHandle uses", async () => {
        const device = new FakeThermostat();
        device.presets = [preset("h1", 254, { name: "Eco" })];
        device.schedules = [{ "0": "s1", "1": 4, "3": "h1", "4": [] }];

        await expect(
            clearThermostatPreset(device, { nodeId: NODE_ID, endpointId: ENDPOINT, presetHandle: "h1" }),
        ).rejectedWith("A schedule uses this preset");
    });

    it("refuses to remove a preset a schedule transition uses", async () => {
        const device = new FakeThermostat();
        device.presets = [preset("h1", 254, { name: "Eco" })];
        device.schedules = [{ "0": "s1", "1": 4, "4": [{ "0": 1, "1": 0, "2": "h1" }] }];

        await expect(
            clearThermostatPreset(device, { nodeId: NODE_ID, endpointId: ENDPOINT, presetHandle: "h1" }),
        ).rejectedWith("A schedule uses this preset");
    });

    it("refuses removing a handle the device no longer reports", async () => {
        const device = new FakeThermostat();
        device.presets = [preset("h1", 1, { builtIn: true })];

        await expect(
            clearThermostatPreset(device, { nodeId: NODE_ID, endpointId: ENDPOINT, presetHandle: "missing" }),
        ).rejectedWith("no longer exists");
    });
});

describe("setActivePreset", () => {
    it("invokes SetActivePresetRequest with the given handle", async () => {
        const device = new FakeThermostat();
        await setActivePreset(device, NODE_ID, ENDPOINT, "h2");
        expect(device.calls).to.deep.equal([
            { kind: "invoke", commandName: "SetActivePresetRequest", data: { presetHandle: "h2" } },
        ]);
    });

    it("passes null through to clear the active preset", async () => {
        const device = new FakeThermostat();
        await setActivePreset(device, NODE_ID, ENDPOINT, null);
        expect(device.calls).to.deep.equal([
            { kind: "invoke", commandName: "SetActivePresetRequest", data: { presetHandle: null } },
        ]);
    });
});
