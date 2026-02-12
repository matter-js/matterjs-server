/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { camelize, ClusterId, FabricIndex, Logger, LogLevel, Millis, NodeId, ObserverGroup } from "@matter/main";
import { ControllerCommissioningFlowOptions } from "@matter/main/protocol";
import { EndpointNumber, QrPairingCodeCodec } from "@matter/main/types";
import { NodeStates } from "@project-chip/matter.js/device";
import { WebSocketServer } from "ws";
import { ControllerCommandHandler } from "../controller/ControllerCommandHandler.js";
import { MatterController } from "../controller/MatterController.js";
import { TestNodeCommandHandler } from "../controller/TestNodeCommandHandler.js";
import { VendorIds } from "../data/VendorIDs.js";
import { ClusterMap, ClusterMapEntry } from "../model/ModelMapper.js";
import { CommissioningRequest } from "../types/CommandHandler.js";
import { HttpServer, WebServerHandler } from "../types/WebServer.js";
import {
    ArgsOf,
    ErrorResultMessage,
    EventTypes,
    LogLevelString,
    MatterNode,
    MatterNodeEvent,
    ResponseOf,
    ServerError,
    ServerErrorCode,
    ServerInfoMessage,
    SuccessResultMessage,
} from "../types/WebSocketMessageTypes.js";
import { formatNodeId } from "../util/formatNodeId.js";
import { MATTER_VERSION } from "../util/matterVersion.js";
import { ConfigStorage } from "./ConfigStorage.js";
import {
    convertMatterToWebSocketTagBased,
    parseBigIntAwareJson,
    splitAttributePath,
    toBigIntAwareJson,
} from "./Converters.js";

const logger = Logger.get("WebSocketControllerHandler");

/** Maximum number of events to keep in the history buffer */
const EVENT_HISTORY_SIZE = 25;

/** Counter for generating unique connection IDs */
let connectionIdCounter = 0;

/**
 * Generate a unique connection ID as a 4-digit hex string.
 * Rolls over at 0xFFFF (65535) to keep IDs short and readable.
 */
function generateConnectionId(): string {
    const id = connectionIdCounter;
    connectionIdCounter = (connectionIdCounter + 1) & 0xffff; // Rollover at 0xFFFF
    return id.toString(16);
}

const SCHEMA_VERSION = 11;

const skipMessageContentInLogFor = ["start_listening"];

/** WebSocket Server compatible with Schema version 11 */
export class WebSocketControllerHandler implements WebServerHandler {
    #controller: MatterController;
    #commandHandler: ControllerCommandHandler;
    #testNodeHandler: TestNodeCommandHandler;
    #config: ConfigStorage;
    #serverVersion: string;
    #wss?: WebSocketServer;
    #closed = false;
    /** Circular buffer for recent node events (max 25) */
    #eventHistory: MatterNodeEvent[] = [];
    /** Track when each node was last interviewed (connected) - keyed by nodeId */
    #lastInterviewDates = new Map<NodeId, Date>();

    constructor(controller: MatterController, config: ConfigStorage, serverVersion: string) {
        this.#controller = controller;
        this.#commandHandler = controller.commandHandler;
        this.#testNodeHandler = new TestNodeCommandHandler();
        this.#config = config;
        this.#serverVersion = serverVersion;
    }

    /**
     * Health check information for the server.
     * Returns the server version and number of registered nodes.
     */
    health() {
        const realNodeCount = this.#commandHandler.getNodeIds().length;
        const testNodeCount = this.#testNodeHandler.getNodes().length;
        return {
            version: this.#serverVersion,
            node_count: realNodeCount + testNodeCount,
        };
    }

