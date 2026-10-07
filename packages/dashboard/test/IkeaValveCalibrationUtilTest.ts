/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { CALIBRATION_IN_PROGRESS, valveCalibrationInfo } from "../src/util/ikea-valve-calibration.js";

const CLUSTER = 0x117cfc01;

describe("IKEA valve calibration util", () => {
    it("leaves both fields undefined when the attributes are absent", () => {
        expect(valveCalibrationInfo({}, 1)).to.deep.equal({ status: undefined, lastError: undefined });
    });

    it("decodes the status and a cleared error", () => {
        const info = valveCalibrationInfo({ [`1/${CLUSTER}/0`]: 2, [`1/${CLUSTER}/1`]: 0 }, 1);
        expect(info.status).to.deep.equal({ value: 2, label: "Calibrated" });
        expect(info.lastError).to.deep.equal({ value: 0, label: "No error", isError: false });
    });

    it("flags a calibration error", () => {
        const info = valveCalibrationInfo({ [`1/${CLUSTER}/0`]: 0, [`1/${CLUSTER}/1`]: 2 }, 1);
        expect(info.status?.label).to.equal("Not calibrated");
        expect(info.lastError).to.deep.equal({ value: 2, label: "E2", isError: true });
    });

    it("labels values outside the documented range", () => {
        const info = valveCalibrationInfo({ [`1/${CLUSTER}/0`]: 7, [`1/${CLUSTER}/1`]: 9 }, 1);
        expect(info.status?.label).to.equal("Unknown (7)");
        expect(info.lastError?.label).to.equal("Unknown (9)");
        expect(info.lastError?.isError).to.equal(true);
    });

    it("decodes an in-progress calibration with error E1 on the requested endpoint", () => {
        const info = valveCalibrationInfo({ [`2/${CLUSTER}/0`]: 1, [`2/${CLUSTER}/1`]: 1n }, 2);
        expect(info.status).to.deep.equal({ value: 1, label: "In progress" });
        expect(CALIBRATION_IN_PROGRESS).to.equal(1);
        expect(info.lastError).to.deep.equal({ value: 1, label: "E1", isError: true });
    });

    it("reads only the requested endpoint", () => {
        const info = valveCalibrationInfo({ [`2/${CLUSTER}/0`]: 1 }, 1);
        expect(info.status).to.equal(undefined);
    });
});
