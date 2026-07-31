/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { AsyncObservable, Environment, MockStorageService, Observable } from "@matter/general";
import { ThreadCredentialsRegistry } from "@matter/thread-br-client";
import { createServer } from "node:http";
import WebSocket from "ws";
import { ConfigStorage } from "../src/server/ConfigStorage.js";
import { WebSocketControllerHandler } from "../src/server/WebSocketControllerHandler.js";

// Minimal dataset: extPanId = DE:AD:BE:EF:CA:FE:11:22 (a-f bytes exercise the UPPERCASE invariant), network = "OpenThread".
const DATASET_HEX =
    "00010f0208deadbeefcafe1122030a4f70656e5468726561640410000102030405060708090a0b0c0d0e0f0e080000000000010000";

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
        async setFabricLabel() {},
        getFabricLabel(): string | undefined {
            return undefined;
        },
    };

    const stubDiagnostics = {
        events: { batchUpdated: new Observable() },
        // Model a disabled / nothing-cached service: single-network fetch yields undefined.
        async getOrFetch() {
            return undefined;
        },
        listCached() {
            return [];
        },
        refreshAllKnown() {},
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
    openClient(): Promise<WebSocket>;
    sendOn<T = unknown>(ws: WebSocket, command: string, args: unknown): Promise<T>;
    emitDiagnosticsBatch(batch: unknown): void;
    emitWebRtcCallback(data: unknown): void;
    config: ConfigStorage;
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

    // Drain the initial server_info message that the server sends on connection
    async function openClient(): Promise<WebSocket> {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
            ws.once("message", () => resolve(ws)); // discard the greeting
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

    // Sends a command on a caller-owned connection that stays open (unlike `handle`, which opens/closes
    // its own connection per call), so tests can exercise per-connection behavior across connections.
    async function sendOn<T>(ws: WebSocket, command: string, args: unknown): Promise<T> {
        const messageId = `test-${Date.now()}-${Math.random()}`;
        return new Promise<T>((resolve, reject) => {
            const cleanup = () => {
                ws.off("message", onMessage);
                ws.off("error", onError);
            };
            const onMessage = (raw: WebSocket.RawData) => {
                const msg = JSON.parse(raw.toString()) as {
                    message_id?: string;
                    result?: T;
                    error_code?: number;
                    details?: string;
                };
                if (msg.message_id !== messageId) return; // ignore unrelated frames (events, other replies)
                cleanup();
                if (msg.error_code !== undefined) {
                    reject(new Error(msg.details ?? `ServerError ${msg.error_code}`));
                } else {
                    resolve(msg.result as T);
                }
            };
            const onError = (err: Error) => {
                cleanup();
                reject(err);
            };
            ws.on("message", onMessage);
            ws.on("error", onError);
            ws.send(JSON.stringify({ message_id: messageId, command, args }));
        });
    }

    async function close(): Promise<void> {
        await handler.unregister();
        await new Promise<void>(resolve => httpServer.close(() => resolve()));
    }

    function emitDiagnosticsBatch(batch: unknown): void {
        (controller.threadDiagnostics.events.batchUpdated as unknown as Observable<[unknown]>).emit(batch);
    }

    function emitWebRtcCallback(data: unknown): void {
        (controller.commandHandler.events.webRtcCallback as unknown as Observable<[unknown]>).emit(data);
    }

    return { handle, openClient, sendOn, emitDiagnosticsBatch, emitWebRtcCallback, config, close };
}

describe("WebSocket Credentials API", () => {
    let h: TestHarness;

    beforeEach(async () => {
        h = await createHarness();
    });

    afterEach(async () => {
        await h.close();
    });

    it("routes set_wifi_credentials without id to the default entry", async () => {
        await h.handle("set_wifi_credentials", { ssid: "S", credentials: "C" });
        expect(h.config.getWifiCredentials("default")).to.deep.equal({ ssid: "S", credentials: "C" });
    });

    it("routes set_wifi_credentials with id to an additional entry", async () => {
        await h.handle("set_wifi_credentials", { ssid: "Guest", credentials: "pw", id: "GuestNet" });
        expect(h.config.getWifiCredentials("GuestNet")).to.deep.equal({ ssid: "Guest", credentials: "pw" });
    });

    it("routes set_thread_dataset with id to an additional entry", async () => {
        await h.handle("set_thread_dataset", { dataset: DATASET_HEX, id: "Extra" });
        expect(h.config.getThreadCredentials("Extra")).to.deep.equal({ dataset: DATASET_HEX });
    });

    it("get_all_credentials returns summaries with no secrets", async () => {
        await h.handle("set_wifi_credentials", { ssid: "S", credentials: "C" });
        const res = await h.handle<{ wifi: Array<{ id: string; ssid: string }>; thread: Array<{ id: string }> }>(
            "get_all_credentials",
            {},
        );
        expect(res.wifi).to.deep.equal([{ id: "default", ssid: "S" }]);
        expect(JSON.stringify(res)).to.not.contain("C");
        expect(res.thread[0].id).to.equal("default");
    });

    it("get_all_credentials always includes default thread entry even when unset", async () => {
        const res = await h.handle<{ wifi: unknown[]; thread: Array<{ id: string }> }>("get_all_credentials", {});
        expect(res.thread[0].id).to.equal("default");
    });

    it("withholds thread_diagnostics_updated until the connection requests thread data", async () => {
        const ws = await h.openClient();
        const events = new Array<string>();
        ws.on("message", raw => {
            const msg = JSON.parse(raw.toString()) as { event?: string };
            if (msg.event !== undefined) events.push(msg.event);
        });

        const batch = {
            extPanIdHex: "1122334455667788",
            networkName: "Net",
            collectedAt: 0,
            source: "meshcop",
            nodes: [],
        };

        // A schema-11 client that never asks for Thread data must not receive the schema-12 event.
        h.emitDiagnosticsBatch(batch);
        await new Promise(r => setTimeout(r, 50));
        expect(events).to.not.include("thread_diagnostics_updated");

        // Issuing a Thread request opts this connection in.
        await new Promise<void>((resolve, reject) => {
            const id = "req-thread";
            const onMsg = (raw: WebSocket.RawData) => {
                const msg = JSON.parse(raw.toString()) as { message_id?: string };
                if (msg.message_id === id) {
                    ws.off("message", onMsg);
                    resolve();
                }
            };
            ws.on("message", onMsg);
            ws.once("error", reject);
            ws.send(JSON.stringify({ message_id: id, command: "get_thread_border_routers", args: {} }));
        });

        h.emitDiagnosticsBatch(batch);
        await new Promise(r => setTimeout(r, 50));
        expect(events).to.include("thread_diagnostics_updated");

        ws.close();
    });

    it("withholds webrtc_callback until the connection issues a WebRTC provider command", async () => {
        const ws = await h.openClient();
        const events = new Array<string>();
        ws.on("message", raw => {
            const msg = JSON.parse(raw.toString()) as { event?: string };
            if (msg.event !== undefined) events.push(msg.event);
        });

        const cb = { webrtc_session_id: 1, event_type: "end", data: null };

        // A connection that never touched WebRTC must not receive another session's callbacks.
        h.emitWebRtcCallback(cb);
        await new Promise(r => setTimeout(r, 50));
        expect(events).to.not.include("webrtc_callback");

        // Issuing the command opts this connection in (even though the stub controller errors on it).
        await new Promise<void>((resolve, reject) => {
            const id = "req-webrtc";
            const onMsg = (raw: WebSocket.RawData) => {
                const msg = JSON.parse(raw.toString()) as { message_id?: string };
                if (msg.message_id === id) {
                    ws.off("message", onMsg);
                    resolve();
                }
            };
            ws.on("message", onMsg);
            ws.once("error", reject);
            ws.send(
                JSON.stringify({
                    message_id: id,
                    command: "send_webrtc_provider_command",
                    args: { node_id: 1, endpoint_id: 1, command_name: "ProvideOffer", payload: {} },
                }),
            );
        });

        h.emitWebRtcCallback(cb);
        await new Promise(r => setTimeout(r, 50));
        expect(events).to.include("webrtc_callback");

        ws.close();
    });

    it("get_thread_diagnostics(ext_pan_id) returns null (not an error) when nothing is cached", async () => {
        const res = await h.handle<unknown>("get_thread_diagnostics", { ext_pan_id: "1122334455667788" });
        expect(res).to.equal(null);
    });

    it("opts a connection in even when its Thread request errors", async () => {
        const ws = await h.openClient();
        const events = new Array<string>();
        ws.on("message", raw => {
            const msg = JSON.parse(raw.toString()) as { event?: string };
            if (msg.event !== undefined) events.push(msg.event);
        });

        // A malformed ext_pan_id errors server-side but still proves the client is schema-12 Thread-aware.
        await new Promise<void>((resolve, reject) => {
            const id = "req-bad";
            const onMsg = (raw: WebSocket.RawData) => {
                const msg = JSON.parse(raw.toString()) as { message_id?: string };
                if (msg.message_id === id) {
                    ws.off("message", onMsg);
                    resolve();
                }
            };
            ws.on("message", onMsg);
            ws.once("error", reject);
            ws.send(
                JSON.stringify({ message_id: id, command: "get_thread_diagnostics", args: { ext_pan_id: "not-hex" } }),
            );
        });

        h.emitDiagnosticsBatch({
            extPanIdHex: "1122334455667788",
            networkName: "Net",
            collectedAt: 0,
            source: "meshcop",
            nodes: [],
        });
        await new Promise(r => setTimeout(r, 50));
        expect(events).to.include("thread_diagnostics_updated");

        ws.close();
    });

    it("get_all_credentials decodes thread extPanId and networkName", async () => {
        await h.handle("set_thread_dataset", { dataset: DATASET_HEX });
        const res = await h.handle<{
            thread: Array<{ id: string; networkName?: string; extPanId?: string }>;
        }>("get_all_credentials", {});
        const def = res.thread.find(e => e.id === "default");
        expect(def?.networkName).to.equal("OpenThread");
        expect(def?.extPanId).to.equal("DEADBEEFCAFE1122");
        // Self-check guards against a lowercase regression.
        expect(def?.extPanId).to.equal(def?.extPanId?.toUpperCase());
    });

    it("server_info reports schema 12 / min 11", async () => {
        const info = await h.handle<{ schema_version: number; min_supported_schema_version: number }>(
            "server_info",
            {},
        );
        expect(info.schema_version).to.equal(12);
        expect(info.min_supported_schema_version).to.equal(11);
    });

    it("commission_with_code rejects an unknown thread_dataset_id", async () => {
        let err: unknown;
        try {
            await h.handle("commission_with_code", { code: "MT:...", thread_dataset_id: "nope" });
        } catch (e) {
            err = e;
        }
        expect(String(err)).to.contain("nope");
    });

    it("commission_with_code rejects an unknown wifi_credentials_id", async () => {
        let err: unknown;
        try {
            await h.handle("commission_with_code", { code: "MT:...", wifi_credentials_id: "unknown" });
        } catch (e) {
            err = e;
        }
        expect(String(err)).to.contain("unknown");
    });

    it("remove_wifi_credentials with id removes that specific entry", async () => {
        await h.handle("set_wifi_credentials", { ssid: "G", credentials: "p", id: "Guest" });
        expect(h.config.getWifiCredentials("Guest")).to.not.equal(undefined);
        await h.handle("remove_wifi_credentials", { id: "Guest" });
        expect(h.config.getWifiCredentials("Guest")).to.equal(undefined);
    });

    it("remove_thread_dataset with id removes that specific entry", async () => {
        await h.handle("set_thread_dataset", { dataset: DATASET_HEX, id: "Extra" });
        expect(h.config.getThreadCredentials("Extra")).to.not.equal(undefined);
        await h.handle("remove_thread_dataset", { id: "Extra" });
        expect(h.config.getThreadCredentials("Extra")).to.equal(undefined);
    });
});

describe("WebSocket set_default_fabric_label ownership", () => {
    let h: TestHarness;

    beforeEach(async () => {
        h = await createHarness();
    });

    afterEach(async () => {
        await h.close();
    });

    it("first connection to set the fabric label owns it; other connections are ignored", async () => {
        const owner = await h.openClient();
        const other = await h.openClient();
        try {
            await h.sendOn(owner, "set_default_fabric_label", { label: "Owner" });
            expect(h.config.fabricLabel).to.equal("Owner");

            await h.sendOn(other, "set_default_fabric_label", { label: "Intruder" });
            expect(h.config.fabricLabel).to.equal("Owner");

            // The owning connection may keep changing the label.
            await h.sendOn(owner, "set_default_fabric_label", { label: "Owner2" });
            expect(h.config.fabricLabel).to.equal("Owner2");
        } finally {
            owner.close();
            other.close();
        }
    });

    it("releases ownership when the owning connection closes", async () => {
        const owner = await h.openClient();
        await h.sendOn(owner, "set_default_fabric_label", { label: "Owner" });
        expect(h.config.fabricLabel).to.equal("Owner");

        await new Promise<void>(resolve => {
            owner.once("close", () => resolve());
            owner.close();
        });

        const other = await h.openClient();
        try {
            // Server-side close handling can lag the client close event; retry until the claim is released.
            for (let i = 0; i < 40 && h.config.fabricLabel !== "New"; i++) {
                await h.sendOn(other, "set_default_fabric_label", { label: "New" });
                if (h.config.fabricLabel !== "New") {
                    await new Promise<void>(resolve => setTimeout(resolve, 25));
                }
            }
            expect(h.config.fabricLabel).to.equal("New");
        } finally {
            other.close();
        }
    });

    it("the CLI pin overrides connection ownership", async () => {
        await h.config.lockFabricLabel("Pinned");
        const ws = await h.openClient();
        try {
            await h.sendOn(ws, "set_default_fabric_label", { label: "Nope" });
            expect(h.config.fabricLabel).to.equal("Pinned");
        } finally {
            ws.close();
        }
    });
});
