/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    cameraAvStreamManagementInfo,
    cameraSwitches,
    NIGHT_VISION_NAMES,
    switchWriteValue,
    writeCameraSetting,
} from "../src/util/camera-av-stream-management.js";

const AVSM = "1/1361";
const FEATURE_MAP = `${AVSM}/65532`;

/** ADO | VDO | SNP | PRIV | SPKR | HDR | NV */
const ALL_FEATURES = 0b110_0001_1111;

const ALL_SETTINGS = {
    [FEATURE_MAP]: ALL_FEATURES,
    [`${AVSM}/29`]: true,
    [`${AVSM}/25`]: false,
    [`${AVSM}/13`]: true,
    [`${AVSM}/39`]: false,
    [`${AVSM}/19`]: true,
    [`${AVSM}/20`]: false,
    [`${AVSM}/22`]: 2,
    [`${AVSM}/21`]: true,
    [`${AVSM}/15`]: [{}, {}],
    [`${AVSM}/16`]: [{}],
    [`${AVSM}/17`]: [],
};

function info(attributes: Record<string, unknown>) {
    return cameraAvStreamManagementInfo(attributes, 1);
}

describe("cameraAvStreamManagementInfo", () => {
    it("decodes every setting when all features are set", () => {
        expect(info(ALL_SETTINGS)).to.deep.equal({
            supported: true,
            features: {
                audio: true,
                video: true,
                snapshot: true,
                privacy: true,
                speaker: true,
                highDynamicRange: true,
                nightVision: true,
            },
            microphoneMuted: true,
            speakerMuted: false,
            hdrModeEnabled: true,
            statusLightEnabled: false,
            softRecordingPrivacyModeEnabled: true,
            softLivestreamPrivacyModeEnabled: false,
            nightVision: 2,
            hardPrivacyModeOn: true,
            allocatedStreams: { video: 2, audio: 1, snapshot: 0 },
        });
    });

    it("hides feature-gated settings when their feature bit is clear", () => {
        expect(info({ ...ALL_SETTINGS, [FEATURE_MAP]: 0 })).to.deep.equal({
            supported: true,
            features: {
                audio: false,
                video: false,
                snapshot: false,
                privacy: false,
                speaker: false,
                highDynamicRange: false,
                nightVision: false,
            },
            microphoneMuted: undefined,
            speakerMuted: undefined,
            hdrModeEnabled: undefined,
            statusLightEnabled: false,
            softRecordingPrivacyModeEnabled: undefined,
            softLivestreamPrivacyModeEnabled: undefined,
            nightVision: undefined,
            hardPrivacyModeOn: true,
            allocatedStreams: { video: undefined, audio: undefined, snapshot: undefined },
        });
    });

    it("shows each gated setting only for its own feature bit", () => {
        const gated = (bit: number) => {
            const decoded = info({ ...ALL_SETTINGS, [FEATURE_MAP]: 1 << bit });
            return {
                microphoneMuted: decoded.microphoneMuted,
                speakerMuted: decoded.speakerMuted,
                hdrModeEnabled: decoded.hdrModeEnabled,
                softRecordingPrivacyModeEnabled: decoded.softRecordingPrivacyModeEnabled,
                softLivestreamPrivacyModeEnabled: decoded.softLivestreamPrivacyModeEnabled,
                nightVision: decoded.nightVision,
                allocatedStreams: decoded.allocatedStreams,
            };
        };
        const none = {
            microphoneMuted: undefined,
            speakerMuted: undefined,
            hdrModeEnabled: undefined,
            softRecordingPrivacyModeEnabled: undefined,
            softLivestreamPrivacyModeEnabled: undefined,
            nightVision: undefined,
            allocatedStreams: { video: undefined, audio: undefined, snapshot: undefined },
        };
        expect(gated(0)).to.deep.equal({
            ...none,
            microphoneMuted: true,
            allocatedStreams: { ...none.allocatedStreams, audio: 1 },
        });
        expect(gated(1)).to.deep.equal({ ...none, allocatedStreams: { ...none.allocatedStreams, video: 2 } });
        expect(gated(2)).to.deep.equal({ ...none, allocatedStreams: { ...none.allocatedStreams, snapshot: 0 } });
        expect(gated(3)).to.deep.equal({
            ...none,
            softRecordingPrivacyModeEnabled: true,
            softLivestreamPrivacyModeEnabled: false,
        });
        expect(gated(4)).to.deep.equal({ ...none, speakerMuted: false });
        expect(gated(9)).to.deep.equal({ ...none, hdrModeEnabled: true });
        expect(gated(10)).to.deep.equal({ ...none, nightVision: 2 });
    });

    it("decodes each feature bit on its own", () => {
        const setFeatures = (bit: number) =>
            Object.entries(info({ [FEATURE_MAP]: 1 << bit }).features)
                .filter(([, set]) => set)
                .map(([name]) => name);
        expect(setFeatures(0)).to.deep.equal(["audio"]);
        expect(setFeatures(1)).to.deep.equal(["video"]);
        expect(setFeatures(2)).to.deep.equal(["snapshot"]);
        expect(setFeatures(3)).to.deep.equal(["privacy"]);
        expect(setFeatures(4)).to.deep.equal(["speaker"]);
        expect(setFeatures(9)).to.deep.equal(["highDynamicRange"]);
        expect(setFeatures(10)).to.deep.equal(["nightVision"]);
        expect(setFeatures(5)).to.deep.equal([]);
    });

    it("reports unsupported when the FeatureMap is absent or was removed (null)", () => {
        expect(info({}).supported).to.equal(false);
        expect(info({ [FEATURE_MAP]: null }).supported).to.equal(false);
    });

    it("leaves removed (null) settings undefined", () => {
        const decoded = info({
            [FEATURE_MAP]: ALL_FEATURES,
            [`${AVSM}/29`]: null,
            [`${AVSM}/39`]: null,
            [`${AVSM}/21`]: null,
            [`${AVSM}/22`]: null,
            [`${AVSM}/15`]: null,
        });
        expect(decoded.microphoneMuted).to.equal(undefined);
        expect(decoded.statusLightEnabled).to.equal(undefined);
        expect(decoded.hardPrivacyModeOn).to.equal(undefined);
        expect(decoded.nightVision).to.equal(undefined);
        expect(decoded.allocatedStreams.video).to.equal(undefined);
    });

    it("names every TriStateAutoEnum value", () => {
        expect(NIGHT_VISION_NAMES).to.deep.equal({ 0: "Off", 1: "On", 2: "Auto" });
    });
});

