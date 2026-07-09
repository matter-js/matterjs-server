/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Device-free reproduction test for docs/plans/ws-backpressure.md: WebSocketControllerHandler's
 * ~12 `ws.send()` call sites are guarded only by `readyState`/`listening`, with no
 * `ws.bufferedAmount` check anywhere. If a client stops reading while its socket stays OPEN, the
 * `ws` library queues every unsent frame in-process without limit.
 *
 * This test drives the real `attributeChanged`/`eventChanged` observables that
 * `WebSocketControllerHandler.register()` subscribes to (the same ones a real subscription
 * report would fire), against a real `ws` client/server pair, with the client socket paused so it
 * never drains. It then measures the server-side `ws.bufferedAmount` to prove the queue grows
 * without bound on the current (unfixed) code. No real Matter node or network is involved: a
 * minimal stand-in for `ControllerCommandHandler` supplies the event observables directly, since
 * the real class requires a live `CommissioningController`.
 */

import { Environment, FabricId, MockStorageService, NodeId, Observable } from "@matter/main";
import { AttributeId, ClusterId, EndpointNumber, EventId, EventNumber, Priority } from "@matter/main/types";
import type { DecodedAttributeReportValue, DecodedEventReportValue } from "@project-chip/matter.js/cluster";
import { NodeStates } from "@project-chip/matter.js/device";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { WebSocket, WebSocketServer } from "ws";
import type { MatterController } from "../src/controller/MatterController.js";
import { ConfigStorage } from "../src/server/ConfigStorage.js";
import { WebSocketControllerHandler } from "../src/server/WebSocketControllerHandler.js";

/** Simulated fleet: ~12 energy plugs, 4 metered endpoints each (matches the plan doc's volume driver). */
const DEVICE_COUNT = 12;
const ENDPOINTS_PER_DEVICE = 4;
/** ElectricalEnergyMeasurement cluster id (0x0091) - the real cluster driving the volume in production. */
const ENERGY_CLUSTER_ID = ClusterId(0x91);
const ENERGY_ATTRIBUTE_IDS = [AttributeId(0), AttributeId(1), AttributeId(2)];

/**
 * Rounds for the stalled-client flood. Comfortably past the ~275 rounds that drove `bufferedAmount`
 * past 2 MiB before the fix, so a bounded curve across the whole run is real proof the cap holds and
 * not just a slow-start artifact.
 */
const FIXED_FLOOD_ROUNDS = 500;
/** Rounds for the actively-reading control (bounded; it never accumulates). */
const CONTROL_ROUNDS = 400;
/** Sample bufferedAmount/RSS every N rounds to build a growth curve. */
const SAMPLE_EVERY_ROUNDS = 25;
/** Plan doc's HIGH_WATER (1 MiB): the direct→queued trip point a fix would add. */
const HIGH_WATER = 1_048_576;
/** Stalled-client growth target: clearing 2× HIGH_WATER proves nothing caps the queue today. */
const GROWTH_TARGET = HIGH_WATER * 2;

interface FakeEvents {
    attributeChanged: Observable<[nodeId: NodeId, data: DecodedAttributeReportValue<unknown>]>;
    eventChanged: Observable<[nodeId: NodeId, data: DecodedEventReportValue<unknown>]>;
    nodeAdded: Observable<[nodeId: NodeId]>;
    nodeStateChanged: Observable<[nodeId: NodeId, state: NodeStates]>;
    nodeAvailabilityChanged: Observable<[nodeId: NodeId, available: boolean]>;
    nodeStructureChanged: Observable<[nodeId: NodeId]>;
    nodeDecommissioned: Observable<[nodeId: NodeId]>;
    nodeEndpointAdded: Observable<[nodeId: NodeId, endpointId: EndpointNumber]>;
    nodeEndpointRemoved: Observable<[nodeId: NodeId, endpointId: EndpointNumber]>;
    webRtcCallback: Observable<[data: unknown]>;
}

