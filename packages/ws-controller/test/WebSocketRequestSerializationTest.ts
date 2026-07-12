/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Guards that a throw while serializing an already-resolved response (toBigIntAwareJson on a circular
 * value, in the fulfillment handler) does not leak as an unhandled rejection and the connection keeps
 * serving. Cast-based ControllerCommandHandler stand-in over a real ws pair (the real class needs a
 * live CommissioningController).
 */

import { Environment, FabricId, MockStorageService, NodeId, Observable } from "@matter/main";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import type { MatterController } from "../src/controller/MatterController.js";
import { ConfigStorage } from "../src/server/ConfigStorage.js";
import { WebSocketControllerHandler } from "../src/server/WebSocketControllerHandler.js";

function createFakeCommandHandler(pingNode: () => unknown) {
    return {
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
        pingNode: async () => pingNode(),
    };
}

async function createHarness(pingNode: () => unknown) {
    const env = new Environment("test");
    new MockStorageService(env);
    const config = await ConfigStorage.create(env);

    const fakeCommandHandler = createFakeCommandHandler(pingNode);
    // register() subscribes to the controller-level thread-diagnostics observable; supply just that.
    const fakeController = {
        commandHandler: fakeCommandHandler,
        threadDiagnostics: { events: { batchUpdated: new Observable() } },
    } as unknown as MatterController;

    const handler = new WebSocketControllerHandler(fakeController, config, "fix5-repro-test");

    const httpServer = createServer();
    await new Promise<void>((resolve, reject) => {
        httpServer.once("error", reject);
        httpServer.listen(0, "127.0.0.1", () => resolve());
    });

    await handler.register(httpServer);

    return { env, config, handler, httpServer };
}

type WsMessage = Record<string, unknown>;

function createMessageBuffer(ws: WebSocket) {
    const backlog = new Array<WsMessage>();
    const waiters = new Array<{ predicate: (msg: WsMessage) => boolean; resolve: (msg: WsMessage) => void }>();

    ws.on("message", data => {
        const msg = JSON.parse(data.toString()) as WsMessage;
        const index = waiters.findIndex(w => w.predicate(msg));
        if (index >= 0) {
            waiters.splice(index, 1)[0].resolve(msg);
        } else {
            backlog.push(msg);
        }
    });

    return {
        wait(predicate: (msg: WsMessage) => boolean, timeoutMs = 5000): Promise<WsMessage> {
            const index = backlog.findIndex(predicate);
            if (index >= 0) {
                return Promise.resolve(backlog.splice(index, 1)[0]);
            }
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    const waiterIndex = waiters.findIndex(w => w.resolve === resolveAndClear);
                    if (waiterIndex >= 0) waiters.splice(waiterIndex, 1);
                    reject(new Error("Timed out waiting for message"));
                }, timeoutMs);
                const resolveAndClear = (msg: WsMessage) => {
                    clearTimeout(timer);
                    resolve(msg);
                };
                waiters.push({ predicate, resolve: resolveAndClear });
            });
        },
    };
}

describe("WebSocketControllerHandler message response path", () => {
    it("does not leak an unhandled rejection when the response fails to serialize, and keeps serving the connection", async () => {
        // Circular result: toBigIntAwareJson throws serializing it, in the fulfillment handler after
        // the command already resolved — so #handleWebSocketRequest's own try/catch never sees it.
        const poisoned: Record<string, unknown> = { attempts: 1 };
        poisoned.self = poisoned;

        const harness = await createHarness(() => poisoned);
        const unhandledRejections: unknown[] = [];
        const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
        process.on("unhandledRejection", onUnhandledRejection);

        let client: WebSocket | undefined;
        try {
            const address = harness.httpServer.address() as AddressInfo;
            client = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
            const messages = createMessageBuffer(client);
            await once(client, "open");
            await messages.wait(msg => "sdk_version" in msg); // initial server_info

            // The response never serializes, so no frame is sent — the test is about the promise, not the reply.
            client.send(JSON.stringify({ message_id: "poison", command: "ping_node", args: { node_id: 1 } }));

            // Let the promise chain settle (Node surfaces "unhandledRejection" a tick or two later).
            await new Promise(resolve => setImmediate(resolve));
            await new Promise(resolve => setImmediate(resolve));
            await new Promise(resolve => setImmediate(resolve));

            // Connection (and process) survived: a well-formed request on the same connection still serves.
            client.send(JSON.stringify({ message_id: "after", command: "server_info", args: {} }));
            const response = await messages.wait(msg => msg.message_id === "after");
            expect(response.result).to.not.equal(undefined);
        } finally {
            process.off("unhandledRejection", onUnhandledRejection);
            if (client && (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING)) {
                client.terminate();
            }
            await harness.handler.unregister().catch(() => undefined);
            await new Promise<void>(resolve => harness.httpServer.close(() => resolve()));
            await harness.config.close();
        }

        expect(
            unhandledRejections,
            "toBigIntAwareJson throwing during serialization leaked as an unhandled promise rejection instead of being caught",
        ).to.deep.equal([]);
    });
});
