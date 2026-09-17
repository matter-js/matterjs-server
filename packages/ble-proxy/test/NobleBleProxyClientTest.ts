/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { BLE_PROXY_PROTOCOL_VERSION, BleProxyCommand } from "../src/BleProxyProtocol.js";
import { type NobleApi, NobleBleProxyClient } from "../src/example/NobleBleProxyClient.js";

const TEST_PORT = 15583;
const TEST_BLE_URL = `ws://localhost:${TEST_PORT}/ble`;
const SCAN_TIMEOUT_MS = 100;

interface ScanCall {
    op: "start" | "stop";
    serviceUuids?: string[];
    allowDuplicates?: boolean;
}

/**
 * Settles its scan calls a macrotask late, so a client that does not serialize them has both in
 * flight at once — which is what noble's `onceExclusive` turns into an unsettled promise.
 */
class ScanRecordingNoble implements NobleApi {
    readonly calls = new Array<ScanCall>();
    readonly overlaps = new Array<string>();
    scanning = false;
    hangOn?: "start" | "stop";
    #inFlight?: string;

    async startScanningAsync(serviceUuids: string[], allowDuplicates: boolean): Promise<void> {
        await this.#record({ op: "start", serviceUuids, allowDuplicates });
        this.scanning = true;
    }

    async stopScanningAsync(): Promise<void> {
        await this.#record({ op: "stop" });
        this.scanning = false;
    }

    stop(): void {}

    on(): unknown {
        return this;
    }

    removeAllListeners(): unknown {
        return this;
    }

    async #record(call: ScanCall): Promise<void> {
        this.calls.push(call);
        if (this.#inFlight !== undefined) {
            this.overlaps.push(`${this.#inFlight}+${call.op}`);
        }
        this.#inFlight = call.op;
        if (this.hangOn === call.op) {
            return new Promise<never>(() => {});
        }
        await new Promise(resolve => setTimeout(resolve, 0));
        this.#inFlight = undefined;
    }
}

async function waitFor(condition: () => boolean, timeoutMs = 1_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!condition()) {
        if (Date.now() > deadline) {
            throw new Error("Timed out waiting for condition");
        }
        await new Promise(resolve => setTimeout(resolve, 5));
    }
}

describe("NobleBleProxyClient", () => {
    describe("protocol coverage", () => {
        it("implements every protocol command", () => {
            const client = new NobleBleProxyClient(TEST_BLE_URL);
            const implemented = new Set(client.supportedCommands);
            const missing = Object.values(BleProxyCommand).filter(command => !implemented.has(command));

            expect(missing).to.deep.equal([]);
        });
    });

    describe("scan control", () => {
        let httpServer: ReturnType<typeof createServer>;
        let wss: WebSocketServer;
        let client: NobleBleProxyClient;
        let noble: ScanRecordingNoble;
        let responses: Array<Record<string, unknown>>;
        let sendCommand: (id: number, command: string, args?: Record<string, unknown>) => void;

        const startScan = (id: number, serviceUuids: string[], allowDuplicates = false) =>
            sendCommand(id, BleProxyCommand.StartScan, {
                service_uuids: serviceUuids,
                allow_duplicates: allowDuplicates,
            });

        const responseFor = (id: number) => responses.find(response => response.id === id);

        beforeEach(async () => {
            httpServer = createServer();
            wss = new WebSocketServer({ server: httpServer });
            responses = [];

            const commandSender = new Promise<(payload: unknown) => void>(resolve => {
                wss.on("connection", ws => {
                    ws.on("message", (data, isBinary) => {
                        if (isBinary) {
                            return;
                        }
                        const message = JSON.parse(data.toString());
                        if (message.type === "hello") {
                            ws.send(JSON.stringify({ type: "hello_response", version: BLE_PROXY_PROTOCOL_VERSION }));
                            resolve(payload => ws.send(JSON.stringify(payload)));
                            return;
                        }
                        responses.push(message);
                    });
                });
            });

            await new Promise<void>((resolve, reject) => {
                httpServer.listen(TEST_PORT, () => resolve());
                httpServer.on("error", reject);
            });

            noble = new ScanRecordingNoble();
            client = new NobleBleProxyClient(TEST_BLE_URL, undefined, {
                noble,
                scanOperationTimeoutMs: SCAN_TIMEOUT_MS,
            });
            await client.connect();

            const send = await commandSender;
            sendCommand = (id, command, args = {}) => send({ id, command, args });
        });

        afterEach(async () => {
            client.close();
            await new Promise<void>(resolve => wss.close(() => resolve()));
            await new Promise<void>((resolve, reject) => httpServer.close(err => (err ? reject(err) : resolve())));
        });

        it("passes start_scan's service_uuids through to noble", async () => {
            startScan(1, ["fff6", "abcd"]);

            await waitFor(() => responses.length === 1);

            expect(noble.calls).to.deep.equal([
                { op: "stop" },
                { op: "start", serviceUuids: ["fff6", "abcd"], allowDuplicates: true },
            ]);
            expect(responseFor(1)?.success).to.equal(true);
        });

        it("answers overlapping start_scan and stop_scan without overlapping noble calls", async () => {
            startScan(1, ["fff6"]);
            sendCommand(2, BleProxyCommand.StopScan);

            await waitFor(() => responses.length === 2);

            expect(noble.overlaps).to.deep.equal([]);
            expect(responseFor(1)?.success).to.equal(true);
            expect(responseFor(2)?.success).to.equal(true);
            expect(noble.scanning).to.equal(false);
        });

        it("leaves the scan running when stop_scan is followed by a start_scan", async () => {
            sendCommand(1, BleProxyCommand.StopScan);
            startScan(2, ["fff6"]);

            await waitFor(() => responses.length === 2);

            expect(noble.overlaps).to.deep.equal([]);
            expect(noble.scanning).to.equal(true);
            expect(noble.calls[noble.calls.length - 1]).to.deep.equal({
                op: "start",
                serviceUuids: ["fff6"],
                allowDuplicates: true,
            });
        });

        it("collapses requests that queue behind one another into a single noble cycle", async () => {
            startScan(1, ["fff6"]);
            startScan(2, ["abcd"]);
            sendCommand(3, BleProxyCommand.StopScan);

            await waitFor(() => responses.length === 3);

            expect(noble.calls).to.deep.equal([{ op: "stop" }]);
            expect(noble.scanning).to.equal(false);
            expect(responses.every(response => response.success === true)).to.equal(true);
        });

        it("answers a start_scan whose noble call never settles, and keeps serving commands", async () => {
            noble.hangOn = "start";
            startScan(1, ["fff6"]);

            await waitFor(() => responses.length === 1, 2_000);

            expect(responseFor(1)?.success).to.equal(false);
            expect(responseFor(1)?.error).to.equal("internal_error");

            noble.hangOn = undefined;
            sendCommand(2, BleProxyCommand.StopScan);

            await waitFor(() => responses.length === 2, 2_000);
            expect(responseFor(2)?.success).to.equal(true);
        });
    });
});
