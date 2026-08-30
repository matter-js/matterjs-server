/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterNode, type MatterClient, type MatterNodeData } from "@matter-server/ws-client";
import {
    formatPercent100ths,
    parseClosureDimensionFeatures,
    readCurrentState,
    readFeatures,
    readLatchControlModes,
    readLimitRange,
    readModulationType,
    readOverflow,
    readResolution,
    readRotationAxis,
    readStepValue,
    readTargetState,
    readTranslationDirection,
    readUnit,
    readUnitRange,
    setTarget,
    step,
} from "../src/util/closure-dimension.js";

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

describe("closure-dimension util", () => {
    describe("parseClosureDimensionFeatures", () => {
        it("decodes all bits", () => {
            expect(parseClosureDimensionFeatures(0b1111_1111)).to.deep.equal({
                positioning: true,
                motionLatching: true,
                unit: true,
                limitation: true,
                speed: true,
                translation: true,
                rotation: true,
                modulation: true,
            });
        });
        it("decodes a positioning-only device", () => {
            const features = parseClosureDimensionFeatures(0b1);
            expect(features.positioning).to.equal(true);
            expect(features.rotation).to.equal(false);
        });
    });

    describe("readFeatures", () => {
        it("reads the FeatureMap attribute for the endpoint", () => {
            const n = node({ "6/261/65532": 0b10001 }); // Positioning | Speed
            const features = readFeatures(n, 6);
            expect(features.positioning).to.equal(true);
            expect(features.speed).to.equal(true);
            expect(features.rotation).to.equal(false);
        });
        it("defaults to no features when FeatureMap is absent", () => {
            expect(readFeatures(node({}), 6).positioning).to.equal(false);
        });
    });

    describe("readCurrentState / readTargetState", () => {
        it("decodes named-keyed struct fields", () => {
            const state = readCurrentState(node({ "6/261/0": { position: 5000, latch: true, speed: 2 } }), 6);
            expect(state).to.deep.equal({ position: 5000, latch: true, speed: 2 });
        });
        it("decodes field-tag-keyed wire entries", () => {
            const state = readTargetState(node({ "6/261/1": { "0": 10000, "1": false, "2": 0 } }), 6);
            expect(state).to.deep.equal({ position: 10000, latch: false, speed: 0 });
        });
        it("returns null when the attribute is null/absent", () => {
            expect(readCurrentState(node({ "6/261/0": null }), 6)).to.equal(null);
            expect(readTargetState(node({}), 6)).to.equal(null);
        });
    });

    describe("formatPercent100ths", () => {
        it("formats a percent100ths value as a percentage", () => {
            expect(formatPercent100ths(5000)).to.equal("50.00%");
            expect(formatPercent100ths(10000)).to.equal("100.00%");
            expect(formatPercent100ths(1)).to.equal("0.01%");
        });
        it("reports Unknown for null", () => {
            expect(formatPercent100ths(null)).to.equal("Unknown");
        });
    });

    describe("static attribute readers", () => {
        it("readResolution / readStepValue read raw percent100ths numbers", () => {
            expect(readResolution(node({ "6/261/2": 100 }), 6)).to.equal(100);
            expect(readStepValue(node({ "6/261/3": 500 }), 6)).to.equal(500);
        });
        it("readUnit reads the enum value", () => {
            expect(readUnit(node({ "6/261/4": 1 }), 6)).to.equal(1);
            expect(readUnit(node({}), 6)).to.equal(null);
        });
        it("readUnitRange decodes min/max", () => {
            expect(readUnitRange(node({ "6/261/5": { min: 0, max: 1000 } }), 6)).to.deep.equal({ min: 0, max: 1000 });
            expect(readUnitRange(node({ "6/261/5": null }), 6)).to.equal(null);
        });
        it("readLimitRange decodes min/max", () => {
            expect(readLimitRange(node({ "6/261/6": { "0": 0, "1": 8000 } }), 6)).to.deep.equal({ min: 0, max: 8000 });
        });
        it("readTranslationDirection / readRotationAxis / readOverflow / readModulationType read enum values", () => {
            expect(readTranslationDirection(node({ "6/261/7": 1 }), 6)).to.equal(1);
            expect(readRotationAxis(node({ "6/261/8": 3 }), 6)).to.equal(3);
            expect(readOverflow(node({ "6/261/9": 2 }), 6)).to.equal(2);
            expect(readModulationType(node({ "6/261/10": 4 }), 6)).to.equal(4);
        });
    });

    describe("readLatchControlModes", () => {
        it("decodes both bits", () => {
            expect(readLatchControlModes(node({ "6/261/11": 0b11 }), 6)).to.deep.equal({
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

        it("setTarget() only includes explicitly provided fields", async () => {
            const { client, calls } = fakeClient();
            await setTarget(client, 1, 6, { position: 5000 });
            expect(calls).to.deep.equal([{ command: "SetTarget", payload: { position: 5000 } }]);
        });

        it("setTarget() includes latch even when false", async () => {
            const { client, calls } = fakeClient();
            await setTarget(client, 1, 6, { latch: false });
            expect(calls).to.deep.equal([{ command: "SetTarget", payload: { latch: false } }]);
        });

        it("setTarget() sends an empty payload when nothing is set", async () => {
            const { client, calls } = fakeClient();
            await setTarget(client, 1, 6, {});
            expect(calls).to.deep.equal([{ command: "SetTarget", payload: {} }]);
        });

        it("step() sends direction and numberOfSteps, omitting speed when unset", async () => {
            const { client, calls } = fakeClient();
            await step(client, 1, 6, { direction: 1, numberOfSteps: 3 });
            expect(calls).to.deep.equal([{ command: "Step", payload: { direction: 1, numberOfSteps: 3 } }]);
        });

        it("step() includes speed when provided", async () => {
            const { client, calls } = fakeClient();
            await step(client, 1, 6, { direction: 0, numberOfSteps: 1, speed: 2 });
            expect(calls).to.deep.equal([{ command: "Step", payload: { direction: 0, numberOfSteps: 1, speed: 2 } }]);
        });
    });
});
