/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { AsyncObservable, Environment, MockStorageService, Observable } from "@matter/general";
import { WebRtcTransportProvider } from "@matter/main/clusters/web-rtc-transport-provider";
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

interface StubCameraStreams {
    releaseConnection(connectionId: string): Promise<void>;
    startStream?(args: { connectionId: string }): Promise<unknown>;
    forgetSession?(nodeId: bigint, endpointId: number, webRtcSessionId: number): boolean;
}

/** The command-handler behaviour a test needs to vary; everything else is fixed in the stub. */
interface StubCommandHandlerOverrides {
    removeTrackedWebRtcSession?(webRtcSessionId: number, nodeId: bigint, endpointId: number): Promise<void>;
    sendWebRtcProviderCommand?(args: { commandName: string }): Promise<unknown>;
}

/** Well under the 2000 ms per-test timeout, so a frame that never comes fails as this error. */
const FRAME_WAIT_MS = 1000;

/**
 * Resolve on the first frame the predicate accepts.
 *
 * Armed before the frame is provoked, never after: waiting a fixed time instead turns a slow machine
 * into a failure that reads like a regression.
 */
function nextFrame(ws: WebSocket, what: string, wanted: (msg: WireFrame) => boolean): Promise<WireFrame> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            ws.off("message", onMessage);
            reject(new Error(`no ${what} frame arrived within ${FRAME_WAIT_MS} ms`));
        }, FRAME_WAIT_MS);
        const onMessage = (raw: WebSocket.RawData) => {
            const msg = JSON.parse(raw.toString()) as WireFrame;
            if (!wanted(msg)) return;
            clearTimeout(timer);
            ws.off("message", onMessage);
            resolve(msg);
        };
        ws.on("message", onMessage);
    });
}

type AnswerOutcome = { ok: true; frame: WireFrame } | { ok: false; error: Error };

interface WireFrame {
    event?: string;
    message_id?: string;
    result?: unknown;
    data?: unknown;
    error_code?: number;
    details?: string;
}

