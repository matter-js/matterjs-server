/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes } from "@matter/main";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TlsPrf } from "../src/dtls/prf/TlsPrf.js";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const FIXTURE = resolve(PACKAGE_ROOT, "test/fixtures/dtls/tls-prf-vectors.json");

interface PrfVector {
    name: string;
    secretHex: string;
    label: string;
    seedHex: string;
    outputLen: number;
    expectedHex: string;
    _source: string;
}

interface Fixture {
    prfVectors: PrfVector[];
}

function loadFixture(): Fixture {
    return JSON.parse(readFileSync(FIXTURE, "utf8")) as Fixture;
}

describe("TlsPrf.compute (RFC 5246 §5 / RFC 6655)", () => {
    const fixture = loadFixture();

    for (const vector of fixture.prfVectors) {
        it(`matches ${vector.name}`, () => {
            const out = TlsPrf.compute({
                secret: Bytes.of(Bytes.fromHex(vector.secretHex)),
                label: vector.label,
                seed: Bytes.of(Bytes.fromHex(vector.seedHex)),
                outputLength: vector.outputLen,
            });
            expect(Bytes.toHex(out)).to.equal(vector.expectedHex);
            expect(out.length).to.equal(vector.outputLen);
        });
    }

    it("stream truncation: first N bytes of a long output equal the same call with outputLength=N", () => {
        const secret = new Uint8Array(16).fill(0x42);
        const seed = new Uint8Array(32).fill(0x37);
        const longOut = TlsPrf.compute({ secret, label: "trunc test", seed, outputLength: 100 });
        for (const truncLen of [1, 16, 31, 32, 33, 64]) {
            const shortOut = TlsPrf.compute({ secret, label: "trunc test", seed, outputLength: truncLen });
            expect(Bytes.areEqual(shortOut, longOut.subarray(0, truncLen))).to.equal(true);
        }
    });

    it("outputLength = 0 returns an empty Uint8Array", () => {
        const out = TlsPrf.compute({
            secret: new Uint8Array(16),
            label: "anything",
            seed: new Uint8Array(8),
            outputLength: 0,
        });
        expect(out.length).to.equal(0);
    });

    it("rejects negative outputLength", () => {
        expect(() =>
            TlsPrf.compute({
                secret: new Uint8Array(16),
                label: "x",
                seed: new Uint8Array(),
                outputLength: -1,
            }),
        ).to.throw(/outputLength/);
    });

    it("output differs when only the label changes", () => {
        const args = {
            secret: new Uint8Array(16).fill(0x11),
            seed: new Uint8Array(32).fill(0x22),
            outputLength: 32,
        } as const;
        const a = TlsPrf.compute({ ...args, label: "label A" });
        const b = TlsPrf.compute({ ...args, label: "label B" });
        expect(Bytes.areEqual(a, b)).to.equal(false);
    });
});
