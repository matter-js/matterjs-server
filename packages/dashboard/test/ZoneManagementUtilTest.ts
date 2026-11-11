/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    createOrUpdateTrigger,
    createTwoDCartesianZone,
    parseTriggerForm,
    parseZoneForm,
    removeTrigger,
    removeZone,
    updateTwoDCartesianZone,
    zoneCapacityReached,
    zoneLabel,
    zoneManagementInfo,
    zoneSwatchColor,
    type TriggerForm,
    type ZoneForm,
    type ZoneManagementInfo,
} from "../src/util/zone-management.js";

const ZM = "1/1360";

/** TWODCART | PERZONESENS | USERDEFINED */
const FEATURES = 0b0111;

const ATTRIBUTES = {
    [`${ZM}/65532`]: FEATURES,
    [`${ZM}/0`]: 5,
    [`${ZM}/1`]: 8,
    [`${ZM}/2`]: [
        {
            "0": 1,
            "1": 0,
            "2": 0,
            "3": {
                "0": "Door",
                "1": 0,
                "2": [
                    { "0": 0, "1": 0 },
                    { "0": 100, "1": 0 },
                    { "0": 100, "1": 50 },
                ],
            },
        },
        {
            "0": 2,
            "1": 0,
            "2": 1,
            "3": {
                "0": "Garden",
                "1": 1,
                "2": [
                    { "0": 10, "1": 10 },
                    { "0": 20, "1": 10 },
                    { "0": 20, "1": 20 },
                ],
                "3": "#00FF0080",
            },
        },
    ],
    [`${ZM}/3`]: [{ "0": 1, "1": 10, "2": 5, "3": 60, "4": 2, "5": 3 }],
    [`${ZM}/4`]: 5,
    [`${ZM}/6`]: { "0": 1920, "1": 1080 },
};

function info(attributes: Record<string, unknown> = ATTRIBUTES): ZoneManagementInfo {
    return zoneManagementInfo(attributes, 1);
}

describe("zoneManagementInfo", () => {
    it("decodes features, limits, zones and triggers", () => {
        expect(info()).to.deep.equal({
            supported: true,
            features: { twoDCartesian: true, perZoneSensitivity: true, userDefined: true, focusZones: false },
            maxZones: 8,
            maxUserDefinedZones: 5,
            sensitivityMax: 5,
            sensitivity: undefined,
            twoDCartesianMax: { x: 1920, y: 1080 },
            zones: [
                {
                    zoneId: 1,
                    zoneType: 0,
                    zoneSource: 0,
                    twoDCartesianZone: {
                        name: "Door",
                        use: 0,
                        vertices: [
                            { x: 0, y: 0 },
                            { x: 100, y: 0 },
                            { x: 100, y: 50 },
                        ],
                        color: undefined,
                    },
                },
                {
                    zoneId: 2,
                    zoneType: 0,
                    zoneSource: 1,
                    twoDCartesianZone: {
                        name: "Garden",
                        use: 1,
                        vertices: [
                            { x: 10, y: 10 },
                            { x: 20, y: 10 },
                            { x: 20, y: 20 },
                        ],
                        color: "#00FF0080",
                    },
                },
            ],
            triggers: [
                {
                    zoneId: 1,
                    initialDuration: 10,
                    augmentationDuration: 5,
                    maxDuration: 60,
                    blindDuration: 2,
                    sensitivity: 3,
                },
            ],
        });
    });

    it("decodes each feature bit on its own", () => {
        const setFeatures = (bit: number) =>
            Object.entries(info({ [`${ZM}/65532`]: 1 << bit }).features)
                .filter(([, set]) => set)
                .map(([name]) => name);
        expect(setFeatures(0)).to.deep.equal(["twoDCartesian"]);
        expect(setFeatures(1)).to.deep.equal(["perZoneSensitivity"]);
        expect(setFeatures(2)).to.deep.equal(["userDefined"]);
        expect(setFeatures(3)).to.deep.equal(["focusZones"]);
    });

    it("reports unsupported when the FeatureMap is absent or was removed (null)", () => {
        expect(info({}).supported).to.equal(false);
        expect(info({ [`${ZM}/65532`]: null }).supported).to.equal(false);
    });

    it("skips zones and triggers without a ZoneID and treats removed lists as empty", () => {
        const decoded = info({ [`${ZM}/65532`]: 0, [`${ZM}/2`]: [{ "1": 0 }], [`${ZM}/3`]: null });
        expect(decoded.zones).to.deep.equal([]);
        expect(decoded.triggers).to.deep.equal([]);
    });
});

