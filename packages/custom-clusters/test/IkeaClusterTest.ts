/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Matter } from "@matter/main/model";
import "../src/register.js";

describe("IKEA ValveCalibration cluster", () => {
    it("registers the read-only status attributes and the calibration command", () => {
        const cluster = Matter.clusters.find(model => model.id === 0x117cfc01);
        expect(cluster, "cluster 0x117cfc01 is registered").to.exist;

        expect(
            [...(cluster?.attributes ?? [])]
                .filter(attribute => !attribute.isGlobal)
                .map(attribute => [attribute.id, attribute.name, attribute.effectiveMetatype, attribute.writable]),
        ).to.deep.equal([
            [0x0000, "calibrationStatus", "enum", false],
            [0x0001, "lastCalibrationError", "enum", false],
        ]);
        expect(
            [...(cluster?.commands ?? [])].map(command => [
                command.id,
                command.name,
                command.isResponse,
                command.children.length,
            ]),
        ).to.deep.equal([[0x00, "triggerCalibration", false, 0]]);
    });
});
