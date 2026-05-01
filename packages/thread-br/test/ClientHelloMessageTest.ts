/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes } from "@matter/main";
import {
    CIPHER_SUITE_ECJPAKE_WITH_AES_128_CCM_8,
    ClientHelloMessage,
    EXTENSION_TYPE_ECJPAKE_KKPP,
} from "../src/dtls/handshake/ClientHelloMessage.js";

function fillRange(start: number, count: number): Uint8Array {
    const out = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
        out[i] = (start + i) & 0xff;
    }
    return out;
}

describe("ClientHelloMessage.build", () => {
    it("emits the expected wire layout for an empty cookie + minimal extension", () => {
        const random = fillRange(0, 32);
        const cookie = new Uint8Array(0);
        const ecjpakeKkpp = Bytes.of(Bytes.fromHex("aabb"));
        const body = ClientHelloMessage.build({ random, cookie, ecjpakeKkpp });

        let p = 0;
        // version DTLS 1.2
        expect(body[p++]).to.equal(0xfe);
        expect(body[p++]).to.equal(0xfd);
        // random
        expect(Bytes.areEqual(body.subarray(p, p + 32), random)).to.equal(true);
        p += 32;
        // session_id len = 0
        expect(body[p++]).to.equal(0);
        // cookie len = 0
        expect(body[p++]).to.equal(0);
        // cipher_suites length(2) = 2
        expect(body[p++]).to.equal(0);
        expect(body[p++]).to.equal(2);
        expect(body[p++]).to.equal(0xc0);
        expect(body[p++]).to.equal(0xff);
        // compression length=1, body=0x00
        expect(body[p++]).to.equal(1);
        expect(body[p++]).to.equal(0x00);
        // extensions length: ecjpake_kkpp entry = 2 (type) + 2 (extdata len) + 2 (payload) = 6
        expect(body[p++]).to.equal(0);
        expect(body[p++]).to.equal(6);
        // extension type 0x0100
        expect(body[p++]).to.equal(0x01);
        expect(body[p++]).to.equal(0x00);
        // extension data length = 2
        expect(body[p++]).to.equal(0);
        expect(body[p++]).to.equal(2);
        // payload
        expect(body[p++]).to.equal(0xaa);
        expect(body[p++]).to.equal(0xbb);
        expect(p).to.equal(body.length);
    });

    it("encodes the cookie in the DTLS-only field with a 1-byte length prefix", () => {
        const random = new Uint8Array(32).fill(0x11);
        const cookie = Bytes.of(Bytes.fromHex("0102030405060708"));
        const ecjpakeKkpp = new Uint8Array(0);
        const body = ClientHelloMessage.build({ random, cookie, ecjpakeKkpp });
        // version(2) + random(32) + session_id_len(1) = 35
        expect(body[35]).to.equal(cookie.length);
        expect(Bytes.areEqual(body.subarray(36, 36 + cookie.length), cookie)).to.equal(true);
    });

    it("uses cipher suite 0xC0FF and compression 0x00 (the only ones we support)", () => {
        const body = ClientHelloMessage.build({
            random: new Uint8Array(32),
            cookie: new Uint8Array(0),
            ecjpakeKkpp: new Uint8Array(0),
        });
        // After version(2) + random(32) + session_id_len(1)+0 + cookie_len(1)+0
        // = 36 bytes, we have cipher_suites length(2) + suite(2) + compression(1)+0x00.
        const offset = 36;
        // cipher_suites length
        expect((body[offset] << 8) | body[offset + 1]).to.equal(2);
        const suite = (body[offset + 2] << 8) | body[offset + 3];
        expect(suite).to.equal(CIPHER_SUITE_ECJPAKE_WITH_AES_128_CCM_8);
        // compression length + null
        expect(body[offset + 4]).to.equal(1);
        expect(body[offset + 5]).to.equal(0x00);
    });

    it("places the ecjpake_kkpp extension type as 0x0100 with a 2-byte data length prefix", () => {
        const ecjpakeKkpp = fillRange(0x40, 200);
        const body = ClientHelloMessage.build({
            random: new Uint8Array(32),
            cookie: new Uint8Array(0),
            ecjpakeKkpp,
        });
        // Locate extensions block: end - (extensionsBlockLen)
        // extensions block = 2 (entries length) + 2 (ext_type) + 2 (ext_data_len) + 200
        const extBlockLen = 2 + 2 + 2 + 200;
        const start = body.length - extBlockLen;
        // extensions list length
        expect((body[start] << 8) | body[start + 1]).to.equal(2 + 2 + 200);
        // extension type
        expect((body[start + 2] << 8) | body[start + 3]).to.equal(EXTENSION_TYPE_ECJPAKE_KKPP);
        // extension data length
        expect((body[start + 4] << 8) | body[start + 5]).to.equal(200);
        // payload bytes follow
        expect(Bytes.areEqual(body.subarray(start + 6), ecjpakeKkpp)).to.equal(true);
    });

    it("rejects a random other than 32 bytes", () => {
        expect(() =>
            ClientHelloMessage.build({
                random: new Uint8Array(31),
                cookie: new Uint8Array(0),
                ecjpakeKkpp: new Uint8Array(0),
            }),
        ).to.throw(/random/);
        expect(() =>
            ClientHelloMessage.build({
                random: new Uint8Array(33),
                cookie: new Uint8Array(0),
                ecjpakeKkpp: new Uint8Array(0),
            }),
        ).to.throw(/random/);
    });

    it("rejects a cookie longer than 255 bytes (DTLS 1-byte length field)", () => {
        expect(() =>
            ClientHelloMessage.build({
                random: new Uint8Array(32),
                cookie: new Uint8Array(256),
                ecjpakeKkpp: new Uint8Array(0),
            }),
        ).to.throw(/cookie/);
    });
});
