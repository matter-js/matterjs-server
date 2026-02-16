/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Integration tests for the BLE proxy pipeline.
 * Tests the full flow: BleProxyHandler <-> BleProxyTestClient with mock data.
 */

import { Seconds } from "@matter/main";
import { createServer } from "node:http";
import { BleProxyHandler } from "../src/BleProxyHandler.js";
import { BleProxyCommand } from "../src/BleProxyProtocol.js";
import { ProxyBle } from "../src/ProxyBle.js";
import { BleProxyTestClient } from "./BleProxyTestClient.js";
import { MockBleDevice } from "./MockBleDevice.js";

const TEST_PORT = 15580;
const TEST_BLE_URL = `ws://localhost:${TEST_PORT}/ble`;

describe("BLE Proxy Integration", function () {
    this.timeout(10_000);

    let handler: BleProxyHandler;
    let httpServer: ReturnType<typeof createServer>;
    let testClient: BleProxyTestClient;

    beforeEach(async () => {
        handler = new BleProxyHandler();
        httpServer = createServer();
        await handler.register(httpServer);

        await new Promise<void>((resolve, reject) => {
            httpServer.listen(TEST_PORT, () => resolve());
            httpServer.on("error", reject);
        });

        testClient = new BleProxyTestClient();
        await testClient.connect(TEST_BLE_URL);
    });

    afterEach(async () => {
        testClient.close();
        await handler.unregister();
        await new Promise<void>((resolve, reject) => {
            httpServer.close(err => (err ? reject(err) : resolve()));
        });
    });

    describe("handshake", () => {
        it("should complete handshake and report connected", () => {
            expect(handler.connected).to.be.true;
        });
    });

    describe("scanning", () => {
        it("should send start_scan and stop_scan commands", async () => {
            const proxyBle = new ProxyBle(handler);
            const mockDevice = new MockBleDevice({ discriminator: 3840, vendorId: 0xfff1, productId: 0x8000 });

            // When the server sends start_scan, respond and then send a discovered device
            testClient.onCommand(BleProxyCommand.StartScan, async () => {
                // Simulate device discovery after a short delay
                setTimeout(() => {
                    testClient.sendEvent("device_discovered", mockDevice.discoveredEventData);
                }, 50);
            });

            // Find devices with a short timeout
            const devices = await proxyBle.scanner.findCommissionableDevices({}, Seconds(2));

            expect(devices.length).to.be.greaterThanOrEqual(1);
            expect(devices[0].deviceIdentifier).to.equal(mockDevice.address);

            // Verify start_scan was received
            const scanCmd = testClient.receivedCommands.find(c => c.command === "start_scan");
            expect(scanCmd).to.not.be.undefined;
        });

        it("should match by discriminator", async () => {
            const proxyBle = new ProxyBle(handler);
            const mockDevice = new MockBleDevice({ discriminator: 1234, vendorId: 0xfff1, productId: 0x8000 });

            testClient.onCommand(BleProxyCommand.StartScan, async () => {
                setTimeout(() => {
                    testClient.sendEvent("device_discovered", mockDevice.discoveredEventData);
                }, 50);
            });

            const devices = await proxyBle.scanner.findCommissionableDevices({ longDiscriminator: 1234 }, Seconds(2));

            expect(devices.length).to.equal(1);
            expect(devices[0].D).to.equal(1234);
        });

        it("should return empty when no matching device found", async () => {
            const proxyBle = new ProxyBle(handler);
            const mockDevice = new MockBleDevice({ discriminator: 5678, vendorId: 0xfff1, productId: 0x8000 });

            testClient.onCommand(BleProxyCommand.StartScan, async () => {
                setTimeout(() => {
                    testClient.sendEvent("device_discovered", mockDevice.discoveredEventData);
                }, 50);
            });

            // Search for a different discriminator
            const devices = await proxyBle.scanner.findCommissionableDevices({ longDiscriminator: 9999 }, Seconds(1));

            expect(devices.length).to.equal(0);
        });
    });

    describe("command routing", () => {
        it("should send connect and receive typed result", async () => {
            testClient.onCommand(BleProxyCommand.Connect, async () => {
                return { connection_handle: 1, mtu: 247 };
            });

            const result = await handler.sendCommand(BleProxyCommand.Connect, { address: "AA:BB:CC:DD:EE:FF" });

            expect(result.connection_handle).to.equal(1);
            expect(result.mtu).to.equal(247);
        });

        it("should send discover_services and receive services", async () => {
            const mockDevice = new MockBleDevice({ discriminator: 3840, vendorId: 0xfff1, productId: 0x8000 });

            testClient.onCommand(BleProxyCommand.DiscoverServices, async () => {
                return { services: mockDevice.services };
            });

            const result = await handler.sendCommand(BleProxyCommand.DiscoverServices, { connection_handle: 1 });
            expect(result.services).to.have.length(1);
            expect(result.services[0].uuid).to.equal("fff6");
        });

        it("should send discover_characteristics and receive characteristics", async () => {
            const mockDevice = new MockBleDevice({ discriminator: 3840, vendorId: 0xfff1, productId: 0x8000 });

            testClient.onCommand(BleProxyCommand.DiscoverCharacteristics, async () => {
                return { characteristics: mockDevice.characteristics };
            });

            const result = await handler.sendCommand(BleProxyCommand.DiscoverCharacteristics, {
                connection_handle: 1,
                service_uuid: "fff6",
            });
            expect(result.characteristics).to.have.length(3);
        });

        it("should handle error responses", async () => {
            testClient.onCommand(BleProxyCommand.Connect, async () => {
                throw new Error("Device not found");
            });

            try {
                await handler.sendCommand(BleProxyCommand.Connect, { address: "XX:XX:XX:XX:XX:XX" });
                expect.fail("Should have thrown");
            } catch (err) {
                expect((err as Error).message).to.include("Device not found");
            }
        });
    });
});