describe("zoneLabel", () => {
    it("uses the zone name, else the id", () => {
        const [door] = info().zones;
        expect(zoneLabel(door)).to.equal("Door");
        expect(zoneLabel({ zoneId: 7, zoneType: 0, zoneSource: 0 })).to.equal("Zone 7");
        const unnamed = { ...door, twoDCartesianZone: { name: "  ", use: 0, vertices: [] } };
        expect(zoneLabel(unnamed)).to.equal("Zone 1");
    });
});

describe("zoneCapacityReached", () => {
    it("is reached at MaxZones or at MaxUserDefinedZones user zones", () => {
        expect(zoneCapacityReached(info())).to.equal(false);
        expect(zoneCapacityReached({ ...info(), maxZones: 2 })).to.equal(true);
        expect(zoneCapacityReached({ ...info(), maxUserDefinedZones: 1 })).to.equal(true);
    });

    it("counts only user-defined zones against MaxUserDefinedZones", () => {
        const [mfgZone] = info().zones;
        const twoMfgZones = { ...info(), zones: [mfgZone, { ...mfgZone, zoneId: 3 }], maxUserDefinedZones: 1 };
        expect(zoneCapacityReached(twoMfgZones)).to.equal(false);
    });
});

describe("zoneSwatchColor", () => {
    it("accepts only hex notation and drops the alpha digits", () => {
        expect(zoneSwatchColor("#00FF0080")).to.equal("#00FF00");
        expect(zoneSwatchColor("#00ff00")).to.equal("#00ff00");
        expect(zoneSwatchColor("red;background:url(x)")).to.equal(undefined);
        expect(zoneSwatchColor(undefined)).to.equal(undefined);
    });
});

describe("parseZoneForm", () => {
    const valid: ZoneForm = { name: " Porch ", use: "0", vertices: "0,0\n 100 , 0 \n\n100,50", color: "" };

    it("returns the zone to send", () => {
        expect(parseZoneForm(valid, info(), false)).to.deep.equal({
            value: {
                name: "Porch",
                use: 0,
                vertices: [
                    { x: 0, y: 0 },
                    { x: 100, y: 0 },
                    { x: 100, y: 50 },
                ],
                color: undefined,
            },
        });
        expect(parseZoneForm({ ...valid, color: "#00FFFF80" }, info(), false).value?.color).to.equal("#00FFFF80");
    });

    it("accepts an empty name and rejects one longer than 32 bytes", () => {
        expect(parseZoneForm({ ...valid, name: "  " }, info(), false).value?.name).to.equal("");
        expect(parseZoneForm({ ...valid, name: "x".repeat(32) }, info(), false).error).to.equal(undefined);
        expect(parseZoneForm({ ...valid, name: "x".repeat(33) }, info(), false).error).to.equal(
            "The name is longer than 32 bytes.",
        );
        expect(parseZoneForm({ ...valid, name: "ä".repeat(17) }, info(), false).error).to.equal(
            "The name is longer than 32 bytes.",
        );
    });

    it("rejects Focus without the FocusZones feature and unknown uses", () => {
        const error = "Select a use the device supports.";
        expect(parseZoneForm({ ...valid, use: "2" }, info(), false).error).to.equal(error);
        expect(parseZoneForm({ ...valid, use: "3" }, info(), false).error).to.equal(error);
        const focusInfo = { ...info(), features: { ...info().features, focusZones: true } };
        expect(parseZoneForm({ ...valid, use: "2" }, focusInfo, false).value?.use).to.equal(2);
    });

    it("needs 3 to 12 vertices", () => {
        const error = 'Enter 3 to 12 vertices, one "x,y" pair per line.';
        const lines = (count: number) => Array.from({ length: count }, (_, i) => `${i},0`).join("\n");
        expect(parseZoneForm({ ...valid, vertices: lines(2) }, info(), false).error).to.equal(error);
        expect(parseZoneForm({ ...valid, vertices: lines(12) }, info(), false).error).to.equal(undefined);
        expect(parseZoneForm({ ...valid, vertices: lines(13) }, info(), false).error).to.equal(error);
    });

    it("rejects vertices outside 0..TwoDCartesianMax and malformed pairs", () => {
        const withLast = (last: string) =>
            parseZoneForm({ ...valid, vertices: `0,0\n10,0\n${last}` }, info(), false).error;
        expect(withLast("1920,1080")).to.equal(undefined);
        expect(withLast("1921,0")).to.equal('"1921,0" is not a vertex from 0,0 to 1920,1080.');
        expect(withLast("0,1081")).to.equal('"0,1081" is not a vertex from 0,0 to 1920,1080.');
        expect(withLast("-1,0")).to.equal('"-1,0" is not a vertex from 0,0 to 1920,1080.');
        expect(withLast("1.5,0")).to.equal('"1.5,0" is not a vertex from 0,0 to 1920,1080.');
        expect(withLast("1,2,3")).to.equal('"1,2,3" is not a vertex from 0,0 to 1920,1080.');
    });

    it("uses the uint16 range when TwoDCartesianMax is not reported", () => {
        const noMax = { ...info(), twoDCartesianMax: undefined };
        const withLast = (last: string) =>
            parseZoneForm({ ...valid, vertices: `0,0\n10,0\n${last}` }, noMax, false).error;
        expect(withLast("65535,65535")).to.equal(undefined);
        expect(withLast("65536,0")).to.equal('"65536,0" is not a vertex from 0,0 to 65535,65535.');
    });

    it("rejects a new zone when the zone capacity is reached, but still allows an update", () => {
        const full = { ...info(), maxUserDefinedZones: 1 };
        expect(parseZoneForm(valid, full, true).error).to.equal("The device has no free slot for another zone.");
        expect(parseZoneForm(valid, full, false).error).to.equal(undefined);
        expect(parseZoneForm(valid, info(), true).error).to.equal(undefined);
    });

    it("rejects a color that is not #RRGGBB or #RRGGBBAA", () => {
        const error = "Enter the color as #RRGGBB or #RRGGBBAA.";
        expect(parseZoneForm({ ...valid, color: "#00FF" }, info(), false).error).to.equal(error);
        expect(parseZoneForm({ ...valid, color: "green" }, info(), false).error).to.equal(error);
    });
});

