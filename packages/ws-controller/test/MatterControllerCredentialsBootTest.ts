/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ThreadCredentialsRegistry } from "@matter-server/thread-br";
import { Bytes } from "@matter/main";
import { registerThreadCredentialsFromHex } from "../src/controller/MatterController.js";

// Mirrors packages/thread-br/test/fixtures/datasets/synthetic-1.hex. Kept inline so this
// test doesn't depend on relative paths into another package's source tree.
const SYNTHETIC_DATASET_HEX =
    "00010f02081122334455667788030a4f70656e5468726561640410000102030405060708090a0b0c0d0e0f0e080000000000010000";

describe("registerThreadCredentialsFromHex (boot path for stored thread dataset)", () => {
    let registry: ThreadCredentialsRegistry;

    beforeEach(() => {
        registry = new ThreadCredentialsRegistry();
    });

    it("is a no-op when no dataset is stored (undefined)", () => {
        const result = registerThreadCredentialsFromHex(registry, undefined, "stored dataset");
        expect(result).to.equal(false);
        expect(registry.list()).to.deep.equal([]);
    });

    it("is a no-op when the stored dataset is the empty string", () => {
        const result = registerThreadCredentialsFromHex(registry, "", "stored dataset");
        expect(result).to.equal(false);
        expect(registry.list()).to.deep.equal([]);
    });

    it("registers credentials from a valid dataset hex blob", () => {
        const result = registerThreadCredentialsFromHex(registry, SYNTHETIC_DATASET_HEX, "stored dataset");
        expect(result).to.equal(true);
        const list = registry.list();
        expect(list).to.have.lengthOf(1);
        expect(Bytes.toHex(list[0].extPanId).toUpperCase()).to.equal("1122334455667788");
        expect(list[0].networkName).to.equal("OpenThread");
    });

    it("warns and leaves the registry empty on malformed hex", () => {
        const result = registerThreadCredentialsFromHex(registry, "not-hex-at-all", "stored dataset");
        expect(result).to.equal(false);
        expect(registry.list()).to.deep.equal([]);
    });

    it("warns and leaves the registry empty when valid hex fails dataset decode", () => {
        const result = registerThreadCredentialsFromHex(registry, "0000", "stored dataset");
        expect(result).to.equal(false);
        expect(registry.list()).to.deep.equal([]);
    });
});
