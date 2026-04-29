/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes } from "@matter/main";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OperationalDataset } from "../src/dataset/OperationalDataset.js";
import { BasicTlv } from "../src/tlv/BasicTlvCodec.js";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const FIXTURE_DIR = resolve(PACKAGE_ROOT, "test/fixtures/datasets");

interface ParsedLine {
    type: number;
    length: number;
    valueHex?: string;
    valueText?: string;
}

/**
 * Parse Agners' Python output lines (`t:  N (NAME), l: L, v: 0xHEX`).
 *
 * Hex values are emitted as `0x...`; the NETWORK_NAME row uses Python's
 * bytes-literal `b'...'` form, which we capture verbatim so the test can
 * compare network-name bytes to the parser's text rendering.
 */
function parseAgnersLine(line: string): ParsedLine | undefined {
    const match = line.match(/^t:\s*(\d+)\s+\([^)]+\),\s*l:\s*(\d+),\s*v:\s*(.+)$/);
    if (match === null) return undefined;
    const type = parseInt(match[1], 10);
    const length = parseInt(match[2], 10);
    const v = match[3];
    if (v.startsWith("0x")) {
        return { type, length, valueHex: v.slice(2) };
    }
    const textMatch = v.match(/^b'(.*)'$/);
    if (textMatch !== null) {
        return { type, length, valueText: textMatch[1] };
    }
    return { type, length };
}

describe("OperationalDataset cross-validation against Agners' Python parser", () => {
    it("matches per-TLV (type, length, value) for agners-vector-1", () => {
        const hex = readFileSync(resolve(FIXTURE_DIR, "agners-vector-1.hex"), "utf8").trim();
        const blob = Bytes.of(Bytes.fromHex(hex));
        const expectedRaw = readFileSync(resolve(FIXTURE_DIR, "agners-vector-1.expected.txt"), "utf8");
        const expected = expectedRaw
            .split("\n")
            .map(s => s.trim())
            .filter(s => s.length > 0)
            .map(parseAgnersLine)
            .filter((p): p is ParsedLine => p !== undefined);

        const walked = BasicTlv.walk(blob);
        const knownByType = new Map(walked.map(e => [e.type, e]));
        for (const exp of expected) {
            const got = knownByType.get(exp.type);
            expect(got, `missing TLV type ${exp.type}`).to.not.equal(undefined);
            if (got === undefined) continue;
            expect(got.value.length, `length mismatch for type ${exp.type}`).to.equal(exp.length);
            if (exp.valueHex !== undefined) {
                expect(Bytes.toHex(got.value), `hex mismatch for type ${exp.type}`).to.equal(exp.valueHex);
            } else if (exp.valueText !== undefined) {
                expect(new TextDecoder("utf-8").decode(got.value), `text mismatch for type ${exp.type}`).to.equal(
                    exp.valueText,
                );
            }
        }
    });

    it("decodes the same fixture into named OperationalDataset accessors", () => {
        const hex = readFileSync(resolve(FIXTURE_DIR, "agners-vector-1.hex"), "utf8").trim();
        const blob = Bytes.of(Bytes.fromHex(hex));
        const ds = OperationalDataset.decode(blob);

        expect(ds.channel).to.equal(0x19);
        expect(ds.panId).to.equal(0x1234);
        expect(ds.networkName).to.equal("TestNet");
        expect(ds.securityPolicy).to.deep.equal({ rotationTime: 0x02a0, flags: 0xfff8 });
        expect(ds.unknownTlvs).to.have.lengthOf(1);
        expect(ds.unknownTlvs[0].type).to.equal(0xee);
    });

    it("round-trips agners-vector-1 byte-identically", () => {
        const hex = readFileSync(resolve(FIXTURE_DIR, "agners-vector-1.hex"), "utf8").trim();
        const blob = Bytes.of(Bytes.fromHex(hex));
        const ds = OperationalDataset.decode(blob);
        expect(OperationalDataset.encode(ds)).to.deep.equal(blob);
    });
});
