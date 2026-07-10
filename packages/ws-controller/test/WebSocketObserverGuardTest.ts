/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Regression tests for the observer guards in WebSocketControllerHandler's shared
 * attributeChanged/eventChanged observers (and the direct-mode build guard in
 * WebSocketConnection beneath them).
 *
 * Those observers are registered once per connection on command-handler observables shared by
 * every open connection. Before the guards, a throw inside one connection's observer body — a
 * converter rejecting a poisoned value, or the connection's own send path failing — escaped into
 * `Observable.emit`, aborting the emit and starving every observer registered after it: other
 * connections silently stopped receiving that event and, for the same emit, everything behind it.
 *
 * These tests drive a real WebSocketControllerHandler over a real `ws` client/server pair with TWO
 * client connections (same harness shape as WsBackpressureReproTest.ts / the serialization test)
 * and prove the guards' core guarantee: (1) no throw escapes the emit, (2) the other connection is
 * still fed, (3) subsequent clean emits are delivered normally.
 */

import { Environment, FabricId, MockStorageService, NodeId, Observable } from "@matter/main";
import { AttributeId, ClusterId, EndpointNumber, EventId, EventNumber, Priority } from "@matter/main/types";
import type { DecodedAttributeReportValue, DecodedEventReportValue } from "@project-chip/matter.js/cluster";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket, WebSocketServer } from "ws";
import type { MatterController } from "../src/controller/MatterController.js";
import { ConfigStorage } from "../src/server/ConfigStorage.js";
import { WebSocketControllerHandler } from "../src/server/WebSocketControllerHandler.js";

const NODE_ID = NodeId(1);

// WindowCovering.ConfigStatus (attribute 7) is a real bitmap-typed attribute; a bit field set to a
// string makes the real converter throw ("Invalid bitmap value") — same poison as
// AttributeDataCacheTest.ts. For attributeChanged the conversion runs inside the lazy frame build.
const WINDOW_COVERING_CLUSTER_ID = ClusterId(258);
const CONFIG_STATUS_ATTRIBUTE_ID = AttributeId(7);

// BooleanStateConfiguration.AlarmsStateChanged (event 0) carries bitmap-typed fields; a poisoned
// bit field makes the real converter throw *directly in the eventChanged observer body* (event
// conversion is not deferred into a lazy build), exercising the handler-level guard specifically.
const BOOLEAN_STATE_CONFIGURATION_CLUSTER_ID = ClusterId(128);
const ALARMS_STATE_CHANGED_EVENT_ID = EventId(0);

function attributeReport(endpointId: number, value: unknown): DecodedAttributeReportValue<unknown> {
    return {
        path: {
            endpointId: EndpointNumber(endpointId),
            clusterId: WINDOW_COVERING_CLUSTER_ID,
            attributeId: CONFIG_STATUS_ATTRIBUTE_ID,
            attributeName: "configStatus",
        },
        version: 1,
        value,
    };
}

function alarmsEventReport(data: unknown): DecodedEventReportValue<unknown> {
    return {
        path: {
            endpointId: EndpointNumber(1),
            clusterId: BOOLEAN_STATE_CONFIGURATION_CLUSTER_ID,
            eventId: ALARMS_STATE_CHANGED_EVENT_ID,
            eventName: "alarmsStateChanged",
        },
        events: [
            {
                eventNumber: EventNumber(1n),
                priority: Priority.Info,
                systemTimestamp: Date.now(),
                data,
            },
        ],
    };
}

/**
 * Minimal stand-in for `ControllerCommandHandler` exposing only the surface
 * `WebSocketControllerHandler.register()`/`start_listening` touch (see WsBackpressureReproTest.ts
 * for the rationale on the cast-based fake — the real class needs a live CommissioningController).
 */
