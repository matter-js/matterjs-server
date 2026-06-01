/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { createServer } from "node:http";
import { BleProxyHandler } from "../src/BleProxyHandler.js";
import { BleProxyCommand } from "../src/BleProxyProtocol.js";
import { ProxyBleClient } from "../src/ProxyBleClient.js";
import { BleProxyTestClient } from "./BleProxyTestClient.js";

const matterServiceData = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]).toString("base64");

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

    it("broadcasts start_scan to all connected clients", async () => {
        const a = await addClient();
        const b = await addClient();
        await new Promise<void>(resolve => setTimeout(resolve, 50));

        await handler.startScan({ service_uuids: ["fff6"], allow_duplicates: false });

        const [cmdA, cmdB] = await Promise.all([a.waitForCommand("start_scan"), b.waitForCommand("start_scan")]);
        expect(cmdA.command).to.equal("start_scan");
        expect(cmdB.command).to.equal("start_scan");
    });

    it("sends start_scan to a client that joins mid-scan", async () => {
        await addClient();
        await new Promise<void>(resolve => setTimeout(resolve, 50));
        await handler.startScan({ service_uuids: ["fff6"], allow_duplicates: false });

        const late = await addClient();
        const cmd = await late.waitForCommand("start_scan");
        expect(cmd.command).to.equal("start_scan");
    });

    it("stopScanning clears hub scan intent even after a transient scanStopped", async () => {
        const a = await addClient();
        await new Promise<void>(resolve => setTimeout(resolve, 50));

        const client = new ProxyBleClient(handler);
        await client.startScanning();
        await a.waitForCommand("start_scan");

        // Transient all-clients-stopped resets ProxyBleClient's #isScanning via hub.scanStopped.
        a.sendEvent("scan_stopped", { reason: "transient" });
        await new Promise<void>(resolve => setTimeout(resolve, 30));

        // stopScanning must still reach the hub; otherwise #scanActive lingers.
        const stopPromise = a.waitForCommand("stop_scan", 1000);
        await client.stopScanning();
        const cmd = await stopPromise;
        expect(cmd.command).to.equal("stop_scan");

        client.close();
    });

    it("emits scanStopped when the last scanning client disconnects", async () => {
        const a = await addClient();
        await new Promise<void>(resolve => setTimeout(resolve, 50));

        let stopped = false;
        handler.scanStopped.on(() => {
            stopped = true;
        });

        await handler.startScan({ service_uuids: ["fff6"], allow_duplicates: false });
        a.close();
        await new Promise<void>(resolve => setTimeout(resolve, 100));

        expect(stopped).to.be.true;
    });

    it("assigns ownership to the first client that discovers a peripheral", async () => {
        const a = await addClient();
        const b = await addClient();
        await new Promise<void>(resolve => setTimeout(resolve, 50));

        const address = "AA:BB:CC:DD:EE:FF";
        const discovered = {
            address,
            connectable: true,
            service_data: { fff6: matterServiceData },
        };

        // Client A sees it first, then B.
        a.sendEvent("device_discovered", discovered);
        await new Promise<void>(resolve => setTimeout(resolve, 30));
        b.sendEvent("device_discovered", discovered);
        await new Promise<void>(resolve => setTimeout(resolve, 30));

        const owner = handler.getOwner(address);
        expect(owner).to.not.be.undefined;

        // Route a connect through the owner; only client A should receive it.
        a.onCommand(BleProxyCommand.Connect, async () => ({ connection_handle: 1, mtu: 247 }));
        b.onCommand(BleProxyCommand.Connect, async () => ({ connection_handle: 9, mtu: 247 }));

        const aGotConnect = a.waitForCommand("connect", 1000);
        await owner!.sendCommand(BleProxyCommand.Connect, { address });

        const cmd = await aGotConnect;
        expect(cmd.command).to.equal("connect");
        expect(b.receivedCommands.find(c => c.command === "connect")).to.be.undefined;
    });

    it("reassigns ownership to another seer when the owner disconnects", async () => {
        const a = await addClient();
        const b = await addClient();
        await new Promise<void>(resolve => setTimeout(resolve, 50));

        const address = "AA:BB:CC:DD:EE:11";
        const discovered = {
            address,
            connectable: true,
            service_data: { fff6: matterServiceData },
        };

        a.sendEvent("device_discovered", discovered);
        b.sendEvent("device_discovered", discovered);
        await new Promise<void>(resolve => setTimeout(resolve, 50));

        expect(handler.getOwner(address)).to.not.be.undefined;

        // Drop client A (the first-seen owner). Ownership should fall to B.
        a.close();
        await new Promise<void>(resolve => setTimeout(resolve, 100));

        const owner = handler.getOwner(address);
        expect(owner).to.not.be.undefined;

        b.onCommand(BleProxyCommand.Connect, async () => ({ connection_handle: 2, mtu: 247 }));
        const bGotConnect = b.waitForCommand("connect", 1000);
        await owner!.sendCommand(BleProxyCommand.Connect, { address });

        const cmd = await bGotConnect;
        expect(cmd.command).to.equal("connect");
    });

    it("drops a peripheral when its last seer disconnects", async () => {
        const a = await addClient();
        await new Promise<void>(resolve => setTimeout(resolve, 50));

        const address = "AA:BB:CC:DD:EE:22";
        a.sendEvent("device_discovered", {
            address,
            connectable: true,
            service_data: { fff6: matterServiceData },
        });
        await new Promise<void>(resolve => setTimeout(resolve, 50));
        expect(handler.getOwner(address)).to.not.be.undefined;

        a.close();
        await new Promise<void>(resolve => setTimeout(resolve, 100));
        expect(handler.getOwner(address)).to.be.undefined;
    });
});
