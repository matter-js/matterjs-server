/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { BLE_PROXY_PROTOCOL_VERSION, BleProxyCommand } from "../src/BleProxyProtocol.js";
import {
    type Characteristic,
    type NobleApi,
    NobleBleProxyClient,
    type NotificationListener,
    type Peripheral,
    type Service,
} from "../src/example/NobleBleProxyClient.js";

const TEST_PORT = 15583;
const TEST_BLE_URL = `ws://localhost:${TEST_PORT}/ble`;
const SCAN_TIMEOUT_MS = 100;
const C1_UUID = "18ee2ef5263d4559959f4f9c429f9d11";
const C2_UUID = "18ee2ef5263d4559959f4f9c429f9d12";

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

    #discoverListeners = new Array<(peripheral: Peripheral) => void>();

    on(event: "warning" | "stateChange" | "discover", listener: unknown): unknown {
        if (event === "discover") {
            this.#discoverListeners.push(listener as (peripheral: Peripheral) => void);
        }
        return this;
    }

    removeAllListeners(): unknown {
        this.#discoverListeners.length = 0;
        return this;
    }

    emitDiscover(peripheral: Peripheral): void {
        for (const listener of this.#discoverListeners) {
            listener(peripheral);
        }
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

// Compile-time proof that the structural types the client uses still describe the real noble
// objects: noble's catch-all `on(event, listener)` accepts any listener, so nothing else checks it.
type Assignable<From, To> = From extends To
    ? true
    : { error: "noble type no longer satisfies the client's"; from: From };

class FakeCharacteristic implements Characteristic {
    readonly properties = ["read", "write", "notify"];
    readonly listeners = new Array<NotificationListener>();

    constructor(
        readonly uuid: string,
        private readonly log: string[],
    ) {}

    async readAsync(): Promise<Buffer> {
        this.log.push(`read:${this.uuid}`);
        return Buffer.from([0x01]);
    }

    async writeAsync(data: Buffer, withoutResponse: boolean): Promise<void> {
        this.log.push(`write:${this.uuid}:${data.toString("hex")}:withoutResponse=${withoutResponse}`);
        await new Promise(resolve => setTimeout(resolve, 0));
        this.log.push(`write-done:${this.uuid}`);
    }

    async subscribeAsync(): Promise<void> {
        this.log.push(`subscribe:${this.uuid}`);
    }

    async unsubscribeAsync(): Promise<void> {
        this.log.push(`unsubscribe:${this.uuid}`);
    }

    on(_event: "data", listener: NotificationListener): unknown {
        this.listeners.push(listener);
        this.log.push(`listen:${this.uuid}`);
        return this;
    }

    removeListener(_event: "data", listener: NotificationListener): unknown {
        const index = this.listeners.indexOf(listener);
        if (index >= 0) {
            this.listeners.splice(index, 1);
        }
        return this;
    }
}

class FakeService implements Service {
    readonly characteristics: FakeCharacteristic[];

    constructor(
        readonly uuid: string,
        log: string[],
    ) {
        this.characteristics = [new FakeCharacteristic(C1_UUID, log), new FakeCharacteristic(C2_UUID, log)];
    }

    async discoverCharacteristicsAsync(): Promise<Characteristic[]> {
        return this.characteristics;
    }
}

class FakePeripheral implements Peripheral {
    readonly id: string;
    readonly rssi = -50;
    readonly mtu = 247;
    readonly connectable = true;
    readonly advertisement = { localName: "fake", serviceUuids: ["fff6"], serviceData: [] };
    readonly service: FakeService;
    state = "disconnected";
    #disconnectListeners = new Array<() => void>();

    constructor(
        readonly address: string,
        readonly log: string[],
        private readonly interviewGate?: () => Promise<void>,
    ) {
        this.id = address;
        this.service = new FakeService("fff6", log);
    }

    async connectAsync(): Promise<void> {
        this.log.push(`connect:${this.address}`);
        this.state = "connected";
    }

    async disconnectAsync(): Promise<void> {
        this.state = "disconnected";
    }

    async discoverServicesAsync(): Promise<Service[]> {
        this.log.push(`discover-services:${this.address}`);
        await this.interviewGate?.();
        this.log.push(`interview-done:${this.address}`);
        return [this.service];
    }

    once(_event: "disconnect", listener: () => void): unknown {
        this.#disconnectListeners.push(listener);
        return this;
    }

    removeListener(_event: "disconnect", listener: () => void): unknown {
        const index = this.#disconnectListeners.indexOf(listener);
        if (index >= 0) {
            this.#disconnectListeners.splice(index, 1);
        }
        return this;
    }
}

function connectionHandleOf(response: Record<string, unknown> | undefined): number {
    const result: unknown = response?.result;
    if (typeof result === "object" && result !== null && "connection_handle" in result) {
        const handle: unknown = Reflect.get(result, "connection_handle");
        if (typeof handle === "number") {
            return handle;
        }
    }
    throw new Error("connect did not answer with a connection handle");
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
    describe("noble type compatibility", () => {
        it("keeps noble's own GATT types assignable to the client's structural ones", () => {
            // The assertion is the compilation: each element is `true` only while noble's type
            // still satisfies the client's. noble's catch-all `on()` checks none of this.
            const satisfied: [
                Assignable<import("@stoprocent/noble").Peripheral, Peripheral>,
                Assignable<import("@stoprocent/noble").Service, Service>,
                Assignable<import("@stoprocent/noble").Characteristic, Characteristic>,
            ] = [true, true, true];

            expect(satisfied).to.deep.equal([true, true, true]);
        });
    });

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
        let events: Array<Record<string, unknown>>;
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
            events = [];

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
                        if (typeof message.id === "number") {
                            responses.push(message);
                        } else {
                            events.push(message);
                        }
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

        it("writes and waits for the response before enabling the CCCD", async () => {
            const log = new Array<string>();
            const peripheral = new FakePeripheral("aa:bb:cc:dd:ee:ff", log);
            startScan(1, ["fff6"]);
            await waitFor(() => responseFor(1) !== undefined);
            noble.emitDiscover(peripheral);
            await waitFor(() => events.length === 1);

            sendCommand(2, BleProxyCommand.Connect, { address: "aa:bb:cc:dd:ee:ff" });
            await waitFor(() => responseFor(2) !== undefined);
            const handle = connectionHandleOf(responseFor(2));

            sendCommand(3, BleProxyCommand.WriteAndSubscribe, {
                connection_handle: handle,
                write_uuid: C1_UUID,
                write_value: Buffer.from([0x65, 0x6c]).toString("base64"),
                write_response: true,
                subscribe_uuid: C2_UUID,
            });
            await waitFor(() => responseFor(3) !== undefined);

            expect(responseFor(3)?.success).to.equal(true);
            const gatt = log.filter(entry => entry.startsWith("write") || entry.startsWith("subscribe"));
            expect(gatt).to.deep.equal([
                `write:${C1_UUID}:656c:withoutResponse=false`,
                `write-done:${C1_UUID}`,
                `subscribe:${C2_UUID}`,
            ]);
            expect(log.indexOf(`listen:${C2_UUID}`)).to.be.lessThan(log.indexOf(`subscribe:${C2_UUID}`));
        });

        it("keeps the scan paused while a second connect is still interviewing", async () => {
            const log = new Array<string>();
            let releaseSecondInterview = () => {};
            const secondInterview = new Promise<void>(resolve => {
                releaseSecondInterview = resolve;
            });
            const first = new FakePeripheral("aa:aa:aa:aa:aa:aa", log);
            const second = new FakePeripheral("bb:bb:bb:bb:bb:bb", log, () => secondInterview);

            startScan(1, ["fff6"]);
            await waitFor(() => responseFor(1) !== undefined);
            noble.emitDiscover(first);
            noble.emitDiscover(second);
            await waitFor(() => events.length === 2);

            sendCommand(2, BleProxyCommand.Connect, { address: "bb:bb:bb:bb:bb:bb" });
            sendCommand(3, BleProxyCommand.Connect, { address: "aa:aa:aa:aa:aa:aa" });

            // The first connect finishes while the second is still inside discoverServicesAsync.
            // Its pause release runs after the response is sent, so settle before asserting.
            await waitFor(() => responseFor(3) !== undefined);
            await new Promise(resolve => setTimeout(resolve, 30));
            expect(noble.scanning).to.equal(false);

            releaseSecondInterview();
            await waitFor(() => responseFor(2) !== undefined);
            await waitFor(() => noble.scanning === true);
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
