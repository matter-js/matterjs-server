/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { AttributeId, ClientNode, ClusterId, EndpointNumber, Millis } from "@matter/main";
import { ThermostatDevice } from "@matter/main/devices/thermostat";
import { AtomicRequestType, Status, StatusResponseError } from "@matter/main/types";
import { ThermostatClient, ThermostatServer } from "@matter/node/behaviors/thermostat";
import { Thermostat } from "@matter/types/clusters/thermostat";
import { WriteAtomicAttributeRequest } from "../src/types/CommandHandler.js";
import { ServerError, ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";
import { HandlerSite, NODE_ID } from "./support/HandlerSite.js";

const THERMOSTAT = ClusterId(Thermostat.id);
const PRESETS = AttributeId(Thermostat.attributes.presets.id);
const ENDPOINT = EndpointNumber(1);

/** What the device received, in order: the AtomicRequest types, and each Write as the controller sent it. */
const received = new Array<string>();

/** Every AtomicRequest the device received, with its fields. */
const atomicRequests = new Array<Thermostat.AtomicRequest>();

/** How the test device departs from a plain matter.js thermostat; reset before each test. */
const deviceAnswers: {
    /** Answers BeginWrite with this instead of opening an atomic write. */
    begin?: Thermostat.AtomicResponse;
    /** Runs while the device handles a BeginWrite, so while the controller's atomic write is open. */
    duringBegin?: () => Promise<void>;
    /** Replaces the attribute statuses of a successful BeginWrite answer. */
    beginAttributeStatus?: Thermostat.AtomicResponse["attributeStatus"];
    /**
     * Answers CommitWrite with this, or throws it when it is a status, instead of committing. The device discards the
     * write, as it does for a failed commit (§7.15.6.4.2).
     */
    commit?: Thermostat.AtomicResponse | Status;
    /** Throws this status for a RollbackWrite after rolling back, so the controller cannot tell it happened. */
    rollback?: Status;
} = {};

class RecordingThermostatServer extends ThermostatServer.with("Heating", "Cooling", "AutoMode", "Presets") {
    override async atomicRequest(request: Thermostat.AtomicRequest) {
        received.push(AtomicRequestType[request.requestType]);
        atomicRequests.push({ ...request, attributeRequests: [...request.attributeRequests] });
        const { begin, beginAttributeStatus, commit, duringBegin } = deviceAnswers;
        switch (request.requestType) {
            case Thermostat.RequestType.BeginWrite: {
                await duringBegin?.();
                if (begin !== undefined) {
                    return begin;
                }
                const answer = await super.atomicRequest(request);
                return beginAttributeStatus === undefined
                    ? answer
                    : { ...answer, attributeStatus: beginAttributeStatus };
            }
            case Thermostat.RequestType.CommitWrite:
                if (commit === undefined) {
                    return await super.atomicRequest(request);
                }
                await super.atomicRequest({
                    ...request,
                    requestType: Thermostat.RequestType.RollbackWrite,
                    attributeRequests: [PRESETS],
                });
                if (typeof commit === "number") {
                    throw new StatusResponseError("The test device refuses the commit", commit);
                }
                return commit;
            default: {
                const answer = await super.atomicRequest(request);
                if (deviceAnswers.rollback !== undefined) {
                    throw new StatusResponseError(
                        "The test device answers the rollback with an error",
                        deviceAnswers.rollback,
                    );
                }
                return answer;
            }
        }
    }
}

const PresetsThermostat = ThermostatDevice.with(RecordingThermostatServer).set({
    thermostat: {
        controlSequenceOfOperation: Thermostat.ControlSequenceOfOperation.CoolingAndHeating,
        systemMode: Thermostat.SystemMode.Auto,
        occupiedHeatingSetpoint: 2000,
        occupiedCoolingSetpoint: 2600,
        minSetpointDeadBand: 25,
        numberOfPresets: 5,
        // No SupportsNames, so a preset with a name is refused.
        presetTypes: [
            { presetScenario: Thermostat.PresetScenario.Occupied, numberOfPresets: 5, presetTypeFeatures: {} },
        ],
        activePresetHandle: null,
        presets: [],
    },
});

/** A new preset as the wire carries it: tag-keyed, without a handle. */
function wirePreset(heatingSetpoint: number, name?: string) {
    return {
        "0": null,
        "1": Thermostat.PresetScenario.Occupied,
        "3": 2600,
        "4": heatingSetpoint,
        "5": false,
        "2": name,
    };
}

function recordWrites(peer: ClientNode) {
    const interaction = peer.interaction;
    const write = interaction.write.bind(interaction);
    interaction.write = (request, session) => {
        received.push(request.timedRequest ? "TimedWrite" : "Write");
        return write(request, session);
    };
}

describe("write_atomic_attribute on a commissioned device", () => {
    let site: HandlerSite;

    beforeEach(async () => {
        received.length = 0;
        atomicRequests.length = 0;
        delete deviceAnswers.begin;
        delete deviceAnswers.beginAttributeStatus;
        delete deviceAnswers.duringBegin;
        delete deviceAnswers.rollback;
        delete deviceAnswers.commit;
        site = new HandlerSite();
        await site.startDevice(undefined, PresetsThermostat);
        await site.startController(true);
        await site.commission();
        recordWrites(site.peer);
    });

    afterEach(async () => {
        await site.close();
    });

    function storedPresets() {
        return site.light.stateOf(RecordingThermostatServer).persistedPresets ?? [];
    }

    async function writeAtomic(request: Partial<Omit<WriteAtomicAttributeRequest, "nodeId">> & { value: unknown }) {
        return await MockTime.resolve(
            site.handler.handleWriteAtomicAttribute({
                nodeId: NODE_ID,
                endpointId: ENDPOINT,
                clusterId: THERMOSTAT,
                attributeId: PRESETS,
                ...request,
            }),
            { macrotasks: true },
        );
    }

    /** An AtomicRequest of the test's own, as another client of this controller would send it. */
    async function atomicRequest(requestType: Thermostat.RequestType) {
        return await MockTime.resolve(
            site.peer.parts
                .require("ep1")
                .commandsOf(ThermostatClient)
                .atomicRequest({
                    requestType,
                    attributeRequests: [PRESETS],
                    timeout: requestType === Thermostat.RequestType.BeginWrite ? 5000 : undefined,
                }),
        );
    }

    it("begins, writes and commits, and the device stores the value", async () => {
        const result = await writeAtomic({ value: [wirePreset(1900)] });

        expect(result).deep.equals({
            endpointId: ENDPOINT,
            clusterId: THERMOSTAT,
            attributeId: PRESETS,
            status: Status.Success,
            clusterStatus: undefined,
        });
        expect(received).deep.equals(["BeginWrite", "Write", "CommitWrite"]);
        expect(storedPresets().map(({ heatingSetpoint }) => heatingSetpoint)).deep.equals([1900]);
    });

    it("sends a timed write when the request states a timed request timeout", async () => {
        const result = await writeAtomic({ value: [wirePreset(1900)], timedInteractionTimeoutMs: Millis(2000) });

        expect(result.status).equals(Status.Success);
        expect(received).deep.equals(["BeginWrite", "TimedWrite", "CommitWrite"]);
    });

    it("rolls back when the device refuses the write and answers the write's status", async () => {
        const refused = await writeAtomic({ value: [wirePreset(1900, "named")] });

        expect(refused.status).equals(Status.ConstraintError);
        expect(received).deep.equals(["BeginWrite", "Write", "RollbackWrite"]);
        expect(storedPresets()).deep.equals([]);
        expect(site.peer.parts.require("ep1").stateOf(ThermostatClient).presets).deep.equals([]);

        // Without the rollback the device would still hold the write state and refuse the next BeginWrite.
        const next = await writeAtomic({ value: [wirePreset(2100)] });
        expect(next.status).equals(Status.Success);
    });

    for (const [label, answer, expected] of [
        [
            "a failing attribute status",
            { statusCode: Status.Failure, attributeStatus: [{ attributeId: PRESETS, statusCode: Status.Busy }] },
            Status.Busy,
        ],
        [
            "only a failing overall status",
            {
                statusCode: Status.ConstraintError,
                attributeStatus: [{ attributeId: PRESETS, statusCode: Status.Success }],
            },
            Status.ConstraintError,
        ],
    ] as const) {
        it(`answers a commit refused with ${label} and does not roll it back`, async () => {
            deviceAnswers.commit = { ...answer, attributeStatus: [...answer.attributeStatus] };

            const result = await writeAtomic({ value: [wirePreset(1900)] });

            expect(result.status).equals(expected);
            expect(received).deep.equals(["BeginWrite", "Write", "CommitWrite"]);
            expect(storedPresets()).deep.equals([]);
        });
    }

    it("sends the default timeout with BeginWrite only", async () => {
        await writeAtomic({ value: [wirePreset(1900)] });

        expect(atomicRequests.map(({ requestType, timeout }) => ({ requestType, timeout }))).deep.equals([
            { requestType: Thermostat.RequestType.BeginWrite, timeout: 5000 },
            { requestType: Thermostat.RequestType.CommitWrite, timeout: undefined },
        ]);
    });

    it("sends the stated atomic timeout with BeginWrite", async () => {
        await writeAtomic({ value: [wirePreset(1900)], atomicTimeoutMs: Millis(8000) });

        expect(atomicRequests[0].timeout).equals(8000);
    });

    it("answers a BeginWrite refused with an AtomicResponse and sends nothing else", async () => {
        deviceAnswers.begin = {
            statusCode: Status.Failure,
            attributeStatus: [{ attributeId: PRESETS, statusCode: Status.Busy }],
        };

        const result = await writeAtomic({ value: [wirePreset(1900)] });

        expect(result.status).equals(Status.Busy);
        expect(received).deep.equals(["BeginWrite"]);
    });

    it("rolls back when the commit throws and answers its status", async () => {
        deviceAnswers.commit = Status.Failure;

        const result = await writeAtomic({ value: [wirePreset(1900)] });

        expect(result.status).equals(Status.Failure);
        expect(received).deep.equals(["BeginWrite", "Write", "CommitWrite", "RollbackWrite"]);
        expect(storedPresets()).deep.equals([]);
    });

    function committedAttributes() {
        return atomicRequests.find(({ requestType }) => requestType === Thermostat.RequestType.CommitWrite)
            ?.attributeRequests;
    }

    it("names the attribute ids the BeginWrite answered in the CommitWrite", async () => {
        // A device with a shared resource adds attributes to the atomic write (§7.15.6.4.1).
        const schedules = AttributeId(Thermostat.attributes.schedules.id);
        deviceAnswers.beginAttributeStatus = [
            { attributeId: PRESETS, statusCode: Status.Success },
            { attributeId: schedules, statusCode: Status.Success },
        ];

        await writeAtomic({ value: [wirePreset(1900)] });

        expect(committedAttributes()).deep.equals([PRESETS, schedules]);
    });

    it("names the written attribute in the CommitWrite when the BeginWrite answered no attribute", async () => {
        deviceAnswers.beginAttributeStatus = [];

        const result = await writeAtomic({ value: [wirePreset(1900)] });

        expect(result.status).equals(Status.Success);
        expect(committedAttributes()).deep.equals([PRESETS]);
    });

    it("refuses an endpoint without the cluster before sending anything", async () => {
        const refusal = await writeAtomic({ endpointId: EndpointNumber(9), value: [wirePreset(1900)] }).catch(
            (error: unknown) => error,
        );

        expect(refusal).instanceOf(ServerError);
        expect(refusal).property("code", ServerErrorCode.InvalidArguments);
        expect(received).deep.equals([]);
    });

    it("answers BUSY to atomic writes of the cluster while its atomic write is open, without sending them", async () => {
        const heatingSetpoint = AttributeId(Thermostat.attributes.occupiedHeatingSetpoint.id);
        const presetsWrite = { nodeId: NODE_ID, clusterId: THERMOSTAT, attributeId: PRESETS, value: [] };
        const answers = new Array<unknown>();
        let setpointWrite: Promise<unknown> | undefined;
        deviceAnswers.duringBegin = async () => {
            deviceAnswers.duringBegin = undefined;
            answers.push(
                await site.handler.handleWriteAttribute({ ...presetsWrite, endpointId: ENDPOINT }),
                await site.handler.handleWriteAttribute(presetsWrite),
                await site.handler.handleWriteAtomicAttribute({ ...presetsWrite, endpointId: ENDPOINT }),
            );
            // Not an atomic attribute: it is sent, and the device applies it outside the atomic write. The device
            // answers it only after this BeginWrite, so it is not awaited here.
            setpointWrite = site.handler.handleWriteAttribute({
                ...presetsWrite,
                attributeId: heatingSetpoint,
                endpointId: ENDPOINT,
                value: 2100,
            });
        };

        const result = await writeAtomic({ value: [wirePreset(1900)] });
        const setpoint = await MockTime.resolve(setpointWrite ?? Promise.reject(new Error("BeginWrite never ran")), {
            macrotasks: true,
        });

        expect(result.status).equals(Status.Success);
        const busy = { endpointId: ENDPOINT, clusterId: THERMOSTAT, attributeId: PRESETS, status: Status.Busy };
        expect(answers).deep.equals([[busy], [busy], { ...busy, clusterStatus: undefined }]);
        expect(setpoint).deep.equals([
            {
                endpointId: ENDPOINT,
                clusterId: THERMOSTAT,
                attributeId: heatingSetpoint,
                status: Status.Success,
                clusterStatus: undefined,
            },
        ]);
        expect(received.filter(type => type !== "Write")).deep.equals(["BeginWrite", "CommitWrite"]);
        expect(received.filter(type => type === "Write")).length(2);
        expect(site.light.stateOf(RecordingThermostatServer).occupiedHeatingSetpoint).equals(2100);
    });

    for (const [label, failure] of [
        ["refused write", () => ({ value: [wirePreset(1900, "named")] })],
        [
            "commit that throws",
            () => {
                deviceAnswers.commit = Status.Failure;
                return { value: [wirePreset(1900)] };
            },
        ],
    ] as const) {
        it(`sends atomic writes of the cluster again once its atomic write ended with a ${label}`, async () => {
            await writeAtomic(failure());

            const [result] = await MockTime.resolve(
                site.handler.handleWriteAttribute({
                    nodeId: NODE_ID,
                    endpointId: ENDPOINT,
                    clusterId: THERMOSTAT,
                    attributeId: PRESETS,
                    value: [],
                }),
                { macrotasks: true },
            );

            // Outside an atomic write the device refuses the write itself (§7.15.3), instead of the server's BUSY.
            expect(result.status).equals(Status.InvalidInState);
        });
    }

    it("answers BUSY to atomic writes of the cluster until the timeout the device granted when the rollback fails", async () => {
        deviceAnswers.rollback = Status.Failure;
        const writePresets = async () => {
            const [{ status }] = await MockTime.resolve(
                site.handler.handleWriteAttribute({
                    nodeId: NODE_ID,
                    endpointId: ENDPOINT,
                    clusterId: THERMOSTAT,
                    attributeId: PRESETS,
                    value: [],
                }),
                { macrotasks: true },
            );
            return status;
        };

        // The matter.js thermostat grants at most 9 s, so the hold must follow its answer, not the 20 s requested.
        const refused = await writeAtomic({ value: [wirePreset(1900, "named")], atomicTimeoutMs: Millis(20_000) });

        expect(refused.status).equals(Status.ConstraintError);
        expect(received).deep.equals(["BeginWrite", "Write", "RollbackWrite"]);
        expect(await writePresets()).equals(Status.Busy);
        await site.settle(Millis(8_000));
        expect(await writePresets()).equals(Status.Busy);
        await site.settle(Millis(1_500));
        // Outside an atomic write the device refuses the write itself (§7.15.3), instead of the server's BUSY.
        expect(await writePresets()).equals(Status.InvalidInState);
    });

    it("answers INVALID_IN_STATE while another atomic write is open and does not roll it back", async () => {
        const held = await atomicRequest(Thermostat.RequestType.BeginWrite);
        expect(held.statusCode).equals(Status.Success);
        received.length = 0;

        const refused = await writeAtomic({ value: [wirePreset(1900)] });

        expect(refused.status).equals(Status.InvalidInState);
        expect(received).deep.equals(["BeginWrite"]);
        const commit = await atomicRequest(Thermostat.RequestType.CommitWrite);
        expect(commit.statusCode).equals(Status.Success);
    });
});
