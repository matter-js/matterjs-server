/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHmac } from "node:crypto";

const SHA256_LEN = 32;

const ASCII_ENCODER = new TextEncoder();

function hmacSha256(key: Uint8Array, data: Uint8Array): Uint8Array {
    const hmac = createHmac("sha256", key);
    hmac.update(data);
    return new Uint8Array(hmac.digest());
}

function pSha256(secret: Uint8Array, seed: Uint8Array, outputLength: number): Uint8Array {
    if (outputLength < 0) {
        throw new Error(`TlsPrf outputLength must be non-negative, got ${outputLength}`);
    }
    const out = new Uint8Array(outputLength);
    if (outputLength === 0) {
        return out;
    }
    let a = hmacSha256(secret, seed);
    const block = new Uint8Array(SHA256_LEN + seed.length);
    block.set(seed, SHA256_LEN);
    let written = 0;
    while (written < outputLength) {
        block.set(a, 0);
        const next = hmacSha256(secret, block);
        const remaining = outputLength - written;
        const copyLen = Math.min(SHA256_LEN, remaining);
        out.set(next.subarray(0, copyLen), written);
        written += copyLen;
        if (written < outputLength) {
            a = hmacSha256(secret, a);
        }
    }
    return out;
}

/**
 * TLS 1.2 pseudo-random function (RFC 5246 §5) using HMAC-SHA256 — the only PRF
 * permitted for `TLS_ECJPAKE_WITH_AES_128_CCM_8` (RFC 6655 §3). Mirrors mbedTLS
 * v3.6.6 `tls_prf_sha256` / `tls_prf_generic`.
 *
 * Internal to `dtls/`; not re-exported from the package public API surface.
 */
export namespace TlsPrf {
    /**
     * P_SHA256 expansion as defined in RFC 5246 §5:
     *
     *   P_hash(secret, seed) = HMAC_hash(secret, A(1) || seed) ||
     *                          HMAC_hash(secret, A(2) || seed) || ...
     *
     * with `A(0) = seed`, `A(i) = HMAC_hash(secret, A(i-1))`. The TLS 1.2 PRF
     * over (label, seed) is `P_SHA256(secret, label || seed)` — label bytes are
     * concatenated with the seed (no length prefix). The label is ASCII per
     * RFC 5246; we encode it as UTF-8 which coincides for ASCII-only input.
     */
    export function compute(args: {
        secret: Uint8Array;
        label: string;
        seed: Uint8Array;
        outputLength: number;
    }): Uint8Array {
        const { secret, label, seed, outputLength } = args;
        const labelBytes = ASCII_ENCODER.encode(label);
        const combined = new Uint8Array(labelBytes.length + seed.length);
        combined.set(labelBytes, 0);
        combined.set(seed, labelBytes.length);
        return pSha256(secret, combined, outputLength);
    }
}
