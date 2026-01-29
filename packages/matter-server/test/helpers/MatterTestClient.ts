/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Test client extending MatterClient with test-specific functionality.
 * Provides event waiting, event collection, and additional test utilities.
 */

import {
    CommissionableNodeData,
    EventMessage,
    MatterClient,
    MatterNode,
    ServerInfoMessage,
    WebSocketLike,
} from "@matter-server/ws-client";
import type { MatterNodeEvent, ServerErrorCode } from "@matter-server/ws-controller";
import WebSocket from "ws";

/** Error with error code from server */
export interface ServerErrorResponse {
    error_code: ServerErrorCode;
    details: string;
}

/** WebSocket event for testing */
export interface WsEvent {
    event: string;
    data: unknown;
}

interface EventWaiter {
    eventType: string;
    matcher?: (data: unknown) => boolean;
    resolve: (event: WsEvent) => void;
    reject: (error: Error) => void;
}

/**
 * Node.js WebSocket factory for MatterClient.
 */
function createNodeWebSocket(url: string): WebSocketLike {
    return new WebSocket(url) as unknown as WebSocketLike;
}

/**
 * Extended MatterClient for testing purposes.
 * Adds event waiting, event collection, and additional test utilities.
 */
export class MatterTestClient extends MatterClient {
    private events: WsEvent[] = [];
    private eventWaiters: EventWaiter[] = [];

    constructor(url: string) {
        super(url, createNodeWebSocket);
    }

    /**
     * Connect to the server and return server info.
     * Unlike the base class, this returns the ServerInfoMessage directly.
     */
    async connectAndGetServerInfo(): Promise<ServerInfoMessage> {
        await this.connect();
        return this.serverInfo;
    }

    /**
     * Discover commissionable nodes (alias for discoverCommissionableNodes).
     */
    async discover(): Promise<CommissionableNodeData[]> {
        return this.discoverCommissionableNodes();
    }

    /**
     * Get diagnostics from the server.
     */
    async getDiagnostics(): Promise<{ info: ServerInfoMessage; nodes: MatterNode[]; events: MatterNodeEvent[] }> {
        return this.sendCommand("diagnostics", 0, {});
    }

    /**
     * Commission a device on the network with a setup PIN code.
     */
    async commissionOnNetwork(
        setupPinCode: number,
        filterType?: number,
        filter?: number,
        ipAddr?: string,
    ): Promise<MatterNode> {
        return this.sendCommand("commission_on_network", 0, {
            setup_pin_code: setupPinCode,
            filter_type: filterType,
            filter,
            ip_addr: ipAddr,
        });
    }

    /**
     * Set Thread operational dataset (alias with different name).
     */
    async setThreadDataset(dataset: string): Promise<void> {
        await this.setThreadOperationalDataset(dataset);
    }

    /**
     * Get node IP addresses (camelCase alias).
     */
    async getNodeIpAddresses(nodeId: number | bigint, preferCache = false, scoped = false): Promise<string[]> {
        return this.getNodeIPAddresses(nodeId, preferCache, scoped);
    }

    /**
     * Clear collected events.
     */
    clearEvents(): void {
        this.events = [];
    }

    /**
     * Get all collected events.
     */
    getEvents(): WsEvent[] {
        return [...this.events];
    }

    /**
     * Get the cached server info (returns null if not connected).
     */
    getServerInfo(): ServerInfoMessage | null {
        try {
            return this.serverInfo;
        } catch {
            return null;
        }
    }

    /**
     * Wait for a specific event with optional matcher and timeout.
     */
    async waitForEvent(eventType: string, matcher?: (data: unknown) => boolean, timeoutMs = 10_000): Promise<WsEvent> {
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

    /**
     * Close the connection.
     */
    async close(): Promise<void> {
        this.disconnect();
        // Give a moment for cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    /**
     * Start listening and return the initial nodes array.
     * This is a convenience method for testing that returns nodes.
     */
    async startListeningAndGetNodes(): Promise<MatterNode[]> {
        await super.startListening();
        return Object.values(this.nodes);
    }

    /**
     * Send a command and expect it to fail with a specific error code.
     * Uses a separate raw WebSocket connection to capture the full error response.
     */
    async sendCommandExpectError(command: string, args: Record<string, unknown>): Promise<ServerErrorResponse> {
        // Create a temporary raw WebSocket connection for this test
        const url = this.connection.ws_server_url;

        return new Promise((resolve, reject) => {
            const ws = new WebSocket(url);
            const messageId = `error_test_${Math.random().toString(36).substring(7)}`;
            let serverInfoReceived = false;

            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error(`Timeout waiting for error response to ${command}`));
            }, 10_000);

            ws.onopen = () => {
                // Wait for server info first, then send command
            };

            ws.onmessage = event => {
                const data = JSON.parse(event.data as string, (_key, value) => {
                    // Handle BigInt serialization
                    if (typeof value === "string" && /^\d{16,}$/.test(value)) {
                        return BigInt(value);
                    }
                    return value;
                });

                if (!serverInfoReceived) {
                    // First message is server info
                    serverInfoReceived = true;
                    // Now send our test command
                    ws.send(
                        JSON.stringify({
                            message_id: messageId,
                            command,
                            args,
                        }),
                    );
                    return;
                }

                // Check if this is our response
                if (data.message_id === messageId) {
                    clearTimeout(timeout);
                    ws.close();

                    if ("error_code" in data) {
                        resolve({
                            error_code: data.error_code,
                            details: data.details ?? "",
                        });
                    } else {
                        reject(new Error(`Expected error response but got success for ${command}`));
                    }
                }
            };

            ws.onerror = () => {
                clearTimeout(timeout);
                reject(new Error("WebSocket error"));
            };
        });
    }

    /**
     * Hook into event handling to collect events for testing.
     * This is called by the parent class for each incoming event.
     */
    protected override onRawEvent(event: EventMessage): void {
        const wsEvent: WsEvent = {
            event: event.event,
            data: event.data,
        };
        this.events.push(wsEvent);

        // Check if any waiters match this event
        for (let i = this.eventWaiters.length - 1; i >= 0; i--) {
            const waiter = this.eventWaiters[i];
            if (waiter.eventType === wsEvent.event && (!waiter.matcher || waiter.matcher(wsEvent.data))) {
                this.eventWaiters.splice(i, 1);
                waiter.resolve(wsEvent);
            }
        }
    }
}
