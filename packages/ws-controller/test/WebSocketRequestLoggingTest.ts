/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * What the debug log actually receives for a request and its response, asserted against the text a
 * destination is handed rather than against the redactor being called.
 */

import { Environment, FabricId, LogLevel, Logger, MockStorageService, NodeId, Observable } from "@matter/main";
import { createServer } from "node:http";
import { WebSocket } from "ws";
import type { CameraStreamManager } from "../src/camera/CameraStreamManager.js";
import type { MatterController } from "../src/controller/MatterController.js";
import { ConfigStorage } from "../src/server/ConfigStorage.js";
import { WebSocketControllerHandler } from "../src/server/WebSocketControllerHandler.js";

const TURN_USERNAME = "1758700000:turn-user";
const TURN_CREDENTIAL = "uNgu3ss4ble-turn-secret";
/** Distinctive enough that finding it in a log line cannot be a coincidence. */
const SNAPSHOT_BYTES = Uint8Array.from({ length: 512 }, (_, index) => (index * 7) % 251);

function createFakeCameraStreams() {
    return {
        async startStream() {
            return { webRtcSessionId: 42, mode: "provide_offer" as const, video: undefined, audio: undefined };
        },
        async snapshot() {
            return {
                data: SNAPSHOT_BYTES,
                imageCodec: 0,
                resolution: { width: 640, height: 480 },
                downgraded: false,
                snapshotStreamId: 8,
            };
        },
        async stopStream() {
            return true;
        },
        async releaseConnection() {},
    };
}

function createFakeCommandHandler() {
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
        getCommissionerFabricData: async () => ({ fabricId: FabricId(1), compressedFabricId: 1n, fabricIndex: 1 }),
        initializeNodes: async () => {},
    };
}

async function createHarness() {
    const env = new Environment("test");
    new MockStorageService(env);
    const config = await ConfigStorage.create(env);

    const cameraStreams = createFakeCameraStreams();
    const controller = {
        commandHandler: createFakeCommandHandler(),
        threadDiagnostics: { events: { batchUpdated: new Observable() } },
        cameraStreams: cameraStreams as unknown as CameraStreamManager,
        cameraStreamsIfCreated: cameraStreams as unknown as CameraStreamManager,
    } as unknown as MatterController;

    const handler = new WebSocketControllerHandler(controller, config, "logging-test");
    const httpServer = createServer();
    await new Promise<void>((resolve, reject) => {
        httpServer.once("error", reject);
        httpServer.listen(0, "127.0.0.1", () => resolve());
    });
    await handler.register(httpServer);
    const { port } = httpServer.address() as { port: number };

    /** The lines the handler's own facility wrote while `command` was served. */
    async function loggedFor(command: string, args: unknown): Promise<string[]> {
        const captured = new Array<string>();
        const destination = Logger.destinations.default;
        const { write, level } = destination;
        destination.write = (text, message) => {
            if (message.facility === "WebSocketControllerHandler") captured.push(text);
            write.call(destination, text, message);
        };
        destination.level = LogLevel.DEBUG;
        try {
            const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
            await new Promise<void>((resolve, reject) => {
                ws.once("message", () => resolve()); // the greeting
                ws.once("error", reject);
            });
            await new Promise<void>((resolve, reject) => {
                ws.once("message", () => resolve());
                ws.once("error", reject);
                ws.send(JSON.stringify({ message_id: "1", command, args }));
            });
            ws.close();
        } finally {
            destination.write = write;
            destination.level = level;
        }
        return captured;
    }

    async function close() {
        await handler.unregister().catch(() => undefined);
        await new Promise<void>(resolve => httpServer.close(() => resolve()));
    }

    return { loggedFor, close };
}

describe("WebSocketControllerHandler request logging", () => {
    let harness: Awaited<ReturnType<typeof createHarness>>;

    before(async () => {
        harness = await createHarness();
    });

    after(async () => {
        await harness.close();
    });

    it("keeps a TURN credential out of the request line", async () => {
        const lines = await harness.loggedFor("camera_start_stream", {
            node_id: 5,
            endpoint_id: 1,
            stream_usage: "LiveView",
            ice_servers: [
                {
                    urls: "turn:turn.example.org:3478",
                    username: TURN_USERNAME,
                    credential: TURN_CREDENTIAL,
                },
            ],
        });

        const request = lines.find(line => line.includes("WebSocket request"));
        expect(request).to.not.equal(undefined);
        expect(request).to.contain("camera_start_stream");
        // The server it points at stays readable: the redaction masks the secret, not the request.
        expect(request).to.contain("turn:turn.example.org:3478");
        for (const line of lines) {
            expect(line).to.not.contain(TURN_CREDENTIAL);
            expect(line).to.not.contain(TURN_USERNAME);
        }
    });

    it("keeps the frame out of the camera_snapshot response line", async () => {
        const lines = await harness.loggedFor("camera_snapshot", { node_id: 5, endpoint_id: 1 });

        const response = lines.find(line => line.includes("WebSocket response (camera_snapshot)"));
        expect(response).to.not.equal(undefined);
        // What the server chose stays readable; only the frame goes.
        const chosen = lines.find(line => line.includes("camera_snapshot for node"));
        expect(chosen).to.contain("640x480");
        expect(chosen).to.contain("downgraded false");
        // The response content is skipped, so this line is the only record of which stream was used.
        expect(chosen).to.contain("stream 8");
        const frame = Buffer.from(SNAPSHOT_BYTES).toString("base64");
        for (const line of lines) {
            expect(line).to.not.contain(frame.slice(0, 32));
            expect(line).to.not.contain("data:");
        }
    });

    it("still logs the content of a response that is not in the skip list", async () => {
        const lines = await harness.loggedFor("camera_stop_stream", {
            node_id: 5,
            endpoint_id: 1,
            webrtc_session_id: 42,
        });

        const response = lines.find(line => line.includes("WebSocket response (camera_stop_stream)"));
        expect(response).to.contain("ended");
    });
});
