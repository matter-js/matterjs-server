/**
 * Integration test for the Matter.js server.
 *
 * This test starts the actual server and a test device, then validates
 * the full commissioning and control flow via WebSocket.
 */

import { expect } from "chai";
import { ChildProcess, spawn } from "child_process";
import { mkdir, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import WebSocket from "ws";

// Constants
const SERVER_PORT = 5580;
const SERVER_WS_URL = `ws://localhost:${SERVER_PORT}/ws`;
const MANUAL_PAIRING_CODE = "34970112332";
const TEST_TIMEOUT = 120_000; // 2 minutes for Matter commissioning

// Types matching the server's WebSocket protocol
interface ServerInfoMessage {
    fabric_id: number | bigint;
    compressed_fabric_id: number | bigint;
    schema_version: number;
    min_supported_schema_version: number;
    sdk_version: string;
    wifi_credentials_set: boolean;
    thread_credentials_set: boolean;
    bluetooth_enabled: boolean;
}

interface MatterNode {
    node_id: number | bigint;
    date_commissioned: string;
    last_interview: string;
    interview_version: number;
    available: boolean;
    is_bridge: boolean;
    attributes: Record<string, unknown>;
    attribute_subscriptions: unknown[];
}

interface WsEvent {
    event: string;
    data: unknown;
}

interface WsResponse {
    message_id: string;
    result?: unknown;
    error_code?: number;
    details?: string;
}

/**
 * WebSocket client helper for communicating with the Matter server.
 */
class MatterWebSocketClient {
    private ws: WebSocket | null = null;
    private messageId = 0;
    private pendingRequests = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
    private serverInfo: ServerInfoMessage | null = null;
    private events: WsEvent[] = [];
    private eventWaiters: Array<{
        eventType: string;
        matcher?: (data: unknown) => boolean;
        resolve: (event: WsEvent) => void;
        reject: (error: Error) => void;
    }> = [];

    async connect(): Promise<ServerInfoMessage> {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(SERVER_WS_URL);
            this.ws = ws;

            ws.on("open", () => {
                console.log("WebSocket connected");
            });

            ws.on("message", (data: WebSocket.Data) => {
                const message = JSON.parse(data.toString());
                this.handleMessage(message, resolve);
            });

            ws.on("error", error => {
                console.error("WebSocket error:", error);
                reject(error);
            });

            ws.on("close", () => {
                console.log("WebSocket closed");
            });
        });
    }

    private handleMessage(message: unknown, initialResolve?: (value: ServerInfoMessage) => void): void {
        const msg = message as Record<string, unknown>;

        // Server info message (sent on connection)
        if ("fabric_id" in msg && "schema_version" in msg) {
            this.serverInfo = msg as unknown as ServerInfoMessage;
            if (initialResolve) {
                initialResolve(this.serverInfo);
            }
            return;
        }

        // Event message
        if ("event" in msg) {
            const event = msg as WsEvent;
            this.events.push(event);

            // Check if any waiters match this event
            for (let i = this.eventWaiters.length - 1; i >= 0; i--) {
                const waiter = this.eventWaiters[i];
                if (waiter.eventType === event.event && (!waiter.matcher || waiter.matcher(event.data))) {
                    this.eventWaiters.splice(i, 1);
                    waiter.resolve(event);
                }
            }
            return;
        }

        // Response message
        if ("message_id" in msg) {
            const response = msg as WsResponse;
            const pending = this.pendingRequests.get(response.message_id);
            if (pending) {
                this.pendingRequests.delete(response.message_id);
                if ("error_code" in response) {
                    pending.reject(new Error(`Error ${response.error_code}: ${response.details}`));
                } else {
                    pending.resolve(response.result);
                }
            }
        }
    }

    async sendCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
        if (!this.ws) {
            throw new Error("WebSocket not connected");
        }

        const messageId = String(++this.messageId);
        const message = {
            message_id: messageId,
            command,
            args: args ?? {},
        };

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(messageId, {
                resolve: value => resolve(value as T),
                reject,
            });
            this.ws!.send(JSON.stringify(message));
        });
    }

    async startListening(): Promise<MatterNode[]> {
        return this.sendCommand<MatterNode[]>("start_listening");
    }

    async commissionWithCode(code: string, networkOnly = true): Promise<MatterNode> {
        return this.sendCommand<MatterNode>("commission_with_code", {
            code,
            network_only: networkOnly,
        });
    }

    async deviceCommand(
        nodeId: number,
        endpointId: number,
        clusterId: number,
        commandName: string,
        payload: Record<string, unknown> = {},
    ): Promise<unknown> {
        return this.sendCommand("device_command", {
            node_id: nodeId,
            endpoint_id: endpointId,
            cluster_id: clusterId,
            command_name: commandName,
            payload,
            response_type: null,
        });
    }

    async removeNode(nodeId: number): Promise<void> {
        await this.sendCommand("remove_node", { node_id: nodeId });
    }

    clearEvents(): void {
        this.events = [];
    }

    getEvents(): WsEvent[] {
        return [...this.events];
    }

    async waitForEvent(
        eventType: string,
        matcher?: (data: unknown) => boolean,
        timeoutMs = 10_000,
    ): Promise<WsEvent> {
        // Check existing events first
        const existing = this.events.find(e => e.event === eventType && (!matcher || matcher(e.data)));
        if (existing) {
            return existing;
        }

        // Wait for new event
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                const idx = this.eventWaiters.findIndex(w => w.resolve === resolve);
                if (idx >= 0) {
                    this.eventWaiters.splice(idx, 1);
                }
                reject(new Error(`Timeout waiting for event: ${eventType}`));
            }, timeoutMs);

            this.eventWaiters.push({
                eventType,
                matcher,
                resolve: event => {
                    clearTimeout(timeout);
                    resolve(event);
                },
                reject: error => {
                    clearTimeout(timeout);
                    reject(error);
                },
            });
        });
    }

    async close(): Promise<void> {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    getServerInfo(): ServerInfoMessage | null {
        return this.serverInfo;
    }
}

