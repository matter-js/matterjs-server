/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes } from "@matter/main";
import { p256 } from "@noble/curves/nist.js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SchnorrZkp } from "../src/dtls/ecjpake/SchnorrZkp.js";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const FIXTURE = resolve(PACKAGE_ROOT, "test/fixtures/ecjpake/mbedtls-self-test-vectors.json");

interface MbedTlsVectors {
    x1: string;
    x2: string;
    cli_one: string;
    srv_one: string;
}

function loadVectors(): MbedTlsVectors {
    return JSON.parse(readFileSync(FIXTURE, "utf8")) as MbedTlsVectors;
}

function bigintFromHex(hex: string): bigint {
    return BigInt("0x" + hex);
}

const Point = p256.Point;
const N = Point.Fn.ORDER;

// Extract one ECJPAKEKeyKP entry from a wire buffer at the given offset, returning the
// raw fields needed to drive SchnorrZkp.verify. Mirrors the mbedTLS framing
// (uint8 X_len; X[X_len]; uint8 V_len; V[V_len]; uint8 r_len; r[r_len]) without
// pulling in the full EcJpakeRound parser, so this test exercises SchnorrZkp in
// isolation.
function sliceKkp(
    buf: Uint8Array,
    offset: number,
): { X: Uint8Array; V: Uint8Array; r: Uint8Array; nextOffset: number } {
    let p = offset;
    const xLen = buf[p++];
    const X = buf.subarray(p, p + xLen);
    p += xLen;
    const vLen = buf[p++];
    const V = buf.subarray(p, p + vLen);
    p += vLen;
    const rLen = buf[p++];
    const r = buf.subarray(p, p + rLen);
    p += rLen;
    return { X: new Uint8Array(X), V: new Uint8Array(V), r: new Uint8Array(r), nextOffset: p };
}

describe("SchnorrZkp.verify (mbedTLS oracle)", () => {
    const vectors = loadVectors();

    it("accepts both ZKPs in mbedTLS cli_one (id='client')", () => {
        const buf = Bytes.of(Bytes.fromHex(vectors.cli_one));
        const first = sliceKkp(buf, 0);
        const second = sliceKkp(buf, first.nextOffset);
        expect(SchnorrZkp.verify({ zkp: { V: first.V, r: first.r }, publicKey: first.X, id: "client" })).to.equal(true);
        expect(SchnorrZkp.verify({ zkp: { V: second.V, r: second.r }, publicKey: second.X, id: "client" })).to.equal(
            true,
        );
    });

    it("accepts both ZKPs in mbedTLS srv_one (id='server')", () => {
        const buf = Bytes.of(Bytes.fromHex(vectors.srv_one));
        const first = sliceKkp(buf, 0);
        const second = sliceKkp(buf, first.nextOffset);
        expect(SchnorrZkp.verify({ zkp: { V: first.V, r: first.r }, publicKey: first.X, id: "server" })).to.equal(true);
        expect(SchnorrZkp.verify({ zkp: { V: second.V, r: second.r }, publicKey: second.X, id: "server" })).to.equal(
            true,
        );
    });

    it("rejects a cli_one ZKP when verified with id='server'", () => {
        const buf = Bytes.of(Bytes.fromHex(vectors.cli_one));
        const first = sliceKkp(buf, 0);
        expect(SchnorrZkp.verify({ zkp: { V: first.V, r: first.r }, publicKey: first.X, id: "server" })).to.equal(
            false,
        );
    });

    it("rejects when r is mutated (last byte flipped)", () => {
        const buf = Bytes.of(Bytes.fromHex(vectors.cli_one));
        const first = sliceKkp(buf, 0);
        const tampered = new Uint8Array(first.r);
        tampered[tampered.length - 1] ^= 0x01;
        expect(SchnorrZkp.verify({ zkp: { V: first.V, r: tampered }, publicKey: first.X, id: "client" })).to.equal(
            false,
        );
    });

    it("rejects when V is mutated to a different on-curve point", () => {
        const buf = Bytes.of(Bytes.fromHex(vectors.cli_one));
        const first = sliceKkp(buf, 0);
        // Use 2*V as a substitute (still a valid curve point but breaks the proof equation).
        const Vpoint = Point.fromBytes(first.V).double();
        const tamperedV = Vpoint.toBytes(false);
        expect(SchnorrZkp.verify({ zkp: { V: tamperedV, r: first.r }, publicKey: first.X, id: "client" })).to.equal(
            false,
        );
    });

    it("rejects an off-curve V (last byte mutated, almost surely off-curve)", () => {
        const buf = Bytes.of(Bytes.fromHex(vectors.cli_one));
        const first = sliceKkp(buf, 0);
        const tamperedV = new Uint8Array(first.V);
        tamperedV[tamperedV.length - 1] ^= 0x01;
        // Whether the mutation lands off-curve or just breaks the proof, verify must say false (and not throw).
        expect(() =>
            SchnorrZkp.verify({ zkp: { V: tamperedV, r: first.r }, publicKey: first.X, id: "client" }),
        ).to.not.throw();
        expect(SchnorrZkp.verify({ zkp: { V: tamperedV, r: first.r }, publicKey: first.X, id: "client" })).to.equal(
            false,
        );
    });
});

