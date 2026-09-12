/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterNode, type MatterNodeData } from "@matter-server/ws-client";
import type { ThermostatPreset } from "../src/util/thermostat-schedule.js";
import {
    clampExpirationMinutes,
    MAX_EXPIRATION_MINUTES,
    MIN_EXPIRATION_MINUTES,
    readCurrentThermostatSuggestion,
    readMaxThermostatSuggestions,
    readThermostatSuggestionNotFollowingReasons,
    readThermostatSuggestions,
    resolveSuggestionLabel,
} from "../src/util/thermostat-suggestions.js";

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

// Single-byte preset handle, base64-encoded (0x01 -> "AQ==").
const HANDLE_1 = "AQ==";

function preset(handle: string, overrides: Partial<ThermostatPreset> = {}): ThermostatPreset {
    return {
        handle,
        scenario: null,
        name: null,
        coolingSetpoint: null,
        heatingSetpoint: null,
        builtIn: null,
        ...overrides,
    };
}

describe("thermostat-suggestions util", () => {
    describe("clampExpirationMinutes", () => {
        it("keeps an in-range value", () => {
            expect(clampExpirationMinutes(60, 90)).to.equal(60);
        });
        it("clamps to the ExpirationInMinutes constraint", () => {
            expect(clampExpirationMinutes(5, 90)).to.equal(MIN_EXPIRATION_MINUTES);
            expect(clampExpirationMinutes(10_000, 90)).to.equal(MAX_EXPIRATION_MINUTES);
        });
        it("rounds fractional input", () => {
            expect(clampExpirationMinutes(60.6, 90)).to.equal(61);
        });
        it("falls back to the previous value for a cleared or non-numeric input", () => {
            expect(clampExpirationMinutes(NaN, 90)).to.equal(90);
            expect(clampExpirationMinutes(Infinity, 90)).to.equal(90);
        });
    });

    describe("readMaxThermostatSuggestions", () => {
        it("reads the count", () => {
            expect(readMaxThermostatSuggestions(node({ "6/513/83": 5 }), 6)).to.equal(5);
        });
        it("returns null when absent", () => {
            expect(readMaxThermostatSuggestions(node({}), 6)).to.equal(null);
        });
    });

    describe("readThermostatSuggestions", () => {
        it("decodes tag-keyed suggestion structs", () => {
            const suggestions = readThermostatSuggestions(
                node({ "6/513/84": [{ "0": 1, "1": HANDLE_1, "2": 100, "3": 1300 }] }),
                6,
            );
            expect(suggestions).to.deep.equal([
                { uniqueId: 1, presetHandle: HANDLE_1, effectiveTime: 100, expirationTime: 1300 },
            ]);
        });
        it("drops entries missing a required field", () => {
            expect(readThermostatSuggestions(node({ "6/513/84": [{ "0": 1, "1": HANDLE_1 }] }), 6)).to.deep.equal([]);
        });
        it("distinguishes an absent attribute from an empty list", () => {
            expect(readThermostatSuggestions(node({}), 6)).to.equal(undefined);
            expect(readThermostatSuggestions(node({ "6/513/84": [] }), 6)).to.deep.equal([]);
        });
    });

    describe("readCurrentThermostatSuggestion", () => {
        it("decodes the current suggestion struct", () => {
            const current = readCurrentThermostatSuggestion(
                node({ "6/513/85": { "0": 2, "1": HANDLE_1, "2": 100, "3": 1300 } }),
                6,
            );
            expect(current).to.deep.equal({
                uniqueId: 2,
                presetHandle: HANDLE_1,
                effectiveTime: 100,
                expirationTime: 1300,
            });
        });
        it("returns null when absent or null", () => {
            expect(readCurrentThermostatSuggestion(node({}), 6)).to.equal(null);
            expect(readCurrentThermostatSuggestion(node({ "6/513/85": null }), 6)).to.equal(null);
        });
    });

    describe("readThermostatSuggestionNotFollowingReasons", () => {
        it("decodes the active reason bits", () => {
            const reasons = readThermostatSuggestionNotFollowingReasons(node({ "6/513/86": (1 << 1) | (1 << 3) }), 6);
            expect(reasons.map(r => r.code)).to.deep.equal(["OngoingHold", "Occupancy"]);
        });
        it("returns an empty list when absent or null", () => {
            expect(readThermostatSuggestionNotFollowingReasons(node({}), 6)).to.deep.equal([]);
            expect(readThermostatSuggestionNotFollowingReasons(node({ "6/513/86": null }), 6)).to.deep.equal([]);
        });
    });

    describe("resolveSuggestionLabel", () => {
        const suggestion = { uniqueId: 1, presetHandle: HANDLE_1, effectiveTime: 0, expirationTime: 0 };
        it("prefers a matching preset's display label", () => {
            const label = resolveSuggestionLabel(suggestion, [preset(HANDLE_1, { name: "Night" })]);
            expect(label).to.equal("Night");
        });
        it("falls back to the handle when no preset matches", () => {
            expect(resolveSuggestionLabel(suggestion, [])).to.equal("0x01");
        });
    });
});
