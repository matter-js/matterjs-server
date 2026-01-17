/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { WebSocket, WebSocketServer } from "ws";
import { parseBigIntAwareJson, toBigIntAwareJson } from "../src/json-utils.js";
import { CommandMessage, ServerInfoMessage } from "../src/models/model.js";

export interface MockServerOptions {
    port?: number;
    serverInfo?: Partial<ServerInfoMessage>;
}

export interface ReceivedCommand {
    message: CommandMessage;
    raw: string;
}

/**
 * Mock Matter server for testing the ws-client.
 * Simulates the WebSocket protocol used by the real Matter server.
 */
export class MockMatterServer {
    private server: WebSocketServer | null = null;
    private clients: Set<WebSocket> = new Set();
    private receivedCommands: ReceivedCommand[] = [];
    private commandHandlers: Map<string, (args: unknown) => unknown> = new Map();
    private port: number;
    private serverInfo: ServerInfoMessage;

    constructor(options: MockServerOptions = {}) {
        this.port = options.port ?? 0; // 0 means random available port
        this.serverInfo = {
            fabric_id: options.serverInfo?.fabric_id ?? BigInt("1234567890123456789"),
            compressed_fabric_id: options.serverInfo?.compressed_fabric_id ?? BigInt("18258567453835851999"),
            schema_version: options.serverInfo?.schema_version ?? 11,
            min_supported_schema_version: options.serverInfo?.min_supported_schema_version ?? 9,
            sdk_version: options.serverInfo?.sdk_version ?? "2025.1.0",
            wifi_credentials_set: options.serverInfo?.wifi_credentials_set ?? false,
            thread_credentials_set: options.serverInfo?.thread_credentials_set ?? false,
            bluetooth_enabled: options.serverInfo?.bluetooth_enabled ?? false,
        };
    }

    get url(): string {
        if (!this.server) {
            throw new Error("Server not started");
        }
        const address = this.server.address();
        if (typeof address === "string" || address === null) {
            throw new Error("Invalid server address");
        }
        return `ws://127.0.0.1:${address.port}/ws`;
    }

    get actualPort(): number {
        if (!this.server) {
            throw new Error("Server not started");
        }
        const address = this.server.address();
        if (typeof address === "string" || address === null) {
            throw new Error("Invalid server address");
        }
        return address.port;
    }

    /**
     * Start the mock server.
     */
    async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server = new WebSocketServer({ port: this.port });

            this.server.on("listening", () => {
                resolve();
            });

            this.server.on("error", error => {
                reject(error);
            });

            this.server.on("connection", socket => {
                this.clients.add(socket);

                // Send server info immediately upon connection (just like the real server)
                socket.send(toBigIntAwareJson(this.serverInfo));

                socket.on("message", (data: Buffer) => {
                    const rawMessage = data.toString();
                    try {
                        const message = parseBigIntAwareJson(rawMessage) as CommandMessage;
                        this.receivedCommands.push({ message, raw: rawMessage });
                        this.handleCommand(socket, message);
                    } catch (error) {
                        console.error("Failed to parse message:", error);
                    }
                });

                socket.on("close", () => {
                    this.clients.delete(socket);
                });
            });
        });
    }

    /**
     * Stop the mock server.
     */
    async stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.server) {
                resolve();
                return;
            }

            // Close all client connections
            for (const client of this.clients) {
                client.close();
            }
            this.clients.clear();

            this.server.close(error => {
                if (error) {
                    reject(error);
                } else {
                    this.server = null;
                    resolve();
                }
            });
        });
    }

    /**
     * Register a handler for a specific command.
     */
    onCommand(command: string, handler: (args: unknown) => unknown): void {
        this.commandHandlers.set(command, handler);
    }

    /**
     * Get all received commands.
     */
    getReceivedCommands(): ReceivedCommand[] {
        return [...this.receivedCommands];
    }

    /**
     * Clear received commands.
     */
    clearReceivedCommands(): void {
        this.receivedCommands = [];
    }

    /**
     * Send an event to all connected clients.
     */
    sendEvent(event: string, data: unknown): void {
        const message = toBigIntAwareJson({ event, data });
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        }
    }

    /**
     * Send a raw string message to all clients (for testing malformed messages).
     */
    sendRaw(message: string): void {
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        }
    }

    private handleCommand(socket: WebSocket, message: CommandMessage): void {
        const handler = this.commandHandlers.get(message.command);

        if (handler) {
            try {
                const result = handler(message.args);
                socket.send(
                    toBigIntAwareJson({
                        message_id: message.message_id,
                        result,
                    }),
                );
            } catch (error) {
                socket.send(
                    toBigIntAwareJson({
                        message_id: message.message_id,
                        error_code: 1,
                        details: error instanceof Error ? error.message : String(error),
                    }),
                );
            }
        } else {
            // Default: return null result
            socket.send(
                toBigIntAwareJson({
                    message_id: message.message_id,
                    result: null,
                }),
            );
        }
    }
}
