/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ambientContextSensingInfo } from "../src/util/ambient-context-sensing.js";

/** SemanticTagStruct wire entries are field-tag keyed: "0" MfgCode, "1" NamespaceID, "2" Tag, "3" Label. */
const SLEEPING_TAG = { "0": null, "1": 0x49, "2": 1, "3": "Sleeping" };
const CHILD_TAG = { "0": null, "1": 0x4b, "2": 2, "3": "Child" };

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

    it("decodes the active feature bits", () => {
        const info = ambientContextSensingInfo(BASE_ATTRS, 1);
        expect(info.supported).to.equal(true);
        expect(info.features).to.deep.equal({
            humanActivity: true,
            objectCounting: true,
            objectIdentification: true,
            soundIdentification: true,
            predictedActivity: true,
        });
    });

    it("clears features whose bit is not set", () => {
        const info = ambientContextSensingInfo({ ...BASE_ATTRS, "1/1073/65532": 0 }, 1);
        expect(info.supported).to.equal(true);
        expect(info.features.humanActivity).to.equal(false);
        expect(info.features.predictedActivity).to.equal(false);
    });

    it("decodes the boolean detection attributes", () => {
        const info = ambientContextSensingInfo(
            { ...BASE_ATTRS, "1/1073/0": true, "1/1073/1": false, "1/1073/2": true },
            1,
        );
        expect(info.humanActivityDetected).to.equal(true);
        expect(info.objectIdentified).to.equal(false);
        expect(info.audioContextDetected).to.equal(true);
    });

    it("decodes AmbientContextType entries down to their semantic tags", () => {
        const info = ambientContextSensingInfo({ ...BASE_ATTRS, "1/1073/3": [{ "0": [CHILD_TAG, SLEEPING_TAG] }] }, 1);
        expect(info.ambientContextType).to.have.lengthOf(1);
        const [entry] = info.ambientContextType;
        expect(entry.ambientContextSensed).to.have.lengthOf(2);
        expect(entry.ambientContextSensed[0]).to.deep.equal({
            kind: "tag",
            semtag: { mfgCode: null, namespaceId: 0x4b, tag: 2, label: "Child" },
        });
        expect(entry.ambientContextSensed[1]).to.deep.equal({
            kind: "tag",
            semtag: { mfgCode: null, namespaceId: 0x49, tag: 1, label: "Sleeping" },
        });
    });

    it("decodes AmbientContextTypeSupported as a flat tag list", () => {
        const info = ambientContextSensingInfo({ ...BASE_ATTRS, "1/1073/4": [SLEEPING_TAG] }, 1);
        expect(info.ambientContextTypeSupported).to.have.lengthOf(1);
        expect(info.ambientContextTypeSupported[0]).to.deep.equal({
            kind: "tag",
            semtag: { mfgCode: null, namespaceId: 0x49, tag: 1, label: "Sleeping" },
        });
    });

    it("decodes ObjectCountConfig's single semantic tag and threshold", () => {
        const info = ambientContextSensingInfo({ ...BASE_ATTRS, "1/1073/6": { "0": CHILD_TAG, "1": 3 } }, 1);
        expect(info.objectCountConfig?.objectCountThreshold).to.equal(3);
        expect(info.objectCountConfig?.countingObject).to.deep.equal({
            kind: "tag",
            semtag: { mfgCode: null, namespaceId: 0x4b, tag: 2, label: "Child" },
        });
    });

    it("treats a missing ObjectCountConfig as absent", () => {
        const info = ambientContextSensingInfo(BASE_ATTRS, 1);
        expect(info.objectCountConfig).to.equal(undefined);
    });

    it("decodes ObjectCount and ObjectCountThresholdReached", () => {
        const info = ambientContextSensingInfo({ ...BASE_ATTRS, "1/1073/5": true, "1/1073/7": 4 }, 1);
        expect(info.objectCountThresholdReached).to.equal(true);
        expect(info.objectCount).to.equal(4);
    });

    it("decodes HoldTimeLimits fields", () => {
        const info = ambientContextSensingInfo(BASE_ATTRS, 1);
        expect(info.holdTimeLimits).to.deep.equal({ holdTimeMin: 5, holdTimeMax: 300, holdTimeDefault: 30 });
    });

    it("decodes PredictedActivity entries", () => {
        const info = ambientContextSensingInfo(
            {
                ...BASE_ATTRS,
                "1/1073/11": [
                    {
                        "0": 100,
                        "1": 200,
                        "2": [SLEEPING_TAG],
                        "3": true,
                        "4": 5,
                        "5": 80,
                    },
                ],
            },
            1,
        );
        expect(info.predictedActivity).to.have.lengthOf(1);
        const [entry] = info.predictedActivity;
        expect(entry.startTimestamp).to.equal(100);
        expect(entry.endTimestamp).to.equal(200);
        expect(entry.crowdDetected).to.equal(true);
        expect(entry.crowdCount).to.equal(5);
        expect(entry.confidence).to.equal(80);
        expect(entry.ambientContextType).to.have.lengthOf(1);
    });

    it("returns an empty list when PredictedActivity is absent", () => {
        const info = ambientContextSensingInfo(BASE_ATTRS, 1);
        expect(info.predictedActivity).to.deep.equal([]);
    });
});
