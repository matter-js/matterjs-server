/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    SERVICE_AREA_CLUSTER_ID,
    areaLabel,
    decodeSelectAreasResult,
    decodeSkipAreaResult,
    describeOperationalStatus,
    isSkippable,
    remainingSeconds,
    remainingTimeLabel,
    serviceAreaInfo,
} from "../src/util/service-area.js";
import { MATTER_EPOCH_OFFSET_SECONDS } from "../src/util/time.js";

/**
 * AreaStruct/MapStruct/ProgressStruct entries are field-tag keyed: AreaStruct "0" AreaID, "1" MapID,
 * "2" AreaInfo (whose "0" LocationInfo carries "0" LocationName, "1" FloorNumber, "2" AreaType, and whose
 * "1" LandmarkInfo carries "0" LandmarkTag, "1" RelativePositionTag); MapStruct "0" MapID, "1" Name;
 * ProgressStruct "0" AreaID, "1" Status, "2" TotalOperationalTime, "3" EstimatedTime.
 */
const SERVICE_AREA_ATTRS: Record<string, unknown> = {
    "1/336/0": [
        { "0": 1, "1": 10, "2": { "0": { "0": "Kitchen", "1": 0 } } },
        { "0": 2, "1": 10, "2": { "0": { "0": "Living Room" } } },
        { "0": 3 },
    ],
    "1/336/1": [{ "0": 10, "1": "Ground Floor" }],
    "1/336/2": [1, 2],
    "1/336/3": 1,
    "1/336/4": 1234,
    "1/336/5": [
        { "0": 1, "1": 1, "2": 30, "3": 90 },
        { "0": 2, "1": 3 },
    ],
    "1/336/65529": [0, 2],
    "1/336/65532": 0b111,
};

describe("service area util", () => {
    it("reports no supported areas/maps when the attributes are absent", () => {
        const info = serviceAreaInfo({}, 1);
        expect(info.supportedAreas).to.deep.equal([]);
        expect(info.supportedMaps).to.deep.equal([]);
        expect(info.selectedAreas).to.deep.equal([]);
        expect(info.progress).to.deep.equal([]);
        expect(info.currentArea).to.equal(undefined);
        expect(info.estimatedEndTime).to.equal(undefined);
        expect(info.features).to.deep.equal({ selectWhileRunning: false, progressReporting: false, maps: false });
        expect(info.commands).to.deep.equal({ selectAreas: true, skipArea: false });
    });

    it("decodes the FeatureMap bits", () => {
        const info = serviceAreaInfo(SERVICE_AREA_ATTRS, 1);
        expect(info.features).to.deep.equal({ selectWhileRunning: true, progressReporting: true, maps: true });
    });

    it("maps each FeatureMap bit to its own feature", () => {
        expect(serviceAreaInfo({ "1/336/65532": 0b001 }, 1).features).to.deep.equal({
            selectWhileRunning: true,
            progressReporting: false,
            maps: false,
        });
        expect(serviceAreaInfo({ "1/336/65532": 0b010 }, 1).features).to.deep.equal({
            selectWhileRunning: false,
            progressReporting: true,
            maps: false,
        });
        expect(serviceAreaInfo({ "1/336/65532": 0b100 }, 1).features).to.deep.equal({
            selectWhileRunning: false,
            progressReporting: false,
            maps: true,
        });
    });

    it("decodes supported areas with their map and location info", () => {
        const info = serviceAreaInfo(SERVICE_AREA_ATTRS, 1);
        expect(info.supportedAreas).to.deep.equal([
            {
                areaId: 1,
                mapId: 10,
                locationName: "Kitchen",
                floorNumber: 0,
                areaTypeTag: undefined,
                landmarkTag: undefined,
                relativePositionTag: undefined,
            },
            {
                areaId: 2,
                mapId: 10,
                locationName: "Living Room",
                floorNumber: undefined,
                areaTypeTag: undefined,
                landmarkTag: undefined,
                relativePositionTag: undefined,
            },
            {
                areaId: 3,
                mapId: undefined,
                locationName: undefined,
                floorNumber: undefined,
                areaTypeTag: undefined,
                landmarkTag: undefined,
                relativePositionTag: undefined,
            },
        ]);
    });

    it("drops an area entry that carries no AreaID", () => {
        const info = serviceAreaInfo({ "1/336/0": [{ "1": 10 }, { "0": 4 }] }, 1);
        expect(info.supportedAreas.map(area => area.areaId)).to.deep.equal([4]);
    });

    it("decodes supported maps", () => {
        const info = serviceAreaInfo(SERVICE_AREA_ATTRS, 1);
        expect(info.supportedMaps).to.deep.equal([{ mapId: 10, name: "Ground Floor" }]);
    });

    it("falls back to a generated label for a supported map without one", () => {
        const info = serviceAreaInfo({ "1/336/1": [{ "0": 7 }] }, 1);
        expect(info.supportedMaps[0].name).to.equal("Map 7");
    });

    it("decodes the areas the device itself has selected", () => {
        const info = serviceAreaInfo(SERVICE_AREA_ATTRS, 1);
        expect(info.selectedAreas).to.deep.equal([1, 2]);
    });

    it("reports command support from AcceptedCommandList, not from the feature bits", () => {
        expect(serviceAreaInfo(SERVICE_AREA_ATTRS, 1).commands).to.deep.equal({ selectAreas: true, skipArea: true });
        // PROG set but SkipArea not accepted: the feature bit alone must not offer the command.
        expect(serviceAreaInfo({ "1/336/65532": 0b010, "1/336/65529": [0] }, 1).commands).to.deep.equal({
            selectAreas: true,
            skipArea: false,
        });
        // SkipArea accepted without PROG, which its `[CurrentArea | Progress]` conformance allows.
        expect(serviceAreaInfo({ "1/336/65529": [0, 2] }, 1).commands).to.deep.equal({
            selectAreas: true,
            skipArea: true,
        });
    });

    it("falls back to SkipArea's conformance when the device reports no AcceptedCommandList", () => {
        expect(serviceAreaInfo({}, 1).commands.skipArea).to.equal(false);
        expect(serviceAreaInfo({ "1/336/65532": 0b010 }, 1).commands.skipArea).to.equal(true);
        expect(serviceAreaInfo({ "1/336/3": 4 }, 1).commands.skipArea).to.equal(true);
    });

    it("decodes progress entries with their numeric operational status", () => {
        const info = serviceAreaInfo(SERVICE_AREA_ATTRS, 1);
        expect(info.progress).to.deep.equal([
            { areaId: 1, status: 1, totalOperationalTime: 30, estimatedTime: 90 },
            { areaId: 2, status: 3, totalOperationalTime: undefined, estimatedTime: undefined },
        ]);
    });

    it("drops a progress entry that carries no AreaID", () => {
        const info = serviceAreaInfo({ "1/336/5": [{ "1": 1 }, { "0": 8, "1": 0 }] }, 1);
        expect(info.progress.map(entry => entry.areaId)).to.deep.equal([8]);
    });

    it("reads the current area and estimated end time", () => {
        const info = serviceAreaInfo(SERVICE_AREA_ATTRS, 1);
        expect(info.currentArea).to.equal(1);
        expect(info.estimatedEndTime).to.equal(1234);
    });

    it("reports a null estimated end time as null rather than absent", () => {
        const info = serviceAreaInfo({ "1/336/4": null }, 1);
        expect(info.estimatedEndTime).to.equal(null);
    });

    it("has the standard ServiceArea cluster id", () => {
        expect(SERVICE_AREA_CLUSTER_ID).to.equal(336);
    });
});

