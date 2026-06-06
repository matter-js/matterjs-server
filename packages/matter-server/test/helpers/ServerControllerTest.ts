/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    DockerServerController,
    LocalProcessServerController,
    createServerController,
    type ServerControllerOptions,
} from "./ServerController.js";

const BASE_OPTS: ServerControllerOptions = {
    storagePath: "/tmp/matter-test-storage",
    logFilePath: "/tmp/matter-test-storage/server.log",
};

describe("createServerController", function () {
    const originalMode = process.env.MATTER_TEST_SERVER_MODE;

    afterEach(function () {
        if (originalMode === undefined) {
            delete process.env.MATTER_TEST_SERVER_MODE;
        } else {
            process.env.MATTER_TEST_SERVER_MODE = originalMode;
        }
    });

    it("defaults to the local process controller when the env var is unset", function () {
        delete process.env.MATTER_TEST_SERVER_MODE;
        expect(createServerController(BASE_OPTS)).to.be.instanceOf(LocalProcessServerController);
    });

    it("returns the local controller for mode=local", function () {
        process.env.MATTER_TEST_SERVER_MODE = "local";
        expect(createServerController(BASE_OPTS)).to.be.instanceOf(LocalProcessServerController);
    });

    it("returns the docker controller for mode=docker", function () {
        process.env.MATTER_TEST_SERVER_MODE = "docker";
        expect(createServerController(BASE_OPTS)).to.be.instanceOf(DockerServerController);
    });

    it("throws on an unknown mode", function () {
        process.env.MATTER_TEST_SERVER_MODE = "bogus";
        expect(() => createServerController(BASE_OPTS)).to.throw(/MATTER_TEST_SERVER_MODE/);
    });
});
