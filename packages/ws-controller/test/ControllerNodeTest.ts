/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    Crypto,
    Entropy,
    Environment,
    MemoryStorageDriver,
    MockCrypto,
    MockStorageService,
    Network,
    NetworkSimulator,
    SupportedStorageTypes,
} from "@matter/general";
import { createControllerNode, ControllerNodeOptions } from "../src/controller/MatterController.js";

const NODE_ID = "controller";

/**
 * Environments sharing one storage record, so a later call sees what an earlier one wrote. Each hands out
 * its storage driver, whose `initialized` flag reports whether the node still holds it open.
 */
function createEnvironments() {
    const storage: Record<string, Record<string, SupportedStorageTypes>> = {};
    const simulator = new NetworkSimulator();
    let index = 0;

    return () => {
        const env = new Environment(`controller-${++index}`);
        const crypto = MockCrypto(index);
        env.set(Entropy, crypto);
        env.set(Crypto, crypto);
        env.set(Network, simulator.addHost(index));
        const driver = new MemoryStorageDriver(storage);
        new MockStorageService(env, () => driver);
        return { env, driver };
    };
}

describe("createControllerNode", () => {
    let nextEnvironment: ReturnType<typeof createEnvironments>;

    beforeEach(() => {
        MockTime.reset();
        nextEnvironment = createEnvironments();
    });

    function build(overrides?: Partial<ControllerNodeOptions>) {
        const { env, driver } = nextEnvironment();
        const options: ControllerNodeOptions = {
            environment: env,
            id: NODE_ID,
            adminFabricLabel: "TestFabric",
            serverVersion: "1.0.0",
            enableOtaProvider: false,
            ...overrides,
        };
        return { driver, controller: createControllerNode(options) };
    }

    it("builds a node with a fabric on the configured label", async () => {
        const controller = await build().controller;
        try {
            expect(controller.fabric.label).equals("TestFabric");
            expect(controller.otaProvider).equals(undefined);
        } finally {
            await controller.close();
        }
    });

    it("adds an OTA provider endpoint when enabled", async () => {
        const controller = await build({ enableOtaProvider: true }).controller;
        try {
            expect(controller.otaProvider?.id).equals("ota-provider");
        } finally {
            await controller.close();
        }
    });

    it("releases its storage when closed", async () => {
        const { driver, controller } = build();
        await (await controller).close();

        expect(driver.initialized).equals(false);
    });

    it("repairs restored peers before handing the node over", async () => {
        const marker = {
            peerSettingsRepairedFor: undefined as string | undefined,
            markedFor: new Array<string>(),
            async markPeerSettingsRepaired(scope: string) {
                this.markedFor.push(scope);
            },
        };

        const controller = await build({ peerSettingsRepair: marker }).controller;
        await controller.close();

        expect(marker.markedFor).deep.equals([NODE_ID]);
    });

    it("closes the node when the peer repair fails", async () => {
        const marker = {
            peerSettingsRepairedFor: undefined,
            async markPeerSettingsRepaired() {
                throw new Error("storage is gone");
            },
        };

        const { driver, controller } = build({ peerSettingsRepair: marker });
        await expect(controller).rejectedWith("storage is gone");

        expect(driver.initialized).equals(false);
    });

    it("closes the node it created when a later build step fails", async () => {
        const first = await build().controller;
        await first.close();

        // A label the fabric cannot take, so the failure lands after the node — and the storage it
        // opened — already exist.
        const { driver, controller } = build({ adminFabricLabel: "l".repeat(33) });
        await expect(controller).rejectedWith(/between 1 and 32 characters/);

        expect(driver.initialized).equals(false);
    });
});
