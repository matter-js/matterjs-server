/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { BleProxyConnection } from "../src/BleProxyConnection.js";
import { BinaryFrameOpcode, BleProxyCommand } from "../src/BleProxyProtocol.js";
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
