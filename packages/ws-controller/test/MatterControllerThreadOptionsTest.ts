/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Environment, MockStorageService } from "@matter/general";
import { MatterController, parseRestBaseUrl } from "../src/controller/MatterController.js";
import { ThreadDiagnosticsService } from "../src/controller/ThreadDiagnosticsService.js";
import { ConfigStorage } from "../src/server/ConfigStorage.js";

function freshEnv(): Environment {
    const env = new Environment("test");
    new MockStorageService(env);
    return env;
}

describe("MatterController Thread diagnostics options", () => {
    let config: ConfigStorage;

    beforeEach(async () => {
        config = await ConfigStorage.create(freshEnv());
    });

    it("probes the OTBR default port when no port is configured", () => {
        const controller = new MatterController(freshEnv(), config, {}, "server");
        expect(controller.threadDiagnostics.restProbePort).to.equal(ThreadDiagnosticsService.DEFAULT_REST_PROBE_PORT);
    });

    it("passes the configured port to the diagnostics service", () => {
        const controller = new MatterController(freshEnv(), config, { threadRestProbePort: 8080 }, "server");
        expect(controller.threadDiagnostics.restProbePort).to.equal(8080);
    });

    it("keeps the capability's port for the collection and dataset clients", () => {
        expect(parseRestBaseUrl("http://[fd00::1]:8080")).to.deep.equal({ host: "fd00::1", port: 8080 });
        expect(parseRestBaseUrl("http://192.0.2.1:8081")).to.deep.equal({ host: "192.0.2.1", port: 8081 });
    });

    // `new URL("http://[fd00::1]:80").port` is "".
    it("resolves a scheme-default port rather than falling back to the probe default", () => {
        expect(parseRestBaseUrl("http://[fd00::1]:80")).to.deep.equal({ host: "fd00::1", port: 80 });
        expect(parseRestBaseUrl("https://otbr.local:443")).to.deep.equal({ host: "otbr.local", port: 443 });
    });
});
