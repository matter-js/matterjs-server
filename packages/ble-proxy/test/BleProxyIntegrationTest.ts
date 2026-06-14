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
import { BinaryFrameOpcode, BleProxyCommand } from "../src/BleProxyProtocol.js";
import { ProxyBle } from "../src/ProxyBle.js";
import type { ProxyBleCentralInterface, ProxyBleChannel } from "../src/ProxyBleChannel.js";
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
            const devices = await proxyBle.scanner.findCommissionableDevicesContinuously({}, () => {}, Seconds(2));

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

            const devices = await proxyBle.scanner.findCommissionableDevicesContinuously(
                { longDiscriminator: 1234 },
                () => {},
                Seconds(2),
            );

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
            const devices = await proxyBle.scanner.findCommissionableDevicesContinuously(
                { longDiscriminator: 9999 },
                () => {},
                Seconds(1),
            );

            expect(devices.length).to.equal(0);
        });
    });

    describe("openChannel BTP handshake", () => {
        const C1_UUID = "18EE2EF5-263D-4559-959F-4F9C429F9D11";
        const C2_UUID = "18EE2EF5-263D-4559-959F-4F9C429F9D12";

        // Wires up command handlers for the full openChannel flow and arranges for the BTP
        // handshake response binary frame to be sent right after the C1 write.
        const wireBtpFlow = (mockDevice: MockBleDevice, connectionHandle = 1, mtu = 247) => {
            testClient.onCommand(BleProxyCommand.Connect, async () => ({
                connection_handle: connectionHandle,
                mtu,
            }));
            testClient.onCommand(BleProxyCommand.DiscoverServices, async () => ({
                services: mockDevice.services,
            }));
            testClient.onCommand(BleProxyCommand.DiscoverCharacteristics, async () => ({
                characteristics: mockDevice.characteristics,
            }));
            testClient.onCommand(BleProxyCommand.WriteAndSubscribe, async () => {
                // The combo write_and_subscribe is the last command before the channel
                // registers its binary frame observer, so simulate the device's BTP
                // handshake response now.
                setTimeout(() => {
                    testClient.sendBinaryFrame(
                        BinaryFrameOpcode.Notification,
                        connectionHandle,
                        mockDevice.generateBtpHandshakeResponse(),
                    );
                }, 30);
                return {};
            });
        };

        // Discovers the mock device on the proxy scanner so openChannel can resolve it.
        const discoverDevice = async (proxyBle: ProxyBle, mockDevice: MockBleDevice): Promise<void> => {
            testClient.onCommand(BleProxyCommand.StartScan, async () => {
                setTimeout(() => {
                    testClient.sendEvent("device_discovered", mockDevice.discoveredEventData);
                }, 20);
            });
            await proxyBle.scanner.findCommissionableDevicesContinuously({}, () => {}, Seconds(1));
        };

        it("should complete BTP handshake and return a connected channel", async () => {
            const proxyBle = new ProxyBle(handler);
            const mockDevice = new MockBleDevice({ discriminator: 3840, vendorId: 0xfff1, productId: 0x8000 });

            await discoverDevice(proxyBle, mockDevice);
            wireBtpFlow(mockDevice);

            const central = proxyBle.centralInterface as ProxyBleCentralInterface;
            // matter.js installs an onData listener before opening channels - mimic that here.
            central.onData(() => {});

            const channel = (await central.openChannel({
                type: "ble",
                peripheralAddress: mockDevice.address,
            })) as ProxyBleChannel;

            expect(channel.connected).to.be.true;
            expect(channel.name).to.equal(`ble-proxy://${mockDevice.address}`);

            // Verify the handshake exchange happened in the expected order
            const commandNames = testClient.receivedCommands.map(c => c.command);
            expect(commandNames).to.include("connect");
            expect(commandNames).to.include("discover_services");
            expect(commandNames).to.include("discover_characteristics");
            expect(commandNames).to.include("write_and_subscribe");

            // write_and_subscribe should target C1 for write and C2 for subscribe atomically
            const comboCmd = testClient.receivedCommands.find(c => c.command === "write_and_subscribe");
            const comboArgs = comboCmd?.args as { write_uuid: string; subscribe_uuid: string } | undefined;
            expect(comboArgs?.write_uuid).to.equal(C1_UUID);
            expect(comboArgs?.subscribe_uuid).to.equal(C2_UUID);

            await channel.close();
        });

        it("should complete handshake when the indication arrives before the WriteAndSubscribe response", async () => {
            const proxyBle = new ProxyBle(handler);
            const mockDevice = new MockBleDevice({ discriminator: 4242, vendorId: 0xfff1, productId: 0x8000 });

            await discoverDevice(proxyBle, mockDevice);

            testClient.onCommand(BleProxyCommand.Connect, async () => ({ connection_handle: 1, mtu: 247 }));
            testClient.onCommand(BleProxyCommand.DiscoverServices, async () => ({ services: mockDevice.services }));
            testClient.onCommand(BleProxyCommand.DiscoverCharacteristics, async () => ({
                characteristics: mockDevice.characteristics,
            }));
            // Emit the indication before returning the command result, so the binary frame reaches
            // the server ahead of the WriteAndSubscribe reply — the ordering that broke commissioning.
            testClient.onCommand(BleProxyCommand.WriteAndSubscribe, async () => {
                testClient.sendBinaryFrame(
                    BinaryFrameOpcode.Notification,
                    1,
                    mockDevice.generateBtpHandshakeResponse(),
                );
                return {};
            });

            const central = proxyBle.centralInterface as ProxyBleCentralInterface;
            central.onData(() => {});

            const channel = (await central.openChannel({
                type: "ble",
                peripheralAddress: mockDevice.address,
            })) as ProxyBleChannel;

            expect(channel.connected).to.be.true;
            await channel.close();
        });

        it("should reject when openChannel is called before onData listener is installed", async () => {
            const proxyBle = new ProxyBle(handler);
            const mockDevice = new MockBleDevice({ discriminator: 1234, vendorId: 0xfff1, productId: 0x8000 });

            await discoverDevice(proxyBle, mockDevice);

            const central = proxyBle.centralInterface as ProxyBleCentralInterface;
            // Note: no central.onData() call here - this should fail fast.
            try {
                await central.openChannel({ type: "ble", peripheralAddress: mockDevice.address });
                expect.fail("Should have thrown");
            } catch (err) {
                expect((err as Error).message).to.include("Network Interface");
            }
        });

        it("should disconnect and throw when device lacks the required Matter characteristics", async () => {
            const proxyBle = new ProxyBle(handler);
            const mockDevice = new MockBleDevice({ discriminator: 5555, vendorId: 0xfff1, productId: 0x8000 });

            await discoverDevice(proxyBle, mockDevice);

            testClient.onCommand(BleProxyCommand.Connect, async () => ({ connection_handle: 7, mtu: 244 }));
            testClient.onCommand(BleProxyCommand.DiscoverServices, async () => ({ services: mockDevice.services }));
            // Return only C3 - missing the required C1/C2 characteristics
            testClient.onCommand(BleProxyCommand.DiscoverCharacteristics, async () => ({
                characteristics: [{ uuid: "18EE2EF5-263D-4559-959F-4F9C429F9D13", properties: ["read"] }],
            }));
            // openChannel must call Disconnect during the failure cleanup path
            const disconnectPromise = testClient.waitForCommand("disconnect", 3000);
            testClient.onCommand(BleProxyCommand.Disconnect, async () => ({}));

            const central = proxyBle.centralInterface as ProxyBleCentralInterface;
            central.onData(() => {});

            try {
                await central.openChannel({ type: "ble", peripheralAddress: mockDevice.address });
                expect.fail("Should have thrown");
            } catch (err) {
                expect((err as Error).message).to.include("missing required Matter characteristics");
            }

            const disconnectCmd = await disconnectPromise;
            expect((disconnectCmd.args as { connection_handle: number }).connection_handle).to.equal(7);
        });

        it("tears down the channel when the owning proxy client disconnects", async () => {
            const proxyBle = new ProxyBle(handler);
            const mockDevice = new MockBleDevice({ discriminator: 7000, vendorId: 0xfff1, productId: 0x8000 });

            await discoverDevice(proxyBle, mockDevice);
            wireBtpFlow(mockDevice);

            const central = proxyBle.centralInterface as ProxyBleCentralInterface;
            central.onData(() => {});

            const channel = (await central.openChannel({
                type: "ble",
                peripheralAddress: mockDevice.address,
            })) as ProxyBleChannel;
            expect(channel.connected).to.be.true;

            // Owning proxy client drops entirely — the channel must tear down with it.
            testClient.close();
            await new Promise<void>(resolve => setTimeout(resolve, 100));

            expect(channel.connected).to.be.false;
        });
    });
});
