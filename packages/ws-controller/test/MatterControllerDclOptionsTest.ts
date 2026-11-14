/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    Crypto,
    Entropy,
    Environment,
    ImplementationError,
    MockStorageService,
    Network,
    NetworkSimulator,
} from "@matter/general";
import { MatterController } from "../src/controller/MatterController.js";
import { ConfigStorage } from "../src/server/ConfigStorage.js";

function freshEnv(): Environment {
    const env = new Environment("test");
    new MockStorageService(env);
    return env;
}

const simulator = new NetworkSimulator();
let hostIndex = 0;

function runnableEnv(): Environment {
    const env = freshEnv();
    // Crypto is stateless, so the default environment's instance is safe to share.
    const crypto = Environment.default.get(Crypto);
    env.set(Entropy, crypto);
    env.set(Crypto, crypto);
    env.set(Network, simulator.addHost(++hostIndex));
    return env;
}

describe("MatterController DCL options", () => {
    it("rejects the offline mode without the DCL seed", async () => {
        const config = await ConfigStorage.create(freshEnv());
        expect(
            () => new MatterController(freshEnv(), config, { dclOffline: true, disableDclSeed: true }, "server"),
        ).to.throw(ImplementationError, "disableDclSeed");
    });

    it("serves local OTA images only with the OTA provider and the test-net DCL enabled", async () => {
        const config = await ConfigStorage.create(freshEnv());
        const localImages = (disableOtaProvider: boolean, enableTestNetDcl: boolean) =>
            new MatterController(freshEnv(), config, { disableOtaProvider, enableTestNetDcl }, "server")
                .localOtaImagesEnabled;

        expect(localImages(false, true)).equals(true);
        expect(localImages(false, false)).equals(false);
        expect(localImages(true, true)).equals(false);
        expect(localImages(true, false)).equals(false);
    });

    it("installs revocations into the certificate service commissioning consults", async () => {
        const config = await ConfigStorage.create(freshEnv());
        const controller = await MatterController.create(runnableEnv(), config, { dclOffline: true });
        try {
            controller.installRevocations([{ issuerSubjectKeyId: "0a0b", revokedSerialNumbers: ["01"] }]);

            const installed = (await controller.certificateService()).installedRevocations;
            expect([...installed.keys()]).deep.equals(["0A0B"]);
            expect([...(installed.get("0A0B")?.[0].serials ?? [])]).deep.equals(["01"]);
        } finally {
            await controller.stop();
        }
    });
});