describe("parseTriggerForm", () => {
    const valid: TriggerForm = {
        zoneId: "1",
        initialDuration: "10",
        augmentationDuration: "5",
        maxDuration: "60",
        blindDuration: "0",
        sensitivity: "3",
    };

    it("returns the trigger to send", () => {
        expect(parseTriggerForm(valid, info())).to.deep.equal({
            value: {
                zoneId: 1,
                initialDuration: 10,
                augmentationDuration: 5,
                maxDuration: 60,
                blindDuration: 0,
                sensitivity: 3,
            },
        });
    });

    it("needs an existing Motion zone", () => {
        expect(parseTriggerForm({ ...valid, zoneId: "" }, info()).error).to.equal("Select a zone.");
        expect(parseTriggerForm({ ...valid, zoneId: "9" }, info()).error).to.equal(
            "Zone 9 no longer exists. Select another zone.",
        );
        expect(parseTriggerForm({ ...valid, zoneId: "2" }, info()).error).to.equal(
            "Triggers can only be set on Motion zones.",
        );
        const noShape = { ...info(), zones: [{ zoneId: 5, zoneType: 0, zoneSource: 0 }] };
        expect(parseTriggerForm({ ...valid, zoneId: "5" }, noShape).error).to.equal(undefined);
    });

    it("keeps the durations within the struct constraints", () => {
        const error = (form: Partial<TriggerForm>) => parseTriggerForm({ ...valid, ...form }, info()).error;
        expect(error({ initialDuration: "0" })).to.equal("Enter an initial duration from 1 to 65535 s.");
        expect(error({ initialDuration: "65536" })).to.equal("Enter an initial duration from 1 to 65535 s.");
        expect(error({ augmentationDuration: "10" })).to.equal(undefined);
        expect(error({ augmentationDuration: "11" })).to.equal(
            "Enter an augmentation duration from 0 to 10 s (the initial duration).",
        );
        expect(error({ maxDuration: "10" })).to.equal(undefined);
        expect(error({ maxDuration: "9" })).to.equal("Enter a max duration of at least 10 s (the initial duration).");
        expect(error({ blindDuration: "-1" })).to.equal("Enter a blind duration of 0 s or more.");
        expect(error({ blindDuration: "1.5" })).to.equal("Enter a blind duration of 0 s or more.");
        expect(error({ blindDuration: "4294967295", maxDuration: "4294967295" })).to.equal(undefined);
        expect(error({ blindDuration: "4294967296" })).to.equal("Enter a blind duration of 0 s or more.");
        expect(error({ maxDuration: "4294967296" })).to.equal(
            "Enter a max duration of at least 10 s (the initial duration).",
        );
    });

    it("needs a sensitivity from 1 to SensitivityMax only with PerZoneSensitivity", () => {
        const error = (sensitivity: string) => parseTriggerForm({ ...valid, sensitivity }, info()).error;
        expect(error("5")).to.equal(undefined);
        expect(error("6")).to.equal("Enter a sensitivity from 1 to 5.");
        expect(error("0")).to.equal("Enter a sensitivity from 1 to 5.");

        const noMax = { ...info(), sensitivityMax: undefined };
        expect(parseTriggerForm({ ...valid, sensitivity: "10" }, noMax).error).to.equal(undefined);
        expect(parseTriggerForm({ ...valid, sensitivity: "11" }, noMax).error).to.equal(
            "Enter a sensitivity from 1 to 10.",
        );

        const noPerZone = { ...info(), features: { ...info().features, perZoneSensitivity: false } };
        expect(parseTriggerForm({ ...valid, sensitivity: "" }, noPerZone)).to.deep.equal({
            value: {
                zoneId: 1,
                initialDuration: 10,
                augmentationDuration: 5,
                maxDuration: 60,
                blindDuration: 0,
                sensitivity: undefined,
            },
        });
    });
});