function makeStubController(
    credentials: ThreadCredentialsRegistry,
    cameraStreams?: StubCameraStreams,
    commandHandler?: StubCommandHandlerOverrides,
) {
    const stubCameraStreams: StubCameraStreams = cameraStreams ?? { async releaseConnection() {} };

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
        async handleInvoke() {
            return {};
        },
        removeTrackedWebRtcSession: commandHandler?.removeTrackedWebRtcSession ?? (async () => {}),
        sendWebRtcProviderCommand:
            commandHandler?.sendWebRtcProviderCommand ??
            (async () => {
                throw new Error("no WebRTC provider stubbed");
            }),
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

    const stubNetworkTopology = {
        events: { topologyUpdated: new Observable() },
        addNodeSource() {},
        getTopology() {
            return { collected_at: 0, nodes: [], connections: [] };
        },
        async refresh() {
            return { collected_at: 0, nodes: [], connections: [] };
        },
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
        get networkTopology() {
            return stubNetworkTopology as unknown as InstanceType<
                typeof import("../src/controller/NetworkTopologyService.js").NetworkTopologyService
            >;
        },
        get borderRouters() {
            return stubBorderRouters as unknown as InstanceType<
                typeof import("@matter/thread-br-client").BorderRouterRegistry
            >;
        },
        get cameraStreams() {
            return stubCameraStreams as unknown as InstanceType<
                typeof import("../src/camera/CameraStreamManager.js").CameraStreamManager
            >;
        },
        get cameraStreamsIfCreated() {
            return stubCameraStreams as unknown as InstanceType<
                typeof import("../src/camera/CameraStreamManager.js").CameraStreamManager
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
    emitTopologyUpdated(topology: unknown): void;
    config: ConfigStorage;
    close(): Promise<void>;
}

async function createHarness(
    cameraStreams?: StubCameraStreams,
    commandHandler?: StubCommandHandlerOverrides,
): Promise<TestHarness> {
    const config = await ConfigStorage.create(freshEnv());
    const credentials = new ThreadCredentialsRegistry();
    const controller = makeStubController(credentials, cameraStreams, commandHandler);

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

    function emitTopologyUpdated(topology: unknown): void {
        (controller.networkTopology.events.topologyUpdated as unknown as Observable<[unknown]>).emit(topology);
    }

    return {
        handle,
        openClient,
        sendOn,
        emitDiagnosticsBatch,
        emitWebRtcCallback,
        emitTopologyUpdated,
        config,
        close,
    };
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

    it("camera_start_stream opts a connection in to webrtc_callback the same way", async () => {
        const ws = await h.openClient();
        const events = new Array<string>();
        ws.on("message", raw => {
            const msg = JSON.parse(raw.toString()) as { event?: string };
            if (msg.event !== undefined) events.push(msg.event);
        });

        const cb = { webrtc_session_id: 1, event_type: "end", data: null };

        // Issuing the command opts this connection in (even though the stub controller errors on it).
        await new Promise<void>((resolve, reject) => {
            const id = "req-camera-start-stream";
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
                    command: "camera_start_stream",
                    args: { node_id: 1, endpoint_id: 1, stream_usage: "LiveView" },
                }),
            );
        });

        h.emitWebRtcCallback(cb);
        await new Promise(r => setTimeout(r, 50));
        expect(events).to.include("webrtc_callback");

        ws.close();
    });

    /**
     * Drive a command that reaches the camera, hold it there, and emit the answer the camera sends
     * while it is still in flight. Returns the order the client saw the frames in and the response.
     */
    async function webRtcAnswerDuring(
        command: string,
        args: unknown,
        harnessFor: (reached: () => void, answered: Promise<void>) => Promise<TestHarness>,
    ): Promise<{ order: string[]; response: WireFrame }> {
        let reachedDevice: () => void = () => {};
        const atDevice = new Promise<void>(resolve => {
            reachedDevice = resolve;
        });
        let releaseDevice: () => void = () => {};
        const deviceAnswered = new Promise<void>(resolve => {
            releaseDevice = resolve;
        });
        const h = await harnessFor(() => reachedDevice(), deviceAnswered);
        try {
            const ws = await h.openClient();
            const order = new Array<string>();
            const callback = nextFrame(ws, "webrtc_callback", msg => msg.event === "webrtc_callback").then(msg => {
                order.push("webrtc_callback");
                return msg;
            });
            // Settled, not awaited directly: the callback assertion below can throw first, and an
            // unobserved rejection here would surface as an unhandled rejection instead of the failure.
            const answer = nextFrame(ws, "response", msg => msg.message_id === "req-in-flight")
                .then(msg => {
                    order.push("response");
                    return msg;
                })
                .then<AnswerOutcome, AnswerOutcome>(
                    frame => ({ ok: true, frame }),
                    error => ({ ok: false, error: error as Error }),
                );

            ws.send(JSON.stringify({ message_id: "req-in-flight", command, args }));
            await atDevice;
            h.emitWebRtcCallback({ webrtc_session_id: 1, event_type: "answer", data: null });
            await callback;

            releaseDevice();
            const outcome = await answer;
            if (!outcome.ok) throw outcome.error;
            ws.close();
            return { order, response: outcome.frame };
        } finally {
            // Also released here: a callback that never arrives would otherwise leave the command
            // parked at the device and the harness unable to close.
            releaseDevice();
            await h.close();
        }
    }

    it("delivers a webrtc_callback emitted while camera_start_stream is still in flight", async () => {
        // The camera answers the offer while the command is still running: signaling for this session
        // starts at ProvideOffer, not at the command's response.
        const { order, response } = await webRtcAnswerDuring(
            "camera_start_stream",
            { node_id: 1, endpoint_id: 1, stream_usage: "LiveView" },
            (reached, answered) =>
                createHarness({
                    async releaseConnection() {},
                    async startStream() {
                        reached();
                        await answered;
                        return { webRtcSessionId: 1, mode: "provide_offer" };
                    },
                }),
        );

        expect(order).to.deep.equal(["webrtc_callback", "response"]);
        expect(response.error_code).to.equal(undefined);
        expect((response.result as { webrtc_session_id?: number }).webrtc_session_id).to.equal(1);
    });

    it("delivers a webrtc_callback emitted while send_webrtc_provider_command is still in flight", async () => {
        // The raw provider route is where the answer most reliably lands mid-invoke: the session is
        // tracked before ProvideOffer returns.
        const { order, response } = await webRtcAnswerDuring(
            "send_webrtc_provider_command",
            { node_id: 1, endpoint_id: 1, command_name: "ProvideOffer", payload: { sdp: "v=0" } },
            (reached, answered) =>
                createHarness(undefined, {
                    async sendWebRtcProviderCommand() {
                        reached();
                        await answered;
                        return { webRtcSessionId: 1 };
                    },
                }),
        );

        expect(order).to.deep.equal(["webrtc_callback", "response"]);
        expect(response.error_code).to.equal(undefined);
    });

    it("get_network_topology returns the built snapshot", async () => {
        const res = await h.handle<{ nodes: unknown[]; connections: unknown[] }>("get_network_topology", {});
        expect(res.nodes).to.deep.equal([]);
        expect(res.connections).to.deep.equal([]);
    });

    it("withholds network_topology_updated until the connection requests topology", async () => {
        const ws = await h.openClient();
        const events = new Array<string>();
        ws.on("message", raw => {
            const msg = JSON.parse(raw.toString()) as { event?: string };
            if (msg.event !== undefined) events.push(msg.event);
        });

        const topology = { collected_at: 0, nodes: [], connections: [] };

        // A pre-schema-13 client that never asks for topology must not receive the new event.
        h.emitTopologyUpdated(topology);
        await new Promise(r => setTimeout(r, 50));
        expect(events).to.not.include("network_topology_updated");

        // Issuing get_network_topology opts this connection in.
        await new Promise<void>((resolve, reject) => {
            const id = "req-topology";
            const onMsg = (raw: WebSocket.RawData) => {
                const msg = JSON.parse(raw.toString()) as { message_id?: string };
                if (msg.message_id === id) {
                    ws.off("message", onMsg);
                    resolve();
                }
            };
            ws.on("message", onMsg);
            ws.once("error", reject);
            ws.send(JSON.stringify({ message_id: id, command: "get_network_topology", args: {} }));
        });

        h.emitTopologyUpdated(topology);
        await new Promise(r => setTimeout(r, 50));
        expect(events).to.include("network_topology_updated");

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

    it("server_info reports schema 14 / min 11", async () => {
        const info = await h.handle<{ schema_version: number; min_supported_schema_version: number }>(
            "server_info",
            {},
        );
        expect(info.schema_version).to.equal(14);
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

describe("WebSocket camera session tracking on the raw path", () => {
    /** Records every local record drop the raw EndSession path makes, in the order it makes them. */
    function recordingHarness(trackingFails?: boolean): {
        drops: string[];
        targets: Array<{ nodeId: bigint; endpointId: number; webRtcSessionId: number }>;
        harness: Promise<TestHarness>;
    } {
        const drops = new Array<string>();
        const targets = new Array<{ nodeId: bigint; endpointId: number; webRtcSessionId: number }>();
        const harness = createHarness(
            {
                async releaseConnection() {},
                forgetSession(nodeId, endpointId, webRtcSessionId) {
                    drops.push("registry");
                    targets.push({ nodeId, endpointId, webRtcSessionId });
                    return true;
                },
            },
            {
                async removeTrackedWebRtcSession(webRtcSessionId, nodeId, endpointId) {
                    drops.push("tracking");
                    targets.push({ nodeId, endpointId, webRtcSessionId });
                    if (trackingFails === true) throw new Error("requestor endpoint gone");
                },
            },
        );
        return { drops, targets, harness };
    }

    async function endSessionOnRawPath(h: TestHarness, payload: unknown): Promise<unknown> {
        return h.handle("device_command", {
            node_id: 1,
            endpoint_id: 1,
            cluster_id: WebRtcTransportProvider.id,
            command_name: "EndSession",
            payload,
        });
    }

    it("drops both local records, registry first, when a client ends the session itself", async () => {
        const { drops, targets, harness } = recordingHarness();
        const h = await harness;
        try {
            await endSessionOnRawPath(h, { webRtcSessionId: 7 });
            expect(drops).to.deep.equal(["registry", "tracking"]);
            expect(targets).to.deep.equal([
                { nodeId: 1n, endpointId: 1, webRtcSessionId: 7 },
                { nodeId: 1n, endpointId: 1, webRtcSessionId: 7 },
            ]);
        } finally {
            await h.close();
        }
    });

    it("drops the camera registry entry, and still answers, when the requestor tracking cannot be reached", async () => {
        const { drops, harness } = recordingHarness(true);
        const h = await harness;
        try {
            const result = await endSessionOnRawPath(h, { webRtcSessionId: 7 });
            expect(drops).to.deep.equal(["registry", "tracking"]);
            expect(result).to.equal(null);
        } finally {
            await h.close();
        }
    });

    // The raw path must recognize every spelling camelize maps to webRtcSessionId, since that is what
    // the invoke itself accepted; these are the four a client plausibly sends.
    for (const spelling of ["WebRtcSessionId", "webRtcSessionId", "webRtcSessionID", "WebRTCSessionID"]) {
        it(`drops both local records for a session id spelled ${spelling}`, async () => {
            const { drops, targets, harness } = recordingHarness();
            const h = await harness;
            try {
                await endSessionOnRawPath(h, { [spelling]: 7 });
                expect(drops).to.deep.equal(["registry", "tracking"]);
                expect(targets.map(target => target.webRtcSessionId)).to.deep.equal([7, 7]);
            } finally {
                await h.close();
            }
        });
    }
});

describe("WebSocket camera session cleanup on disconnect", () => {
    it("releases camera sessions owned by the connection that closed, and no others", async () => {
        const released = new Array<string>();
        let closingConnectionId: string | undefined;
        const h = await createHarness({
            async releaseConnection(connectionId: string) {
                released.push(connectionId);
            },
            async startStream(args: { connectionId: string }) {
                closingConnectionId = args.connectionId;
                return { webRtcSessionId: 1, mode: "solicit_offer" };
            },
        });
        try {
            const closing = await h.openClient();
            const staysOpen = await h.openClient();
            try {
                // Exercise a camera command on `closing` first so its real, server-generated
                // connection id is known — proving which connection actually gets released, not just
                // that some connection did.
                await h.sendOn(closing, "camera_start_stream", {
                    node_id: 1,
                    endpoint_id: 1,
                    stream_usage: "LiveView",
                });
                expect(closingConnectionId).to.not.equal(undefined);

                await new Promise<void>(resolve => {
                    closing.once("close", () => resolve());
                    closing.close();
                });

                // Server-side close handling can lag the client close event.
                for (let i = 0; i < 40 && released.length === 0; i++) {
                    await new Promise<void>(resolve => setTimeout(resolve, 25));
                }
                expect(released).to.deep.equal([closingConnectionId]);
            } finally {
                staysOpen.close();
            }
        } finally {
            await h.close();
        }
    });
});
