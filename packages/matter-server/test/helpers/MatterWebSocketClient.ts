/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * WebSocket client helper for communicating with the Matter server.
 */

import type {
    AttributesData,
    CommissionableNodeData,
    MatterFabricData,
    MatterNode,
    MatterNodeEvent,
    NodePingResult,
    ServerInfoMessage,
} from "@matter-server/controller";
import WebSocket from "ws";

export interface WsEvent {
    event: string;
    data: unknown;
}

interface WsResponse {
    message_id: string;
    result?: unknown;
    error_code?: number;
    details?: string;
}

interface EventWaiter {
    eventType: string;
    matcher?: (data: unknown) => boolean;
    resolve: (event: WsEvent) => void;
    reject: (error: Error) => void;
}

interface PendingRequest {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
}

export class MatterWebSocketClient {
    private ws: WebSocket | null = null;
    private messageId = 0;
    private pendingRequests = new Map<string, PendingRequest>();
    private serverInfo: ServerInfoMessage | null = null;
    private events: WsEvent[] = [];
    private eventWaiters: EventWaiter[] = [];

    constructor(private readonly wsUrl: string) {}

    /**
     * Serialize object to JSON with BigInt support.
     * BigInt values larger than MAX_SAFE_INTEGER are serialized as raw decimal numbers.
     */
    private toJson(object: object): string {
        const replacements = new Array<{ from: string; to: string }>();
        let result = JSON.stringify(object, (_key, value) => {
            if (typeof value === "bigint") {
                if (value > Number.MAX_SAFE_INTEGER) {
                    // Store replacement: quoted hex string -> raw decimal number
                    replacements.push({ from: `"0x${value.toString(16)}"`, to: value.toString() });
                    return `0x${value.toString(16)}`;
                } else {
                    return Number(value);
                }
            }
            return value;
        });
        // Replace quoted hex strings with raw decimal numbers
        for (const { from, to } of replacements) {
            result = result.replace(from, to);
        }
        return result;
    }

    /**
     * Parse JSON with BigInt support for large integers.
     * Numbers larger than MAX_SAFE_INTEGER are converted to BigInt.
     */
    private parseJson(json: string): unknown {
        // Replace large integers (> MAX_SAFE_INTEGER) with BigInt-style strings
        // Match integers that are too large for precise Number representation
        const processed = json.replace(/:\s*(\d{16,})/g, (_match, digits) => {
            const num = BigInt(digits);
            if (num > Number.MAX_SAFE_INTEGER) {
                return `: "${digits}n"`;
            }
            return _match;
        });

        return JSON.parse(processed, (_key, value) => {
            if (typeof value === "string" && /^\d+n$/.test(value)) {
                return BigInt(value.slice(0, -1));
            }
            return value;
        });
    }

