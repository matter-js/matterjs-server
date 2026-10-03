/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The wire contract of the python-matter-server API orders the node snapshot before the
 * announcement of a new endpoint: a client resolves the endpoint against the node model it builds
 * from node_updated, so an endpoint_added that arrives first names an endpoint it does not know.
 */

import { Environment, MockStorageService, NodeId, Observable } from "@matter/main";
import { EndpointNumber } from "@matter/main/types";
import { createServer, type Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { MatterController } from "../src/controller/MatterController.js";
import { ConfigStorage } from "../src/server/ConfigStorage.js";
import { WebSocketControllerHandler } from "../src/server/WebSocketControllerHandler.js";

const NODE_ID = NodeId(1);
const NEW_ENDPOINT = EndpointNumber(7);

function createFakeCommandHandler() {
    const events = {
        attributeChanged: new Observable(),
        eventChanged: new Observable(),
        nodeAdded: new Observable(),
        nodeStateChanged: new Observable(),
        nodeAvailabilityChanged: new Observable(),
        nodeStructureChanged: new Observable<[nodeId: NodeId]>(),
        nodeDecommissioned: new Observable(),
        nodeEndpointAdded: new Observable<[nodeId: NodeId, endpointId: EndpointNumber]>(),
        nodeEndpointRemoved: new Observable(),
        webRtcCallback: new Observable(),
    };
    const endpoints = new Set<number>([0]);

    return {
        events,
        endpoints,
        getNodeIds: () => [NODE_ID],
        hasNode: () => true,
        formatNode: (nodeId: NodeId) => `test-node-${nodeId}`,
        bleEnabled: false,
        bleProxyEnabled: false,
        getCommissionerNodeId: () => NodeId(112233),
        start: async () => {},
        getCommissionerFabricData: async () => ({ fabricId: 1n, compressedFabricId: 1n, fabricIndex: 1 }),
        initializeNodes: async () => {},
        ensureNodePopulated: async () => {},
        getNodeDetails: () => ({
            node_id: NODE_ID,
            date_commissioned: "2026-01-01T00:00:00",
            last_interview: "2026-01-01T00:00:00",
            interview_version: 6,
            available: true,
            is_bridge: false,
            attributes: Object.fromEntries([...endpoints].map(endpoint => [`${endpoint}/29/0`, []])),
            attribute_subscriptions: [],
        }),
    };
}

/** Waits until a condition holds, failing the test on timeout unless `required` is false. */
async function waitFor(condition: () => boolean, required = true, timeoutMs = 5_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (condition()) return;
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    if (required) {
        throw new Error("Timed out waiting for the expected frames");
    }
}

describe("endpoint event order", () => {
    let httpServer: Server;
    let handler: WebSocketControllerHandler;
    let client: WebSocket;
    let fakeCommandHandler: ReturnType<typeof createFakeCommandHandler>;
    let originalEmit: typeof WebSocketServer.prototype.emit;

    beforeEach(async () => {
        originalEmit = WebSocketServer.prototype.emit;
        const env = new Environment("test");
        new MockStorageService(env);
        const config = await ConfigStorage.create(env);
        fakeCommandHandler = createFakeCommandHandler();
        const fakeController = {
            commandHandler: fakeCommandHandler,
            threadDiagnostics: { events: { batchUpdated: new Observable() } },
        } as unknown as MatterController;
        handler = new WebSocketControllerHandler(fakeController, config, "endpoint-order-test");

        httpServer = createServer();
        await new Promise<void>((resolve, reject) => {
            httpServer.once("error", reject);
            httpServer.listen(0, "127.0.0.1", () => resolve());
        });
        await handler.register(httpServer);
    });

    afterEach(async () => {
        WebSocketServer.prototype.emit = originalEmit;
        client?.close();
        await handler?.unregister().catch(() => undefined);
        await new Promise<void>(resolve => httpServer.close(() => resolve()));
    });

    it("sends the node snapshot carrying a new endpoint before announcing it", async () => {
        const address = httpServer.address();
        if (address === null || typeof address === "string") {
            throw new Error("HTTP server is not listening on a port");
        }
        client = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
        const frames = new Array<Record<string, any>>();
        client.on("message", data => frames.push(JSON.parse(data.toString())));
        await new Promise<void>((resolve, reject) => {
            client.once("open", () => resolve());
            client.once("error", reject);
        });
        client.send(JSON.stringify({ message_id: "1", command: "start_listening", args: {} }));
        // Events are only sent to a connection that finished start_listening, so its response is
        // what makes the emits below observable.
        await waitFor(() => frames.some(frame => frame.message_id === "1"));
        frames.length = 0;

        // The controller updates the cache, announces the new structure and drains the queued
        // endpoint adds in one go - the sequence #handleNodeStructureChange produces.
        fakeCommandHandler.endpoints.add(NEW_ENDPOINT);
        fakeCommandHandler.events.nodeStructureChanged.emit(NODE_ID);
        fakeCommandHandler.events.nodeEndpointAdded.emit(NODE_ID, NEW_ENDPOINT);

        await waitFor(() => frames.some(frame => frame.event === "endpoint_added"));
        // node_updated is deferred by one turn of the event loop, so let that turn happen before
        // reading the order - a snapshot arriving late is the defect under test.
        await waitFor(() => frames.some(frame => frame.event === "node_updated"), false);

        const events = frames.filter(frame => frame.event !== undefined).map(frame => frame.event);
        const updatedAt = events.indexOf("node_updated");
        const addedAt = events.indexOf("endpoint_added");
        expect(updatedAt, `events: ${events.join(", ")}`).to.be.greaterThan(-1);
        expect(addedAt, `events: ${events.join(", ")}`).to.be.greaterThan(-1);
        expect(updatedAt).to.be.lessThan(addedAt);

        const snapshot = frames.find(frame => frame.event === "node_updated");
        expect(Object.keys(snapshot!.data.attributes)).to.include(`${NEW_ENDPOINT}/29/0`);
    });
});
