/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { AsyncObservable, isObject } from "@matter/general";
import {
    Bytes,
    camelize,
    ClientNode,
    ClientNodeInteraction,
    FabricId,
    FabricIndex,
    ipv4BytesToString,
    ipv6BytesToString,
    Logger,
    Millis,
    NodeId,
    Observable,
    Seconds,
    ServerAddress,
    ServerAddressUdp,
    SoftwareUpdateInfo,
    SoftwareUpdateManager,
} from "@matter/main";
import { GeneralDiagnosticsClient, OperationalCredentialsClient } from "@matter/main/behaviors";
import {
    AccessControl,
    Binding,
    GeneralCommissioning,
    GeneralDiagnostics,
    OperationalCredentials,
} from "@matter/main/clusters";
import {
    DecodedAttributeReportValue,
    DecodedEventReportValue,
    Invoke,
    PeerAddress,
    Read,
    SupportedTransportsSchema,
} from "@matter/main/protocol";
import {
    Attribute,
    AttributeId,
    ClusterId,
    ClusterType,
    Command,
    DeviceTypeId,
    EndpointNumber,
    getClusterById,
    GroupId,
    ManualPairingCodeCodec,
    QrPairingCodeCodec,
    Status,
    StatusResponseError,
    TlvAny,
    TlvBoolean,
    TlvByteString,
    TlvInt32,
    TlvNoResponse,
    TlvNullable,
    TlvObject,
    TlvString,
    TlvUInt64,
    TlvVoid,
    VendorId,
} from "@matter/main/types";
import { CommissioningController, NodeCommissioningOptions } from "@project-chip/matter.js";
import { NodeStates } from "@project-chip/matter.js/device";
import { ClusterMap, ClusterMapEntry } from "../model/ModelMapper.js";
import {
    buildAttributePath,
    convertCommandDataToMatter,
    convertMatterToWebSocketTagBased,
    getDateAsString,
    splitAttributePath,
} from "../server/Converters.js";
import {
    AttributeResponseStatus,
    AttributesData,
    CommissioningRequest,
    CommissioningResponse,
    DiscoveryRequest,
    DiscoveryResponse,
    InvokeByIdRequest,
    InvokeRequest,
    MatterNodeData,
    OpenCommissioningWindowRequest,
    OpenCommissioningWindowResponse,
    ReadEventRequest,
    ReadEventResponse,
    SubscribeAttributeRequest,
    SubscribeAttributeResponse,
    SubscribeEventRequest,
    SubscribeEventResponse,
    WriteAttributeByIdRequest,
    WriteAttributeRequest,
} from "../types/CommandHandler.js";
import {
    AccessControlEntry,
    AccessControlTarget,
    AttributeWriteResult,
    BindingTarget,
    MatterSoftwareVersion,
    NodePingResult,
    UpdateSource,
} from "../types/WebSocketMessageTypes.js";
import { pingIp } from "../util/network.js";
import { CustomClusterPoller } from "./CustomClusterPoller.js";
import { Nodes } from "./Nodes.js";

const logger = Logger.get("ControllerCommandHandler");

export class ControllerCommandHandler {
    #controller: CommissioningController;
    #started = false;
    #connected = false;
    #bleEnabled = false;
    #otaEnabled = false;
    /** Node management and attribute cache */
    #nodes = new Nodes();
    /** Cache of available updates keyed by nodeId */
    #availableUpdates = new Map<NodeId, SoftwareUpdateInfo>();
    /** Poller for custom cluster attributes (Eve energy, etc.) */
    #customClusterPoller: CustomClusterPoller;
    events = {
        started: new AsyncObservable(),
        attributeChanged: new Observable<[nodeId: NodeId, data: DecodedAttributeReportValue<any>]>(),
        eventChanged: new Observable<[nodeId: NodeId, data: DecodedEventReportValue<any>]>(),
        nodeAdded: new Observable<[nodeId: NodeId]>(),
        nodeStateChanged: new Observable<[nodeId: NodeId, state: NodeStates]>(),
        nodeStructureChanged: new Observable<[nodeId: NodeId]>(),
        nodeDecommissioned: new Observable<[nodeId: NodeId]>(),
        nodeEndpointAdded: new Observable<[nodeId: NodeId, endpointId: EndpointNumber]>(),
        nodeEndpointRemoved: new Observable<[nodeId: NodeId, endpointId: EndpointNumber]>(),
    };

