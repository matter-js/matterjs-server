/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHash, type Hash } from "node:crypto";

const SHA256_LEN = 32;

/**
 * Running SHA-256 over the TLS 1.2 handshake transcript that feeds the
 * Finished MAC (RFC 5246 §7.4.9). The transcript covers every handshake
 * message from the initial ClientHello up to (and EXCLUDING) the Finished
 * being computed or verified.
 *
 * Per RFC 6347 §4.2.6, DTLS hashes the **TLS 1.2 form** of each handshake
 * message — the `msg_type (1) || length (3) || body` header only, with the
 * DTLS-only `message_seq` / `fragment_offset` / `fragment_length` fields
 * stripped. Callers are responsible for passing the TLS-form bytes.
 *
 * Internal to `dtls/`; not re-exported from the package public API surface.
 */
export class HandshakeTranscript {
    #hash: Hash = createHash("sha256");

    /** Append a handshake message in TLS 1.2 form (`type || 24-bit length || body`). */
    appendHandshakeMessage(messageBytes: Uint8Array): void {
        this.#hash.update(messageBytes);
    }

    /**
     * Snapshot the running SHA-256 digest without disturbing the transcript so
     * the same accumulator can compute Finished for both peers and continue
     * absorbing later messages. Backed by `Hash.copy()` (Node.js >= 13.10).
     */
    digest(): Uint8Array {
        const snapshot = this.#hash.copy();
        const out = new Uint8Array(snapshot.digest());
        if (out.length !== SHA256_LEN) {
            throw new Error(`HandshakeTranscript digest length ${out.length} != ${SHA256_LEN}`);
        }
        return out;
    }
}
