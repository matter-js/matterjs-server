/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { AsyncObservable } from "@matter/general";
import {
    FabricId,
    FabricIndex,
    Logger,
    Millis,
    NodeId,
    Observable,
    Seconds,
    ServerAddress,
    ServerAddressUdp,
    SoftwareUpdateManager,
} from "@matter/main";
import {
    AccessControl,
    Binding,
    GeneralCommissioning,
    GeneralDiagnosticsCluster,
    OperationalCredentials,
} from "@matter/main/clusters";
import {
    DecodedAttributeReportValue,
    DecodedEventReportValue,
    PeerAddress,
    SignatureFromCommandSpec,
    SupportedTransportsSchema,
} from "@matter/main/protocol";
import {
    Attribute,
    ClusterId,
    Command,
    DeviceTypeId,
    EndpointNumber,
    GroupId,
    ManualPairingCodeCodec,
    QrPairingCodeCodec,
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
import { NodeStates, PairedNode } from "@project-chip/matter.js/device";
import { bytesToIpV4, bytesToIpV6 } from "../server/Converters.js";
import {
    AttributeResponseStatus,
    CommissioningRequest,
    CommissioningResponse,
    DiscoveryRequest,
    DiscoveryResponse,
    InvokeByIdRequest,
    InvokeRequest,
    OpenCommissioningWindowRequest,
    OpenCommissioningWindowResponse,
    ReadAttributeRequest,
    ReadAttributeResponse,
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

/**
 * Software update info from the OTA provider.
 * Matches the SoftwareUpdateInfo interface from @matter/node.
 */
interface SoftwareUpdateInfo {
    vendorId: VendorId;
    productId: number;
    softwareVersion: number;
    softwareVersionString: string;
    releaseNotesUrl?: string;
    specificationVersion?: number;
}

const logger = Logger.get("ControllerCommandHandler");

export class ControllerCommandHandler {
    #controller: CommissioningController;
    #started = false;
    #connected = false;
    #bleEnabled = false;
    #nodes = new Map<NodeId, PairedNode>();
    /** Cache of available updates keyed by nodeId */
    #availableUpdates = new Map<NodeId, SoftwareUpdateInfo>();
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

    constructor(controllerInstance: CommissioningController, bleEnabled: boolean) {
        this.#controller = controllerInstance;

        this.#bleEnabled = bleEnabled;
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

        // Subscribe to OTA provider events to track available updates
        await this.#setupOtaEventHandlers();

        await this.events.started.emit();
    }

    /**
     * Set up event handlers for OTA update notifications from the SoftwareUpdateManager.
     */
    async #setupOtaEventHandlers() {
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
        return this.#controller.close();
    }

    async #registerNode(nodeId: NodeId) {
        const node = await this.#controller.getNode(nodeId);

        // Wire all Events to the Event emitters
        node.events.attributeChanged.on(data => this.events.attributeChanged.emit(node.nodeId, data));
        node.events.eventTriggered.on(data => this.events.eventChanged.emit(node.nodeId, data));
        node.events.stateChanged.on(state => this.events.nodeStateChanged.emit(node.nodeId, state));
        node.events.structureChanged.on(() => this.events.nodeStructureChanged.emit(node.nodeId));
        node.events.decommissioned.on(() => this.events.nodeDecommissioned.emit(node.nodeId));
        node.events.nodeEndpointAdded.on(endpointId => this.events.nodeEndpointAdded.emit(node.nodeId, endpointId));
        node.events.nodeEndpointRemoved.on(endpointId => this.events.nodeEndpointRemoved.emit(node.nodeId, endpointId));

        // Store the node for direct access
        this.#nodes.set(nodeId, node);

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
                logger.warn(`Failed to connect to node "${nodeId}": ${(error as Error).stack}`);
            }
        }
    }

    getNodeIds() {
        return Array.from(this.#nodes.keys());
    }

    getNode(nodeId: NodeId) {
        return this.#nodes.get(nodeId);
    }

    /**
     * Set the fabric label. Pass null or empty string to reset to "Home".
     * Note: matter.js requires non-empty labels (1-32 chars), so null/empty resets to default.
     */
    setFabricLabel(label: string | null) {
        const effectiveLabel = label && label.trim() !== "" ? label : "Home";
        return this.#controller.updateFabricLabel(effectiveLabel);
    }

    disconnectNode(nodeId: NodeId) {
        return this.#controller.disconnectNode(nodeId, true);
    }

    async handleReadAttribute(data: ReadAttributeRequest): Promise<ReadAttributeResponse> {
        const { nodeId, endpointId, clusterId, attributeId, fabricFiltered = true } = data;
        const node = this.getNode(nodeId);
        if (node === undefined) {
            throw new Error("Node not found");
        }
        const client = await node.getInteractionClient();

        // Note: This method is for direct SDK reads with explicit paths.
        // Wildcard handling is done at the WebSocket layer before calling this method.
        const { attributeData, attributeStatus } = await client.getMultipleAttributesAndStatus({
            attributes: [{ endpointId, clusterId, attributeId }],
            isFabricFiltered: fabricFiltered,
        });

        return {
            values: attributeData.map(
                ({ path: { endpointId, clusterId, attributeId }, value, version: dataVersion }) => ({
                    attributeId,
                    clusterId,
                    dataVersion,
                    endpointId,
                    value,
                }),
            ),
            status: attributeStatus?.map(({ path: { endpointId, clusterId, attributeId }, status, clusterStatus }) => ({
                attributeId,
                clusterId,
                endpointId,
                status,
                clusterStatus,
            })),
        };
    }

    async handleReadEvent(data: ReadEventRequest): Promise<ReadEventResponse> {
        const { nodeId, endpointId, clusterId, eventId, eventMin } = data;
        const node = this.getNode(nodeId);
        if (node === undefined) {
            throw new Error("Node not found");
        }
        const client = await node.getInteractionClient();
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
        const node = this.getNode(nodeId);
        if (node === undefined) {
            throw new Error("Node not found");
        }
        const client = await node.getInteractionClient();
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
        const node = this.getNode(nodeId);
        if (node === undefined) {
            throw new Error("Node not found");
        }
        const client = await node.getInteractionClient();
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

        const node = this.getNode(nodeId);
        if (node === undefined) {
            throw new Error("Node not found");
        }

        const endpoint = node.getDeviceById(endpointId);
        if (endpoint === undefined) {
            throw new Error("Endpoint not found");
        }
        const client = endpoint.getClusterClientById(clusterId);
        if (client === undefined) {
            throw new Error("Cluster client not found");
        }

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

    async handleInvoke(data: InvokeRequest): Promise<any> {
        const {
            nodeId,
            endpointId,
            clusterId,
            commandName,
            timedInteractionTimeoutMs: timedRequestTimeoutMs,
            // interactionTimeoutMs, // TODO
        } = data;
        let { data: commandData } = data;

        const node = this.getNode(nodeId);
        if (node === undefined) {
            throw new Error("Node not found");
        }
        const endpoint = node.getDeviceById(endpointId);
        if (endpoint === undefined) {
            throw new Error("Endpoint not found");
        }
        const client = endpoint.getClusterClientById(clusterId);
        if (client === undefined) {
            throw new Error("Cluster client not found");
        }
        if (!client[commandName] || !client.isCommandSupportedByName(commandName)) {
            throw new Error("Command not existing");
        }
        if (commandData && typeof commandData == "object" && Object.keys(commandData).length === 0) {
            commandData = undefined;
        }
        return (client[commandName] as unknown as SignatureFromCommandSpec<Command<any, any, any>>)(commandData, {
            timedRequestTimeout: Millis(timedRequestTimeoutMs),
        });
    }

    /** InvokeById minimalistic handler because only used for error testing */
    async handleInvokeById(data: InvokeByIdRequest): Promise<void> {
        const { nodeId, endpointId, clusterId, commandId, data: commandData, timedInteractionTimeoutMs } = data;
        const node = this.getNode(nodeId);
        if (node === undefined) {
            throw new Error("Node not found");
        }
        const client = await node.getInteractionClient();
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

        const node = this.getNode(nodeId);
        if (node === undefined) {
            throw new Error("Node not found");
        }
        const client = await node.getInteractionClient();

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

    async getCommissionerFabricData(): Promise<{ fabricId: FabricId; compressedFabricId: bigint }> {
        const { fabricId, globalId } = this.#controller.fabric;
        return {
            fabricId,
            compressedFabricId: globalId,
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
        const node = this.getNode(nodeId);
        if (!node) {
            throw new Error(`Node ${nodeId} not found`);
        }
        const addresses = new Set<string>();
        const generalDiag = node.getRootClusterClient(GeneralDiagnosticsCluster);
        if (generalDiag) {
            try {
                const networkInterfaces = await generalDiag.getNetworkInterfacesAttribute(preferCache ? true : true);
                if (networkInterfaces) {
                    const interfaces = networkInterfaces.filter(({ isOperational }) => isOperational);
                    if (interfaces.length) {
                        logger.info(`Found ${interfaces.length} operational network interfaces`, interfaces);
                        interfaces.forEach(({ iPv4Addresses, iPv6Addresses }) => {
                            iPv4Addresses.forEach(ip => addresses.add(bytesToIpV4(ip)));
                            iPv6Addresses.forEach(ip => addresses.add(bytesToIpV6(ip)));
                        });
                    }
                }
            } catch (e) {
                logger.info(`Failed to get network interfaces: ${e}`);
            }
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
        const node = this.getNode(nodeId);
        if (!node) {
            throw new Error(`Node ${nodeId} not found`);
        }

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
            // Find any successful ping or mark connection as reachable
            const anySuccess = Object.values(result).some(v => v);
            if (!anySuccess && ipAddresses.length > 0) {
                // Node is connected but no pings succeeded - this can happen
                // with Thread devices or certain network configurations
                logger.info(`Node ${nodeId} is connected but no pings succeeded`);
            }
        }

        return result;
    }

    async decommissionNode(nodeId: NodeId) {
        const node = this.getNode(nodeId);
        await this.#controller.removeNode(NodeId(BigInt(nodeId)), !!node?.isConnected);
        this.#nodes.delete(nodeId);
        // Emit nodeDecommissioned event after successful removal
        this.events.nodeDecommissioned.emit(nodeId);
    }

    async openCommissioningWindow(data: OpenCommissioningWindowRequest): Promise<OpenCommissioningWindowResponse> {
        const { nodeId, timeout } = data;
        const node = this.getNode(nodeId);
        if (node == undefined) {
            throw new Error("Node not found");
        }
        const { manualPairingCode, qrPairingCode } = await node.openEnhancedCommissioningWindow(timeout);
        return { manualCode: manualPairingCode, qrCode: qrPairingCode };
    }

    async getFabrics(nodeId: NodeId) {
        const node = this.getNode(nodeId);
        if (node === undefined) {
            throw new Error("Node not found");
        }
        const client = node.getRootClusterClient(OperationalCredentials.Cluster);
        if (client === undefined) {
            throw new Error("GeneralCommissioning.Cluster not found");
        }
        return (await client.getFabricsAttribute()).map(({ fabricId, fabricIndex, vendorId, label }) => ({
            fabricId,
            vendorId,
            fabricIndex,
            label,
        }));
    }

    removeFabric(nodeId: NodeId, fabricIndex: FabricIndex) {
        const node = this.getNode(nodeId);
        if (node === undefined) {
            throw new Error("Node not found");
        }
        const client = node.getRootClusterClient(OperationalCredentials.Cluster);
        if (client === undefined) {
            throw new Error("GeneralCommissioning.Cluster not found");
        }
        return client.removeFabric({ fabricIndex });
    }

    /**
     * Set Access Control List entries on a node.
     * Writes to the ACL attribute on the AccessControl cluster (endpoint 0).
     */
    async setAclEntry(nodeId: NodeId, entries: AccessControlEntry[]): Promise<AttributeWriteResult[] | null> {
        const node = this.getNode(nodeId);
        if (node === undefined) {
            throw new Error("Node not found");
        }

        const client = node.getRootClusterClient(AccessControl.Cluster);
        if (client === undefined) {
            throw new Error("AccessControl cluster not found");
        }

        // Get the fabric index for this controller's fabric on the target node
        const fabricIndex = await this.#getNodeFabricIndex(node);

        // Convert from WebSocket format to Matter.js format
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
            fabricIndex,
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
     * Get the fabric index for the current controller's fabric on a node.
     */
    async #getNodeFabricIndex(node: PairedNode): Promise<FabricIndex> {
        const opCredClient = node.getRootClusterClient(OperationalCredentials.Cluster);
        if (opCredClient === undefined) {
            throw new Error("OperationalCredentials cluster not found");
        }
        const fabrics = await opCredClient.getFabricsAttribute();
        const controllerFabricId = this.#controller.fabric.fabricId;
        const fabric = fabrics.find(f => f.fabricId === controllerFabricId);
        if (fabric === undefined) {
            throw new Error("Controller fabric not found on node");
        }
        return fabric.fabricIndex;
    }

    /**
     * Set bindings on a specific endpoint of a node.
     * Writes to the Binding attribute on the Binding cluster.
     */
    async setNodeBinding(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        bindings: BindingTarget[],
    ): Promise<AttributeWriteResult[] | null> {
        const node = this.getNode(nodeId);
        if (node === undefined) {
            throw new Error("Node not found");
        }

        const endpoint = node.getDeviceById(endpointId);
        if (endpoint === undefined) {
            throw new Error("Endpoint not found");
        }

        const client = endpoint.getClusterClientById(Binding.Cluster.id);
        if (client === undefined) {
            throw new Error("Binding cluster not found on endpoint");
        }

        // Get the fabric index for this controller's fabric on the target node
        const fabricIndex = await this.#getNodeFabricIndex(node);

        // Convert from WebSocket format to Matter.js format
        const bindingEntries: Binding.Target[] = bindings.map(binding => ({
            node: binding.node !== null ? NodeId(BigInt(binding.node)) : undefined,
            group: binding.group !== null ? GroupId(binding.group) : undefined,
            endpoint: binding.endpoint !== null ? EndpointNumber(binding.endpoint) : undefined,
            cluster: binding.cluster !== null ? ClusterId(binding.cluster) : undefined,
            fabricIndex,
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
        // First check if we have a cached update from the updateAvailable event
        const cachedUpdate = this.#availableUpdates.get(nodeId);
        if (cachedUpdate) {
            return this.#convertToMatterSoftwareVersion(cachedUpdate, UpdateSource.MAIN_NET_DCL);
        }

        // No cached update, query the OTA provider
        const node = this.getNode(nodeId);
        if (node === undefined) {
            throw new Error("Node not found");
        }

        try {
            const otaProvider = this.#controller.otaProvider;
            if (!otaProvider) {
                logger.info("OTA provider not available");
                return null;
            }

            // Get fabric index for the peer address
            const fabricIndex = await this.#getNodeFabricIndex(node);
            const peerAddress = PeerAddress({ nodeId, fabricIndex });

            // Query OTA provider for updates using dynamic behavior access
            const updatesAvailable = await otaProvider.act((agent: any) =>
                agent.get("softwareupdates").queryUpdates({
                    peerToCheck: node.node,
                    includeStoredUpdates: true,
                }),
            );

            // Find update for this specific node
            const nodeUpdate = updatesAvailable.find((update: { peerAddress: PeerAddress; info: any }) =>
                PeerAddress.is(update.peerAddress, peerAddress),
            );

            if (nodeUpdate) {
                const { info } = nodeUpdate;
                // Cache the update for future use
                const updateInfo: SoftwareUpdateInfo = {
                    vendorId: info.vendorId,
                    productId: info.productId,
                    softwareVersion: info.softwareVersion,
                    softwareVersionString: info.softwareVersionString,
                };
                this.#availableUpdates.set(nodeId, updateInfo);

                return this.#convertToMatterSoftwareVersion(updateInfo, UpdateSource.MAIN_NET_DCL);
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
        const node = this.getNode(nodeId);
        if (node === undefined) {
            throw new Error("Node not found");
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

            // Get fabric index and basic info for the update
            const fabricIndex = await this.#getNodeFabricIndex(node);
            const peerAddress = PeerAddress({ nodeId, fabricIndex });

            logger.info(`Starting update for node ${nodeId} to version ${softwareVersion}`);

            // Trigger the update using forceUpdate via dynamic behavior access
            await otaProvider.act((agent: any) =>
                agent
                    .get("softwareupdates")
                    .forceUpdate(peerAddress, updateInfo.vendorId, updateInfo.productId, softwareVersion),
            );

            // Return the update info
            return this.#convertToMatterSoftwareVersion(updateInfo, UpdateSource.MAIN_NET_DCL);
        } catch (error) {
            logger.error(`Failed to update node ${nodeId}:`, error);
            throw error;
        }
    }

    /**
     * Convert SoftwareUpdateInfo to MatterSoftwareVersion format for WebSocket API.
     */
    #convertToMatterSoftwareVersion(updateInfo: SoftwareUpdateInfo, updateSource: UpdateSource): MatterSoftwareVersion {
        return {
            vid: updateInfo.vendorId,
            pid: updateInfo.productId,
            software_version: updateInfo.softwareVersion,
            software_version_string: updateInfo.softwareVersionString,
            min_applicable_software_version: 0, // Not available from SoftwareUpdateInfo
            max_applicable_software_version: updateInfo.softwareVersion - 1,
            release_notes_url: updateInfo.releaseNotesUrl,
            update_source: updateSource,
        };
    }
}
