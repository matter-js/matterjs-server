/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes } from "@matter/main";
import { ContentType } from "../src/dtls/record/ContentType.js";
import { DtlsCipherState, type DtlsCipherStateInputs } from "../src/dtls/record/DtlsCipherState.js";

const FIXED_INPUTS: DtlsCipherStateInputs = {
    clientWriteKey: Bytes.of(Bytes.fromHex("000102030405060708090a0b0c0d0e0f")),
    serverWriteKey: Bytes.of(Bytes.fromHex("101112131415161718191a1b1c1d1e1f")),
    clientWriteSalt: Bytes.of(Bytes.fromHex("c0c1c2c3")),
    serverWriteSalt: Bytes.of(Bytes.fromHex("d0d1d2d3")),
};

describe("DtlsCipherState role-based key/salt selection", () => {
    it("client encrypts with client_write_key/salt, decrypts with server_write_key/salt", () => {
        const state = new DtlsCipherState("client", FIXED_INPUTS);
        expect(Bytes.toHex(state.encryptParams().key)).to.equal(Bytes.toHex(FIXED_INPUTS.clientWriteKey));
        expect(Bytes.toHex(state.encryptParams().salt)).to.equal(Bytes.toHex(FIXED_INPUTS.clientWriteSalt));
        expect(Bytes.toHex(state.decryptParams().key)).to.equal(Bytes.toHex(FIXED_INPUTS.serverWriteKey));
        expect(Bytes.toHex(state.decryptParams().salt)).to.equal(Bytes.toHex(FIXED_INPUTS.serverWriteSalt));
    });

    it("server encrypts with server_write_key/salt, decrypts with client_write_key/salt", () => {
        const state = new DtlsCipherState("server", FIXED_INPUTS);
        expect(Bytes.toHex(state.encryptParams().key)).to.equal(Bytes.toHex(FIXED_INPUTS.serverWriteKey));
        expect(Bytes.toHex(state.encryptParams().salt)).to.equal(Bytes.toHex(FIXED_INPUTS.serverWriteSalt));
        expect(Bytes.toHex(state.decryptParams().key)).to.equal(Bytes.toHex(FIXED_INPUTS.clientWriteKey));
        expect(Bytes.toHex(state.decryptParams().salt)).to.equal(Bytes.toHex(FIXED_INPUTS.clientWriteSalt));
    });

    it("defensively copies key-block inputs", () => {
        const inputs: DtlsCipherStateInputs = {
            clientWriteKey: new Uint8Array(16),
            serverWriteKey: new Uint8Array(16),
            clientWriteSalt: new Uint8Array(4),
            serverWriteSalt: new Uint8Array(4),
        };
        const state = new DtlsCipherState("client", inputs);
        inputs.clientWriteKey.fill(0xff);
        inputs.clientWriteSalt.fill(0xff);
        expect(Bytes.toHex(state.encryptParams().key)).to.equal("00000000000000000000000000000000");
        expect(Bytes.toHex(state.encryptParams().salt)).to.equal("00000000");
    });

    it("rejects key/salt of wrong length", () => {
        expect(
            () =>
                new DtlsCipherState("client", {
                    ...FIXED_INPUTS,
                    clientWriteKey: new Uint8Array(15),
                }),
        ).to.throw(/clientWriteKey/);
        expect(
            () =>
                new DtlsCipherState("client", {
                    ...FIXED_INPUTS,
                    serverWriteSalt: new Uint8Array(5),
                }),
        ).to.throw(/serverWriteSalt/);
    });
});

describe("DtlsCipherState.nonceFor", () => {
    const state = new DtlsCipherState("client", FIXED_INPUTS);

    it("matches salt(4) || epoch(2) || seq(6) for epoch=1 seq=42", () => {
        const nonce = state.nonceFor(FIXED_INPUTS.clientWriteSalt, 1, 42n);
        expect(Bytes.toHex(nonce)).to.equal("c0c1c2c3" + "0001" + "00000000002a");
    });

    it("uses BE for the 48-bit sequence number", () => {
        const nonce = state.nonceFor(FIXED_INPUTS.serverWriteSalt, 0xabcd, 0x123456789a_bcn);
        expect(Bytes.toHex(nonce)).to.equal("d0d1d2d3" + "abcd" + "123456789abc");
    });

    it("rejects salt of wrong length", () => {
        expect(() => state.nonceFor(new Uint8Array(3), 0, 0n)).to.throw(/salt/);
    });

    it("rejects out-of-range epoch and seqNum", () => {
        expect(() => state.nonceFor(FIXED_INPUTS.clientWriteSalt, -1, 0n)).to.throw(/epoch/);
        expect(() => state.nonceFor(FIXED_INPUTS.clientWriteSalt, 0x10000, 0n)).to.throw(/epoch/);
        expect(() => state.nonceFor(FIXED_INPUTS.clientWriteSalt, 0, 1n << 48n)).to.throw(/seqNum/);
    });
});

describe("DtlsCipherState.aadFor", () => {
    const state = new DtlsCipherState("client", FIXED_INPUTS);

    it("matches epoch||seq(8) || type(1) || version(2) || plaintextLen(2)", () => {
        const aad = state.aadFor(ContentType.APPLICATION_DATA, 1, 42n, 100);
        // 0001 00000000002a 17 fefd 0064
        expect(Bytes.toHex(aad)).to.equal("0001" + "00000000002a" + "17" + "fefd" + "0064");
        expect(aad.length).to.equal(13);
    });

    it("reflects ContentType byte verbatim", () => {
        const aad = state.aadFor(ContentType.HANDSHAKE, 0, 7n, 1);
        expect(aad[8]).to.equal(22);
        expect(aad[11]).to.equal(0x00);
        expect(aad[12]).to.equal(0x01);
    });

    it("rejects out-of-range plaintextLen", () => {
        expect(() => state.aadFor(ContentType.HANDSHAKE, 0, 0n, -1)).to.throw(/plaintextLen/);
        expect(() => state.aadFor(ContentType.HANDSHAKE, 0, 0n, 0x10000)).to.throw(/plaintextLen/);
    });
});
