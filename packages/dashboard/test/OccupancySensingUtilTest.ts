/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterNode, type MatterNodeData } from "@matter-server/ws-client";
import {
    formatOccupancySensorType,
    isOccupied,
    OCCUPANCY_SENSING_CLUSTER_ID,
    readOccupancy,
    readOccupancySensorType,
} from "../src/util/occupancy-sensing.js";

function node(attributes: Record<string, unknown>): MatterNode {
    const data: MatterNodeData = {
        node_id: 1,
        date_commissioned: "",
        last_interview: "",
        interview_version: 1,
        available: true,
        is_bridge: false,
        attributes,
        attribute_subscriptions: [],
    };
    return new MatterNode(data);
}

describe("occupancy-sensing util", () => {
    describe("readOccupancy / isOccupied", () => {
        it("reads bit 0 set as occupied", () => {
            const occupied = node({ [`1/${OCCUPANCY_SENSING_CLUSTER_ID}/0`]: 1 });
            expect(readOccupancy(occupied, 1)).to.equal(1);
            expect(isOccupied(occupied, 1)).to.equal(true);
        });
        it("reads a clear bitmap as not occupied", () => {
            const clear = node({ [`1/${OCCUPANCY_SENSING_CLUSTER_ID}/0`]: 0 });
            expect(isOccupied(clear, 1)).to.equal(false);
        });
        it("ignores reserved bits above bit 0", () => {
            const reservedBitsSet = node({ [`1/${OCCUPANCY_SENSING_CLUSTER_ID}/0`]: 0b110 });
            expect(isOccupied(reservedBitsSet, 1)).to.equal(false);
        });
        it("is null when the attribute hasn't been read yet", () => {
            expect(readOccupancy(node({}), 1)).to.equal(null);
            expect(isOccupied(node({}), 1)).to.equal(null);
        });
    });

    describe("readOccupancySensorType / formatOccupancySensorType", () => {
        it("reads and formats each OccupancySensorTypeEnum value", () => {
            expect(formatOccupancySensorType(readOccupancySensorType(node({ "1/1030/1": 0 }), 1))).to.equal("PIR");
            expect(formatOccupancySensorType(readOccupancySensorType(node({ "1/1030/1": 1 }), 1))).to.equal(
                "Ultrasonic",
            );
            expect(formatOccupancySensorType(readOccupancySensorType(node({ "1/1030/1": 2 }), 1))).to.equal(
                "PIR + Ultrasonic",
            );
            expect(formatOccupancySensorType(readOccupancySensorType(node({ "1/1030/1": 3 }), 1))).to.equal(
                "Physical Contact",
            );
        });
        it("falls back to a numeric label for an unknown value", () => {
            expect(formatOccupancySensorType(readOccupancySensorType(node({ "1/1030/1": 9 }), 1))).to.equal("Type 9");
        });
        it("is null when the attribute is absent", () => {
            expect(readOccupancySensorType(node({}), 1)).to.equal(null);
            expect(formatOccupancySensorType(null)).to.equal(null);
        });
    });
});