describe("describeOperationalStatus", () => {
    it("names each status and gives it a CSS-safe key", () => {
        expect(describeOperationalStatus(0)).to.deep.equal({ label: "Pending", key: "pending" });
        expect(describeOperationalStatus(1)).to.deep.equal({ label: "Operating", key: "operating" });
        expect(describeOperationalStatus(2)).to.deep.equal({ label: "Skipped", key: "skipped" });
        expect(describeOperationalStatus(3)).to.deep.equal({ label: "Completed", key: "completed" });
    });

    it("keeps an unrecognized status out of the CSS key", () => {
        expect(describeOperationalStatus(7)).to.deep.equal({ label: "Unknown (7)", key: "unknown" });
    });

    it("reports a missing status as unknown", () => {
        expect(describeOperationalStatus(undefined)).to.deep.equal({ label: "Unknown", key: "unknown" });
    });
});

describe("isSkippable", () => {
    const info = (attributes: Record<string, unknown>) => serviceAreaInfo(attributes, 1);

    it("offers Skip only where the device accepts SkipArea", () => {
        const attributes = { "1/336/5": [{ "0": 1, "1": 1 }] };
        expect(isSkippable(info({ ...attributes, "1/336/65529": [0] }), 1)).to.equal(false);
        expect(isSkippable(info({ ...attributes, "1/336/65529": [0, 2] }), 1)).to.equal(true);
    });

    it("offers Skip for a queued area, not only for the running one", () => {
        const skippable = info({
            "1/336/65529": [0, 2],
            "1/336/5": [
                { "0": 1, "1": 0 },
                { "0": 2, "1": 1 },
                { "0": 3, "1": 2 },
                { "0": 4, "1": 3 },
            ],
        });
        expect([1, 2, 3, 4].map(areaId => isSkippable(skippable, areaId))).to.deep.equal([true, true, false, false]);
    });

    it("falls back to the current area when the device reports no progress", () => {
        // Confirmed against real hardware: being merely selected is not enough — the device rejects
        // SkipArea with InvalidInMode ("the skipped area does not match the current area") for a
        // selected-but-not-current area when it reports no Progress entry for it.
        const withoutProgress = info({ "1/336/65529": [0, 2], "1/336/2": [5, 6], "1/336/3": 5 });
        expect(isSkippable(withoutProgress, 5)).to.equal(true);
        expect(isSkippable(withoutProgress, 6)).to.equal(false);
    });

    it("does not offer Skip for a Pending area while nothing is Operating", () => {
        // Confirmed against real hardware: SkipArea on a Pending area is rejected with InvalidInMode
        // until the device has actually started operating.
        const idle = info({
            "1/336/65529": [0, 2],
            "1/336/5": [
                { "0": 1, "1": 0 },
                { "0": 2, "1": 0 },
            ],
        });
        expect(isSkippable(idle, 1)).to.equal(false);
        expect(isSkippable(idle, 2)).to.equal(false);
    });
});

