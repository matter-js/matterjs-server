/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AttributesData } from "@matter-server/ws-client";
import { isBridgeNode } from "../src/util/bridgeDetection.js";

const AGGREGATOR = { "0": 14, "1": 1 };
const ROOT_NODE = { "0": 22, "1": 1 };
const BRIDGED_NODE = { "0": 19, "1": 1 };
const ON_OFF_LIGHT = { "0": 256, "1": 1 };

describe("isBridgeNode", () => {
    it("detects an aggregator on endpoint 1", () => {
        const attributes: AttributesData = {
            "0/29/0": [ROOT_NODE],
            "1/29/0": [AGGREGATOR],
            "2/29/0": [ON_OFF_LIGHT, BRIDGED_NODE],
        };

        expect(isBridgeNode(attributes)).to.equal(true);
    });

    it("detects an aggregator on an endpoint other than 1", () => {
        const attributes: AttributesData = {
            "0/29/0": [ROOT_NODE],
            "11/29/0": [AGGREGATOR],
            "31/29/0": [AGGREGATOR],
        };

        expect(isBridgeNode(attributes)).to.equal(true);
    });

    it("detects an aggregator that is itself a bridged device", () => {
        const attributes: AttributesData = {
            "0/29/0": [ROOT_NODE],
            "1102/29/0": [BRIDGED_NODE, AGGREGATOR],
            "11021/29/0": [ON_OFF_LIGHT],
        };

        expect(isBridgeNode(attributes)).to.equal(true);
    });

    it("returns false for a node without an aggregator", () => {
        const attributes: AttributesData = {
            "0/29/0": [ROOT_NODE],
            "1/29/0": [ON_OFF_LIGHT],
        };

        expect(isBridgeNode(attributes)).to.equal(false);
    });

    it("returns false for an empty attribute set", () => {
        expect(isBridgeNode({})).to.equal(false);
    });

    it("ignores the aggregator id on other clusters and attributes", () => {
        const attributes: AttributesData = {
            "1/29/3": [14],
            "1/29/1": [{ "0": 14 }],
            "1/129/0": [AGGREGATOR],
            "1/1029/0": [AGGREGATOR],
            "14/40/0": 14,
        };

        expect(isBridgeNode(attributes)).to.equal(false);
    });

    it("ignores a DeviceTypeList that is not an array or holds no device type entries", () => {
        const attributes: AttributesData = {
            "1/29/0": 14,
            "2/29/0": [null, undefined, 14, "14"],
        };

        expect(isBridgeNode(attributes)).to.equal(false);
    });
});
