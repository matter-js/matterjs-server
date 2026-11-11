/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { formatHoldTimeLimits, occupancySensingInfo } from "../src/util/occupancy-sensing.js";

const OCC = "1/1030";

function info(attributes: Record<string, unknown>) {
    return occupancySensingInfo(attributes, 1);
}

describe("occupancySensingInfo", () => {
    it("decodes a revision 5+ sensor", () => {
        expect(
            info({
                [`${OCC}/65532`]: 0b10_0010,
                [`${OCC}/0`]: 1,
                [`${OCC}/1`]: 0,
                [`${OCC}/3`]: 90,
                [`${OCC}/4`]: { "0": 10, "1": 3600, "2": 60 },
            }),
        ).to.deep.equal({
            supported: true,
            occupied: true,
            sensorTypes: ["Passive infrared", "Radar"],
            holdTimeS: 90,
            holdTimeLimits: { minS: 10, maxS: 3600, defaultS: 60 },
        });
    });

    it("accepts bigint values", () => {
        const decoded = info({ [`${OCC}/65532`]: BigInt(0b100), [`${OCC}/0`]: BigInt(1), [`${OCC}/3`]: BigInt(30) });
        expect(decoded.occupied).to.equal(true);
        expect(decoded.sensorTypes).to.deep.equal(["Ultrasonic"]);
        expect(decoded.holdTimeS).to.equal(30);
    });

    it("reports unsupported when the FeatureMap is absent or was removed (null)", () => {
        expect(info({ [`${OCC}/0`]: 1 }).supported).to.equal(false);
        expect(info({ [`${OCC}/65532`]: null, [`${OCC}/0`]: 1 }).supported).to.equal(false);
    });

    describe("occupied", () => {
        it("is false when bit 0 is clear", () => {
            expect(info({ [`${OCC}/65532`]: 0, [`${OCC}/0`]: 0 }).occupied).to.equal(false);
        });
        it("ignores bits above bit 0", () => {
            expect(info({ [`${OCC}/65532`]: 0, [`${OCC}/0`]: 0b110 }).occupied).to.equal(false);
        });
        it("is undefined when not reported or removed", () => {
            expect(info({ [`${OCC}/65532`]: 0 }).occupied).to.equal(undefined);
            expect(info({ [`${OCC}/65532`]: 0, [`${OCC}/0`]: null }).occupied).to.equal(undefined);
        });
    });

    describe("sensorTypes", () => {
        it("names every modality feature bit", () => {
            expect(info({ [`${OCC}/65532`]: 0xff }).sensorTypes).to.deep.equal([
                "Other sensing",
                "Passive infrared",
                "Ultrasonic",
                "Physical contact",
                "Active infrared",
                "Radar",
                "RF sensing",
                "Vision",
            ]);
        });

        it("uses the features, not the legacy PIR value, for a radar-only sensor", () => {
            expect(info({ [`${OCC}/65532`]: 0b10_0000, [`${OCC}/1`]: 0 }).sensorTypes).to.deep.equal(["Radar"]);
        });

        it("does not treat the OccupancyEvent feature bit as a modality", () => {
            expect(info({ [`${OCC}/65532`]: 1 << 9, [`${OCC}/1`]: 1 }).sensorTypes).to.deep.equal(["Ultrasonic"]);
        });

        it("falls back to OccupancySensorTypeBitmap when no modality bit is set", () => {
            const types = (bitmap: unknown) =>
                info({ [`${OCC}/65532`]: 0, [`${OCC}/1`]: 0, [`${OCC}/2`]: bitmap }).sensorTypes;
            expect(types(0b101)).to.deep.equal(["Passive infrared", "Physical contact"]);
            expect(types(0b010)).to.deep.equal(["Ultrasonic"]);
            expect(types(0b111)).to.deep.equal(["Passive infrared", "Ultrasonic", "Physical contact"]);
            expect(types(0)).to.deep.equal([]);
        });

        it("skips a removed (null) OccupancySensorTypeBitmap", () => {
            expect(info({ [`${OCC}/65532`]: 0, [`${OCC}/1`]: 1, [`${OCC}/2`]: null }).sensorTypes).to.deep.equal([
                "Ultrasonic",
            ]);
        });

        it("falls back to OccupancySensorType when neither modality bits nor the bitmap are reported", () => {
            const types = (sensorType: unknown) => info({ [`${OCC}/65532`]: 0, [`${OCC}/1`]: sensorType }).sensorTypes;
            expect(types(0)).to.deep.equal(["Passive infrared"]);
            expect(types(1)).to.deep.equal(["Ultrasonic"]);
            expect(types(2)).to.deep.equal(["Passive infrared", "Ultrasonic"]);
            expect(types(3)).to.deep.equal(["Physical contact"]);
            expect(types(9)).to.deep.equal(["Unknown (9)"]);
            expect(types(undefined)).to.deep.equal([]);
            expect(types(null)).to.deep.equal([]);
        });
    });

    describe("hold time", () => {
        it("is undefined when not reported", () => {
            const decoded = info({ [`${OCC}/65532`]: 0 });
            expect(decoded.holdTimeS).to.equal(undefined);
            expect(decoded.holdTimeLimits).to.equal(undefined);
        });

        it("is undefined when removed (null)", () => {
            const decoded = info({ [`${OCC}/65532`]: 0, [`${OCC}/3`]: null, [`${OCC}/4`]: null });
            expect(decoded.holdTimeS).to.equal(undefined);
            expect(decoded.holdTimeLimits).to.equal(undefined);
        });

        it("keeps a partly reported limits struct", () => {
            expect(info({ [`${OCC}/65532`]: 0, [`${OCC}/4`]: { "1": 600 } }).holdTimeLimits).to.deep.equal({
                minS: undefined,
                maxS: 600,
                defaultS: undefined,
            });
        });
    });
});

describe("formatHoldTimeLimits", () => {
    it("formats all fields", () => {
        expect(formatHoldTimeLimits({ minS: 10, maxS: 3600, defaultS: 90 })).to.equal(
            "min 10 s, max 1 h, default 1 min 30 s",
        );
    });

    it("leaves out absent fields", () => {
        expect(formatHoldTimeLimits({ maxS: 600 })).to.equal("max 10 min");
    });
});
