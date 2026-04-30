/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ThreadCredentialsRegistry } from "@matter-server/thread-br";
import { Bytes } from "@matter/main";
import { syncThreadCredentialsToDataset } from "../src/server/WebSocketControllerHandler.js";

// extPanId = 11:22:33:44:55:66:77:88, network = "OpenThread" — mirrors synthetic-1 fixture.
const DATASET_OPENTHREAD =
    "00010f02081122334455667788030a4f70656e5468726561640410000102030405060708090a0b0c0d0e0f0e080000000000010000";

function buildDataset(extPanIdHex: string, networkName: string): string {
    const bytes: number[] = [];
    // CHANNEL TLV
    bytes.push(0x00, 0x01, 0x0f);
    // EXTPANID TLV
    const xp = Array.from(Bytes.of(Bytes.fromHex(extPanIdHex)));
    bytes.push(0x02, 0x08, ...xp);
    // NETWORK_NAME TLV
    const name = Array.from(new TextEncoder().encode(networkName));
    bytes.push(0x03, name.length, ...name);
    // PSKC TLV (16 bytes; arbitrary)
    bytes.push(0x04, 0x10);
    for (let i = 0; i < 16; i++) bytes.push(i);
    // ACTIVE_TIMESTAMP TLV
    bytes.push(0x0e, 0x08, 0, 0, 0, 0, 0, 1, 0, 0);
    return Bytes.toHex(new Uint8Array(bytes));
}

describe("syncThreadCredentialsToDataset", () => {
    let registry: ThreadCredentialsRegistry;

    beforeEach(() => {
        registry = new ThreadCredentialsRegistry();
    });

    it("registers credentials for a valid dataset", () => {
        syncThreadCredentialsToDataset(registry, DATASET_OPENTHREAD);
        const list = registry.list();
        expect(list).to.have.lengthOf(1);
        expect(Bytes.toHex(list[0].extPanId).toUpperCase()).to.equal("1122334455667788");
        expect(list[0].networkName).to.equal("OpenThread");
    });

    it("clears the registry when called with an empty dataset", () => {
        syncThreadCredentialsToDataset(registry, DATASET_OPENTHREAD);
        expect(registry.list()).to.have.lengthOf(1);
        syncThreadCredentialsToDataset(registry, "");
        expect(registry.list()).to.deep.equal([]);
    });

    it("replaces credentials in place when re-applied with the same extPanId", () => {
        syncThreadCredentialsToDataset(registry, DATASET_OPENTHREAD);
        syncThreadCredentialsToDataset(registry, DATASET_OPENTHREAD);
        expect(registry.list()).to.have.lengthOf(1);
    });

    it("drops the prior entry when the new dataset has a different extPanId", () => {
        syncThreadCredentialsToDataset(registry, DATASET_OPENTHREAD);
        const otherHex = buildDataset("AABBCCDDEEFF0011", "OtherNet");
        syncThreadCredentialsToDataset(registry, otherHex);
        const list = registry.list();
        expect(list).to.have.lengthOf(1);
        expect(Bytes.toHex(list[0].extPanId).toUpperCase()).to.equal("AABBCCDDEEFF0011");
        expect(list[0].networkName).to.equal("OtherNet");
    });

    it("leaves the registry unchanged when the new dataset fails to decode", () => {
        syncThreadCredentialsToDataset(registry, DATASET_OPENTHREAD);
        // Valid hex but invalid TLV stream (zero-length CHANNEL throws).
        syncThreadCredentialsToDataset(registry, "0000");
        const list = registry.list();
        expect(list).to.have.lengthOf(1);
        expect(Bytes.toHex(list[0].extPanId).toUpperCase()).to.equal("1122334455667788");
    });
});
