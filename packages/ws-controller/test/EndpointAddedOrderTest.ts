/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Environment, FabricId, MockStorageService, NodeId, Observable } from "@matter/main";
import { EndpointNumber } from "@matter/main/types";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import type { MatterController } from "../src/controller/MatterController.js";
import { ConfigStorage } from "../src/server/ConfigStorage.js";
import { WebSocketControllerHandler } from "../src/server/WebSocketControllerHandler.js";

const NODE_ID = NodeId(7);

function createFakeCommandHandler() {
    return {
        events: {
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
        },
        getNodeIds: () => [NODE_ID],
        hasNode: (nodeId: NodeId) => nodeId === NODE_ID,
        formatNode: (nodeId: NodeId) => `test-node-${nodeId}`,
        getNodeDetails: (nodeId: NodeId) => ({ node_id: nodeId, available: true, attributes: {} }),
        bleEnabled: false,
        bleProxyEnabled: false,
        getCommissionerNodeId: () => NodeId(112233),
        start: async () => {},
        getCommissionerFabricData: async () => ({ fabricId: FabricId(1), compressedFabricId: 1n, fabricIndex: 1 }),
        initializeNodes: async () => {},
    };
}

describe("endpoint_added ordering", function () {
    this.timeout(20_000);

    let config: ConfigStorage;
    let handler: WebSocketControllerHandler;
    let httpServer: Server;
    let client: WebSocket;
    let fake: ReturnType<typeof createFakeCommandHandler>;
    const received = new Array<Record<string, unknown>>();

    beforeEach(async () => {
        const env = new Environment("test");
        new MockStorageService(env);
        config = await ConfigStorage.create(env);
        fake = createFakeCommandHandler();
        const controller = {
            commandHandler: fake,
            threadDiagnostics: { events: { batchUpdated: new Observable() } },
        } as unknown as MatterController;
        handler = new WebSocketControllerHandler(controller, config, "endpoint-added-order-test");
        httpServer = createServer();
        await new Promise<void>(resolve => httpServer.listen(0, "127.0.0.1", () => resolve()));
        await handler.register(httpServer);

        const { port } = httpServer.address() as AddressInfo;
        client = new WebSocket(`ws://127.0.0.1:${port}/ws`);
        client.on("message", raw => received.push(JSON.parse(String(raw))));
        await once(client, "open");
        client.send(JSON.stringify({ message_id: "start", command: "start_listening" }));
        await waitFor(() => received.some(msg => msg.message_id === "start"));
    });

    afterEach(async () => {
        client.terminate();
        await handler.unregister().catch(() => undefined);
        await new Promise<void>(resolve => httpServer.close(() => resolve()));
        await config.close();
        received.length = 0;
    });

    it("sends the node snapshot before endpoint_added for a new endpoint", async () => {
        // Same order the controller emits them in: structure change first, then the endpoint.
        fake.events.nodeStructureChanged.emit(NODE_ID);
        fake.events.nodeEndpointAdded.emit(NODE_ID, EndpointNumber(3));

        await waitFor(() => received.some(msg => msg.event === "endpoint_added"));

        const events = received.filter(msg => typeof msg.event === "string").map(msg => msg.event);
        const snapshotIndex = events.indexOf("node_updated");
        const endpointIndex = events.indexOf("endpoint_added");
        expect(snapshotIndex, "node_updated was not sent").to.be.at.least(0);
        expect(endpointIndex, "endpoint_added was not sent").to.be.at.least(0);
        expect(snapshotIndex).to.be.lessThan(endpointIndex);
    });
});

async function waitFor(predicate: () => boolean, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    while (!predicate()) {
        if (Date.now() > deadline) throw new Error("timed out waiting for condition");
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}