describe("cameraSwitches", () => {
    it("lists the supported switches with the inverted mute switches", () => {
        expect(cameraSwitches(info(ALL_SETTINGS))).to.deep.equal([
            { setting: "microphoneMuted", label: "Microphone", section: "general", inverted: true, on: false },
            { setting: "speakerMuted", label: "Speaker", section: "general", inverted: true, on: true },
            { setting: "hdrModeEnabled", label: "HDR", section: "general", inverted: false, on: true },
            { setting: "statusLightEnabled", label: "Status light", section: "general", inverted: false, on: false },
            {
                setting: "softRecordingPrivacyModeEnabled",
                label: "Recording privacy",
                section: "privacy",
                inverted: false,
                on: true,
            },
            {
                setting: "softLivestreamPrivacyModeEnabled",
                label: "Live view privacy",
                section: "privacy",
                inverted: false,
                on: false,
            },
        ]);
    });

    it("leaves a switch with an unknown value without state", () => {
        const switches = cameraSwitches(info({ [FEATURE_MAP]: 0b1 }));
        expect(switches).to.deep.equal([
            { setting: "microphoneMuted", label: "Microphone", section: "general", inverted: true, on: undefined },
        ]);
    });

    it("leaves out unsupported switches and a status light that is not reported", () => {
        expect(cameraSwitches(info({ [FEATURE_MAP]: 0 }))).to.deep.equal([]);
    });

    it("writes the inverted value for a mute switch", () => {
        const [microphone, , hdr] = cameraSwitches(info(ALL_SETTINGS));
        expect(switchWriteValue(microphone, true)).to.equal(false);
        expect(switchWriteValue(microphone, false)).to.equal(true);
        expect(switchWriteValue(hdr, true)).to.equal(true);
        expect(switchWriteValue(hdr, false)).to.equal(false);
    });
});

describe("writeCameraSetting", () => {
    function client(status: number) {
        const writes = new Array<{ nodeId: number | bigint; path: string; value: unknown }>();
        return {
            writes,
            writeAttribute: (nodeId: number | bigint, path: string, value: unknown) => {
                writes.push({ nodeId, path, value });
                return Promise.resolve([{ Path: { EndpointId: 1, ClusterId: 1361, AttributeId: 0 }, Status: status }]);
            },
        };
    }

    it("writes each setting to its attribute", async () => {
        const mock = client(0);
        await writeCameraSetting(mock, 7, 1, "microphoneMuted", true);
        await writeCameraSetting(mock, 7, 1, "speakerMuted", false);
        await writeCameraSetting(mock, 7, 1, "hdrModeEnabled", true);
        await writeCameraSetting(mock, 7, 1, "statusLightEnabled", false);
        await writeCameraSetting(mock, 7, 1, "softRecordingPrivacyModeEnabled", true);
        await writeCameraSetting(mock, 7, 1, "softLivestreamPrivacyModeEnabled", false);
        await writeCameraSetting(mock, 7, 1, "nightVision", 2);
        expect(mock.writes).to.deep.equal([
            { nodeId: 7, path: "1/1361/29", value: true },
            { nodeId: 7, path: "1/1361/25", value: false },
            { nodeId: 7, path: "1/1361/13", value: true },
            { nodeId: 7, path: "1/1361/39", value: false },
            { nodeId: 7, path: "1/1361/19", value: true },
            { nodeId: 7, path: "1/1361/20", value: false },
            { nodeId: 7, path: "1/1361/22", value: 2 },
        ]);
    });

    it("rejects with the attribute name when the device refuses the write", async () => {
        const error = await writeCameraSetting(client(0x87), 7, 1, "nightVision", 3).then(
            () => undefined,
            (err: unknown) => err,
        );
        expect(error).to.be.instanceOf(Error);
        expect(String(error)).to.contain("Writing the NightVision attribute failed: ConstraintError (135)");
    });
});
