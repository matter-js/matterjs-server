/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Environment, MockStorageService } from "@matter/general";
import { MatterController } from "../src/controller/MatterController.js";
import { ConfigStorage } from "../src/server/ConfigStorage.js";

function freshEnv(): Environment {
    const env = new Environment("test");
    new MockStorageService(env);
    return env;
}

describe("MatterController.cameraStreamsIfCreated", () => {
    let config: ConfigStorage;

    beforeEach(async () => {
        config = await ConfigStorage.create(freshEnv());
    });

    it("is undefined until cameraStreams is first accessed", () => {
        const controller = new MatterController(freshEnv(), config, {}, "server");
        expect(controller.cameraStreamsIfCreated).to.equal(undefined);
    });

    it("does not throw once the controller is stopped if cameraStreams was never accessed", async () => {
        const controller = new MatterController(freshEnv(), config, {}, "server");
        await controller.stop();
        expect(controller.cameraStreamsIfCreated).to.equal(undefined);
    });

    it("the cameraStreams getter itself still throws once stopped", async () => {
        const controller = new MatterController(freshEnv(), config, {}, "server");
        await controller.stop();
        expect(() => controller.cameraStreams).to.throw();
    });
});
