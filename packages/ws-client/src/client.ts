/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Connection, WebSocketFactory } from "./connection.js";
import { CommandTimeoutError, ConnectionClosedError, InvalidServerVersion } from "./exceptions.js";
import {
    AccessControlEntry,
    APICommands,
    BindingTarget,
    CommissionableNodeData,
    CommissioningParameters,
    ErrorResultMessage,
    EventMessage,
    LogLevelResponse,
    LogLevelString,
    MatterFabricData,
    MatterSoftwareVersion,
    NodePingResult,
    SuccessResultMessage,
} from "./models/model.js";
import { MatterNode } from "./models/node.js";

/** Union type for all incoming WebSocket messages */
type IncomingMessage = EventMessage | ErrorResultMessage | SuccessResultMessage;

/** Converts node_id to string for use as object key (works for both number and bigint without precision loss) */
function toNodeKey(nodeId: number | bigint): string {
    return String(nodeId);
}

/** Default timeout for WebSocket commands in milliseconds (5 minutes) */
export const DEFAULT_COMMAND_TIMEOUT = 5 * 60 * 1000;

export class MatterClient {
    public connection: Connection;
    public nodes: Record<string, MatterNode> = {};
    public serverBaseAddress: string;
    /** Whether this client is connected to a production server (optional, for UI purposes) */
    public isProduction: boolean = false;
    /** Default timeout for commands in milliseconds. Set to 0 to disable timeouts. */
    public commandTimeout: number = DEFAULT_COMMAND_TIMEOUT;
    // Using 'unknown' for resolve since the actual types vary by command
    private result_futures: Record<
        string,
        {
            resolve: (value: unknown) => void;
            reject: (reason?: unknown) => void;
            timeoutId?: ReturnType<typeof setTimeout>;
        }
    > = {};
    // Start with random offset for defense-in-depth and easier debugging across sessions
    private msgId = Math.floor(Math.random() * 0x7fffffff);
    private eventListeners: Record<string, Array<() => void>> = {};

    /**
     * Create a new MatterClient.
     * @param url WebSocket URL to connect to
     * @param wsFactory Optional factory function to create WebSocket instances.
     *                  For Node.js, pass: (url) => new WebSocket(url) from the 'ws' package.
     *                  For browser, leave undefined to use native WebSocket.
     */
    constructor(
        public url: string,
        wsFactory?: WebSocketFactory,
    ) {
        this.url = url;
        this.connection = new Connection(this.url, wsFactory);
        this.serverBaseAddress = this.url.split("://")[1].split(":")[0] || "";
    }

    get serverInfo() {
        return this.connection.serverInfo!;
    }

