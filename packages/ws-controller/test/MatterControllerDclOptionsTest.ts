/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Environment, ImplementationError, MockStorageService } from "@matter/general";
import { MatterController } from "../src/controller/MatterController.js";
import { ConfigStorage } from "../src/server/ConfigStorage.js";

function freshEnv(): Environment {
    const env = new Environment("test");
    new MockStorageService(env);
    return env;
}

describe("MatterController DCL options", () => {
    it("rejects the offline mode without the DCL seed", async () => {
        const config = await ConfigStorage.create(freshEnv());
        expect(
            () => new MatterController(freshEnv(), config, { dclOffline: true, disableDclSeed: true }, "server"),
        ).to.throw(ImplementationError, "disableDclSeed");
    });
});