    async connect(): Promise<ServerInfoMessage> {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(this.wsUrl);
            this.ws = ws;

            ws.on("open", () => {
                console.log("WebSocket connected");
            });

            ws.on("message", (data: WebSocket.Data) => {
                const message = this.parseJson(data.toString());
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
            const event = msg as unknown as WsEvent;
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
            const response = msg as unknown as WsResponse;
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
            this.ws!.send(this.toJson(message));
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
        nodeId: number | bigint,
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

    async removeNode(nodeId: number | bigint): Promise<void> {
        await this.sendCommand("remove_node", { node_id: nodeId });
    }

    async fetchServerInfo(): Promise<ServerInfoMessage> {
        return this.sendCommand<ServerInfoMessage>("server_info");
    }

    async getNodes(onlyAvailable = false): Promise<MatterNode[]> {
        return this.sendCommand<MatterNode[]>("get_nodes", { only_available: onlyAvailable });
    }

    async getNode(nodeId: number | bigint): Promise<MatterNode> {
        return this.sendCommand<MatterNode>("get_node", { node_id: nodeId });
    }

    async getVendorNames(filterVendors?: number[]): Promise<Record<string, string>> {
        return this.sendCommand<Record<string, string>>("get_vendor_names", {
            filter_vendors: filterVendors,
        });
    }

    async getDiagnostics(): Promise<{ info: ServerInfoMessage; nodes: MatterNode[]; events: MatterNodeEvent[] }> {
        return this.sendCommand("diagnostics", {});
    }

    async discover(): Promise<CommissionableNodeData[]> {
        return this.sendCommand<CommissionableNodeData[]>("discover");
    }

    async discoverCommissionableNodes(): Promise<CommissionableNodeData[]> {
        return this.sendCommand<CommissionableNodeData[]>("discover_commissionable_nodes");
    }

    async readAttribute(
        nodeId: number | bigint,
        attributePath: string | string[],
        fabricFiltered = false,
    ): Promise<AttributesData> {
        return this.sendCommand<AttributesData>("read_attribute", {
            node_id: nodeId,
            attribute_path: attributePath,
            fabric_filtered: fabricFiltered,
        });
    }

    async writeAttribute(nodeId: number | bigint, attributePath: string, value: unknown): Promise<unknown> {
        return this.sendCommand("write_attribute", {
            node_id: nodeId,
            attribute_path: attributePath,
            value,
        });
    }

    async pingNode(nodeId: number | bigint, attempts = 1): Promise<NodePingResult> {
        return this.sendCommand<NodePingResult>("ping_node", {
            node_id: nodeId,
            attempts,
        });
    }

    async getNodeIpAddresses(nodeId: number | bigint, preferCache = false, scoped = false): Promise<string[]> {
        return this.sendCommand<string[]>("get_node_ip_addresses", {
            node_id: nodeId,
            prefer_cache: preferCache,
            scoped,
        });
    }

    async interviewNode(nodeId: number | bigint): Promise<void> {
        await this.sendCommand("interview_node", { node_id: nodeId });
    }

    async getMatterFabrics(nodeId: number | bigint): Promise<MatterFabricData[]> {
        return this.sendCommand<MatterFabricData[]>("get_matter_fabrics", { node_id: nodeId });
    }

    async openCommissioningWindow(
        nodeId: number | bigint,
        timeout: number,
    ): Promise<{ setup_pin_code: number; setup_manual_code: string; setup_qr_code: string }> {
        return this.sendCommand("open_commissioning_window", {
            node_id: nodeId,
            timeout,
        });
    }

    async setWifiCredentials(ssid: string, credentials: string): Promise<void> {
        await this.sendCommand("set_wifi_credentials", { ssid, credentials });
    }

    async setThreadDataset(dataset: string): Promise<void> {
        await this.sendCommand("set_thread_dataset", { dataset });
    }

    async setDefaultFabricLabel(label: string | null): Promise<void> {
        await this.sendCommand("set_default_fabric_label", { label });
    }

    async importTestNode(dump: string): Promise<void> {
        await this.sendCommand("import_test_node", { dump });
    }

    async commissionOnNetwork(
        setupPinCode: number,
        filterType?: number,
        filter?: number,
        ipAddr?: string,
    ): Promise<MatterNode> {
        return this.sendCommand<MatterNode>("commission_on_network", {
            setup_pin_code: setupPinCode,
            filter_type: filterType,
            filter,
            ip_addr: ipAddr,
        });
    }

    async removeMatterFabric(nodeId: number | bigint, fabricIndex: number): Promise<void> {
        await this.sendCommand("remove_matter_fabric", {
            node_id: nodeId,
            fabric_index: fabricIndex,
        });
    }

    async checkNodeUpdate(nodeId: number | bigint): Promise<unknown> {
        return this.sendCommand("check_node_update", { node_id: nodeId });
    }

    async updateNode(nodeId: number | bigint, softwareVersion: number): Promise<unknown> {
        return this.sendCommand("update_node", { nodeId, softwareVersion });
    }

    clearEvents(): void {
        this.events = [];
    }

    getEvents(): WsEvent[] {
        return [...this.events];
    }

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

    close(): Promise<void> {
        return new Promise(resolve => {
            if (this.ws) {
                this.ws.once("close", resolve);
                this.ws.close();
                this.ws = null;
            } else {
                resolve();
            }
        });
    }

    getServerInfo(): ServerInfoMessage | null {
        return this.serverInfo;
    }
}
