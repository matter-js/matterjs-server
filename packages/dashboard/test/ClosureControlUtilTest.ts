/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterNode, type MatterClient, type MatterNodeData } from "@matter-server/ws-client";
import {
    calibrate,
    moveTo,
    parseClosureFeatures,
    readCountdownTime,
    readCurrentErrorList,
    readFeatures,
    readLatchControlModes,
    readMainState,
    readOverallCurrentState,
    readOverallTargetState,
    stop,
} from "../src/util/closure-control.js";

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

describe("closure-control util", () => {
    describe("parseClosureFeatures", () => {
        it("decodes all bits", () => {
            expect(parseClosureFeatures(0b1_1111_1111)).to.deep.equal({
                positioning: true,
                motionLatching: true,
                instantaneous: true,
                speed: true,
                ventilation: true,
                pedestrian: true,
                calibration: true,
                protection: true,
                manuallyOperable: true,
            });
        });
        it("decodes a positioning-only device", () => {
            const features = parseClosureFeatures(0b1);
            expect(features.positioning).to.equal(true);
            expect(features.calibration).to.equal(false);
        });
    });

    describe("readFeatures", () => {
        it("reads the FeatureMap attribute for the endpoint", () => {
            const n = node({ "6/260/65532": 0b1000001 }); // Positioning | Calibration
            const features = readFeatures(n, 6);
            expect(features.positioning).to.equal(true);
            expect(features.calibration).to.equal(true);
            expect(features.speed).to.equal(false);
        });
        it("defaults to no features when FeatureMap is absent", () => {
            expect(readFeatures(node({}), 6).positioning).to.equal(false);
        });
    });

    describe("readMainState", () => {
        it("reads the enum value", () => {
            expect(readMainState(node({ "6/260/1": 1 }), 6)).to.equal(1);
        });
        it("returns null when absent", () => {
            expect(readMainState(node({}), 6)).to.equal(null);
        });
    });

    describe("readCurrentErrorList", () => {
        it("filters non-numeric entries", () => {
            expect(readCurrentErrorList(node({ "6/260/2": [0, 2, "bad", null] }), 6)).to.deep.equal([0, 2]);
        });
        it("returns empty for absent/non-array value", () => {
            expect(readCurrentErrorList(node({}), 6)).to.deep.equal([]);
        });
    });

    describe("readCountdownTime", () => {
        it("reads a numeric value", () => {
            expect(readCountdownTime(node({ "6/260/0": 42 }), 6)).to.equal(42);
        });
        it("returns null when null/absent", () => {
            expect(readCountdownTime(node({ "6/260/0": null }), 6)).to.equal(null);
        });
    });

    describe("readOverallCurrentState", () => {
        it("decodes named-keyed struct fields", () => {
            const state = readOverallCurrentState(
                node({ "6/260/3": { position: 0, latch: true, speed: 2, secureState: true } }),
                6,
            );
            expect(state).to.deep.equal({ position: 0, latch: true, speed: 2, secureState: true });
        });
        it("decodes field-tag-keyed wire entries", () => {
            const state = readOverallCurrentState(node({ "6/260/3": { "0": 1, "1": false, "2": 3, "3": false } }), 6);
            expect(state).to.deep.equal({ position: 1, latch: false, speed: 3, secureState: false });
        });
        it("returns null when the attribute is null/absent", () => {
            expect(readOverallCurrentState(node({ "6/260/3": null }), 6)).to.equal(null);
            expect(readOverallCurrentState(node({}), 6)).to.equal(null);
        });
    });

    describe("readOverallTargetState", () => {
        it("decodes named-keyed struct fields, without secureState", () => {
            const state = readOverallTargetState(node({ "6/260/4": { position: 4, latch: null, speed: 0 } }), 6);
            expect(state).to.deep.equal({ position: 4, latch: null, speed: 0 });
        });
    });

    describe("readLatchControlModes", () => {
        it("decodes both bits", () => {
            expect(readLatchControlModes(node({ "6/260/5": 0b11 }), 6)).to.deep.equal({
                remoteLatching: true,
                remoteUnlatching: true,
            });
        });
        it("defaults to unsupported when absent", () => {
            expect(readLatchControlModes(node({}), 6)).to.deep.equal({
                remoteLatching: false,
                remoteUnlatching: false,
            });
        });
    });

    describe("command senders", () => {
        function fakeClient() {
            const calls: { command: string; payload: Record<string, unknown> }[] = [];
            const client = {
                deviceCommand: (
                    _nodeId: number | bigint,
                    _endpointId: number,
                    _clusterId: number,
                    commandName: string,
                    payload: Record<string, unknown> = {},
                ) => {
                    calls.push({ command: commandName, payload });
                    return Promise.resolve();
                },
            } as unknown as MatterClient;
            return { client, calls };
        }

        it("stop() sends Stop with no payload", async () => {
            const { client, calls } = fakeClient();
            await stop(client, 1, 6);
            expect(calls).to.deep.equal([{ command: "Stop", payload: {} }]);
        });

        it("calibrate() sends Calibrate with no payload", async () => {
            const { client, calls } = fakeClient();
            await calibrate(client, 1, 6);
            expect(calls).to.deep.equal([{ command: "Calibrate", payload: {} }]);
        });

        it("moveTo() only includes explicitly provided fields", async () => {
            const { client, calls } = fakeClient();
            await moveTo(client, 1, 6, { position: 1 });
            expect(calls).to.deep.equal([{ command: "MoveTo", payload: { position: 1 } }]);
        });

        it("moveTo() includes latch even when false", async () => {
            const { client, calls } = fakeClient();
            await moveTo(client, 1, 6, { latch: false });
            expect(calls).to.deep.equal([{ command: "MoveTo", payload: { latch: false } }]);
        });

        it("moveTo() sends an empty payload when nothing is set", async () => {
            const { client, calls } = fakeClient();
            await moveTo(client, 1, 6, {});
            expect(calls).to.deep.equal([{ command: "MoveTo", payload: {} }]);
        });
    });
});
