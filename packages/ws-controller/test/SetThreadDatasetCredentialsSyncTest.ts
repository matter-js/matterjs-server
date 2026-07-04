/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { AsyncObservable, Environment, MockStorageService, Observable } from "@matter/general";
import { Bytes } from "@matter/main";
import { ThreadCredentialsRegistry } from "@matter/thread-br-client";
import { createServer } from "node:http";
import WebSocket from "ws";
import { ConfigStorage } from "../src/server/ConfigStorage.js";
import { WebSocketControllerHandler } from "../src/server/WebSocketControllerHandler.js";

// extPanId = 11:22:33:44:55:66:77:88, network = "OpenThread" — mirrors synthetic-1 fixture.
const DATASET_A =
    "00010f02081122334455667788030a4f70656e5468726561640410000102030405060708090a0b0c0d0e0f0e080000000000010000";

// extPanId = DE:AD:BE:EF:CA:FE:BA:BE, network = "TestNet" — distinct extPanId for multi-entry tests.
const DATASET_B = buildDataset("DEADBEEFCAFEBABE", "TestNet");

function buildDataset(extPanIdHex: string, networkName: string): string {
    const bytes = new Array<number>();
    // CHANNEL TLV
    bytes.push(0x00, 0x01, 0x0f);
    // EXTPANID TLV
    const xp = Array.from(Bytes.of(Bytes.fromHex(extPanIdHex)));
    bytes.push(0x02, 0x08, ...xp);
    // NETWORK_NAME TLV
    const name = Array.from(new TextEncoder().encode(networkName));
    bytes.push(0x03, name.length, ...name);
    // PSKC TLV (16 bytes; arbitrary)
    bytes.push(0x04, 0x10);
    for (let i = 0; i < 16; i++) bytes.push(i);
    // ACTIVE_TIMESTAMP TLV
    bytes.push(0x0e, 0x08, 0, 0, 0, 0, 0, 1, 0, 0);
    return Bytes.toHex(new Uint8Array(bytes));
}

function freshEnv(): Environment {
    const env = new Environment("test");
    new MockStorageService(env);
    return env;
}

function makeStubController(credentials: ThreadCredentialsRegistry) {
    const stubEvents = {
        started: new AsyncObservable(),
        attributeChanged: new Observable(),
        eventChanged: new Observable(),
        nodeAdded: new Observable(),
        nodeStateChanged: new Observable(),
        nodeAvailabilityChanged: new Observable(),
        nodeStructureChanged: new Observable(),
        nodeDecommissioned: new Observable(),
        nodeEndpointAdded: new Observable(),
        nodeEndpointRemoved: new Observable(),
        webRtcCallback: new Observable(),
    };

    const stubCommandHandler = {
        events: stubEvents,
        bleEnabled: false,
        bleProxyEnabled: false,
        async start() {},
        async getCommissionerFabricData() {
            return { fabricId: 1n, compressedFabricId: 2n, fabricIndex: 1 };
        },
        getCommissionerNodeId() {
            return 0n;
        },
        getNodeIds() {
            return [];
        },
        async initializeNodes() {},
    };

    const stubDiagnostics = {
        events: { batchUpdated: new Observable() },
    };

    const stubBorderRouters = {
        list() {
            return [];
        },
    };

    return {
        get commandHandler() {
            return stubCommandHandler as unknown as InstanceType<
                typeof import("../src/controller/ControllerCommandHandler.js").ControllerCommandHandler
            >;
        },
        get credentials() {
            return credentials;
        },
        get threadDiagnosticsEnabled() {
            return true;
        },
        get threadDiagnostics() {
            return stubDiagnostics as unknown as InstanceType<
                typeof import("../src/controller/ThreadDiagnosticsService.js").ThreadDiagnosticsService
            >;
        },
        get borderRouters() {
            return stubBorderRouters as unknown as InstanceType<
                typeof import("@matter/thread-br-client").BorderRouterRegistry
            >;
        },
    };
}

interface TestHarness {
    handle<T = unknown>(command: string, args: unknown): Promise<T>;
    config: ConfigStorage;
    credentials: ThreadCredentialsRegistry;
    close(): Promise<void>;
}

