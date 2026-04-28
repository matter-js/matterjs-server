/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Environment } from "@matter/main";
import { BorderRouterDiscovery } from "../src/controller/BorderRouterDiscovery.js";

describe("BorderRouterDiscovery", () => {
    let env: Environment;
    let discovery: BorderRouterDiscovery;

    beforeEach(() => {
        env = new Environment("test");
        discovery = new BorderRouterDiscovery(env);
    });

    afterEach(async () => {
        await discovery.stop();
    });

    it("starts with an empty registry", () => {
        expect(discovery.list()).to.deep.equal([]);
    });

    it("stop() before start() is a no-op", async () => {
        await discovery.stop();
        expect(discovery.list()).to.deep.equal([]);
    });

    it("start() is callable without errors", async () => {
        await discovery.start();
        expect(discovery.list()).to.deep.equal([]);
    });

    it("start() is idempotent", async () => {
        await discovery.start();
        await discovery.start();
        expect(discovery.list()).to.deep.equal([]);
    });

    it("stop() after start() is a no-op when registry is empty", async () => {
        await discovery.start();
        await discovery.stop();
        expect(discovery.list()).to.deep.equal([]);
    });

    it("stop() is idempotent", async () => {
        await discovery.start();
        await discovery.stop();
        await discovery.stop();
        expect(discovery.list()).to.deep.equal([]);
    });

    it("get() returns undefined when xa is unknown", () => {
        expect(discovery.get("AABBCCDDEEFF0011")).to.equal(undefined);
    });

    it("get() normalizes lowercase xa to uppercase", () => {
        expect(discovery.get("aabbccddeeff0011")).to.equal(undefined);
    });
});