describe("SchnorrZkp.generate -> verify round-trip", () => {
    const vectors = loadVectors();

    it("produces a verifiable ZKP for known fixed scalars (id='client')", () => {
        const x = bigintFromHex(vectors.x1);
        const v = bigintFromHex(vectors.x2);
        const X = Point.BASE.multiply(x).toBytes(false);
        const zkp = SchnorrZkp.generate({ privateKey: x, publicKey: X, ephemeral: v, id: "client" });
        expect(SchnorrZkp.verify({ zkp, publicKey: X, id: "client" })).to.equal(true);
    });

    it("emits r in minimal big-endian (no leading zero) for a 32-byte case", () => {
        const x = bigintFromHex(vectors.x1);
        const v = bigintFromHex(vectors.x2);
        const X = Point.BASE.multiply(x).toBytes(false);
        const zkp = SchnorrZkp.generate({ privateKey: x, publicKey: X, ephemeral: v, id: "client" });
        expect(zkp.r.length).to.be.within(1, 32);
        expect(zkp.r[0]).to.not.equal(0x00);
    });

    it("strips leading zero(s) when r happens to be < 2^248 (variable r-length)", () => {
        // Iterate ephemerals deterministically until r turns out shorter than 32 bytes,
        // exercising the minimal-encoding branch that mbedTLS implements via mbedtls_mpi_size.
        const x = bigintFromHex(vectors.x1);
        const X = Point.BASE.multiply(x).toBytes(false);
        let v = 1n;
        let zkp: ReturnType<typeof SchnorrZkp.generate> | undefined;
        for (let i = 0; i < 4096; i++) {
            v = (v + 1n) % N;
            if (v === 0n) continue;
            const candidate = SchnorrZkp.generate({ privateKey: x, publicKey: X, ephemeral: v, id: "client" });
            if (candidate.r.length < 32) {
                zkp = candidate;
                break;
            }
        }
        expect(zkp, "must find an ephemeral producing r < 32 bytes within 4096 attempts").to.exist;
        expect(zkp!.r[0]).to.not.equal(0x00);
        expect(SchnorrZkp.verify({ zkp: zkp!, publicKey: X, id: "client" })).to.equal(true);
    });

    it("rejects ephemeral=0 and ephemeral>=n", () => {
        const x = bigintFromHex(vectors.x1);
        const X = Point.BASE.multiply(x).toBytes(false);
        expect(() => SchnorrZkp.generate({ privateKey: x, publicKey: X, ephemeral: 0n, id: "client" })).to.throw(
            /ephemeral/,
        );
        expect(() => SchnorrZkp.generate({ privateKey: x, publicKey: X, ephemeral: N, id: "client" })).to.throw(
            /ephemeral/,
        );
    });

    it("rejects privateKey=0 and privateKey>=n", () => {
        const X = Point.BASE.toBytes(false);
        expect(() => SchnorrZkp.generate({ privateKey: 0n, publicKey: X, ephemeral: 1n, id: "client" })).to.throw(
            /private key/,
        );
        expect(() => SchnorrZkp.generate({ privateKey: N, publicKey: X, ephemeral: 1n, id: "client" })).to.throw(
            /private key/,
        );
    });

    it("is deterministic: same inputs -> identical (V, r)", () => {
        const x = bigintFromHex(vectors.x1);
        const v = bigintFromHex(vectors.x2);
        const X = Point.BASE.multiply(x).toBytes(false);
        const a = SchnorrZkp.generate({ privateKey: x, publicKey: X, ephemeral: v, id: "client" });
        const b = SchnorrZkp.generate({ privateKey: x, publicKey: X, ephemeral: v, id: "client" });
        expect(Bytes.areEqual(a.V, b.V)).to.equal(true);
        expect(Bytes.areEqual(a.r, b.r)).to.equal(true);
    });
});
