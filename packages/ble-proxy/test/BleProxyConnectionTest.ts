/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Seconds } from "@matter/main";
import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { BleProxyConnection } from "../src/BleProxyConnection.js";
import { BLE_PROXY_PROTOCOL_VERSION, BinaryFrameOpcode, BleProxyCommand } from "../src/BleProxyProtocol.js";
import { BleProxyTestClient } from "./BleProxyTestClient.js";

const TEST_PORT = 15581;
const TEST_BLE_URL = `ws://localhost:${TEST_PORT}/ble`;

describe("BleProxyConnection", function () {
    this.timeout(10_000);

    let wss: WebSocketServer;
    let httpServer: ReturnType<typeof createServer>;
    let testClient: BleProxyTestClient;
    let connection: BleProxyConnection;

    beforeEach(async () => {
        httpServer = createServer();
        wss = new WebSocketServer({ server: httpServer });

        const ready = new Promise<void>(resolve => {
            wss.on("connection", ws => {
                connection = new BleProxyConnection(ws);
                connection.handshakeCompleted.on(() => resolve());
            });
        });

        await new Promise<void>((resolve, reject) => {
            httpServer.listen(TEST_PORT, () => resolve());
            httpServer.on("error", reject);
        });

        testClient = new BleProxyTestClient();
        await testClient.connect(TEST_BLE_URL);
        await ready;
    });

    afterEach(async () => {
        testClient.close();
        await new Promise<void>(resolve => wss.close(() => resolve()));
        await new Promise<void>((resolve, reject) => {
            httpServer.close(err => (err ? reject(err) : resolve()));
        });
    });

    it("reports connected after handshake", () => {
        expect(connection.connected).to.be.true;
    });

    it("exposes a non-empty connection id", () => {
        expect(connection.id).to.be.a("string").and.not.empty;
    });

    it("sends a command and resolves with the typed result", async () => {
        testClient.onCommand(BleProxyCommand.Connect, async () => ({ connection_handle: 1, mtu: 247 }));

        const result = await connection.sendCommand(BleProxyCommand.Connect, { address: "AA:BB:CC:DD:EE:FF" });

        expect(result.connection_handle).to.equal(1);
        expect(result.mtu).to.equal(247);
    });

    it("rejects when the client returns an error response", async () => {
        testClient.onCommand(BleProxyCommand.Connect, async () => {
            throw new Error("Device not found");
        });

        try {
            await connection.sendCommand(BleProxyCommand.Connect, { address: "XX" });
            expect.fail("Should have thrown");
        } catch (err) {
            expect((err as Error).message).to.include("Device not found");
        }
    });

    it("emits eventReceived for JSON events from the client", async () => {
        const received = new Promise<{ event: string; data: Record<string, unknown> }>(resolve => {
            connection.eventReceived.on((event, data) => resolve({ event, data }));
        });

        testClient.sendEvent("scan_stopped", { reason: "test" });

        const got = await received;
        expect(got.event).to.equal("scan_stopped");
        expect(got.data.reason).to.equal("test");
    });

    it("emits binaryFrameReceived for binary frames from the client", async () => {
        const received = new Promise<{ opcode: number; connectionHandle: number; payload: Uint8Array }>(resolve => {
            connection.binaryFrameReceived.on(frame => resolve(frame));
        });

        testClient.sendBinaryFrame(BinaryFrameOpcode.Notification, 5, new Uint8Array([1, 2, 3]));

        const got = await received;
        expect(got.opcode).to.equal(BinaryFrameOpcode.Notification);
        expect(got.connectionHandle).to.equal(5);
        expect(Array.from(got.payload)).to.deep.equal([1, 2, 3]);
    });

    it("stays torn down when a hello arrives after the handshake timeout fired", async () => {
        const latePort = TEST_PORT + 1;
        const lateHttpServer = createServer();
        const lateWss = new WebSocketServer({ server: lateHttpServer });

        let lateConnection: BleProxyConnection | undefined;
        let handshakes = 0;
        const accepted = new Promise<void>(resolve => {
            lateWss.on("connection", ws => {
                lateConnection = new BleProxyConnection(ws);
                lateConnection.handshakeCompleted.on(() => {
                    handshakes++;
                });
                resolve();
            });
        });

        await new Promise<void>((resolve, reject) => {
            lateHttpServer.listen(latePort, () => resolve());
            lateHttpServer.on("error", reject);
        });

        // The handshake timer is created when the connection is accepted, so the mocked clock has
        // to be in place before that happens.
        MockTime.enable();
        const lateClient = new WebSocket(`ws://localhost:${latePort}/ble`);
        try {
            await new Promise<void>(resolve => lateClient.on("open", () => resolve()));
            await accepted;
            // The client reads nothing, so the server's close frame cannot end the socket and the
            // late hello still reaches a connection the server already tore down.
            lateClient.pause();

            await MockTime.advance(Seconds(11));

            lateClient.send(JSON.stringify({ type: "hello", version: BLE_PROXY_PROTOCOL_VERSION }));
            await new Promise<void>(resolve => setTimeout(resolve, 50));

            expect(handshakes).to.equal(0);
            expect(lateConnection?.connected).to.be.false;
        } finally {
            MockTime.disable();
            lateClient.terminate();
            await new Promise<void>(resolve => lateWss.close(() => resolve()));
            await new Promise<void>((resolve, reject) => {
                lateHttpServer.close(err => (err ? reject(err) : resolve()));
            });
        }
    });

    it("emits closed and rejects pending commands when the socket closes", async () => {
        // Never respond, so the command stays pending until the socket drops.
        testClient.onCommand(BleProxyCommand.StopScan, async () => new Promise(() => {}));

        const closedEmitted = new Promise<void>(resolve => connection.closed.on(() => resolve()));
        const pending = connection.sendCommand(BleProxyCommand.StopScan);

        testClient.close();

        await closedEmitted;
        try {
            await pending;
            expect.fail("Should have rejected");
        } catch (err) {
            expect((err as Error).message).to.include("disconnected");
        }
    });
});