describe("zone commands", () => {
    const zone = { name: "Porch", use: 0, vertices: [{ x: 0, y: 0 }] };

    function client(response: unknown = undefined) {
        const commands = new Array<{ endpoint: number; cluster: number; command: string; payload: unknown }>();
        return {
            commands,
            deviceCommand: (
                _nodeId: number | bigint,
                endpoint: number,
                cluster: number,
                command: string,
                payload?: Record<string, unknown>,
            ) => {
                commands.push({ endpoint, cluster, command, payload });
                return Promise.resolve(response);
            },
        };
    }

    it("sends each command with its payload", async () => {
        const mock = client({ zoneID: 4 });
        await createTwoDCartesianZone(mock, 7, 2, zone);
        await updateTwoDCartesianZone(mock, 7, 2, 4, zone);
        await removeZone(mock, 7, 2, 4);
        const trigger = { zoneId: 4, initialDuration: 10, augmentationDuration: 5, maxDuration: 60, blindDuration: 1 };
        await createOrUpdateTrigger(mock, 7, 2, trigger);
        await createOrUpdateTrigger(mock, 7, 2, { ...trigger, sensitivity: 3 });
        await removeTrigger(mock, 7, 2, 4);
        expect(mock.commands).to.deep.equal([
            { endpoint: 2, cluster: 1360, command: "CreateTwoDCartesianZone", payload: { zone } },
            { endpoint: 2, cluster: 1360, command: "UpdateTwoDCartesianZone", payload: { zoneId: 4, zone } },
            { endpoint: 2, cluster: 1360, command: "RemoveZone", payload: { zoneId: 4 } },
            { endpoint: 2, cluster: 1360, command: "CreateOrUpdateTrigger", payload: { trigger } },
            {
                endpoint: 2,
                cluster: 1360,
                command: "CreateOrUpdateTrigger",
                payload: { trigger: { ...trigger, sensitivity: 3 } },
            },
            { endpoint: 2, cluster: 1360, command: "RemoveTrigger", payload: { zoneId: 4 } },
        ]);
    });

    it("returns the ZoneID from the response, preferring the corrected key", async () => {
        expect(await createTwoDCartesianZone(client({ zoneID: 4, zoneId: 9 }), 1, 1, zone)).to.equal(4);
        expect(await createTwoDCartesianZone(client({ zoneId: 9 }), 1, 1, zone)).to.equal(9);
    });

    it("rejects when the response has no ZoneID", async () => {
        const error = await createTwoDCartesianZone(client({}), 1, 1, zone).then(
            () => undefined,
            (err: unknown) => err,
        );
        expect(String(error)).to.contain("The device did not return a ZoneID");
    });
});