    addEventListener(event: string, listener: () => void) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(listener);
        return () => {
            this.eventListeners[event] = this.eventListeners[event].filter(l => l !== listener);
        };
    }

    async commissionWithCode(code: string, networkOnly = true, timeout?: number): Promise<MatterNode> {
        // Commission a device using a QR Code or Manual Pairing Code.
        // code: The QR Code or Manual Pairing Code for device commissioning.
        // network_only: If True, restricts device discovery to network only.
        // timeout: Optional command timeout in milliseconds.
        // Returns: The NodeInfo of the commissioned device.
        return await this.sendCommand(
            "commission_with_code",
            0,
            {
                code: code,
                network_only: networkOnly,
            },
            timeout,
        );
    }

    async setWifiCredentials(ssid: string, credentials: string, timeout?: number): Promise<void> {
        // Set WiFi credentials for commissioning to a (new) device.
        await this.sendCommand("set_wifi_credentials", 0, { ssid, credentials }, timeout);
    }

    async setThreadOperationalDataset(dataset: string, timeout?: number): Promise<void> {
        // Set Thread Operational dataset in the stack.
        await this.sendCommand("set_thread_dataset", 0, { dataset }, timeout);
    }

    async openCommissioningWindow(
        nodeId: number | bigint,
        windowTimeout?: number,
        iteration?: number,
        option?: number,
        discriminator?: number,
        timeout?: number,
    ): Promise<CommissioningParameters> {
        // Open a commissioning window to commission a device present on this controller to another.
        // windowTimeout: How long to keep the commissioning window open (in seconds).
        // timeout: Optional command timeout in milliseconds.
        // Returns code to use as discriminator.
        return await this.sendCommand(
            "open_commissioning_window",
            0,
            {
                node_id: nodeId,
                timeout: windowTimeout,
                iteration,
                option,
                discriminator,
            },
            timeout,
        );
    }

    async discoverCommissionableNodes(timeout?: number): Promise<CommissionableNodeData[]> {
        // Discover Commissionable Nodes (discovered on BLE or mDNS).
        return await this.sendCommand("discover_commissionable_nodes", 0, {}, timeout);
    }

    async getMatterFabrics(nodeId: number | bigint, timeout?: number): Promise<MatterFabricData[]> {
        // Get Matter fabrics from a device.
        // Returns a list of MatterFabricData objects.
        return await this.sendCommand("get_matter_fabrics", 3, { node_id: nodeId }, timeout);
    }

    async removeMatterFabric(nodeId: number | bigint, fabricIndex: number, timeout?: number): Promise<void> {
        // Remove a Matter fabric from a device.
        await this.sendCommand("remove_matter_fabric", 3, { node_id: nodeId, fabric_index: fabricIndex }, timeout);
    }

    async pingNode(nodeId: number | bigint, attempts = 1, timeout?: number): Promise<NodePingResult> {
        // Ping node on the currently known IP-address(es).
        return await this.sendCommand("ping_node", 0, { node_id: nodeId, attempts }, timeout);
    }

    async getNodeIPAddresses(
        nodeId: number | bigint,
        preferCache?: boolean,
        scoped?: boolean,
        timeout?: number,
    ): Promise<string[]> {
        // Return the currently known (scoped) IP-address(es).
        return await this.sendCommand(
            "get_node_ip_addresses",
            8,
            {
                node_id: nodeId,
                prefer_cache: preferCache,
                scoped: scoped,
            },
            timeout,
        );
    }

    async removeNode(nodeId: number | bigint, timeout?: number): Promise<void> {
        // Remove a Matter node/device from the fabric.
        await this.sendCommand("remove_node", 0, { node_id: nodeId }, timeout);
    }

    async interviewNode(nodeId: number | bigint, timeout?: number): Promise<void> {
        // Interview a node.
        await this.sendCommand("interview_node", 0, { node_id: nodeId }, timeout);
    }

    async importTestNode(dump: string, timeout?: number): Promise<void> {
        // Import test node(s) from a HA or Matter server diagnostics dump.
        await this.sendCommand("import_test_node", 0, { dump }, timeout);
    }

    async readAttribute(
        nodeId: number | bigint,
        attributePath: string | string[],
        timeout?: number,
    ): Promise<Record<string, unknown>> {
        // Read one or more attribute(s) on a node by specifying an attributepath.
        return await this.sendCommand("read_attribute", 0, { node_id: nodeId, attribute_path: attributePath }, timeout);
    }

    async writeAttribute(
        nodeId: number | bigint,
        attributePath: string,
        value: unknown,
        timeout?: number,
    ): Promise<unknown> {
        // Write an attribute(value) on a target node.
        return await this.sendCommand(
            "write_attribute",
            0,
            {
                node_id: nodeId,
                attribute_path: attributePath,
                value: value,
            },
            timeout,
        );
    }

    async checkNodeUpdate(nodeId: number | bigint, timeout?: number): Promise<MatterSoftwareVersion | null> {
        // Check if there is an update for a particular node.
        // Reads the current software version and checks the DCL if there is an update
        // available. If there is an update available, the command returns the version
        // information of the latest update available.
        return await this.sendCommand("check_node_update", 10, { node_id: nodeId }, timeout);
    }

    async updateNode(nodeId: number | bigint, softwareVersion: number | string, timeout?: number): Promise<void> {
        // Update a node to a new software version.
        // This command checks if the requested software version is indeed still available
        // and if so, it will start the update process. The update process will be handled
        // by the built-in OTA provider. The OTA provider will download the update and
        // notify the node about the new update.
        await this.sendCommand("update_node", 10, { node_id: nodeId, software_version: softwareVersion }, timeout);
    }

    async setACLEntry(nodeId: number | bigint, entry: AccessControlEntry[], timeout?: number) {
        return await this.sendCommand(
            "set_acl_entry",
            0,
            {
                node_id: nodeId,
                entry: entry,
            },
            timeout,
        );
    }

    async setNodeBinding(nodeId: number | bigint, endpoint: number, bindings: BindingTarget[], timeout?: number) {
        return await this.sendCommand(
            "set_node_binding",
            0,
            {
                node_id: nodeId,
                endpoint: endpoint,
                bindings: bindings,
            },
            timeout,
        );
    }

    async deviceCommand(
        nodeId: number | bigint,
        endpointId: number,
        clusterId: number,
        commandName: string,
        payload: Record<string, unknown> = {},
        timeout?: number,
    ): Promise<unknown> {
        return await this.sendCommand(
            "device_command",
            0,
            {
                node_id: nodeId,
                endpoint_id: endpointId,
                cluster_id: clusterId,
                command_name: commandName,
                payload,
                response_type: null,
            },
            timeout,
        );
    }

    async getNodes(onlyAvailable = false, timeout?: number): Promise<MatterNode[]> {
        return await this.sendCommand("get_nodes", 0, { only_available: onlyAvailable }, timeout);
    }

    async getNode(nodeId: number | bigint, timeout?: number): Promise<MatterNode> {
        return await this.sendCommand("get_node", 0, { node_id: nodeId }, timeout);
    }

    async getVendorNames(filterVendors?: number[], timeout?: number): Promise<Record<string, string>> {
        return await this.sendCommand("get_vendor_names", 0, { filter_vendors: filterVendors }, timeout);
    }

    async fetchServerInfo(timeout?: number) {
        return await this.sendCommand("server_info", 0, {}, timeout);
    }

    async setDefaultFabricLabel(label: string | null, timeout?: number): Promise<void> {
        await this.sendCommand("set_default_fabric_label", 0, { label }, timeout);
    }

    /**
     * Get the current log levels for console and file logging.
     * @param timeout Optional command timeout in milliseconds
     * @returns The current log level configuration
     */
    async getLogLevel(timeout?: number): Promise<LogLevelResponse> {
        return await this.sendCommand("get_loglevel", 0, {}, timeout);
    }

    /**
     * Set the log level for console and/or file logging.
     * Changes are temporary and will be reset when the server restarts.
     * @param consoleLoglevel Console log level to set (optional)
     * @param fileLoglevel File log level to set, only applied if file logging is enabled (optional)
     * @param timeout Optional command timeout in milliseconds
     * @returns The log level configuration after the change
     */
    async setLogLevel(
        consoleLoglevel?: LogLevelString,
        fileLoglevel?: LogLevelString,
        timeout?: number,
    ): Promise<LogLevelResponse> {
        return await this.sendCommand(
            "set_loglevel",
            0,
            {
                console_loglevel: consoleLoglevel,
                file_loglevel: fileLoglevel,
            },
            timeout,
        );
    }

    /**
     * Send a command to the Matter server.
     * @param command The command name
     * @param require_schema Minimum schema version required (0 for any version)
     * @param args Command arguments
     * @param timeout Optional timeout in milliseconds. Defaults to `commandTimeout`. Set to 0 to disable.
     * @returns Promise that resolves with the command result
     * @throws Error if the command times out or fails
     */
    sendCommand<T extends keyof APICommands>(
        command: T,
        require_schema: number | undefined = undefined,
        args: APICommands[T]["requestArgs"],
        timeout = this.commandTimeout,
    ): Promise<APICommands[T]["response"]> {
        if (require_schema && this.serverInfo.schema_version < require_schema) {
            throw new InvalidServerVersion(
                "Command not available due to incompatible server version. Update the Matter " +
                    `Server to a version that supports at least api schema ${require_schema}.`,
            );
        }

        // Reset counter before overflow to maintain precision
        if (this.msgId >= Number.MAX_SAFE_INTEGER) {
            this.msgId = 0;
        }
        const messageId = String(++this.msgId);

        const message = {
            message_id: messageId,
            command,
            args,
        };

        return new Promise<APICommands[T]["response"]>((resolve, reject) => {
            // Set up timeout if enabled
            let timeoutId: ReturnType<typeof setTimeout> | undefined;
            if (timeout > 0) {
                timeoutId = setTimeout(() => {
                    // Check if still pending (not already resolved/rejected)
                    const pending = this.result_futures[messageId];
                    if (pending) {
                        // Clear timeout and delete entry BEFORE rejecting to prevent double resolution
                        if (pending.timeoutId) {
                            clearTimeout(pending.timeoutId);
                        }
                        delete this.result_futures[messageId];
                        reject(new CommandTimeoutError(command, timeout));
                    }
                }, timeout);
            }

            // Type-erased storage: resolve/reject are stored as unknown handlers
            this.result_futures[messageId] = {
                resolve: resolve as (value: unknown) => void,
                reject,
                timeoutId,
            };
            this.connection.sendMessage(message);
        });
    }

    /**
     * Safely resolve a pending command, ensuring it's only resolved once.
     * Clears timeout and removes from pending futures before resolving.
     */
    private _resolvePendingCommand(messageId: string, result: unknown): void {
        const pending = this.result_futures[messageId];
        if (pending) {
            // Clear timeout and delete entry BEFORE resolving to prevent double resolution
            if (pending.timeoutId) {
                clearTimeout(pending.timeoutId);
            }
            delete this.result_futures[messageId];
            pending.resolve(result);
        }
    }

    /**
     * Safely reject a pending command, ensuring it's only rejected once.
     * Clears timeout and removes from pending futures before rejecting.
     */
    private _rejectPendingCommand(messageId: string, error: Error): void {
        const pending = this.result_futures[messageId];
        if (pending) {
            // Clear timeout and delete entry BEFORE rejecting to prevent double resolution
            if (pending.timeoutId) {
                clearTimeout(pending.timeoutId);
            }
            delete this.result_futures[messageId];
            pending.reject(error);
        }
    }

    /**
     * Reject all pending commands with a ConnectionClosedError.
     * Called when the connection is closed or lost.
     */
    private _rejectAllPendingCommands(): void {
        const error = new ConnectionClosedError();
        const pendingIds = Object.keys(this.result_futures);
        for (const messageId of pendingIds) {
            this._rejectPendingCommand(messageId, error);
        }
    }

    async connect() {
        if (this.connection.connected) {
            return;
        }
        await this.connection.connect(
            msg => this._handleIncomingMessage(msg as IncomingMessage),
            () => {
                this._rejectAllPendingCommands();
                this.fireEvent("connection_lost");
            },
        );
    }

    disconnect(clearStorage = false) {
        // Reject all pending commands before disconnecting
        this._rejectAllPendingCommands();
        // disconnect from the server
        if (this.connection && this.connection.connected) {
            this.connection.disconnect();
        }
        if (clearStorage && typeof localStorage !== "undefined") {
            localStorage.removeItem("matterURL");
            location.reload();
        }
    }

    async startListening() {
        await this.connect();

        const nodesArray = await this.sendCommand("start_listening", 0, {});

        const nodes: Record<string, MatterNode> = {};
        for (const node of nodesArray) {
            nodes[toNodeKey(node.node_id)] = new MatterNode(node);
        }
        this.nodes = nodes;
    }

    private _handleIncomingMessage(msg: IncomingMessage) {
        if ("event" in msg) {
            this._handleEventMessage(msg);
            return;
        }

        if ("error_code" in msg) {
            this._rejectPendingCommand(msg.message_id, new Error(msg.details));
            return;
        }

        if ("result" in msg) {
            this._resolvePendingCommand(msg.message_id, msg.result);
            return;
        }

        console.warn("Received message with unknown format", msg);
    }

    private _handleEventMessage(event: EventMessage) {
        console.log("Incoming event", event);

        // Allow subclasses to hook into raw events (for testing)
        this.onRawEvent(event);

        if (event.event === "node_added") {
            const node = new MatterNode(event.data);
            this.nodes = { ...this.nodes, [toNodeKey(node.node_id)]: node };
            this.fireEvent("nodes_changed");
            return;
        }
        if (event.event === "node_removed") {
            delete this.nodes[toNodeKey(event.data)];
            this.nodes = { ...this.nodes };
            this.fireEvent("nodes_changed");
            return;
        }

        if (event.event === "node_updated") {
            const node = new MatterNode(event.data);
            this.nodes = { ...this.nodes, [toNodeKey(node.node_id)]: node };
            this.fireEvent("nodes_changed");
            return;
        }

        if (event.event === "attribute_updated") {
            const [nodeId, attributeKey, attributeValue] = event.data;
            const nodeKey = toNodeKey(nodeId);
            const existingNode = this.nodes[nodeKey];
            if (existingNode) {
                const node = new MatterNode(existingNode.data);
                node.attributes[attributeKey] = attributeValue;
                this.nodes = { ...this.nodes, [nodeKey]: node };
                this.fireEvent("nodes_changed");
            }
            return;
        }

        if (event.event === "server_info_updated") {
            this.connection.serverInfo = event.data;
            this.fireEvent("server_info_updated");
            return;
        }

        if (event.event === "server_shutdown") {
            this.fireEvent("server_shutdown");
            this.disconnect();
            return;
        }
    }

    private fireEvent(event: string) {
        const listeners = this.eventListeners[event];
        if (listeners) {
            for (const listener of listeners) {
                listener();
            }
        }
    }

    /**
     * Hook for subclasses to receive raw events.
     * Override this method to intercept all incoming events.
     * @param event The raw event message
     */
    protected onRawEvent(_event: EventMessage): void {
        // Default implementation does nothing
        // Subclasses can override to collect or process raw events
    }
}
