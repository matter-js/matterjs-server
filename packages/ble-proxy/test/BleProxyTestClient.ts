/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Test utility that simulates a BLE proxy client (the HA side of the protocol).
 * Connects to the /ble WebSocket endpoint, performs the handshake, and allows
 * registering command handlers and sending events/binary frames.
 */

import { WebSocket } from "ws";
import {
    BLE_PROXY_PROTOCOL_VERSION,
    type BleProxyCommandName,
    type CommandMessage,
    encodeBinaryFrame,
} from "../src/BleProxyProtocol.js";

type CommandHandler = (args: Record<string, unknown>) => Promise<Record<string, unknown> | void>;

export class BleProxyTestClient {
    #ws?: WebSocket;
    #commandHandlers = new Map<BleProxyCommandName, CommandHandler>();
    #receivedCommands: CommandMessage[] = [];
    #commandWaiters: Array<{ command: string; resolve: (msg: CommandMessage) => void }> = [];

    async connect(url: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const ws = new WebSocket(url);
            this.#ws = ws;

            ws.on("open", () => {
                ws.send(JSON.stringify({ type: "hello", version: BLE_PROXY_PROTOCOL_VERSION }));
            });

            let handshakeDone = false;

            ws.on("message", (data, isBinary) => {
                if (isBinary) {
                    return;
                }

                const msg = JSON.parse(data.toString());

                if (!handshakeDone) {
                    if (msg.type === "hello_response") {
                        if (msg.error) {
                            reject(new Error(`Handshake failed: ${msg.error}`));
                            return;
                        }
                        handshakeDone = true;
                        resolve();
                    }
                    return;
                }

                if ("id" in msg && "command" in msg) {
                    const command = msg as CommandMessage;
                    this.#receivedCommands.push(command);
                    this.#resolveCommandWaiters(command);
                    void this.#dispatchCommand(command);
                }
            });

            ws.on("error", err => {
                if (!handshakeDone) reject(err);
            });
        });
    }

    onCommand(command: BleProxyCommandName, handler: CommandHandler): void {
        this.#commandHandlers.set(command, handler);
    }

    sendEvent(event: string, data: Record<string, unknown>): void {
        this.#ws?.send(JSON.stringify({ event, data }));
    }

    sendBinaryFrame(opcode: number, connectionHandle: number, payload: Uint8Array): void {
        const frame = encodeBinaryFrame(opcode, connectionHandle, payload);
        this.#ws?.send(frame);
    }

    waitForCommand(command: string, timeoutMs = 5000): Promise<CommandMessage> {
        // Check already received
        const existing = this.#receivedCommands.find(c => c.command === command);
        if (existing) {
            this.#receivedCommands = this.#receivedCommands.filter(c => c !== existing);
            return Promise.resolve(existing);
        }

        return new Promise<CommandMessage>((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Timeout waiting for command: ${command}`));
            }, timeoutMs);

            this.#commandWaiters.push({
                command,
                resolve: msg => {
                    clearTimeout(timer);
                    resolve(msg);
                },
            });
        });
    }

    get receivedCommands(): CommandMessage[] {
        return [...this.#receivedCommands];
    }

    close(): void {
        this.#ws?.close();
    }

    async #dispatchCommand(msg: CommandMessage): Promise<void> {
        const handler = this.#commandHandlers.get(msg.command);
        if (!handler) {
            // Auto-respond with success for unhandled commands
            this.#ws?.send(JSON.stringify({ id: msg.id, success: true, result: {} }));
            return;
        }

        try {
            const result = await handler(msg.args ?? {});
            this.#ws?.send(
                JSON.stringify({
                    id: msg.id,
                    success: true,
                    result: result ?? {},
                }),
            );
        } catch (err) {
            this.#ws?.send(
                JSON.stringify({
                    id: msg.id,
                    success: false,
                    error: "test_error",
                    message: (err as Error).message,
                }),
            );
        }
    }

    #resolveCommandWaiters(msg: CommandMessage): void {
        const idx = this.#commandWaiters.findIndex(w => w.command === msg.command);
        if (idx !== -1) {
            const waiter = this.#commandWaiters.splice(idx, 1)[0];
            waiter.resolve(msg);
        }
    }
}
