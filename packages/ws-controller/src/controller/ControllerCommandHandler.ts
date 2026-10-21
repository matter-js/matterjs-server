/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WebRtcCallbackData } from "@matter-server/ws-client";
import {
    Abort,
    AbortedError,
    AsyncObservable,
    camelize,
    causedBy,
    DiscoveryError,
    DiscoveryIncompleteError,
    NoDiscoveryTransportError,
    ClientNode,
    CommissioningClient,
    ControllerBehavior,
    Duration,
    FabricId,
    FabricIndex,
    IcdClient,
    IcdMultiAdminError,
    InternalError,
    isObject,
    Logger,
    MatterAggregateError,
    Millis,
    NodeId,
    Observable,
    ObserverGroup,
    Seconds,
    ServerAddress,
    SoftwareUpdateInfo,
    SoftwareUpdateManager,
    Time,
    TimeoutError,
    Timer,
    DnsRecordType,
    EndpointLifecycle,
    NetworkClient,
    NodeConnectionState,
} from "@matter/main";
import { IcdManagementClient, OperationalCredentialsClient } from "@matter/main/behaviors";
import {
    AccessControl,
    Binding,
    GeneralCommissioning,
    IcdManagement,
    OperationalCredentials,
    TimeSynchronization,
} from "@matter/main/clusters";
import { WebRtcTransportProvider } from "@matter/main/clusters/web-rtc-transport-provider";
import {
    AttestationFinding,
    ClientInvoke,
    CommissioningTimeoutError,
    DEFAULT_CASE_CONNECTION_TIMEOUT,
    DeviceAttestationCheck,
    Fabric,
    FabricManager,
    Invoke,
    PasscodeMismatchError,
    PeerAddress,
    PeerSet,
    PlainClientSubscribe,
    Read,
    ReadResult,
    ResultStatus,
    Specifier,
    Write,
} from "@matter/main/protocol";
import {
    AttributeId,
    ClusterId,
    ClusterType,
    DataVersionFilter,
    DeviceTypeId,
    EndpointNumber,
    EventNumber,
    EventPath,
    GroupId,
    SpecificationVersion,
    ReceivedStatusResponseError,
    Status,
    StatusResponseError,
    ValidationError,
    VendorId,
} from "@matter/main/types";
import { CommissioningDiscovery, Endpoint, ServerNode } from "@matter/node";
import { WebRtcTransportProviderClient } from "@matter/node/behaviors/web-rtc-transport-provider";
import { WebRtcTransportRequestorServer } from "@matter/node/behaviors/web-rtc-transport-requestor";
import { CameraControllerDevice } from "@matter/node/devices/camera-controller";
import { OtaProviderEndpoint } from "@matter/node/endpoints/ota-provider";
import type { SessionEstablishingCommandName, SignallingCommandName } from "../camera/webRtcProviderArguments.js";
import { ClusterMap, ClusterMapEntry, GlobalAttributes } from "../model/ModelMapper.js";
import {
    buildAttributePath,
    convertCommandDataToMatter,
    convertEventToWebSocket,
    convertMatterToWebSocketTagBased,
    convertWebSocketTagBasedToMatter,
    getDateAsString,
    pathStatusOf,
    splitAttributePath,
    splitEventPath,
    statusPathOf,
    toBigIntAwareJson,
} from "../server/Converters.js";
import { checkInteractionRequest } from "../server/interactionArguments.js";
import {
    AttributeResponseStatus,
    AttributesData,
    CommissioningRequest,
    CommissioningResponse,
    DiscoveryRequest,
    DiscoveryResponse,
    InteractionReadRequest,
    InteractionReport,
    InteractionSubscribeRequest,
    InteractionSubscription,
    InteractionSubscriptionListener,
    InvokeRequest,
    MatterNodeData,
    OpenCommissioningWindowRequest,
    OpenCommissioningWindowResponse,
    WriteAttributeRequest,
    BatchedInvokeRequest,
    BatchedInvokeResult,
} from "../types/CommandHandler.js";
import {
    AccessControlEntry,
    AccessControlTarget,
    AttributeWriteResult,
    BindingTarget,
    IcdStateData,
    MatterNodeEvent,
    MatterSoftwareVersion,
    CommissionFailureReason,
    NodePingResult,
    ServerError,
    ServerErrorCode,
    UpdateSource,
} from "../types/WebSocketMessageTypes.js";
import { isBridgeNode } from "../util/bridgeDetection.js";
import { formatNodeId } from "../util/formatNodeId.js";
import { pingIp } from "../util/network.js";
import { nodeIdOf } from "../util/nodeIdOf.js";
import { applyAttributeChange } from "./applyAttributeChange.js";
import type { ControllerResources } from "./ControllerNode.js";
import { CustomClusterPoller } from "./CustomClusterPoller.js";
import { NodeAttributeReader } from "./NodeProcessor.js";
import { Nodes } from "./Nodes.js";
import { decodeManualCode, decodeQrCode } from "./onboardingPayload.js";
import { AttributeChange, EventChange, PeerChangeBus } from "./PeerChangeBus.js";
import { ThreadDetailsPoller } from "./ThreadDetailsPoller.js";
import { pushNodeTime, TimeSyncInvokers } from "./timeSyncCommands.js";
import { SyncTrigger, TIME_FAILURE_EVENT_ID, TIME_SYNC_CLUSTER_ID, TimeSyncManager } from "./TimeSyncManager.js";
import { WebRtcProviderSessions, type WebRtcProviderNodes } from "./WebRtcProviderSessions.js";

const logger = Logger.get("ControllerCommandHandler");

/** The controller's own camera endpoint, which receives the WebRTC callbacks a peer sends back. */
export const CameraControllerEndpoint = CameraControllerDevice.with(WebRtcTransportRequestorServer);
export type CameraControllerEndpoint = typeof CameraControllerEndpoint;

const SIGNALLING_INVOKE_NAMES: Record<SignallingCommandName, "provideAnswer" | "provideIceCandidates"> = {
    ProvideAnswer: "provideAnswer",
    ProvideIceCandidates: "provideIceCandidates",
};

/** Coalescing window for structure and basic-information changes arriving as a burst. */
const NODE_UPDATE_DEBOUNCE = Seconds(2);

/** Longest a pending refresh may be extended by further report batches before it is sent regardless. */
const NODE_UPDATE_MAX_DEFERRAL = Seconds(10);

/**
 * Determine the Matter specification version from cached attributes.
 * Uses SpecificationVersion attribute (0/40/21) if available, otherwise
 * estimates from DataModelRevision attribute (0/40/0).
 *
 * @param attributes Cached attributes for the node
 * @returns Matter version string (e.g., "1.2.0", "1.3.0") or undefined if unknown
 */
function determineMatterVersion(attributes: AttributesData): string | undefined {
    // BasicInformation cluster is 0x28 (40 decimal)
    // SpecificationVersion is attribute 0x15 (21 decimal) = path "0/40/21"
    // DataModelRevision is attribute 0x0 (0 decimal) = path "0/40/0"
    const specificationVersion = attributes["0/40/21"];
    const dataModelRevision = attributes["0/40/0"];

    if (typeof specificationVersion === "number" && specificationVersion > 0) {
        const { major, minor, patch } = SpecificationVersion.decode(specificationVersion);
        return `${major}.${minor}.${patch}`;
    }

    // Fall back to estimating from DataModelRevision
    if (typeof dataModelRevision === "number") {
        if (dataModelRevision <= 16) {
            return "<1.2.0";
        } else if (dataModelRevision === 17) {
            return "1.2.0";
        }
    }

    return undefined;
}

/**
 * Wait for a peer's structure to have been read, until told to give up.
 *
 * No timeout of its own: the device has just been commissioned, so it is reachable, and a bridge can take
 * a long time to report its endpoints. Answering early would report a node whose structure is still
 * arriving, which reads as success but is not. Shutdown is the one thing that ends the wait, because
 * `seeded` fires at most once and never fires at all for a node that is torn down first.
 */
async function awaitSeeded(node: ClientNode, abort: Abort): Promise<void> {
    if (node.lifecycle.isSeeded) {
        return;
    }
    const observers = new ObserverGroup();
    try {
        await abort.attempt(new Promise<void>(resolve => observers.on(node.lifecycle.seeded, () => resolve())));
    } finally {
        observers.close();
    }
}

/**
 * Discovered peers, one entry per device, ordered by the advertisement each was last seen in.
 *
 * A device re-advertising within the discovery window is emitted again for the same node, so the raw
 * result counts one device many times, and the last entry is whichever device happened to be found first.
 */
export function uniqueByLastAdvertisement<T extends { id: string }>(discovered: readonly T[]): T[] {
    const unique = new Map<string, T>();
    for (const node of discovered) {
        unique.delete(node.id);
        unique.set(node.id, node);
    }
    return Array.from(unique.values());
}

export interface ControllerCommandHandlerOptions {
    bleEnabled: boolean;
    bleProxyEnabled: boolean;
    otaEnabled: boolean;
    /** Defaults to false. */
    timeSyncEnabled?: boolean;
    /** Defaults to false. */
    threadDiagnosticsEnabled?: boolean;
    /** Interval between custom cluster polling cycles. Defaults to, and is floored at, 60 seconds. */
    customClusterPollInterval?: Duration;
    /**
     * Do not subscribe to peers on our own, neither after commissioning nor when the server starts, unless switched on
     * per peer. Defaults to false.
     */
    disableAutoSubscription?: boolean;
}

/** What a single invoke may set besides its command; `network` and `abort` apply to the exchange, not the request. */
type InvokeOptions = Omit<Invoke.Definition, "commands"> & Pick<ClientInvoke, "network" | "abort">;

/** A field value matter.js refuses while encoding is a bad argument of the caller, not a server failure. */
function invokeRequestOf(definition: Invoke.Definition) {
    try {
        return Invoke(definition);
    } catch (error) {
        if (error instanceof ValidationError) {
            throw new ServerError(ServerErrorCode.InvalidArguments, `Invalid command fields: ${error.message}`, error);
        }
        throw error;
    }
}

/**
 * Cast: matter.js types the `ClusterType(model)` overload as `object`, but a `ClusterMap` model always
 * carries the id `ClusterLike` requires.
 */
function clusterSpecifierOf(entry: ClusterMapEntry): Specifier.ClusterLike {
    return ClusterType(entry.model) as Specifier.ClusterLike;
}

/** A known-address attempt that left the device off the fabric, so discovery may still reach it. */
class UnreachedAddressError extends Error {
    constructor(override readonly cause: unknown) {
        super("Commissioning at the supplied address failed");
    }
}

const UNSCOPED_INVOKES = {};

/**
 * Why device attestation refuses a device, as the text the client is shown, or `undefined` when no finding
 * stops it. A test certificate gets an actionable hint; any other error-level finding is named with its check.
 */
export function attestationRefusalOf(findings: AttestationFinding[]): string | undefined {
    if (findings.some(({ type }) => type === DeviceAttestationCheck.TrustedAsTestCertificate)) {
        return "This device uses a test/development certificate. To commission it, enable the test-net DCL option of the Matter Server — only do this if you trust the vendor.";
    }
    const errors = findings.filter(({ level }) => level === "error");
    if (errors.length === 0) {
        return undefined;
    }
    return `Device attestation refused: ${errors.map(({ type, message }) => `${type}: ${message}`).join("; ")}`;
}

/**
 * The `NodeCommissionFailed` error for a failed commissioning, with a `reason` a client can act on. With
 * `attestationRejected` the reason is `attestation-rejected`, whatever error the aborted commissioning raised.
 */
export function commissionFailureOf(error: unknown, attestationRejected: boolean): ServerError {
    const cause = error instanceof Error ? error : undefined;
    const failed = (
        reason: CommissionFailureReason,
        message = `Commission failed: ${cause?.message ?? String(error)}`,
    ) => ServerError.nodeCommissionFailed(message, reason, cause);
    if (attestationRejected) {
        return failed("attestation-rejected");
    }
    // PASE rejects the device's key confirmation, which is what a mistyped pairing code looks
    // like on the wire. Saying so lets a client offer the code again instead of a generic retry.
    if (causedBy(error, PasscodeMismatchError)) {
        return failed(
            "passcode-mismatch",
            "The pairing code does not match the device. Check the code and commission again.",
        );
    }
    if (causedBy(error, TimeoutError, CommissioningTimeoutError, DiscoveryIncompleteError)) {
        return failed("timeout");
    }
    if (causedBy(error, NoDiscoveryTransportError)) {
        return failed("other");
    }
    if (causedBy(error, DiscoveryError)) {
        return failed("not-discovered");
    }
    return failed("other");
}

