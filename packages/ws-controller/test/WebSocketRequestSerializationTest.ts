/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Regression test for the unhandled-rejection hazard in WebSocketControllerHandler's per-message
 * response path: `#handleWebSocketRequest(...).then(onFulfilled, onRejected)` only catches a
 * rejection of the *original* promise, not an exception thrown by `onFulfilled` itself. A throw while
 * serializing the response — `toBigIntAwareJson` on a pathological value such as a circular result —
 * happens inside `onFulfilled`, after `#handleWebSocketRequest` has already resolved successfully, so
 * it escaped as an unhandled rejection instead of being caught. `.then(onFulfilled).catch(handler)`
 * fixes that: chaining `.catch()` after `.then()` also covers a throw raised by the fulfillment
 * handler, unlike the two-argument `.then(a, b)` form.
 *
 * This drives a real WebSocketControllerHandler over a real `ws` client/server pair (same harness
 * shape as WsBackpressureReproTest.ts) with a minimal stand-in for ControllerCommandHandler, since the
 * real class requires a live CommissioningController.
 */

import { Environment, FabricId, MockStorageService, NodeId, Observable } from "@matter/main";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import type { MatterController } from "../src/controller/MatterController.js";
import { ConfigStorage } from "../src/server/ConfigStorage.js";
import { WebSocketControllerHandler } from "../src/server/WebSocketControllerHandler.js";

/**
 * Minimal stand-in for `ControllerCommandHandler` exposing only the surface
 * `WebSocketControllerHandler.register()`/command dispatch touch (see WsBackpressureReproTest.ts for
 * the fuller rationale on why a cast-based fake is used instead of the real class).
 */
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
        // Backs the `ping_node` command driven below.
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

/** Same buffering helper as WsBackpressureReproTest.ts: never misses a message that arrives early. */
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
        // A circular result: JSON.stringify (inside toBigIntAwareJson) throws on this. That throw
        // happens in the *fulfillment* handler of `#handleWebSocketRequest(...).then(...)` — the
        // command handler itself resolves successfully with this value; only the later serialization
        // step chokes on it, so #handleWebSocketRequest's own internal try/catch never sees it.
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

            // This request's response can never be serialized, so no frame is ever sent for it —
            // the point under test is what happens to the *promise*, not the wire reply.
            client.send(JSON.stringify({ message_id: "poison", command: "ping_node", args: { node_id: 1 } }));

            // Let the message handler's promise chain fully settle before checking for a leaked
            // unhandled rejection (Node surfaces "unhandledRejection" a tick or two after the throw).
            await new Promise(resolve => setImmediate(resolve));
            await new Promise(resolve => setImmediate(resolve));
            await new Promise(resolve => setImmediate(resolve));

            // Proof the connection (and process) survived: an unrelated, well-formed request on the
            // SAME connection still gets served normally right after.
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
