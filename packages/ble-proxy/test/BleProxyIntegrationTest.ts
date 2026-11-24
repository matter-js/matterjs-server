/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Integration tests for the BLE proxy pipeline.
 * Tests the full flow: BleProxyHandler <-> BleProxyTestClient with mock data.
 */

import { Bytes, InternalError, NetworkError, Seconds } from "@matter/main";
import { BleDisconnectedError, BtpCodec, MatterBle } from "@matter/main/protocol";
import { createServer } from "node:http";
import { BleProxyClientDisconnectedError } from "../src/BleProxyConnection.js";
import { BleProxyHandler } from "../src/BleProxyHandler.js";
import { BinaryFrameOpcode, BleProxyCommand, BleProxyErrorCode } from "../src/BleProxyProtocol.js";
import { ProxyBle } from "../src/ProxyBle.js";
import type { ProxyBleCentralInterface } from "../src/ProxyBleChannel.js";
import { BleProxyTestClient } from "./BleProxyTestClient.js";
import { MockBleDevice } from "./MockBleDevice.js";

const TEST_PORT = 15580;

/** Polls a condition against real IO, which the WebSocket round-trips in these tests run on. */
async function waitFor(condition: () => boolean, timeoutMs = 2000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!condition()) {
        if (Date.now() > deadline) {
            throw new InternalError("Timeout waiting for condition");
        }
        await new Promise<void>(resolve => setTimeout(resolve, 10));
    }
}
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

    describe("liveness", () => {
        /**
         * The liveness timer is created during the handshake, so MockTime must already be enabled
         * when the connection is accepted — otherwise the timer binds to the real clock and
         * `MockTime.advance` never drives it. The connection from `beforeEach` is dropped first so
         * `handler.connected`, an OR across all connections, speaks about this connection alone.
         */
        const connectAloneUnderMockTime = async (): Promise<BleProxyTestClient> => {
            testClient.close();
            await waitFor(() => !handler.connected);
            MockTime.enable();
            const client = new BleProxyTestClient();
            await client.connect(TEST_BLE_URL);
            return client;
        };

        /**
         * `MockTime.advance` never yields to the event loop's poll phase, so an incoming pong can
         * only be read between two advances. Both liveness tests therefore push the mocked clock
         * across the timeout in two hops with a real-IO hop in between; without it neither test can
         * tell a client that answers from one that does not.
         */
        const advancePastLivenessTimeout = async (client: BleProxyTestClient): Promise<void> => {
            const ping = client.waitForPing().catch(() => {});
            await MockTime.advance(Seconds(40));
            await ping;
            await new Promise<void>(resolve => setTimeout(resolve, 50));
            await MockTime.advance(Seconds(40));
        };

        it("terminates a connection whose client stopped answering", async () => {
            const deadClient = await connectAloneUnderMockTime();
            try {
                deadClient.simulateHalfOpen();
                await advancePastLivenessTimeout(deadClient);

                expect(handler.connected).to.be.false;
            } finally {
                MockTime.disable();
                deadClient.close();
            }
        });

        it("keeps a connection alive while its client answers pings", async () => {
            const liveClient = await connectAloneUnderMockTime();
            try {
                await advancePastLivenessTimeout(liveClient);

                expect(handler.connected).to.be.true;
            } finally {
                MockTime.disable();
                liveClient.close();
            }
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

            const central = proxyBle.centralInterface;
            // matter.js installs an onData listener before opening channels - mimic that here.
            central.onData(() => {});

            const channel = await central.openChannel({
                type: "ble",
                peripheralAddress: mockDevice.address,
            });

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

            const central = proxyBle.centralInterface;
            central.onData(() => {});

            const channel = await central.openChannel({
                type: "ble",
                peripheralAddress: mockDevice.address,
            });

            expect(channel.connected).to.be.true;
            await channel.close();
        });

        it("should reject when openChannel is called before onData listener is installed", async () => {
            const proxyBle = new ProxyBle(handler);
            const mockDevice = new MockBleDevice({ discriminator: 1234, vendorId: 0xfff1, productId: 0x8000 });

            await discoverDevice(proxyBle, mockDevice);

            const central = proxyBle.centralInterface;
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

            const central = proxyBle.centralInterface;
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

        it("rejects openChannel (not crash) when the handshake times out while the write is still pending", async () => {
            const proxyBle = new ProxyBle(handler);
            const mockDevice = new MockBleDevice({ discriminator: 8888, vendorId: 0xfff1, productId: 0x8000 });

            await discoverDevice(proxyBle, mockDevice);

            testClient.onCommand(BleProxyCommand.Connect, async () => ({ connection_handle: 9, mtu: 247 }));
            testClient.onCommand(BleProxyCommand.DiscoverServices, async () => ({ services: mockDevice.services }));
            testClient.onCommand(BleProxyCommand.DiscoverCharacteristics, async () => ({
                characteristics: mockDevice.characteristics,
            }));
            // Write ack never returns and no handshake frame is sent, so the handshake timer fires while
            // WriteAndSubscribe is still pending: openChannel must reject, not leave an unhandled rejection.
            testClient.onCommand(BleProxyCommand.WriteAndSubscribe, () => new Promise<void>(() => {}));
            testClient.onCommand(BleProxyCommand.Disconnect, async () => ({}));

            const central = proxyBle.centralInterface;
            central.onData(() => {});

            // MockTime is disabled by default in this package; enable it only around the timed-out phase so
            // the handshake timer fires without a real 15s wait — the proxy WS round-trips run on real IO.
            MockTime.enable();
            try {
                const settled = central.openChannel({ type: "ble", peripheralAddress: mockDevice.address }).then(
                    () => ({ ok: true as const }),
                    (err: Error) => ({ ok: false as const, err }),
                );
                await testClient.waitForCommand("write_and_subscribe", 5000);
                await MockTime.advance(Seconds(16));

                const outcome = await settled;
                expect(outcome.ok, "openChannel should reject, not resolve or crash").to.be.false;
                if (!outcome.ok) {
                    expect(outcome.err.message).to.include("BTP handshake response not received");
                }
                await testClient.waitForCommand("disconnect", 1000);
            } finally {
                MockTime.disable();
            }
        });

        it("tears down the channel when the owning proxy client disconnects", async () => {
            const proxyBle = new ProxyBle(handler);
            const mockDevice = new MockBleDevice({ discriminator: 7000, vendorId: 0xfff1, productId: 0x8000 });

            await discoverDevice(proxyBle, mockDevice);
            wireBtpFlow(mockDevice);

            const central = proxyBle.centralInterface;
            central.onData(() => {});

            const channel = await central.openChannel({
                type: "ble",
                peripheralAddress: mockDevice.address,
            });
            expect(channel.connected).to.be.true;

            // Owning proxy client drops entirely — the channel must tear down with it.
            testClient.close();
            await new Promise<void>(resolve => setTimeout(resolve, 100));

            expect(channel.connected).to.be.false;
        });

        const openConnectedChannel = async (discriminator: number, connectionHandle: number) => {
            const proxyBle = new ProxyBle(handler);
            const mockDevice = new MockBleDevice({ discriminator, vendorId: 0xfff1, productId: 0x8000 });
            await discoverDevice(proxyBle, mockDevice);
            wireBtpFlow(mockDevice, connectionHandle);
            testClient.onCommand(BleProxyCommand.Disconnect, async () => ({}));

            const central = proxyBle.centralInterface;
            central.onData(() => {});
            return await central.openChannel({
                type: "ble",
                peripheralAddress: mockDevice.address,
            });
        };

        const sentDisconnects = () => testClient.receivedCommands.filter(c => c.command === "disconnect");
        // Disconnect is sent without waiting for its reply, so give a wrongly sent one time to arrive
        const settle = () => new Promise<void>(resolve => setTimeout(resolve, 100));

        it("disconnects the peripheral once when a connected channel is closed", async () => {
            const channel = await openConnectedChannel(7100, 4);

            await channel.close();
            await channel.close();
            await waitFor(() => sentDisconnects().length > 0);
            await settle();

            const disconnects = sentDisconnects();
            expect(disconnects.length).to.equal(1);
            expect((disconnects[0].args as { connection_handle: number }).connection_handle).to.equal(4);
        });

        it("closes without waiting for the proxy to finish the disconnect", async () => {
            const channel = await openConnectedChannel(7300, 6);
            testClient.onCommand(BleProxyCommand.Disconnect, () => new Promise<void>(() => {}));

            await channel.close();

            await testClient.waitForCommand("disconnect", 1000);
        });

        it("notifies close listeners once when closed twice", async () => {
            const channel = await openConnectedChannel(7400, 7);
            let closeNotifications = 0;
            channel.onClose(() => closeNotifications++);

            await channel.close();
            await channel.close();

            expect(closeNotifications).to.equal(1);
        });

        it("rejects sends after the proxy reported the peripheral as disconnected", async () => {
            const channel = await openConnectedChannel(7500, 8);

            testClient.sendEvent("disconnected", { connection_handle: 8 });
            await waitFor(() => !channel.connected);

            await expect(channel.send(Bytes.fromHex("0102"))).rejectedWith(BleDisconnectedError);
        });

        it("ends the channel when the BTP session closes itself", async () => {
            const proxyBle = new ProxyBle(handler);
            const mockDevice = new MockBleDevice({ discriminator: 7600, vendorId: 0xfff1, productId: 0x8000 });
            await discoverDevice(proxyBle, mockDevice);
            // ATT MTU 23 gives the minimum segment size, where a timeout closes the session instead of renegotiating
            wireBtpFlow(mockDevice, 9, 23);
            testClient.onCommand(BleProxyCommand.Disconnect, async () => ({}));
            const central = proxyBle.centralInterface;
            central.onData(() => {});

            // MockTime only around the channel's lifetime: discovery above relies on real timers
            MockTime.enable();
            try {
                const channel = await central.openChannel({
                    type: "ble",
                    peripheralAddress: mockDevice.address,
                });
                let closeNotifications = 0;
                channel.onClose(() => closeNotifications++);
                // The mock device never answers, so a BTP timeout closes the session
                await channel.send(Bytes.fromHex("0102"));
                await MockTime.advance(MatterBle.BTP_CONN_IDLE_TIMEOUT);

                expect(channel.isClosed).to.be.true;
                expect(channel.connected).to.be.false;
                expect(closeNotifications).to.equal(1);
                await expect(channel.send(Bytes.fromHex("0102"))).rejectedWith(BleDisconnectedError);
                await waitFor(() => sentDisconnects().length > 0);

                testClient.sendEvent("disconnected", { connection_handle: 9 });
                await channel.close();
                await settle();
                expect(closeNotifications).to.equal(1);
            } finally {
                MockTime.disable();
            }
        });

        const handshakeRequests = () => testClient.receivedCommands.filter(c => c.command === "write_and_subscribe");
        const requestedSegmentSize = (command: { args?: Record<string, unknown> }) =>
            Buffer.from(String(command.args?.write_value), "base64").readUInt16LE(6);

        // Prepares a channel with 244-byte segments to a device that never answers, so the first send stalls.
        // Discovery runs here on real timers; the returned function opens the channel.
        const prepareStallingChannel = async (
            discriminator: number,
            connectionHandle: number,
            onData: (data: Bytes) => void = () => {},
        ) => {
            const proxyBle = new ProxyBle(handler);
            const mockDevice = new MockBleDevice({ discriminator, vendorId: 0xfff1, productId: 0x8000 });
            await discoverDevice(proxyBle, mockDevice);
            wireBtpFlow(mockDevice, connectionHandle);
            testClient.onCommand(BleProxyCommand.Disconnect, async () => ({}));
            const central = proxyBle.centralInterface;
            central.onData((_channel, data) => onData(data));
            return async () =>
                await central.openChannel({
                    type: "ble",
                    peripheralAddress: mockDevice.address,
                });
        };

        it("retries with the minimum segment size and resends when the peer stalls after the handshake", async () => {
            testClient.onCommand(BleProxyCommand.UnsubscribeCharacteristic, async () => ({}));
            const open = await prepareStallingChannel(7700, 10);
            MockTime.enable();
            try {
                const channel = await open();
                await channel.send(new Uint8Array(10).fill(0xab));
                await waitFor(() => testClient.receivedBinaryFrames.length > 0);
                const framesBeforeStall = testClient.receivedBinaryFrames.length;

                await MockTime.advance(Seconds(16));
                const sentDuringRetry = channel.send(new Uint8Array(10).fill(0xcd)).then(
                    () => "sent",
                    (error: unknown) => error,
                );
                await waitFor(() => handshakeRequests().length === 2);
                await waitFor(() =>
                    testClient.receivedBinaryFrames
                        .slice(framesBeforeStall)
                        .some(frame => frame.payload.includes(0xcd)),
                );

                const [first, retry] = handshakeRequests();
                expect(requestedSegmentSize(first)).to.equal(244);
                expect(requestedSegmentSize(retry)).to.equal(MatterBle.MINIMUM_ATT_MTU);
                const commands = testClient.receivedCommands.map(c => c.command);
                expect(commands).to.include("unsubscribe_characteristic");
                expect(commands.indexOf("unsubscribe_characteristic")).to.be.lessThan(
                    commands.lastIndexOf("write_and_subscribe"),
                );
                const resent = testClient.receivedBinaryFrames.slice(framesBeforeStall);
                expect(resent.every(frame => frame.payload.length <= MatterBle.MINIMUM_ATT_MTU)).to.be.true;
                const replayed = resent.findIndex(frame => frame.payload.includes(0xab));
                expect(replayed).to.be.at.least(0);
                expect(replayed).to.be.lessThan(resent.findIndex(frame => frame.payload.includes(0xcd)));
                expect(await sentDuringRetry).to.equal("sent");
                expect(channel.isClosed).to.be.false;
            } finally {
                MockTime.disable();
            }
        });

        it("closes the channel when the retry with the minimum segment size fails", async () => {
            testClient.onCommandError(BleProxyCommand.UnsubscribeCharacteristic, "not_subscribed", "Not subscribed");
            const open = await prepareStallingChannel(7800, 11);
            MockTime.enable();
            try {
                const channel = await open();
                await channel.send(new Uint8Array(100).fill(0xab));

                await MockTime.advance(Seconds(16));
                await waitFor(() => channel.isClosed);

                await expect(channel.send(Bytes.fromHex("0102"))).rejectedWith(BleDisconnectedError);
                await waitFor(() => sentDisconnects().length > 0);
                expect(testClient.receivedCommands.map(c => c.command)).to.include("unsubscribe_characteristic");
                expect(handshakeRequests().length).to.equal(1);
            } finally {
                MockTime.disable();
            }
        });

        it("ends a running retry and waiting sends at once when the channel closes", async () => {
            testClient.onCommand(BleProxyCommand.UnsubscribeCharacteristic, () => new Promise<void>(() => {}));
            const open = await prepareStallingChannel(7850, 13);
            MockTime.enable();
            try {
                const channel = await open();
                await channel.send(new Uint8Array(100).fill(0xab));
                await MockTime.advance(Seconds(16));
                await testClient.waitForCommand("unsubscribe_characteristic", 1000);

                const waitingSend = channel.send(Bytes.fromHex("0102"));
                await channel.close();

                await expect(waitingSend).rejectedWith(BleDisconnectedError);
                await waitFor(() => sentDisconnects().length > 0);
                await settle();
                expect(sentDisconnects().length).to.equal(1);
            } finally {
                MockTime.disable();
            }
        });

        // Discovers a device and answers Connect; the remaining commands are up to the test.
        const prepareOpen = async (discriminator: number, connectionHandle: number) => {
            const proxyBle = new ProxyBle(handler);
            const mockDevice = new MockBleDevice({ discriminator, vendorId: 0xfff1, productId: 0x8000 });
            await discoverDevice(proxyBle, mockDevice);
            testClient.onCommand(BleProxyCommand.Connect, async () => ({
                connection_handle: connectionHandle,
                mtu: 247,
            }));
            testClient.onCommand(BleProxyCommand.DiscoverServices, async () => ({ services: mockDevice.services }));
            testClient.onCommand(BleProxyCommand.DiscoverCharacteristics, async () => ({
                characteristics: mockDevice.characteristics,
            }));
            testClient.onCommand(BleProxyCommand.Disconnect, async () => ({}));
            const central = proxyBle.centralInterface;
            central.onData(() => {});
            return { central, mockDevice };
        };

        const abortedOpen = (central: ProxyBleCentralInterface, peripheralAddress: string, abort: AbortController) =>
            central.openChannel({ type: "ble", peripheralAddress }, { abort: abort.signal }).then(
                () => expect.fail("open should not resolve"),
                (error: unknown) => error,
            );

        it("disconnects when the open is aborted during the BTP handshake", async () => {
            const { central, mockDevice } = await prepareOpen(8000, 14);
            testClient.onCommand(BleProxyCommand.WriteAndSubscribe, () => new Promise<void>(() => {}));
            const abort = new AbortController();

            const outcome = abortedOpen(central, mockDevice.address, abort);
            await testClient.waitForCommand("write_and_subscribe", 1000);
            abort.abort(new InternalError("aborted by test"));

            expect(await outcome).to.be.instanceOf(InternalError);
            await waitFor(() => sentDisconnects().length > 0);
            await settle();
            expect(sentDisconnects().length).to.equal(1);
        });

        it("disconnects when the open is aborted during service discovery", async () => {
            const { central, mockDevice } = await prepareOpen(8100, 15);
            testClient.onCommand(BleProxyCommand.DiscoverServices, () => new Promise<void>(() => {}));
            const abort = new AbortController();

            const outcome = abortedOpen(central, mockDevice.address, abort);
            await testClient.waitForCommand("discover_services", 1000);
            abort.abort(new InternalError("aborted by test"));

            expect(await outcome).to.be.instanceOf(InternalError);
            await waitFor(() => sentDisconnects().length > 0);
        });

        it("disconnects a peripheral the proxy connects after the open was aborted", async () => {
            const { central, mockDevice } = await prepareOpen(8200, 16);
            let finishConnect = () => {};
            testClient.onCommand(
                BleProxyCommand.Connect,
                () =>
                    new Promise(resolve => {
                        finishConnect = () => resolve({ connection_handle: 16, mtu: 247 });
                    }),
            );
            const abort = new AbortController();

            const outcome = abortedOpen(central, mockDevice.address, abort);
            await testClient.waitForCommand("connect", 1000);
            abort.abort(new InternalError("aborted by test"));
            expect(await outcome).to.be.instanceOf(InternalError);
            finishConnect();

            const disconnect = await testClient.waitForCommand("disconnect", 1000);
            expect((disconnect.args as { connection_handle: number }).connection_handle).to.equal(16);
        });

        it("reports a vanished proxy client with a typed disconnect error", async () => {
            const { central, mockDevice } = await prepareOpen(8300, 17);
            testClient.onCommand(BleProxyCommand.WriteAndSubscribe, () => new Promise<void>(() => {}));
            const connection = handler.getOwner(mockDevice.address);
            if (connection === undefined) {
                throw new InternalError("No proxy client owns the test device");
            }

            const opening = central.openChannel({ type: "ble", peripheralAddress: mockDevice.address });
            await testClient.waitForCommand("write_and_subscribe", 1000);
            testClient.close();

            await expect(opening).rejectedWith(BleDisconnectedError);
            await waitFor(() => !connection.connected);
            expect(() => connection.sendBinaryFrame(BinaryFrameOpcode.WriteData, 17, new Uint8Array(1))).to.throw(
                BleProxyClientDisconnectedError,
            );
            await expect(connection.sendCommand(BleProxyCommand.Disconnect, { connection_handle: 17 })).rejectedWith(
                BleProxyClientDisconnectedError,
            );
        });

        /** One complete BTP data packet from the peripheral; its first packet after the handshake has number 1. */
        const btpMessage = (sequenceNumber: number, message: Bytes) =>
            Bytes.of(
                BtpCodec.encodeBtpPacket({
                    header: {
                        isHandshakeRequest: false,
                        hasManagementOpcode: false,
                        hasAckNumber: false,
                        isBeginningSegment: true,
                        isContinuingSegment: false,
                        isEndingSegment: true,
                    },
                    payload: { sequenceNumber, messageLength: Bytes.of(message).length, segmentPayload: message },
                }),
            );

        // Like prepareOpen, with the handshake answered and the Matter messages the channel delivers collected.
        const prepareDelivery = async (discriminator: number, connectionHandle: number) => {
            const prepared = await prepareOpen(discriminator, connectionHandle);
            const delivered = new Array<Uint8Array>();
            prepared.central.onData((_channel, data) => delivered.push(Bytes.of(data)));
            return { ...prepared, delivered };
        };

        it("delivers data that arrives between the handshake response and the WriteAndSubscribe reply", async () => {
            const { central, mockDevice, delivered } = await prepareDelivery(8400, 18);
            testClient.onCommand(BleProxyCommand.WriteAndSubscribe, async () => {
                testClient.sendBinaryFrame(
                    BinaryFrameOpcode.Notification,
                    18,
                    mockDevice.generateBtpHandshakeResponse(),
                );
                testClient.sendBinaryFrame(BinaryFrameOpcode.Notification, 18, btpMessage(1, Bytes.fromHex("c0ffee")));
                return {};
            });

            await central.openChannel({ type: "ble", peripheralAddress: mockDevice.address });

            await waitFor(() => delivered.length === 1);
            expect(Bytes.toHex(delivered[0])).to.equal("c0ffee");
        });

        it("fails the open when a delivered message closes the channel before the open completes", async () => {
            const { central, mockDevice } = await prepareOpen(9900, 34);
            central.onData(channel => {
                channel.close().catch(() => {});
            });
            testClient.onCommand(BleProxyCommand.WriteAndSubscribe, async () => {
                testClient.sendBinaryFrame(
                    BinaryFrameOpcode.Notification,
                    34,
                    mockDevice.generateBtpHandshakeResponse(),
                );
                testClient.sendBinaryFrame(BinaryFrameOpcode.Notification, 34, btpMessage(1, Bytes.fromHex("c0ffee")));
                return {};
            });

            await expect(central.openChannel({ type: "ble", peripheralAddress: mockDevice.address })).rejectedWith(
                BleDisconnectedError,
            );
        });

        it("ignores data frames that arrive before the handshake response", async () => {
            const { central, mockDevice, delivered } = await prepareDelivery(8500, 19);
            testClient.onCommand(BleProxyCommand.WriteAndSubscribe, async () => {
                testClient.sendBinaryFrame(BinaryFrameOpcode.Notification, 19, btpMessage(1, Bytes.fromHex("0bad")));
                testClient.sendBinaryFrame(
                    BinaryFrameOpcode.Notification,
                    19,
                    mockDevice.generateBtpHandshakeResponse(),
                );
                return {};
            });

            await central.openChannel({ type: "ble", peripheralAddress: mockDevice.address });
            await settle();

            expect(delivered.length).to.equal(0);
        });

        it("ignores frames and disconnect events for another connection handle", async () => {
            const { central, mockDevice, delivered } = await prepareDelivery(8600, 20);
            testClient.onCommand(BleProxyCommand.WriteAndSubscribe, async () => {
                testClient.sendBinaryFrame(
                    BinaryFrameOpcode.Notification,
                    20,
                    mockDevice.generateBtpHandshakeResponse(),
                );
                return {};
            });
            const channel = await central.openChannel({ type: "ble", peripheralAddress: mockDevice.address });

            testClient.sendBinaryFrame(BinaryFrameOpcode.Notification, 21, btpMessage(1, Bytes.fromHex("0bad")));
            testClient.sendEvent("disconnected", { connection_handle: 21 });
            testClient.sendBinaryFrame(BinaryFrameOpcode.Notification, 20, btpMessage(1, Bytes.fromHex("600d")));

            await waitFor(() => delivered.length === 1);
            expect(Bytes.toHex(delivered[0])).to.equal("600d");
            expect(channel.connected).to.be.true;
        });

        it("still disconnects when a close listener throws", async () => {
            const channel = await openConnectedChannel(9300, 28);
            channel.onClose(() => {
                throw new InternalError("listener failure");
            });

            await channel.close();

            expect(channel.isClosed).to.be.true;
            await waitFor(() => sentDisconnects().length === 1);
        });

        it("ends the message iterator when the channel closes", async () => {
            const channel = await openConnectedChannel(8700, 22);
            const iterator = channel[Symbol.asyncIterator]();
            const next = iterator.next();

            await channel.close();

            expect((await next).done).to.be.true;
        });

        it("reports a lost peripheral when a command fails after the proxy reported the loss", async () => {
            const { central, mockDevice } = await prepareOpen(8800, 23);
            testClient.onCommand(BleProxyCommand.WriteAndSubscribe, async () => {
                testClient.sendBinaryFrame(
                    BinaryFrameOpcode.Notification,
                    23,
                    mockDevice.generateBtpHandshakeResponse(),
                );
                testClient.sendEvent("disconnected", { connection_handle: 23 });
                await settle();
                throw new InternalError("subscribe failed");
            });

            const error = await central.openChannel({ type: "ble", peripheralAddress: mockDevice.address }).then(
                () => expect.fail("open should not resolve"),
                (error: unknown) => error,
            );

            expect(error).to.be.instanceOf(BleDisconnectedError);
            expect(error).to.have.property("cause").that.is.instanceOf(Error);
        });

        it("reports a not_connected reply during discovery as a lost peripheral", async () => {
            const { central, mockDevice } = await prepareOpen(8900, 24);
            testClient.onCommandError(BleProxyCommand.DiscoverServices, BleProxyErrorCode.NotConnected, "gone");

            await expect(central.openChannel({ type: "ble", peripheralAddress: mockDevice.address })).rejectedWith(
                BleDisconnectedError,
            );
        });

        it("does not connect when the open was aborted before it started", async () => {
            const { central, mockDevice } = await prepareOpen(9000, 25);
            const abort = new AbortController();
            abort.abort(new InternalError("aborted by test"));

            const outcome = await abortedOpen(central, mockDevice.address, abort);

            expect(outcome).to.be.instanceOf(InternalError);
            await settle();
            expect(testClient.receivedCommands.map(c => c.command)).to.not.include("connect");
        });

        it("closes its open channels when the central interface closes", async () => {
            const { central, mockDevice } = await prepareOpen(9100, 26);
            testClient.onCommand(BleProxyCommand.WriteAndSubscribe, async () => {
                testClient.sendBinaryFrame(
                    BinaryFrameOpcode.Notification,
                    26,
                    mockDevice.generateBtpHandshakeResponse(),
                );
                return {};
            });
            const channel = await central.openChannel({ type: "ble", peripheralAddress: mockDevice.address });

            await central.close();

            expect(channel.isClosed).to.be.true;
            await waitFor(() => sentDisconnects().length === 1);
        });

        it("stops a retry the channel was closed during when the unsubscribe answers late", async () => {
            let answerUnsubscribe = () => {};
            testClient.onCommand(
                BleProxyCommand.UnsubscribeCharacteristic,
                () =>
                    new Promise<void>(resolve => {
                        answerUnsubscribe = resolve;
                    }),
            );
            const open = await prepareStallingChannel(9200, 27);
            MockTime.enable();
            try {
                const channel = await open();
                await channel.send(new Uint8Array(100).fill(0xab));
                await MockTime.advance(Seconds(16));
                await testClient.waitForCommand("unsubscribe_characteristic", 1000);

                await channel.close();
                answerUnsubscribe();
                await settle();

                expect(handshakeRequests().length).to.equal(1);
            } finally {
                MockTime.disable();
            }
        });

        it("fails the open right away when the proxy loses the peripheral during the handshake", async () => {
            const proxyBle = new ProxyBle(handler);
            const mockDevice = new MockBleDevice({ discriminator: 7900, vendorId: 0xfff1, productId: 0x8000 });
            await discoverDevice(proxyBle, mockDevice);
            testClient.onCommand(BleProxyCommand.Connect, async () => ({ connection_handle: 12, mtu: 247 }));
            testClient.onCommand(BleProxyCommand.DiscoverServices, async () => ({ services: mockDevice.services }));
            testClient.onCommand(BleProxyCommand.DiscoverCharacteristics, async () => ({
                characteristics: mockDevice.characteristics,
            }));
            testClient.onCommand(BleProxyCommand.WriteAndSubscribe, () => {
                testClient.sendEvent("disconnected", { connection_handle: 12 });
                return new Promise<void>(() => {});
            });
            testClient.onCommand(BleProxyCommand.Disconnect, async () => ({}));
            const central = proxyBle.centralInterface;
            central.onData(() => {});

            await expect(central.openChannel({ type: "ble", peripheralAddress: mockDevice.address })).rejectedWith(
                BleDisconnectedError,
            );
        });

        it("does not send a disconnect after the proxy reported the peripheral as disconnected", async () => {
            const channel = await openConnectedChannel(7200, 5);

            testClient.sendEvent("disconnected", { connection_handle: 5 });
            await waitFor(() => !channel.connected);

            await channel.close();
            await settle();

            expect(sentDisconnects().length).to.equal(0);
        });

        /** Answers WriteAndSubscribe with the handshake response at once, but replies only when the test says so. */
        const holdWriteAndSubscribeReply = (connectionHandle: number) => {
            const reply = { send: () => {} };
            testClient.onCommand(BleProxyCommand.WriteAndSubscribe, () => {
                testClient.sendBinaryFrame(
                    BinaryFrameOpcode.Notification,
                    connectionHandle,
                    new MockBleDevice({
                        discriminator: 1,
                        vendorId: 0xfff1,
                        productId: 0x8000,
                    }).generateBtpHandshakeResponse(),
                );
                return new Promise<void>(resolve => {
                    reply.send = resolve;
                });
            });
            return reply;
        };

        it("leaves no BTP session running when the open is aborted before the WriteAndSubscribe reply", async () => {
            const { central, mockDevice } = await prepareOpen(9400, 29);
            const reply = holdWriteAndSubscribeReply(29);
            const abort = new AbortController();
            MockTime.enable();
            try {
                const outcome = abortedOpen(central, mockDevice.address, abort);
                await testClient.waitForCommand("write_and_subscribe", 1000);
                await settle();
                abort.abort(new InternalError("aborted by test"));
                expect(await outcome).to.be.instanceOf(InternalError);

                reply.send();
                await settle();
                await MockTime.advance(Seconds(16));
                await settle();

                expect(testClient.receivedBinaryFrames.length).to.equal(0);
                expect(sentDisconnects().length).to.equal(1);
            } finally {
                MockTime.disable();
            }
        });

        it("stays closed when it closes between the retry handshake response and the WriteAndSubscribe reply", async () => {
            testClient.onCommand(BleProxyCommand.UnsubscribeCharacteristic, async () => ({}));
            const open = await prepareStallingChannel(9500, 30);
            MockTime.enable();
            try {
                const channel = await open();
                const reply = holdWriteAndSubscribeReply(30);
                let closeNotifications = 0;
                channel.onClose(() => closeNotifications++);
                await channel.send(new Uint8Array(10).fill(0xab));
                await MockTime.advance(Seconds(16));
                await waitFor(() => handshakeRequests().length === 2);
                await settle();
                const framesAtClose = testClient.receivedBinaryFrames.length;

                await channel.close();
                reply.send();
                await settle();
                await MockTime.advance(Seconds(16));
                await settle();

                expect(channel.connected).to.be.false;
                expect(closeNotifications).to.equal(1);
                expect(testClient.receivedBinaryFrames.length).to.equal(framesAtClose);
                expect(sentDisconnects().length).to.equal(1);
            } finally {
                MockTime.disable();
            }
        });

        it("closes the channel once when the retried BTP session gets no acknowledgement", async () => {
            testClient.onCommand(BleProxyCommand.UnsubscribeCharacteristic, async () => ({}));
            const open = await prepareStallingChannel(9600, 31);
            MockTime.enable();
            try {
                const channel = await open();
                let closeNotifications = 0;
                channel.onClose(() => closeNotifications++);
                await channel.send(new Uint8Array(10).fill(0xab));
                await MockTime.advance(Seconds(16));
                await waitFor(() => handshakeRequests().length === 2);
                await settle();

                await MockTime.advance(Seconds(16));
                await waitFor(() => channel.isClosed);
                await settle();

                expect(closeNotifications).to.equal(1);
                expect(channel.connected).to.be.false;
                await expect(channel.send(Bytes.fromHex("0102"))).rejectedWith(BleDisconnectedError);
                expect(sentDisconnects().length).to.equal(1);
            } finally {
                MockTime.disable();
            }
        });

        it("writes nothing after the channel closed", async () => {
            const open = await prepareStallingChannel(9800, 33);
            MockTime.enable();
            try {
                const channel = await open();

                await channel.close();
                await MockTime.advance(Seconds(16));
                await settle();

                expect(testClient.receivedBinaryFrames.length).to.equal(0);
            } finally {
                MockTime.disable();
            }
        });

        it("fails the open right away when the peripheral is lost before the WriteAndSubscribe reply", async () => {
            const { central, mockDevice } = await prepareOpen(9950, 35);
            holdWriteAndSubscribeReply(35);
            const opening = central.openChannel({ type: "ble", peripheralAddress: mockDevice.address });
            await testClient.waitForCommand("write_and_subscribe", 1000);
            await settle();

            testClient.sendEvent("disconnected", { connection_handle: 35 });

            await expect(opening).rejectedWith(BleDisconnectedError);
        });

        it("closes every channel of a lost proxy client when a closed observer throws", async () => {
            const first = await openConnectedChannel(9960, 36);
            const second = await openConnectedChannel(9970, 37);
            first.closed.once(() => {
                throw new InternalError("observer failure");
            });
            second.closed.once(() => {
                throw new InternalError("observer failure");
            });

            testClient.close();

            await waitFor(() => first.isClosed && second.isClosed);
        });

        it("reports a not_connected reply to the handshake as a lost peripheral", async () => {
            const { central, mockDevice } = await prepareOpen(9990, 39);
            testClient.onCommandError(BleProxyCommand.WriteAndSubscribe, BleProxyErrorCode.NotConnected, "gone");

            await expect(central.openChannel({ type: "ble", peripheralAddress: mockDevice.address })).rejectedWith(
                BleDisconnectedError,
            );
        });

        it("drops frames of the stalled session that arrive before the retry handshake", async () => {
            const delivered = new Array<Uint8Array>();
            testClient.onCommand(BleProxyCommand.UnsubscribeCharacteristic, async () => {
                testClient.sendBinaryFrame(BinaryFrameOpcode.Notification, 38, btpMessage(1, Bytes.fromHex("5a1e")));
                return {};
            });
            const open = await prepareStallingChannel(9980, 38, data => delivered.push(Bytes.of(data)));
            MockTime.enable();
            try {
                const channel = await open();
                await channel.send(new Uint8Array(10).fill(0xab));
                await MockTime.advance(Seconds(16));
                await waitFor(() => handshakeRequests().length === 2);
                await settle();

                expect(delivered.length).to.equal(0);
                expect(channel.isClosed).to.be.false;
            } finally {
                MockTime.disable();
            }
        });

        it("stops observing the proxy connection once closed", async () => {
            const { central, mockDevice } = await prepareOpen(9995, 40);
            testClient.onCommand(BleProxyCommand.WriteAndSubscribe, async () => {
                testClient.sendBinaryFrame(
                    BinaryFrameOpcode.Notification,
                    40,
                    mockDevice.generateBtpHandshakeResponse(),
                );
                return {};
            });
            const channel = await central.openChannel({ type: "ble", peripheralAddress: mockDevice.address });
            const connection = handler.getOwner(mockDevice.address);
            if (connection === undefined) {
                throw new InternalError("No proxy client owns the test device");
            }
            expect(connection.binaryFrameReceived.isObserved).to.be.true;

            await channel.close();

            expect(connection.binaryFrameReceived.isObserved).to.be.false;
        });

        it("aborts an open in progress when the central interface closes", async () => {
            const { central, mockDevice } = await prepareOpen(9700, 32);
            testClient.onCommand(BleProxyCommand.WriteAndSubscribe, () => new Promise<void>(() => {}));
            const opening = central.openChannel({ type: "ble", peripheralAddress: mockDevice.address }).then(
                () => expect.fail("open should not resolve"),
                (error: unknown) => error,
            );
            await testClient.waitForCommand("write_and_subscribe", 1000);

            await central.close();

            expect(await opening).to.be.instanceOf(NetworkError);
            await waitFor(() => sentDisconnects().length === 1);
        });
    });
});
