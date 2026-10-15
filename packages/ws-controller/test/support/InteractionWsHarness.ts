/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Environment, FabricId, MockStorageService, NodeId, Observable } from "@matter/main";
import { once } from "node:events";
import { createServer, Server } from "node:http";
import { WebSocket } from "ws";
import type { MatterController } from "../../src/controller/MatterController.js";
import { ConfigStorage } from "../../src/server/ConfigStorage.js";
import { toBigIntAwareJson } from "../../src/server/Converters.js";
import { WebSocketControllerHandler } from "../../src/server/WebSocketControllerHandler.js";
import {
    AttributeResponseStatus,
    InteractionReadRequest,
    InteractionReport,
    InteractionSubscribeRequest,
    InteractionSubscription,
    InteractionSubscriptionListener,
    InvokeRequest,
} from "../../src/types/CommandHandler.js";

type WsMessage = Record<string, unknown>;

interface FakeSubscription extends InteractionSubscription {
    open: boolean;
    listener: InteractionSubscriptionListener;
}

/** A WebSocket client that keeps every frame it received, in order. */
export class WsTestClient {
    readonly #ws: WebSocket;
    readonly #received = new Array<WsMessage>();
    readonly #waiters = new Array<() => void>();
    readonly #consumed = new Set<WsMessage>();
    #nextMessageId = 1;

    constructor(ws: WebSocket) {
        this.#ws = ws;
        ws.on("message", data => {
            this.#received.push(JSON.parse(data.toString()));
            for (const wake of this.#waiters.splice(0)) wake();
        });
    }

    async #waitFor(find: () => WsMessage | undefined, timeoutMs = 5000): Promise<WsMessage> {
        const deadline = Date.now() + timeoutMs;
        for (;;) {
            const found = find();
            if (found !== undefined) {
                return found;
            }
            const remaining = deadline - Date.now();
            if (remaining <= 0) {
                throw new Error("Timed out waiting for a WebSocket message");
            }
            await new Promise<void>(resolve => {
                const timer = setTimeout(resolve, remaining);
                this.#waiters.push(() => {
                    clearTimeout(timer);
                    resolve();
                });
            });
        }
    }

    async command(command: string, args: unknown): Promise<WsMessage> {
        const message_id = String(this.#nextMessageId++);
        this.#ws.send(toBigIntAwareJson({ message_id, command, args }));
        return this.#waitFor(() => this.#received.find(message => message.message_id === message_id));
    }

    serverInfo() {
        return this.#waitFor(() => this.#received.find(message => "sdk_version" in message));
    }

    /** The first event of this type not yet returned by this method. */
    async nextEvent(event: string): Promise<WsMessage> {
        const found = await this.#waitFor(() =>
            this.#received.find(message => message.event === event && !this.#consumed.has(message)),
        );
        this.#consumed.add(found);
        return found;
    }

    events(event: string) {
        return this.#received.filter(message => message.event === event);
    }

    indexOf(message: WsMessage) {
        return this.#received.indexOf(message);
    }

    /** Stop reading, so the server's sends back up as for a stalled client. */
    pause() {
        this.#ws.pause();
    }

    resume() {
        this.#ws.resume();
    }

    async close() {
        const closed = once(this.#ws, "close");
        this.#ws.close();
        await closed;
    }
}

/**
 * A real {@link WebSocketControllerHandler} over real sockets, in front of a command handler stand-in whose
 * subscriptions the test drives.
 */
export class InteractionWsHarness {
    readonly subscribeRequests = new Array<InteractionSubscribeRequest>();
    readonly readRequests = new Array<InteractionReadRequest>();
    readonly autoSubscriptionRequests = new Array<{ nodeId: NodeId; enabled: boolean }>();
    readonly subscriptions = new Array<FakeSubscription>();
    readonly invokeRequests = new Array<InvokeRequest>();
    invokeError?: Error;
    writeResult: AttributeResponseStatus[] = [{ endpointId: 1, clusterId: 6, attributeId: 0, status: 0 }];
    primingReport: InteractionReport = { attributes: {}, events: [] };
    /** Reported through the listener before the subscription resolves. */
    earlyReport?: InteractionReport;
    readResult: InteractionReport = { attributes: {}, events: [] };
    nextSubscriptionId = 1;
    /** While set, subscribe waits for it before answering. */
    subscribeGate?: Promise<void>;
    /** When false, closing a subscription does not call its listener's `closed`, as matter.js may do it later. */
    closeNotifies = true;
    autoSubscriptionDisabled = true;
    #handler?: WebSocketControllerHandler;
    #httpServer?: Server;

    private constructor() {}