describe("areaLabel", () => {
    it("uses the location name when present", () => {
        expect(areaLabel({ areaId: 1, locationName: "Kitchen" })).to.equal("Kitchen");
    });

    it("names an area by its landmark and relative position", () => {
        expect(areaLabel({ areaId: 1, landmarkTag: 0, relativePositionTag: 1 })).to.equal("Next To Air Conditioner");
    });

    it("names an area by its landmark alone when it reports no relative position", () => {
        expect(areaLabel({ areaId: 1, landmarkTag: 2 })).to.equal("Back Door");
    });

    it("names an area by its area type when it has neither a name nor a landmark", () => {
        expect(areaLabel({ areaId: 1, areaTypeTag: 1 })).to.equal("Attic");
    });

    it("falls back to a generated label without any of them", () => {
        expect(areaLabel({ areaId: 5 })).to.equal("Area 5");
    });
});

describe("remainingTimeLabel", () => {
    const nowMs = Date.UTC(2026, 0, 1, 12, 0, 0);
    const epochS = (unixSeconds: number) => unixSeconds - MATTER_EPOCH_OFFSET_SECONDS;

    it("reports the time left until the estimated end", () => {
        expect(remainingTimeLabel(epochS(nowMs / 1000 + 125), nowMs)).to.equal("2 min 5 s left");
    });

    it("drops to seconds under a minute", () => {
        expect(remainingTimeLabel(epochS(nowMs / 1000 + 5), nowMs)).to.equal("5 s left");
    });

    it("counts the seconds left, and stops being positive once the estimate passes", () => {
        expect(remainingSeconds(epochS(nowMs / 1000 + 125), nowMs)).to.equal(125);
        expect(remainingSeconds(epochS(nowMs / 1000), nowMs)).to.equal(0);
        expect(remainingSeconds(epochS(nowMs / 1000 - 1), nowMs)).to.equal(-1);
    });

    it("reports an elapsed estimate as due now", () => {
        expect(remainingTimeLabel(epochS(nowMs / 1000), nowMs)).to.equal("due now");
        expect(remainingTimeLabel(epochS(nowMs / 1000 - 60), nowMs)).to.equal("due now");
    });
});

describe("decodeSelectAreasResult", () => {
    it("decodes a successful name-keyed response without a status text", () => {
        const result = decodeSelectAreasResult({ status: 0 });
        expect(result).to.deep.equal({ success: true, status: 0, statusName: "Success", statusText: undefined });
    });

    it("decodes a rejected response with its status text", () => {
        const result = decodeSelectAreasResult({ status: 1, statusText: "Area does not exist" });
        expect(result.success).to.equal(false);
        expect(result.statusName).to.equal("UnsupportedArea");
        expect(result.statusText).to.equal("Area does not exist");
    });

    it("names an unrecognized status code", () => {
        const result = decodeSelectAreasResult({ status: 9 });
        expect(result.statusName).to.equal("Unknown (9)");
    });

    it("rejects a response carrying no status instead of reporting Success", () => {
        expect(() => decodeSelectAreasResult({})).to.throw("without a status");
        expect(() => decodeSelectAreasResult(null)).to.throw("without a status");
    });
});

describe("decodeSkipAreaResult", () => {
    it("decodes a successful name-keyed response", () => {
        const result = decodeSkipAreaResult({ status: 0 });
        expect(result).to.deep.equal({ success: true, status: 0, statusName: "Success", statusText: undefined });
    });

    it("names each SkipArea failure status", () => {
        expect(decodeSkipAreaResult({ status: 1 }).statusName).to.equal("InvalidAreaList");
        expect(decodeSkipAreaResult({ status: 2 }).statusName).to.equal("InvalidInMode");
        expect(decodeSkipAreaResult({ status: 3 }).statusName).to.equal("InvalidSkippedArea");
    });

    it("names an unrecognized status code", () => {
        expect(decodeSkipAreaResult({ status: 9 }).statusName).to.equal("Unknown (9)");
    });

    it("rejects a response carrying no status instead of reporting Success", () => {
        expect(() => decodeSkipAreaResult({})).to.throw("without a status");
    });
});
