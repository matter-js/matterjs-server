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
    serviceAreaInfo,
} from "../src/util/service-area.js";

/**
 * AreaStruct/MapStruct/ProgressStruct entries are field-tag keyed: AreaStruct "0" AreaID, "1" MapID,
 * "2" AreaInfo (whose "0" LocationInfo carries "0" LocationName, "1" FloorNumber); MapStruct "0" MapID,
 * "1" Name; ProgressStruct "0" AreaID, "1" Status, "2" TotalOperationalTime, "3" EstimatedTime.
 */
const SERVICE_AREA_ATTRS: Record<string, unknown> = {
    "1/336/0": [
        { "0": 1, "1": 10, "2": { "0": { "0": "Kitchen", "1": 0 } } },
        { "0": 2, "1": 10, "2": { "0": { "0": "Living Room" } } },
        { "0": 3 },
    ],
    "1/336/1": [{ "0": 10, "1": "Ground Floor" }],
    "1/336/3": 1,
    "1/336/4": 1234,
    "1/336/5": [
        { "0": 1, "1": 1, "2": 30, "3": 90 },
        { "0": 2, "1": 3 },
    ],
    "1/336/65532": 0b111,
};

describe("service area util", () => {
    it("reports no supported areas/maps when the attributes are absent", () => {
        const info = serviceAreaInfo({}, 1);
        expect(info.supportedAreas).to.deep.equal([]);
        expect(info.supportedMaps).to.deep.equal([]);
        expect(info.progress).to.deep.equal([]);
        expect(info.currentArea).to.equal(undefined);
        expect(info.estimatedEndTime).to.equal(undefined);
        expect(info.features).to.deep.equal({ selectWhileRunning: false, progressReporting: false, maps: false });
    });

    it("decodes the FeatureMap bits", () => {
        const info = serviceAreaInfo(SERVICE_AREA_ATTRS, 1);
        expect(info.features).to.deep.equal({ selectWhileRunning: true, progressReporting: true, maps: true });
    });

    it("decodes supported areas with their map and location info", () => {
        const info = serviceAreaInfo(SERVICE_AREA_ATTRS, 1);
        expect(info.supportedAreas).to.deep.equal([
            { areaId: 1, mapId: 10, locationName: "Kitchen", floorNumber: 0 },
            { areaId: 2, mapId: 10, locationName: "Living Room", floorNumber: undefined },
            { areaId: 3, mapId: undefined, locationName: undefined, floorNumber: undefined },
        ]);
    });

    it("decodes supported maps", () => {
        const info = serviceAreaInfo(SERVICE_AREA_ATTRS, 1);
        expect(info.supportedMaps).to.deep.equal([{ mapId: 10, name: "Ground Floor" }]);
    });

    it("falls back to a generated label for a supported map without one", () => {
        const info = serviceAreaInfo({ "1/336/1": [{ "0": 7 }] }, 1);
        expect(info.supportedMaps[0].name).to.equal("Map 7");
    });

    it("decodes progress entries and names their operational status", () => {
        const info = serviceAreaInfo(SERVICE_AREA_ATTRS, 1);
        expect(info.progress).to.deep.equal([
            { areaId: 1, status: "Operating", totalOperationalTime: 30, estimatedTime: 90 },
            { areaId: 2, status: "Completed", totalOperationalTime: undefined, estimatedTime: undefined },
        ]);
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

describe("areaLabel", () => {
    it("uses the location name when present", () => {
        expect(areaLabel({ areaId: 1, locationName: "Kitchen" })).to.equal("Kitchen");
    });

    it("falls back to a generated label without a location name", () => {
        expect(areaLabel({ areaId: 5 })).to.equal("Area 5");
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

    it("rejects a response carrying no status instead of reporting Success", () => {
        expect(() => decodeSkipAreaResult({})).to.throw("without a status");
    });
});