/**
 * Minimal stand-in for `ControllerCommandHandler` exposing only the surface
 * `WebSocketControllerHandler.register()` and `start_listening` touch. The real class requires a
 * live `CommissioningController` (mDNS, sessions, fabric) to construct; its public members are
 * classic TS `private`/`#` fields, so no plain object is structurally assignable to it. The cast
 * at the call site is the only way to supply a collaborator here without changing production code
 * to add a test seam.
 */
function createFakeCommandHandler() {
    const events: FakeEvents = {
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

    return {
        events,
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

type FakeCommandHandler = ReturnType<typeof createFakeCommandHandler>;

async function createHarness() {
    const env = new Environment("test");
    new MockStorageService(env);
    const config = await ConfigStorage.create(env);

    const fakeCommandHandler = createFakeCommandHandler();
    // register() subscribes to the controller-level thread-diagnostics + network-topology observables; supply just those.
    const fakeController = {
        commandHandler: fakeCommandHandler,
        threadDiagnostics: { events: { batchUpdated: new Observable() } },
        networkTopology: { events: { topologyUpdated: new Observable() } },
    } as unknown as MatterController;

    const handler = new WebSocketControllerHandler(fakeController, config, "backpressure-repro-test");

    const httpServer = createServer();
    await new Promise<void>((resolve, reject) => {
        httpServer.once("error", reject);
        httpServer.listen(0, "127.0.0.1", () => resolve());
    });

    await handler.register(httpServer);

    return { env, config, fakeCommandHandler, handler, httpServer };
}

/** Captures the server-side `ws.WebSocket` instances by tapping `WebSocketServer`'s `connection` event, in connect order. */
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
        get(index = captured.length - 1): WebSocket {
            const socket = captured[index];
            if (!socket) throw new Error(`No server-side connection captured at index ${index}`);
            return socket;
        },
        restore: () => {
            WebSocketServer.prototype.emit = originalEmit;
        },
    };
}

/**
 * Buffers every parsed message from `ws` starting at construction time, so `wait()` can never miss
 * a message that arrives in the gap between the `open` event and a later `await`.
 */
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

interface Sample {
    round: number;
    attributesSent: number;
    bufferedAmount: number;
    rssMb: number;
}

/** Fires one round of attribute + event bursts across the simulated device fleet directly on the event observables. */
function fireRound(fakeCommandHandler: FakeCommandHandler, round: number): number {
    let sent = 0;
    for (let device = 1; device <= DEVICE_COUNT; device++) {
        const nodeId = NodeId(device);
        for (let endpoint = 1; endpoint <= ENDPOINTS_PER_DEVICE; endpoint++) {
            for (const attributeId of ENERGY_ATTRIBUTE_IDS) {
                const data: DecodedAttributeReportValue<unknown> = {
                    path: {
                        endpointId: EndpointNumber(endpoint),
                        clusterId: ENERGY_CLUSTER_ID,
                        attributeId,
                        attributeName: "energyAttribute",
                    },
                    version: round,
                    value: round * 1000 + endpoint * 10 + Number(attributeId),
                };
                fakeCommandHandler.events.attributeChanged.emit(nodeId, data);
                sent++;
            }
        }
        // One periodic-energy event per device per round, matching the plan doc's second volume source.
        const eventData: DecodedEventReportValue<unknown> = {
            path: {
                endpointId: EndpointNumber(1),
                clusterId: ENERGY_CLUSTER_ID,
                eventId: EventId(1),
                eventName: "periodicEnergyMeasured",
            },
            events: [
                {
                    eventNumber: EventNumber(BigInt(round * DEVICE_COUNT + device)),
                    priority: Priority.Info,
                    systemTimestamp: Date.now(),
                    data: { energy: round * 1000 },
                },
            ],
        };
        fakeCommandHandler.events.eventChanged.emit(nodeId, eventData);
    }
    return sent;
}

interface FloodResult {
    samples: Sample[];
    rounds: number;
    finalBufferedAmount: number;
    /** True when `stopWhen` fired before the round cap was reached. */
    stopped: boolean;
}

/**
 * Drives up to `maxRounds` of {@link fireRound}, sampling `getBufferedAmount()`/RSS every
 * `sampleEvery` rounds and stopping early once `stopWhen(bufferedAmount)` holds. Yields to the
 * event loop after each round via `setImmediate` so a client that is actively reading gets a real
 * chance to drain between rounds - otherwise the growth we observe could just be an artifact of a
 * tight synchronous loop starving I/O, not proof that a stalled consumer specifically is the cause.
 */
async function floodAttributes(
    fakeCommandHandler: FakeCommandHandler,
    maxRounds: number,
    sampleEvery: number,
    getBufferedAmount: () => number,
    stopWhen: (bufferedAmount: number) => boolean = () => false,
): Promise<FloodResult> {
    const samples = new Array<Sample>();
    let attributesSent = 0;
    let round = 0;
    let bufferedAmount = getBufferedAmount();
    let stopped = false;
    while (round < maxRounds) {
        round++;
        attributesSent += fireRound(fakeCommandHandler, round);
        bufferedAmount = getBufferedAmount();
        if (round % sampleEvery === 0) {
            samples.push({
                round,
                attributesSent,
                bufferedAmount,
                rssMb: process.memoryUsage().rss / (1024 * 1024),
            });
        }
        if (stopWhen(bufferedAmount)) {
            stopped = true;
            break;
        }
        await new Promise(resolve => setImmediate(resolve));
    }
    return { samples, rounds: round, finalBufferedAmount: bufferedAmount, stopped };
}

function logCurve(label: string, result: FloodResult) {
    console.log(
        `${label} (stopped=${result.stopped} after ${result.rounds} rounds, final bufferedAmount=${result.finalBufferedAmount}):\n` +
            result.samples
                .map(
                    s =>
                        `  round=${s.round} attrs=${s.attributesSent} bufferedAmount=${s.bufferedAmount} rss=${s.rssMb.toFixed(1)}MB`,
                )
                .join("\n"),
    );
}

describe("WS backpressure repro (docs/plans/ws-backpressure.md)", function () {
    this.timeout(60_000);

    let harness: Awaited<ReturnType<typeof createHarness>>;
    let capture: ReturnType<typeof captureServerSocket>;
    let client: WebSocket;
    let messages: ReturnType<typeof createMessageBuffer>;

    beforeEach(async () => {
        harness = await createHarness();
        capture = captureServerSocket();

        const address = harness.httpServer.address() as AddressInfo;
        client = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
        client.on("error", () => {
            // Expected once the client is terminated with a huge unflushed backlog.
        });
        // Attach the message buffer before awaiting "open" so the server_info message sent
        // immediately on connect can never race past an unattached listener.
        messages = createMessageBuffer(client);
        await once(client, "open");

        // Drain the automatic server_info message sent right after connect, before start_listening.
        await messages.wait(msg => "sdk_version" in msg);
    });

    afterEach(async () => {
        capture?.restore();
        if (client && (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING)) {
            client.terminate();
        }
        await harness?.handler.unregister().catch(() => undefined);
        if (harness) {
            await new Promise<void>(resolve => harness.httpServer.close(() => resolve()));
            await harness.config.close();
        }
    });

    it("bounds bufferedAmount on a stalled client (backpressure caps the outbound queue)", async () => {
        // Enable the push-event listeners server-side.
        client.send(JSON.stringify({ message_id: "start", command: "start_listening", args: {} }));
        await messages.wait(msg => msg.message_id === "start");

        const serverSocket = capture.get();
        expect(serverSocket.bufferedAmount).to.be.lessThan(HIGH_WATER);

        // Stall the consumer: pause the raw socket so nothing is ever read from it again, while
        // readyState stays OPEN. This is the exact scenario the plan doc describes.
        const rawSocket = (client as unknown as { _socket: Socket })._socket;
        rawSocket.pause();

        // Same flood that drove the queue past 2 MiB before the fix. Now the connection flips to
        // queued mode at HIGH_WATER and gates further sends on the in-flight callback (which never
        // fires on a paused socket), so bufferedAmount plateaus near HIGH_WATER instead of growing.
        // Run the full round budget with no early stop to prove it never crosses the target.
        const result = await floodAttributes(
            harness.fakeCommandHandler,
            FIXED_FLOOD_ROUNDS,
            SAMPLE_EVERY_ROUNDS,
            () => serverSocket.bufferedAmount,
        );
        logCurve("stalled client (fixed): bufferedAmount / RSS curve", result);

        const maxBuffered = Math.max(...result.samples.map(s => s.bufferedAmount), result.finalBufferedAmount);
        // Proof of the fix: with the client stalled, the outbound queue is bounded well below the
        // pre-fix growth target - the backpressure cap held instead of buffering every frame.
        expect(maxBuffered, "bufferedAmount was not bounded below the growth target").to.be.lessThan(GROWTH_TARGET);

        // readyState is still OPEN: the 5-minute watchdog that eventually drops a dead consumer is
        // far longer than this test runs (its disconnect behavior is covered in WebSocketConnectionTest).
        expect(serverSocket.readyState).to.equal(WebSocket.OPEN);
    });

    it("control: bufferedAmount stays near zero when the client keeps reading", async () => {
        // Same flood, same connection setup - the only difference from the repro above is that the
        // client's socket is never paused, so it drains every round. This isolates the pause as the
        // cause of the growth above, ruling out "tight synchronous loop starves I/O regardless" as
        // an alternative explanation.
        client.send(JSON.stringify({ message_id: "start", command: "start_listening", args: {} }));
        await messages.wait(msg => msg.message_id === "start");

        const serverSocket = capture.get();

        const result = await floodAttributes(
            harness.fakeCommandHandler,
            CONTROL_ROUNDS,
            SAMPLE_EVERY_ROUNDS,
            () => serverSocket.bufferedAmount,
        );
        logCurve("actively-reading client: bufferedAmount / RSS curve", result);

        for (const sample of result.samples) {
            expect(sample.bufferedAmount).to.be.lessThan(HIGH_WATER);
        }
    });

    it("isolates backpressure per connection: one stalled client does not throttle a reading one", async () => {
        // A second client connects alongside the beforeEach one; both receive the full flood, but
        // only the first stalls. Backpressure is per-connection, so the reader must keep draining.
        const address = harness.httpServer.address() as AddressInfo;
        const reader = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
        reader.on("error", () => undefined);
        const readerMessages = createMessageBuffer(reader);
        await once(reader, "open");
        await readerMessages.wait(msg => "sdk_version" in msg);

        try {
            client.send(JSON.stringify({ message_id: "start", command: "start_listening", args: {} }));
            await messages.wait(msg => msg.message_id === "start");
            reader.send(JSON.stringify({ message_id: "start", command: "start_listening", args: {} }));
            await readerMessages.wait(msg => msg.message_id === "start");

            const stalledSocket = capture.get(0);
            const readerSocket = capture.get(1);

            // Stall only the first client's raw socket; the reader keeps reading.
            (client as unknown as { _socket: Socket })._socket.pause();

            const result = await floodAttributes(
                harness.fakeCommandHandler,
                FIXED_FLOOD_ROUNDS,
                SAMPLE_EVERY_ROUNDS,
                () => stalledSocket.bufferedAmount,
            );
            logCurve("multi-conn (stalled of two): bufferedAmount / RSS curve", result);

            // Stalled connection stays bounded by its own backpressure...
            const maxStalled = Math.max(...result.samples.map(s => s.bufferedAmount), result.finalBufferedAmount);
            expect(maxStalled, "stalled connection was not bounded").to.be.lessThan(GROWTH_TARGET);
            // ...while the reading connection drained every round, never wedged by the stalled peer.
            expect(readerSocket.bufferedAmount, "reading connection was throttled by the stalled peer").to.be.lessThan(
                HIGH_WATER,
            );
        } finally {
            reader.terminate();
        }
    });
});
