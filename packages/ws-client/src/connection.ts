/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseBigIntAwareJson, toBigIntAwareJson } from "./json-utils.js";
import { CommandMessage, ServerInfoMessage } from "./models/model.js";

/**
 * WebSocket interface that works with both browser WebSocket and Node.js ws library.
 */
export interface WebSocketLike {
    readyState: number;
    onopen: ((event: unknown) => void) | null;
    onclose: ((event: unknown) => void) | null;
    onerror: ((event: unknown) => void) | null;
    onmessage: ((event: { data: unknown }) => void) | null;
    send(data: string): void;
    close(): void;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

export class Connection {
    public serverInfo?: ServerInfoMessage = undefined;

    private socket?: WebSocketLike;
    private wsFactory: WebSocketFactory;

    /**
     * Create a new connection.
     * @param ws_server_url WebSocket server URL
     * @param wsFactory Optional factory function to create WebSocket instances.
     *                  If not provided, uses the global WebSocket constructor.
     */
    constructor(
        public ws_server_url: string,
        wsFactory?: WebSocketFactory,
    ) {
        this.ws_server_url = ws_server_url;
        this.wsFactory = wsFactory ?? (url => new WebSocket(url) as unknown as WebSocketLike);
    }

    get connected() {
        return this.socket?.readyState === 1; // WebSocket.OPEN = 1
    }

    async connect(onMessage: (msg: unknown) => void, onConnectionLost: () => void) {
        if (this.socket) {
            throw new Error("Already connected");
        }

        console.debug("Trying to connect");

        return new Promise<void>((resolve, reject) => {
            this.socket = this.wsFactory(this.ws_server_url);

            this.socket.onopen = () => {
                console.log("WebSocket Connected");
            };

            this.socket.onclose = () => {
                console.log("WebSocket Closed");
                // Clean up so reconnect can work
                this.socket = undefined;
                this.serverInfo = undefined;
                onConnectionLost();
            };

            this.socket.onerror = error => {
                console.error("WebSocket Error: ", error);
                reject(new Error("WebSocket Error"));
            };

            this.socket.onmessage = (event: { data: unknown }) => {
                const dataStr = typeof event.data === "string" ? event.data : String(event.data);
                const data = parseBigIntAwareJson(dataStr);
                console.log("WebSocket OnMessage", data);
                if (!this.serverInfo) {
                    this.serverInfo = data as ServerInfoMessage;
                    resolve();
                    return;
                }
                onMessage(data);
            };
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = undefined;
        }
        // Reset serverInfo so reconnect will properly handle the initial server info message
        this.serverInfo = undefined;
    }

    sendMessage(message: CommandMessage): void {
        if (!this.socket) {
            throw new Error("Not connected");
        }
        console.log("WebSocket send message", message);
        this.socket.send(toBigIntAwareJson(message));
    }
}

export default Connection;
