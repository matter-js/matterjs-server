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

        it("rejects a NUL-padded label the way MatterNode.nodeLabel does", () => {
            const n = node({
                "1/57/5": "Kitchen Plug\u0000\u0000\u0000",
                "1/65/0": [{ "0": "room", "1": "Kitchen" }],
            });
            expect(getEndpointLabel(n, 1)).to.equal("Kitchen");
        });

        it("rejects NUL padding inside a LabelList value", () => {
            const n = node({
                "1/65/0": [{ "0": "room", "1": "Kitchen\u0000" }],
                "1/64/0": [{ "0": "room", "1": "Lounge" }],
            });
            expect(getEndpointLabel(n, 1)).to.equal("Lounge");
        });

        it("falls through to FixedLabel when every UserLabel value is blank", () => {
            const n = node({
                "1/65/0": [{ "0": "room", "1": "   " }],
                "1/64/0": [{ "0": "room", "1": "Lounge" }],
            });
            expect(getEndpointLabel(n, 1)).to.equal("Lounge");
        });

        it("reads a LabelList that arrives index-keyed instead of as an array", () => {
            const n = node({ "1/65/0": { "0": { "0": "room", "1": "Kitchen" } } });
            expect(getEndpointLabel(n, 1)).to.equal("Kitchen");
        });

        it("caps the number of joined entries so the header stays on one line", () => {
            const n = node({
                "1/65/0": [
                    { "0": "a", "1": "One" },
                    { "0": "b", "1": "Two" },
                    { "0": "c", "1": "Three" },
                    { "0": "d", "1": "Four" },
                ],
            });
            expect(getEndpointLabel(n, 1)).to.equal("One / Two / Three");
        });

        it("ellipsizes a label longer than the header can hold", () => {
            const n = node({ "1/57/5": "L".repeat(80) });
            const label = getEndpointLabel(n, 1);
            expect(label).to.have.length(60);
            expect(label?.endsWith("\u2026")).to.equal(true);
        });

        it("is scoped per endpoint", () => {
            const n = node({ "1/65/0": [{ "0": "room", "1": "Kitchen" }] });
            expect(getEndpointLabel(n, 2)).to.equal(undefined);
        });

        it("rejects a NUL-corrupted BridgedDeviceBasicInformation NodeLabel and falls back to UserLabel", () => {
            const n = node({
                "1/57/5": "Kitchen Plug\u0000",
                "1/65/0": [{ "0": "room", "1": "Kitchen" }],
            });
            expect(getEndpointLabel(n, 1)).to.equal("Kitchen");
        });

        it("rejects a BridgedDeviceBasicInformation NodeLabel with a single interior NUL", () => {
            const n = node({ "1/57/5": "Kit\u0000chen Plug" });
            expect(getEndpointLabel(n, 1)).to.equal(undefined);
        });

        it("skips a NUL-corrupted LabelStruct value", () => {
            const n = node({
                "1/65/0": [
                    { "0": "room", "1": "Kitchen\u0000" },
                    { "0": "zone", "1": "Garden" },
                ],
            });
            expect(getEndpointLabel(n, 1)).to.equal("Garden");
        });
    });
});
