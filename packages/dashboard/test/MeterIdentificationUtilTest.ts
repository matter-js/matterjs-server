/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { meterIdentificationInfo } from "../src/util/meter-identification.js";

/** PowerThresholdStruct is field-tag keyed: "0" PowerThreshold (mW), "1" ApparentPowerThreshold (mVA), "2" Source. */
const METER_ATTRS: Record<string, unknown> = {
    "1/2822/0": 0, // MeterType Utility
    "1/2822/1": "POD-12345",
    "1/2822/2": "SN-98765",
    "1/2822/3": "1.0",
    "1/2822/4": { "0": 9_000_000n, "1": 9_500_000n, "2": 0 },
    "1/2822/65532": 0b1, // PWRTHLD
};

describe("meter identification util", () => {
    it("reports unsupported when the cluster is absent", () => {
        const info = meterIdentificationInfo({ "1/40/5": "label" }, 1);
        expect(info.supported).to.equal(false);
        expect(info.powerThresholdSupported).to.equal(false);
    });

    it("reports unsupported when the FeatureMap was removed (null)", () => {
        const info = meterIdentificationInfo({ "1/2822/65532": null }, 1);
        expect(info.supported).to.equal(false);
    });

    it("decodes identification strings and the meter type", () => {
        const info = meterIdentificationInfo(METER_ATTRS, 1);
        expect(info.supported).to.equal(true);
        expect(info.meterType).to.equal("Utility");
        expect(info.pointOfDelivery).to.equal("POD-12345");
        expect(info.meterSerialNumber).to.equal("SN-98765");
        expect(info.protocolVersion).to.equal("1.0");
    });

    it("converts mW and mVA thresholds to W and VA", () => {
        const info = meterIdentificationInfo(METER_ATTRS, 1);
        expect(info.powerThresholdSupported).to.equal(true);
        expect(info.powerThreshold?.powerThresholdW).to.equal(9000);
        expect(info.powerThreshold?.apparentPowerThresholdVA).to.equal(9500);
        expect(info.powerThreshold?.source).to.equal("Contract");
    });

    it("names an unknown threshold source", () => {
        const info = meterIdentificationInfo({ ...METER_ATTRS, "1/2822/4": { "0": 1000, "2": 9 } }, 1);
        expect(info.powerThreshold?.source).to.equal("Unknown (9)");
        expect(info.powerThreshold?.apparentPowerThresholdVA).to.equal(undefined);
    });

    it("reports the feature as unsupported when the bit is clear", () => {
        const info = meterIdentificationInfo({ ...METER_ATTRS, "1/2822/65532": 0 }, 1);
        expect(info.supported).to.equal(true);
        expect(info.powerThresholdSupported).to.equal(false);
    });

    it("reads the number form of the threshold fields, which is what the wire carries", () => {
        const info = meterIdentificationInfo({ ...METER_ATTRS, "1/2822/4": { "0": 4600, "1": 5000, "2": 2 } }, 1);
        expect(info.powerThreshold?.powerThresholdW).to.equal(4.6);
        expect(info.powerThreshold?.apparentPowerThresholdVA).to.equal(5);
        expect(info.powerThreshold?.source).to.equal("Meter equipment limit");
    });

    it("drops a threshold no number can hold exactly instead of rounding it", () => {
        const info = meterIdentificationInfo(
            { ...METER_ATTRS, "1/2822/4": { "0": 9_007_199_254_740_993n, "1": 5000, "2": 0 } },
            1,
        );
        expect(info.powerThreshold?.powerThresholdW).to.equal(undefined);
        expect(info.powerThreshold?.apparentPowerThresholdVA).to.equal(5);
    });

    it("treats a struct whose fields are all null as absent", () => {
        const info = meterIdentificationInfo({ ...METER_ATTRS, "1/2822/4": { "0": null, "1": null, "2": null } }, 1);
        expect(info.powerThreshold).to.equal(undefined);
    });

    it("treats a null threshold struct and blank strings as absent", () => {
        const info = meterIdentificationInfo(
            { ...METER_ATTRS, "1/2822/3": "  ", "1/2822/4": null, "1/2822/0": null },
            1,
        );
        expect(info.protocolVersion).to.equal(undefined);
        expect(info.meterType).to.equal(undefined);
        expect(info.powerThreshold).to.equal(undefined);
    });
});
