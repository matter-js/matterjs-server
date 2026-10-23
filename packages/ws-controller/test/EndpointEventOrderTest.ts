/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Order and content of node events on the wire. The python-matter-server API orders the node
 * snapshot before the announcement of a new endpoint: a client resolves the endpoint against the
 * node model it builds from node_updated, so an endpoint_added that arrives first names an endpoint
 * it does not know.
 */

import { Environment, MockStorageService, NodeId, Observable } from "@matter/main";
import { AttributeId, ClusterId, EndpointNumber, EventId, EventNumber, Priority } from "@matter/main/types";
import { createServer, type Server } from "node:http";
import { WebSocket } from "ws";
import { MatterController } from "../src/controller/MatterController.js";
import type { AttributeChange, EventChange } from "../src/controller/PeerChangeBus.js";
import { ConfigStorage } from "../src/server/ConfigStorage.js";
import { WebSocketControllerHandler } from "../src/server/WebSocketControllerHandler.js";

const NODE_ID = NodeId(1);
const OTHER_NODE_ID = NodeId(2);
const NEW_ENDPOINT = EndpointNumber(7);
const VENDOR_CLUSTER = 0xfff1fc00;

function createFakeCommandHandler() {
    const events = {
        attributeChanged: new Observable<[nodeId: NodeId, data: AttributeChange]>(),
        eventChanged: new Observable<[nodeId: NodeId, data: EventChange]>(),
        nodeAdded: new Observable<[nodeId: NodeId]>(),
        nodeStateChanged: new Observable(),
        nodeAvailabilityChanged: new Observable(),
        nodeStructureChanged: new Observable<[nodeId: NodeId]>(),
        nodeDecommissioned: new Observable<[nodeId: NodeId]>(),
        nodeEndpointAdded: new Observable<[nodeId: NodeId, endpointId: EndpointNumber]>(),
        nodeEndpointRemoved: new Observable<[nodeId: NodeId, endpointId: EndpointNumber]>(),
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

describe("node events on the wire", () => {
    let httpServer: Server;
    let handler: WebSocketControllerHandler;
    let client: WebSocket;
    let fakeCommandHandler: ReturnType<typeof createFakeCommandHandler>;

    beforeEach(async () => {
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
        client?.close();
        await handler?.unregister().catch(() => undefined);
        await new Promise<void>(resolve => httpServer.close(() => resolve()));
    });

    /** Connects a client that finished `start_listening` and returns the frames it receives from then on. */
    async function listen() {
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
        // what makes the caller's emits observable.
        await waitFor(() => frames.some(frame => frame.message_id === "1"));
        frames.length = 0;
        return frames;
    }

    it("sends the node snapshot carrying a new endpoint before announcing it", async () => {
        const frames = await listen();

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

    it("sends a removed attribute as attribute_updated with null", async () => {
        const frames = await listen();
        fakeCommandHandler.events.attributeChanged.emit(NODE_ID, {
            path: { endpointId: EndpointNumber(1), clusterId: ClusterId(6), attributeId: AttributeId(0) },
            value: undefined,
        });
        await waitFor(() => frames.some(frame => frame.event === "attribute_updated"));

        const updates = frames.filter(frame => frame.event === "attribute_updated").map(frame => frame.data.slice(1));
        expect(updates).to.deep.equal([["1/6/0", null]]);
    });

    it("replaces a value queued before a removal of the same attribute", async () => {
        const frames = await listen();
        const change = (clusterId: number, attributeId: number, value: unknown) => ({
            path: {
                endpointId: EndpointNumber(1),
                clusterId: ClusterId(clusterId),
                attributeId: AttributeId(attributeId),
            },
            value,
        });

        // Writing far beyond the high-water mark puts the connection into queued mode, where same-path sends coalesce.
        const filler = "x".repeat(256 * 1024);
        for (let attributeId = 0; attributeId < 40; attributeId++) {
            fakeCommandHandler.events.attributeChanged.emit(NODE_ID, change(VENDOR_CLUSTER, attributeId, filler));
        }
        fakeCommandHandler.events.attributeChanged.emit(NODE_ID, change(6, 0, true));
        fakeCommandHandler.events.attributeChanged.emit(NODE_ID, change(6, 0, undefined));
        fakeCommandHandler.events.attributeChanged.emit(NODE_ID, change(6, 16384, true));

        await waitFor(() => frames.some(frame => frame.event === "attribute_updated" && frame.data[1] === "1/6/16384"));
        const updates = frames.filter(frame => frame.event === "attribute_updated").map(frame => frame.data.slice(1));
        expect(updates.filter(([path]) => path === "1/6/0")).to.deep.equal([["1/6/0", null]]);
        expect(updates.map(([path]) => path)).to.include(`1/${VENDOR_CLUSTER}/39`);
    });

    describe("on a congested connection", () => {
        const FILLER_COUNT = 40;
        const LAST_FILLER = `${OTHER_NODE_ID}:1/${VENDOR_CLUSTER}/${FILLER_COUNT - 1}`;

        /** Writes far beyond the high-water mark for another node, which puts the connection into queued mode. */
        function congest() {
            const filler = "x".repeat(256 * 1024);
            for (let attributeId = 0; attributeId < FILLER_COUNT; attributeId++) {
                fakeCommandHandler.events.attributeChanged.emit(OTHER_NODE_ID, {
                    path: {
                        endpointId: EndpointNumber(1),
                        clusterId: ClusterId(VENDOR_CLUSTER),
                        attributeId: AttributeId(attributeId),
                    },
                    value: filler,
                });
            }
        }

        function event(nodeId: NodeId, eventNumber: number) {
            fakeCommandHandler.events.eventChanged.emit(nodeId, {
                path: { endpointId: EndpointNumber(1), clusterId: ClusterId(6), eventId: EventId(0) },
                events: [
                    {
                        eventNumber: EventNumber(BigInt(eventNumber)),
                        priority: Priority.Info,
                        systemTimestamp: Date.now(),
                        data: {},
                    },
                ],
            });
        }

        function namesOf(frames: Record<string, any>[]) {
            return frames.map(frame =>
                frame.event === "attribute_updated"
                    ? `attribute_updated ${frame.data[0]}:${frame.data[1]}`
                    : frame.event,
            );
        }

        it("sends node and endpoint events in order behind the data queued before them", async () => {
            const frames = await listen();
            congest();
            // Two values for one attribute merge into one frame only while the connection queues.
            for (const value of [false, true]) {
                fakeCommandHandler.events.attributeChanged.emit(NODE_ID, {
                    path: { endpointId: EndpointNumber(1), clusterId: ClusterId(6), attributeId: AttributeId(0) },
                    value,
                });
            }
            fakeCommandHandler.events.nodeEndpointRemoved.emit(NODE_ID, EndpointNumber(5));
            fakeCommandHandler.endpoints.add(NEW_ENDPOINT);
            fakeCommandHandler.events.nodeStructureChanged.emit(NODE_ID);
            fakeCommandHandler.events.nodeEndpointAdded.emit(NODE_ID, NEW_ENDPOINT);

            await waitFor(() => frames.some(frame => frame.event === "endpoint_added"));
            const names = namesOf(frames);
            expect(frames.filter(frame => frame.data?.[1] === "1/6/0").map(frame => frame.data[2])).to.deep.equal([
                true,
            ]);
            const lastFillerAt = names.indexOf(`attribute_updated ${LAST_FILLER}`);
            expect(lastFillerAt, names.join(", ")).to.be.greaterThan(-1);
            expect(names.slice(lastFillerAt + 1)).to.deep.equal([
                `attribute_updated ${NODE_ID}:1/6/0`,
                "endpoint_removed",
                "node_updated",
                "endpoint_added",
            ]);
        });

        it("never drops node and endpoint events when the queue overflows", async () => {
            const frames = await listen();
            congest();
            fakeCommandHandler.events.nodeAdded.emit(NODE_ID);
            fakeCommandHandler.events.nodeEndpointRemoved.emit(NODE_ID, EndpointNumber(5));
            fakeCommandHandler.endpoints.add(NEW_ENDPOINT);
            fakeCommandHandler.events.nodeStructureChanged.emit(NODE_ID);
            fakeCommandHandler.events.nodeEndpointAdded.emit(NODE_ID, NEW_ENDPOINT);
            fakeCommandHandler.events.nodeDecommissioned.emit(NodeId(3));
            // More events than the queue cap of 1000, so the oldest droppable frames are dropped.
            for (let eventNumber = 0; eventNumber < 1100; eventNumber++) {
                event(OTHER_NODE_ID, eventNumber);
            }

            await waitFor(() => frames.some(frame => frame.event === "node_event" && frame.data.event_number === 1099));
            const names = namesOf(frames);
            expect(names.filter(name => name === "node_event").length).to.be.lessThan(1100);
            expect(names.filter(name => !name.startsWith("attribute_updated") && name !== "node_event")).to.deep.equal([
                "node_added",
                "endpoint_removed",
                "node_updated",
                "endpoint_added",
                "node_removed",
            ]);
        });
    });
});
