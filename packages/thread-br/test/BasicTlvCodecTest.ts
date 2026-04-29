/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes } from "@matter/main";
import { BasicTlv } from "../src/tlv/BasicTlvCodec.js";

describe("BasicTlv", () => {
    describe("walk", () => {
        it("walks two short TLVs", () => {
            const blob = Bytes.of(Bytes.fromHex("0001ff0203aabbcc"));
            const entries = BasicTlv.walk(blob);
            expect(entries).to.have.lengthOf(2);
            expect(entries[0].type).to.equal(0x00);
            expect(entries[0].value).to.deep.equal(Bytes.of(Bytes.fromHex("ff")));
            expect(entries[1].type).to.equal(0x02);
            expect(entries[1].value).to.deep.equal(Bytes.of(Bytes.fromHex("aabbcc")));
        });

        it("returns an empty array for empty input", () => {
            expect(BasicTlv.walk(new Uint8Array())).to.deep.equal([]);
        });

        it("throws on a truncated TLV", () => {
            expect(() => BasicTlv.walk(Bytes.of(Bytes.fromHex("0005aabb")))).to.throw(/truncated/i);
        });

        it("throws on a header-only truncation", () => {
            expect(() => BasicTlv.walk(new Uint8Array([0x00]))).to.throw(/truncated/i);
        });
    });
});
