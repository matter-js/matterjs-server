/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { createPromise, Logger, Observable, Seconds, Time, withTimeout } from "@matter/main";
import { Mark } from "@matter/main/protocol";
import { WebSocket } from "ws";
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

const logger = Logger.get("BleProxyConnection");

const frameHead = (payload: Uint8Array): string =>
    Array.from(payload.subarray(0, 8))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

/** Counter for generating unique connection IDs. */
let connectionIdCounter = 0;

/**
 * Generate a unique connection ID as a hex string, rolling over at 0xFFFF to keep it short.
 * Same scheme as the controller WebSocket handler, prefixed `ble` so proxy sockets are
 * distinguishable from the controller WebSocket connections in shared logs.
 */
function generateConnectionId(): string {
    const id = connectionIdCounter;
    connectionIdCounter = (connectionIdCounter + 1) & 0xffff;
    return `ble${id.toString(16)}`;
}

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
 * One BLE proxy client socket. Owns that client's handshake state, pending
 * command map, and command/event/binary-frame plumbing. The hub
 * (`BleProxyHandler`) creates one per accepted WebSocket connection.
 */
export class BleProxyConnection {
    readonly #ws: WebSocket;
    readonly #id = generateConnectionId();
    #handshakeComplete = false;
    #closedEmitted = false;
    #pendingCommands = new Map<
        number,
        { resolver: (result: Record<string, unknown> | undefined) => void; rejecter: (reason?: unknown) => void }
    >();
    /** Command ID counter. Rolls over at 0xFFFF to stay in safe integer range. */
    #nextCommandId = 0;

    readonly binaryFrameReceived = new Observable<[frame: BinaryFrame]>();
    readonly eventReceived = new Observable<[event: BleProxyEventName, data: Record<string, unknown>]>();
    /** Emitted once when this connection completes the protocol handshake. */
    readonly handshakeCompleted = new Observable<[]>();
    /** Emitted once when this connection is torn down (close, error, or handshake failure). */
    readonly closed = new Observable<[]>();

    constructor(ws: WebSocket) {
        this.#ws = ws;
        logger.info(`[${this.#id}] BLE proxy connection established, waiting for handshake`);

        const handshakeTimer = Time.getTimer("BLE proxy handshake timeout", HANDSHAKE_TIMEOUT, () => {
            if (!this.#handshakeComplete) {
                logger.warn(`[${this.#id}] Handshake timeout - closing connection`);
                ws.close(4001, "Handshake timeout");
                this.#cleanup();
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
            logger.info(`[${this.#id}] BLE proxy connection closed`);
            this.#cleanup();
        });

        ws.on("error", err => {
            logger.error(`[${this.#id}] BLE proxy WebSocket error`, err);
            handshakeTimer.stop();
            this.#cleanup();
        });
    }

    get id(): string {
        return this.#id;
    }

    get connected(): boolean {
        return this.#handshakeComplete && this.#ws.readyState === WebSocket.OPEN;
    }

    /**
     * Send a typed command to this client and wait for the response.
     * Rejects if the connection is not ready or the client disconnects first.
     */
    async sendCommand<C extends BleProxyCommandName>(
        command: C,
        ...rest: BleProxyCommandMap[C]["args"] extends undefined ? [] : [args: BleProxyCommandMap[C]["args"]]
    ): Promise<BleProxyCommandMap[C]["result"]> {
        if (!this.connected) {
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

        this.#ws.send(JSON.stringify(message), err => {
            if (err) {
                this.#pendingCommands.delete(id);
                rejecter(new Error(`Failed to send command ${command}: ${err.message}`));
            }
        });

        return withTimeout(COMMAND_TIMEOUT, promise, () => this.#pendingCommands.delete(id)) as Promise<
            BleProxyCommandMap[C]["result"]
        >;
    }

    sendBinaryFrame(opcode: number, connectionHandle: number, payload: Uint8Array): void {
        if (!this.connected) {
            throw new Error("BLE proxy client not connected");
        }
        logger.debug(
            `[${this.#id}] [FRAME] ${Mark.OUTBOUND} opcode=${opcode} handle=${connectionHandle} len=${payload.length} head=${frameHead(payload)}`,
        );
        this.#ws.send(encodeBinaryFrame(opcode, connectionHandle, payload));
    }

    #handleTextMessage(raw: string, handshakeTimer: { stop: () => void }): void {
        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch {
            logger.warn(`[${this.#id}] Received invalid JSON from BLE proxy client`);
            return;
        }

        const msg = parsed as Record<string, unknown>;

        if (!this.#handshakeComplete) {
            this.#handleHandshake(msg, handshakeTimer);
            return;
        }

        if ("id" in msg && "success" in msg) {
            this.#handleResponse(msg as unknown as ResponseMessage);
            return;
        }

        if ("event" in msg && "data" in msg) {
            const evt = msg as unknown as EventMessage;
            this.eventReceived.emit(evt.event, evt.data);
            return;
        }

        logger.warn(`[${this.#id}] Received unknown message from BLE proxy client:`, msg);
    }