function createFakeCommandHandler() {
    return {
        events: {
            attributeChanged: new Observable<[nodeId: NodeId, data: DecodedAttributeReportValue<unknown>]>(),
            eventChanged: new Observable<[nodeId: NodeId, data: DecodedEventReportValue<unknown>]>(),
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
    };
}

async function createHarness() {
    const env = new Environment("test");
    new MockStorageService(env);
    const config = await ConfigStorage.create(env);

    const fakeCommandHandler = createFakeCommandHandler();
    const fakeController = {
        commandHandler: fakeCommandHandler,
        threadDiagnostics: { events: { batchUpdated: new Observable() } },
    } as unknown as MatterController;

    const handler = new WebSocketControllerHandler(fakeController, config, "observer-guard-test");

    const httpServer = createServer();
    await new Promise<void>((resolve, reject) => {
        httpServer.once("error", reject);
        httpServer.listen(0, "127.0.0.1", () => resolve());
    });

    await handler.register(httpServer);

    return { env, config, fakeCommandHandler, handler, httpServer };
}

/** Captures server-side `ws.WebSocket` instances in connect order (same tap as WsBackpressureReproTest.ts). */
function captureServerSocket() {
    const captured = new Array<WebSocket>();
    const originalEmit = WebSocketServer.prototype.emit;
    WebSocketServer.prototype.emit = function (this: WebSocketServer, event: string, ...args: unknown[]) {
        if (event === "connection") {
            captured.push(args[0] as WebSocket);
        }
        return (originalEmit as (...a: unknown[]) => boolean).apply(this, [event, ...args]);
    } as typeof WebSocketServer.prototype.emit;

    return {
        get(index: number): WebSocket {
            const socket = captured[index];
            if (!socket) throw new Error(`No server-side connection captured at index ${index}`);
            return socket;
        },
        restore: () => {
            WebSocketServer.prototype.emit = originalEmit;
        },
    };
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

/** Predicate for an attribute_updated frame for a given "endpoint/cluster/attribute" path. */
function attributeUpdatedFor(path: string) {
    return (msg: WsMessage) =>
        msg.event === "attribute_updated" && Array.isArray(msg.data) && (msg.data as unknown[])[1] === path;
}

function nodeEventForCluster(clusterId: number) {
    return (msg: WsMessage) =>
        msg.event === "node_event" && (msg.data as { cluster_id?: number } | undefined)?.cluster_id === clusterId;
}

describe("WebSocketControllerHandler observer guards", () => {
    let harness: Awaited<ReturnType<typeof createHarness>>;
    let capture: ReturnType<typeof captureServerSocket>;
    let clientA: WebSocket;
    let clientB: WebSocket;
    let messagesA: ReturnType<typeof createMessageBuffer>;
    let messagesB: ReturnType<typeof createMessageBuffer>;

    async function connectListeningClient(tag: string) {
        const address = harness.httpServer.address() as AddressInfo;
        const client = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
        client.on("error", () => undefined);
        const messages = createMessageBuffer(client);
        await once(client, "open");
        await messages.wait(msg => "sdk_version" in msg); // initial server_info
        client.send(JSON.stringify({ message_id: tag, command: "start_listening", args: {} }));
        await messages.wait(msg => msg.message_id === tag);
        return { client, messages };
    }

    beforeEach(async () => {
        harness = await createHarness();
        capture = captureServerSocket();
        // Connect A fully before B so A's observers are registered first on the shared observables:
        // pre-guard, a throw in A's observer is exactly what starved B (registered after A) mid-emit.
        ({ client: clientA, messages: messagesA } = await connectListeningClient("startA"));
        ({ client: clientB, messages: messagesB } = await connectListeningClient("startB"));
    });

    afterEach(async () => {
        capture?.restore();
        for (const client of [clientA, clientB]) {
            if (client && (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING)) {
                client.terminate();
            }
        }
        await harness?.handler.unregister().catch(() => undefined);
        if (harness) {
            await new Promise<void>(resolve => harness.httpServer.close(() => resolve()));
            await harness.config.close();
        }
    });

    it("keeps the other connection fed within the same emit when one connection's send path throws (attributeChanged)", async () => {
        // Break connection A's send path only: its server-side socket throws synchronously on send,
        // standing in for any unexpected per-connection failure while building/sending the frame.
        // The conversion itself succeeds, so the throw surfaces in A's observer body — exactly what
        // the handler-level guard must contain so B's observer (registered after A) still runs.
        const serverSocketA = capture.get(0);
        const originalSend = serverSocketA.send.bind(serverSocketA);
        (serverSocketA as { send: unknown }).send = () => {
            throw new Error("simulated synchronous send failure");
        };

        // (1) The throw from A's send path must not escape the emit.
        expect(() =>
            harness.fakeCommandHandler.events.attributeChanged.emit(NODE_ID, attributeReport(1, {})),
        ).to.not.throw();

        // (2) B, registered after A on the same observable, still receives its update for that emit.
        const received = await messagesB.wait(attributeUpdatedFor("1/258/7"));
        expect((received.data as unknown[])[2]).to.equal(0); // {} converts to bitmap 0

        // (3) With A's send path healed, a subsequent clean emit is delivered normally to BOTH —
        // proving A's connection survived its own failure rather than being wedged or dropped.
        (serverSocketA as { send: unknown }).send = originalSend;
        expect(() =>
            harness.fakeCommandHandler.events.attributeChanged.emit(NODE_ID, attributeReport(2, {})),
        ).to.not.throw();
        await messagesA.wait(attributeUpdatedFor("2/258/7"));
        await messagesB.wait(attributeUpdatedFor("2/258/7"));
    });

    it("contains a poisoned event conversion so the emit completes and clean events still flow (eventChanged)", async () => {
        // The bitmap conversion throws in the observer body for every connection (the poisoned value
        // is shared), so pre-guard the FIRST observer's throw aborted the emit itself.
        expect(() =>
            harness.fakeCommandHandler.events.eventChanged.emit(
                NODE_ID,
                alarmsEventReport({ alarmsActive: { visual: "poison" } }),
            ),
        ).to.not.throw();

        // A subsequent clean event is delivered normally to both connections.
        expect(() =>
            harness.fakeCommandHandler.events.eventChanged.emit(
                NODE_ID,
                alarmsEventReport({ alarmsActive: { visual: true }, alarmsSuppressed: {} }),
            ),
        ).to.not.throw();
        const [eventA, eventB] = await Promise.all([
            messagesA.wait(nodeEventForCluster(128)),
            messagesB.wait(nodeEventForCluster(128)),
        ]);
        expect((eventA.data as { data: unknown }).data).to.deep.equal({ alarmsActive: 1, alarmsSuppressed: 0 });
        expect((eventB.data as { data: unknown }).data).to.deep.equal({ alarmsActive: 1, alarmsSuppressed: 0 });
    });

    it("contains a poisoned attribute value so the emit completes and clean updates still flow (attributeChanged)", async () => {
        // For attributeChanged the conversion runs inside the lazy frame build, so in direct mode
        // this exercises the connection-level build guard beneath the observer guard — the layered
        // behavior end-to-end: the poisoned update is dropped per connection, the emit completes.
        expect(() =>
            harness.fakeCommandHandler.events.attributeChanged.emit(
                NODE_ID,
                attributeReport(1, { operational: "poison" }),
            ),
        ).to.not.throw();

        // A subsequent clean update is delivered normally to both connections.
        expect(() =>
            harness.fakeCommandHandler.events.attributeChanged.emit(NODE_ID, attributeReport(2, {})),
        ).to.not.throw();
        await messagesA.wait(attributeUpdatedFor("2/258/7"));
        await messagesB.wait(attributeUpdatedFor("2/258/7"));
    });
});