export class ControllerCommandHandler {
    #node: ServerNode;
    readonly #fabricIndex: FabricIndex;
    readonly #fabrics: FabricManager;
    #otaProvider?: Endpoint<typeof OtaProviderEndpoint>;
    #webRtcRequestor: Endpoint<CameraControllerEndpoint>;
    readonly #webRtcProviders: WebRtcProviderSessions;
    #started = false;
    #connected = false;
    readonly #bleEnabled: boolean;
    readonly #bleProxyEnabled: boolean;
    readonly #otaEnabled: boolean;
    readonly #autoSubscriptionDisabled: boolean;
    /** Node management and attribute cache */
    #nodes = new Nodes();
    /** Cache of available updates keyed by nodeId */
    #availableUpdates = new Map<NodeId, SoftwareUpdateInfo>();
    /** Poller for custom cluster attributes (Eve energy, etc.) */
    #customClusterPoller: CustomClusterPoller;
    /** Manages time synchronization for nodes with the TimeSynchronization cluster */
    #timeSyncManager?: TimeSyncManager;
    #threadDetailsPoller?: ThreadDetailsPoller;
    /** Per-node ObserverGroups for cleanup on decommission */
    #nodeObservers = new Map<NodeId, ObserverGroup>();
    /** Per-node timers that coalesce basic-info changes into a single delayed node_updated refresh. */
    #nodeUpdateTimers = new Map<NodeId, Timer>();
    /**
     * Nodes awaiting a full node_updated. Held until a report batch completes so the refresh reflects
     * a consistent node rather than one caught mid-report.
     */
    #pendingNodeUpdates = new Set<NodeId>();
    #nodeUpdateDeadlines = new Map<NodeId, number>();
    /** Nodes with a lazy getNodeDetails populate in flight, so concurrent reads emit node_updated once. */
    #pendingLazyPopulate = new Set<NodeId>();
    /** Failure callbacks of the enable_auto_subscription calls still waiting for the node's subscription. */
    readonly #autoSubscribeWaiters = new WeakMap<ClientNode, Set<(error: Error) => void>>();
    /** The setting of the last setAutoSubscription call, set before it reaches the node. */
    readonly #autoSubscribeRequested = new WeakMap<ClientNode, boolean>();
    /** In-flight invokes per dedup scope; a scope dropped by its owner takes its entries with it. */
    readonly #inFlightInvokes = new WeakMap<object, Map<string, Promise<unknown>>>();
    events = {
        started: new AsyncObservable(),
        /** A removed attribute is reported with an `undefined` value. */
        attributeChanged: new Observable<[nodeId: NodeId, data: AttributeChange]>(),
        eventChanged: new Observable<[nodeId: NodeId, data: EventChange]>(),
        nodeAdded: new Observable<[nodeId: NodeId]>(),
        nodeStateChanged: new Observable<[nodeId: NodeId, state: NodeConnectionState]>(),
        /** Emitted when node availability changes (for sending node_updated events) */
        nodeAvailabilityChanged: new Observable<[nodeId: NodeId, available: boolean]>(),
        nodeStructureChanged: new Observable<[nodeId: NodeId]>(),
        nodeDecommissioned: new Observable<[nodeId: NodeId]>(),
        nodeEndpointAdded: new Observable<[nodeId: NodeId, endpointId: EndpointNumber]>(),
        nodeEndpointRemoved: new Observable<[nodeId: NodeId, endpointId: EndpointNumber]>(),
        webRtcCallback: new Observable<[WebRtcCallbackData]>(),
        /** @see WebRtcProviderSessionWatchIo.reported */
        webRtcProviderSessionsReported: new Observable<
            [nodeId: NodeId, endpointId: EndpointNumber, present: ReadonlySet<number>, restarted: boolean]
        >(),
    };
    #peers?: PeerSet;
    #changeBus?: PeerChangeBus;
    /** Subscriptions to {@link PeerChangeBus}, which outlives individual nodes. */
    #busObservers = new ObserverGroup();
    /** Aborted by {@link ControllerCommandHandler.close}, so no command outlives the handler. */
    #shutdown = new Abort();
    /** The running fabric label push; a newer label aborts it, so nodes that were not told yet get only the newer one. */
    #fabricLabelPush?: Abort;