/**
 * Wait for a process to be ready by checking if a port is listening.
 */
async function waitForPort(port: number, timeoutMs = 30_000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const ws = new WebSocket(`ws://localhost:${port}/ws`);
            await new Promise<void>((resolve, reject) => {
                ws.on("open", () => {
                    ws.close();
                    resolve();
                });
                ws.on("error", reject);
            });
            return;
        } catch {
            await new Promise(r => setTimeout(r, 500));
        }
    }
    throw new Error(`Timeout waiting for port ${port}`);
}

/**
 * Wait for the device to output a specific message indicating readiness.
 */
function waitForDeviceReady(process: ChildProcess, timeoutMs = 30_000): Promise<void> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error("Timeout waiting for device to be ready"));
        }, timeoutMs);

        const onData = (data: Buffer) => {
            const output = data.toString();
            console.log("[device]", output.trim());
            // Device is ready when it shows the pairing codes
            if (output.includes("Manual pairing code:") || output.includes("commissioned")) {
                clearTimeout(timeout);
                process.stdout?.off("data", onData);
                // Give it a moment to fully initialize network
                setTimeout(resolve, 2000);
            }
        };

        process.stdout?.on("data", onData);
        process.stderr?.on("data", (data: Buffer) => {
            console.log("[device:err]", data.toString().trim());
        });
    });
}

