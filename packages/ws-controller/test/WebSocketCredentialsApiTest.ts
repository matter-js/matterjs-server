/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { toBigIntAwareJson } from "@matter-server/ws-client";
import { AsyncObservable, Environment, Millis, MockStorageService, Observable } from "@matter/general";
import { CaseAuthenticatedTag, EndpointNumber, NodeId, Seconds } from "@matter/main";
import { WebRtcTransportProvider } from "@matter/main/clusters/web-rtc-transport-provider";
import { Status, StatusResponseError } from "@matter/main/types";
import { ThreadCredentialsRegistry } from "@matter/thread-br-client";
import { createServer } from "node:http";
import WebSocket from "ws";
import type { CameraSessionEnded, CameraStreamEvicted } from "../src/camera/cameraTypes.js";
import type { SessionOwner } from "../src/camera/sessionRegistry.js";
import { ConfigStorage } from "../src/server/ConfigStorage.js";
import { WebSocketControllerHandler } from "../src/server/WebSocketControllerHandler.js";
import type {
    AttributeResponseStatus,
    BatchedInvokeRequest,
    BatchedInvokeResult,
    CommissioningRequest,
    InvokeRequest,
} from "../src/types/CommandHandler.js";

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
    startStream?(args: {
        connectionId: string;
        allowEviction?: boolean;
        talkback?: boolean;
        sessionEstablishing?: (webRtcSessionId: number) => void;
        clientSessionKey?: string;
    }): Promise<unknown>;
    stopStream?(nodeId: bigint, endpointId: number, webRtcSessionId: number, requestedBy?: string): Promise<boolean>;
    stopStreamByClientKey?(
        nodeId: bigint,
        endpointId: number,
        connectionId: string,
        clientSessionKey: string,
    ): Promise<boolean>;
    clientSessionId?(
        nodeId: bigint,
        endpointId: number,
        connectionId: string,
        clientSessionKey: string,
    ): number | undefined;
    /** What the manager reports on nobody's request: a session that ended, a stream that was taken. */
    events?: {
        sessionEnded: Observable<[CameraSessionEnded]>;
        streamEvicted: Observable<[CameraStreamEvicted]>;
    };
    snapshot?(args: {
        watermarkEnabled?: boolean;
        osdEnabled?: boolean;
        resolution?: unknown;
        maxResolution?: unknown;
    }): Promise<unknown>;
    releaseStream?(args: { streamId: number }): Promise<void>;
    endSessionForClient?<T>(
        nodeId: bigint,
        endpointId: number,
        webRtcSessionId: number,
        requestedBy: string,
        send: () => Promise<T>,
    ): Promise<T>;
    sessionIdIssued?(nodeId: bigint, endpointId: number, webRtcSessionId: number): void;
    /** Which connections may receive a session's signalling; absent means the manager holds no record. */
    signallingOwner?(nodeId: bigint, endpointId: number, webRtcSessionId: number): SessionOwner | undefined;
}

/** The command-handler behaviour a test needs to vary; everything else is fixed in the stub. */
interface StubCommandHandlerOverrides {
    handleInvoke?(data: InvokeRequest): Promise<unknown>;
    handleWriteAttribute?(data: unknown): Promise<AttributeResponseStatus[]>;
    handleBatchedInvoke?(data: BatchedInvokeRequest): Promise<BatchedInvokeResult>;
    handleGroupWriteAttribute?(data: unknown): Promise<void>;
    handleGroupInvoke?(data: unknown): Promise<void>;
    removeTrackedWebRtcSession?(webRtcSessionId: number, nodeId: bigint, endpointId: number): Promise<void>;
    invokeWebRtcProviderCommand?(args: {
        commandName: string;
        fields: Record<string, unknown>;
        sessionEstablishing?: (webRtcSessionId: number) => void;
    }): Promise<unknown>;
    invokeWebRtcSignallingCommand?(args: { commandName: string; fields: Record<string, unknown> }): Promise<void>;
    commissionNode?(request: CommissioningRequest): Promise<{ nodeId: NodeId }>;
}

/** Well under the 2000 ms per-test timeout, so a frame that never comes fails as this error. */
const FRAME_WAIT_MS = 1000;

/** Resolve on the first frame the predicate accepts. Arm it before provoking the frame. */
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

/**
 * The frame sent as already-serialized text, for a `node_id` that only a bigint states exactly:
 * `JSON.stringify` throws on a bigint, so such a frame cannot go through {@link answerTo}.
 */
async function answerToFrameText(h: TestHarness, messageId: string, frameText: string): Promise<WireFrame> {
    const ws = await h.openClient();
    try {
        const answer = nextFrame(ws, "response", msg => msg.message_id === messageId);
        ws.send(frameText);
        return await answer;
    } finally {
        ws.close();
    }
}