    constructor(controllerInstance: CommissioningController, bleEnabled: boolean, otaEnabled: boolean) {
        this.#controller = controllerInstance;

        this.#bleEnabled = bleEnabled;
        this.#otaEnabled = otaEnabled;

        // Initialize custom cluster poller for Eve energy attributes etc.
        // Reads automatically trigger change events through the normal attribute flow
        this.#customClusterPoller = new CustomClusterPoller({
            nodeConnected: nodeId => !!(this.#nodes.has(nodeId) && this.#nodes.get(nodeId).isConnected),
            handleReadAttributes: (nodeId, paths, fabricFiltered) =>
                this.handleReadAttributes(nodeId, paths, fabricFiltered),
        });
    }

    get started() {
        return this.#started;
    }

    get bleEnabled() {
        return this.#bleEnabled;
    }

    async start() {
        if (this.#started) {
            return;
        }
        this.#started = true;

        await this.#controller.start();
        logger.info(`Controller started`);

        if (this.#otaEnabled) {
            // Subscribe to OTA provider events to track available updates
            await this.#setupOtaEventHandlers();
        }

        await this.events.started.emit();
    }

    /**
     * Set up event handlers for OTA update notifications from the SoftwareUpdateManager.
     */
    async #setupOtaEventHandlers() {
        if (!this.#otaEnabled) {
            return;
        }
        try {
            const otaProvider = this.#controller.otaProvider;
            if (!otaProvider) {
                logger.info("OTA provider not available");
                return;
            }

            // Access the SoftwareUpdateManager behavior events dynamically
            // Using 'any' because SoftwareUpdateManager is not directly exported from @matter/node
            const softwareUpdateManagerEvents = await otaProvider.act(agent => agent.get(SoftwareUpdateManager).events);
            if (softwareUpdateManagerEvents === undefined) {
                logger.info("SoftwareUpdateManager not available");
                return;
            }

            // Handle updateAvailable events - cache the update info
            softwareUpdateManagerEvents.updateAvailable.on(
                (peerAddress: PeerAddress, updateDetails: SoftwareUpdateInfo) => {
                    logger.info(`Update available for node ${peerAddress.nodeId}:`, updateDetails);
                    this.#availableUpdates.set(peerAddress.nodeId, updateDetails);
                },
            );

            // Handle updateDone events - clear the cached update info
            softwareUpdateManagerEvents.updateDone.on((peerAddress: PeerAddress) => {
                logger.info(`Update done for node ${peerAddress.nodeId}`);
                this.#availableUpdates.delete(peerAddress.nodeId);
            });

            logger.info("OTA event handlers registered");
        } catch (error) {
            logger.warn("Failed to setup OTA event handlers:", error);
        }
    }

    close() {
        if (!this.#started) return;
        this.#customClusterPoller.stop();
        return this.#controller.close();
    }

    async #registerNode(nodeId: NodeId) {
        const node = await this.#controller.getNode(nodeId);
        const attributeCache = this.#nodes.attributeCache;

        // Wire all Events to the Event emitters
        node.events.attributeChanged.on(data => {
            // Update the attribute cache with the new value in WebSocket format
            attributeCache.updateAttribute(nodeId, data);
            // Then emit the event for listeners
            this.events.attributeChanged.emit(nodeId, data);
        });
        node.events.eventTriggered.on(data => this.events.eventChanged.emit(nodeId, data));
        node.events.stateChanged.on(state => {
            // Only refresh cache on Connected state (not Reconnecting, WaitingForDiscovery, etc.)
            if (state === NodeStates.Connected) {
                attributeCache.update(node);
                // Register for custom cluster polling (e.g., Eve energy) after cache is updated
                const attributes = attributeCache.get(nodeId);
                if (attributes) {
                    this.#customClusterPoller.registerNode(nodeId, attributes);
                }
            }
            this.events.nodeStateChanged.emit(nodeId, state);
        });
        node.events.structureChanged.on(() => {
            // Structure changed means endpoints may have been added/removed, refresh cache
            if (node.isConnected) {
                attributeCache.update(node);
            }
            this.events.nodeStructureChanged.emit(nodeId);
        });
        node.events.decommissioned.on(() => this.events.nodeDecommissioned.emit(nodeId));
        node.events.nodeEndpointAdded.on(endpointId => this.events.nodeEndpointAdded.emit(nodeId, endpointId));
        node.events.nodeEndpointRemoved.on(endpointId => this.events.nodeEndpointRemoved.emit(nodeId, endpointId));

        // Store the node for direct access
        this.#nodes.set(nodeId, node);

        // Initialize attribute cache if node is already initialized
        if (node.initialized) {
            attributeCache.add(node);
            // Register for custom cluster polling (e.g., Eve energy)
            const attributes = attributeCache.get(nodeId);
            if (attributes) {
                this.#customClusterPoller.registerNode(nodeId, attributes);
            }
        }

        return node;
    }

    async connect() {
        if (this.#connected) {
            return;
        }
        this.#connected = true;

        await this.start();

        const nodes = this.#controller.getCommissionedNodes();
        logger.info(`Found ${nodes.length} nodes: ${nodes.map(nodeId => nodeId.toString()).join(", ")}`);

        for (const nodeId of nodes) {
            try {
                logger.info(`Initializing node "${nodeId}" ...`);
                // Initialize Node
                const node = await this.#registerNode(nodeId);

                // Trigger connect to node, default values are used
                node.connect({
                    subscribeMinIntervalFloorSeconds: 1,
                    subscribeMaxIntervalCeilingSeconds: undefined,
                });
            } catch (error) {
                logger.warn(`Failed to connect to node "${nodeId}":`, error);
            }
        }
    }

    getNodeIds() {
        return this.#nodes.getIds();
    }

    hasNode(nodeId: NodeId): boolean {
        return this.#nodes.has(nodeId);
    }

    /**
     * Alias for decommissionNode to match NodeCommandHandler interface.
     */
    removeNode(nodeId: NodeId) {
        return this.decommissionNode(nodeId);
    }

    async interviewNode(nodeId: NodeId) {
        const node = this.#nodes.get(nodeId);

        // Our nodes are kept up-to-date via attribute subscriptions, so we don't need
        // to re-read all attributes like the Python server does.
        // Just emit a node_updated event with the current (already fresh) data.
        logger.info(`Interview requested for node ${nodeId} - do a complete read`);

        // Do a full Read of the node
        const read = {
            ...Read({
                fabricFilter: true,
                attributes: [{}],
            }),
            includeKnownVersions: true, // do not send DataVersionFilters, so we do a new clean read
        };
        for await (const _chunk of (node.node.interaction as ClientNodeInteraction).read(read));

        // Emit node_updated event (same as Python server behavior after the interview)
        this.events.nodeStateChanged.emit(nodeId, node.connectionState);
    }

    /**
     * Get full node details in WebSocket API format.
     * @param nodeId The node ID
     * @param lastInterviewDate Optional last interview date (tracked externally)
     */
    async getNodeDetails(nodeId: NodeId, lastInterviewDate?: Date): Promise<MatterNodeData> {
        const node = this.#nodes.get(nodeId);
        const attributeCache = this.#nodes.attributeCache;

        let isBridge = false;

        // Ensure the cache is populated if node is initialized but cache doesn't exist yet
        if (!attributeCache.has(nodeId)) {
            attributeCache.add(node);
        }

        // Get cached attributes (empty object if node not yet initialized)
        const attributes = attributeCache.get(nodeId) ?? {};

        // Bridge detection: Check endpoint 1's Descriptor cluster (29) DeviceTypeList attribute (0)
        // for device type 14 (Aggregator), matching Python Matter Server behavior
        const endpoint1DeviceTypes = attributes["1/29/0"];
        if (Array.isArray(endpoint1DeviceTypes)) {
            isBridge = endpoint1DeviceTypes.some(entry => entry["0"] === 14);
        }

        // Get commissioned date from node state if available
        const commissionedAt = node.state.commissioning.commissionedAt;
        const dateCommissioned = commissionedAt !== undefined ? new Date(commissionedAt) : new Date();

        return {
            node_id: node.nodeId,
            date_commissioned: getDateAsString(dateCommissioned),
            last_interview: getDateAsString(lastInterviewDate ?? new Date()),
            interview_version: 6,
            available: node.isConnected,
            is_bridge: isBridge,
            attributes,
            attribute_subscriptions: [],
        };
    }

    /**
     * Read multiple attributes from a node by path strings.
     * Supports wildcards in paths. Batches up to 9 paths per read call.
     */
    async handleReadAttributes(
        nodeId: NodeId,
        attributePaths: string[],
        fabricFiltered = false,
    ): Promise<AttributesData> {
        const result: AttributesData = {};
        const client = await this.#nodes.interactionClientFor(nodeId);
        const batchSize = 9;

        // Parse all paths (wildcards become undefined for that component)
        const parsedPaths = attributePaths.map(path => splitAttributePath(path));

        // Process in batches of up to 9
        for (let i = 0; i < parsedPaths.length; i += batchSize) {
            const batch = parsedPaths.slice(i, i + batchSize);
            const attributes = batch.map(({ endpointId, clusterId, attributeId }) => ({
                endpointId: endpointId !== undefined ? EndpointNumber(endpointId) : undefined,
                clusterId: clusterId !== undefined ? ClusterId(clusterId) : undefined,
                attributeId: attributeId !== undefined ? AttributeId(attributeId) : undefined,
            }));

            const { attributeData, attributeStatus } = await client.getMultipleAttributesAndStatus({
                attributes,
                isFabricFiltered: fabricFiltered,
            });

            for (const { path: attrPath, value } of attributeData) {
                const { pathStr, value: wsValue } = this.#convertAttributeToWebSocket(
                    {
                        endpointId: EndpointNumber(attrPath.endpointId),
                        clusterId: ClusterId(attrPath.clusterId),
                        attributeId: attrPath.attributeId,
                    },
                    value,
                );
                result[pathStr] = wsValue;
            }

            if (attributeStatus && attributeStatus.length > 0) {
                for (const { path: attrPath, status } of attributeStatus) {
                    const pathStr = buildAttributePath(attrPath.endpointId, attrPath.clusterId, attrPath.attributeId);
                    logger.warn(`Failed to read attribute ${pathStr}: status=${status}`);
                }
            }
        }

        return result;
    }

    /**
     * Convert attribute data to WebSocket tag-based format.
     */
    #convertAttributeToWebSocket(
        path: { endpointId: EndpointNumber; clusterId: ClusterId; attributeId: number },
        value: unknown,
        clusterData?: ClusterMapEntry,
    ) {
        const { endpointId, clusterId, attributeId } = path;
        if (!clusterData) {
            const cluster = getClusterById(clusterId);
            clusterData = ClusterMap[cluster.name.toLowerCase()];
        }
        return {
            pathStr: buildAttributePath(endpointId, clusterId, attributeId),
            value: convertMatterToWebSocketTagBased(value, clusterData?.attributes[attributeId], clusterData?.model),
        };
    }

    /**
     * Set the fabric label. Pass null or empty string to reset to "Home".
     * Note: matter.js requires non-empty labels (1-32 chars), so null/empty resets to default.
     */
    async setFabricLabel(label: string) {
        await this.#controller.updateFabricLabel(label);
    }

    disconnectNode(nodeId: NodeId) {
        return this.#controller.disconnectNode(nodeId, true);
    }

    async handleReadEvent(data: ReadEventRequest): Promise<ReadEventResponse> {
        const { nodeId, endpointId, clusterId, eventId, eventMin } = data;
        const client = await this.#nodes.interactionClientFor(nodeId);
        const { eventData, eventStatus } = await client.getMultipleEventsAndStatus({
            events: [
                {
                    endpointId,
                    clusterId,
                    eventId,
                },
            ],
            eventFilters: eventMin ? [{ eventMin }] : undefined,
        });

        return {
            values: eventData.flatMap(({ path: { endpointId, clusterId, eventId }, events }) =>
                events.map(({ eventNumber, data }) => ({
                    eventId,
                    clusterId,
                    endpointId,
                    eventNumber,
                    value: data,
                })),
            ),
            status: eventStatus?.map(({ path: { endpointId, clusterId, eventId }, status, clusterStatus }) => ({
                clusterId,
                endpointId,
                eventId,
                status,
                clusterStatus,
            })),
        };
    }

    async handleSubscribeAttribute(data: SubscribeAttributeRequest): Promise<SubscribeAttributeResponse> {
        const { nodeId, endpointId, clusterId, attributeId, minInterval, maxInterval, changeListener } = data;
        const client = await this.#nodes.interactionClientFor(nodeId);
        const updated = Observable<[void]>();
        let ignoreData = true; // We ignore data coming in during initial seeding
        const { attributeReports = [] } = await client.subscribeMultipleAttributesAndEvents({
            attributes: [
                {
                    endpointId,
                    clusterId,
                    attributeId,
                },
            ],
            minIntervalFloorSeconds: minInterval,
            maxIntervalCeilingSeconds: maxInterval,
            attributeListener: data => {
                if (ignoreData) return;
                changeListener({
                    attributeId: data.path.attributeId,
                    clusterId: data.path.clusterId,
                    endpointId: data.path.endpointId,
                    dataVersion: data.version,
                    value: data.value,
                });
            },
            updateReceived: () => {
                updated.emit();
            },
            keepSubscriptions: false,
        });
        ignoreData = false;

        return {
            values: attributeReports.map(
                ({ path: { endpointId, clusterId, attributeId }, value, version: dataVersion }) => ({
                    attributeId,
                    clusterId,
                    endpointId,
                    dataVersion,
                    value,
                }),
            ),
            updated,
        };
    }

    async handleSubscribeEvent(data: SubscribeEventRequest): Promise<SubscribeEventResponse> {
        const { nodeId, endpointId, clusterId, eventId, minInterval, maxInterval, changeListener } = data;
        const client = await this.#nodes.interactionClientFor(nodeId);
        const updated = Observable<[void]>();
        let ignoreData = true; // We ignore data coming in during initial seeding
        const { eventReports = [] } = await client.subscribeMultipleAttributesAndEvents({
            events: [
                {
                    endpointId,
                    clusterId,
                    eventId,
                },
            ],
            minIntervalFloorSeconds: minInterval,
            maxIntervalCeilingSeconds: maxInterval,
            eventListener: data => {
                if (ignoreData) return;
                data.events.forEach(event =>
                    changeListener({
                        eventId: data.path.eventId,
                        clusterId: data.path.clusterId,
                        endpointId: data.path.endpointId,
                        eventNumber: event.eventNumber,
                        value: event.data,
                    }),
                );
            },
            updateReceived: () => {
                updated.emit();
            },
            keepSubscriptions: false,
        });
        ignoreData = false;

        return {
            values: eventReports.flatMap(({ path: { endpointId, clusterId, eventId }, events }) =>
                events.map(({ eventNumber, data }) => ({
                    eventId,
                    clusterId,
                    endpointId,
                    eventNumber,
                    value: data,
                })),
            ),
            updated,
        };
    }

    async handleWriteAttribute(data: WriteAttributeRequest): Promise<AttributeResponseStatus> {
        const { nodeId, endpointId, clusterId, attributeId, value } = data;

        const client = this.#nodes.clusterClientByIdFor(nodeId, endpointId, clusterId);

        logger.info("Writing attribute", attributeId, "with value", value);
        try {
            await client.attributes[attributeId].set(value);
            return {
                attributeId,
                clusterId,
                endpointId,
                status: 0,
            };
        } catch (error) {
            StatusResponseError.accept(error);
            return {
                attributeId,
                clusterId,
                endpointId,
                status: error.code,
                clusterStatus: error.clusterCode,
            };
        }
    }

    // TODO improve response typing
    async #invokeCommand<const C extends ClusterType>(
        node: ClientNode,
        request: Invoke.ConcreteCommandRequest<C>,
        options: Omit<Invoke.Definition, "commands"> = {},
    ) {
        for await (const data of node.interaction.invoke(
            Invoke({
                commands: [request],
                ...options,
            }),
        )) {
            for (const entry of data) {
                // We send only one command, so we only get one response back
                switch (entry.kind) {
                    case "cmd-status":
                        if (entry.status !== Status.Success) {
                            throw StatusResponseError.create(entry.status, undefined, entry.clusterStatus);
                        }
                        return;

                    case "cmd-response":
                        return entry.data;
                }
            }
        }
    }

    async handleInvoke(data: InvokeRequest): Promise<any> {
        const {
            nodeId,
            endpointId,
            clusterId,
            timedInteractionTimeoutMs: timedRequestTimeoutMs,
            interactionTimeoutMs,
        } = data;
        let { data: commandData } = data;

        const cluster = getClusterById(clusterId);
        const commandName = camelize(data.commandName);
        const commands = (
            this.#nodes.get(nodeId).node.endpoints.for(endpointId).commands as Record<string, Record<string, unknown>>
        )[camelize(cluster.name)];
        if (!commands[commandName]) {
            throw new Error("Command not existing");
        }

        if (isObject(commandData)) {
            if (Object.keys(commandData).length === 0) {
                commandData = undefined;
            } else {
                const clusterEntry = ClusterMap[cluster.name.toLowerCase()];
                const model = clusterEntry?.commands[commandName.toLowerCase()];
                if (cluster && model) {
                    commandData = convertCommandDataToMatter(commandData, model, clusterEntry.model);
                }
            }
        }

        return await this.#invokeCommand(
            this.#nodes.get(nodeId).node,
            {
                endpoint: endpointId,
                cluster,
                command: commandName,
                fields: commandData,
            },
            {
                timeout: timedRequestTimeoutMs !== undefined ? Millis(timedRequestTimeoutMs) : undefined,
                expectedProcessingTime: interactionTimeoutMs !== undefined ? Millis(interactionTimeoutMs) : undefined,
            },
        );
    }

    /** InvokeById minimalistic handler because only used for error testing */
    async handleInvokeById(data: InvokeByIdRequest): Promise<void> {
        const { nodeId, endpointId, clusterId, commandId, data: commandData, timedInteractionTimeoutMs } = data;
        const client = await this.#nodes.interactionClientFor(nodeId);
        await client.invoke<Command<any, any, any>>({
            endpointId,
            clusterId: clusterId,
            command: Command(commandId, TlvAny, 0x00, TlvNoResponse, {
                timed: timedInteractionTimeoutMs !== undefined,
            }),
            request: commandData === undefined ? TlvVoid.encodeTlv() : TlvObject({}).encodeTlv(commandData as any),
            asTimedRequest: timedInteractionTimeoutMs !== undefined,
            timedRequestTimeout: Millis(timedInteractionTimeoutMs),
            skipValidation: true,
        });
    }

    async handleWriteAttributeById(data: WriteAttributeByIdRequest): Promise<void> {
        const { nodeId, endpointId, clusterId, attributeId, value } = data;

        const client = await this.#nodes.interactionClientFor(nodeId);

        logger.info("Writing attribute", attributeId, "with value", value);

        let tlvValue: any;

        if (value === null) {
            tlvValue = TlvNullable(TlvBoolean).encodeTlv(value); // Boolean is just a placeholder here
        } else if (value instanceof Uint8Array) {
            tlvValue = TlvByteString.encodeTlv(value);
        } else {
            switch (typeof value) {
                case "boolean":
                    tlvValue = TlvBoolean.encodeTlv(value);
                    break;
                case "number":
                    tlvValue = TlvInt32.encodeTlv(value);
                    break;
                case "bigint":
                    tlvValue = TlvUInt64.encodeTlv(value);
                    break;
                case "string":
                    tlvValue = TlvString.encodeTlv(value);
                    break;
                default:
                    throw new Error("Unsupported value type for Any encoding");
            }
        }

        await client.setAttribute({
            attributeData: {
                endpointId,
                clusterId,
                attribute: Attribute(attributeId, TlvAny),
                value: tlvValue,
            },
        });
    }

    #determineCommissionOptions(data: CommissioningRequest): NodeCommissioningOptions {
        let passcode: number | undefined = undefined;
        let shortDiscriminator: number | undefined = undefined;
        let longDiscriminator: number | undefined = undefined;
        let productId: number | undefined = undefined;
        let vendorId: VendorId | undefined = undefined;
        let knownAddress: ServerAddress | undefined = undefined;

        if ("manualCode" in data && data.manualCode.length > 0) {
            const pairingCodeCodec = ManualPairingCodeCodec.decode(data.manualCode);
            shortDiscriminator = pairingCodeCodec.shortDiscriminator;
            longDiscriminator = undefined;
            passcode = pairingCodeCodec.passcode;
        } else if ("qrCode" in data && data.qrCode.length > 0) {
            const pairingCodeCodec = QrPairingCodeCodec.decode(data.qrCode);
            // TODO handle the case where multiple devices are included
            longDiscriminator = pairingCodeCodec[0].discriminator;
            shortDiscriminator = undefined;
            passcode = pairingCodeCodec[0].passcode;
        } else if ("passcode" in data) {
            passcode = data.passcode;
            // Check for discriminator-based discovery
            if ("shortDiscriminator" in data) {
                shortDiscriminator = data.shortDiscriminator;
            } else if ("longDiscriminator" in data) {
                longDiscriminator = data.longDiscriminator;
            } else if ("vendorId" in data && "productId" in data) {
                vendorId = VendorId(data.vendorId);
                productId = data.productId;
            }
            // If none of the above, will discover any commissionable device
        } else {
            throw new Error("No pairing code provided");
        }

        if (data.knownAddress !== undefined) {
            const { ip, port } = data.knownAddress;
            knownAddress = {
                type: "udp",
                ip,
                port,
            };
        }

        if (passcode == undefined) {
            throw new Error("No passcode provided");
        }

        const { onNetworkOnly } = data;
        return {
            commissioning: {
                nodeId: data.nodeId,
                regulatoryLocation: GeneralCommissioning.RegulatoryLocationType.IndoorOutdoor,
                regulatoryCountryCode: "XX",
            },
            discovery: {
                knownAddress,
                identifierData:
                    longDiscriminator !== undefined
                        ? { longDiscriminator }
                        : shortDiscriminator !== undefined
                          ? { shortDiscriminator }
                          : vendorId !== undefined
                            ? { vendorId, productId }
                            : {},
                discoveryCapabilities: {
                    ble: this.bleEnabled && !onNetworkOnly,
                    onIpNetwork: true,
                },
            },
            passcode,
        };
    }

    async commissionNode(data: CommissioningRequest): Promise<CommissioningResponse> {
        const nodeId = await this.#controller.commissionNode(this.#determineCommissionOptions(data), {
            connectNodeAfterCommissioning: true,
        });

        await this.#registerNode(nodeId);

        this.events.nodeAdded.emit(nodeId);
        return { nodeId };
    }

    getCommissionerNodeId() {
        return this.#controller.nodeId;
    }

    async getCommissionerFabricData(): Promise<{
        fabricId: FabricId;
        compressedFabricId: bigint;
        fabricIndex: number;
    }> {
        const { fabricId, globalId, fabricIndex } = this.#controller.fabric;
        return {
            fabricId,
            compressedFabricId: globalId,
            fabricIndex,
        };
    }

    /** Discover commissionable devices */
    async handleDiscovery({ findBy }: DiscoveryRequest): Promise<DiscoveryResponse> {
        const result = await this.#controller.discoverCommissionableDevices(
            findBy ?? {},
            { onIpNetwork: true },
            undefined,
            Seconds(3), // Just check for 3 sec
        );
        logger.info("Discovered result", result);
        // Chip is not removing old discoveries when being stopped, so we still have old and new devices in the result
        // but the expectation is that it was reset and only new devices are in the result
        const latestDiscovery = result[result.length - 1];
        if (latestDiscovery === undefined) {
            return [];
        }
        return [latestDiscovery].map(({ DT, DN, CM, D, RI, PH, PI, T, VP, deviceIdentifier, addresses, SII, SAI }) => {
            const { tcpClient: supportsTcpClient, tcpServer: supportsTcpServer } = SupportedTransportsSchema.decode(
                T ?? 0,
            );
            const vendorId = VP === undefined ? -1 : VP.includes("+") ? parseInt(VP.split("+")[0]) : parseInt(VP);
            const productId = VP === undefined ? -1 : VP.includes("+") ? parseInt(VP.split("+")[1]) : -1;
            const port = addresses.length ? (addresses[0] as ServerAddressUdp).port : 0;
            const numIPs = addresses.length;
            return {
                commissioningMode: CM,
                deviceName: DN ?? "",
                deviceType: DT ?? 0,
                hostName: "000000000000", // Right now we do not return real hostname, only used internally
                instanceName: deviceIdentifier,
                longDiscriminator: D,
                numIPs,
                pairingHint: PH ?? -1,
                pairingInstruction: PI ?? "",
                port,
                productId,
                rotatingId: RI ?? "",
                rotatingIdLen: RI?.length ?? 0,
                shortDiscriminator: (D >> 8) & 0x0f,
                vendorId,
                supportsTcpServer,
                supportsTcpClient,
                addresses: (addresses.filter(({ type }) => type === "udp") as ServerAddressUdp[]).map(({ ip }) => ip),
                mrpSessionIdleInterval: SII,
                mrpSessionActiveInterval: SAI,
            };
        });
    }

    async getNodeIpAddresses(nodeId: NodeId, preferCache = true) {
        const node = this.#nodes.get(nodeId);
        const addresses = new Set<string>();

        if (node.node.behaviors.has(GeneralDiagnosticsClient)) {
            let networkInterfaces = node.stateOf(GeneralDiagnosticsClient).networkInterfaces;

            if (!preferCache) {
                logger.info(`Fetching network interfaces for node ${nodeId} from controller`);
                const read = {
                    ...Read(
                        Read.Attribute({
                            endpoint: EndpointNumber(0),
                            cluster: GeneralDiagnostics.Complete,
                            attributes: "networkInterfaces",
                        }),
                    ),
                    includeKnownVersions: true, // we want to read from device
                };

                try {
                    let received = false;
                    for await (const chunk of (node.node.interaction as ClientNodeInteraction).read(read)) {
                        for (const attr of chunk) {
                            if (received) {
                                logger.warn(
                                    "Unexpected response from networkInterfaces read, returning cached version",
                                    attr,
                                );
                                continue;
                            }
                            if (attr.kind === "attr-value" && Array.isArray(attr.value)) {
                                received = true;
                                if (attr.value.length > 0) {
                                    logger.info("Received network interfaces from device", attr.value);
                                    networkInterfaces = attr.value;
                                }
                            }
                        }
                    }
                } catch (error) {
                    logger.info(`Failed to get network interfaces, returning cached version`, error);
                }
            }

            const interfaces = networkInterfaces.filter(({ isOperational }) => isOperational);
            if (interfaces.length) {
                logger.info(`Node ${nodeId}: Found ${interfaces.length} operational network interfaces`, interfaces);
                interfaces.forEach(({ iPv4Addresses, iPv6Addresses }) => {
                    iPv6Addresses.forEach(ip => {
                        try {
                            addresses.add(ipv6BytesToString(Bytes.of(ip)));
                        } catch (error) {
                            logger.info(`Failed to convert IPv6 address ${ip} to string`, error);
                        }
                    });
                    iPv4Addresses.forEach(ip => {
                        try {
                            addresses.add(ipv4BytesToString(Bytes.of(ip)));
                        } catch (error) {
                            logger.info(`Failed to convert IPv4 address ${ip} to string`, error);
                        }
                    });
                });
            }
        } else {
            logger.warn(`Node ${nodeId}: No GeneralDiagnostics cluster, cannot get network interfaces`);
        }
        return Array.from(addresses.values());
    }

    /**
     * Ping a node on all its known IP addresses.
     * @param nodeId The node ID to ping
     * @param attempts Number of ping attempts per IP (default: 1)
     * @returns A record of IP addresses to ping success status
     */
    async pingNode(nodeId: NodeId, attempts = 1): Promise<NodePingResult> {
        const node = this.#nodes.get(nodeId);

        const result: NodePingResult = {};

        // Get all IP addresses for the node (fresh lookup, not cached)
        const ipAddresses = await this.getNodeIpAddresses(nodeId, false);

        if (ipAddresses.length === 0) {
            logger.info(`No IP addresses found for node ${nodeId}`);
            return result;
        }

        logger.info(`Pinging node ${nodeId} on ${ipAddresses.length} addresses:`, ipAddresses);

        // Ping all addresses in parallel
        const pingPromises = ipAddresses.map(async ip => {
            const cleanIp = ip.includes("%") ? ip.split("%")[0] : ip;
            logger.debug(`Pinging ${cleanIp}`);
            const success = await pingIp(ip, 10, attempts);
            result[ip] = success;
            logger.debug(`Ping result for ${cleanIp}: ${success}`);
        });

        await Promise.all(pingPromises);

        // If the node is connected, treat the connection as valid
        if (node.isConnected) {
            // Find any successful ping or mark the connection as reachable
            const anySuccess = Object.values(result).some(v => v);
            if (!anySuccess && ipAddresses.length > 0) {
                // Node is connected, but no pings succeeded - this can happen
                // with Thread devices or certain network configurations
                logger.info(`Node ${nodeId} is connected but no pings succeeded`);
            }
        }

        return result;
    }

    async decommissionNode(nodeId: NodeId) {
        const node = this.#nodes.has(nodeId) ? this.#nodes.get(nodeId) : undefined;
        await this.#controller.removeNode(nodeId, !!node?.isConnected);
        // Remove node from storage (also clears attribute cache)
        this.#nodes.delete(nodeId);
        // Unregister from custom cluster polling
        this.#customClusterPoller.unregisterNode(nodeId);
    }

    async openCommissioningWindow(data: OpenCommissioningWindowRequest): Promise<OpenCommissioningWindowResponse> {
        const { nodeId, timeout } = data;
        const node = this.#nodes.get(nodeId);
        const { manualPairingCode, qrPairingCode } = await node.openEnhancedCommissioningWindow(timeout);
        return { manualCode: manualPairingCode, qrCode: qrPairingCode };
    }

    async getFabrics(nodeId: NodeId) {
        const node = this.#nodes.get(nodeId);

        const read = {
            ...Read(
                {
                    fabricFilter: false,
                },
                Read.Attribute({
                    endpoint: EndpointNumber(0),
                    cluster: OperationalCredentials.Complete,
                    attributes: "fabrics",
                }),
            ),
            includeKnownVersions: true, // we want to read from device
        };

        for await (const chunk of (node.node.interaction as ClientNodeInteraction).read(read)) {
            for (const attr of chunk) {
                if (attr.kind === "attr-value" && Array.isArray(attr.value)) {
                    // We only expect one array response
                    return attr.value.map(({ fabricId, fabricIndex, vendorId, label }) => ({
                        fabricId,
                        vendorId,
                        fabricIndex,
                        label,
                    }));
                }
                logger.warn("Unexpected response from fabrics read", attr);
            }
        }

        throw new Error("No or invalid response received while querying fabrics");
    }

    removeFabric(nodeId: NodeId, fabricIndex: FabricIndex) {
        return this.#nodes.get(nodeId).node.commandsOf(OperationalCredentialsClient).removeFabric({ fabricIndex });
    }

    /**
     * Set Access Control List entries on a node.
     * Writes to the ACL attribute on the AccessControl cluster (endpoint 0).
     * TODO Migrate to new Node API
     */
    async setAclEntry(nodeId: NodeId, entries: AccessControlEntry[]): Promise<AttributeWriteResult[] | null> {
        const client = this.#nodes.clusterClientFor(nodeId, EndpointNumber(0), AccessControl.Cluster);

        // Convert from WebSocket format (snake_case) to Matter.js format (camelCase)
        const aclEntries: AccessControl.AccessControlEntry[] = entries.map(entry => ({
            privilege: entry.privilege as AccessControl.AccessControlEntryPrivilege,
            authMode: entry.auth_mode as AccessControl.AccessControlEntryAuthMode,
            subjects: entry.subjects?.map(s => NodeId(BigInt(s))) ?? null,
            targets:
                entry.targets?.map((t: AccessControlTarget) => ({
                    cluster: t.cluster !== null ? ClusterId(t.cluster) : null,
                    endpoint: t.endpoint !== null ? EndpointNumber(t.endpoint) : null,
                    deviceType: t.device_type !== null ? DeviceTypeId(t.device_type) : null,
                })) ?? null,
            fabricIndex: FabricIndex.OMIT_FABRIC,
        }));

        logger.info("Setting ACL entries", aclEntries);

        try {
            await client.setAclAttribute(aclEntries);
            return [
                {
                    path: {
                        endpoint_id: 0,
                        cluster_id: AccessControl.Cluster.id,
                        attribute_id: 0, // ACL attribute ID
                    },
                    status: 0,
                },
            ];
        } catch (error) {
            StatusResponseError.accept(error);
            return [
                {
                    path: {
                        endpoint_id: 0,
                        cluster_id: AccessControl.Cluster.id,
                        attribute_id: 0,
                    },
                    status: error.code,
                },
            ];
        }
    }

    /**
     * Set bindings on a specific endpoint of a node.
     * Writes to the Binding attribute on the Binding cluster.
     * TODO Migrate to new Node API
     */
    async setNodeBinding(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        bindings: BindingTarget[],
    ): Promise<AttributeWriteResult[] | null> {
        const client = this.#nodes.clusterClientFor(nodeId, endpointId, Binding.Cluster);

        // Convert from WebSocket format to Matter.js format
        const bindingEntries: Binding.Target[] = bindings.map(binding => ({
            node: binding.node !== null ? NodeId(binding.node) : undefined,
            group: binding.group !== null ? GroupId(binding.group) : undefined,
            endpoint: binding.endpoint !== null ? EndpointNumber(binding.endpoint) : undefined,
            cluster: binding.cluster !== null ? ClusterId(binding.cluster) : undefined,
            fabricIndex: FabricIndex.OMIT_FABRIC,
        }));

        logger.info("Setting bindings on endpoint", endpointId, bindingEntries);

        try {
            await client.attributes.binding.set(bindingEntries);
            return [
                {
                    path: {
                        endpoint_id: endpointId,
                        cluster_id: Binding.Cluster.id,
                        attribute_id: 0, // Binding attribute ID
                    },
                    status: 0,
                },
            ];
        } catch (error) {
            StatusResponseError.accept(error);
            return [
                {
                    path: {
                        endpoint_id: endpointId,
                        cluster_id: Binding.Cluster.id,
                        attribute_id: 0,
                    },
                    status: error.code,
                },
            ];
        }
    }

    /**
     * Check if a software update is available for a node.
     * First checks the cached updates from OTA events, then queries the DCL if not found.
     */
    async checkNodeUpdate(nodeId: NodeId): Promise<MatterSoftwareVersion | null> {
        if (!this.#otaEnabled) {
            throw new Error("OTA is disabled.");
        }
        // First check if we have a cached update from the updateAvailable event
        const cachedUpdate = this.#availableUpdates.get(nodeId);
        if (cachedUpdate) {
            return this.#convertToMatterSoftwareVersion(cachedUpdate);
        }

        // No cached update, query the OTA provider
        const node = this.#nodes.get(nodeId);

        try {
            const otaProvider = this.#controller.otaProvider;
            if (!otaProvider) {
                logger.info("OTA provider not available");
                return null;
            }

            // Query OTA provider for updates using dynamic behavior access
            const updatesAvailable = await otaProvider.act(agent =>
                agent.get(SoftwareUpdateManager).queryUpdates({
                    peerToCheck: node.node,
                    includeStoredUpdates: true,
                }),
            );

            // Find update for this specific node
            const peerAddress = this.#controller.fabric.addressOf(nodeId);
            const nodeUpdate = updatesAvailable.find(({ peerAddress: updateAddress }) =>
                PeerAddress.is(peerAddress, updateAddress),
            );

            if (nodeUpdate) {
                const { info } = nodeUpdate;
                this.#availableUpdates.set(nodeId, info);
                return this.#convertToMatterSoftwareVersion(info);
            }

            return null;
        } catch (error) {
            logger.warn(`Failed to check for updates for node ${nodeId}:`, error);
            return null;
        }
    }

    /**
     * Trigger a software update for a node.
     * @param nodeId The node to update
     * @param softwareVersion The target software version to update to
     */
    async updateNode(nodeId: NodeId, softwareVersion: number): Promise<MatterSoftwareVersion | null> {
        if (!this.#otaEnabled) {
            throw new Error("OTA is disabled.");
        }
        if (!this.#nodes.has(nodeId)) {
            throw new Error(`Node ${nodeId} not found`);
        }

        try {
            const otaProvider = this.#controller.otaProvider;
            if (!otaProvider) {
                throw new Error("OTA provider not available");
            }

            // Get the cached update info or query for it
            let updateInfo = this.#availableUpdates.get(nodeId);
            if (!updateInfo) {
                // Try to get update info by querying
                const result = await this.checkNodeUpdate(nodeId);
                if (!result) {
                    throw new Error("No update available for this node");
                }
                updateInfo = this.#availableUpdates.get(nodeId);
                if (!updateInfo) {
                    throw new Error("Failed to get update info");
                }
            }

            logger.info(`Starting update for node ${nodeId} to version ${softwareVersion}`);

            // Trigger the update using forceUpdate via dynamic behavior access
            await otaProvider.act(agent =>
                agent
                    .get(SoftwareUpdateManager)
                    .forceUpdate(
                        this.#controller.fabric.addressOf(nodeId),
                        updateInfo.vendorId,
                        updateInfo.productId,
                        softwareVersion,
                    ),
            );

            // Return the update info
            return this.#convertToMatterSoftwareVersion(updateInfo);
        } catch (error) {
            logger.error(`Failed to update node ${nodeId}:`, error);
            throw error;
        }
    }

    /**
     * Convert SoftwareUpdateInfo to MatterSoftwareVersion format for WebSocket API.
     */
    #convertToMatterSoftwareVersion(updateInfo: SoftwareUpdateInfo): MatterSoftwareVersion {
        const { vendorId, productId, softwareVersion, softwareVersionString, releaseNotesUrl, source } = updateInfo;
        return {
            vid: vendorId,
            pid: productId,
            software_version: softwareVersion,
            software_version_string: softwareVersionString,
            min_applicable_software_version: 0, // Not available from SoftwareUpdateInfo
            max_applicable_software_version: softwareVersion - 1,
            release_notes_url: releaseNotesUrl,
            update_source:
                source === "dcl-prod"
                    ? UpdateSource.MAIN_NET_DCL
                    : source === "dcl-test"
                      ? UpdateSource.TEST_NET_DCL
                      : UpdateSource.LOCAL,
        };
    }
}