    #handleHandshake(msg: Record<string, unknown>, handshakeTimer: { stop: () => void }): void {
        if (msg.type !== "hello") {
            logger.warn(`[${this.#id}] Expected hello message, got: ${JSON.stringify(msg)}`);
            this.#ws.close(4002, "Expected hello message");
            this.#cleanup();
            return;
        }

        const hello = msg as unknown as HelloMessage;
        handshakeTimer.stop();

        if (hello.version !== BLE_PROXY_PROTOCOL_VERSION) {
            logger.warn(
                `[${this.#id}] BLE proxy client version ${hello.version} not supported (server supports ${BLE_PROXY_PROTOCOL_VERSION})`,
            );
            this.#ws.send(
                JSON.stringify({
                    type: "hello_response",
                    version: BLE_PROXY_PROTOCOL_VERSION,
                    error: "unsupported_version",
                    message: `Server supports protocol version ${BLE_PROXY_PROTOCOL_VERSION}, client sent version ${hello.version}`,
                }),
            );
            this.#ws.close(4003, "Unsupported protocol version");
            this.#cleanup();
            return;
        }

        this.#handshakeComplete = true;
        this.#ws.send(JSON.stringify({ type: "hello_response", version: BLE_PROXY_PROTOCOL_VERSION }));
        logger.info(`[${this.#id}] BLE proxy handshake complete (version ${BLE_PROXY_PROTOCOL_VERSION})`);
        this.handshakeCompleted.emit();
    }

    #handleResponse(msg: ResponseMessage): void {
        const pending = this.#pendingCommands.get(msg.id);
        if (!pending) {
            logger.warn(`[${this.#id}] Received response for unknown command id ${msg.id}`);
            return;
        }
        this.#pendingCommands.delete(msg.id);

        if (msg.success) {
            pending.resolver(msg.result);
        } else {
            pending.rejecter(new Error(`${msg.error}: ${msg.message}`));
        }
    }

    #handleBinaryMessage(data: Buffer): void {
        if (!this.#handshakeComplete) {
            logger.warn(`[${this.#id}] Received binary frame before handshake`);
            return;
        }

        try {
            const frame = decodeBinaryFrame(new Uint8Array(data));
            logger.debug(
                `[${this.#id}] [FRAME] ${Mark.INBOUND} opcode=${frame.opcode} handle=${frame.connectionHandle} len=${frame.payload.length} head=${frameHead(frame.payload)}`,
            );
            this.binaryFrameReceived.emit(frame);
        } catch (err) {
            logger.warn(`[${this.#id}] Failed to decode binary frame:`, err);
        }
    }

    /** Close the socket if open, reject all pending commands, emit `closed` once. */
    close(): void {
        if (this.#ws.readyState === WebSocket.OPEN) {
            this.#ws.close();
        }
        this.#cleanup();
    }

    #cleanup(): void {
        this.#handshakeComplete = false;

        for (const [id, pending] of this.#pendingCommands) {
            pending.rejecter(new Error("BLE proxy client disconnected"));
            this.#pendingCommands.delete(id);
        }

        if (!this.#closedEmitted) {
            this.#closedEmitted = true;
            this.closed.emit();
        }
    }
}
