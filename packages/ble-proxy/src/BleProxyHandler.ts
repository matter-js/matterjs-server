/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WebServerHandler } from "@matter-server/ws-controller";
import { createPromise, Logger, Observable, Seconds, Time, Timer, withTimeout } from "@matter/main";
import type { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import {
    BLE_PROXY_PROTOCOL_VERSION,
    decodeBinaryFrame,
    encodeBinaryFrame,
    type BinaryFrame,
    type BleProxyCommandMap,
    type BleProxyCommandName,
    type BleProxyEventName,
    type CommandMessage,
    type EventMessage,
    type HelloMessage,
    type ResponseMessage,
} from "./BleProxyProtocol.js";

type HttpServer = ReturnType<typeof createServer>;

const logger = Logger.get("BleProxyHandler");

const HANDSHAKE_TIMEOUT = Seconds(10);
/**
 * Default per-command timeout. Long enough to cover the slowest BLE
 * commissioning ops (peripheral connect ≤ 30 s, service discovery on
 * Android-side adapters can take several seconds), short enough that an
 * unresponsive-but-still-connected proxy client doesn't hang commissioning
 * indefinitely.
 */
const COMMAND_TIMEOUT = Seconds(60);

/**
 * WebSocket server handler for the /ble BLE proxy endpoint.
 *
 * Accepts a single client connection, performs the protocol handshake,
 * and routes commands/events/binary frames between the proxy implementation
 * and the connected BLE proxy client.
 */
export class BleProxyHandler implements WebServerHandler {
    #wss?: WebSocketServer;
    /** Upgrade listener removers, one per HTTP server `register()` call (multi-bind). */
    #removeUpgradeListeners: (() => void)[] = [];
    #client?: WebSocket;
    #handshakeComplete = false;
    #pendingCommands = new Map<
        number,
        { resolver: (result: Record<string, unknown> | undefined) => void; rejecter: (reason?: unknown) => void }
    >();
    /** Command ID counter. Rolls over at 0xFFFF to stay in safe integer range. */
    #nextCommandId = 0;
    #closed = false;

    /** Emitted when a JSON event is received from the BLE proxy client. */
    readonly eventReceived = new Observable<[event: BleProxyEventName, data: Record<string, unknown>]>();

    /** Emitted when a binary frame is received from the BLE proxy client. */
    readonly binaryFrameReceived = new Observable<[frame: BinaryFrame]>();

    /** Emitted once a proxy client has completed the handshake and `connected` is true. */
    readonly connectionEstablished = new Observable<[]>();

    get connected(): boolean {
        return this.#handshakeComplete && this.#client?.readyState === WebSocket.OPEN;
    }

    async register(server: HttpServer): Promise<void> {
        // Use noServer mode with a path-filtered upgrade listener.
        // ws 8.x calls handleUpgrade unconditionally from its own upgrade listener, which
        // sends HTTP 400 for non-matching paths and destroys the socket — breaking other
        // WebSocket endpoints on the same server.
        //
        // Reuse a single WSS across all bound HTTP servers (multi-listen-address): create
        // it once, then attach a per-server upgrade listener that forwards into it.
        const isFirstBind = this.#wss === undefined;
        const wss = (this.#wss ??= new WebSocketServer({ noServer: true }));
        const upgradeHandler = (
            req: { url?: string; _matterHandledUpgrade?: boolean },
            socket: unknown,
            head: unknown,
        ) => {
            logger.debug(`Upgrade request received: ${req.url}`);
            const path = req.url?.split("?")[0];
            if (path === "/ble") {
                req._matterHandledUpgrade = true;
                wss.handleUpgrade(
                    req as Parameters<typeof wss.handleUpgrade>[0],
                    socket as Parameters<typeof wss.handleUpgrade>[1],
                    head as Parameters<typeof wss.handleUpgrade>[2],
                    ws => wss.emit("connection", ws, req),
                );
            }
        };
        server.on("upgrade", upgradeHandler);
        this.#removeUpgradeListeners.push(() => server.removeListener("upgrade", upgradeHandler));
        logger.info("BLE proxy WebSocket endpoint registered on /ble");

        if (!isFirstBind) {
            return;
        }

        wss.on("connection", ws => {
            if (this.#closed) {
                ws.close();
                return;
            }

            if (this.#client) {
                logger.warn("Rejecting new BLE proxy client - only one connection allowed");
                ws.close(4000, "Only one BLE proxy client allowed");
                return;
            }

            logger.info("BLE proxy client connected, waiting for handshake");
            this.#client = ws;
            this.#handshakeComplete = false;

            const handshakeTimer = Time.getTimer("BLE proxy handshake timeout", HANDSHAKE_TIMEOUT, () => {
                if (!this.#handshakeComplete) {
                    logger.warn("BLE proxy handshake timeout - closing connection");
                    ws.close(4001, "Handshake timeout");
                    this.#cleanupClient();
                }
            }).start();

            ws.on("message", (data, isBinary) => {
                if (isBinary) {
                    this.#handleBinaryMessage(data as Buffer);
                } else {
                    this.#handleTextMessage(data.toString(), handshakeTimer);
                }
            });

            ws.on("close", () => {
                handshakeTimer.stop();
                logger.info("BLE proxy client disconnected");
                this.#cleanupClient();
            });

            ws.on("error", err => {
                logger.error("BLE proxy WebSocket error:", err);
                handshakeTimer.stop();
                this.#cleanupClient();
            });
        });
    }

    unregister(): Promise<void> {
        if (!this.#wss || this.#closed) {
            return Promise.resolve();
        }

        this.#closed = true;
        for (const remove of this.#removeUpgradeListeners) remove();
        this.#removeUpgradeListeners = [];

        // Close the connected client
        if (this.#client && this.#client.readyState === WebSocket.OPEN) {
            this.#client.close();
        }
        this.#cleanupClient();

        const wss = this.#wss;
        this.#wss = undefined;

        // Close all clients connected to the WSS (safety net)
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.close();
            }
        });

        // Wait for the WebSocket server to close properly
        return new Promise<void>((resolve, reject) => {
            wss.close(err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Send a typed command to the BLE proxy client and wait for the response.
     * The return type is inferred from the command name via BleProxyCommandMap.
     * Rejects if no client is connected or the client disconnects before responding.
     */
    async sendCommand<C extends BleProxyCommandName>(
        command: C,
        ...rest: BleProxyCommandMap[C]["args"] extends undefined ? [] : [args: BleProxyCommandMap[C]["args"]]
    ): Promise<BleProxyCommandMap[C]["result"]> {
        if (!this.connected || !this.#client) {
            throw new Error("BLE proxy client not connected");
        }

        const args = rest[0];
        const id = this.#nextCommandId;
        this.#nextCommandId = (this.#nextCommandId + 1) & 0xffff;
        const message: CommandMessage = { id, command };
        if (args !== undefined) {
            message.args = args as Record<string, unknown>;
        }

        const { promise, resolver, rejecter } = createPromise<Record<string, unknown> | undefined>();
        this.#pendingCommands.set(id, { resolver, rejecter });

        this.#client.send(JSON.stringify(message), err => {
            if (err) {
                this.#pendingCommands.delete(id);
                rejecter(new Error(`Failed to send command ${command}: ${err.message}`));
            }
        });

        return withTimeout(COMMAND_TIMEOUT, promise, () => this.#pendingCommands.delete(id)) as Promise<
            BleProxyCommandMap[C]["result"]
        >;
    }

    /**
     * Send a binary frame to the BLE proxy client.
     */
    sendBinaryFrame(opcode: number, connectionHandle: number, payload: Uint8Array): void {
        if (!this.connected || !this.#client) {
            throw new Error("BLE proxy client not connected");
        }
        const frame = encodeBinaryFrame(opcode, connectionHandle, payload);
        this.#client.send(frame);
    }

    #handleTextMessage(raw: string, handshakeTimer: Timer): void {
        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch {
            logger.warn("Received invalid JSON from BLE proxy client");
            return;
        }

        const msg = parsed as Record<string, unknown>;

        // Handle handshake
        if (!this.#handshakeComplete) {
            this.#handleHandshake(msg, handshakeTimer);
            return;
        }

        // Handle response to a pending command
        if ("id" in msg && "success" in msg) {
            this.#handleResponse(msg as unknown as ResponseMessage);
            return;
        }

        // Handle event
        if ("event" in msg && "data" in msg) {
            this.#handleEvent(msg as unknown as EventMessage);
            return;
        }

        logger.warn("Received unknown message from BLE proxy client:", msg);
    }

    #handleHandshake(msg: Record<string, unknown>, handshakeTimer: Timer): void {
        if (msg.type !== "hello") {
            logger.warn(`Expected hello message, got: ${JSON.stringify(msg)}`);
            this.#client?.close(4002, "Expected hello message");
            this.#cleanupClient();
            return;
        }

        const hello = msg as unknown as HelloMessage;
        handshakeTimer.stop();

        if (hello.version !== BLE_PROXY_PROTOCOL_VERSION) {
            logger.warn(
                `BLE proxy client version ${hello.version} not supported (server supports ${BLE_PROXY_PROTOCOL_VERSION})`,
            );
            this.#client?.send(
                JSON.stringify({
                    type: "hello_response",
                    version: BLE_PROXY_PROTOCOL_VERSION,
                    error: "unsupported_version",
                    message: `Server supports protocol version ${BLE_PROXY_PROTOCOL_VERSION}, client sent version ${hello.version}`,
                }),
            );
            this.#client?.close(4003, "Unsupported protocol version");
            this.#cleanupClient();
            return;
        }

        this.#handshakeComplete = true;
        this.#client?.send(
            JSON.stringify({
                type: "hello_response",
                version: BLE_PROXY_PROTOCOL_VERSION,
            }),
        );
        logger.info(`BLE proxy handshake complete (version ${BLE_PROXY_PROTOCOL_VERSION})`);
        this.connectionEstablished.emit();
    }

    #handleResponse(msg: ResponseMessage): void {
        const pending = this.#pendingCommands.get(msg.id);
        if (!pending) {
            logger.warn(`Received response for unknown command id ${msg.id}`);
            return;
        }
        this.#pendingCommands.delete(msg.id);

        if (msg.success) {
            pending.resolver(msg.result);
        } else {
            pending.rejecter(new Error(`${msg.error}: ${msg.message}`));
        }
    }

    #handleEvent(msg: EventMessage): void {
        this.eventReceived.emit(msg.event, msg.data);
    }

    #handleBinaryMessage(data: Buffer): void {
        if (!this.#handshakeComplete) {
            logger.warn("Received binary frame before handshake");
            return;
        }

        try {
            const frame = decodeBinaryFrame(new Uint8Array(data));
            const head = Array.from(frame.payload.subarray(0, 8))
                .map(b => b.toString(16).padStart(2, "0"))
                .join("");
            logger.debug(
                `[FRAME] opcode=${frame.opcode} handle=${frame.connectionHandle} len=${frame.payload.length} head=${head}`,
            );
            this.binaryFrameReceived.emit(frame);
        } catch (err) {
            logger.error("Failed to decode binary frame:", err);
        }
    }

    #cleanupClient(): void {
        if (this.#client) {
            if (this.#client.readyState === WebSocket.OPEN) {
                this.#client.close();
            }
            this.#client = undefined;
        }
        this.#handshakeComplete = false;

        // Reject all pending commands
        for (const [id, pending] of this.#pendingCommands) {
            pending.rejecter(new Error("BLE proxy client disconnected"));
            this.#pendingCommands.delete(id);
        }
    }
}
