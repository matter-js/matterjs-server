/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseBigIntAwareJson, toBigIntAwareJson } from "../src/json-utils.js";

/**
 * Wire contract with the Python client, shared with python_client/tests/test_bigint_wire.py: bigint-wire.json is what
 * toBigIntAwareJson writes (Python must read it exactly), bigint-wire.python.json is what json_dumps writes for the
 * same data (this side must read it exactly). Paths are relative to the compiled test in build/esm/test.
 */
function fixture(name: string) {
    return readFileSync(resolve(import.meta.dirname, "../../../test/fixtures", name), "utf8");
}

const SAMPLE = {
    u64_max: 18446744073709551615n,
    small: 42n,
    safe_max: 9007199254740991n,
    above_safe: 9007199254740993n,
    below_safe: -9007199254740993n,
    i64_min: -9223372036854775808n,
    list: [112233n, 18446744073709355009n, -9007199254740993n],
    nested: [{ subjects: [9007199254740993n] }],
    hex_like_string: "0x20000000000001",
    marker_like_string: "__BIGINT__kitchen",
    float: 1.5,
    plain_number: 7,
};

/** SAMPLE as parseBigIntAwareJson returns it: bigints only outside the safe integer range. */
const PARSED = {
    ...SAMPLE,
    small: 42,
    safe_max: 9007199254740991,
    list: [112233, 18446744073709355009n, -9007199254740993n],
};

describe("bigint-aware JSON", () => {
    describe("toBigIntAwareJson", () => {
        it("writes the wire fixture the Python client reads", () => {
            expect(toBigIntAwareJson(SAMPLE, 2) + "\n").to.equal(fixture("bigint-wire.json"));
        });

        it("writes a large bigint as a plain number inside a list", () => {
            expect(toBigIntAwareJson({ s: [112233n, 0xffff_ffff_fffd_0001n] })).to.equal(
                '{"s":[112233,18446744073709355009]}',
            );
        });

        it("replaces the bigint placeholders in indented output too", () => {
            expect(toBigIntAwareJson({ e: [{ s: [0x20_0000_0000_0001n] }] }, 1)).to.equal(
                '{\n "e": [\n  {\n   "s": [\n    9007199254740993\n   ]\n  }\n ]\n}',
            );
        });

        it("keeps the precision of a negative bigint below -2^53", () => {
            expect(toBigIntAwareJson({ v: -0x20_0000_0000_0001n })).to.equal('{"v":-9007199254740993}');
        });

        it("leaves a string that looks like a bigint's hex form untouched", () => {
            expect(toBigIntAwareJson({ id: 0x20_0000_0000_0001n, label: "0x20000000000001" })).to.equal(
                '{"id":9007199254740993,"label":"0x20000000000001"}',
            );
        });

        it("keeps text that contains the marker's private-use character (characterization)", () => {
            const value = {
                quoted: 'x"\uE000123',
                exact: "\uE000123",
                ["\uE0001"]: 1,
                id: 0x20_0000_0000_0001n,
            };
            const json = toBigIntAwareJson(value);
            expect(JSON.parse(json)).to.deep.equal({
                quoted: 'x"\uE000123',
                exact: "\uE000123",
                "\uE0001": 1,
                id: 9007199254740992,
            });
            expect(json).to.include('"id":9007199254740993');
            expect(parseBigIntAwareJson(json)).to.deep.equal(value);
        });

        it("rejects a top-level value JSON cannot represent instead of returning undefined", () => {
            expect(() => toBigIntAwareJson(undefined)).to.throw(TypeError, "undefined");
            expect(() => toBigIntAwareJson(() => 1)).to.throw(TypeError, "function");
            expect(() => toBigIntAwareJson(Symbol("x"))).to.throw(TypeError, "symbol");
            expect(toBigIntAwareJson({ a: undefined, b: 1n })).to.equal('{"b":1}');
        });

        it("writes a top-level bigint", () => {
            expect(toBigIntAwareJson(18446744073709551615n)).to.equal("18446744073709551615");
        });
    });

    describe("parseBigIntAwareJson", () => {
        it("reads the server's wire fixture back to the original values", () => {
            expect(parseBigIntAwareJson(fixture("bigint-wire.json"))).to.deep.equal(PARSED);
        });

        it("reads what the Python client writes", () => {
            expect(parseBigIntAwareJson(fixture("bigint-wire.python.json"))).to.deep.equal(PARSED);
        });

        it("keeps a string starting with __BIGINT__ as a string", () => {
            expect(parseBigIntAwareJson('{"label":"__BIGINT__kitchen","n":"__BIGINT__123"}')).to.deep.equal({
                label: "__BIGINT__kitchen",
                n: "__BIGINT__123",
            });
        });

        it("keeps a string made of the private-use marker and digits as a string", () => {
            expect(parseBigIntAwareJson('{"label":"\\ue000123","id":18446744073709551615}')).to.deep.equal({
                label: "\uE000123",
                id: 18446744073709551615n,
            });
        });

        it("does not touch digits inside strings", () => {
            expect(parseBigIntAwareJson('{"serial":"18446744073709551615"}')).to.deep.equal({
                serial: "18446744073709551615",
            });
        });

        it("round-trips the sample, safe-range bigints returning as numbers", () => {
            expect(parseBigIntAwareJson(toBigIntAwareJson(SAMPLE))).to.deep.equal(PARSED);
        });
    });
});
