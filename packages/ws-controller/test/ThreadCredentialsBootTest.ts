/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Environment, MockStorageService } from "@matter/general";
import { Bytes } from "@matter/main";
import { ThreadCredentialsRegistry } from "@matter/thread-br-client";
import { registerThreadCredentialsFromHex } from "../src/controller/MatterController.js";
import { ConfigStorage } from "../src/server/ConfigStorage.js";

// Hand-built valid operational datasets with distinct extPanIds (no external fixture files).
// extPanId = 11:22:33:44:55:66:77:88, network = "OpenThread"
const DATASET_A_HEX =
    "00010f02081122334455667788030a4f70656e5468726561640410000102030405060708090a0b0c0d0e0f0e080000000000010000";
const EXT_PAN_A = "1122334455667788";

// extPanId = DE:AD:BE:EF:CA:FE:BA:BE, network = "TestNet"
const DATASET_B_HEX =
    "0003000019010212340208deadbeefcafebabe0307546573744e6574041055545756515053525d5c5f5e59585b5a0510a0a1a2a3a4a5a6a7a8a9aaabacadaeaf0708fd112233445566770c0402a0fff80e0800000000000100003508000800000000e0f0ee02feed";
const EXT_PAN_B = "deadbeefcafebabe";

function freshEnv(): Environment {
    const env = new Environment("test");
    new MockStorageService(env);
    return env;
}

/**
 * Simulate the boot path of #registerStoredThreadCredentials: iterate every
 * stored thread entry and register via registerThreadCredentialsFromHex.
 * This mirrors the exact production loop without requiring a full controller start.
 */
function simulateBoot(config: ConfigStorage, registry: ThreadCredentialsRegistry): void {
    for (const entry of config.listThreadCredentials()) {
        registerThreadCredentialsFromHex(registry, entry.dataset, `stored:${entry.id}`);
    }
}

describe("Thread credentials boot registration", () => {
    let config: ConfigStorage;

    beforeEach(async () => {
        config = await ConfigStorage.create(freshEnv());
    });

    it("registers every stored thread entry at boot", async () => {
        await config.setThreadCredentials(ConfigStorage.DEFAULT_CREDENTIAL_ID, DATASET_A_HEX);
        await config.setThreadCredentials("Extra", DATASET_B_HEX);

        const registry = new ThreadCredentialsRegistry();
        simulateBoot(config, registry);

        const xps = registry.list().map(c => Bytes.toHex(c.extPanId));
        expect(xps).to.include.members([EXT_PAN_A, EXT_PAN_B]);
        expect(registry.list()).to.have.lengthOf(2);
    });

    it("registers nothing when no thread credentials are stored (scaffolding removed)", async () => {
        const registry = new ThreadCredentialsRegistry();
        simulateBoot(config, registry);
        expect(registry.list()).to.have.lengthOf(0);
    });

    it("registers only the default entry when only the default is stored", async () => {
        await config.setThreadCredentials(ConfigStorage.DEFAULT_CREDENTIAL_ID, DATASET_A_HEX);

        const registry = new ThreadCredentialsRegistry();
        simulateBoot(config, registry);

        const xps = registry.list().map(c => Bytes.toHex(c.extPanId));
        expect(xps).to.deep.equal([EXT_PAN_A]);
    });

    it("skips malformed entries and continues registering valid ones", async () => {
        await config.setThreadCredentials(ConfigStorage.DEFAULT_CREDENTIAL_ID, DATASET_A_HEX);
        await config.setThreadCredentials("Bad", "0000");
        await config.setThreadCredentials("Good", DATASET_B_HEX);

        const registry = new ThreadCredentialsRegistry();
        simulateBoot(config, registry);

        const xps = registry.list().map(c => Bytes.toHex(c.extPanId));
        expect(xps).to.include.members([EXT_PAN_A, EXT_PAN_B]);
        expect(xps).to.not.include("0000");
    });
});