    get #started() {
        if (this.#handler === undefined || this.#httpServer === undefined) {
            throw new Error("Harness not started");
        }
        return { handler: this.#handler, httpServer: this.#httpServer };
    }

    static async create() {
        const env = new Environment("interaction-ws-test");
        new MockStorageService(env);
        const config = await ConfigStorage.create(env);

        const harness = new InteractionWsHarness();
        const commandHandler = {
            events: {
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
            },
            getNodeIds: () => new Array<NodeId>(),
            hasNode: () => false,
            formatNode: (nodeId: NodeId) => `test-node-${nodeId}`,
            get autoSubscriptionDisabled() {
                return harness.autoSubscriptionDisabled;
            },
            bleEnabled: false,
            bleProxyEnabled: false,
            getCommissionerNodeId: () => NodeId(112233),
            start: async () => {},
            getCommissionerFabricData: async () => ({
                fabricId: FabricId(1),
                compressedFabricId: 1n,
                fabricIndex: 1,
            }),
            initializeNodes: async () => {},
            subscribe: async (request: InteractionSubscribeRequest, listener: InteractionSubscriptionListener) =>
                harness.#subscribe(request, listener),
            setAutoSubscription: async (nodeId: NodeId, enabled: boolean) => {
                harness.autoSubscriptionRequests.push({ nodeId, enabled });
            },
            handleInvoke: async (request: InvokeRequest) => {
                harness.invokeRequests.push(request);
                if (harness.invokeError !== undefined) {
                    throw harness.invokeError;
                }
                return undefined;
            },
            handleWriteAttribute: async () => harness.writeResult,
            read: async (request: InteractionReadRequest) => {
                harness.readRequests.push(request);
                return harness.readResult;
            },
        };
        const controller = {
            commandHandler,
            threadDiagnostics: { events: { batchUpdated: new Observable() } },
        } as unknown as MatterController;

        const handler = new WebSocketControllerHandler(controller, config, "interaction-ws-test");
        const httpServer = createServer();
        await new Promise<void>((resolve, reject) => {
            httpServer.once("error", reject);
            httpServer.listen(0, "127.0.0.1", () => resolve());
        });
        await handler.register(httpServer);

        harness.#handler = handler;
        harness.#httpServer = httpServer;
        return harness;
    }

    async #subscribe(request: InteractionSubscribeRequest, listener: InteractionSubscriptionListener) {
        this.subscribeRequests.push(request);
        if (this.earlyReport !== undefined) {
            listener.report(this.earlyReport);
        }
        await this.subscribeGate;
        const subscription: FakeSubscription = {
            id: this.nextSubscriptionId,
            nodeId: request.nodeId,
            priming: this.primingReport,
            open: true,
            listener,
            close: () => {
                if (subscription.open) {
                    subscription.open = false;
                    if (this.closeNotifies) {
                        listener.closed();
                    }
                }
            },
        };
        this.subscriptions.push(subscription);
        return subscription;
    }

    async connect() {
        const address = this.#started.httpServer.address();
        if (address === null || typeof address === "string") {
            throw new Error("Harness is not listening on a TCP port");
        }
        const { port } = address;
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
        const client = new WsTestClient(ws);
        await once(ws, "open");
        await client.serverInfo();
        return client;
    }

    #open(id: number) {
        return this.subscriptions.filter(subscription => subscription.id === id && subscription.open);
    }

    isOpen(id: number) {
        return this.#open(id).length > 0;
    }

    openSubscriptions(id: number) {
        return this.#open(id).length;
    }

    report(id: number, report: InteractionReport) {
        for (const subscription of this.#open(id)) {
            subscription.listener.report(report);
        }
    }

    endFromController(id: number) {
        for (const subscription of this.#open(id)) {
            subscription.close();
        }
    }

    /** Repeats the end notice of subscriptions already closed under this id, as a late callback would. */
    repeatClosedNotice(id: number) {
        for (const subscription of this.subscriptions) {
            if (subscription.id === id && !subscription.open) {
                subscription.listener.closed();
            }
        }
    }

    async waitFor(condition: () => boolean, timeoutMs = 5000) {
        const deadline = Date.now() + timeoutMs;
        while (!condition()) {
            if (Date.now() > deadline) {
                throw new Error("Timed out waiting for condition");
            }
            await new Promise(resolve => setTimeout(resolve, 5));
        }
    }

    async unregister() {
        await this.#started.handler.unregister();
    }

    async close() {
        const { handler, httpServer } = this.#started;
        await handler.unregister();
        await new Promise<void>(resolve => httpServer.close(() => resolve()));
    }
}
