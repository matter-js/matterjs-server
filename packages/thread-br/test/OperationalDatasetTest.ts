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

/**
 * Tests run from `<pkg>/build/esm/test/`; fixtures live at `<pkg>/test/fixtures/`.
 * Walk up to the package root and reach into the source tree.
 */
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const FIXTURE_DIR = resolve(PACKAGE_ROOT, "test/fixtures/datasets");

function loadFixture(name: string): Uint8Array {
    const hex = readFileSync(resolve(FIXTURE_DIR, name), "utf8").trim();
    return Bytes.of(Bytes.fromHex(hex));
}

describe("OperationalDataset.decode", () => {
    it("decodes the synthetic-1 fixture into named fields", () => {
        const blob = loadFixture("synthetic-1.hex");
        const ds = OperationalDataset.decode(blob);

        expect(ds.channel).to.equal(0x0f);
        expect(ds.extPanId).to.deep.equal(new Uint8Array([0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]));
        expect(ds.networkName).to.equal("OpenThread");
        expect(ds.pskc).to.deep.equal(Uint8Array.from(Array.from({ length: 16 }, (_, i) => i)));
        expect(ds.activeTimestamp).to.deep.equal(new Uint8Array([0, 0, 0, 0, 0, 1, 0, 0]));
    });

    it("preserves the original blob in `raw`", () => {
        const blob = loadFixture("synthetic-1.hex");
        const ds = OperationalDataset.decode(blob);
        expect(ds.raw).to.deep.equal(blob);
    });

    it("captures unknown TLVs in `unknownTlvs`", () => {
        const blob = BasicTlv.encode([
            { type: 0x00, value: new Uint8Array([0x0f]) },
            { type: 0xaa, value: new Uint8Array([0xde, 0xad, 0xbe, 0xef]) },
            { type: 0xab, value: new Uint8Array() },
        ]);
        const ds = OperationalDataset.decode(blob);
        expect(ds.unknownTlvs).to.deep.equal([
            { type: 0xaa, value: new Uint8Array([0xde, 0xad, 0xbe, 0xef]) },
            { type: 0xab, value: new Uint8Array() },
        ]);
    });

    it("decodes the security policy as a 4-byte (rotation, flags) pair", () => {
        const blob = BasicTlv.encode([{ type: 0x0c, value: new Uint8Array([0x02, 0xa3, 0xff, 0xf8]) }]);
        const ds = OperationalDataset.decode(blob);
        expect(ds.securityPolicy).to.deep.equal({ rotationTime: 0x02a3, flags: 0xfff8 });
    });

    it("decodes the canonical 3-byte CHANNEL form", () => {
        const blob = BasicTlv.encode([{ type: 0x00, value: new Uint8Array([0x00, 0x00, 0x19]) }]);
        const ds = OperationalDataset.decode(blob);
        expect(ds.channel).to.equal(0x19);
    });

    it("rejects malformed fixed-width TLVs", () => {
        const blob = BasicTlv.encode([{ type: 0x05, value: new Uint8Array([0x01]) }]);
        expect(() => OperationalDataset.decode(blob)).to.throw(/NETWORK_KEY/);
    });

    it("populates _originalTlvs for round-trip identity", () => {
        const blob = loadFixture("synthetic-1.hex");
        const ds = OperationalDataset.decode(blob);
        expect(ds._originalTlvs).to.have.lengthOf(5);
    });
});
