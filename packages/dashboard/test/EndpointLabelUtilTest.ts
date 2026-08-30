/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterNode, type MatterNodeData } from "@matter-server/ws-client";
import { getEndpointLabel } from "../src/util/endpoint-label.js";

function node(attributes: Record<string, unknown>, node_id: number | bigint = 1): MatterNode {
    const data: MatterNodeData = {
        node_id,
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

describe("endpoint-label util", () => {
    describe("getEndpointLabel", () => {
        it("returns undefined when no label source is present", () => {
            const n = node({});
            expect(getEndpointLabel(n, 1)).to.equal(undefined);
        });

        it("prefers BridgedDeviceBasicInformation NodeLabel over UserLabel and FixedLabel", () => {
            const n = node({
                "1/57/5": "Kitchen Plug",
                "1/65/0": [{ "0": "room", "1": "Kitchen" }],
                "1/64/0": [{ "0": "room", "1": "Factory Room" }],
            });
            expect(getEndpointLabel(n, 1)).to.equal("Kitchen Plug");
        });

        it("ignores an empty BridgedDeviceBasicInformation NodeLabel and falls back to UserLabel", () => {
            const n = node({
                "1/57/5": "",
                "1/65/0": [{ "0": "room", "1": "Kitchen" }],
            });
            expect(getEndpointLabel(n, 1)).to.equal("Kitchen");
        });

        it("falls back to FixedLabel when UserLabel is absent", () => {
            const n = node({ "1/64/0": [{ "0": "room", "1": "Lounge" }] });
            expect(getEndpointLabel(n, 1)).to.equal("Lounge");
        });

        it("joins multiple LabelList values with a slash", () => {
            const n = node({
                "1/65/0": [
                    { "0": "room", "1": "Kitchen" },
                    { "0": "orientation", "1": "North" },
                ],
            });
            expect(getEndpointLabel(n, 1)).to.equal("Kitchen / North");
        });

        it("skips LabelStruct entries with a non-string or empty value", () => {
            const n = node({
                "1/65/0": [
                    { "0": "room", "1": "" },
                    { "0": "count", "1": 3 },
                    { "0": "zone", "1": "Garden" },
                ],
            });
            expect(getEndpointLabel(n, 1)).to.equal("Garden");
        });

        it("is scoped per endpoint", () => {
            const n = node({ "1/65/0": [{ "0": "room", "1": "Kitchen" }] });
            expect(getEndpointLabel(n, 2)).to.equal(undefined);
        });
    });
});