    constructor(controller: ControllerResources, options: ControllerCommandHandlerOptions) {
        const {
            bleEnabled,
            bleProxyEnabled,
            otaEnabled,
            timeSyncEnabled = false,
            threadDiagnosticsEnabled = false,
            customClusterPollInterval,
            disableAutoSubscription = false,
        } = options;

        this.#node = controller.node;
        this.#fabricIndex = controller.fabricIndex;
        this.#fabrics = controller.node.env.get(FabricManager);
        this.#otaProvider = controller.otaProvider;
        this.#webRtcRequestor = controller.webRtcRequestor;
        const requestor = controller.webRtcRequestor;
        this.#webRtcProviders = new WebRtcProviderSessions({
            nodes: this.#webRtcProviderNodes(),
            requestor: {
                endpointId: () => EndpointNumber(requestor.number),
                sessions: () => requestor.stateOf(WebRtcTransportRequestorServer).currentSessions,
                act: async work => {
                    await requestor.act(agent => work(agent.get(WebRtcTransportRequestorServer)));
                },
            },
            fabricIndex: this.#fabricIndex,
            reported: (nodeId, endpointId, present, restarted) =>
                this.events.webRtcProviderSessionsReported.emit(nodeId, endpointId, present, restarted),
        });

        this.#bleEnabled = bleEnabled;
        this.#bleProxyEnabled = bleProxyEnabled;
        logger.info(`BLE is ${bleEnabled ? "enabled" : "disabled"}${bleProxyEnabled ? " (proxy mode)" : ""}`);
        this.#otaEnabled = otaEnabled;
        this.#autoSubscriptionDisabled = disableAutoSubscription;
        if (disableAutoSubscription) {
            logger.notice("Auto subscription is disabled; peers are only subscribed to when a client asks");
        }

        const attributeReader: NodeAttributeReader = {
            nodeConnected: peer => this.#runsUpkeep(peer.nodeId),
            handleReadAttributes: (peer, paths, fabricFiltered) =>
                this.handleReadAttributes(peer.nodeId, paths, fabricFiltered),
        };

        // Initialize custom cluster poller for Eve energy attributes etc.
        // Reads automatically trigger change events through the normal attribute flow
        this.#customClusterPoller = new CustomClusterPoller(attributeReader, customClusterPollInterval);

        if (threadDiagnosticsEnabled) {
            this.#threadDetailsPoller = new ThreadDetailsPoller(attributeReader);
        }

        if (timeSyncEnabled) {
            logger.info("Time synchronization enabled");
            this.#timeSyncManager = new TimeSyncManager({
                syncTime: peer => this.#syncNodeTime(peer.nodeId),
                nodeConnected: peer => this.#runsUpkeep(peer.nodeId),
                commissionedNodeCount: () => this.#node.peers.commissioned.length,
            });
        }
    }

    /** Build the canonical PeerAddress for the given node on this controller's fabric. */
    #peerOf(nodeId: NodeId): PeerAddress {
        return PeerAddress({ fabricIndex: this.#fabricIndex, nodeId });
    }

    /** matter.js replaces the Fabric object for the same index when it rotates the NOC. */
    get #fabric(): Fabric {
        return this.#fabrics.for(this.#fabricIndex);
    }

    #isConnected(nodeId: NodeId): boolean {
        return this.#nodes.has(nodeId) && this.#nodes.get(nodeId).lifecycle.isConnected;
    }

    /**
     * Whether polling, time sync and fabric label pushes reach the node. Off with auto subscription disabled, also for a
     * node whose auto subscription was enabled, so the client alone decides what is sent to the devices.
     */
    #runsUpkeep(nodeId: NodeId): boolean {
        return !this.#autoSubscriptionDisabled && this.#isConnected(nodeId);
    }

    #autoSubscribes(node: ClientNode): boolean {
        return node.stateOf(NetworkClient).autoSubscribe;
    }

    /** Also true while a switch of the setting is still being applied, so a client subscription never runs beside it. */
    #autoSubscribesOrWill(node: ClientNode): boolean {
        return this.#autoSubscribes(node) || this.#autoSubscribeRequested.get(node) === true;
    }

    /** Format a NodeId as a PeerAddress string for logging. */
    formatNode(nodeId: NodeId): string {
        return formatNodeId(nodeId, this.#fabricIndex);
    }

    get started() {
        return this.#started;
    }

    get bleEnabled() {
        return this.#bleEnabled;
    }

    get bleProxyEnabled() {
        return this.#bleProxyEnabled;
    }

    get autoSubscriptionDisabled() {
        return this.#autoSubscriptionDisabled;
    }

    async start() {
        if (this.#started) {
            return;
        }
        this.#started = true;

        // Before the node comes online: bringing it up starts every commissioned peer, and
        // a report arriving before the bus exists is not forwarded to anyone.
        this.#peers = this.#node.env.get(PeerSet);
        this.#startChangeBus();

        await this.#node.start();
        logger.notice(`Matter Controller started`);

        if (this.#otaEnabled) {
            // Subscribe to OTA provider events to track available updates
            await this.#setupOtaEventHandlers();
        }

        await this.events.started.emit();
        await this.#setupWebRtcCallbackBridge();
    }

    /**
     * One node-wide change stream feeds every peer, so these subscriptions are established once here
     * rather than per node in {@link ControllerCommandHandler.#registerNode}.
     */
    #startChangeBus() {
        const bus = new PeerChangeBus(this.#node, { reportWithoutSubscription: this.#autoSubscriptionDisabled });
        this.#changeBus = bus;

        // These run on one Observable shared by every peer; an uncaught throw would abort the emit and
        // starve the remaining listeners, so each body is contained.
        this.#busObservers.on(bus.events.attributeChanged, (nodeId, data) => {
            this.#guard(nodeId, "attribute change", () =>
                applyAttributeChange(nodeId, data, {
                    cache: this.#nodes.attributeCache,
                    emit: (id, change) => this.events.attributeChanged.emit(id, change),
                    markNodeUpdatePending: reason => this.#markNodeUpdatePending(this.#nodes.get(nodeId), reason),
                }),
            );
            this.#guard(nodeId, "WebRTC session change", () =>
                this.#webRtcProviders.attributeChanged(nodeId, data.path),
            );
        });

        this.#busObservers.on(bus.events.eventTriggered, (nodeId, data) => {
            this.#guard(nodeId, "event", () => {
                this.#webRtcProviders.eventTriggered(nodeId, data.path);
                this.events.eventChanged.emit(nodeId, data);
                if (
                    this.#timeSyncManager !== undefined &&
                    data.path.clusterId === TIME_SYNC_CLUSTER_ID &&
                    data.path.eventId === TIME_FAILURE_EVENT_ID
                ) {
                    logger.debug(`Received timeFailure event from node ${this.formatNode(nodeId)}`);
                    this.#timeSyncManager.syncNode(this.#peerOf(nodeId), SyncTrigger.TimeFailure);
                }
            });
        });

        // Clients that merge `node_updated` into their node model keep a value the snapshot only omits.
        this.#busObservers.on(this.#nodes.attributeCache.attributesRemoved, (nodeId, paths) => {
            this.#guard(nodeId, "attribute removal", () => {
                for (const path of paths) {
                    const [endpointId, clusterId, attributeId] = path.split("/").map(Number);
                    this.events.attributeChanged.emit(nodeId, {
                        path: {
                            endpointId: EndpointNumber(endpointId),
                            clusterId: ClusterId(clusterId),
                            attributeId: AttributeId(attributeId),
                        },
                        value: undefined,
                    });
                }
            });
        });

        this.#busObservers.on(bus.events.reportingStarted, nodeId => {
            this.#guard(nodeId, "first report", () => {
                this.#refreshAfterFirstReport(this.#nodes.get(nodeId)).catch(error =>
                    logger.warn(`Failed to refresh node ${this.formatNode(nodeId)} after its first report:`, error),
                );
            });
        });

        this.#busObservers.on(bus.events.endpointRemoved, (nodeId, endpointId) => {
            this.#guard(nodeId, "endpoint removal", () => {
                // Drop the endpoint before announcing it, so a read that follows the event never serves
                // attributes of an endpoint the node no longer has. The full rebuild follows on the
                // structure change.
                this.#nodes.attributeCache.deleteEndpoint(nodeId, endpointId);
                this.events.nodeEndpointRemoved.emit(nodeId, endpointId);
                this.#markNodeUpdatePending(this.#nodes.get(nodeId), "endpoint removed");
            });
        });
    }

    /**
     * Rebuilds the node's cache from the state its first report applied, which the bus did not forward. A
     * restored node waiting for that report then becomes available, with the rebuilt snapshot when the
     * rebuild succeeds. Any other node is sent again when a new snapshot replaced one clients could have
     * seen.
     */
    async #refreshAfterFirstReport(node: ClientNode) {
        const nodeId = nodeIdOf(node);
        const attributeCache = this.#nodes.attributeCache;
        const stale = attributeCache.get(nodeId);
        let rebuilt = false;
        try {
            // Also restarts a populate already running, which may have collected endpoints before the report.
            await attributeCache.update(node);
            const attributes = attributeCache.get(nodeId);
            // A populate that failed or was cancelled leaves the old snapshot, which must not go out as fresh.
            if (attributes !== undefined && attributes !== stale) {
                rebuilt = true;
                this.#registerWithProcessors(nodeId, attributes);
            }
        } finally {
            if (this.#nodes.isAwaitingFirstReport(nodeId)) {
                this.#endFirstReportWait(nodeId);
            } else if (rebuilt && stale !== undefined) {
                this.events.nodeStructureChanged.emit(nodeId);
            }
        }
    }

    /** The only way a restored node stops waiting for its first report. */
    #endFirstReportWait(nodeId: NodeId) {
        if (!this.#nodes.firstReportApplied(nodeId) || !this.#nodes.isAvailable(nodeId)) {
            return;
        }
        logger.notice(`Node ${this.formatNode(nodeId)} available after its first report`);
        this.events.nodeAvailabilityChanged.emit(nodeId, true);
    }

    /** Skips nodes no longer in the registry and contains throws; see {@link ControllerCommandHandler.#startChangeBus}. */
    #guard(nodeId: NodeId, what: string, act: () => void) {
        if (!this.#nodes.has(nodeId)) {
            return;
        }
        try {
            act();
        } catch (error) {
            logger.warn(`Failed to handle ${what} for node ${this.formatNode(nodeId)}:`, error);
        }
    }

    /**
     * Set up event handlers for OTA update notifications from the SoftwareUpdateManager.
     */
    async #setupOtaEventHandlers() {
        if (!this.#otaEnabled) {
            return;
        }
        try {
            const otaProvider = this.#otaProvider;
            if (!otaProvider) {
                logger.info("OTA provider not available");
                return;
            }

            const softwareUpdateManagerEvents = await otaProvider.act(agent => agent.get(SoftwareUpdateManager).events);
            if (softwareUpdateManagerEvents === undefined) {
                logger.info("SoftwareUpdateManager not available");
                return;
            }

            // Handle updateAvailable events - cache the update info
            softwareUpdateManagerEvents.updateAvailable.on(
                (peerAddress: PeerAddress, updateDetails: SoftwareUpdateInfo) => {
                    logger.notice(`Update available for node ${this.formatNode(peerAddress.nodeId)}:`, updateDetails);
                    this.#availableUpdates.set(peerAddress.nodeId, updateDetails);
                },
            );

            // Handle updateDone events - clear the cached update info
            softwareUpdateManagerEvents.updateDone.on((peerAddress: PeerAddress) => {
                logger.notice(`Update done for node ${this.formatNode(peerAddress.nodeId)}`);
                this.#availableUpdates.delete(peerAddress.nodeId);
            });

            logger.info("OTA event handlers registered");
        } catch (error) {
            logger.warn("Failed to setup OTA event handlers:", error);
        }
    }

    async #setupWebRtcCallbackBridge() {
        try {
            await this.#webRtcRequestor.act(agent => {
                this.#webRtcProviders.attachCallbacks(agent.get(WebRtcTransportRequestorServer).events, data =>
                    this.events.webRtcCallback.emit(data),
                );
            });
            logger.info("WebRTC callback bridge wired");
        } catch (error) {
            logger.warn("Failed to setup WebRTC callback bridge:", error);
        }
    }

    /**
     * `fields` must already be in matter.js's convention (see `toProviderCommandFields`); any
     * `originatingEndpointId` in it is overwritten.
     */
    async invokeWebRtcProviderCommand(args: {
        nodeId: NodeId;
        endpointId: EndpointNumber;
        commandName: SessionEstablishingCommandName;
        fields: Record<string, unknown>;
        /** @see WebRtcProviderSessionArgs.sessionEstablishing */
        sessionEstablishing?: (webRtcSessionId: number) => void;
    }): Promise<WebRtcTransportProvider.ProvideOfferResponse | WebRtcTransportProvider.SolicitOfferResponse> {
        return this.#webRtcProviders.establish(args);
    }

    /**
     * The session id is not checked against local records: they cover only this run, and the camera
     * answers for ids it does not hold.
     */
    async invokeWebRtcSignallingCommand(args: {
        nodeId: NodeId;
        endpointId: EndpointNumber;
        commandName: SignallingCommandName;
        fields: Record<string, unknown>;
    }): Promise<void> {
        this.#clusterEndpoint(args.nodeId, args.endpointId, WebRtcTransportProviderClient.id);
        await this.#invokeCommand(this.#nodes.get(args.nodeId), {
            endpoint: args.endpointId,
            cluster: WebRtcTransportProvider,
            command: SIGNALLING_INVOKE_NAMES[args.commandName],
            fields: args.fields,
        });
    }

    /** This server's node id on the fabric: the `PeerNodeID` a camera stores for its sessions (§11.4.5.5). */
    get localNodeId(): NodeId {
        return this.#fabric.nodeId;
    }

    #webRtcProviderNodes(): WebRtcProviderNodes {
        return {
            localNodeId: () => this.localNodeId,
            providerEndpoints: nodeId => {
                const endpoints = new Array<EndpointNumber>();
                for (const endpoint of this.#nodes.get(nodeId).endpoints) {
                    if (endpoint.behaviors.has(WebRtcTransportProviderClient)) {
                        endpoints.push(EndpointNumber(endpoint.number));
                    }
                }
                return endpoints;
            },
            currentSessions: (nodeId, endpointId) => {
                const { endpoints } = this.#nodes.get(nodeId);
                if (!endpoints.has(endpointId)) return undefined;
                const endpoint = endpoints.for(endpointId);
                if (!endpoint.behaviors.has(WebRtcTransportProviderClient)) return undefined;
                return endpoint.stateOf(WebRtcTransportProviderClient).currentSessions;
            },
            providerRevision: (nodeId, endpointId) =>
                // Globals, not the attribute cache: the cache stays empty after a restart until a report carries it.
                this.#clusterEndpoint(nodeId, endpointId, WebRtcTransportProviderClient.id).globalsOf(
                    WebRtcTransportProviderClient,
                ).clusterRevision,
            invoke: (nodeId, endpointId, command, fields) =>
                this.#invokeCommand(this.#nodes.get(nodeId), {
                    endpoint: endpointId,
                    cluster: WebRtcTransportProvider,
                    command,
                    fields,
                }),
            syncTime: nodeId => this.#syncNodeTime(nodeId),
            formatNode: nodeId => this.formatNode(nodeId),
        };
    }

    /** @throws ServerError if node not found */
    getNode(nodeId: NodeId): ClientNode {
        return this.#nodes.get(nodeId);
    }

    async invokeCommand<const C extends Specifier.ClusterLike>(
        node: ClientNode,
        request: Invoke.ConcreteCommandRequest<C>,
        options?: Omit<Invoke.Definition, "commands">,
    ) {
        return this.#invokeCommand(node, request, options);
    }

    /** @see WebRtcProviderSessions.removeTracked */
    async removeTrackedWebRtcSession(
        webRtcSessionId: number,
        nodeId: NodeId,
        endpointId: EndpointNumber,
    ): Promise<void> {
        await this.#webRtcProviders.removeTracked(webRtcSessionId, nodeId, endpointId);
    }

    /** @see WebRtcProviderSessions.abandon */
    async abandonWebRtcSession(webRtcSessionId: number, nodeId: NodeId, endpointId: EndpointNumber): Promise<void> {
        await this.#webRtcProviders.abandon(webRtcSessionId, nodeId, endpointId);
    }

    /**
     * Push UTC time (and, for TimeZone-feature nodes, time zone + DST) to a node's
     * TimeSynchronization cluster.
     */
    async #syncNodeTime(nodeId: NodeId): Promise<void> {
        const node = this.#nodes.get(nodeId);
        const attributes = this.#nodes.attributeCache.get(nodeId) ?? {};
        const invokers: TimeSyncInvokers = {
            setUtcTime: async fields => {
                await this.#invokeCommand(node, {
                    endpoint: EndpointNumber(0),
                    cluster: TimeSynchronization.Cluster,
                    command: "setUtcTime",
                    fields,
                });
            },
            setTimeZone: async fields =>
                (await this.#invokeCommand(node, {
                    endpoint: EndpointNumber(0),
                    cluster: TimeSynchronization.Cluster,
                    command: "setTimeZone",
                    fields,
                })) as TimeSynchronization.SetTimeZoneResponse | undefined,
            setDstOffset: async fields => {
                await this.#invokeCommand(node, {
                    endpoint: EndpointNumber(0),
                    cluster: TimeSynchronization.Cluster,
                    command: "setDstOffset",
                    fields,
                });
            },
        };
        await pushNodeTime({ invokers, attributes, nowMs: Time.nowMs });
    }

    /** Release everything this handler owns. The controller node belongs to its creator and stays open. */
    async close() {
        this.#shutdown.abort(new Error("The controller is shutting down"));
        for (const timer of this.#nodeUpdateTimers.values()) {
            timer.stop();
        }
        this.#nodeUpdateTimers.clear();
        this.#nodeUpdateDeadlines.clear();
        this.#pendingNodeUpdates.clear();
        // Observers first: a state change reaching #handleNodeStateChange re-registers the node with
        // every processor, so stopping them first leaves the processors re-populated.
        for (const observers of this.#nodeObservers.values()) {
            observers.close();
        }
        this.#nodeObservers.clear();
        this.#busObservers.close();
        this.#changeBus?.close();
        this.#changeBus = undefined;
        // Each stop() awaits an in-flight read against a possibly unresponsive node; serially they
        // stack their timeouts, and a throw from one would skip the rest of the shutdown.
        const stopped = await Promise.allSettled([
            this.#customClusterPoller.stop(),
            this.#threadDetailsPoller?.stop(),
            this.#timeSyncManager?.stop(),
        ]);
        for (const result of stopped) {
            if (result.status === "rejected") {
                logger.warn("Stopping a node processor failed:", result.reason);
            }
        }
    }

    async #registerNode(nodeId: NodeId, restored: boolean) {
        // A node commissioned moments ago may not have its commissioning behavior active yet, so the
        // handle has to be created on demand rather than looked up.
        const node = await this.#node.peers.forAddress(this.#peerOf(nodeId));

        // Per-node ObserverGroup so all subscriptions are cleaned up on decommission
        const nodeObservers = new ObserverGroup();
        this.#nodeObservers.set(nodeId, nodeObservers);

        // These observables belong to matter.js and rethrow: `decommissioned` in particular is emitted
        // inside the decommission transaction, so an uncaught throw here starves matter.js's own
        // listeners and fails a removal the device already accepted.
        //
        // A report batch has completed, so the node's state is consistent. Extend the window rather
        // than flushing at once: a large bridge reports its changes across several batches.
        nodeObservers.on(node.eventsOf(NetworkClient).subscriptionAlive, () =>
            this.#guard(nodeId, "subscription report", () => {
                if (this.#pendingNodeUpdates.has(nodeId)) {
                    this.#armNodeUpdate(node, true);
                }
                this.#webRtcProviders.reportCompleted(nodeId);
            }),
        );
        nodeObservers.on(node.lifecycle.connectionStateChanged, state => {
            this.#handleNodeStateChange(node, state).catch(error =>
                logger.warn(`Failed to handle state change for node ${this.formatNode(nodeId)}:`, error),
            );
        });
        nodeObservers.on(node.lifecycle.changed, (type, endpoint) =>
            this.#guard(nodeId, "endpoint lifecycle change", () => {
                if (type !== EndpointLifecycle.Change.PartsReady || endpoint === node) {
                    return;
                }
                this.#nodes.queueEndpointAdded(nodeId, EndpointNumber(endpoint.number));
                this.#webRtcProviders.endpointAdded(nodeId);
                this.#markNodeUpdatePending(node, "endpoint added");
            }),
        );
        nodeObservers.on(node.lifecycle.decommissioned, () =>
            this.#guard(nodeId, "decommissioning", () => {
                if (this.#cleanupNodeAfterRemoval(nodeId)) {
                    this.events.nodeDecommissioned.emit(nodeId);
                }
            }),
        );
        // No await between the check and set(): a report starting later then finds the node registered.
        if (restored && this.#changeBus?.isReporting(node) === false) {
            this.#nodes.awaitFirstReport(nodeId);
        }
        this.#nodes.set(nodeId, node);

        this.#nodes.seedState(nodeId, node.lifecycle.connectionState);
        if (this.#nodes.isAvailable(nodeId)) {
            logger.notice(
                `Node ${this.formatNode(nodeId)} available at registration (state: ${NodeConnectionState[node.lifecycle.connectionState]})`,
            );
        }

        await this.#snapshotNode(nodeId, node);

        // A peer's structure can arrive after registration, read from the device or loaded later.
        nodeObservers.on(node.lifecycle.seeded, () =>
            this.#snapshotNode(nodeId, node)
                .then(() => this.#markNodeUpdatePending(node, "node seeded"))
                .catch(error => logger.warn(`Failed to cache node "${this.formatNode(nodeId)}":`, error)),
        );

        return node;
    }

    /** Build the node's attribute snapshot and point the pollers at it. */
    async #snapshotNode(nodeId: NodeId, node: ClientNode): Promise<void> {
        await this.#nodes.attributeCache.add(node);
        const attributes = this.#nodes.attributeCache.get(nodeId);
        if (attributes !== undefined) {
            this.#registerWithProcessors(nodeId, attributes);
        }
    }

    #registerWithProcessors(nodeId: NodeId, attributes: AttributesData) {
        const peer = this.#peerOf(nodeId);
        this.#registerWithPollers(peer, attributes);
        this.#timeSyncManager?.registerNode(peer, attributes);
    }

    /** Leaves out the time sync, whose registration can push the time to the node. */
    #registerWithPollers(peer: PeerAddress, attributes: AttributesData) {
        this.#customClusterPoller.registerNode(peer, attributes);
        this.#threadDetailsPoller?.registerNode(peer, attributes);
    }

    /**
     * Record that a node needs a full refresh. The refresh is deliberately not sent from here: a
     * structure change is observed while its report batch is still being applied, so serialising the
     * node now can capture an endpoint whose attributes have not arrived yet.
     */
    #markNodeUpdatePending(node: ClientNode, reason: string) {
        const nodeId = nodeIdOf(node);
        if (this.#pendingNodeUpdates.has(nodeId)) {
            return;
        }
        this.#pendingNodeUpdates.add(nodeId);
        logger.info(`Node ${this.formatNode(nodeId)} ${reason}, full node_updated pending`);
        // Fallback: a node whose subscription never reports again would otherwise stay pending.
        this.#armNodeUpdate(node, false);
    }

    /**
     * `restart` extends the window so changes spread over several report batches land in one refresh.
     * Extension is capped: a node reporting faster than the window would otherwise defer its refresh
     * indefinitely and never tell consumers about the change at all.
     */
    #armNodeUpdate(node: ClientNode, restart: boolean) {
        const nodeId = nodeIdOf(node);
        const running = this.#nodeUpdateTimers.get(nodeId);
        if (running !== undefined) {
            const deadline = this.#nodeUpdateDeadlines.get(nodeId);
            if (!restart || (deadline !== undefined && Time.nowUs >= deadline)) {
                return;
            }
            running.stop();
        } else {
            // Monotonic: an NTP step must not stretch or collapse the deferral window.
            this.#nodeUpdateDeadlines.set(nodeId, Time.nowUs + NODE_UPDATE_MAX_DEFERRAL);
        }
        const timer = Time.getTimer(`node-update-${nodeId}`, NODE_UPDATE_DEBOUNCE, () => {
            this.#nodeUpdateTimers.delete(nodeId);
            this.#nodeUpdateDeadlines.delete(nodeId);
            this.#pendingNodeUpdates.delete(nodeId);
            this.#handleNodeStructureChange(node).catch(error =>
                logger.warn(`Failed to handle structure change for node ${this.formatNode(nodeId)}:`, error),
            );
        }).start();
        this.#nodeUpdateTimers.set(nodeId, timer);
    }

    async #handleNodeStateChange(node: ClientNode, state: NodeConnectionState): Promise<void> {
        const nodeId = nodeIdOf(node);

        // A node that never became unavailable was only briefly re-establishing, and the bus forwards what
        // its resubscription reports. Rebuild only when it comes back from being considered offline. A
        // restored node still waiting for its first report is rebuilt by #refreshAfterFirstReport instead.
        const wasAvailable = this.#nodes.isAvailable(nodeId);
        const result = this.#nodes.processStateChange(nodeId, state);

        this.events.nodeStateChanged.emit(nodeId, state);

        if (result.availabilityChanged) {
            const availabilityMessage = `Node ${this.formatNode(nodeId)} availability changed to ${result.available} (state: ${NodeConnectionState[state]})`;
            if (result.available) {
                logger.notice(availabilityMessage);
            } else {
                logger.warn(availabilityMessage);
            }
            this.events.nodeAvailabilityChanged.emit(nodeId, result.available);
        }

        // Populate last so the state/availability emits above are not delayed behind a multi-second
        // rebuild.
        if (state === NodeConnectionState.Connected) {
            if (
                !this.#nodes.isAwaitingFirstReport(nodeId) &&
                (!wasAvailable || !this.#nodes.attributeCache.has(nodeId))
            ) {
                await this.#nodes.attributeCache.update(node);
            }
            const attributes = this.#nodes.attributeCache.get(nodeId);
            if (attributes) {
                this.#registerWithProcessors(nodeId, attributes);
            }
        }
    }

    async #handleNodeStructureChange(node: ClientNode): Promise<void> {
        const nodeId = nodeIdOf(node);
        this.#pendingNodeUpdates.delete(nodeId);

        this.#nodeUpdateTimers.get(nodeId)?.stop();
        this.#nodeUpdateTimers.delete(nodeId);

        const connected = this.#isConnected(nodeId);
        // Without auto subscription a node is usually not connected, and reads are then the only source of its state.
        if (this.#autoSubscriptionDisabled || connected) {
            await this.#nodes.attributeCache.update(node);
        }
        this.events.nodeStructureChanged.emit(nodeId);

        for (const endpointId of this.#nodes.drainPendingEndpointAdds(nodeId)) {
            this.events.nodeEndpointAdded.emit(nodeId, endpointId);
        }

        const attributes = this.#nodes.attributeCache.get(nodeId);
        if (connected && attributes !== undefined) {
            this.#registerWithPollers(this.#peerOf(nodeId), attributes);
        }
    }

    /**
     * Initialize the controller and register all commissioned nodes, which populates their attribute
     * caches. Connecting the peers is the controller node's own job.
     *
     * Guarded by #connected so it runs exactly once, even if called multiple times
     * (e.g. when WebServer.start() registers handlers for multiple listen addresses).
     */
    async initializeNodes() {
        if (this.#connected) {
            return;
        }
        this.#connected = true;

        await this.start();

        const nodes = this.#node.peers.commissioned.map(peer => nodeIdOf(peer));
        logger.info(`Found ${nodes.length} nodes: ${nodes.map(nodeId => this.formatNode(nodeId)).join(", ")}`);

        for (const nodeId of nodes) {
            try {
                logger.info(`Initializing node "${this.formatNode(nodeId)}" ...`);
                await this.#registerNode(nodeId, true);
            } catch (error) {
                logger.warn(`Failed to initialize node "${this.formatNode(nodeId)}":`, error);
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
     * Whether a node id is already reserved on the fabric, either by a commissioned peer or the commissioner itself.
     * Authoritative against matter.js rather than the locally tracked node set, which can drift from the fabric.
     */
    isNodeIdInUse(nodeId: NodeId): boolean {
        return (
            nodeId === this.#fabric.rootNodeId ||
            (this.#node.peers.get(this.#peerOf(nodeId))?.lifecycle.isCommissioned ?? false)
        );
    }

    /**
     * Alias for decommissionNode to match NodeCommandHandler interface.
     */
    removeNode(nodeId: NodeId) {
        return this.decommissionNode(nodeId);
    }

    async interviewNode(nodeId: NodeId) {
        const node = this.#nodes.get(nodeId);

        // The caller is responsible for broadcasting node_updated after the interview completes.
        logger.info(`Interview requested for node ${this.formatNode(nodeId)} - do a complete read`);

        // Do a full Read of the node
        const read = {
            ...Read({
                fabricFilter: true,
                attributes: [{}],
            }),
            includeKnownVersions: true, // do not send DataVersionFilters, so we do a new clean read
        };
        for await (const _chunk of node.interaction.read(read));
    }

    /**
     * Await the node's attribute cache being populated so a direct read returns a complete snapshot
     * rather than the empty-then-node_updated sequence the lazy fallback in getNodeDetails produces.
     * A rebuild that is already running is awaited too, so a read after a structure change serves the
     * new structure instead of the one the node reported before it.
     */
    async ensureNodePopulated(nodeId: NodeId): Promise<void> {
        const node = this.#nodes.get(nodeId);
        const attributeCache = this.#nodes.attributeCache;
        if (!attributeCache.has(nodeId)) {
            // A no-op for a node with nothing to snapshot yet, so the cache stays the only judge of that.
            await attributeCache.add(node);
            return;
        }
        await attributeCache.settled(nodeId);
    }

    /**
     * Get full node details in WebSocket API format.
     * @param nodeId The node ID
     * @param lastInterviewDate Optional last interview date (tracked externally)
     */
    getNodeDetails(nodeId: NodeId, lastInterviewDate?: Date): MatterNodeData {
        const node = this.#nodes.get(nodeId);
        const attributeCache = this.#nodes.attributeCache;

        // Ensure the cache is populated if node is initialized but cache doesn't exist yet.
        // Populate runs asynchronously, so this call returns an empty snapshot; emit node_updated once
        // it completes so the requester receives the populated data. The #pendingLazyPopulate guard
        // registers the emit only once per populate, so concurrent reads don't fan out duplicate
        // node_updated broadcasts. has() in the callback avoids a loop for an uninitialized node whose
        // populate never fills the cache.
        if (!attributeCache.has(nodeId) && !this.#pendingLazyPopulate.has(nodeId)) {
            this.#pendingLazyPopulate.add(nodeId);
            attributeCache
                .add(node)
                .then(() => {
                    if (attributeCache.has(nodeId)) {
                        this.events.nodeStructureChanged.emit(nodeId);
                    }
                })
                .catch(error => logger.warn(`Failed to populate cache for node ${this.formatNode(nodeId)}:`, error))
                .finally(() => this.#pendingLazyPopulate.delete(nodeId));
        }

        // Get cached attributes (empty object if node not yet initialized)
        const attributes = attributeCache.get(nodeId) ?? {};

        return {
            node_id: nodeId,
            date_commissioned: getDateAsString(
                new Date(node.maybeStateOf(CommissioningClient)?.commissionedAt ?? Date.now()),
            ),
            last_interview: getDateAsString(lastInterviewDate ?? new Date()),
            interview_version: 6,
            available: this.#nodes.isAvailable(nodeId),
            is_bridge: isBridgeNode(attributes),
            attributes,
            attribute_subscriptions: [],
            matter_version: determineMatterVersion(attributes),
            endpoint_parents: attributeCache.endpointParents(nodeId, node),
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
        const node = this.#nodes.get(nodeId);
        const batchSize = 9;
        const parsedPaths = attributePaths.map(path => splitAttributePath(path));

        for (let i = 0; i < parsedPaths.length; i += batchSize) {
            const batch = parsedPaths.slice(i, i + batchSize);
            const readRequest = {
                ...Read({
                    fabricFilter: fabricFiltered,
                    attributes: batch.map(({ endpointId, clusterId, attributeId }) => ({
                        endpointId: endpointId !== undefined ? EndpointNumber(endpointId) : undefined,
                        clusterId: clusterId !== undefined ? ClusterId(clusterId) : undefined,
                        attributeId: attributeId !== undefined ? AttributeId(attributeId) : undefined,
                    })),
                }),
                includeKnownVersions: true,
            };

            for await (const chunk of node.interaction.read(readRequest)) {
                for await (const entry of chunk) {
                    if (entry.kind === "attr-value") {
                        const { pathStr, value: wsValue } = this.#convertAttributeToWebSocket(
                            {
                                endpointId: EndpointNumber(entry.path.endpointId),
                                clusterId: ClusterId(entry.path.clusterId),
                                attributeId: entry.path.attributeId,
                            },
                            entry.value,
                        );
                        result[pathStr] = wsValue;
                    } else if (entry.kind === "attr-status") {
                        const pathStr = buildAttributePath(
                            entry.path.endpointId,
                            entry.path.clusterId,
                            entry.path.attributeId,
                        );
                        logger.warn(`Failed to read attribute ${pathStr}: status=${entry.status}`);
                    }
                }
            }
        }

        return result;
    }

    /**
     * Read with full control over the Matter request. Unlike {@link handleReadAttributes} the paths go out as one
     * request, and only the data version filters the caller gives are sent.
     * @throws {ServerError} with code InvalidArguments, before anything is sent, for a malformed path or invalid id, a
     *   request without paths, an `eventMin` or data version out of range, or `eventMin` without event paths and data
     *   version filters without attribute paths.
     */
    async read(request: InteractionReadRequest): Promise<InteractionReport> {
        checkInteractionRequest(request);
        const node = this.#nodes.get(request.nodeId);
        const read = { ...this.#readOf(request), includeKnownVersions: true };
        return this.#collectReport(request.nodeId, node.interaction.read(read));
    }

    /**
     * Open a subscription of the caller's own. Only available with auto subscription disabled, and only for a node
     * whose auto subscription was not enabled with {@link setAutoSubscription}. Reports reach
     * {@link InteractionSubscriptionListener.report} except the priming report, which the result carries. matter.js ends
     * the subscription when the node is removed or the controller goes offline.
     * @throws {ServerError} with code InvalidArguments, before anything is sent, for the arguments {@link read} refuses
     *   and for intervals outside 0 to 65535 seconds or a `maxInterval` below `minInterval`.
     */
    async subscribe(
        request: InteractionSubscribeRequest,
        listener: InteractionSubscriptionListener,
    ): Promise<InteractionSubscription> {
        const { nodeId, minInterval, maxInterval } = request;
        if (!this.#autoSubscriptionDisabled) {
            throw ServerError.invalidArguments("subscribe requires the server to run with --disable-auto-subscription");
        }
        checkInteractionRequest(request);
        const node = this.#nodes.get(nodeId);
        if (this.#autoSubscribesOrWill(node)) {
            throw ServerError.invalidArguments(
                `Node ${nodeId} has auto subscription enabled; subscribe requires disable_auto_subscription first`,
            );
        }

        let priming: InteractionReport | undefined;
        const subscribe: PlainClientSubscribe = {
            ...this.#readOf(request),
            includeKnownVersions: true,
            keepSubscriptions: request.keepSubscriptions ?? false,
            minIntervalFloor: Seconds(minInterval),
            maxIntervalCeiling: Seconds(maxInterval),
            // Draining the data is what applies it to the node state.
            updated: async data => {
                const report = await this.#collectReport(nodeId, data);
                if (priming === undefined) {
                    priming = report;
                } else {
                    listener.report(report);
                }
            },
            closed: () => listener.closed(),
        };
        const active = await node.interaction.subscribe(subscribe);
        if (priming === undefined) {
            active.close();
            throw new InternalError(`Subscription ${active.subscriptionId} became active without a priming report`);
        }
        // Auto subscription enabled while this was being set up would leave both subscriptions running.
        if (this.#autoSubscribesOrWill(node)) {
            active.close();
            throw ServerError.invalidArguments(
                `Node ${nodeId} had its auto subscription enabled while subscribing; the subscription was closed`,
            );
        }
        return {
            id: active.subscriptionId,
            nodeId,
            priming,
            close: () => {
                Promise.resolve(active.close()).catch(error =>
                    logger.warn(`Failed to close subscription ${active.subscriptionId}:`, error),
                );
            },
        };
    }

    #readOf(request: Omit<InteractionSubscribeRequest, "minInterval" | "maxInterval" | "keepSubscriptions">): Read {
        const { attributePaths, eventPaths, eventMin, fabricFiltered = true, dataVersionFilters } = request;
        return Read({
            fabricFilter: fabricFiltered,
            attributes: attributePaths?.length ? attributePaths.map(path => splitAttributePath(path)) : undefined,
            events: eventPaths?.length
                ? eventPaths.map(({ path, isUrgent }): EventPath => ({
                      ...splitEventPath(path),
                      isUrgent,
                  }))
                : undefined,
            versionFilters: dataVersionFilters?.length
                ? dataVersionFilters.map(({ path, dataVersion }): DataVersionFilter => {
                      const { endpointId, clusterId } = splitAttributePath(path);
                      if (endpointId === undefined || clusterId === undefined) {
                          throw ServerError.invalidArguments(
                              `Data version filter path "${path}" must name an endpoint and a cluster`,
                          );
                      }
                      return { path: { endpointId, clusterId }, dataVersion };
                  })
                : undefined,
            eventFilters: eventMin !== undefined ? [{ eventMin: EventNumber(eventMin) }] : undefined,
        });
    }

    async #collectReport(nodeId: NodeId, data: ReadResult): Promise<InteractionReport> {
        const report: InteractionReport = { attributes: {}, events: new Array<MatterNodeEvent>() };
        for await (const chunk of data) {
            for await (const entry of chunk) {
                switch (entry.kind) {
                    case "attr-value": {
                        const { pathStr, value } = this.#convertAttributeToWebSocket(entry.path, entry.value);
                        report.attributes[pathStr] = value;
                        report.data_versions ??= {};
                        report.data_versions[`${entry.path.endpointId}/${entry.path.clusterId}`] = entry.version;
                        break;
                    }
                    case "event-value":
                        report.events.push(
                            convertEventToWebSocket(nodeId, entry.path, {
                                eventNumber: entry.number,
                                priority: entry.priority,
                                epochTimestamp: entry.epochTimestamp,
                                systemTimestamp: entry.systemTimestamp,
                                data: entry.value,
                            }),
                        );
                        break;
                    case "attr-status": {
                        const { endpointId, clusterId, attributeId } = entry.path;
                        report.attribute_status ??= {};
                        report.attribute_status[statusPathOf(endpointId, clusterId, attributeId)] = pathStatusOf(entry);
                        break;
                    }
                    case "event-status": {
                        const { endpointId, clusterId, eventId } = entry.path;
                        report.event_status ??= {};
                        report.event_status[statusPathOf(endpointId, clusterId, eventId)] = pathStatusOf(entry);
                        break;
                    }
                }
            }
        }
        return report;
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
            clusterData = ClusterMap[clusterId];
        }
        return {
            pathStr: buildAttributePath(endpointId, clusterId, attributeId),
            value: convertMatterToWebSocketTagBased(
                value,
                clusterData?.attributes[attributeId] ?? GlobalAttributes[attributeId],
                clusterData?.model,
            ),
        };
    }

    /** A missing endpoint or cluster is a client mistake, so it is reported as InvalidArguments, not as a device status. */
    #clusterEndpoint(nodeId: NodeId, endpointId: EndpointNumber, clusterName: string): Endpoint {
        const { endpoints } = this.#nodes.get(nodeId);
        if (!endpoints.has(endpointId)) {
            throw ServerError.invalidArguments(`Endpoint ${endpointId} does not exist`);
        }
        const endpoint = endpoints.for(endpointId);
        if (!endpoint.behaviors.has(clusterName)) {
            throw ServerError.invalidArguments(`Cluster "${clusterName}" does not exist on endpoint ${endpointId}`);
        }
        return endpoint;
    }

    /**
     * Write a single attribute on a remote node. Uses `setStateOf(string, ...)` (not `set({...})`)
     * because peer cluster behaviors are dynamically registered and aren't on the agent's cached property getters.
     */
    async #writeAttribute(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        clusterId: ClusterId,
        attributeName: string,
        value: unknown,
    ): Promise<{ status: number; clusterStatus?: number }> {
        const clusterEntry = ClusterMap[clusterId];
        if (!clusterEntry) {
            throw ServerError.invalidArguments(`Cluster Id "${clusterId}" unknown`);
        }
        const clusterProperty = clusterEntry.model.propertyName;
        const endpoint = this.#clusterEndpoint(nodeId, endpointId, clusterProperty);

        try {
            await endpoint.setStateOf(clusterProperty, { [attributeName]: value });
            return { status: 0 };
        } catch (error) {
            if (error instanceof MatterAggregateError) {
                const first = error.errors.find((e): e is StatusResponseError => e instanceof StatusResponseError);
                if (first !== undefined) {
                    const dropped = error.errors.filter(e => e !== first);
                    if (dropped.length > 0) {
                        logger.info(
                            `Write aggregate: reporting first error, dropping ${dropped.length} additional`,
                            dropped,
                        );
                    }
                    return { status: first.code, clusterStatus: first.clusterCode };
                }
                throw error;
            }
            StatusResponseError.accept(error);
            return { status: error.code, clusterStatus: error.clusterCode };
        }
    }

    /**
     * Set the fabric label. matter.js requires a non-empty label of 1-32 chars; callers must normalize first.
     *
     * Resolves once the controller holds the label. The connected nodes are told in the background, see
     * {@link #pushFabricLabel}. `pushed` resolves when that push has finished, was stopped by a newer label or by
     * {@link close}. It never rejects.
     */
    async setFabricLabel(label: string): Promise<{ pushed: Promise<void> }> {
        // matter.js resets the fabric label to this state when the behavior loads and on every commissioning.
        await this.#node.act(agent => agent.load(ControllerBehavior));
        await this.#node.setStateOf(ControllerBehavior, { adminFabricLabel: label });
        await this.#fabric.setLabel(label);
        const pushed = this.#pushFabricLabel(label).catch(error =>
            logger.warn(`Could not tell the nodes about fabric label "${label}":`, error),
        );
        return { pushed };
    }

    /**
     * Tell the currently connected nodes about a changed fabric label.
     *
     * The label the controller holds is the label, and telling the devices is best-effort: a device that
     * refuses or cannot be reached keeps its own copy stale, which is cosmetic there and reconciled the
     * next time matter.js brings that peer up in a new runtime. Failing the command instead would mean
     * unwinding the devices that did accept, which no amount of local bookkeeping can do.
     *
     * The invokes use the "conservative" network profile: a queue of its own that runs at most 4 invokes at a time,
     * whatever network the nodes are on.
     */
    async #pushFabricLabel(label: string): Promise<void> {
        this.#fabricLabelPush?.abort(new AbortedError("A newer fabric label replaced this one"));
        const abort = new Abort({ abort: this.#shutdown });
        this.#fabricLabelPush = abort;

        const connected = this.#nodes.getIds().filter(nodeId => this.#runsUpkeep(nodeId));
        const results = await Promise.allSettled(
            connected.map(async nodeId => {
                const response = (await this.#invokeCommand(
                    this.#nodes.get(nodeId),
                    {
                        endpoint: EndpointNumber(0),
                        cluster: OperationalCredentials.Cluster,
                        command: "updateFabricLabel",
                        fields: { label },
                    },
                    { network: "conservative", abort },
                )) as OperationalCredentials.NocResponse | undefined;
                if (response?.statusCode !== OperationalCredentials.NodeOperationalCertStatus.Ok) {
                    logger.notice(
                        `Node ${this.formatNode(nodeId)} kept its own fabric label; status ${response?.statusCode}`,
                    );
                }
            }),
        );

        if (this.#fabricLabelPush === abort) {
            this.#fabricLabelPush = undefined;
        }
        const aborted = abort.aborted;
        const reason: unknown = abort.reason;
        abort.close();

        const failures = results.filter(result => result.status === "rejected").map(result => result.reason);
        // A newer push tells these nodes instead, or the handler is closing; neither is a failure to report.
        if (aborted) {
            if (failures.length > 0) {
                logger.info(`Stopped telling ${failures.length} node(s) about fabric label "${label}": ${reason}`);
            }
            return;
        }
        for (const failure of failures) {
            logger.warn("Could not update the fabric label on a node:", failure);
        }
    }

    /** Current fabric label as known to matter.js. */
    getFabricLabel(): string | undefined {
        return this.#fabric.label;
    }

    /**
     * A concrete, untimed write goes through the node's state, which also updates the node data at once. A wildcard
     * endpoint or a timed write is sent as a plain Write; the node data then changes only with the next report.
     */
    async handleWriteAttribute(data: WriteAttributeRequest): Promise<AttributeResponseStatus[]> {
        const { nodeId, endpointId, clusterId, attributeId, timedInteractionTimeoutMs } = data;

        const clusterEntry = ClusterMap[clusterId];
        const attributeModel = clusterEntry?.attributes[attributeId];
        if (!clusterEntry || !attributeModel) {
            throw ServerError.invalidArguments(`Attribute ${attributeId} on cluster ${clusterId} unknown`);
        }

        const value = convertWebSocketTagBasedToMatter(data.value, attributeModel, clusterEntry.model);
        const attributeName = attributeModel.propertyName;
        logger.info(
            `Writing attribute ${clusterId}.${attributeName} (${endpointId ?? "*"}/${clusterId}/${attributeId}) with value`,
            value,
        );

        if (endpointId !== undefined && timedInteractionTimeoutMs === undefined) {
            const { status, clusterStatus } = await this.#writeAttribute(
                nodeId,
                endpointId,
                clusterId,
                attributeName,
                value,
            );
            return [{ attributeId, clusterId, endpointId, status, clusterStatus }];
        }
        if (endpointId !== undefined) {
            this.#clusterEndpoint(nodeId, endpointId, clusterEntry.model.propertyName);
        }

        const attribute = { cluster: clusterSpecifierOf(clusterEntry), attributes: attributeName, value };
        try {
            const write = Write(
                {
                    timed: timedInteractionTimeoutMs !== undefined,
                    timeout: timedInteractionTimeoutMs,
                    // A device expands a wildcard path per endpoint, which leaves list append chunks without a base.
                    chunkLists: endpointId !== undefined,
                },
                Write.Attribute(endpointId === undefined ? attribute : { ...attribute, endpoint: endpointId }),
            );
            const results = await this.#nodes.get(nodeId).interaction.write(write);

            // A chunked list write answers once per chunk; report each endpoint once, its first failure if any.
            const byEndpoint = new Map<number, AttributeResponseStatus>();
            for (const { path, status, clusterStatus } of results) {
                const known = byEndpoint.get(path.endpointId);
                if (known === undefined || (known.status === Status.Success && status !== Status.Success)) {
                    byEndpoint.set(path.endpointId, {
                        endpointId: path.endpointId,
                        clusterId: path.clusterId,
                        attributeId: path.attributeId,
                        status,
                        clusterStatus,
                    });
                }
            }
            return [...byEndpoint.values()];
        } catch (error) {
            if (!(error instanceof StatusResponseError)) {
                throw error;
            }
            if (endpointId !== undefined) {
                return [{ endpointId, clusterId, attributeId, status: error.code, clusterStatus: error.clusterCode }];
            }
            if (error instanceof ReceivedStatusResponseError) {
                throw error;
            }
            throw new ServerError(
                ServerErrorCode.InvalidArguments,
                `Invalid value for ${attributeName}: ${error.message}`,
                error,
            );
        }
    }

    async #invokeCommand<const C extends Specifier.ClusterLike>(
        node: ClientNode,
        request: Invoke.ConcreteCommandRequest<C>,
        options: InvokeOptions = {},
    ) {
        return this.#invokeOnPath(node, request, options);
    }

    /** Only groupcasts may omit the endpoint; unicast goes through {@link #invokeCommand}, whose type requires it. */
    async #invokeOnPath<const C extends Specifier.ClusterLike>(
        node: ClientNode,
        request: Invoke.CommandRequest<C>,
        options: InvokeOptions = {},
    ) {
        const { network, abort, ...definition } = options;
        const invoke = { ...invokeRequestOf({ commands: [request], ...definition }), network, abort };
        for await (const data of node.interaction.invoke(invoke)) {
            for (const entry of data) {
                // We send only one command, so we only get one response back
                switch (entry.kind) {
                    case "cmd-status":
                        if (entry.status !== Status.Success) {
                            throw ResultStatus.errorOf(entry);
                        }
                        return;

                    case "cmd-response":
                        return entry.data;
                }
            }
        }
    }

    /** Callers must have classified `nodeId` as a Group Node ID with `nodeIdTarget`. */
    async #groupFor(nodeId: NodeId): Promise<ClientNode> {
        return this.#node.peers.forAddress(this.#peerOf(nodeId));
    }

    /** Resolves once the packet is sent: no node answers. Each node's group table decides which endpoints act. */
    async handleGroupWriteAttribute(
        data: Omit<WriteAttributeRequest, "endpointId" | "timedInteractionTimeoutMs">,
    ): Promise<void> {
        const { nodeId, clusterId, attributeId } = data;

        const clusterEntry = ClusterMap[clusterId];
        const attributeModel = clusterEntry?.attributes[attributeId];
        if (!clusterEntry || !attributeModel) {
            throw ServerError.invalidArguments(`Attribute ${attributeId} on cluster ${clusterId} unknown`);
        }
        const value = convertWebSocketTagBasedToMatter(data.value, attributeModel, clusterEntry.model);
        logger.info(
            `Groupcasting write of attribute ${clusterId}.${attributeModel.propertyName} to ${this.formatNode(nodeId)} with value`,
            value,
        );

        const group = await this.#groupFor(nodeId);
        await group.interaction.write(
            Write(
                Write.Attribute({
                    cluster: clusterSpecifierOf(clusterEntry),
                    attributes: attributeModel.propertyName,
                    value,
                }),
            ),
        );
    }

    /**
     * Resolves once the packet is sent: no node answers, so there are no timeouts, and timed commands
     * cannot be groupcast. Duplicates are not coalesced: with no answer to share, the second would not be sent.
     */
    async handleGroupInvoke(
        data: Omit<InvokeRequest, "endpointId" | "timedInteractionTimeoutMs" | "interactionTimeoutMs">,
    ): Promise<void> {
        const { nodeId, clusterId } = data;
        let { data: commandData } = data;

        const clusterEntry = ClusterMap[clusterId];
        if (!clusterEntry) {
            throw ServerError.invalidArguments(`Cluster Id "${clusterId}" unknown`);
        }
        const commandName = camelize(data.commandName);
        const commandModel = clusterEntry.commands[commandName.toLowerCase()];
        if (!commandModel) {
            throw ServerError.invalidArguments(
                `Command "${commandName}" does not exist on cluster "${clusterEntry.model.propertyName}"`,
            );
        }
        if (commandModel.effectiveAccess.timed) {
            throw ServerError.invalidArguments(
                `Command "${commandName}" must be invoked as a timed request, which a groupcast cannot carry`,
            );
        }
        if (isObject(commandData)) {
            if (Object.keys(commandData).length === 0) {
                commandData = undefined;
            } else {
                commandData = convertCommandDataToMatter(commandData, commandModel, clusterEntry.model);
            }
        }

        logger.info(
            `Groupcasting command ${clusterEntry.model.propertyName}.${commandName} to ${this.formatNode(nodeId)}`,
        );

        const group = await this.#groupFor(nodeId);
        await this.#invokeOnPath(group, {
            cluster: clusterSpecifierOf(clusterEntry),
            command: commandName,
            fields: commandData,
        });
    }

    /** Checks that the node has the command and converts its fields from the WebSocket form. */
    #commandRequestOf(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        clusterId: ClusterId,
        commandName: string,
        commandData: unknown,
    ) {
        const clusterEntry = ClusterMap[clusterId];
        if (!clusterEntry) {
            throw ServerError.invalidArguments(`Cluster Id "${clusterId}" unknown`);
        }
        const clusterName = clusterEntry.model.propertyName;
        const command = camelize(commandName);
        const endpoint = this.#clusterEndpoint(nodeId, endpointId, clusterName);
        const commands = (endpoint.commands as Record<string, Record<string, unknown>>)[clusterName];
        const model = clusterEntry.commands[command.toLowerCase()];
        if (!model || !commands[command]) {
            throw ServerError.invalidArguments(`Command "${command}" does not exist on cluster "${clusterName}"`);
        }

        let fields = commandData;
        if (isObject(fields)) {
            fields =
                Object.keys(fields).length === 0
                    ? undefined
                    : convertCommandDataToMatter(fields, model, clusterEntry.model);
        }
        return { cluster: clusterSpecifierOf(clusterEntry), clusterName, command, fields };
    }

    /**
     * Sends all commands in one InvokeRequest, never split and never combined with other invokes, so a device sees
     * exactly the batch the client asked for.
     */
    async handleBatchedInvoke(data: BatchedInvokeRequest): Promise<BatchedInvokeResult> {
        const { nodeId, commands, timedInteractionTimeoutMs, interactionTimeoutMs } = data;
        if (commands.length === 0) {
            throw ServerError.invalidArguments("batched_device_commands needs at least one command");
        }
        const requests = commands.map(({ endpointId, clusterId, commandName, data }, commandRef) => {
            const { cluster, command, fields } = this.#commandRequestOf(
                nodeId,
                endpointId,
                clusterId,
                commandName,
                data,
            );
            return { endpoint: endpointId, cluster, command, fields, commandRef };
        });

        const node = this.#nodes.get(nodeId);
        const { peerAddress } = node;
        const peer = peerAddress === undefined ? undefined : this.#peers?.get(peerAddress);
        const maxPathsPerInvoke = peer?.sessionParameters.maxPathsPerInvoke ?? 1;
        if (requests.length > maxPathsPerInvoke) {
            throw ServerError.invalidArguments(
                `batched_device_commands has ${requests.length} commands, but node ${this.formatNode(nodeId)} accepts at most ${maxPathsPerInvoke} per invoke (its MaxPathsPerInvoke, 1 when it reports none)`,
            );
        }

        const invoke = invokeRequestOf({
            commands: requests,
            // `timed: false` would also drop the timed request a command requires on its own.
            ...(timedInteractionTimeoutMs !== undefined && { timed: true, timeout: timedInteractionTimeoutMs }),
            expectedProcessingTime: interactionTimeoutMs,
        });
        const answers = new Map<number | undefined, BatchedInvokeResult[number]>();
        for await (const chunk of node.interaction.invoke({ ...invoke, batchDuration: false })) {
            for (const entry of chunk) {
                answers.set(
                    entry.commandRef,
                    entry.kind === "cmd-status"
                        ? { status: entry.status, clusterStatus: entry.clusterStatus }
                        : { status: Status.Success, data: entry.data },
                );
            }
        }
        // matter.js answers every command, with NoCommandResponse for one the device left out.
        return requests.map(({ commandRef }) => {
            const answer = answers.get(commandRef);
            if (answer === undefined) {
                throw new InternalError(`No answer for command ${commandRef} of a batched invoke`);
            }
            return answer;
        });
    }

    async handleInvoke(data: InvokeRequest): Promise<unknown> {
        const {
            nodeId,
            endpointId,
            clusterId,
            timedInteractionTimeoutMs: timedRequestTimeoutMs,
            interactionTimeoutMs,
        } = data;

        const request = this.#commandRequestOf(nodeId, endpointId, clusterId, data.commandName, data.data);
        const { command: commandName, fields: commandData } = request;
        const clusterName = request.clusterName;

        // Build dedup key from validated/converted fields
        const serializedData = commandData !== undefined ? toBigIntAwareJson(commandData) : "";
        const dedupKey = `${nodeId}:${endpointId}:${clusterId}:${commandName}:${data.timedInteractionTimeoutMs ?? ""}:${data.interactionTimeoutMs ?? ""}:${serializedData}`;
        const scope = data.dedupScope ?? UNSCOPED_INVOKES;
        let inFlight = this.#inFlightInvokes.get(scope);
        if (inFlight === undefined) {
            inFlight = new Map();
            this.#inFlightInvokes.set(scope, inFlight);
        }

        // Check for in-flight duplicate
        const existing = inFlight.get(dedupKey);
        if (existing !== undefined) {
            logger.warn(
                `Duplicate command detected for ${this.formatNode(nodeId)}/${endpointId}/${clusterName}/${commandName} - coalescing with in-flight request`,
            );
            return existing;
        }

        // Execute and track the command
        const invokePromise = this.#invokeCommand(
            this.#nodes.get(nodeId),
            { endpoint: endpointId, cluster: request.cluster, command: commandName, fields: commandData },
            {
                // matter.js sends a timed request only for a non-zero timeout unless `timed` says so.
                ...(timedRequestTimeoutMs !== undefined && { timed: true, timeout: Millis(timedRequestTimeoutMs) }),
                expectedProcessingTime: interactionTimeoutMs !== undefined ? Millis(interactionTimeoutMs) : undefined,
            },
        );

        // Store the in-flight invoke immediately so concurrent requests can see it
        inFlight.set(dedupKey, invokePromise);

        // Ensure cleanup of the in-flight entry once the invoke completes
        return invokePromise.finally(() => {
            inFlight.delete(dedupKey);
        });
    }

    #determineCommissionOptions(
        data: CommissioningRequest,
        attestation: { rejected: boolean },
    ): CommissioningDiscovery.Options {
        let passcode: number | undefined = undefined;
        let shortDiscriminator: number | undefined = undefined;
        let longDiscriminator: number | undefined = undefined;
        let productId: number | undefined = undefined;
        let vendorId: VendorId | undefined = undefined;
        let deviceType: number | undefined = undefined;

        if ("manualCode" in data && data.manualCode.length > 0) {
            const pairingCodeCodec = decodeManualCode(data.manualCode);
            shortDiscriminator = pairingCodeCodec.shortDiscriminator;
            longDiscriminator = undefined;
            passcode = pairingCodeCodec.passcode;
            ({ vendorId, productId } = pairingCodeCodec);
        } else if ("qrCode" in data && data.qrCode.length > 0) {
            const pairingCodeCodec = decodeQrCode(data.qrCode);
            // TODO handle the case where multiple devices are included
            longDiscriminator = pairingCodeCodec[0].discriminator;
            shortDiscriminator = undefined;
            passcode = pairingCodeCodec[0].passcode;
            const stated = pairingCodeCodec[0];
            vendorId = stated.vendorId === undefined ? undefined : VendorId(stated.vendorId);
            productId = stated.productId;
        } else if ("passcode" in data) {
            passcode = data.passcode;
            // Check for discriminator-based discovery
            if ("shortDiscriminator" in data) {
                shortDiscriminator = data.shortDiscriminator;
            } else if ("longDiscriminator" in data) {
                longDiscriminator = data.longDiscriminator;
            } else if ("vendorId" in data) {
                vendorId = VendorId(data.vendorId);
                productId = data.productId;
            } else if ("deviceType" in data) {
                deviceType = data.deviceType;
            }
            // If none of the above, discovers any commissionable device
        } else {
            throw ServerError.invalidArguments("No pairing code provided");
        }

        if (passcode == undefined) {
            throw ServerError.invalidArguments("No passcode provided");
        }

        const { onNetworkOnly, wifiCredentials: wifiNetwork, threadCredentials: threadNetwork } = data;
        return {
            passcode,
            ...(longDiscriminator !== undefined
                ? { longDiscriminator }
                : shortDiscriminator !== undefined
                  ? { shortDiscriminator }
                  : {}),
            // Discovery searches by discriminator; matter.js uses vendor and product to pass over a device advertising others.
            ...(vendorId !== undefined ? { vendorId } : {}),
            ...(vendorId !== undefined && productId !== undefined ? { productId } : {}),
            ...(deviceType !== undefined ? { deviceType } : {}),
            discoveryCapabilities: {
                ble: this.bleEnabled && !onNetworkOnly,
                onIpNetwork: true,
            },
            nodeId: data.nodeId,
            autoSubscribe: !this.#autoSubscriptionDisabled,
            regulatoryLocation: GeneralCommissioning.RegulatoryLocationType.IndoorOutdoor,
            regulatoryCountryCode: "XX",
            wifiNetwork,
            threadNetwork,
            onAttestationFailure: (findings: AttestationFinding[]) => {
                for (const f of findings) {
                    logger.info(`Attestation finding (${f.level}):`, f.type, f.message);
                }
                const refusal = attestationRefusalOf(findings);
                attestation.rejected = refusal !== undefined;
                if (refusal === undefined) {
                    logger.info("Attestation accepted");
                    return true;
                }
                logger.notice(refusal);
                return refusal;
            },
        };
    }

    /** Commission a device whose address the caller supplied, skipping discovery. */
    async #commissionAtAddress(
        knownAddress: NonNullable<CommissioningRequest["knownAddress"]>,
        options: CommissioningDiscovery.Options,
    ): Promise<ClientNode> {
        const peer = await this.#node.peers.forDescriptor({
            addresses: [{ type: "udp", ip: knownAddress.ip, port: knownAddress.port }],
        });
        try {
            await peer.commission(options);
        } catch (error) {
            // `CommissioningClient` commits the peer address before it brings the node online, so this
            // peer — not the chosen node id — is what says whether the device joined.
            if (peer.lifecycle.isCommissioned) {
                throw error;
            }
            // A delete that fails leaves an entry behind until the expired-node cull — an address-only
            // descriptor never matches an existing node, so a retry adds another rather than reusing it.
            await peer
                .delete()
                .catch(deleteError => logger.warn("Could not remove the peer of a failed commissioning:", deleteError));
            throw new UnreachedAddressError(error);
        }
        return peer;
    }

    async commissionNode(data: CommissioningRequest): Promise<CommissioningResponse> {
        const attestation = { rejected: false };
        const options = this.#determineCommissionOptions(data, attestation);
        const { knownAddress } = data;

        let nodeId: NodeId;
        try {
            let peer: ClientNode | undefined;
            if (knownAddress !== undefined) {
                try {
                    peer = await this.#commissionAtAddress(knownAddress, options);
                } catch (error) {
                    if (!(error instanceof UnreachedAddressError)) {
                        throw error;
                    }
                    // The address is a hint from the caller and can be stale — the device may have moved
                    // to a new one since it was seen.
                    logger.info(
                        `Commissioning at the supplied address ${knownAddress.ip}:${knownAddress.port} failed, discovering the device instead:`,
                        error.cause,
                    );
                }
            }
            peer ??= await this.#node.peers.commission(
                data.discoveryTimeout === undefined ? options : { ...options, timeout: data.discoveryTimeout },
            );
            await awaitSeeded(peer, this.#shutdown);
            nodeId = nodeIdOf(peer);

            // The device has joined by now, so failing to take it into the registry is still a failed
            // command, not an unmapped throw with a node the server tracks and never announced.
            await this.#registerNode(nodeId, false);
        } catch (error) {
            throw commissionFailureOf(error, attestation.rejected);
        }

        this.events.nodeAdded.emit(nodeId);
        return { nodeId };
    }

    getCommissionerNodeId() {
        return this.#fabric.rootNodeId;
    }

    async getCommissionerFabricData(): Promise<{
        fabricId: FabricId;
        compressedFabricId: bigint;
        fabricIndex: number;
    }> {
        const { fabricId, globalId, fabricIndex } = this.#fabric;
        return {
            fabricId,
            compressedFabricId: globalId,
            fabricIndex,
        };
    }

    /** Discover commissionable devices */
    async handleDiscovery({ findBy }: DiscoveryRequest): Promise<DiscoveryResponse> {
        const discovered = await this.#node.peers.discover({
            ...(findBy ?? {}),
            timeout: Seconds(3),
            // Commissionable discovery over IP only: this command reports mDNS advertisements, and a
            // BLE-discovered instance has no address or port to report.
            discoveryCapabilities: { onIpNetwork: true },
        });

        const unique = uniqueByLastAdvertisement(discovered);
        logger.info(`Discovered ${unique.length} commissionable device(s)`);

        const devices = new Array<DiscoveryResponse[number]>();
        for (const peer of unique) {
            // The descriptor is the advertisement as received, so it carries the wire fields directly.
            const descriptor = await peer.act(agent => agent.get(CommissioningClient).descriptor);
            if (descriptor === undefined) {
                continue;
            }
            const { deviceIdentifier = "", addresses = [], DT, DN, RI, PH, PI, T, VP, SII, SAI } = descriptor;
            const discriminator = "D" in descriptor ? (descriptor.D ?? 0) : 0;
            const commissioningMode = "CM" in descriptor ? (descriptor.CM ?? 0) : 0;

            const vendorId = VP === undefined ? -1 : VP.includes("+") ? parseInt(VP.split("+")[0]) : parseInt(VP);
            const productId = VP === undefined ? -1 : VP.includes("+") ? parseInt(VP.split("+")[1]) : -1;
            const firstAddress = addresses[0];

            devices.push({
                commissioningMode,
                deviceName: DN ?? "",
                deviceType: DT ?? 0,
                hostName: "000000000000", // Right now we do not return real hostname, only used internally
                instanceName: deviceIdentifier,
                longDiscriminator: discriminator,
                numIPs: addresses.length,
                pairingHint: PH ?? -1,
                pairingInstruction: PI ?? "",
                port: firstAddress !== undefined && ServerAddress.isIp(firstAddress) ? firstAddress.port : 0,
                productId,
                rotatingId: RI ?? "",
                rotatingIdLen: RI?.length ?? 0,
                shortDiscriminator: (discriminator >> 8) & 0x0f,
                vendorId,
                supportsTcpServer: T?.tcpServer ?? false,
                supportsTcpClient: T?.tcpClient ?? false,
                addresses: addresses.filter(ServerAddress.isIp).map(({ ip }) => ip),
                mrpSessionIdleInterval: SII,
                mrpSessionActiveInterval: SAI,
            });
        }
        return devices;
    }

    async getNodeIpAddresses(nodeId: NodeId, preferCache = true) {
        const addresses = new Set<string>();
        const peer = this.#peers?.for(this.#peerOf(nodeId));
        if (peer) {
            for (const address of peer.service.addresses) {
                addresses.add(address.ip);
            }
        }
        if (!preferCache || !addresses.size) {
            // Try mDNS discovery first (like Python matter server does)
            for (const address of await this.#discoverNodeAddressesViaMdns(nodeId)) {
                addresses.add(address);
            }
        }
        if (peer) {
            const sessionIp = peer.newestSession()?.channel.networkAddress?.ip;
            if (sessionIp) {
                addresses.add(sessionIp);
            }
        }

        // Fall back to commissioning addresses from the node state if mDNS fails
        const node = this.#nodes.get(nodeId);
        const commissioningAddresses = node.maybeStateOf(CommissioningClient)?.addresses;
        if (commissioningAddresses !== undefined && commissioningAddresses.length > 0) {
            const fallbackAddresses = commissioningAddresses.filter(ServerAddress.isIp).map(addr => addr.ip);
            for (const address of fallbackAddresses) {
                addresses.add(address);
            }
        }

        return [...addresses.values()];
    }

    /**
     * Discover node IP addresses via mDNS (like Python matter server).
     * Uses 3-second timeout matching Python implementation.
     */
    async #discoverNodeAddressesViaMdns(nodeId: NodeId): Promise<string[]> {
        try {
            if (this.#peers === undefined) {
                logger.debug(`Node ${this.formatNode(nodeId)}: No PeerSet available, Controller started?`);
                return [];
            }

            const peer = this.#peers.for(this.#peerOf(nodeId));

            const abort = new Abort({ timeout: Seconds(3) });
            const names = peer.service.names;
            await names.solicitor.discover({
                abort,
                name: peer.service.name,
                recordTypes: [DnsRecordType.SRV],
            });

            const addresses = new Array<string>();
            for (const address of peer.service.addresses) {
                addresses.push(address.ip);
            }

            return addresses;
        } catch (error) {
            logger.info(`Node ${this.formatNode(nodeId)}: mDNS discovery failed`, error);
            return [];
        }
    }

    /**
     * Ping a node on all its known IP addresses.
     * @param nodeId The node ID to ping
     * @param attempts Number of ping attempts per IP (default: 1)
     * @returns A record of IP addresses to ping success status
     */
    async pingNode(nodeId: NodeId, attempts = 1): Promise<NodePingResult> {
        if (!this.#nodes.has(nodeId)) {
            throw ServerError.nodeNotExists(nodeId);
        }
        const result: NodePingResult = {};

        // Get all IP addresses for the node (fresh lookup, not cached)
        const ipAddresses = await this.getNodeIpAddresses(nodeId, false);

        if (ipAddresses.length === 0) {
            logger.info(`No IP addresses found for node ${this.formatNode(nodeId)}`);
            return result;
        }

        logger.info(`Pinging node ${this.formatNode(nodeId)} on ${ipAddresses.length} addresses:`, ipAddresses);

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
        if (this.#isConnected(nodeId)) {
            // Find any successful ping or mark the connection as reachable
            const anySuccess = Object.values(result).some(v => v);
            if (!anySuccess && ipAddresses.length > 0) {
                // Node is connected, but no pings succeeded - this can happen
                // with Thread devices or certain network configurations
                logger.info(`Node ${this.formatNode(nodeId)} is connected but no pings succeeded`);
            }
        }

        return result;
    }

    async decommissionNode(nodeId: NodeId) {
        if (!this.#nodes.has(nodeId)) {
            throw ServerError.nodeNotExists(nodeId);
        }
        const node = this.#nodes.get(nodeId);

        // A reachable device must be told to drop our fabric, or it keeps holding it and never becomes
        // commissionable again without a manual factory reset. An unreachable one cannot be told
        // anything, and attempting it costs the caller the full discovery and retry budget, so go
        // straight to the local removal for those. Without auto subscription a node is usually not connected,
        // so reachability is unknown and the device is always tried.
        let removed = false;
        if (this.#autoSubscriptionDisabled || this.#isConnected(nodeId)) {
            try {
                await node.decommission();
                removed = true;
            } catch (error) {
                logger.warn(`Decommissioning node ${this.formatNode(nodeId)} failed:`, error);
            }
        }

        if (!removed) {
            // Leaves the device holding a fabric it can only shed via factory reset; the user has to be
            // told, but the node still has to go locally or it lingers unusable.
            logger.notice(`Removing node ${this.formatNode(nodeId)} locally without contacting it`);
            await node.delete();
        }

        if (this.#cleanupNodeAfterRemoval(nodeId)) {
            this.events.nodeDecommissioned.emit(nodeId);
        }
    }

    /**
     * Drop all references to a removed node so subsequent reads don't reach a
     * destroyed node handle. Idempotent — both the `decommissioned` listener
     * (external fabric leave) and `decommissionNode` invoke it, and the
     * listener may have run first.
     */
    #cleanupNodeAfterRemoval(nodeId: NodeId): boolean {
        const wasRegistered = this.#nodes.has(nodeId);
        this.#nodeUpdateTimers.get(nodeId)?.stop();
        this.#nodeUpdateTimers.delete(nodeId);
        this.#nodeUpdateDeadlines.delete(nodeId);
        this.#nodeObservers.get(nodeId)?.close();
        this.#nodeObservers.delete(nodeId);
        this.#pendingNodeUpdates.delete(nodeId);
        this.#pendingLazyPopulate.delete(nodeId);
        this.#nodes.delete(nodeId);
        const peer = this.#peerOf(nodeId);
        this.#customClusterPoller.unregisterNode(peer);
        this.#threadDetailsPoller?.unregisterNode(peer);
        this.#timeSyncManager?.unregisterNode(peer);
        this.#availableUpdates.delete(nodeId);
        this.#webRtcProviders
            .nodeRemoved(nodeId)
            .catch(error =>
                logger.warn(`Could not drop the WebRTC sessions of removed node ${this.formatNode(nodeId)}:`, error),
            );
        return wasRegistered;
    }

    async openCommissioningWindow(data: OpenCommissioningWindowRequest): Promise<OpenCommissioningWindowResponse> {
        const { nodeId, timeout } = data;
        const node = this.#nodes.get(nodeId);
        if (timeout !== undefined && (!Number.isFinite(timeout) || timeout <= 0)) {
            throw ServerError.invalidArguments(`Commissioning window timeout must be a positive number of seconds`);
        }
        const window = await node.openEnhancedCommissioningWindow(timeout === undefined ? undefined : Seconds(timeout));
        return {
            manualCode: window.manualPairingCode,
            qrCode: window.qrPairingCode,
            passcode: window.passcode,
            discriminator: window.discriminator,
            vendorId: window.vendorId,
            productId: window.productId,
            commissioningTimeout: Seconds.of(window.commissioningTimeout),
        };
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
                    cluster: OperationalCredentials,
                    attributes: "fabrics",
                }),
            ),
            includeKnownVersions: true, // we want to read from device
        };

        for await (const chunk of node.interaction.read(read)) {
            for await (const attr of chunk) {
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

        throw ServerError.sdkStackError("No or invalid response received while querying fabrics");
    }

    removeFabric(nodeId: NodeId, fabricIndex: FabricIndex) {
        return this.#nodes.get(nodeId).commandsOf(OperationalCredentialsClient).removeFabric({ fabricIndex });
    }

    /**
     * Register this controller as an ICD Check-In client on the peer.
     * @throws {ServerError} with code IcdMultiAdmin if the peer has other-vendor administrators and
     *   `options.allowMultiAdmin` is not set.
     */
    async registerIcd(
        nodeId: NodeId,
        options: { allowMultiAdmin?: boolean; ignoredVendors?: number[] },
    ): Promise<void> {
        const node = this.#nodes.get(nodeId);
        try {
            await node.act(agent =>
                agent.get(IcdClient).register({
                    allowMultiAdmin: options.allowMultiAdmin,
                    ignoredVendors: options.ignoredVendors?.map(vendorId => VendorId(vendorId)),
                }),
            );
        } catch (error) {
            IcdMultiAdminError.accept(error);
            throw ServerError.icdMultiAdmin(error.adminVendorIds.map(vendorId => Number(vendorId)));
        }
    }

    /**
     * Drop this controller's ICD Check-In registration.
     * `force` skips the peer round-trip (for an unreachable peer) and only clears local state.
     */
    async unregisterIcd(nodeId: NodeId, force: boolean): Promise<void> {
        const node = this.#nodes.get(nodeId);
        await node.act(agent => (force ? agent.get(IcdClient).forget() : agent.get(IcdClient).unregister()));
    }

    /**
     * Drop the local ICD registration and reconnect; a LIT peer re-registers automatically once subscribed.
     * With auto subscription disabled, and not enabled for the node, only the local registration is dropped. The last
     * {@link setAutoSubscription} call for the node decides the final setting, also one made while this runs.
     */
    async resyncIcd(nodeId: NodeId): Promise<void> {
        const node = this.#nodes.get(nodeId);
        await node.act(agent => agent.get(IcdClient).forget());
        if (!this.#keepsAutoSubscription(node)) {
            return;
        }
        // Tearing the sustained subscription down and back up is what forces the re-registration.
        await node.set({ network: { autoSubscribe: false } });
        if (!this.#keepsAutoSubscription(node)) {
            return;
        }
        try {
            await node.set({ network: { autoSubscribe: true } });
        } catch (error) {
            this.#failAutoSubscribeWaiters(
                node,
                ServerError.nodeNotReady(nodeId, error instanceof Error ? error : undefined),
            );
            throw error;
        }
    }

    /**
     * Switch the server's own subscription to one node on or off. Only available with auto subscription disabled, and
     * not kept across a restart. Enabling resolves once the subscription is active and ends the node's client
     * subscriptions, because the server's subscription does not keep other subscriptions. It fails when matter.js finds
     * the device unreachable while waiting, after {@link DEFAULT_CASE_CONNECTION_TIMEOUT}, or when the node is removed,
     * switched off with this method or the handler closes. Except when switched off, the setting stays enabled and
     * matter.js keeps trying.
     */
    async setAutoSubscription(nodeId: NodeId, enabled: boolean): Promise<void> {
        if (!this.#autoSubscriptionDisabled) {
            throw ServerError.invalidArguments(
                `${enabled ? "enable" : "disable"}_auto_subscription requires the server to run with --disable-auto-subscription`,
            );
        }
        const node = this.#nodes.get(nodeId);
        this.#autoSubscribeRequested.set(node, enabled);
        if (!enabled) {
            this.#failAutoSubscribeWaiters(
                node,
                ServerError.nodeNotReady(nodeId, new Error("auto subscription was disabled while waiting")),
            );
            await node.set({ network: { autoSubscribe: false } });
            return;
        }

        let settle!: (error: Error | undefined) => void;
        const outcome = new Promise<Error | undefined>(resolve => (settle = resolve));
        let waiters = this.#autoSubscribeWaiters.get(node);
        if (waiters === undefined) {
            waiters = new Set();
            this.#autoSubscribeWaiters.set(node, waiters);
        }
        waiters.add(settle);
        const observers = new ObserverGroup();
        observers.on(node.eventsOf(NetworkClient).subscriptionStatusChanged, isActive => {
            if (isActive) {
                settle(undefined);
            }
        });
        // Only a change counts: an older unreachable mark stays until a session comes up and says nothing about now.
        observers.on(node.lifecycle.connectionStateChanged, state => {
            if (state === NodeConnectionState.WaitingForDeviceDiscovery) {
                settle(ServerError.nodeNotResolving(nodeId, new Error("the device is unreachable")));
            }
        });
        observers.on(this.events.nodeDecommissioned, removed => {
            if (removed === nodeId) {
                settle(ServerError.nodeNotExists(nodeId));
            }
        });
        const abort = new Abort({
            abort: this.#shutdown,
            timeout: DEFAULT_CASE_CONNECTION_TIMEOUT,
            timeoutHandler() {
                const timeout = Duration.format(DEFAULT_CASE_CONNECTION_TIMEOUT);
                this.abort(
                    ServerError.nodeNotReady(nodeId, new Error(`the subscription was not active within ${timeout}`)),
                );
            },
            handler: reason => settle(reason),
        });
        try {
            try {
                await node.set({ network: { autoSubscribe: true } });
            } catch (error) {
                if (this.#autoSubscribeRequested.get(node) === true) {
                    this.#autoSubscribeRequested.set(node, this.#autoSubscribes(node));
                }
                throw error;
            }
            if (await node.act(agent => agent.get(NetworkClient).subscriptionActive)) {
                settle(undefined);
            }
            const error = await outcome;
            if (error !== undefined) {
                throw error;
            }
        } finally {
            waiters.delete(settle);
            observers.close();
            abort.close();
        }
    }

    #keepsAutoSubscription(node: ClientNode) {
        return !this.#autoSubscriptionDisabled || this.#autoSubscribeRequested.get(node) === true;
    }

    #failAutoSubscribeWaiters(node: ClientNode, error: Error) {
        for (const fail of this.#autoSubscribeWaiters.get(node) ?? []) {
            fail(error);
        }
    }

    async getIcdState(nodeId: NodeId): Promise<IcdStateData> {
        const node = this.#nodes.get(nodeId);
        const icdManagementState = node.maybeStateOf(IcdManagementClient);
        if (icdManagementState === undefined) {
            return {
                supported: false,
                lit_supported: false,
                registered: false,
                operating_mode: null,
                awake: null,
                available: null,
                next_expected_checkin: null,
            };
        }

        return node.act(agent => {
            const icd = agent.get(IcdClient);
            return {
                supported: true,
                lit_supported: icd.peerSupportsLit,
                registered: icd.isRegistered,
                operating_mode: icdManagementState.operatingMode === IcdManagement.OperatingMode.Lit ? "LIT" : "SIT",
                // upstream d.ts types the awake getter as `any`; pin to boolean for the wire
                awake: icd.awake === true,
                available: icd.state.available,
                next_expected_checkin: icd.nextExpectedCheckin !== undefined ? Number(icd.nextExpectedCheckin) : null,
            };
        });
    }

    /**
     * Fabric index assigned to this controller on the peer.
     * Some peers reject the NO_FABRIC (0) sentinel inside fabric-scoped list entries
     * even though the spec allows server-side auto-fill, so we send the resolved index.
     */
    #currentFabricIndex(nodeId: NodeId): FabricIndex {
        const state = this.#nodes.get(nodeId).maybeStateOf(OperationalCredentialsClient);
        return state?.currentFabricIndex ?? FabricIndex.NO_FABRIC;
    }

    /**
     * Set Access Control List entries on a node.
     * Writes to the ACL attribute on the AccessControl cluster (endpoint 0).
     */
    async setAclEntry(nodeId: NodeId, entries: AccessControlEntry[]): Promise<AttributeWriteResult[] | null> {
        const fabricIndex = this.#currentFabricIndex(nodeId);
        const aclEntries: AccessControl.AccessControlEntry[] = entries.map(entry => ({
            privilege: entry.privilege,
            authMode: entry.auth_mode,
            subjects: entry.subjects?.map(s => NodeId(BigInt(s))) ?? null,
            targets:
                entry.targets?.map((t: AccessControlTarget) => ({
                    cluster: t.cluster !== null ? ClusterId(t.cluster) : null,
                    endpoint: t.endpoint !== null ? EndpointNumber(t.endpoint) : null,
                    deviceType: t.device_type !== null ? DeviceTypeId(t.device_type) : null,
                })) ?? null,
            fabricIndex,
        }));

        // A node always has access to itself, so an ACL entry naming the node's own id as a subject
        // (a "self-ACL") is meaningless. Strip such subjects (and drop entries left with none) rather
        // than write them to the device, but still report success to the caller.
        const nodeKey = nodeId.toString();
        let selfRemoved = false;
        const filteredEntries = aclEntries
            .map(entry => {
                if (!entry.subjects) return entry;
                const subjects = entry.subjects.filter(s => s.toString() !== nodeKey);
                if (subjects.length === entry.subjects.length) return entry;
                selfRemoved = true;
                return subjects.length > 0 ? { ...entry, subjects } : undefined;
            })
            .filter((entry): entry is AccessControl.AccessControlEntry => entry !== undefined);
        if (selfRemoved) {
            logger.warn(
                `ACL for node ${nodeId} named the node's own id as a subject (self-ACL); a node always has access to itself, so those subjects are not written to the device. Reporting success.`,
            );
        }

        logger.info("Setting ACL entries", filteredEntries);

        const { status } = await this.#writeAttribute(
            nodeId,
            EndpointNumber(0),
            AccessControl.id,
            "acl",
            filteredEntries,
        );
        return [
            {
                path: { endpoint_id: 0, cluster_id: AccessControl.id, attribute_id: 0 },
                status,
            },
        ];
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
        const fabricIndex = this.#currentFabricIndex(nodeId);
        const bindingEntries: Binding.Target[] = bindings.map(binding => ({
            node: binding.node !== null ? NodeId(binding.node) : undefined,
            group: binding.group !== null ? GroupId(binding.group) : undefined,
            endpoint: binding.endpoint !== null ? EndpointNumber(binding.endpoint) : undefined,
            cluster: binding.cluster !== null ? ClusterId(binding.cluster) : undefined,
            fabricIndex,
        }));

        logger.info("Setting bindings on endpoint", endpointId, bindingEntries);

        const { status } = await this.#writeAttribute(nodeId, endpointId, Binding.id, "binding", bindingEntries);
        return [
            {
                path: { endpoint_id: endpointId, cluster_id: Binding.id, attribute_id: 0 },
                status,
            },
        ];
    }

    /**
     * Check if a software update is available for a node.
     * First checks the cached updates from OTA events, then queries the DCL if not found.
     */
    async checkNodeUpdate(nodeId: NodeId): Promise<MatterSoftwareVersion | null> {
        if (!this.#otaEnabled) {
            throw ServerError.updateCheckError("OTA is disabled");
        }
        // First check if we have a cached update from the updateAvailable event
        const cachedUpdate = this.#availableUpdates.get(nodeId);
        if (cachedUpdate) {
            return this.#convertToMatterSoftwareVersion(cachedUpdate);
        }

        // No cached update, query the OTA provider
        const node = this.#nodes.get(nodeId);

        try {
            const otaProvider = this.#otaProvider;
            if (!otaProvider) {
                logger.info("OTA provider not available");
                return null;
            }

            // Query OTA provider for updates using dynamic behavior access
            const updatesAvailable = await otaProvider.act(agent =>
                agent.get(SoftwareUpdateManager).queryUpdates({
                    peerToCheck: node,
                    includeStoredUpdates: true,
                }),
            );

            // Find update for this specific node
            const peerAddress = this.#peerOf(nodeId);
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
            logger.warn(`Failed to check for updates for node ${this.formatNode(nodeId)}:`, error);
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
            throw ServerError.updateError("OTA is disabled");
        }
        if (!this.#nodes.has(nodeId)) {
            throw ServerError.nodeNotExists(nodeId);
        }
        if (!this.#nodes.isAvailable(nodeId)) {
            throw ServerError.updateError(`Node ${this.formatNode(nodeId)} is not connected. Retry later`);
        }

        // Check if node is already updating by checking the OTA Requestor UpdateState attribute
        // Attribute path: 0/42/2 (endpoint 0, OtaSoftwareUpdateRequestor cluster, UpdateState attribute)
        // UpdateState 1 = Idle, anything else means update in progress
        const cachedAttributes = this.#nodes.attributeCache.get(nodeId);
        const updateState = cachedAttributes?.["0/42/2"];
        if (updateState !== undefined && updateState !== 1) {
            throw ServerError.updateError(
                `Node ${this.formatNode(nodeId)} is already in the process of updating (state: ${updateState})`,
            );
        }

        const otaProvider = this.#otaProvider;
        if (!otaProvider) {
            throw ServerError.updateError("OTA provider not available");
        }

        let updateInfo = this.#availableUpdates.get(nodeId);
        if (!updateInfo) {
            const result = await this.checkNodeUpdate(nodeId);
            if (!result) {
                throw ServerError.updateError("No update available for this node");
            }
            updateInfo = this.#availableUpdates.get(nodeId);
            if (!updateInfo) {
                throw ServerError.updateError("Failed to get update info");
            }
        }

        logger.info(`Starting update for node ${this.formatNode(nodeId)} to version ${softwareVersion}`);

        await otaProvider.act(agent =>
            agent.get(SoftwareUpdateManager).forceUpdate(this.#peerOf(nodeId), {
                vendorId: updateInfo.vendorId,
                productId: updateInfo.productId,
                targetSoftwareVersion: softwareVersion,
            }),
        );

        return this.#convertToMatterSoftwareVersion(updateInfo);
    }

    /**
     * Drop cached update info for a vendor/product, so a newly stored image is seen by the next
     * `check_node_update` instead of the answer cached before it existed.
     */
    invalidateAvailableUpdates(vendorId: number, productId: number) {
        for (const [nodeId, update] of this.#availableUpdates) {
            if (update.vendorId === vendorId && update.productId === productId) {
                this.#availableUpdates.delete(nodeId);
            }
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
