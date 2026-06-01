/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { createServer } from "node:http";
import { BleProxyHandler } from "../src/BleProxyHandler.js";
import { BleProxyTestClient } from "./BleProxyTestClient.js";

const TEST_PORT = 15582;
const TEST_BLE_URL = `ws://localhost:${TEST_PORT}/ble`;

describe("Multi-client BLE Proxy", function () {
    this.timeout(10_000);

    let handler: BleProxyHandler;
    let httpServer: ReturnType<typeof createServer>;
    const clients: BleProxyTestClient[] = [];

    const addClient = async (): Promise<BleProxyTestClient> => {
        const c = new BleProxyTestClient();
        await c.connect(TEST_BLE_URL);
        clients.push(c);
        return c;
    };

    beforeEach(async () => {
        handler = new BleProxyHandler();
        httpServer = createServer();
        await handler.register(httpServer);
        await new Promise<void>((resolve, reject) => {
            httpServer.listen(TEST_PORT, () => resolve());
            httpServer.on("error", reject);
        });
    });

    afterEach(async () => {
        for (const c of clients) c.close();
        clients.length = 0;
        await handler.unregister();
        await new Promise<void>((resolve, reject) => {
            httpServer.close(err => (err ? reject(err) : resolve()));
        });
    });

    it("accepts more than one client and reports connected", async () => {
        await addClient();
        await addClient();
        // Allow both handshakes to settle.
        await new Promise<void>(resolve => setTimeout(resolve, 100));
        expect(handler.connected).to.be.true;
    });
});
