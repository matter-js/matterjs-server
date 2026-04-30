/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { p256 } from "@noble/curves/nist.js";
import { SchnorrZkp } from "./SchnorrZkp.js";

/**
 * One half of an EC-JPAKE round-1 message: an ephemeral public key plus a Schnorr
 * proof of knowledge of its private scalar against the curve generator.
 *
 * Wire (mbedTLS v3.6.6 `ecjpake_kkp_write`, ecjpake.c §411-443):
 * ```
 * uint8 X_len; uint8 X[X_len];          // X_len = 65 for P-256 uncompressed
 * uint8 V_len; uint8 V[V_len];          // V_len = 65 for P-256 uncompressed
 * uint8 r_len; uint8 r[r_len];          // r_len is minimal, leading zeros stripped
 * ```
 */
export interface EcJpakeKeyKP {
    /** SEC1-uncompressed public key `X = x*G`. */
    X: Uint8Array;
    /** Schnorr ZKP proving knowledge of `x`. */
    zkp: SchnorrZkp;
}

const Point = p256.Point;
const POINT_LEN = 65;

function readU8(bytes: Uint8Array, offset: number): number {
    if (offset >= bytes.length) {
        throw new Error(`unexpected end of buffer at offset ${offset}`);
    }
    return bytes[offset];
}

function readSlice(bytes: Uint8Array, offset: number, length: number): Uint8Array {
    if (offset + length > bytes.length) {
        throw new Error(`buffer too short: need ${length} bytes at offset ${offset}, have ${bytes.length - offset}`);
    }
    return bytes.subarray(offset, offset + length);
}

function writeKeyKP(keyKP: EcJpakeKeyKP, out: number[]): void {
    if (keyKP.X.length !== POINT_LEN || keyKP.X[0] !== 0x04) {
        throw new Error("X must be SEC1-uncompressed P-256 (65 bytes, 0x04 prefix)");
    }
    if (keyKP.zkp.V.length !== POINT_LEN || keyKP.zkp.V[0] !== 0x04) {
        throw new Error("ZKP.V must be SEC1-uncompressed P-256 (65 bytes, 0x04 prefix)");
    }
    if (keyKP.zkp.r.length === 0 || keyKP.zkp.r.length > 255) {
        throw new Error(`ZKP.r length must be 1..255, got ${keyKP.zkp.r.length}`);
    }
    // Minimal-encoding invariant: leading byte must be non-zero (except r === 0,
    // already excluded above). mbedTLS produces the minimal form via mbedtls_mpi_size,
    // so ours must too if we want byte-identical output.
    if (keyKP.zkp.r[0] === 0x00) {
        throw new Error("ZKP.r must be minimal big-endian (no leading zero)");
    }

    out.push(POINT_LEN);
    for (const b of keyKP.X) out.push(b);
    out.push(POINT_LEN);
    for (const b of keyKP.zkp.V) out.push(b);
    out.push(keyKP.zkp.r.length);
    for (const b of keyKP.zkp.r) out.push(b);
}

function readKeyKP(bytes: Uint8Array, offset: number): { kp: EcJpakeKeyKP; nextOffset: number } {
    let p = offset;
    const xLen = readU8(bytes, p);
    p += 1;
    if (xLen !== POINT_LEN) {
        throw new Error(`expected P-256 point length ${POINT_LEN}, got ${xLen}`);
    }
    const X = readSlice(bytes, p, xLen);
    p += xLen;
    const vLen = readU8(bytes, p);
    p += 1;
    if (vLen !== POINT_LEN) {
        throw new Error(`expected P-256 ZKP.V length ${POINT_LEN}, got ${vLen}`);
    }
    const V = readSlice(bytes, p, vLen);
    p += vLen;
    const rLen = readU8(bytes, p);
    p += 1;
    if (rLen === 0) {
        throw new Error("ZKP.r length must be > 0");
    }
    const r = readSlice(bytes, p, rLen);
    p += rLen;

    return {
        kp: { X: new Uint8Array(X), zkp: { V: new Uint8Array(V), r: new Uint8Array(r) } },
        nextOffset: p,
    };
}

/**
 * EC-JPAKE round 1 codec on top of the wire format that mbedTLS calls
 * `ECJPAKEKeyKPPairList`: two `ECJPAKEKeyKP` structures back-to-back, no separator,
 * no outer length (the carrying TLS extension layer adds the 2-byte length on the wire).
 *
 * Mirrors `ecjpake_kkpp_write` / `ecjpake_kkpp_read` (ecjpake.c §449-511).
 */
export const EcJpakeRound = {
    /**
     * Build a round-1 message for one role from two private scalars and two ephemeral
     * scalars (one ephemeral per ZKP). Caller-supplied ephemerals make the output
     * deterministic for testing — production callers must source them from a CSPRNG.
     *
     * `id` is `"client"` for the joiner and `"server"` for the commissioner — these
     * are the literal byte strings from mbedTLS `ecjpake_id[]` (ecjpake.c §28-31).
     */
    buildRound1(args: { x1: bigint; x2: bigint; v1: bigint; v2: bigint; id: string }): {
        kp1: EcJpakeKeyKP;
        kp2: EcJpakeKeyKP;
    } {
        const { x1, x2, v1, v2, id } = args;
        const X1 = Point.BASE.multiply(x1).toBytes(false);
        const X2 = Point.BASE.multiply(x2).toBytes(false);
        const zkp1 = SchnorrZkp.generate({ privateKey: x1, publicKey: X1, ephemeral: v1, id });
        const zkp2 = SchnorrZkp.generate({ privateKey: x2, publicKey: X2, ephemeral: v2, id });
        return {
            kp1: { X: X1, zkp: zkp1 },
            kp2: { X: X2, zkp: zkp2 },
        };
    },

    serializeRound1(kp1: EcJpakeKeyKP, kp2: EcJpakeKeyKP): Uint8Array {
        const out = new Array<number>();
        writeKeyKP(kp1, out);
        writeKeyKP(kp2, out);
        return Uint8Array.from(out);
    },

    parseRound1(bytes: Uint8Array): { kp1: EcJpakeKeyKP; kp2: EcJpakeKeyKP } {
        const first = readKeyKP(bytes, 0);
        const second = readKeyKP(bytes, first.nextOffset);
        if (second.nextOffset !== bytes.length) {
            throw new Error(`trailing bytes after round-1 pair: ${bytes.length - second.nextOffset} extra`);
        }
        return { kp1: first.kp, kp2: second.kp };
    },
} as const;
