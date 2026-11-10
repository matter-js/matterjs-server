/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ambientContextSensingInfo } from "../src/util/ambient-context-sensing.js";

/** SemanticTagStruct wire entries are field-tag keyed: "0" MfgCode, "1" NamespaceID, "2" Tag, "3" Label. */
const SLEEPING_TAG = { "0": null, "1": 0x4b, "2": 2 }; // Identified Human Activity: Sleeping
const CHILD_TAG = { "0": null, "1": 0x49, "2": 2 }; // Identified Object: Child
const SLEEPING = { kind: "tag", semtag: { mfgCode: null, namespaceId: 0x4b, tag: 2, label: null } };
const CHILD = { kind: "tag", semtag: { mfgCode: null, namespaceId: 0x49, tag: 2, label: null } };

const FEATURE_HA = 0b1;
const FEATURE_OC = 0b10;
const FEATURE_OI = 0b100;
const FEATURE_PRED = 0b10000;

const BASE_ATTRS: Record<string, unknown> = {
    "1/1073/8": 2, // SimultaneousDetectionLimit
    "1/1073/9": 30, // HoldTime
    "1/1073/10": { "0": 5, "1": 300, "2": 30 }, // HoldTimeLimits
    "1/1073/65532": 0b11111, // all features
};

describe("ambient context sensing util", () => {
    it("reports unsupported when the cluster is absent", () => {
        const info = ambientContextSensingInfo({ "1/40/5": "label" }, 1);
        expect(info.supported).to.equal(false);
        expect(info.features.humanActivity).to.equal(false);
    });

    it("reports unsupported when the FeatureMap was removed", () => {
        const info = ambientContextSensingInfo({ ...BASE_ATTRS, "1/1073/65532": null }, 1);
        expect(info.supported).to.equal(false);
    });

    for (const [name, bit] of [
        ["humanActivity", 0],
        ["objectCounting", 1],
        ["objectIdentification", 2],
        ["soundIdentification", 3],
        ["predictedActivity", 4],
    ] as const) {
        it(`maps FeatureMap bit ${bit} to ${name} only`, () => {
            const info = ambientContextSensingInfo({ ...BASE_ATTRS, "1/1073/65532": 1 << bit }, 1);
            expect(info.supported).to.equal(true);
            expect(info.features).to.deep.equal({
                humanActivity: false,
                objectCounting: false,
                objectIdentification: false,
                soundIdentification: false,
                predictedActivity: false,
                [name]: true,
            });
        });
    }

    it("decodes the boolean detection attributes", () => {
        const info = ambientContextSensingInfo(
            { ...BASE_ATTRS, "1/1073/0": true, "1/1073/1": false, "1/1073/2": "yes" },
            1,
        );
        expect(info.humanActivityDetected).to.equal(true);
        expect(info.objectIdentified).to.equal(false);
        expect(info.audioContextDetected).to.equal(undefined);
    });

    it("decodes the general detection settings", () => {
        const info = ambientContextSensingInfo(BASE_ATTRS, 1);
        expect(info.simultaneousDetectionLimit).to.equal(2);
        expect(info.holdTime).to.equal(30);
        expect(info.holdTimeLimits).to.deep.equal({ holdTimeMin: 5, holdTimeMax: 300, holdTimeDefault: 30 });
    });

    it("keeps the present fields of a partial HoldTimeLimits and drops an empty one", () => {
        expect(ambientContextSensingInfo({ ...BASE_ATTRS, "1/1073/10": { "0": 5 } }, 1).holdTimeLimits).to.deep.equal({
            holdTimeMin: 5,
            holdTimeMax: undefined,
            holdTimeDefault: undefined,
        });
        expect(ambientContextSensingInfo({ ...BASE_ATTRS, "1/1073/10": {} }, 1).holdTimeLimits).to.equal(undefined);
    });

    it("decodes AmbientContextType entries down to their semantic tags", () => {
        const info = ambientContextSensingInfo(
            {
                ...BASE_ATTRS,
                "1/1073/3": [{ "0": [CHILD_TAG, SLEEPING_TAG] }, { "0": [] }, {}, { "0": [SLEEPING_TAG] }],
            },
            1,
        );
        expect(info.ambientContextType).to.deep.equal([
            { ambientContextSensed: [CHILD, SLEEPING] },
            { ambientContextSensed: [SLEEPING] },
        ]);
    });

    it("ignores context type attributes without the HA, OI or AUD feature", () => {
        const info = ambientContextSensingInfo(
            {
                ...BASE_ATTRS,
                "1/1073/3": [{ "0": [SLEEPING_TAG] }],
                "1/1073/4": [SLEEPING_TAG],
                "1/1073/65532": FEATURE_OC | FEATURE_PRED,
            },
            1,
        );
        expect(info.ambientContextType).to.deep.equal([]);
        expect(info.ambientContextTypeSupported).to.deep.equal([]);
    });

    it("decodes AmbientContextTypeSupported as a flat tag list", () => {
        const info = ambientContextSensingInfo({ ...BASE_ATTRS, "1/1073/4": [SLEEPING_TAG] }, 1);
        expect(info.ambientContextTypeSupported).to.deep.equal([SLEEPING]);
    });

    it("treats a removed (null) AmbientContextTypeSupported as absent instead of malformed", () => {
        const info = ambientContextSensingInfo({ ...BASE_ATTRS, "1/1073/4": null }, 1);
        expect(info.ambientContextTypeSupported).to.deep.equal([]);
    });

    describe("object counting", () => {
        const COUNTING_ATTRS = { "1/1073/5": true, "1/1073/6": { "0": CHILD_TAG, "1": 3 }, "1/1073/7": 4 };

        it("decodes threshold state, count and config with OC and OI", () => {
            const info = ambientContextSensingInfo(
                { ...BASE_ATTRS, ...COUNTING_ATTRS, "1/1073/65532": FEATURE_OC | FEATURE_OI },
                1,
            );
            expect(info.objectCounting).to.deep.equal({
                thresholdReached: true,
                count: 4,
                config: { countingObject: CHILD, objectCountThreshold: 3 },
            });
        });

        it("is absent without OI, which the counting attributes require besides OC", () => {
            const info = ambientContextSensingInfo(
                { ...BASE_ATTRS, ...COUNTING_ATTRS, "1/1073/65532": FEATURE_OC | FEATURE_HA },
                1,
            );
            expect(info.objectCounting).to.equal(undefined);
        });

        it("is absent without OC", () => {
            const info = ambientContextSensingInfo({ ...BASE_ATTRS, ...COUNTING_ATTRS, "1/1073/65532": FEATURE_OI }, 1);
            expect(info.objectCounting).to.equal(undefined);
        });

        it("is absent with OC and OI when no counting attribute is reported", () => {
            const info = ambientContextSensingInfo({ ...BASE_ATTRS, "1/1073/65532": FEATURE_OC | FEATURE_OI }, 1);
            expect(info.objectCounting).to.equal(undefined);
        });

        it("keeps a config without CountingObject and drops an empty config", () => {
            const partial = ambientContextSensingInfo({ ...BASE_ATTRS, "1/1073/6": { "1": 3 } }, 1);
            expect(partial.objectCounting?.config).to.deep.equal({
                countingObject: undefined,
                objectCountThreshold: 3,
            });
            const empty = ambientContextSensingInfo({ ...BASE_ATTRS, "1/1073/6": {}, "1/1073/7": 1 }, 1);
            expect(empty.objectCounting?.config).to.equal(undefined);
        });
    });

    it("decodes PredictedActivity entries", () => {
        const info = ambientContextSensingInfo(
            {
                ...BASE_ATTRS,
                "1/1073/11": [
                    { "0": 100, "1": 200, "2": [SLEEPING_TAG], "3": true, "4": 5, "5": 80 },
                    { "0": 300, "1": 400, "5": 50 },
                ],
            },
            1,
        );
        expect(info.predictedActivity).to.deep.equal([
            {
                startTimestamp: 100,
                endTimestamp: 200,
                ambientContextType: [SLEEPING],
                crowdDetected: true,
                crowdCount: 5,
                confidence: 80,
            },
            {
                startTimestamp: 300,
                endTimestamp: 400,
                ambientContextType: [],
                crowdDetected: undefined,
                crowdCount: undefined,
                confidence: 50,
            },
        ]);
    });

    it("returns an empty list when PredictedActivity is absent", () => {
        const info = ambientContextSensingInfo(BASE_ATTRS, 1);
        expect(info.predictedActivity).to.deep.equal([]);
    });
});