describe("Integration Test", function () {
    this.timeout(TEST_TIMEOUT);

    let serverProcess: ChildProcess;
    let deviceProcess: ChildProcess;
    let client: MatterWebSocketClient;
    let serverStoragePath: string;
    let deviceStoragePath: string;
    let commissionedNodeId: number;

    before(async function () {
        // Create temp directories
        const timestamp = Date.now();
        serverStoragePath = join(tmpdir(), `matter-test-server-${timestamp}`);
        deviceStoragePath = join(tmpdir(), `matter-test-device-${timestamp}`);

        await mkdir(serverStoragePath, { recursive: true });
        await mkdir(deviceStoragePath, { recursive: true });

        console.log(`Server storage: ${serverStoragePath}`);
        console.log(`Device storage: ${deviceStoragePath}`);

        // Start server process
        console.log("Starting server...");
        serverProcess = spawn(
            "node",
            ["--enable-source-maps", "packages/matter-server/dist/esm/MatterServer.js", `--storage-path=${serverStoragePath}`],
            {
                cwd: process.cwd(),
                stdio: ["pipe", "pipe", "pipe"],
            },
        );

        serverProcess.stdout?.on("data", (data: Buffer) => {
            console.log("[server]", data.toString().trim());
        });
        serverProcess.stderr?.on("data", (data: Buffer) => {
            console.log("[server:err]", data.toString().trim());
        });

        // Wait for server to be ready
        await waitForPort(SERVER_PORT);
        console.log("Server is ready");

        // Connect WebSocket client
        client = new MatterWebSocketClient();
        const serverInfo = await client.connect();
        console.log("Connected to server, schema version:", serverInfo.schema_version);
    });

    after(async function () {
        // Close WebSocket client
        if (client) {
            await client.close();
        }

        // Kill processes
        if (deviceProcess) {
            deviceProcess.kill("SIGTERM");
            await new Promise(r => setTimeout(r, 1000));
        }
        if (serverProcess) {
            serverProcess.kill("SIGTERM");
            await new Promise(r => setTimeout(r, 1000));
        }

        // Cleanup temp directories
        try {
            await rm(serverStoragePath, { recursive: true, force: true });
            await rm(deviceStoragePath, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    it("should have no commissioned nodes initially", async function () {
        const nodes = await client.startListening();
        expect(nodes).to.be.an("array").that.is.empty;
    });

    it("should start device and commission it", async function () {
        // Start device process
        console.log("Starting test device...");
        deviceProcess = spawn("npx", ["tsx", "test/fixtures/TestLightDevice.ts", `--storage-path=${deviceStoragePath}`], {
            cwd: process.cwd(),
            stdio: ["pipe", "pipe", "pipe"],
        });

        // Wait for device to be ready
        await waitForDeviceReady(deviceProcess);
        console.log("Device is ready, commissioning...");

        // Give mDNS time to propagate
        await new Promise(r => setTimeout(r, 3000));

        // Commission using manual pairing code
        const node = await client.commissionWithCode(MANUAL_PAIRING_CODE);
        commissionedNodeId = Number(node.node_id);

        console.log("Node commissioned:", commissionedNodeId);
        console.log("Node attributes:", Object.keys(node.attributes));

        // Verify node ID is 2 (first commissioned node - controller uses node ID 1)
        expect(commissionedNodeId).to.equal(2);

        // Verify node metadata
        expect(node.available).to.be.true;
        expect(node.is_bridge).to.be.false;

        // Verify Basic Information cluster (endpoint 0, cluster 40)
        expect(node.attributes["0/40/0"]).to.exist; // DataModelRevision
        expect(node.attributes["0/40/1"]).to.equal("Test Vendor"); // VendorName
        expect(node.attributes["0/40/3"]).to.equal("Test Light"); // ProductName

        // Verify Descriptor cluster (endpoint 0, cluster 29)
        expect(node.attributes["0/29/0"]).to.be.an("array"); // DeviceTypeList

        // Verify OnOff cluster on endpoint 1 (cluster 6)
        expect(node.attributes["1/6/0"]).to.equal(false); // OnOff initially off

        // Verify OnOff device type on endpoint 1 (device type 256 = 0x100 = OnOffLight)
        const deviceTypes = node.attributes["1/29/0"] as Array<Record<string, unknown>>;
        expect(deviceTypes).to.be.an("array");
        expect(deviceTypes.some(dt => dt["0"] === 256)).to.be.true;
    });

    it("should toggle light and receive attribute update", async function () {
        client.clearEvents();

        // Send Toggle command to OnOff cluster (endpoint 1, cluster 6)
        await client.deviceCommand(commissionedNodeId, 1, 6, "toggle", {});

        // Wait for attribute_updated event
        const onEvent = await client.waitForEvent(
            "attribute_updated",
            data => {
                const [nodeId, path] = data as [number, string, unknown];
                return nodeId === commissionedNodeId && path === "1/6/0";
            },
            10_000,
        );

        const [, , onValue] = onEvent.data as [number, string, boolean];
        expect(onValue).to.equal(true); // Light is now ON

        // Toggle again to turn off
        client.clearEvents();
        await client.deviceCommand(commissionedNodeId, 1, 6, "toggle", {});

        const offEvent = await client.waitForEvent(
            "attribute_updated",
            data => {
                const [nodeId, path] = data as [number, string, unknown];
                return nodeId === commissionedNodeId && path === "1/6/0";
            },
            10_000,
        );

        const [, , offValue] = offEvent.data as [number, string, boolean];
        expect(offValue).to.equal(false); // Light is now OFF
    });

    it("should decommission node", async function () {
        await client.removeNode(commissionedNodeId);

        // Wait a moment for decommissioning to complete
        await new Promise(r => setTimeout(r, 1000));

        // Verify no nodes remain
        const nodes = await client.startListening();
        expect(nodes).to.be.an("array").that.is.empty;
    });
});