async function createHarness(): Promise<TestHarness> {
    const config = await ConfigStorage.create(freshEnv());
    const credentials = new ThreadCredentialsRegistry();
    const controller = makeStubController(credentials);

    const handler = new WebSocketControllerHandler(
        controller as unknown as InstanceType<typeof import("../src/controller/MatterController.js").MatterController>,
        config,
        "0.0.0-test",
    );

    const httpServer = createServer();
    await handler.register({
        on: httpServer.on.bind(httpServer),
        removeListener: httpServer.removeListener.bind(httpServer),
    } as unknown as Parameters<typeof handler.register>[0]);

    await new Promise<void>(resolve => httpServer.listen(0, "127.0.0.1", resolve));
    const { port } = httpServer.address() as { port: number };

    async function openClient(): Promise<WebSocket> {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
            ws.once("message", () => resolve(ws));
            ws.once("error", reject);
        });
    }

    async function handle<T>(command: string, args: unknown): Promise<T> {
        const ws = await openClient();
        return new Promise<T>((resolve, reject) => {
            const messageId = `test-${Date.now()}-${Math.random()}`;
            ws.send(JSON.stringify({ message_id: messageId, command, args }));
            ws.once("message", raw => {
                ws.close();
                const msg = JSON.parse(raw.toString()) as { result?: T; error_code?: number; details?: string };
                if (msg.error_code !== undefined) {
                    reject(new Error(msg.details ?? `ServerError ${msg.error_code}`));
                } else {
                    resolve(msg.result as T);
                }
            });
            ws.once("error", reject);
        });
    }

    async function close(): Promise<void> {
        await handler.unregister();
        await new Promise<void>(resolve => httpServer.close(() => resolve()));
    }

    return { handle, config, credentials, close };
}

describe("Thread credential registry — per-entry set/remove behavior", () => {
    let h: TestHarness;

    beforeEach(async () => {
        h = await createHarness();
    });

    afterEach(async () => {
        await h.close();
    });

    it("setting a thread dataset registers its extPanId in the registry", async () => {
        await h.handle("set_thread_dataset", { dataset: DATASET_A });
        const xps = h.credentials.list().map(c => Bytes.toHex(c.extPanId).toUpperCase());
        expect(xps).to.include("1122334455667788");
    });

    it("setting a second distinct dataset registers a second extPanId (both coexist)", async () => {
        await h.handle("set_thread_dataset", { dataset: DATASET_A });
        await h.handle("set_thread_dataset", { dataset: DATASET_B, id: "Extra" });
        const xps = h.credentials.list().map(c => Bytes.toHex(c.extPanId).toUpperCase());
        expect(xps).to.include("1122334455667788");
        expect(xps).to.include("DEADBEEFCAFEBABE");
        expect(h.credentials.list()).to.have.lengthOf(2);
    });

    it("removing one entry unregisters only its extPanId and leaves the other", async () => {
        await h.handle("set_thread_dataset", { dataset: DATASET_A });
        await h.handle("set_thread_dataset", { dataset: DATASET_B, id: "Extra" });
        await h.handle("remove_thread_dataset", { id: "Extra" });
        const xps = h.credentials.list().map(c => Bytes.toHex(c.extPanId).toUpperCase());
        expect(xps).to.deep.equal(["1122334455667788"]);
        expect(xps).to.not.include("DEADBEEFCAFEBABE");
    });

    it("removing an entry whose extPanId is still referenced by another stored entry does NOT unregister it", async () => {
        // Store the same dataset under two different ids (same extPanId).
        await h.handle("set_thread_dataset", { dataset: DATASET_A });
        await h.handle("set_thread_dataset", { dataset: DATASET_A, id: "Duplicate" });
        // Registry should still deduplicate to one entry (register is idempotent by extPanId).
        expect(h.credentials.list()).to.have.lengthOf(1);
        // Removing one id must NOT drop the extPanId because the other id still holds it.
        await h.handle("remove_thread_dataset", { id: "Duplicate" });
        const xps = h.credentials.list().map(c => Bytes.toHex(c.extPanId).toUpperCase());
        expect(xps).to.include("1122334455667788");
    });
});