    /**
     * Get the appropriate command handler for a node ID.
     * Returns TestNodeCommandHandler for test nodes, ControllerCommandHandler for real nodes.
     */
    #handlerFor(nodeId: number | bigint): TestNodeCommandHandler | ControllerCommandHandler {
        return TestNodeCommandHandler.isTestNodeId(nodeId) ? this.#testNodeHandler : this.#commandHandler;
    }

    /**
     * Add an event to the history buffer, maintaining max size.
     */
    #addEventToHistory(event: MatterNodeEvent) {
        this.#eventHistory.push(event);
        if (this.#eventHistory.length > EVENT_HISTORY_SIZE) {
            this.#eventHistory.shift();
        }
    }

    /**
     * Get the event history (last 25 events).
     */
    getEventHistory(): MatterNodeEvent[] {
        return [...this.#eventHistory];
    }

    async register(server: HttpServer) {
        logger.info(`Starting server: matter-server/${this.#serverVersion} (matter.js/${MATTER_VERSION})`);
        const wss = (this.#wss = new WebSocketServer({ server: server, path: "/ws" }));
        wss.on("connection", ws => {
            if (this.#closed) return;

            const connId = generateConnectionId();
            logger.info(`[${connId}] WebSocket connection established`);

            let listening = false;
            const observers = new ObserverGroup();

            const sendNodeDetailsEvent = <E extends EventTypes>(eventName: E, nodeId: NodeId) => {
                if (this.#closed || !listening) return;

                switch (eventName) {
                    case "node_added":
                    case "node_updated": {
                        try {
                            const nodeDetails = this.#collectNodeDetails(nodeId);
                            logger.debug(`[${connId}] Sending ${eventName} event for Node ${formatNodeId(nodeId)}`);
                            ws.send(toBigIntAwareJson({ event: eventName, data: nodeDetails }));
                        } catch (err) {
                            logger.error(
                                `[${connId}] Failed to collect node details for Node ${formatNodeId(nodeId)}`,
                                err,
                            );
                        }
                        break;
                    }
                    case "node_removed":
                        logger.debug(`[${connId}] Sending node_removed event for Node ${formatNodeId(nodeId)}`);
                        ws.send(toBigIntAwareJson({ event: eventName, data: nodeId }));
                        break;
                }
            };

            // Register all event listeners using ObserverGroup for easy cleanup
            observers.on(this.#commandHandler.events.attributeChanged, (nodeId, data) => {
                if (this.#closed) return;
                const { endpointId, clusterId, attributeId } = data.path;
                const pathStr = `${endpointId}/${clusterId}/${attributeId}`;
                const clusterData = ClusterMap[clusterId];
                const value = convertMatterToWebSocketTagBased(
                    data.value,
                    clusterData?.attributes[attributeId],
                    clusterData?.model,
                );
                logger.debug(
                    `[${connId}] Sending attribute_updated event for Node ${formatNodeId(nodeId)}`,
                    pathStr,
                    value,
                );
                ws.send(toBigIntAwareJson({ event: "attribute_updated", data: [nodeId, pathStr, value] }));
            });

            observers.on(this.#commandHandler.events.eventChanged, (nodeId, data) => {
                if (this.#closed || !listening) return;
                const { path, events } = data;
                const { endpointId, clusterId, eventId } = path;

                for (const event of events) {
                    let timestamp: number | bigint;
                    let timestampType: number;

                    if (event.epochTimestamp !== undefined) {
                        timestamp = event.epochTimestamp;
                        timestampType = 1; // Epoch
                    } else if (event.systemTimestamp !== undefined) {
                        timestamp = event.systemTimestamp;
                        timestampType = 0; // System
                    } else {
                        timestamp = Date.now();
                        timestampType = 2; // POSIX (fallback)
                    }

                    const nodeEvent: MatterNodeEvent = {
                        node_id: nodeId,
                        endpoint_id: endpointId,
                        cluster_id: clusterId,
                        event_id: eventId,
                        event_number: event.eventNumber,
                        priority: event.priority,
                        timestamp,
                        timestamp_type: timestampType,
                        data: event.data ?? null,
                    };

                    // Store event in the history buffer
                    this.#addEventToHistory(nodeEvent);

                    logger.debug(`[${connId}] Sending node_event for Node ${formatNodeId(nodeId)}`, nodeEvent);
                    ws.send(toBigIntAwareJson({ event: "node_event", data: nodeEvent }));
                }
            });

            observers.on(this.#commandHandler.events.nodeAdded, nodeId => {
                sendNodeDetailsEvent("node_added", nodeId);
            });

            observers.on(this.#commandHandler.events.nodeStateChanged, (nodeId, state) => {
                // Track last interview time when node becomes connected
                if (state === NodeStates.Connected) {
                    this.#lastInterviewDates.set(nodeId, new Date());
                }
                // Availability changes (and node_updated events) are handled by nodeAvailabilityChanged
                // Individual attribute updates are already sent via attributeChanged events
            });

            // Send node_updated when availability changes (debounced)
            observers.on(this.#commandHandler.events.nodeAvailabilityChanged, (nodeId, available) => {
                logger.info(`[${connId}] Node ${formatNodeId(nodeId)} availability changed to ${available}`);
                sendNodeDetailsEvent("node_updated", nodeId);
            });

            observers.on(this.#commandHandler.events.nodeStructureChanged, nodeId => {
                sendNodeDetailsEvent("node_updated", nodeId);
            });

            observers.on(this.#commandHandler.events.nodeDecommissioned, nodeId => {
                sendNodeDetailsEvent("node_removed", nodeId);
            });

            observers.on(this.#commandHandler.events.nodeEndpointAdded, (nodeId, endpointId) => {
                if (this.#closed || !listening) return;
                logger.info(
                    `[${connId}] Sending endpoint_added event for Node ${formatNodeId(nodeId)} endpoint ${endpointId}`,
                );
                ws.send(
                    toBigIntAwareJson({ event: "endpoint_added", data: { node_id: nodeId, endpoint_id: endpointId } }),
                );
            });

            observers.on(this.#commandHandler.events.nodeEndpointRemoved, (nodeId, endpointId) => {
                if (this.#closed || !listening) return;
                logger.info(
                    `[${connId}] Sending endpoint_removed event for Node ${formatNodeId(nodeId)} endpoint ${endpointId}`,
                );
                ws.send(
                    toBigIntAwareJson({
                        event: "endpoint_removed",
                        data: { node_id: nodeId, endpoint_id: endpointId },
                    }),
                );
            });

            // Register test node event listeners
            observers.on(this.#testNodeHandler.nodeAdded, (_nodeId, testNode) => {
                if (this.#closed || !listening) return;
                logger.info(`[${connId}] Sending node_added event for test node ${testNode.node_id}`);
                ws.send(toBigIntAwareJson({ event: "node_added", data: testNode }));
            });

            observers.on(this.#testNodeHandler.nodeRemoved, nodeId => {
                if (this.#closed || !listening) return;
                logger.info(`[${connId}] Sending node_removed event for test node ${formatNodeId(nodeId)}`);
                ws.send(toBigIntAwareJson({ event: "node_removed", data: nodeId }));
            });

            let connectionClosed = false;
            const onClose = () => {
                if (connectionClosed) {
                    return;
                }
                connectionClosed = true;
                logger.info(`[${connId}] WebSocket connection closed`);
                observers.close();
            };

            ws.on(
                "message",
                data =>
                    void this.#handleWebSocketRequest(connId, data.toString()).then(
                        ({ response, enableListeners }) => {
                            if (this.#closed) return;
                            if (enableListeners) {
                                listening = true;
                            }
                            ws.send(toBigIntAwareJson(response));
                        },
                        err => logger.error(`[${connId}] WebSocket request error`, err),
                    ),
            );

            ws.on("close", onClose);
            ws.on("error", err => {
                logger.error(`[${connId}] WebSocket error`, err);
                onClose();
            });

            this.#getServerInfo().then(
                response => {
                    logger.debug(`[${connId}] Sending server info`);
                    ws.send(toBigIntAwareJson(response));
                },
                err => logger.error(`[${connId}] WebSocket handshake error`, err),
            );
        });

        // Initialize all nodes (populates attribute caches) and start connecting them.
        // Guarded internally so it runs exactly once even with multiple listen addresses.
        await this.#commandHandler.initializeNodes();
    }

    unregister(): Promise<void> {
        if (!this.#wss || this.#closed) {
            return Promise.resolve();
        }

        this.#closed = true;
        // Send server_shutdown event to all connected clients before closing
        const shutdownMessage = toBigIntAwareJson({ event: "server_shutdown", data: {} });
        this.#wss.clients.forEach(client => {
            if (client.readyState === 1 /* WebSocket.OPEN */) {
                try {
                    client.send(shutdownMessage, () => {
                        client.close();
                    });
                } catch (err) {
                    logger.warn("Failed to send server_shutdown event to client", err);
                }
            }
        });
        console.log("send close to clients");

        const wss = this.#wss;
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

    async #handleWebSocketRequest(
        connId: string,
        data: string,
    ): Promise<{ response: ErrorResultMessage | SuccessResultMessage<any>; enableListeners?: boolean }> {
        let messageId: string | undefined;
        try {
            logger.debug(`[${connId}] Received WebSocket request`, () => data);
            const request = parseBigIntAwareJson(data) as { message_id: string; command: string; args: any };
            const { command, args } = request;
            messageId = request.message_id;
            let result: ResponseOf<any>;
            let enableListeners: boolean | undefined = undefined;
            switch (command) {
                case "start_listening":
                    result = this.#handleStartListening(args);
                    enableListeners = true;
                    break;
                case "set_default_fabric_label":
                    result = await this.#handleSetDefaultFabricLabel(args);
                    break;
                case "commission_with_code":
                    result = await this.#handleCommissionWithCode(args);
                    break;
                case "commission_on_network":
                    result = await this.#handleCommissionOnNetwork(args);
                    break;
                case "get_node":
                    result = await this.#handleGetNode(args);
                    break;
                case "get_nodes":
                    result = this.#handleGetNodes(args);
                    break;
                case "get_node_ip_addresses":
                    result = await this.#handleGetNodeIpAddresses(args);
                    break;
                case "read_attribute":
                    result = await this.#handleReadAttribute(args);
                    break;
                case "get_vendor_names":
                    result = await this.#handleGetVendorNames(args);
                    break;
                case "device_command":
                    result = await this.#handleDeviceCommand(args);
                    break;
                case "write_attribute":
                    result = await this.#handleWriteAttribute(args);
                    break;
                case "interview_node":
                    result = await this.#handleInterviewNode(args);
                    break;
                case "ping_node":
                    result = await this.#handlePingNode(args);
                    break;
                case "diagnostics":
                    result = {
                        info: await this.#getServerInfo(),
                        nodes: this.#handleGetNodes(args),
                        events: this.getEventHistory(),
                    };
                    break;
                case "remove_node":
                    result = await this.#handleRemoveNode(args);
                    break;
                case "set_wifi_credentials":
                    result = await this.#handleSetWifiCredentials(args);
                    break;
                case "set_thread_dataset":
                    result = await this.#handleSetThreadDataset(args);
                    break;
                case "open_commissioning_window":
                    result = await this.#handleOpenCommissioningWindow(args);
                    break;
                case "discover_commissionable_nodes":
                    result = await this.#handleDiscoverCommissionableNodes(args);
                    break;
                case "get_matter_fabrics":
                    result = await this.#handleGetMatterFabrics(args);
                    break;
                case "remove_matter_fabric":
                    result = await this.#handleRemoveMatterFabric(args);
                    break;
                case "set_acl_entry":
                    result = await this.#handleSetAclEntry(args);
                    break;
                case "set_node_binding":
                    result = await this.#handleSetNodeBinding(args);
                    break;
                case "import_test_node":
                    result = await this.#handleImportTestNode(args);
                    break;
                case "check_node_update":
                    result = await this.#handleCheckNodeUpdate(args);
                    break;
                case "update_node":
                    result = await this.#handleUpdateNode(args);
                    break;
                case "server_info":
                    result = await this.#getServerInfo();
                    break;
                case "discover":
                    result = await this.#handleDiscoverCommissionableNodes({});
                    break;
                case "get_loglevel":
                    result = this.#handleGetLogLevel();
                    break;
                case "set_loglevel":
                    result = this.#handleSetLogLevel(args);
                    break;
                default:
                    throw ServerError.invalidCommand(command);
            }
            if (result === undefined) {
                throw ServerError.sdkStackError("Command handler returned no response");
            }
            if (skipMessageContentInLogFor.includes(command)) {
                logger.debug(`[${connId}] WebSocket request (${command}) handled`, messageId);
            } else {
                logger.debug(`[${connId}] WebSocket request (${command}) handled`, messageId, result);
            }
            return {
                response: {
                    message_id: messageId ?? "",
                    result,
                },
                enableListeners,
            };
        } catch (err) {
            logger.error(`[${connId}] Failed to handle websocket request`, err);
            const errorCode = err instanceof ServerError ? err.code : ServerErrorCode.UnknownError;
            return {
                response: {
                    message_id: messageId ?? "",
                    error_code: errorCode,
                    details: (err as Error).message,
                },
            };
        }
    }

    async #getServerInfo(): Promise<ServerInfoMessage> {
        await this.#commandHandler.start();
        const {
            fabricId: fabric_id,
            compressedFabricId: compressed_fabric_id,
            fabricIndex: fabric_index,
        } = await this.#commandHandler.getCommissionerFabricData();
        return {
            fabric_id,
            compressed_fabric_id,
            fabric_index,
            schema_version: SCHEMA_VERSION,
            min_supported_schema_version: SCHEMA_VERSION,
            sdk_version: `matter-server/${this.#serverVersion} (matter.js/${MATTER_VERSION})`,
            wifi_credentials_set: !!(this.#config.wifiSsid && this.#config.wifiCredentials),
            thread_credentials_set: !!this.#config.threadDataset,
            bluetooth_enabled: this.#commandHandler.bleEnabled,
        };
    }

    /**
     * Broadcast an event to all connected WebSocket clients.
     */
    #broadcastEvent(event: string, data: unknown) {
        if (!this.#wss || this.#closed) return;
        const message = toBigIntAwareJson({ event, data });
        this.#wss.clients.forEach(client => {
            if (client.readyState === 1 /* WebSocket.OPEN */) {
                try {
                    client.send(message);
                } catch (err) {
                    logger.warn(`Failed to broadcast ${event} event to client`, err);
                }
            }
        });
    }

    /**
     * Send server_info_updated event to all connected clients.
     */
    async #broadcastServerInfoUpdated() {
        const serverInfo = await this.#getServerInfo();
        logger.info("Broadcasting server_info_updated event", serverInfo);
        this.#broadcastEvent("server_info_updated", serverInfo);
    }

    #handleStartListening(_args: ArgsOf<"start_listening">): ResponseOf<"start_listening"> {
        return this.#handleGetNodes({});
    }

    async #handleSetDefaultFabricLabel(
        args: ArgsOf<"set_default_fabric_label">,
    ): Promise<ResponseOf<"set_default_fabric_label">> {
        const { label } = args;
        // Use "HomeAssistant" as default when null/empty is passed (matter.js requires non-empty labels)
        let effectiveLabel = label && label.trim() !== "" ? label.trim() : "HomeAssistant";
        effectiveLabel = effectiveLabel.substring(0, 32);
        await this.#config.set({ fabricLabel: effectiveLabel });
        await this.#commandHandler.setFabricLabel(effectiveLabel);
        return null;
    }

    async #handleCommissionWithCode(args: ArgsOf<"commission_with_code">): Promise<ResponseOf<"commission_with_code">> {
        const { code, network_only } = args;
        const isQrCode = code.startsWith("MT:");

        const nextNodeId = this.#config.nextNodeId;

        let wifiCredentials: ControllerCommissioningFlowOptions["wifiNetwork"] | undefined = undefined;
        let threadCredentials: ControllerCommissioningFlowOptions["threadNetwork"] | undefined = undefined;
        if (!network_only && this.#commandHandler.bleEnabled) {
            if (this.#config.wifiSsid && this.#config.wifiCredentials) {
                wifiCredentials = {
                    wifiSsid: this.#config.wifiSsid,
                    wifiCredentials: this.#config.wifiCredentials,
                };
            }
            if (this.#config.threadDataset) {
                threadCredentials = {
                    networkName: "", // Thread network name is not needed when providing operational dataset
                    operationalDataset: this.#config.threadDataset,
                };
            }
        }

        await this.#config.set({ nextNodeId: nextNodeId + 1 });

        const { nodeId } = await this.#commandHandler.commissionNode({
            nodeId: NodeId(nextNodeId),
            onNetworkOnly: network_only,
            ...(isQrCode ? { qrCode: code } : { manualCode: code }),
            wifiCredentials,
            threadCredentials,
        });

        return this.#collectNodeDetails(nodeId);
    }

    async #handleCommissionOnNetwork(
        args: ArgsOf<"commission_on_network">,
    ): Promise<ResponseOf<"commission_on_network">> {
        const { setup_pin_code, filter_type, filter, ip_addr } = args;

        const nextNodeId = this.#config.nextNodeId;

        // Build commissioning request based on filter type
        // Filter types: 0=None, 1=ShortDiscriminator, 2=LongDiscriminator, 3=VendorId, 4=DeviceType
        let commissionRequest: CommissioningRequest;

        const baseRequest = {
            nodeId: NodeId(nextNodeId),
            onNetworkOnly: true, // commission_on_network is always network-only
            knownAddress: ip_addr ? { ip: ip_addr, port: 5540 } : undefined,
        };

        switch (filter_type) {
            case 1: // Short discriminator
                if (filter === undefined)
                    throw ServerError.invalidArguments("filter required for filter_type 1 (short discriminator)");
                commissionRequest = { ...baseRequest, passcode: setup_pin_code, shortDiscriminator: filter };
                break;
            case 2: // Long discriminator
                if (filter === undefined)
                    throw ServerError.invalidArguments("filter required for filter_type 2 (long discriminator)");
                commissionRequest = { ...baseRequest, passcode: setup_pin_code, longDiscriminator: filter };
                break;
            case 3: // Vendor ID (requires product ID too, but Python server only passes vendor ID)  // TODO, will basically never work!
                if (filter === undefined)
                    throw ServerError.invalidArguments("filter required for filter_type 3 (vendor ID)");
                commissionRequest = { ...baseRequest, passcode: setup_pin_code, vendorId: filter, productId: 0 };
                break;
            case 4: // Device type - not directly supported, fall back to no filter
            case 0: // No filter
            default:
                // Discover any commissionable device with the passcode
                commissionRequest = { ...baseRequest, passcode: setup_pin_code };
                break;
        }

        await this.#config.set({ nextNodeId: nextNodeId + 1 });

        const { nodeId } = await this.#commandHandler.commissionNode(commissionRequest);

        return this.#collectNodeDetails(nodeId);
    }

    #handleGetNodes(args: ArgsOf<"get_nodes">): ResponseOf<"get_nodes"> {
        const { only_available = false } = args ?? {};
        const nodeDetails = new Array<MatterNode>();
        // Include real nodes
        for (const node of this.#commandHandler.getNodeIds()) {
            const details = this.#collectNodeDetails(node);
            if (!only_available || details.available) {
                nodeDetails.push(details);
            }
        }
        // Include test nodes
        for (const testNode of this.#testNodeHandler.getNodes()) {
            if (!only_available || testNode.available) {
                nodeDetails.push(testNode);
            }
        }
        return nodeDetails;
    }

    async #handleGetNode(args: ArgsOf<"get_node">): Promise<ResponseOf<"get_node">> {
        const { node_id } = args;
        const nodeId = NodeId(node_id);
        const handler = this.#handlerFor(node_id);

        if (!handler.hasNode(nodeId)) {
            throw ServerError.nodeNotExists(node_id);
        }

        // Pass the last interview date for real nodes
        if (handler === this.#commandHandler) {
            return this.#commandHandler.getNodeDetails(nodeId, this.#lastInterviewDates.get(nodeId));
        }
        return handler.getNodeDetails(nodeId);
    }

    async #handleGetNodeIpAddresses(
        args: ArgsOf<"get_node_ip_addresses">,
    ): Promise<ResponseOf<"get_node_ip_addresses">> {
        const { node_id, prefer_cache, scoped } = args;
        const result = await this.#handlerFor(node_id).getNodeIpAddresses(NodeId(node_id), prefer_cache);
        // scoped=true means keep the interface suffix (e.g., %en0), scoped=false (default) strips it
        if (scoped) {
            return result;
        }
        return result.map(ip => (ip.includes("%") ? ip.split("%")[0] : ip));
    }

    async #handleReadAttribute(args: ArgsOf<"read_attribute">): Promise<ResponseOf<"read_attribute">> {
        const { node_id: nodeId, attribute_path, fabric_filtered = false } = args;

        // Normalize attribute_path to array
        const attributePaths = Array.isArray(attribute_path) ? attribute_path : [attribute_path];

        const result = await this.#handlerFor(nodeId).handleReadAttributes(
            NodeId(nodeId),
            attributePaths,
            fabric_filtered,
        );

        if (Object.keys(result).length === 0) {
            throw ServerError.sdkStackError("Failed to read attribute: no values returned");
        }

        return result;
    }

    async #handleWriteAttribute(args: ArgsOf<"write_attribute">): Promise<ResponseOf<"write_attribute">> {
        const { node_id: nodeId, attribute_path, value } = args;
        const { endpointId, clusterId, attributeId } = splitAttributePath(attribute_path);

        // Write operations don't support wildcards
        if (endpointId === undefined || clusterId === undefined || attributeId === undefined) {
            throw ServerError.invalidArguments("write_attribute does not support wildcards in attribute path");
        }

        const { status } = await this.#handlerFor(nodeId).handleWriteAttribute({
            nodeId: NodeId(nodeId),
            endpointId,
            clusterId,
            attributeId,
            value,
        });
        return [
            {
                Path: { EndpointId: endpointId, ClusterId: clusterId, AttributeId: attributeId },
                Status: status ?? 0,
            },
        ];
    }

    async #handleGetVendorNames(args: ArgsOf<"get_vendor_names">): Promise<ResponseOf<"get_vendor_names">> {
        const { filter_vendors } = args;

        // Get vendor info from the DCL service
        const dclVendors = await this.#controller.getAllVendors();

        // Build merged result: DCL vendors override the static list but include static entries not in DCL
        const mergedVendors: { [key: string]: string } = {};

        // First add all static vendor IDs
        for (const [vendorIdStr, vendorName] of Object.entries(VendorIds)) {
            mergedVendors[vendorIdStr] = vendorName;
        }

        // Then override with DCL vendors (DCL wins)
        for (const [vendorId, vendorInfo] of dclVendors) {
            mergedVendors[vendorId] = vendorInfo.vendorName;
        }

        // If no filter, return all merged vendors
        if (!filter_vendors || !filter_vendors.length) {
            return mergedVendors;
        }

        // Filter to requested vendor IDs
        const result: { [key: string]: string } = {};
        for (const vendorId of filter_vendors) {
            const vendorName = mergedVendors[vendorId];
            if (vendorName) {
                result[vendorId] = vendorName;
            }
        }
        return result;
    }

    async #handleDeviceCommand(args: ArgsOf<"device_command">): Promise<ResponseOf<"device_command">> {
        const {
            node_id: nodeId,
            endpoint_id: endpointId,
            cluster_id: clusterId,
            command_name: commandName,
            payload,
            response_type,
            timed_request_timeout_ms: timedInteractionTimeoutMs,
        } = args;

        const result = await this.#handlerFor(nodeId).handleInvoke({
            nodeId: NodeId(nodeId),
            endpointId: EndpointNumber(endpointId),
            clusterId: ClusterId(clusterId),
            commandName: camelize(commandName),
            data: payload,
            timedInteractionTimeoutMs:
                typeof timedInteractionTimeoutMs === "number" ? Millis(timedInteractionTimeoutMs) : undefined,
        });

        // Test nodes and null response_type return null
        if (TestNodeCommandHandler.isTestNodeId(nodeId) || response_type === null) {
            return null;
        }
        const cmdResult = this.#convertCommandDataToWebSocketTagBased(ClusterId(clusterId), commandName, result);
        if (cmdResult === undefined) {
            return null;
        }
        return cmdResult;
    }

    async #handleInterviewNode(args: ArgsOf<"interview_node">): Promise<ResponseOf<"interview_node">> {
        const { node_id } = args;
        const nodeId = NodeId(node_id);

        // Handle test nodes - just broadcast the node_updated event
        if (TestNodeCommandHandler.isTestNodeId(nodeId)) {
            const testNode = this.#testNodeHandler.getNode(nodeId);
            if (testNode === undefined) {
                throw ServerError.nodeNotExists(nodeId);
            }
            logger.debug(`interview_node called for test node ${formatNodeId(nodeId)}`);
            // Update the last interview date for the test node
            testNode.last_interview = new Date().toISOString().replace("Z", "000");
            this.#broadcastEvent("node_updated", testNode);
            return null;
        }

        await this.#commandHandler.interviewNode(nodeId);

        // Update last interview date
        this.#lastInterviewDates.set(nodeId, new Date());

        return null;
    }

    async #handlePingNode(args: ArgsOf<"ping_node">): Promise<ResponseOf<"ping_node">> {
        const { node_id, attempts = 1 } = args;
        return await this.#handlerFor(node_id).pingNode(NodeId(node_id), attempts);
    }

    async #handleRemoveNode(args: ArgsOf<"remove_node">): Promise<ResponseOf<"remove_node">> {
        const { node_id } = args;
        await this.#handlerFor(node_id).removeNode(NodeId(node_id));
        return null;
    }

    async #handleSetWifiCredentials(args: ArgsOf<"set_wifi_credentials">): Promise<ResponseOf<"set_wifi_credentials">> {
        const { ssid, credentials } = args;
        await this.#config.set({ wifiSsid: ssid, wifiCredentials: credentials });
        // Broadcast server_info_updated event to notify clients of credential change
        try {
            await this.#broadcastServerInfoUpdated();
        } catch (error) {
            logger.warn("Failed to broadcast server info update", error);
        }
        return {};
    }

    async #handleSetThreadDataset(args: ArgsOf<"set_thread_dataset">): Promise<ResponseOf<"set_thread_dataset">> {
        const { dataset } = args;
        await this.#config.set({ threadDataset: dataset });
        // Broadcast server_info_updated event to notify clients of credential change
        try {
            await this.#broadcastServerInfoUpdated();
        } catch (error) {
            logger.warn("Failed to broadcast server info update", error);
        }
        return {};
    }

    async #handleOpenCommissioningWindow(
        args: ArgsOf<"open_commissioning_window">,
    ): Promise<ResponseOf<"open_commissioning_window">> {
        const { node_id, timeout /*, iteration, option, discriminator*/ } = args;
        const nodeId = NodeId(node_id);
        const { manualCode, qrCode } = await this.#commandHandler.openCommissioningWindow({
            nodeId,
            timeout,
        });
        const pairingCodeCodec = QrPairingCodeCodec.decode(qrCode);
        return { setup_pin_code: pairingCodeCodec[0].passcode, setup_manual_code: manualCode, setup_qr_code: qrCode };
    }

    async #handleDiscoverCommissionableNodes(
        _args: ArgsOf<"discover_commissionable_nodes">,
    ): Promise<ResponseOf<"discover_commissionable_nodes">> {
        const result = await this.#commandHandler.handleDiscovery({});
        return result.map(
            ({
                commissioningMode,
                deviceName,
                deviceType,
                hostName,
                instanceName,
                longDiscriminator,
                // numIPs,
                pairingHint,
                pairingInstruction,
                port,
                productId,
                rotatingId,
                // rotatingIdLen,
                // shortDiscriminator,
                // supportsTcpClient,
                supportsTcpServer,
                vendorId,
                addresses,
                mrpSessionActiveInterval,
                mrpSessionIdleInterval,
            }) =>
                ({
                    instance_name: instanceName,
                    host_name: hostName, // TODO
                    port,
                    long_discriminator: longDiscriminator,
                    vendor_id: vendorId,
                    product_id: productId,
                    commissioning_mode: commissioningMode,
                    device_type: deviceType,
                    device_name: deviceName,
                    pairing_instruction: pairingInstruction,
                    pairing_hint: pairingHint,
                    mrp_retry_interval_idle: mrpSessionIdleInterval,
                    mrp_retry_interval_active: mrpSessionActiveInterval,
                    supports_tcp: supportsTcpServer,
                    addresses,
                    rotating_id: rotatingId,
                }),
        );
    }

    async #handleGetMatterFabrics(args: ArgsOf<"get_matter_fabrics">): Promise<ResponseOf<"get_matter_fabrics">> {
        const { node_id } = args;
        const nodeId = NodeId(node_id);
        const fabrics = await this.#commandHandler.getFabrics(nodeId);
        return fabrics.map(({ fabricId, vendorId, fabricIndex, label }) => ({
            fabric_id: fabricId,
            vendor_id: vendorId,
            fabric_index: fabricIndex,
            fabric_label: label,
            vendor_name: VendorIds[vendorId],
        }));
    }

    async #handleRemoveMatterFabric(args: ArgsOf<"remove_matter_fabric">): Promise<ResponseOf<"remove_matter_fabric">> {
        const { node_id, fabric_index } = args;
        await this.#commandHandler.removeFabric(NodeId(node_id), FabricIndex(fabric_index));
        return {};
    }

    async #handleSetAclEntry(args: ArgsOf<"set_acl_entry">): Promise<ResponseOf<"set_acl_entry">> {
        const { node_id, entry } = args;
        return await this.#commandHandler.setAclEntry(NodeId(node_id), entry);
    }

    async #handleSetNodeBinding(args: ArgsOf<"set_node_binding">): Promise<ResponseOf<"set_node_binding">> {
        const { node_id, endpoint, bindings } = args;
        return await this.#commandHandler.setNodeBinding(NodeId(node_id), EndpointNumber(endpoint), bindings);
    }

    async #handleImportTestNode(args: ArgsOf<"import_test_node">): Promise<ResponseOf<"import_test_node">> {
        const { dump } = args;
        // Import is handled by TestNodeCommandHandler
        // Events are broadcast via the nodeAdded observable
        this.#testNodeHandler.importTestNodes(dump);
        return null;
    }

    async #handleCheckNodeUpdate(args: ArgsOf<"check_node_update">): Promise<ResponseOf<"check_node_update">> {
        const { node_id } = args;
        return await this.#commandHandler.checkNodeUpdate(NodeId(node_id));
    }

    async #handleUpdateNode(args: ArgsOf<"update_node">): Promise<ResponseOf<"update_node">> {
        const { node_id, software_version } = args;
        const targetVersion = typeof software_version === "string" ? parseInt(software_version, 10) : software_version;
        return await this.#commandHandler.updateNode(NodeId(node_id), targetVersion);
    }

    #collectNodeDetails(nodeId: NodeId): MatterNode {
        const lastInterviewDate = this.#lastInterviewDates.get(nodeId);
        return this.#commandHandler.getNodeDetails(nodeId, lastInterviewDate);
    }

    #convertCommandDataToWebSocketTagBased(
        clusterId: ClusterId,
        commandName: string,
        value: unknown,
        clusterData?: ClusterMapEntry,
    ) {
        if (!clusterData) {
            clusterData = ClusterMap[clusterId];
        }

        if (clusterData === undefined || clusterData.commands[commandName.toLowerCase()] === undefined) {
            logger.warn(
                `Cluster ${clusterId} does not have command ${commandName}. Do not convert data to WebSocket tag based`,
                value,
            );
            return {};
        }

        return convertMatterToWebSocketTagBased(
            value,
            clusterData.commands[commandName.toLowerCase()]!.responseModel,
            clusterData.model,
        );
    }

    /**
     * Map internal LogLevel enum to API string format.
     */
    #logLevelToString(level: LogLevel): LogLevelString {
        switch (level) {
            case LogLevel.FATAL:
                return "critical";
            case LogLevel.ERROR:
                return "error";
            case LogLevel.WARN:
                return "warning";
            case LogLevel.INFO:
                return "info";
            case LogLevel.DEBUG:
                return "debug";
            default:
                return "info";
        }
    }

    /**
     * Map API string format to internal LogLevel enum.
     */
    #stringToLogLevel(level: LogLevelString): LogLevel {
        switch (level) {
            case "critical":
                return LogLevel.FATAL;
            case "error":
                return LogLevel.ERROR;
            case "warning":
                return LogLevel.WARN;
            case "info":
                return LogLevel.INFO;
            case "debug":
                return LogLevel.DEBUG;
            default:
                return LogLevel.INFO;
        }
    }

    #handleGetLogLevel(): ResponseOf<"get_loglevel"> {
        // Logger.level can be LogLevel enum or string, convert string to enum first
        const currentLevel =
            typeof Logger.level === "string" ? this.#stringToLogLevel(Logger.level as LogLevelString) : Logger.level;
        const consoleLevel = this.#logLevelToString(currentLevel);

        // Logger.destinations.file throws if file logging is not configured
        let fileLevel: LogLevelString | null = null;
        try {
            const fileDestination = Logger.destinations.file;
            const fileLevelValue =
                typeof fileDestination.level === "string"
                    ? this.#stringToLogLevel(fileDestination.level as LogLevelString)
                    : fileDestination.level;
            fileLevel = this.#logLevelToString(fileLevelValue);
        } catch {
            // File logging not configured, fileLevel stays null
        }

        return {
            console_loglevel: consoleLevel,
            file_loglevel: fileLevel,
        };
    }

    #handleSetLogLevel(args: ArgsOf<"set_loglevel">): ResponseOf<"set_loglevel"> {
        const { console_loglevel, file_loglevel } = args;

        // Set console log level if provided
        if (console_loglevel !== undefined) {
            Logger.level = this.#stringToLogLevel(console_loglevel);
            logger.info(`Console log level set to: ${console_loglevel}`);
        }

        // Set file log level if provided and file logging is enabled
        if (file_loglevel !== undefined) {
            try {
                const fileDestination = Logger.destinations.file;
                fileDestination.level = this.#stringToLogLevel(file_loglevel);
                logger.info(`File log level set to: ${file_loglevel}`);
            } catch {
                // File logging not configured, ignore
            }
        }

        // Return current levels
        return this.#handleGetLogLevel();
    }
}