/** The whole frame, sent as written, so a message that states no `args` at all can be tested. */
async function answerTo(h: TestHarness, frame: Record<string, unknown>): Promise<WireFrame> {
    const ws = await h.openClient();
    try {
        const answer = nextFrame(ws, "response", msg => msg.message_id === frame.message_id);
        ws.send(JSON.stringify(frame));
        return await answer;
    } finally {
        ws.close();
    }
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
    // An unowned session is what the WebSocket route reads as "send to every opted-in connection".
    const stubCameraStreams: StubCameraStreams = {
        async releaseConnection() {},
        signallingOwner: () => undefined,
        events: { sessionEnded: new Observable(), streamEvicted: new Observable() },
        ...cameraStreams,
    };

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
        // matter.js answers a status-only command with undefined.
        handleInvoke: commandHandler?.handleInvoke ?? (async () => undefined),
        handleWriteAttribute:
            commandHandler?.handleWriteAttribute ??
            (async () => [{ endpointId: 1, clusterId: 6, attributeId: 0, status: 0 }]),
        handleBatchedInvoke:
            commandHandler?.handleBatchedInvoke ??
            (async (data: BatchedInvokeRequest) => data.commands.map(() => ({ status: Status.Success }))),
        handleGroupWriteAttribute:
            commandHandler?.handleGroupWriteAttribute ??
            (async () => {
                throw new Error("no groupcast write stubbed");
            }),
        handleGroupInvoke:
            commandHandler?.handleGroupInvoke ??
            (async () => {
                throw new Error("no groupcast invoke stubbed");
            }),
        removeTrackedWebRtcSession: commandHandler?.removeTrackedWebRtcSession ?? (async () => {}),
        invokeWebRtcProviderCommand:
            commandHandler?.invokeWebRtcProviderCommand ??
            (async () => {
                throw new Error("no WebRTC provider stubbed");
            }),
        invokeWebRtcSignallingCommand:
            commandHandler?.invokeWebRtcSignallingCommand ??
            (async () => {
                throw new Error("no WebRTC provider stubbed");
            }),
        commissionNode:
            commandHandler?.commissionNode ??
            (async () => {
                throw new Error("no commissioning stubbed");
            }),
        isNodeIdInUse() {
            return false;
        },
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

    /** `getAllVendors` answers a map of vendor id to the DCL entry, which the handler iterates. */
    const stubVendors = new Map([[4631, { vendorName: "Test Vendor" }]]);

    const stubDiagnostics = {
        events: { batchUpdated: new Observable() },
        fetches: 0,
        // Model a disabled / nothing-cached service: single-network fetch yields undefined.
        async getOrFetch() {
            this.fetches++;
            return undefined;
        },
        listCached() {
            return [];
        },
        remainingTtl() {
            return Millis(3_600_000);
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
        borderRouterDiscoveryStarts: 0,
        startsBorderRouterDiscovery: false,
        startBorderRouterDiscovery() {
            this.borderRouterDiscoveryStarts++;
            return this.startsBorderRouterDiscovery;
        },
        diagnosticsFetches: () => stubDiagnostics.fetches,
        async certificateService() {},
        async getAllVendors() {
            return stubVendors;
        },
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
    borderRouterDiscoveryStarts(): number;
    discoveryStartsNow(): void;
    diagnosticsFetches(): number;
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
        borderRouterDiscoveryStarts: () => controller.borderRouterDiscoveryStarts,
        discoveryStartsNow: () => {
            controller.startsBorderRouterDiscovery = true;
        },
        diagnosticsFetches: () => controller.diagnosticsFetches(),
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

        const cb = { webrtc_session_id: 1, node_id: 1, endpoint_id: 1, event_type: "end", data: null };

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
                    args: {
                        node_id: 1,
                        endpoint_id: 1,
                        command_name: "ProvideOffer",
                        payload: { webRtcSessionId: null, sdp: "v=0" },
                    },
                }),
            );
        });

        h.emitWebRtcCallback(cb);
        await new Promise(r => setTimeout(r, 50));
        expect(events).to.include("webrtc_callback");

        ws.close();
    });

    it("starts Border Router discovery for the commands that need Border Routers", async () => {
        await h.handle("get_thread_border_routers", {});
        await h.handle("get_thread_diagnostics", {});
        await h.handle("get_thread_diagnostics", { ext_pan_id: "1122334455667788" });
        await h.handle("get_network_topology", {});

        expect(h.borderRouterDiscoveryStarts()).to.equal(4);
    });

    it("answers get_thread_diagnostics(ext_pan_id) with null and fetches nothing when that call starts discovery", async () => {
        h.discoveryStartsNow();

        const res = await h.handle<unknown>("get_thread_diagnostics", { ext_pan_id: "1122334455667788" });

        expect(res).to.equal(null);
        expect(h.diagnosticsFetches()).to.equal(0);
    });

    it("fetches diagnostics once Border Router discovery is already running", async () => {
        await h.handle<unknown>("get_thread_diagnostics", { ext_pan_id: "1122334455667788" });

        expect(h.diagnosticsFetches()).to.equal(1);
    });

    it("camera_start_stream opts a connection in to webrtc_callback the same way", async () => {
        const ws = await h.openClient();
        const events = new Array<string>();
        ws.on("message", raw => {
            const msg = JSON.parse(raw.toString()) as { event?: string };
            if (msg.event !== undefined) events.push(msg.event);
        });

        const cb = { webrtc_session_id: 1, node_id: 1, endpoint_id: 1, event_type: "end", data: null };

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
            // Settled, not awaited: the callback assertion below can throw first and orphan this rejection.
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
            h.emitWebRtcCallback({
                webrtc_session_id: 1,
                node_id: 1,
                endpoint_id: 1,
                event_type: "answer",
                data: null,
            });
            await callback;

            releaseDevice();
            const outcome = await answer;
            if (!outcome.ok) throw outcome.error;
            ws.close();
            return { order, response: outcome.frame };
        } finally {
            // Also released here, or a missing callback leaves the command parked and the harness unable to close.
            releaseDevice();
            await h.close();
        }
    }

    it("delivers a webrtc_callback emitted while send_webrtc_provider_command is still in flight", async () => {
        // On the raw provider route the session is tracked before ProvideOffer returns.
        const { order, response } = await webRtcAnswerDuring(
            "send_webrtc_provider_command",
            {
                node_id: 1,
                endpoint_id: 1,
                command_name: "ProvideOffer",
                payload: { webRtcSessionId: null, sdp: "v=0" },
            },
            (reached, answered) =>
                createHarness(undefined, {
                    async invokeWebRtcProviderCommand() {
                        reached();
                        await answered;
                        return { webRtcSessionId: 1 };
                    },
                }),
        );

        expect(order).to.deep.equal(["webrtc_callback", "response"]);
        expect(response.error_code).to.equal(undefined);
    });

    it("hands send_webrtc_provider_command's payload down as cluster-shaped fields", async () => {
        let fields: Record<string, unknown> | undefined;
        await h.close();
        h = await createHarness(undefined, {
            async invokeWebRtcProviderCommand(args) {
                fields = args.fields;
                return { webRtcSessionId: 1 };
            },
        });
        await h.handle("send_webrtc_provider_command", {
            node_id: 1,
            endpoint_id: 1,
            command_name: "ProvideOffer",
            payload: {
                webRtcSessionId: null,
                sdp: "v=0",
                ice_servers: [{ urls: "stun:stun.example:3478" }],
            },
        });
        expect(fields?.iceServers).to.deep.equal([{ urls: ["stun:stun.example:3478"] }]);
    });

    it("relays ProvideIceCandidates as cluster-shaped fields and answers null", async () => {
        let seen: Record<string, unknown> | undefined;
        let established = false;
        await h.close();
        h = await createHarness(undefined, {
            async invokeWebRtcSignallingCommand(args) {
                seen = args.fields;
            },
            async invokeWebRtcProviderCommand() {
                established = true;
                return { webRtcSessionId: 1 };
            },
        });
        const result = await h.handle("send_webrtc_provider_command", {
            node_id: 1,
            endpoint_id: 1,
            command_name: "ProvideIceCandidates",
            // As a webrtc_callback ice_candidates event reports them.
            payload: {
                webrtc_session_id: 4,
                ice_candidates: [{ candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0 }],
            },
        });
        expect(seen).to.deep.equal({
            webRtcSessionId: 4,
            iceCandidates: [{ candidate: "candidate:1", sdpMid: "0", sdpmLineIndex: 0 }],
        });
        // The session-establishing path would look for a session id in a response that carries none.
        expect(established).to.equal(false);
        expect(result).to.equal(null);
    });

    it("relays ProvideAnswer on the raw route and answers null", async () => {
        let seen: { commandName: string; fields: Record<string, unknown> } | undefined;
        await h.close();
        h = await createHarness(undefined, {
            async invokeWebRtcSignallingCommand(args) {
                seen = { commandName: args.commandName, fields: args.fields };
            },
        });
        const result = await h.handle("send_webrtc_provider_command", {
            node_id: 1,
            endpoint_id: 1,
            command_name: "ProvideAnswer",
            payload: { webrtc_session_id: 4, sdp: "v=0" },
        });
        expect(seen).to.deep.equal({ commandName: "ProvideAnswer", fields: { webRtcSessionId: 4, sdp: "v=0" } });
        expect(result).to.equal(null);
    });

    it("sends the SDP answer for a managed session through camera_provide_answer", async () => {
        let seen: { commandName: string; fields: Record<string, unknown> } | undefined;
        await h.close();
        h = await createHarness(undefined, {
            async invokeWebRtcSignallingCommand(args) {
                seen = { commandName: args.commandName, fields: args.fields };
            },
        });
        // Camera API style only: the session id as camera_start_stream answered it, no cluster field names.
        const result = await h.handle("camera_provide_answer", {
            node_id: 1,
            endpoint_id: 1,
            webrtc_session_id: 4,
            sdp: "v=0",
        });
        expect(seen).to.deep.equal({ commandName: "ProvideAnswer", fields: { webRtcSessionId: 4, sdp: "v=0" } });
        expect(result).to.equal(null);
    });

    it("sends candidates for a managed session through camera_provide_ice_candidates", async () => {
        let seen: { commandName: string; fields: Record<string, unknown> } | undefined;
        await h.close();
        h = await createHarness(undefined, {
            async invokeWebRtcSignallingCommand(args) {
                seen = { commandName: args.commandName, fields: args.fields };
            },
        });
        const result = await h.handle("camera_provide_ice_candidates", {
            node_id: 1,
            endpoint_id: 1,
            webrtc_session_id: 4,
            // As a webrtc_callback ice_candidates event reports them.
            ice_candidates: [{ candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0 }],
        });
        expect(seen).to.deep.equal({
            commandName: "ProvideIceCandidates",
            fields: {
                webRtcSessionId: 4,
                iceCandidates: [{ candidate: "candidate:1", sdpMid: "0", sdpmLineIndex: 0 }],
            },
        });
        expect(result).to.equal(null);
    });

    it("names the camera command a signalling refusal is about", async () => {
        // The client named no cluster command, so it is not told about one.
        let thrown: unknown;
        try {
            await h.handle("camera_provide_answer", { node_id: 1, endpoint_id: 1, sdp: "v=0" });
        } catch (error) {
            thrown = error;
        }
        expect((thrown as Error).message).to.contain("camera_provide_answer requires webRtcSessionId");
    });

    it("refuses a camera_provide_ice_candidates argument it does not take", async () => {
        let thrown: unknown;
        try {
            await h.handle("camera_provide_ice_candidates", {
                node_id: 1,
                endpoint_id: 1,
                webrtc_session_id: 4,
                ice_candidates: [{ candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0 }],
                stream_usage: "LiveView",
            });
        } catch (error) {
            thrown = error;
        }
        expect((thrown as Error).message).to.contain(
            "unknown camera_provide_ice_candidates argument key: stream_usage",
        );
    });

    it("refuses a send_webrtc_provider_command argument it does not take", async () => {
        let thrown: unknown;
        try {
            await h.handle("send_webrtc_provider_command", {
                node_id: 1,
                endpoint_id: 1,
                command_name: "ProvideOffer",
                payload: { webRtcSessionId: null, sdp: "v=0" },
                timed_request_timeout_ms: 100,
            });
        } catch (error) {
            thrown = error;
        }
        expect((thrown as Error).message).to.match(
            /^unknown send_webrtc_provider_command argument key: timed_request_timeout_ms\./,
        );
    });

    it("refuses a send_webrtc_provider_command naming another provider command", async () => {
        let thrown: unknown;
        try {
            await h.handle("send_webrtc_provider_command", {
                node_id: 1,
                endpoint_id: 1,
                command_name: "EndSession",
                payload: { webRtcSessionId: 1 },
            });
        } catch (error) {
            thrown = error;
        }
        expect((thrown as Error).message).to.match(/Unsupported WebRTC provider command "EndSession"/);
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

    describe("discovery_timeout_s", () => {
        async function requestsFor(command: string, args: object) {
            const requests = new Array<CommissioningRequest>();
            await h.close();
            h = await createHarness(undefined, {
                async commissionNode(request) {
                    requests.push(request);
                    throw new Error("stop after the request");
                },
            });
            await h.handle(command, args).catch(() => {});
            return requests;
        }

        it("bounds the discovery of commission_with_code and commission_on_network", async () => {
            const [withCode] = await requestsFor("commission_with_code", {
                code: "MT:Y.K90AFN00KA0648G00",
                discovery_timeout_s: 90,
            });
            const [onNetwork] = await requestsFor("commission_on_network", {
                setup_pin_code: 20202021,
                discovery_timeout_s: 90,
            });

            expect(withCode?.discoveryTimeout).to.equal(Seconds(90));
            expect(onNetwork?.discoveryTimeout).to.equal(Seconds(90));
        });

        it("searches commission_on_network filter_type 3 by vendor without naming a product", async () => {
            const [request] = await requestsFor("commission_on_network", {
                setup_pin_code: 20202021,
                filter_type: 3,
                filter: 0xfff1,
            });

            expect(request).to.deep.include({ passcode: 20202021, vendorId: 0xfff1 });
            expect(request).to.not.have.property("productId");
        });

        it("searches commission_on_network filter_type 4 by device type", async () => {
            const [request] = await requestsFor("commission_on_network", {
                setup_pin_code: 20202021,
                filter_type: 4,
                filter: 0x0100,
            });

            expect(request).to.deep.include({ passcode: 20202021, deviceType: 0x0100 });
        });

        it("refuses commission_on_network filter_type 4 without a filter", async () => {
            const requests = await requestsFor("commission_on_network", { setup_pin_code: 20202021, filter_type: 4 });
            const failure = await h.handle("commission_on_network", { setup_pin_code: 20202021, filter_type: 4 }).then(
                () => "",
                (error: unknown) => String(error),
            );

            expect(requests).to.deep.equal([]);
            expect(failure).to.contain("filter required for filter_type 4");
        });

        for (const [filterType, field] of [
            [1, "shortDiscriminator"],
            [2, "longDiscriminator"],
            [3, "vendorId"],
        ] as const) {
            it(`searches commission_on_network filter_type ${filterType} by ${field} and requires its filter`, async () => {
                const [request] = await requestsFor("commission_on_network", {
                    setup_pin_code: 20202021,
                    filter_type: filterType,
                    filter: 15,
                });
                const failure = await h
                    .handle("commission_on_network", { setup_pin_code: 20202021, filter_type: filterType })
                    .then(
                        () => "",
                        (error: unknown) => String(error),
                    );

                expect(request).to.deep.include({ passcode: 20202021, [field]: 15 });
                expect(failure).to.contain(`filter required for filter_type ${filterType}`);
            });
        }

        it("ignores the filter of commission_on_network filter_type 0", async () => {
            const [request] = await requestsFor("commission_on_network", {
                setup_pin_code: 20202021,
                filter_type: 0,
                filter: 15,
            });

            expect(request).to.not.have.any.keys("shortDiscriminator", "longDiscriminator", "vendorId", "deviceType");
        });

        it("accepts 172800 seconds, the longest a device announces for commissioning", async () => {
            const [request] = await requestsFor("commission_with_code", {
                code: "MT:Y.K90AFN00KA0648G00",
                discovery_timeout_s: 172_800,
            });

            expect(request?.discoveryTimeout).to.equal(Seconds(172_800));
        });

        for (const value of [undefined, null]) {
            it(`leaves the matter.js default for ${String(value)}`, async () => {
                const [request] = await requestsFor("commission_with_code", {
                    code: "MT:Y.K90AFN00KA0648G00",
                    discovery_timeout_s: value,
                });

                expect(request).to.not.equal(undefined);
                expect(request?.discoveryTimeout).to.equal(undefined);
            });
        }

        for (const value of [0, -5, "90", 172_801]) {
            it(`refuses ${JSON.stringify(value)} before commissioning`, async () => {
                for (const [command, args] of [
                    ["commission_with_code", { code: "MT:Y.K90AFN00KA0648G00" }],
                    ["commission_on_network", { setup_pin_code: 20202021 }],
                ] as const) {
                    const requests = await requestsFor(command, { ...args, discovery_timeout_s: value });
                    expect(requests, command).to.deep.equal([]);
                }
                let err: unknown;
                try {
                    await h.handle("commission_with_code", {
                        code: "MT:Y.K90AFN00KA0648G00",
                        discovery_timeout_s: value,
                    });
                } catch (e) {
                    err = e;
                }
                expect(String(err)).to.contain("discovery_timeout_s must be a number of seconds above 0");
            });
        }
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
    function recordingHarness(options: { trackingFails?: boolean; invoke?: () => Promise<unknown> } = {}): {
        drops: string[];
        targets: Array<{ nodeId: bigint; endpointId: number; webRtcSessionId: number }>;
        harness: Promise<TestHarness>;
    } {
        const drops = new Array<string>();
        const targets = new Array<{ nodeId: bigint; endpointId: number; webRtcSessionId: number }>();
        const harness = createHarness(
            {
                async releaseConnection() {},
                // `requestedBy` is covered by `harnessWithRawEndAnnouncing`.
                async endSessionForClient(nodeId, endpointId, webRtcSessionId, _requestedBy, send) {
                    const drop = () => {
                        drops.push("registry");
                        targets.push({ nodeId, endpointId, webRtcSessionId });
                    };
                    try {
                        const response = await send();
                        drop();
                        return response;
                    } catch (error) {
                        if (error instanceof StatusResponseError && error.code === Status.NotFound) drop();
                        throw error;
                    }
                },
            },
            {
                handleInvoke: options.invoke,
                async removeTrackedWebRtcSession(webRtcSessionId, nodeId, endpointId) {
                    drops.push("tracking");
                    targets.push({ nodeId, endpointId, webRtcSessionId });
                    if (options.trackingFails === true) throw new Error("requestor endpoint gone");
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
        const { drops, harness } = recordingHarness({ trackingFails: true });
        const h = await harness;
        try {
            const result = await endSessionOnRawPath(h, { webRtcSessionId: 7 });
            expect(drops).to.deep.equal(["registry", "tracking"]);
            expect(result).to.equal(null);
        } finally {
            await h.close();
        }
    });

    it("drops both local records when the device answers NotFound, and reports the device's error", async () => {
        const { drops, harness } = recordingHarness({
            invoke: async () => {
                throw new StatusResponseError("no such session", Status.NotFound);
            },
        });
        const h = await harness;
        try {
            let thrown: unknown;
            try {
                await endSessionOnRawPath(h, { webRtcSessionId: 7 });
            } catch (error) {
                thrown = error;
            }
            expect(drops).to.deep.equal(["registry", "tracking"]);
            expect(thrown).to.not.equal(undefined);
        } finally {
            await h.close();
        }
    });

    it("keeps both local records when the EndSession fails for any other reason", async () => {
        const { drops, harness } = recordingHarness({
            invoke: async () => {
                throw new StatusResponseError("busy", Status.Busy);
            },
        });
        const h = await harness;
        try {
            let thrown: unknown;
            try {
                await endSessionOnRawPath(h, { webRtcSessionId: 7 });
            } catch (error) {
                thrown = error;
            }
            expect(drops).to.deep.equal([]);
            expect(thrown).to.not.equal(undefined);
        } finally {
            await h.close();
        }
    });

    // The spellings camelize maps to webRtcSessionId that a client plausibly sends.
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

describe("WebSocket camera_start_stream signalling order", () => {
    const STARTED = { node_id: 1, endpoint_id: 1, stream_usage: "LiveView" };
    const SESSION = 5;

    function callback(webRtcSessionId: number, eventType: string) {
        return { webrtc_session_id: webRtcSessionId, node_id: 1, endpoint_id: 1, event_type: eventType, data: null };
    }

    /** Responses (by message id) and `webrtc_callback` events (by session and type) in arrival order. */
    function collectOrder(ws: WebSocket): string[] {
        const seen = new Array<string>();
        ws.on("message", raw => {
            const msg = JSON.parse(raw.toString()) as {
                event?: string;
                message_id?: string;
                error_code?: number;
                data?: { webrtc_session_id?: number; event_type?: string };
            };
            if (msg.event === "webrtc_callback") seen.push(`${msg.data?.event_type}:${msg.data?.webrtc_session_id}`);
            else if (msg.event === "camera_session_ended")
                seen.push(`camera_session_ended:${msg.data?.webrtc_session_id}`);
            else if (msg.message_id !== undefined) seen.push(msg.error_code === undefined ? "response" : "error");
        });
        return seen;
    }

    /**
     * A harness whose `camera_start_stream` hands out {@link SESSION}, owned by the starting connection,
     * then waits for `proceed` before it answers.
     */
    async function startingHarness(outcome: "succeeds" | "fails") {
        const owners = new Map<number, string>();
        let reachedCamera = () => {};
        const atCamera = new Promise<void>(resolve => {
            reachedCamera = resolve;
        });
        let proceed = () => {};
        const proceeding = new Promise<void>(resolve => {
            proceed = resolve;
        });
        const sessionEnded = new Observable<[CameraSessionEnded]>();
        const h = await createHarness({
            async releaseConnection() {},
            events: { sessionEnded, streamEvicted: new Observable<[CameraStreamEvicted]>() },
            signallingOwner: (_nodeId, _endpointId, webRtcSessionId) => {
                const owner = owners.get(webRtcSessionId);
                return owner === undefined ? undefined : { connectionId: owner };
            },
            async startStream(args) {
                owners.set(SESSION, args.connectionId);
                args.sessionEstablishing?.(SESSION);
                reachedCamera();
                await proceeding;
                if (outcome === "fails") {
                    owners.delete(SESSION);
                    throw new Error("the camera ended the session before it was tracked");
                }
                return { webRtcSessionId: SESSION, mode: "provide_offer", talkback: false };
            },
        });
        return { h, owners, atCamera, proceed, sessionEnded };
    }

    async function settle(): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    it("sends the session's events after the response, in the order they arrived", async () => {
        const { h, atCamera, proceed } = await startingHarness("succeeds");
        try {
            const ws = await h.openClient();
            try {
                const order = collectOrder(ws);
                const started = h.sendOn(ws, "camera_start_stream", STARTED);
                await atCamera;
                h.emitWebRtcCallback(callback(SESSION, "answer"));
                h.emitWebRtcCallback(callback(SESSION, "ice_candidates"));
                await settle();
                expect(order).to.deep.equal([]);

                proceed();
                await started;
                await settle();
                expect(order).to.deep.equal(["response", `answer:${SESSION}`, `ice_candidates:${SESSION}`]);

                h.emitWebRtcCallback(callback(SESSION, "ice_candidates"));
                await settle();
                expect(order.at(-1)).to.equal(`ice_candidates:${SESSION}`);
                expect(order).to.have.length(4);
            } finally {
                ws.close();
            }
        } finally {
            proceed();
            await h.close();
        }
    });

    it("sends a camera_session_ended for the starting session after the response too", async () => {
        const { h, owners, atCamera, proceed, sessionEnded } = await startingHarness("succeeds");
        try {
            const ws = await h.openClient();
            try {
                const order = collectOrder(ws);
                const started = h.sendOn(ws, "camera_start_stream", STARTED);
                await atCamera;
                sessionEnded.emit({
                    nodeId: NodeId(1n),
                    endpointId: EndpointNumber(1),
                    webRtcSessionId: SESSION,
                    ownerId: owners.get(SESSION),
                    cause: "peer",
                });
                await settle();
                expect(order).to.deep.equal([]);

                proceed();
                await started;
                await settle();
                expect(order).to.deep.equal(["response", `camera_session_ended:${SESSION}`]);
            } finally {
                ws.close();
            }
        } finally {
            proceed();
            await h.close();
        }
    });

    it("drops the held events with an error response and holds nothing afterwards", async () => {
        const { h, atCamera, proceed } = await startingHarness("fails");
        try {
            const ws = await h.openClient();
            try {
                const order = collectOrder(ws);
                const started = h.sendOn(ws, "camera_start_stream", STARTED).then(
                    () => "resolved",
                    () => "rejected",
                );
                await atCamera;
                h.emitWebRtcCallback(callback(SESSION, "end"));
                proceed();
                expect(await started).to.equal("rejected");
                await settle();
                expect(order).to.deep.equal(["error"]);

                // Now ownerless, so it is broadcast; a hold left behind would swallow it.
                h.emitWebRtcCallback(callback(SESSION, "answer"));
                await settle();
                expect(order).to.deep.equal(["error", `answer:${SESSION}`]);
            } finally {
                ws.close();
            }
        } finally {
            proceed();
            await h.close();
        }
    });

    it("holds nothing for other sessions or other connections while a start is in flight", async () => {
        const { h, owners, atCamera, proceed } = await startingHarness("succeeds");
        try {
            const starter = await h.openClient();
            const other = await h.openClient();
            try {
                const starterOrder = collectOrder(starter);
                const otherOrder = collectOrder(other);
                // Opts in even though the stub refuses it.
                await h
                    .sendOn(other, "send_webrtc_provider_command", {
                        node_id: 1,
                        endpoint_id: 1,
                        command_name: "ProvideIceCandidates",
                        payload: { webRtcSessionId: 9, iceCandidates: [] },
                    })
                    .catch(() => undefined);
                otherOrder.length = 0;
                const started = h.sendOn(starter, "camera_start_stream", STARTED);
                await atCamera;
                // A session the starting connection already has.
                owners.set(3, owners.get(SESSION) ?? "");

                h.emitWebRtcCallback(callback(3, "ice_candidates"));
                h.emitWebRtcCallback(callback(9, "offer"));
                h.emitWebRtcCallback(callback(SESSION, "answer"));
                // The same id on another endpoint is another provider's session.
                h.emitWebRtcCallback({ ...callback(SESSION, "end"), endpoint_id: 2 });
                await settle();
                expect(starterOrder).to.deep.equal(["ice_candidates:3", "offer:9", `end:${SESSION}`]);
                expect(otherOrder).to.deep.equal(["offer:9"]);

                proceed();
                await started;
                await settle();
                expect(starterOrder).to.deep.equal([
                    "ice_candidates:3",
                    "offer:9",
                    `end:${SESSION}`,
                    "response",
                    `answer:${SESSION}`,
                ]);
                expect(otherOrder).to.deep.equal(["offer:9"]);
            } finally {
                starter.close();
                other.close();
            }
        } finally {
            proceed();
            await h.close();
        }
    });
});

describe("WebSocket camera_start_stream arguments", () => {
    it("forwards allow_eviction to the stream manager", async () => {
        const stated = new Array<boolean | undefined>();
        const h = await createHarness({
            async releaseConnection() {},
            async startStream(args: { connectionId: string; allowEviction?: boolean }) {
                stated.push(args.allowEviction);
                return { webRtcSessionId: 1, mode: "solicit_offer", talkback: false };
            },
        });
        try {
            const client = await h.openClient();
            try {
                const base = { node_id: 1, endpoint_id: 1, stream_usage: "LiveView" };
                await h.sendOn(client, "camera_start_stream", { ...base, allow_eviction: false });
                await h.sendOn(client, "camera_start_stream", base);
                expect(stated).to.deep.equal([false, undefined]);
            } finally {
                client.close();
            }
        } finally {
            await h.close();
        }
    });
});

describe("WebSocket camera_start_stream talkback", () => {
    it("forwards talkback to the stream manager and reports the manager's verdict", async () => {
        const stated = new Array<boolean | undefined>();
        const h = await createHarness({
            async releaseConnection() {},
            async startStream(args: { connectionId: string; talkback?: boolean }) {
                stated.push(args.talkback);
                return { webRtcSessionId: 1, mode: "provide_offer", talkback: args.talkback === true };
            },
        });
        try {
            const client = await h.openClient();
            try {
                const base = { node_id: 1, endpoint_id: 1, stream_usage: "LiveView", sdp: "v=0" };
                const asked = await h.sendOn<{ talkback: boolean }>(client, "camera_start_stream", {
                    ...base,
                    talkback: true,
                });
                const unasked = await h.sendOn<{ talkback: boolean }>(client, "camera_start_stream", base);
                expect(stated).to.deep.equal([true, undefined]);
                expect(asked.talkback).to.equal(true);
                expect(unasked.talkback).to.equal(false);
            } finally {
                client.close();
            }
        } finally {
            await h.close();
        }
    });
});

describe("WebSocket camera_release_stream response", () => {
    it("answers null, because a failure throws and a success has nothing to state", async () => {
        const released = new Array<number>();
        const h = await createHarness({
            async releaseConnection() {},
            async releaseStream(args: { streamId: number }) {
                released.push(args.streamId);
            },
        });
        try {
            const answer = await answerTo(h, {
                message_id: "release",
                command: "camera_release_stream",
                args: { node_id: 1, endpoint_id: 1, kind: "video", stream_id: 4 },
            });
            expect(answer.error_code).to.equal(undefined);
            expect(answer.result).to.equal(null);
            expect(released).to.deep.equal([4]);
        } finally {
            await h.close();
        }
    });
});

describe("WebSocket camera_snapshot arguments", () => {
    it("forwards the overlay arguments to the stream manager", async () => {
        const stated = new Array<{ watermarkEnabled?: boolean; osdEnabled?: boolean }>();
        const h = await createHarness({
            async releaseConnection() {},
            async snapshot(args: { watermarkEnabled?: boolean; osdEnabled?: boolean }) {
                stated.push({ watermarkEnabled: args.watermarkEnabled, osdEnabled: args.osdEnabled });
                return {
                    data: new Uint8Array([1]),
                    imageCodec: 0,
                    resolution: { width: 640, height: 480 },
                    degraded: false,
                    snapshotStreamId: 3,
                };
            },
        });
        try {
            const client = await h.openClient();
            try {
                const base = { node_id: 1, endpoint_id: 1 };
                await h.sendOn(client, "camera_snapshot", { ...base, watermark_enabled: true, osd_enabled: false });
                await h.sendOn(client, "camera_snapshot", base);
                expect(stated).to.deep.equal([
                    { watermarkEnabled: true, osdEnabled: false },
                    { watermarkEnabled: undefined, osdEnabled: undefined },
                ]);
            } finally {
                client.close();
            }
        } finally {
            await h.close();
        }
    });
});

describe("WebSocket camera_snapshot resolution target", () => {
    it("forwards resolution and max_resolution to the stream manager as separate arguments", async () => {
        const stated = new Array<{ resolution?: unknown; maxResolution?: unknown }>();
        const h = await createHarness({
            async releaseConnection() {},
            async snapshot(args: { resolution?: unknown; maxResolution?: unknown }) {
                stated.push({ resolution: args.resolution, maxResolution: args.maxResolution });
                return {
                    data: new Uint8Array([1]),
                    imageCodec: 0,
                    resolution: { width: 320, height: 240 },
                    degraded: false,
                    snapshotStreamId: 3,
                };
            },
        });
        try {
            const client = await h.openClient();
            try {
                await h.sendOn(client, "camera_snapshot", {
                    node_id: 1,
                    endpoint_id: 1,
                    resolution: { width: 320 },
                    max_resolution: { width: 1280, height: 720 },
                });
                expect(stated).to.deep.equal([
                    { resolution: { width: 320 }, maxResolution: { width: 1280, height: 720 } },
                ]);
            } finally {
                client.close();
            }
        } finally {
            await h.close();
        }
    });
});

describe("WebSocket camera session cleanup on disconnect", () => {
    it("releases camera sessions owned by the connection that closed, and no others", async () => {
        const released = new Array<string>();
        const owners = new Array<string>();
        const h = await createHarness({
            async releaseConnection(connectionId: string) {
                released.push(connectionId);
            },
            async startStream(args: { connectionId: string }) {
                owners.push(args.connectionId);
                return { webRtcSessionId: 1, mode: "solicit_offer", talkback: false };
            },
        });
        try {
            const closing = await h.openClient();
            const staysOpen = await h.openClient();
            try {
                // Both connections start a stream, so releasing the wrong one would show.
                for (const client of [closing, staysOpen]) {
                    await h.sendOn(client, "camera_start_stream", {
                        node_id: 1,
                        endpoint_id: 1,
                        stream_usage: "LiveView",
                    });
                }
                const [closingConnectionId, otherConnectionId] = owners;
                expect(owners).to.have.lengthOf(2);
                expect(closingConnectionId).to.not.equal(otherConnectionId);
                // The owner key is a counter that never repeats, not the four-hex log tag, which wraps.
                expect(closingConnectionId).to.match(/^conn-\d+$/);

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

describe("WebSocket camera lifecycle events", () => {
    /** Every camera event frame a connection received, in arrival order. */
    function collectCameraEvents(ws: WebSocket): Array<{ event: string; data: Record<string, unknown> }> {
        const seen = new Array<{ event: string; data: Record<string, unknown> }>();
        ws.on("message", raw => {
            const msg = JSON.parse(raw.toString()) as { event?: string; data?: Record<string, unknown> };
            if (msg.event === "camera_session_ended" || msg.event === "camera_stream_evicted") {
                seen.push({ event: msg.event, data: msg.data ?? {} });
            }
        });
        return seen;
    }

    const STARTED = { node_id: 1, endpoint_id: 1, stream_usage: "LiveView" };

    /** A harness whose `camera_stop_stream` announces what the real manager's release path announces. */
    async function harnessWithStopAnnouncing(): Promise<{
        h: TestHarness;
        sessionEnded: Observable<[CameraSessionEnded]>;
        streamEvicted: Observable<[CameraStreamEvicted]>;
    }> {
        const sessionEnded = new Observable<[CameraSessionEnded]>();
        const streamEvicted = new Observable<[CameraStreamEvicted]>();
        const ownerBySession = new Map<number, string>();
        let nextSessionId = 1;
        const h = await createHarness({
            async releaseConnection() {},
            events: { sessionEnded, streamEvicted },
            async startStream(args: { connectionId: string }) {
                const webRtcSessionId = nextSessionId++;
                ownerBySession.set(webRtcSessionId, args.connectionId);
                return { webRtcSessionId, mode: "solicit_offer", talkback: false };
            },
            // The registry announces every release, naming the session's owner and the connection that
            // asked; an id it holds no record of names only the asking connection.
            async stopStream(nodeId: bigint, endpointId: number, webRtcSessionId: number, requestedBy?: string) {
                sessionEnded.emit({
                    nodeId: NodeId(nodeId),
                    endpointId: EndpointNumber(endpointId),
                    webRtcSessionId,
                    ownerId: ownerBySession.get(webRtcSessionId),
                    cause: "other_connection",
                    requestedBy,
                });
                return true;
            },
        });
        return { h, sessionEnded, streamEvicted };
    }

    it("tells the connection that started a session that another connection ended it", async () => {
        const { h } = await harnessWithStopAnnouncing();
        try {
            const owner = await h.openClient();
            const other = await h.openClient();
            const uninvolved = await h.openClient();
            try {
                const seenByOwner = collectCameraEvents(owner);
                const seenByOther = collectCameraEvents(other);
                const seenByUninvolved = collectCameraEvents(uninvolved);

                const session = await h.sendOn<{ webrtc_session_id: number }>(owner, "camera_start_stream", STARTED);
                // Both are camera-aware, so ownership, not the opt-in, is what withholds the event.
                await h.sendOn(other, "camera_start_stream", STARTED);
                await h.sendOn(uninvolved, "camera_start_stream", STARTED);

                const stopped = await h.sendOn<{ ended: boolean }>(other, "camera_stop_stream", {
                    node_id: 1,
                    endpoint_id: 1,
                    webrtc_session_id: session.webrtc_session_id,
                });
                expect(stopped.ended).to.equal(true);
                await new Promise(resolve => setTimeout(resolve, 100));

                expect(seenByOwner).to.deep.equal([
                    {
                        event: "camera_session_ended",
                        data: {
                            node_id: 1,
                            endpoint_id: 1,
                            webrtc_session_id: session.webrtc_session_id,
                            cause: "other_connection",
                        },
                    },
                ]);
                expect(seenByOther).to.deep.equal([]);
                expect(seenByUninvolved).to.deep.equal([]);
            } finally {
                owner.close();
                other.close();
                uninvolved.close();
            }
        } finally {
            await h.close();
        }
    });

    it("tells no connection about a session it ended itself", async () => {
        // The response to its own camera_stop_stream already answers it.
        const { h } = await harnessWithStopAnnouncing();
        try {
            const owner = await h.openClient();
            try {
                const seenByOwner = collectCameraEvents(owner);
                const session = await h.sendOn<{ webrtc_session_id: number }>(owner, "camera_start_stream", STARTED);
                await h.sendOn(owner, "camera_stop_stream", {
                    node_id: 1,
                    endpoint_id: 1,
                    webrtc_session_id: session.webrtc_session_id,
                });
                await new Promise(resolve => setTimeout(resolve, 100));
                expect(seenByOwner).to.deep.equal([]);
            } finally {
                owner.close();
            }
        } finally {
            await h.close();
        }
    });

    /**
     * A harness whose raw `device_command` EndSession announces what the real manager announces.
     * `invoke` stands in for the camera's answer, so a test can make it refuse.
     */
    async function harnessWithRawEndAnnouncing(invoke?: () => Promise<unknown>): Promise<TestHarness> {
        const sessionEnded = new Observable<[CameraSessionEnded]>();
        const streamEvicted = new Observable<[CameraStreamEvicted]>();
        const ownerBySession = new Map<number, string>();
        let nextSessionId = 1;
        return createHarness(
            {
                async releaseConnection() {},
                events: { sessionEnded, streamEvicted },
                async startStream(args: { connectionId: string }) {
                    const webRtcSessionId = nextSessionId++;
                    ownerBySession.set(webRtcSessionId, args.connectionId);
                    return { webRtcSessionId, mode: "solicit_offer", talkback: false };
                },
                // What the manager does for a client's own EndSession: an entry it holds is announced to
                // that session's owner, and an id no entry names is announced with no owner unless the
                // camera denied the session.
                async endSessionForClient(nodeId, endpointId, webRtcSessionId, requestedBy, send) {
                    const announce = (deviceHeldSession: boolean) => {
                        const ownerId = ownerBySession.get(webRtcSessionId);
                        if (ownerId === undefined && !deviceHeldSession) return;
                        ownerBySession.delete(webRtcSessionId);
                        sessionEnded.emit({
                            nodeId: NodeId(nodeId),
                            endpointId: EndpointNumber(endpointId),
                            webRtcSessionId,
                            ownerId,
                            cause: "other_connection",
                            requestedBy,
                        });
                    };
                    try {
                        const response = await send();
                        announce(true);
                        return response;
                    } catch (error) {
                        if (error instanceof StatusResponseError && error.code === Status.NotFound) announce(false);
                        throw error;
                    }
                },
            },
            invoke === undefined ? undefined : { handleInvoke: invoke },
        );
    }

    async function endSessionThroughDeviceCommand(
        h: TestHarness,
        ws: WebSocket,
        webRtcSessionId: number,
    ): Promise<void> {
        await h.sendOn(ws, "device_command", {
            node_id: 1,
            endpoint_id: 1,
            cluster_id: WebRtcTransportProvider.id,
            command_name: "EndSession",
            payload: { webRtcSessionId },
        });
    }

    it("tells the connection that started a session that another connection ended it with a raw EndSession", async () => {
        // device_command reaches the manager's records without going through camera_stop_stream.
        const h = await harnessWithRawEndAnnouncing();
        try {
            const owner = await h.openClient();
            const other = await h.openClient();
            try {
                const seenByOwner = collectCameraEvents(owner);
                const seenByOther = collectCameraEvents(other);
                const session = await h.sendOn<{ webrtc_session_id: number }>(owner, "camera_start_stream", STARTED);
                await h.sendOn(other, "camera_start_stream", STARTED);

                await endSessionThroughDeviceCommand(h, other, session.webrtc_session_id);
                await new Promise(resolve => setTimeout(resolve, 100));

                expect(seenByOwner).to.deep.equal([
                    {
                        event: "camera_session_ended",
                        data: {
                            node_id: 1,
                            endpoint_id: 1,
                            webrtc_session_id: session.webrtc_session_id,
                            cause: "other_connection",
                        },
                    },
                ]);
                expect(seenByOther).to.deep.equal([]);
            } finally {
                owner.close();
                other.close();
            }
        } finally {
            await h.close();
        }
    });

    it("tells a camera-aware connection about an untracked session a raw EndSession ended", async () => {
        // A raw-route session has no owner record, so it goes to everyone but the connection that ended it.
        const h = await harnessWithRawEndAnnouncing();
        try {
            const rawRouteClient = await h.openClient();
            const ender = await h.openClient();
            try {
                const seenByRawRouteClient = collectCameraEvents(rawRouteClient);
                const seenByEnder = collectCameraEvents(ender);
                await h
                    .sendOn(rawRouteClient, "send_webrtc_provider_command", {
                        node_id: 1,
                        endpoint_id: 1,
                        command_name: "ProvideOffer",
                        payload: { webRtcSessionId: null, sdp: "v=0" },
                    })
                    .catch(() => undefined);
                await h
                    .sendOn(rawRouteClient, "camera_get_capabilities", { node_id: 1, endpoint_id: 1 })
                    .catch(() => undefined);
                await h.sendOn(ender, "camera_get_capabilities", { node_id: 1, endpoint_id: 1 }).catch(() => undefined);

                await endSessionThroughDeviceCommand(h, ender, 99);
                await new Promise(resolve => setTimeout(resolve, 100));

                expect(seenByRawRouteClient).to.deep.equal([
                    {
                        event: "camera_session_ended",
                        data: { node_id: 1, endpoint_id: 1, webrtc_session_id: 99, cause: "other_connection" },
                    },
                ]);
                expect(seenByEnder).to.deep.equal([]);
            } finally {
                rawRouteClient.close();
                ender.close();
            }
        } finally {
            await h.close();
        }
    });

    it("tells nobody about an untracked id the camera denies, which named no session at all", async () => {
        // The camera says the session never existed, so there is nothing to announce.
        const h = await harnessWithRawEndAnnouncing(async () => {
            throw new StatusResponseError("no such session", Status.NotFound);
        });
        try {
            const watcher = await h.openClient();
            const ender = await h.openClient();
            try {
                const seenByWatcher = collectCameraEvents(watcher);
                await h
                    .sendOn(watcher, "camera_get_capabilities", { node_id: 1, endpoint_id: 1 })
                    .catch(() => undefined);
                await endSessionThroughDeviceCommand(h, ender, 99).catch(() => undefined);
                await new Promise(resolve => setTimeout(resolve, 100));
                expect(seenByWatcher).to.deep.equal([]);
            } finally {
                watcher.close();
                ender.close();
            }
        } finally {
            await h.close();
        }
    });

    it("tells no connection about a session it ended itself with a raw EndSession", async () => {
        const h = await harnessWithRawEndAnnouncing();
        try {
            const owner = await h.openClient();
            try {
                const seenByOwner = collectCameraEvents(owner);
                const session = await h.sendOn<{ webrtc_session_id: number }>(owner, "camera_start_stream", STARTED);
                await endSessionThroughDeviceCommand(h, owner, session.webrtc_session_id);
                await new Promise(resolve => setTimeout(resolve, 100));
                expect(seenByOwner).to.deep.equal([]);
            } finally {
                owner.close();
            }
        } finally {
            await h.close();
        }
    });

    it("tells a raw-route client about a session with no owner, and every camera-aware connection about an eviction", async () => {
        const { h, sessionEnded, streamEvicted } = await harnessWithStopAnnouncing();
        try {
            const raw = await h.openClient();
            const bystander = await h.openClient();
            try {
                const seenByRaw = collectCameraEvents(raw);
                const seenByBystander = collectCameraEvents(bystander);
                await h.sendOn(raw, "camera_get_capabilities", { node_id: 1, endpoint_id: 1 }).catch(() => undefined);

                sessionEnded.emit({
                    nodeId: NodeId(1n),
                    endpointId: EndpointNumber(1),
                    webRtcSessionId: 4,
                    cause: "other_connection",
                    requestedBy: "conn-elsewhere",
                });
                streamEvicted.emit({
                    nodeId: NodeId(1n),
                    endpointId: EndpointNumber(1),
                    kind: "video",
                    streamId: 2,
                });
                await new Promise(resolve => setTimeout(resolve, 100));

                expect(seenByRaw).to.deep.equal([
                    {
                        event: "camera_session_ended",
                        data: { node_id: 1, endpoint_id: 1, webrtc_session_id: 4, cause: "other_connection" },
                    },
                    {
                        event: "camera_stream_evicted",
                        data: { node_id: 1, endpoint_id: 1, kind: "video", stream_id: 2 },
                    },
                ]);
                // A connection that issued no camera command may not know the event types.
                expect(seenByBystander).to.deep.equal([]);
            } finally {
                raw.close();
                bystander.close();
            }
        } finally {
            await h.close();
        }
    });
});

describe("WebSocket camera session end causes", () => {
    function sessionEndedFrames(ws: WebSocket): Array<Record<string, unknown>> {
        const seen = new Array<Record<string, unknown>>();
        ws.on("message", raw => {
            const msg = JSON.parse(raw.toString()) as { event?: string; data?: Record<string, unknown> };
            if (msg.event === "camera_session_ended") seen.push(msg.data ?? {});
        });
        return seen;
    }

    it("sends the cause and the camera's reason, and never a release this server made", async () => {
        const sessionEnded = new Observable<[CameraSessionEnded]>();
        const streamEvicted = new Observable<[CameraStreamEvicted]>();
        const h = await createHarness({ async releaseConnection() {}, events: { sessionEnded, streamEvicted } });
        try {
            const client = await h.openClient();
            try {
                const frames = sessionEndedFrames(client);
                await h
                    .sendOn(client, "camera_get_capabilities", { node_id: 1, endpoint_id: 1 })
                    .catch(() => undefined);
                const session = { nodeId: NodeId(1n), endpointId: EndpointNumber(1), webRtcSessionId: 4 };

                sessionEnded.emit({ ...session, cause: "released" });
                sessionEnded.emit({ ...session, cause: "peer", reason: 9 });
                sessionEnded.emit({ ...session, cause: "camera_dropped" });
                await new Promise(resolve => setTimeout(resolve, 100));

                expect(frames).to.deep.equal([
                    { node_id: 1, endpoint_id: 1, webrtc_session_id: 4, cause: "peer", reason: 9 },
                    { node_id: 1, endpoint_id: 1, webrtc_session_id: 4, cause: "camera_dropped" },
                ]);
            } finally {
                client.close();
            }
        } finally {
            await h.close();
        }
    });

    it("tells the camera manager the id a send_webrtc_provider_command session got", async () => {
        const issued = new Array<string>();
        const h = await createHarness(
            {
                async releaseConnection() {},
                sessionIdIssued(nodeId, endpointId, webRtcSessionId) {
                    issued.push(`${nodeId}/${endpointId}/${webRtcSessionId}`);
                },
            },
            {
                async invokeWebRtcProviderCommand(args) {
                    args.sessionEstablishing?.(5);
                    return { webRtcSessionId: 5 };
                },
            },
        );
        try {
            await h.handle("send_webrtc_provider_command", {
                node_id: 1,
                endpoint_id: 1,
                command_name: "ProvideOffer",
                payload: { webRtcSessionId: null, sdp: "v=0" },
            });
            expect(issued).to.deep.equal(["1/1/5"]);
        } finally {
            await h.close();
        }
    });
});

describe("WebSocket camera event opt-in", () => {
    it("does not send schema-14 camera events to a connection that only used send_webrtc_provider_command", async () => {
        // A schema-12 client cannot parse these events.
        const sessionEnded = new Observable<[CameraSessionEnded]>();
        const streamEvicted = new Observable<[CameraStreamEvicted]>();
        const h = await createHarness({ async releaseConnection() {}, events: { sessionEnded, streamEvicted } });
        try {
            const raw = await h.openClient();
            try {
                const events = new Array<string>();
                raw.on("message", message => {
                    const msg = JSON.parse(message.toString()) as { event?: string };
                    if (msg.event !== undefined) events.push(msg.event);
                });
                await h
                    .sendOn(raw, "send_webrtc_provider_command", {
                        node_id: 1,
                        endpoint_id: 1,
                        command_name: "ProvideOffer",
                        payload: { webRtcSessionId: null, sdp: "v=0" },
                    })
                    .catch(() => undefined);
                sessionEnded.emit({
                    nodeId: NodeId(1n),
                    endpointId: EndpointNumber(1),
                    webRtcSessionId: 4,
                    cause: "other_connection",
                    requestedBy: "conn-elsewhere",
                });
                streamEvicted.emit({ nodeId: NodeId(1n), endpointId: EndpointNumber(1), kind: "video", streamId: 2 });
                await new Promise(resolve => setTimeout(resolve, 100));
                expect(events).to.not.include("camera_session_ended");
                expect(events).to.not.include("camera_stream_evicted");
            } finally {
                raw.close();
            }
        } finally {
            await h.close();
        }
    });
});

describe("WebSocket camera signalling routing", () => {
    it("delivers each connection only the signalling of the session it owns", async () => {
        const ownerBySession = new Map<number, string>();
        let nextSessionId = 1;
        const h = await createHarness({
            async releaseConnection() {},
            async startStream(args: { connectionId: string }) {
                const webRtcSessionId = nextSessionId++;
                ownerBySession.set(webRtcSessionId, args.connectionId);
                return { webRtcSessionId, mode: "solicit_offer", talkback: false };
            },
            // What the real manager answers: the connection whose camera_start_stream established the
            // session, and nothing for a session it holds no record of.
            signallingOwner(nodeId, _endpointId, webRtcSessionId) {
                // Pins the branded NodeId; the registry's own key would match a plain number by chance.
                if (typeof nodeId !== "bigint") return undefined;
                const owner = ownerBySession.get(webRtcSessionId);
                return owner === undefined ? undefined : { connectionId: owner };
            },
        });
        const started = { node_id: 1, endpoint_id: 1, stream_usage: "LiveView" };
        try {
            const first = await h.openClient();
            const second = await h.openClient();
            try {
                const seenByFirst = new Array<number>();
                const seenBySecond = new Array<number>();
                const collect = (ws: WebSocket, into: number[]) =>
                    ws.on("message", raw => {
                        const msg = JSON.parse(raw.toString()) as {
                            event?: string;
                            data?: { webrtc_session_id?: number };
                        };
                        if (msg.event === "webrtc_callback" && msg.data?.webrtc_session_id !== undefined) {
                            into.push(msg.data.webrtc_session_id);
                        }
                    });
                collect(first, seenByFirst);
                collect(second, seenBySecond);

                // With one connection, the filter could not be told from no filter.
                const ours = await h.sendOn<{ webrtc_session_id: number }>(first, "camera_start_stream", started);
                const theirs = await h.sendOn<{ webrtc_session_id: number }>(second, "camera_start_stream", started);
                expect(ours.webrtc_session_id).to.not.equal(theirs.webrtc_session_id);

                const UNOWNED_SESSION = 99;
                for (const webrtc_session_id of [ours.webrtc_session_id, theirs.webrtc_session_id, UNOWNED_SESSION]) {
                    h.emitWebRtcCallback({
                        webrtc_session_id,
                        node_id: 1,
                        endpoint_id: 1,
                        event_type: "answer",
                        data: null,
                    });
                }
                await new Promise(resolve => setTimeout(resolve, 100));

                expect(seenByFirst).to.deep.equal([ours.webrtc_session_id, UNOWNED_SESSION]);
                expect(seenBySecond).to.deep.equal([theirs.webrtc_session_id, UNOWNED_SESSION]);
            } finally {
                first.close();
                second.close();
            }
        } finally {
            await h.close();
        }
    });
});

describe("WebSocket webrtc_callback opt-in", () => {
    const SIGNALLING_ARGS = {
        camera_provide_answer: { webrtc_session_id: 4, sdp: "v=0" },
        camera_provide_ice_candidates: {
            webrtc_session_id: 4,
            ice_candidates: [{ candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0 }],
        },
    };

    for (const command of ["camera_provide_answer", "camera_provide_ice_candidates"] as const) {
        it(`opts the connection in to webrtc_callback when it issues ${command}`, async () => {
            // A client that only signals for a session still needs the camera's half of it.
            const h = await createHarness();
            try {
                const ws = await h.openClient();
                try {
                    const events = new Array<string>();
                    ws.on("message", raw => {
                        const msg = JSON.parse(raw.toString()) as { event?: string };
                        if (msg.event !== undefined) events.push(msg.event);
                    });
                    // The stub throws for every provider invoke; the opt-in must not depend on the outcome.
                    await h
                        .sendOn(ws, command, { node_id: 1, endpoint_id: 1, ...SIGNALLING_ARGS[command] })
                        .catch(() => undefined);
                    h.emitWebRtcCallback({
                        webrtc_session_id: 4,
                        node_id: 1,
                        endpoint_id: 1,
                        event_type: "answer",
                        data: null,
                    });
                    await new Promise(resolve => setTimeout(resolve, 50));
                    expect(events).to.include("webrtc_callback");
                } finally {
                    ws.close();
                }
            } finally {
                await h.close();
            }
        });
    }
});

describe("WebSocket camera command arguments", () => {
    const CAMERA_COMMANDS = [
        "camera_get_capabilities",
        "camera_start_stream",
        "camera_stop_stream",
        "camera_snapshot",
        "camera_release_stream",
        "camera_provide_answer",
        "camera_provide_ice_candidates",
        // Not one of the camera commands, but the same route family and the same argument walk.
        "send_webrtc_provider_command",
    ] as const;

    for (const command of CAMERA_COMMANDS) {
        // A missing or null `args` becomes an empty argument set, so the command's required argument refuses it.
        const missingArgument =
            command === "send_webrtc_provider_command" ? "requires command_name" : "numeric or bigint node_id";

        it(`refuses ${command} with error 8 when the message states no args`, async () => {
            const h = await createHarness();
            try {
                const answer = await answerTo(h, { message_id: "no-args", command });
                expect(answer.error_code).to.equal(8);
                expect(answer.details).to.contain(command);
                expect(answer.details).to.contain(missingArgument);
            } finally {
                await h.close();
            }
        });

        it(`refuses ${command} with error 8 when args is null`, async () => {
            const h = await createHarness();
            try {
                const answer = await answerTo(h, { message_id: "null-args", command, args: null });
                expect(answer.error_code).to.equal(8);
                expect(answer.details).to.contain(command);
                expect(answer.details).to.contain(missingArgument);
            } finally {
                await h.close();
            }
        });

        it(`refuses ${command} with error 8 when args is not an object`, async () => {
            const h = await createHarness();
            try {
                const answer = await answerTo(h, { message_id: "string-args", command, args: "node_id=1" });
                expect(answer.error_code).to.equal(8);
                expect(answer.details).to.contain(command);
                // Not "unknown argument key: 0, 1, 2": a string's keys are its indices.
                expect(answer.details).to.contain("object of arguments");
            } finally {
                await h.close();
            }
        });
    }
});

describe("WebSocket generic command arguments", () => {
    // Stands for every generic command with a required argument; it reaches no device before refusing.
    const WITH_REQUIRED_ARGUMENT = "set_thread_dataset";

    for (const [what, args] of [
        ["states no args", undefined],
        ["states args as null", null],
    ] as const) {
        it(`answers ${WITH_REQUIRED_ARGUMENT} that ${what} with the argument's own error 8`, async () => {
            const h = await createHarness();
            try {
                const answer = await answerTo(h, {
                    message_id: what,
                    command: WITH_REQUIRED_ARGUMENT,
                    ...(args === undefined ? {} : { args }),
                });
                expect(answer.error_code).to.equal(8);
                expect(answer.details).to.contain("set_thread_dataset requires dataset");
            } finally {
                await h.close();
            }
        });
    }

    for (const [what, args] of [
        ["a string", "dataset=00"],
        ["a number", 42],
        ["an array", ["00"]],
    ] as const) {
        it(`refuses ${WITH_REQUIRED_ARGUMENT} with error 8 when args is ${what}`, async () => {
            const h = await createHarness();
            try {
                const answer = await answerTo(h, { message_id: what, command: WITH_REQUIRED_ARGUMENT, args });
                expect(answer.error_code).to.equal(8);
                expect(answer.details).to.contain(WITH_REQUIRED_ARGUMENT);
                expect(answer.details).to.contain("object of arguments");
            } finally {
                await h.close();
            }
        });
    }

    // set_loglevel takes only optional arguments and reads them by destructuring.
    it("answers a command whose arguments are all optional and whose message states none", async () => {
        const h = await createHarness();
        try {
            const before = await answerTo(h, { message_id: "levels-before", command: "get_loglevel" });
            const answer = await answerTo(h, { message_id: "no-args-needed", command: "set_loglevel" });
            expect(answer.error_code).to.equal(undefined);
            // An empty argument set states no level, so both levels are left as they were.
            expect(answer.result).to.deep.equal(before.result);
        } finally {
            await h.close();
        }
    });

    // A defaulted label would rename the fabric, persist it and claim the label for this connection.
    it("refuses a command whose required argument would otherwise be defaulted and written", async () => {
        const h = await createHarness();
        try {
            const labelBefore = h.config.fabricLabel;
            const answer = await answerTo(h, { message_id: "no-label", command: "set_default_fabric_label" });
            expect(answer.error_code).to.equal(8);
            expect(answer.details).to.contain("set_default_fabric_label requires label");
            expect(h.config.fabricLabel).to.equal(labelBefore);
            // The label is still free to claim, which a refused request must not have taken.
            const claimed = await answerTo(h, {
                message_id: "with-label",
                command: "set_default_fabric_label",
                args: { label: "Kitchen" },
            });
            expect(claimed.error_code).to.equal(undefined);
            expect(h.config.fabricLabel).to.equal("Kitchen");
        } finally {
            await h.close();
        }
    });

    // get_vendor_names also destructures `args` with no guard of its own.
    it("answers get_vendor_names when the message states no args", async () => {
        const h = await createHarness();
        try {
            const answer = await answerTo(h, { message_id: "vendors-no-args", command: "get_vendor_names" });
            expect(answer.error_code).to.equal(undefined);
            expect(answer.result).to.be.an("object");
        } finally {
            await h.close();
        }
    });

    // The shape is checked before the command is looked up, so a frame wrong in both ways answers 8, not 9.
    it("answers 8 for an unknown command whose args is not an object", async () => {
        const h = await createHarness();
        try {
            const answer = await answerTo(h, { message_id: "unknown-bad-args", command: "no_such_command", args: 1 });
            expect(answer.error_code).to.equal(8);
        } finally {
            await h.close();
        }
    });

    it("answers 9 for an unknown command whose args is an object", async () => {
        const h = await createHarness();
        try {
            const answer = await answerTo(h, { message_id: "unknown-ok-args", command: "no_such_command", args: {} });
            expect(answer.error_code).to.equal(9);
        } finally {
            await h.close();
        }
    });

    it("answers start_listening when the message states no args", async () => {
        const h = await createHarness();
        try {
            const answer = await answerTo(h, { message_id: "listen-no-args", command: "start_listening" });
            expect(answer.error_code).to.equal(undefined);
            expect(answer.result).to.be.an("array");
        } finally {
            await h.close();
        }
    });
});

describe("node id classes on the generic node-targeted commands", () => {
    // One per shape the node-only routes take: a read, two lookups, and a command that brands the id inline.
    const NODE_ONLY_ROUTES: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
        ["read_attribute", { attribute_path: "1/6/0" }],
        ["ping_node", {}],
        ["get_node", {}],
        ["set_acl_entry", { entry: {} }],
    ];

    /** The two routes matter.js can carry to a group; they refuse the rest of the classes. */
    const GROUP_CAPABLE_ROUTES: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
        ["write_attribute", { attribute_path: "1/6/0", value: 1 }],
        ["device_command", { endpoint_id: 1, cluster_id: 6, command_name: "toggle", payload: {} }],
    ];

    const GROUP_NODE_ID = NodeId.fromGroupId(1);

    // Every class that names no node, with the words the refusal must carry; they tell the branch from the
    // reserved fall-through.
    const UNUSABLE: ReadonlyArray<readonly [string, bigint, string]> = [
        ["the unspecified node id", NodeId.UNSPECIFIED_NODE_ID, "the Unspecified Node ID"],
        [
            "a CASE authenticated tag",
            NodeId.fromCaseAuthenticatedTag(CaseAuthenticatedTag(1)),
            "a CASE Authenticated Tag",
        ],
        ["a PAKE key identifier", NodeId.getFromPakeKeyIdentifier(1), "a PAKE key identifier"],
        ["a reserved node id", NodeId(0xffff_ffff_0000_0000n), "a reserved Node ID"],
    ];

    async function answerFor(
        h: TestHarness,
        command: string,
        args: Record<string, unknown>,
        tag: string,
    ): Promise<WireFrame> {
        return answerToFrameText(h, tag, toBigIntAwareJson({ message_id: tag, command, args }));
    }

    for (const [command, extraArgs] of [...NODE_ONLY_ROUTES, ...GROUP_CAPABLE_ROUTES]) {
        for (const [label, nodeId, namedClass] of UNUSABLE) {
            it(`refuses ${command} addressed to ${label} with error 8 naming the class`, async () => {
                const h = await createHarness();
                try {
                    const answer = await answerFor(
                        h,
                        command,
                        { node_id: nodeId, ...extraArgs },
                        `${command}-${namedClass}`,
                    );
                    expect(answer.error_code).to.equal(8);
                    expect(answer.details).to.contain(command);
                    expect(answer.details).to.contain(namedClass);
                } finally {
                    await h.close();
                }
            });
        }
    }

    for (const [command, extraArgs] of [...NODE_ONLY_ROUTES, ...GROUP_CAPABLE_ROUTES]) {
        it(`refuses ${command} addressed to the Null Group ID, which names no group`, async () => {
            const h = await createHarness();
            try {
                const answer = await answerFor(
                    h,
                    command,
                    { node_id: NodeId.fromGroupId(0), ...extraArgs },
                    `${command}-null-group`,
                );
                expect(answer.error_code).to.equal(8);
                expect(answer.details).to.contain("the Null Group ID");
            } finally {
                await h.close();
            }
        });
    }

    for (const [command, extraArgs] of NODE_ONLY_ROUTES) {
        it(`refuses ${command} addressed to a group node id, which names no single node`, async () => {
            const h = await createHarness();
            try {
                const answer = await answerFor(
                    h,
                    command,
                    { node_id: GROUP_NODE_ID, ...extraArgs },
                    `${command}-group`,
                );
                expect(answer.error_code).to.equal(8);
                expect(answer.details).to.contain("a Group Node ID");
                expect(answer.details).to.contain("must name one node");
            } finally {
                await h.close();
            }
        });
    }
});

describe("groupcast on the generic commands", () => {
    const GROUP_NODE_ID = NodeId.fromGroupId(1);

    async function answerFor(
        h: TestHarness,
        command: string,
        args: Record<string, unknown>,
        tag: string,
    ): Promise<WireFrame> {
        return answerToFrameText(h, tag, toBigIntAwareJson({ message_id: tag, command, args }));
    }

    it("routes write_attribute for a group node id to the groupcast path and answers null", async () => {
        const groupWrites = new Array<Record<string, unknown>>();
        const unicastWrites = new Array<unknown>();
        const h = await createHarness(undefined, {
            handleGroupWriteAttribute: async data => {
                groupWrites.push(data as Record<string, unknown>);
            },
            handleWriteAttribute: async data => {
                unicastWrites.push(data);
                return [];
            },
        });
        try {
            const answer = await answerFor(
                h,
                "write_attribute",
                { node_id: GROUP_NODE_ID, attribute_path: "*/6/16385", value: 5 },
                "group-write",
            );

            expect(answer.error_code).to.equal(undefined);
            // No node answers a groupcast, so there is no status to report.
            expect(answer.result).to.equal(null);
            expect(unicastWrites.length).to.equal(0);
            expect(groupWrites.length).to.equal(1);
            expect(groupWrites[0].nodeId).to.equal(GROUP_NODE_ID);
            expect(groupWrites[0].clusterId).to.equal(6);
            expect(groupWrites[0].attributeId).to.equal(16385);
            expect(groupWrites[0].value).to.equal(5);
            expect("endpointId" in groupWrites[0]).to.equal(false);
        } finally {
            await h.close();
        }
    });

    it("refuses write_attribute for a group node id that names an endpoint", async () => {
        const h = await createHarness(undefined, {
            handleGroupWriteAttribute: async () => {
                throw new Error("groupcast must not be reached");
            },
        });
        try {
            const answer = await answerFor(
                h,
                "write_attribute",
                { node_id: GROUP_NODE_ID, attribute_path: "1/6/16385", value: 5 },
                "group-write-endpoint",
            );
            expect(answer.error_code).to.equal(8);
            expect(answer.details).to.contain("wildcard endpoint");
        } finally {
            await h.close();
        }
    });

    for (const [label, path] of [
        ["attribute", "*/6/*"],
        ["cluster", "*/*/16385"],
    ] as const) {
        it(`still refuses a wildcard ${label} for a group node id`, async () => {
            const h = await createHarness(undefined, {
                handleGroupWriteAttribute: async () => {
                    throw new Error("groupcast must not be reached");
                },
            });
            try {
                const answer = await answerFor(
                    h,
                    "write_attribute",
                    { node_id: GROUP_NODE_ID, attribute_path: path, value: 5 },
                    `group-write-wildcard-${label}`,
                );
                expect(answer.error_code).to.equal(8);
                expect(answer.details).to.contain("wildcard");
            } finally {
                await h.close();
            }
        });
    }

    it("takes an explicitly null endpoint_id for a group node id", async () => {
        const groupInvokes = new Array<Record<string, unknown>>();
        const h = await createHarness(undefined, {
            handleGroupInvoke: async data => {
                groupInvokes.push(data as Record<string, unknown>);
            },
        });
        try {
            const answer = await answerFor(
                h,
                "device_command",
                { node_id: GROUP_NODE_ID, endpoint_id: null, cluster_id: 6, command_name: "toggle", payload: {} },
                "group-invoke-null-endpoint",
            );
            expect(answer.error_code).to.equal(undefined);
            expect(answer.result).to.equal(null);
            expect(groupInvokes.length).to.equal(1);
        } finally {
            await h.close();
        }
    });

    it("refuses an explicitly null endpoint_id for a node id that is not a group", async () => {
        const h = await createHarness();
        try {
            const answer = await answerFor(
                h,
                "device_command",
                { node_id: 1, endpoint_id: null, cluster_id: 6, command_name: "toggle", payload: {} },
                "unicast-invoke-null-endpoint",
            );
            expect(answer.error_code).to.equal(8);
            expect(answer.details).to.contain("requires endpoint_id");
        } finally {
            await h.close();
        }
    });

    it("passes timed_request_timeout_ms and interaction_timeout_ms of a device_command to handleInvoke", async () => {
        const invokes = new Array<InvokeRequest>();
        const h = await createHarness(undefined, {
            handleInvoke: async data => {
                invokes.push(data);
                return undefined;
            },
        });
        try {
            const answer = await answerFor(
                h,
                "device_command",
                {
                    node_id: 1,
                    endpoint_id: 1,
                    cluster_id: 6,
                    command_name: "toggle",
                    payload: {},
                    timed_request_timeout_ms: 1000,
                    interaction_timeout_ms: 5000,
                },
                "unicast-invoke-timeouts",
            );
            expect(answer.error_code).to.equal(undefined);
            expect(
                invokes.map(({ timedInteractionTimeoutMs, interactionTimeoutMs }) => ({
                    timedInteractionTimeoutMs,
                    interactionTimeoutMs,
                })),
            ).deep.equals([{ timedInteractionTimeoutMs: Millis(1000), interactionTimeoutMs: Millis(5000) }]);
        } finally {
            await h.close();
        }
    });

    for (const [name, stated, expected] of [
        // As in python-matter-server, 0 means no timed request.
        ["timed_request_timeout_ms", 0, undefined],
        ["timed_request_timeout_ms", 65_535, Millis(65_535)],
        ["timed_request_timeout_ms", null, undefined],
        ["interaction_timeout_ms", 0, Millis(0)],
        ["interaction_timeout_ms", Number.MAX_SAFE_INTEGER, Millis(Number.MAX_SAFE_INTEGER)],
        ["interaction_timeout_ms", null, undefined],
    ] as const) {
        it(`passes ${name} ${String(stated)} of a device_command on`, async () => {
            const invokes = new Array<InvokeRequest>();
            const h = await createHarness(undefined, {
                handleInvoke: async data => {
                    invokes.push(data);
                    return undefined;
                },
            });
            try {
                const answer = await answerFor(
                    h,
                    "device_command",
                    {
                        node_id: 1,
                        endpoint_id: 1,
                        cluster_id: 6,
                        command_name: "toggle",
                        payload: {},
                        [name]: stated,
                    },
                    `unicast-invoke-${name}-bound-${String(stated)}`,
                );
                expect(answer.error_code).to.equal(undefined);
                expect(
                    invokes.map(({ timedInteractionTimeoutMs, interactionTimeoutMs }) =>
                        name === "timed_request_timeout_ms" ? timedInteractionTimeoutMs : interactionTimeoutMs,
                    ),
                ).deep.equals([expected]);
            } finally {
                await h.close();
            }
        });
    }

    for (const [name, stated] of [
        ["timed_request_timeout_ms", -1],
        ["timed_request_timeout_ms", 1.5],
        ["timed_request_timeout_ms", "1000"],
        ["timed_request_timeout_ms", 65_536],
        ["interaction_timeout_ms", -1],
        ["interaction_timeout_ms", 1.5],
        ["interaction_timeout_ms", "5000"],
        ["interaction_timeout_ms", Number.MAX_SAFE_INTEGER + 1],
    ] as const) {
        it(`refuses ${name} ${JSON.stringify(stated)} on a device_command`, async () => {
            const h = await createHarness(undefined, {
                handleInvoke: async () => {
                    throw new Error("invoke must not be reached");
                },
            });
            try {
                const answer = await answerFor(
                    h,
                    "device_command",
                    {
                        node_id: 1,
                        endpoint_id: 1,
                        cluster_id: 6,
                        command_name: "toggle",
                        payload: {},
                        [name]: stated,
                    },
                    `unicast-invoke-${name}-${String(stated)}`,
                );
                expect(answer.error_code).to.equal(8);
                expect(answer.details).to.contain(name);
            } finally {
                await h.close();
            }
        });
    }

    // A wrong-type timeout converts to `undefined`, so the check must read the stated value.
    for (const [name, stated] of [
        ["timed_request_timeout_ms", 1000],
        ["timed_request_timeout_ms", "1000"],
        ["interaction_timeout_ms", 5000],
    ] as const) {
        it(`refuses ${name} stated as ${typeof stated} on a groupcast`, async () => {
            const h = await createHarness(undefined, {
                handleGroupInvoke: async () => {
                    throw new Error("groupcast must not be reached");
                },
            });
            try {
                const answer = await answerFor(
                    h,
                    "device_command",
                    {
                        node_id: GROUP_NODE_ID,
                        cluster_id: 6,
                        command_name: "toggle",
                        payload: {},
                        [name]: stated,
                    },
                    `group-invoke-${name}-${typeof stated}`,
                );
                expect(answer.error_code).to.equal(8);
                expect(answer.details).to.contain(name);
            } finally {
                await h.close();
            }
        });
    }

    it("answers a unicast write_attribute with the node's own status", async () => {
        const h = await createHarness(undefined, {
            handleWriteAttribute: async () => [{ endpointId: 1, clusterId: 6, attributeId: 16385, status: 0x86 }],
        });
        try {
            const answer = await answerFor(
                h,
                "write_attribute",
                { node_id: 1, attribute_path: "1/6/16385", value: 5 },
                "unicast-write",
            );
            expect(answer.error_code).to.equal(undefined);
            expect(answer.result).to.deep.equal([
                { Path: { EndpointId: 1, ClusterId: 6, AttributeId: 16385 }, Status: 0x86 },
            ]);
        } finally {
            await h.close();
        }
    });

    it("passes a wildcard endpoint of a unicast write_attribute on and answers per endpoint", async () => {
        const writes = new Array<unknown>();
        const h = await createHarness(undefined, {
            handleWriteAttribute: async data => {
                writes.push(data);
                return [
                    { endpointId: 1, clusterId: 6, attributeId: 16385, status: 0 },
                    { endpointId: 2, clusterId: 6, attributeId: 16385, status: 0x88 },
                ];
            },
        });
        try {
            const answer = await answerFor(
                h,
                "write_attribute",
                { node_id: 1, attribute_path: "*/6/16385", value: 5 },
                "unicast-write-wildcard-endpoint",
            );
            expect(answer.error_code).to.equal(undefined);
            expect(answer.result).to.deep.equal([
                { Path: { EndpointId: 1, ClusterId: 6, AttributeId: 16385 }, Status: 0 },
                { Path: { EndpointId: 2, ClusterId: 6, AttributeId: 16385 }, Status: 0x88 },
            ]);
            expect(writes).to.have.length(1);
            expect(writes[0]).to.have.property("endpointId", undefined);
        } finally {
            await h.close();
        }
    });

    for (const path of ["*/6/16385", "65535/6/16385"]) {
        it(`takes ${path} as a wildcard endpoint of a unicast write_attribute`, async () => {
            const writes = new Array<unknown>();
            const h = await createHarness(undefined, {
                handleWriteAttribute: async data => {
                    writes.push(data);
                    return [];
                },
            });
            try {
                const answer = await answerFor(
                    h,
                    "write_attribute",
                    { node_id: 1, attribute_path: path, value: 5 },
                    `unicast-write-wildcard-${path}`,
                );
                expect(answer.error_code).to.equal(undefined);
                expect(writes).to.have.length(1);
                expect(writes[0]).to.have.property("endpointId", undefined);
            } finally {
                await h.close();
            }
        });
    }

    for (const path of ["1x/6/16385", "null/6/16385", "None/6/16385", "/6/16385", "1/6/16385/x"]) {
        it(`refuses a unicast write_attribute with the malformed path ${JSON.stringify(path)}`, async () => {
            const h = await createHarness(undefined, {
                handleWriteAttribute: async () => {
                    throw new Error("write must not be reached");
                },
            });
            try {
                const answer = await answerFor(
                    h,
                    "write_attribute",
                    { node_id: 1, attribute_path: path, value: 5 },
                    `unicast-write-malformed-${path}`,
                );
                expect(answer.error_code).to.equal(8);
                expect(answer.details).to.contain("attribute_path");
            } finally {
                await h.close();
            }
        });
    }

    for (const path of ["1/*/16385", "1/6/*"]) {
        it(`refuses a unicast write_attribute with a wildcard in ${path}`, async () => {
            const h = await createHarness(undefined, {
                handleWriteAttribute: async () => {
                    throw new Error("write must not be reached");
                },
            });
            try {
                const answer = await answerFor(
                    h,
                    "write_attribute",
                    { node_id: 1, attribute_path: path, value: 5 },
                    `unicast-write-wildcard-${path}`,
                );
                expect(answer.error_code).to.equal(8);
                expect(answer.details).to.contain("wildcard");
            } finally {
                await h.close();
            }
        });
    }

    for (const [stated, expected] of [
        [0, undefined],
        [65_535, Millis(65_535)],
        [null, undefined],
    ] as const) {
        it(`passes timed_request_timeout_ms ${String(stated)} of a write_attribute on`, async () => {
            const writes = new Array<unknown>();
            const h = await createHarness(undefined, {
                handleWriteAttribute: async data => {
                    writes.push(data);
                    return [{ endpointId: 1, clusterId: 6, attributeId: 16385, status: 0 }];
                },
            });
            try {
                const answer = await answerFor(
                    h,
                    "write_attribute",
                    { node_id: 1, attribute_path: "1/6/16385", value: 5, timed_request_timeout_ms: stated },
                    `unicast-write-timed-${String(stated)}`,
                );
                expect(answer.error_code).to.equal(undefined);
                expect(writes).to.have.length(1);
                expect(writes[0]).to.have.property("timedInteractionTimeoutMs", expected);
            } finally {
                await h.close();
            }
        });
    }

    for (const stated of [-1, 1.5, "1000", 65_536]) {
        it(`refuses timed_request_timeout_ms ${JSON.stringify(stated)} on a write_attribute`, async () => {
            const h = await createHarness(undefined, {
                handleWriteAttribute: async () => {
                    throw new Error("write must not be reached");
                },
            });
            try {
                const answer = await answerFor(
                    h,
                    "write_attribute",
                    { node_id: 1, attribute_path: "1/6/16385", value: 5, timed_request_timeout_ms: stated },
                    `unicast-write-timed-bad-${String(stated)}`,
                );
                expect(answer.error_code).to.equal(8);
                expect(answer.details).to.contain("timed_request_timeout_ms");
            } finally {
                await h.close();
            }
        });
    }

    it("refuses timed_request_timeout_ms on a groupcast write_attribute", async () => {
        const h = await createHarness(undefined, {
            handleGroupWriteAttribute: async () => {
                throw new Error("groupcast must not be reached");
            },
        });
        try {
            const answer = await answerFor(
                h,
                "write_attribute",
                { node_id: GROUP_NODE_ID, attribute_path: "*/6/16385", value: 5, timed_request_timeout_ms: 1000 },
                "group-write-timed",
            );
            expect(answer.error_code).to.equal(8);
            expect(answer.details).to.contain("timed_request_timeout_ms");
        } finally {
            await h.close();
        }
    });

    it("passes batched_device_commands on in order and answers each command", async () => {
        const batches = new Array<BatchedInvokeRequest>();
        const h = await createHarness(undefined, {
            handleBatchedInvoke: async data => {
                batches.push(data);
                return [{ status: Status.Success }, { status: Status.Failure, clusterStatus: 3 }];
            },
        });
        try {
            const answer = await answerFor(
                h,
                "batched_device_commands",
                {
                    node_id: 1,
                    commands: [
                        { endpoint_id: 1, cluster_id: 6, command_name: "On", payload: {} },
                        { endpoint_id: 2, cluster_id: 6, command_name: "Toggle" },
                    ],
                    timed_request_timeout_ms: 500,
                    interaction_timeout_ms: 3000,
                },
                "batched",
            );
            await answerFor(
                h,
                "batched_device_commands",
                {
                    node_id: 1,
                    commands: [{ endpoint_id: 1, cluster_id: 6, command_name: "On" }],
                    timed_request_timeout_ms: 0,
                },
                "batched-untimed",
            );
            expect(answer.error_code).to.equal(undefined);
            expect(answer.result).to.deep.equal([{ status: 0 }, { status: Status.Failure, cluster_status: 3 }]);
            expect(
                batches.map(({ commands, timedInteractionTimeoutMs, interactionTimeoutMs }) => ({
                    commands: commands.map(({ endpointId, clusterId, commandName, data }) => ({
                        endpointId,
                        clusterId,
                        commandName,
                        data,
                    })),
                    timedInteractionTimeoutMs,
                    interactionTimeoutMs,
                })),
            ).to.deep.equal([
                {
                    commands: [
                        { endpointId: 1, clusterId: 6, commandName: "On", data: {} },
                        { endpointId: 2, clusterId: 6, commandName: "Toggle", data: {} },
                    ],
                    timedInteractionTimeoutMs: Millis(500),
                    interactionTimeoutMs: Millis(3000),
                },
                {
                    commands: [{ endpointId: 1, clusterId: 6, commandName: "On", data: {} }],
                    timedInteractionTimeoutMs: undefined,
                    interactionTimeoutMs: undefined,
                },
            ]);
        } finally {
            await h.close();
        }
    });

    it("converts the response payload of a batched command like device_command", async () => {
        const h = await createHarness(undefined, {
            handleBatchedInvoke: async () => [{ status: Status.Success, data: { errorCode: 0, debugText: "ok" } }],
        });
        try {
            const answer = await answerFor(
                h,
                "batched_device_commands",
                {
                    node_id: 1,
                    commands: [
                        {
                            endpoint_id: 0,
                            cluster_id: 0x30,
                            command_name: "ArmFailSafe",
                            payload: { expiryLengthSeconds: 60, breadcrumb: 0 },
                        },
                    ],
                },
                "batched-response",
            );
            expect(answer.result).to.deep.equal([{ status: 0, response: { errorCode: 0, debugText: "ok" } }]);
        } finally {
            await h.close();
        }
    });

    for (const [label, args] of [
        ["an empty commands list", { node_id: 1, commands: [] }],
        ["a missing commands list", { node_id: 1 }],
        ["a command that is not an object", { node_id: 1, commands: [5] }],
        ["a command without command_name", { node_id: 1, commands: [{ endpoint_id: 1, cluster_id: 6 }] }],
        [
            "an endpoint_id of the wrong type",
            { node_id: 1, commands: [{ endpoint_id: "1", cluster_id: 6, command_name: "On" }] },
        ],
        [
            "an invalid timed_request_timeout_ms",
            {
                node_id: 1,
                commands: [{ endpoint_id: 1, cluster_id: 6, command_name: "On" }],
                timed_request_timeout_ms: 65_536,
            },
        ],
        [
            "an invalid interaction_timeout_ms",
            {
                node_id: 1,
                commands: [{ endpoint_id: 1, cluster_id: 6, command_name: "On" }],
                interaction_timeout_ms: -1,
            },
        ],
        [
            "a group node id",
            { node_id: GROUP_NODE_ID, commands: [{ endpoint_id: 1, cluster_id: 6, command_name: "On" }] },
        ],
        [
            "a WebRTC Transport Provider command",
            { node_id: 1, commands: [{ endpoint_id: 1, cluster_id: 0x553, command_name: "EndSession", payload: {} }] },
        ],
    ] as const) {
        it(`refuses batched_device_commands with ${label}`, async () => {
            const h = await createHarness(undefined, {
                handleBatchedInvoke: async () => {
                    throw new Error("batch must not be reached");
                },
            });
            try {
                const answer = await answerFor(h, "batched_device_commands", { ...args }, `batched-bad-${label}`);
                expect(answer.error_code).to.equal(8);
            } finally {
                await h.close();
            }
        });
    }

    it("routes device_command for a group node id to the groupcast path and answers null", async () => {
        const groupInvokes = new Array<Record<string, unknown>>();
        const unicastInvokes = new Array<unknown>();
        const h = await createHarness(undefined, {
            handleGroupInvoke: async data => {
                groupInvokes.push(data as Record<string, unknown>);
            },
            handleInvoke: async () => {
                unicastInvokes.push(true);
                return {};
            },
        });
        try {
            const answer = await answerFor(
                h,
                "device_command",
                { node_id: GROUP_NODE_ID, cluster_id: 6, command_name: "toggle", payload: {} },
                "group-invoke",
            );

            expect(answer.error_code).to.equal(undefined);
            expect(answer.result).to.equal(null);
            expect(unicastInvokes.length).to.equal(0);
            expect(groupInvokes.length).to.equal(1);
            expect(groupInvokes[0].nodeId).to.equal(GROUP_NODE_ID);
            expect(groupInvokes[0].clusterId).to.equal(6);
            expect(groupInvokes[0].commandName).to.equal("toggle");
            expect("endpointId" in groupInvokes[0]).to.equal(false);
        } finally {
            await h.close();
        }
    });

    it("refuses device_command for a group node id that names an endpoint", async () => {
        const h = await createHarness(undefined, {
            handleGroupInvoke: async () => {
                throw new Error("groupcast must not be reached");
            },
        });
        try {
            const answer = await answerFor(
                h,
                "device_command",
                { node_id: GROUP_NODE_ID, endpoint_id: 1, cluster_id: 6, command_name: "toggle", payload: {} },
                "group-invoke-endpoint",
            );
            expect(answer.error_code).to.equal(8);
            expect(answer.details).to.contain("takes no endpoint_id");
        } finally {
            await h.close();
        }
    });

    it("refuses device_command without an endpoint_id for a node id that is not a group", async () => {
        const h = await createHarness();
        try {
            const answer = await answerFor(
                h,
                "device_command",
                { node_id: 1, cluster_id: 6, command_name: "toggle", payload: {} },
                "unicast-invoke-no-endpoint",
            );
            expect(answer.error_code).to.equal(8);
            expect(answer.details).to.contain("requires endpoint_id");
        } finally {
            await h.close();
        }
    });
});

describe("WebSocket client_session_key", () => {
    const STARTED = { node_id: 1, endpoint_id: 1, stream_usage: "LiveView" };
    const SESSION = 5;
    const CANDIDATE = { candidate: "candidate:1 1 UDP 1 192.0.2.1 5000 typ host", sdpMid: "0", sdpMLineIndex: 0 };

    /** The whole answer frame, so a test can read `error_code`. */
    function frameOf(ws: WebSocket, command: string, args: unknown): Promise<WireFrame> {
        const messageId = `key-${Math.random()}`;
        const answer = nextFrame(ws, `${command} response`, msg => msg.message_id === messageId);
        answer.catch(() => undefined);
        ws.send(JSON.stringify({ message_id: messageId, command, args }));
        return answer;
    }

    function events(ws: WebSocket, event: string): WireFrame[] {
        const seen = new Array<WireFrame>();
        ws.on("message", raw => {
            const msg = JSON.parse(raw.toString()) as WireFrame;
            if (msg.event === event) seen.push(msg);
        });
        return seen;
    }

    async function settle(): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    /**
     * A manager whose `camera_start_stream` hands out {@link SESSION} with the key it was given and waits
     * for `proceed`; `failStart` makes it fail instead. The provider records every `ProvideIceCandidates`.
     */
    async function keyedHarness() {
        const keys = new Map<number, { connectionId: string; clientSessionKey?: string }>();
        const tracked = new Map<string, number>();
        let reachedCamera = () => {};
        let atCamera = new Promise<void>(resolve => {
            reachedCamera = resolve;
        });
        let proceed = (_outcome: "succeeds" | "fails") => {};
        let proceeding = new Promise<"succeeds" | "fails">(resolve => {
            proceed = resolve;
        });
        const provided = new Array<Record<string, unknown>>();
        const invoked = new Array<Record<string, unknown>>();
        let refuseCandidates = false;
        let candidateGate: Promise<void> | undefined;
        const stoppedByKey = new Array<string>();
        const sessionEnded = new Observable<[CameraSessionEnded]>();
        const h = await createHarness(
            {
                async releaseConnection() {},
                events: { sessionEnded, streamEvicted: new Observable<[CameraStreamEvicted]>() },
                signallingOwner: (_nodeId, _endpointId, webRtcSessionId) => keys.get(webRtcSessionId),
                async startStream(args) {
                    keys.set(SESSION, {
                        connectionId: args.connectionId,
                        ...(args.clientSessionKey === undefined ? {} : { clientSessionKey: args.clientSessionKey }),
                    });
                    args.sessionEstablishing?.(SESSION);
                    reachedCamera();
                    const outcome = await proceeding;
                    if (outcome === "fails") {
                        keys.delete(SESSION);
                        throw new Error("the camera ended the session before it was tracked");
                    }
                    if (args.clientSessionKey !== undefined) {
                        tracked.set(`${args.connectionId}/${args.clientSessionKey}`, SESSION);
                    }
                    return { webRtcSessionId: SESSION, mode: "provide_offer", talkback: false };
                },
                async stopStreamByClientKey(_nodeId, _endpointId, connectionId, clientSessionKey) {
                    stoppedByKey.push(`${connectionId}/${clientSessionKey}`);
                    return true;
                },
                clientSessionId: (_nodeId, _endpointId, connectionId, clientSessionKey) =>
                    tracked.get(`${connectionId}/${clientSessionKey}`),
            },
            {
                async invokeWebRtcSignallingCommand(args) {
                    invoked.push(args.fields);
                    await candidateGate;
                    if (refuseCandidates) throw new Error("the camera refused the candidates");
                    provided.push(args.fields);
                },
            },
        );
        return {
            h,
            keys,
            provided,
            invoked,
            stoppedByKey,
            sessionEnded,
            atCamera: () => atCamera,
            proceed: (outcome: "succeeds" | "fails" = "succeeds") => proceed(outcome),
            refuseCandidates: () => {
                refuseCandidates = true;
            },
            /** Holds every `ProvideIceCandidates` until the returned function runs. */
            gateCandidates: () => {
                let open = () => {};
                candidateGate = new Promise<void>(resolve => {
                    open = resolve;
                });
                return open;
            },
            nextStart: () => {
                atCamera = new Promise<void>(resolve => {
                    reachedCamera = resolve;
                });
                proceeding = new Promise<"succeeds" | "fails">(resolve => {
                    proceed = resolve;
                });
            },
        };
    }

    function candidatesOf(fields: Record<string, unknown>): unknown {
        return fields.iceCandidates;
    }

    it("echoes the key on the session's webrtc_callback and camera_session_ended events", async () => {
        const k = await keyedHarness();
        try {
            const ws = await k.h.openClient();
            try {
                const callbacks = events(ws, "webrtc_callback");
                const ended = events(ws, "camera_session_ended");
                const started = frameOf(ws, "camera_start_stream", { ...STARTED, client_session_key: "key-a" });
                await k.atCamera();
                k.proceed();
                expect((await started).error_code).to.equal(undefined);

                k.h.emitWebRtcCallback({
                    webrtc_session_id: SESSION,
                    node_id: 1,
                    endpoint_id: 1,
                    event_type: "answer",
                    data: null,
                });
                k.sessionEnded.emit({
                    nodeId: NodeId(1n),
                    endpointId: EndpointNumber(1),
                    webRtcSessionId: SESSION,
                    ownerId: k.keys.get(SESSION)?.connectionId,
                    clientSessionKey: "key-a",
                    cause: "peer",
                });
                await settle();
                expect(callbacks.map(frame => frame.data)).to.deep.equal([
                    {
                        webrtc_session_id: SESSION,
                        node_id: 1,
                        endpoint_id: 1,
                        event_type: "answer",
                        data: null,
                        client_session_key: "key-a",
                    },
                ]);
                expect(ended.map(frame => frame.data)).to.deep.equal([
                    {
                        node_id: 1,
                        endpoint_id: 1,
                        webrtc_session_id: SESSION,
                        cause: "peer",
                        client_session_key: "key-a",
                    },
                ]);
            } finally {
                ws.close();
            }
        } finally {
            k.proceed();
            await k.h.close();
        }
    });

    it("sends no key on events of a session started without one", async () => {
        const k = await keyedHarness();
        try {
            const ws = await k.h.openClient();
            try {
                const callbacks = events(ws, "webrtc_callback");
                const started = frameOf(ws, "camera_start_stream", STARTED);
                await k.atCamera();
                k.proceed();
                await started;
                k.h.emitWebRtcCallback({
                    webrtc_session_id: SESSION,
                    node_id: 1,
                    endpoint_id: 1,
                    event_type: "answer",
                    data: null,
                });
                await settle();
                expect(callbacks).to.have.length(1);
                expect(callbacks[0].data).to.not.have.property("client_session_key");
            } finally {
                ws.close();
            }
        } finally {
            k.proceed();
            await k.h.close();
        }
    });

    it("refuses a key that is not a string of 1 to 128 characters", async () => {
        const k = await keyedHarness();
        try {
            const ws = await k.h.openClient();
            try {
                for (const key of ["", "x".repeat(129), 7]) {
                    const frame = await frameOf(ws, "camera_start_stream", { ...STARTED, client_session_key: key });
                    expect(frame.error_code, String(key)).to.equal(8);
                }
                const longest = frameOf(ws, "camera_start_stream", { ...STARTED, client_session_key: "x".repeat(128) });
                await k.atCamera();
                k.proceed();
                expect((await longest).error_code).to.equal(undefined);
            } finally {
                ws.close();
            }
        } finally {
            k.proceed();
            await k.h.close();
        }
    });

    for (const command of ["camera_stop_stream", "camera_provide_ice_candidates"]) {
        it(`${command} takes exactly one of webrtc_session_id and client_session_key`, async () => {
            const k = await keyedHarness();
            try {
                const ws = await k.h.openClient();
                try {
                    const extra = command === "camera_stop_stream" ? {} : { ice_candidates: [CANDIDATE] };
                    const both = await frameOf(ws, command, {
                        node_id: 1,
                        endpoint_id: 1,
                        webrtc_session_id: SESSION,
                        client_session_key: "key-a",
                        ...extra,
                    });
                    const neither = await frameOf(ws, command, { node_id: 1, endpoint_id: 1, ...extra });
                    expect([both.error_code, neither.error_code]).to.deep.equal([8, 8]);
                    expect(both.details).to.contain("exactly one of webrtc_session_id and client_session_key");
                } finally {
                    ws.close();
                }
            } finally {
                await k.h.close();
            }
        });
    }

    it("camera_stop_stream with a key asks the manager for this connection's session", async () => {
        const k = await keyedHarness();
        try {
            const ws = await k.h.openClient();
            try {
                const started = frameOf(ws, "camera_start_stream", { ...STARTED, client_session_key: "key-a" });
                await k.atCamera();
                const stopped = await frameOf(ws, "camera_stop_stream", {
                    node_id: 1,
                    endpoint_id: 1,
                    client_session_key: "key-a",
                });
                expect(stopped.result).to.deep.equal({ ended: true });
                const owner = k.keys.get(SESSION)?.connectionId;
                expect(k.stoppedByKey).to.deep.equal([`${owner}/key-a`]);
                k.proceed();
                await started;
            } finally {
                ws.close();
            }
        } finally {
            k.proceed();
            await k.h.close();
        }
    });

    it("queues candidates named by the key of a starting session and sends them in order after the response", async () => {
        const k = await keyedHarness();
        try {
            const ws = await k.h.openClient();
            try {
                const order = new Array<string>();
                ws.on("message", raw => {
                    const msg = JSON.parse(raw.toString()) as WireFrame;
                    if (msg.message_id !== undefined) order.push(String(msg.message_id).split(":")[0]);
                });
                const send = (label: string, command: string, args: unknown) => {
                    const answer = nextFrame(ws, label, msg => msg.message_id === label);
                    answer.catch(() => undefined);
                    ws.send(JSON.stringify({ message_id: label, command, args }));
                    return answer;
                };
                const started = send("start", "camera_start_stream", { ...STARTED, client_session_key: "key-a" });
                await k.atCamera();
                const keyed = (n: number) => ({
                    node_id: 1,
                    endpoint_id: 1,
                    client_session_key: "key-a",
                    ice_candidates: [{ ...CANDIDATE, candidate: `candidate:${n}` }],
                });
                const first = send("ice1", "camera_provide_ice_candidates", keyed(1));
                const second = send("ice2", "camera_provide_ice_candidates", keyed(2));
                await settle();
                expect(k.provided).to.deep.equal([]);
                expect(order).to.deep.equal([]);

                k.proceed();
                expect((await started).error_code).to.equal(undefined);
                expect((await first).result).to.equal(null);
                expect((await second).result).to.equal(null);
                expect(order).to.deep.equal(["start", "ice1", "ice2"]);
                expect(k.provided.map(fields => fields.webRtcSessionId)).to.deep.equal([SESSION]);
                expect(k.provided.map(candidatesOf)).to.deep.equal([
                    [
                        { candidate: "candidate:1", sdpMid: "0", sdpmLineIndex: 0 },
                        { candidate: "candidate:2", sdpMid: "0", sdpmLineIndex: 0 },
                    ],
                ]);

                // The start is answered, so the key now resolves through the manager and goes out at once.
                const later = await send("ice3", "camera_provide_ice_candidates", keyed(3));
                expect(later.result).to.equal(null);
                expect(k.provided).to.have.length(2);
            } finally {
                ws.close();
            }
        } finally {
            k.proceed();
            await k.h.close();
        }
    });

    it("answers a queued command with the camera's refusal of its candidates", async () => {
        const k = await keyedHarness();
        try {
            const ws = await k.h.openClient();
            try {
                const started = frameOf(ws, "camera_start_stream", { ...STARTED, client_session_key: "key-a" });
                await k.atCamera();
                const queued = frameOf(ws, "camera_provide_ice_candidates", {
                    node_id: 1,
                    endpoint_id: 1,
                    client_session_key: "key-a",
                    ice_candidates: [CANDIDATE],
                });
                await settle();
                k.refuseCandidates();
                k.proceed();
                await started;
                const answer = await queued;
                expect(answer.error_code).to.equal(0);
                expect(answer.details).to.equal("the camera refused the candidates");
            } finally {
                ws.close();
            }
        } finally {
            k.proceed();
            await k.h.close();
        }
    });

    it("refuses queued candidates with error 8 when the start fails, and holds the key no longer", async () => {
        const k = await keyedHarness();
        try {
            const ws = await k.h.openClient();
            try {
                const started = frameOf(ws, "camera_start_stream", { ...STARTED, client_session_key: "key-a" });
                await k.atCamera();
                const keyed = {
                    node_id: 1,
                    endpoint_id: 1,
                    client_session_key: "key-a",
                    ice_candidates: [CANDIDATE],
                };
                const queued = frameOf(ws, "camera_provide_ice_candidates", keyed);
                await settle();
                k.proceed("fails");
                expect((await started).error_code).to.not.equal(undefined);
                const answer = await queued;
                expect(answer.error_code).to.equal(8);
                expect(answer.details).to.contain('client_session_key "key-a" names no session');
                expect(k.provided).to.deep.equal([]);

                const unknown = await frameOf(ws, "camera_provide_ice_candidates", keyed);
                expect(unknown.error_code).to.equal(8);
            } finally {
                ws.close();
            }
        } finally {
            k.proceed();
            await k.h.close();
        }
    });

    it("refuses candidates past the queue bound of a starting session", async () => {
        const k = await keyedHarness();
        try {
            const ws = await k.h.openClient();
            try {
                const started = frameOf(ws, "camera_start_stream", { ...STARTED, client_session_key: "key-a" });
                await k.atCamera();
                const many = (count: number) => ({
                    node_id: 1,
                    endpoint_id: 1,
                    client_session_key: "key-a",
                    ice_candidates: Array.from({ length: count }, (_, n) => ({ ...CANDIDATE, candidate: `c${n}` })),
                });
                const filling = frameOf(ws, "camera_provide_ice_candidates", many(63));
                const last = frameOf(ws, "camera_provide_ice_candidates", many(1));
                const over = await frameOf(ws, "camera_provide_ice_candidates", many(1));
                expect(over.error_code).to.equal(8);
                expect(over.details).to.contain("at most 64 ICE candidates");
                k.proceed();
                await started;
                expect((await filling).error_code).to.equal(undefined);
                expect((await last).error_code).to.equal(undefined);
                expect(k.provided).to.have.length(2);
            } finally {
                ws.close();
            }
        } finally {
            k.proceed();
            await k.h.close();
        }
    });

    it("never queues for or resolves another connection's key", async () => {
        const k = await keyedHarness();
        try {
            const owner = await k.h.openClient();
            const other = await k.h.openClient();
            try {
                const started = frameOf(owner, "camera_start_stream", { ...STARTED, client_session_key: "key-a" });
                await k.atCamera();
                const keyed = {
                    node_id: 1,
                    endpoint_id: 1,
                    client_session_key: "key-a",
                    ice_candidates: [CANDIDATE],
                };
                expect((await frameOf(other, "camera_provide_ice_candidates", keyed)).error_code).to.equal(8);
                k.proceed();
                await started;
                expect((await frameOf(other, "camera_provide_ice_candidates", keyed)).error_code).to.equal(8);
                expect(k.provided).to.deep.equal([]);
            } finally {
                owner.close();
                other.close();
            }
        } finally {
            k.proceed();
            await k.h.close();
        }
    });

    it("holds no event of the session while its queued candidates are being sent", async () => {
        const k = await keyedHarness();
        try {
            const ws = await k.h.openClient();
            try {
                const callbacks = events(ws, "webrtc_callback");
                const started = frameOf(ws, "camera_start_stream", { ...STARTED, client_session_key: "key-a" });
                await k.atCamera();
                const queued = frameOf(ws, "camera_provide_ice_candidates", {
                    node_id: 1,
                    endpoint_id: 1,
                    client_session_key: "key-a",
                    ice_candidates: [CANDIDATE],
                });
                await settle();
                const openCandidates = k.gateCandidates();
                k.proceed();
                await started;
                k.h.emitWebRtcCallback({
                    webrtc_session_id: SESSION,
                    node_id: 1,
                    endpoint_id: 1,
                    event_type: "answer",
                    data: null,
                });
                await settle();
                expect(callbacks).to.have.length(1);
                openCandidates();
                expect((await queued).result).to.equal(null);
            } finally {
                ws.close();
            }
        } finally {
            k.proceed();
            await k.h.close();
        }
    });

    it("sends the candidates queued at the response in one invoke, and those queued during it in the next", async () => {
        const k = await keyedHarness();
        try {
            const ws = await k.h.openClient();
            try {
                const started = frameOf(ws, "camera_start_stream", { ...STARTED, client_session_key: "key-a" });
                await k.atCamera();
                const keyed = {
                    node_id: 1,
                    endpoint_id: 1,
                    client_session_key: "key-a",
                    ice_candidates: [CANDIDATE],
                };
                const first = frameOf(ws, "camera_provide_ice_candidates", keyed);
                const second = frameOf(ws, "camera_provide_ice_candidates", keyed);
                await settle();
                const openCandidates = k.gateCandidates();
                k.proceed();
                await started;
                await settle();
                expect(k.invoked).to.have.length(1);
                expect(candidatesOf(k.invoked[0])).to.have.length(2);
                const third = frameOf(ws, "camera_provide_ice_candidates", keyed);
                await settle();
                expect(k.invoked).to.have.length(1);
                openCandidates();
                expect((await first).result).to.equal(null);
                expect((await second).result).to.equal(null);
                expect((await third).result).to.equal(null);
                expect(k.invoked).to.have.length(2);
                expect(candidatesOf(k.invoked[1])).to.have.length(1);
            } finally {
                ws.close();
            }
        } finally {
            k.proceed();
            await k.h.close();
        }
    });

    it("queues candidates for a reused key on the new start, not on the old one still sending its queue", async () => {
        const k = await keyedHarness();
        try {
            const ws = await k.h.openClient();
            try {
                const keyed = {
                    node_id: 1,
                    endpoint_id: 1,
                    client_session_key: "key-a",
                    ice_candidates: [CANDIDATE],
                };
                const first = frameOf(ws, "camera_start_stream", { ...STARTED, client_session_key: "key-a" });
                await k.atCamera();
                const oldQueue = [
                    frameOf(ws, "camera_provide_ice_candidates", keyed),
                    frameOf(ws, "camera_provide_ice_candidates", keyed),
                ];
                await settle();
                const openCandidates = k.gateCandidates();
                k.proceed();
                await first;

                k.nextStart();
                const second = frameOf(ws, "camera_start_stream", { ...STARTED, client_session_key: "key-a" });
                await k.atCamera();
                const forNewStart = frameOf(ws, "camera_provide_ice_candidates", keyed);
                await settle();
                openCandidates();
                for (const queued of oldQueue) expect((await queued).result).to.equal(null);
                await settle();
                expect(k.provided).to.have.length(1);
                expect(candidatesOf(k.provided[0])).to.have.length(2);

                k.proceed();
                await second;
                expect((await forNewStart).result).to.equal(null);
                expect(k.provided).to.have.length(2);
            } finally {
                ws.close();
            }
        } finally {
            k.proceed();
            await k.h.close();
        }
    });

    it("refuses a key no start of the connection named, while another start is in flight", async () => {
        const k = await keyedHarness();
        try {
            const ws = await k.h.openClient();
            try {
                const started = frameOf(ws, "camera_start_stream", { ...STARTED, client_session_key: "key-a" });
                await k.atCamera();
                const other = await frameOf(ws, "camera_provide_ice_candidates", {
                    node_id: 1,
                    endpoint_id: 1,
                    client_session_key: "key-b",
                    ice_candidates: [CANDIDATE],
                });
                expect(other.error_code).to.equal(8);
                k.proceed();
                await started;
                await settle();
                expect(k.provided).to.deep.equal([]);
            } finally {
                ws.close();
            }
        } finally {
            k.proceed();
            await k.h.close();
        }
    });

    /** Never rejects, so an answer that does not come fails the assertion on it and does not crash the suite. */
    const answerOf = (frame: Promise<WireFrame>) => frame.catch(() => undefined);

    it("sends the queued candidates once the start is answered", async () => {
        const k = await keyedHarness();
        try {
            const ws = await k.h.openClient();
            try {
                const started = answerOf(
                    frameOf(ws, "camera_start_stream", { ...STARTED, client_session_key: "key-a" }),
                );
                await k.atCamera();
                const queued = answerOf(
                    frameOf(ws, "camera_provide_ice_candidates", {
                        node_id: 1,
                        endpoint_id: 1,
                        client_session_key: "key-a",
                        ice_candidates: [CANDIDATE],
                    }),
                );
                await settle();
                expect(k.invoked).to.have.length(0);

                k.proceed();
                await started;
                await settle();
                expect(k.provided.map(fields => fields.webRtcSessionId)).to.deep.equal([SESSION]);
                expect((await queued)?.result).to.equal(null);
            } finally {
                ws.close();
            }
        } finally {
            k.proceed();
            await k.h.close();
        }
    });

    it("answers a queued candidates command only after the camera took the candidates", async () => {
        const k = await keyedHarness();
        try {
            const ws = await k.h.openClient();
            try {
                const started = answerOf(
                    frameOf(ws, "camera_start_stream", { ...STARTED, client_session_key: "key-a" }),
                );
                await k.atCamera();
                let answered = false;
                const queued = answerOf(
                    frameOf(ws, "camera_provide_ice_candidates", {
                        node_id: 1,
                        endpoint_id: 1,
                        client_session_key: "key-a",
                        ice_candidates: [CANDIDATE],
                    }),
                ).then(frame => {
                    answered = true;
                    return frame;
                });
                await settle();
                const openCandidates = k.gateCandidates();
                k.proceed();
                await started;
                await settle();
                expect(k.invoked).to.have.length(1);
                expect(answered).to.equal(false);

                openCandidates();
                expect((await queued)?.result).to.equal(null);
                expect(k.provided).to.have.length(1);
            } finally {
                ws.close();
            }
        } finally {
            k.proceed();
            await k.h.close();
        }
    });

    it("sends candidates with an id at once while a start is in flight", async () => {
        const k = await keyedHarness();
        try {
            const ws = await k.h.openClient();
            try {
                const started = frameOf(ws, "camera_start_stream", { ...STARTED, client_session_key: "key-a" });
                await k.atCamera();
                const byId = await frameOf(ws, "camera_provide_ice_candidates", {
                    node_id: 1,
                    endpoint_id: 1,
                    webrtc_session_id: SESSION,
                    ice_candidates: [CANDIDATE],
                });
                expect(byId.result).to.equal(null);
                expect(k.provided.map(fields => fields.webRtcSessionId)).to.deep.equal([SESSION]);
                k.proceed();
                await started;
            } finally {
                ws.close();
            }
        } finally {
            k.proceed();
            await k.h.close();
        }
    });
});
