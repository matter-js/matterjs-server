/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { redactSensitiveCommandFields } from "@matter-server/ws-client";
import {
    MatterError,
    Diagnostic,
    Bytes,
    camelize,
    ClusterId,
    FabricIndex,
    Logger,
    LogLevel,
    Millis,
    NodeConnectionState,
    NodeId,
    ObserverGroup,
} from "@matter/main";
import { WebRtcTransportProvider } from "@matter/main/clusters";
import { ControllerCommissioningFlowOptions, OperationalDataset } from "@matter/main/protocol";
import { EndpointNumber } from "@matter/main/types";
import { WebSocketServer } from "ws";
import type { CameraSignallingCommandName } from "../camera/cameraCommands.js";
import {
    parseCapabilitiesArgs,
    parseReleaseStreamArgs,
    parseSignallingArgs,
    parseSnapshotArgs,
    parseStartStreamArgs,
    parseStopStreamArgs,
    parseTargetIds,
    requireArgumentObject,
    toWireCapabilities,
    toWireSnapshotResult,
    toWireStartStreamResult,
} from "../camera/cameraCommands.js";
import {
    establishesWebRtcSession,
    isProviderCommandName,
    PROVIDER_COMMAND_NAMES,
    toProviderCommandFields,
} from "../camera/webRtcProviderArguments.js";
import { rejectUnknownKeys } from "../camera/wireArgumentChecks.js";
import { ControllerCommandHandler } from "../controller/ControllerCommandHandler.js";
import { MatterController, registerThreadCredentialsFromHex } from "../controller/MatterController.js";
import type { TopologyNodeSource } from "../controller/NetworkTopologyService.js";
import { TestNodeCommandHandler } from "../controller/TestNodeCommandHandler.js";
import { dropWebRtcSessionTracking, invokeEndSession } from "../controller/webRtcSessionTracking.js";
import { VendorIds } from "../data/VendorIDs.js";
import { ClusterMap, ClusterMapEntry } from "../model/ModelMapper.js";
import { CommissioningRequest } from "../types/CommandHandler.js";
import { HttpServer, WebServerHandler } from "../types/WebServer.js";
import {
    ArgsOf,
    ErrorResultMessage,
    EventTypes,
    LogLevelString,
    SettableLogLevelString,
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
import { nodeIdTarget } from "../util/nodeIdClasses.js";
import { ConfigStorage } from "./ConfigStorage.js";
import { nextConnectionLogTag, nextConnectionOwnerId } from "./connectionIdentity.js";
import {
    convertMatterToWebSocketNameBased,
    convertMatterToWebSocketTagBased,
    parseBigIntAwareJson,
    splitAttributePath,
    toBigIntAwareJson,
} from "./Converters.js";
import { serializeBatch } from "./serializeBatch.js";
import { WebSocketConnection } from "./WebSocketConnection.js";

const logger = Logger.get("WebSocketControllerHandler");

/** Maximum number of commissioning attempts when the chosen node id keeps colliding on the fabric. */
const MAX_COMMISSION_NODE_ID_ATTEMPTS = 5;

/** Whether an error (or any error in its cause chain) is a matter.js node id collision. */
function isIdentityConflict(error: unknown): boolean {
    for (let current: unknown = error; current instanceof Error; current = current.cause) {
        if (current instanceof MatterError && current.id === "identity-conflict") {
            return true;
        }
    }
    return false;
}

/** Maximum number of events to keep in the history buffer */
const EVENT_HISTORY_SIZE = 25;

const SCHEMA_VERSION = 14;
const MIN_SUPPORTED_SCHEMA_VERSION = 11;

// Issuing any of these (schema 12) proves the connection is Thread-aware, so it opts the connection
// in to `thread_diagnostics_updated` — even if the request itself errors. See the schema changelog.
const THREAD_DIAGNOSTICS_OPT_IN_COMMANDS = new Set(["get_thread_diagnostics", "get_thread_border_routers"]);

// Issuing this (schema 13) opts the connection in to `network_topology_updated`, mirroring the
// thread-diagnostics opt-in: pre-schema-13 clients never subscribed, so they must not receive it.
const NETWORK_TOPOLOGY_OPT_IN_COMMANDS = new Set(["get_network_topology"]);

// Commands that opt the connection in to `webrtc_callback`. Owned sessions are routed to their owner;
// this set decides who receives signalling for a session no record names.
const WEBRTC_OPT_IN_COMMANDS = new Set([
    "send_webrtc_provider_command",
    "camera_start_stream",
    "camera_provide_answer",
    "camera_provide_ice_candidates",
]);

// Any camera command (schema 14) opts the connection in to camera_session_ended and
// camera_stream_evicted. Evictions go to every opted-in connection: no record says who holds a stream.
const CAMERA_OPT_IN_COMMANDS = new Set([
    "send_webrtc_provider_command",
    "camera_get_capabilities",
    "camera_start_stream",
    "camera_stop_stream",
    "camera_snapshot",
    "camera_release_stream",
    "camera_provide_answer",
    "camera_provide_ice_candidates",
]);

/** Any other key is refused, like unknown `payload` keys. */
const SEND_PROVIDER_ARG_KEY_SET: Record<keyof Required<ArgsOf<"send_webrtc_provider_command">>, true> = {
    node_id: true,
    endpoint_id: true,
    command_name: true,
    payload: true,
};

const SEND_PROVIDER_ARG_KEYS: readonly string[] = Object.keys(SEND_PROVIDER_ARG_KEY_SET);

// Responses the debug log omits: large ones, and open_commissioning_window, whose setup passcode
// nothing else redacts (redactSensitiveCommandFields covers request args only).
const skipMessageContentInLogFor = [
    "start_listening",
    "get_network_topology",
    "camera_snapshot",
    "open_commissioning_window",
];

/**
 * Absent or `null` `args` mean no arguments, as in the Python Matter Server (`parse_arguments`,
 * `matter_server/common/helpers/api.py`). Any other non-object is refused with error 8.
 */
function commandArguments(args: unknown, command: string): Record<string, unknown> {
    return args === undefined || args === null ? {} : requireArgumentObject(args, command);
}

/** Normalize a requested fabric label: matter.js requires a non-empty label of 1-32 chars. */
function normalizeFabricLabel(label: string | null): string {
    const trimmed = label?.trim();
    return (trimmed && trimmed !== "" ? trimmed : "HomeAssistant").substring(0, 32);
}

/**
 * Pull the WebRTCSessionID out of an EndSession payload, tolerant of wire key spellings. The payload
 * comes from {@link parseBigIntAwareJson}, so a large id arrives as a bigint; accept a non-negative
 * integer of either type and normalize to number (session ids are well within the safe range).
 */
function extractWebRtcSessionId(payload: unknown): number | undefined {
    if (typeof payload !== "object" || payload === null) return undefined;
    // Must use the same camelize the invoke normalized the payload with.
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
        if (camelize(key) !== "webRtcSessionId") continue;
        if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
            return value;
        }
        if (typeof value === "bigint" && value >= 0n && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
            return Number(value);
        }
    }
    return undefined;
}

const WRITE_WILDCARD_REFUSAL = "write_attribute does not support wildcards in attribute path";

/** WebSocket Server compatible with Schema version 12, minimum supported 11 */
export class WebSocketControllerHandler implements WebServerHandler {
    #controller: MatterController;
    #commandHandler: ControllerCommandHandler;
    #testNodeHandler: TestNodeCommandHandler;
    /** Stable identity: NetworkTopologyService.addNodeSource dedupes registrations by source object. */
    #testNodeSource: TopologyNodeSource;
    #config: ConfigStorage;
    #serverVersion: string;
    #wss?: WebSocketServer;
    #closed = false;
    #shuttingDown = false;
    /** Upgrade listener removers, one per HTTP server `register()` call (multi-bind). */
    #removeUpgradeListeners: (() => void)[] = [];
    /** Circular buffer for recent node events (max 25) */
    #eventHistory: MatterNodeEvent[] = [];
    /** Track when each node was last interviewed (connected) - keyed by nodeId */
    #lastInterviewDates = new Map<NodeId, Date>();
    /** Backpressure-managed send path per open connection; also the fan-out target for broadcasts. */
    #connections = new Set<WebSocketConnection>();
    /**
     * Connection that claimed the fabric label this session by issuing the first `set_default_fabric_label`.
     * While it stays connected, other connections' set requests are ignored, so two clients can't overwrite
     * each other's label. Released when the owning connection closes. Superseded by the CLI pin.
     *
     * Keyed on the connection object (not its short, recycled connId) so a wrapped-around id can't inherit
     * or release another connection's claim.
     */
    #fabricLabelOwner?: WebSocketConnection;

    constructor(controller: MatterController, config: ConfigStorage, serverVersion: string) {
        this.#controller = controller;
        this.#commandHandler = controller.commandHandler;
        this.#testNodeHandler = new TestNodeCommandHandler();
        this.#testNodeSource = {
            listNodes: () => this.#testNodeHandler.getNodes(),
            nodeAdded: this.#testNodeHandler.nodeAdded,
            nodeRemoved: this.#testNodeHandler.nodeRemoved,
        };
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
     * Refuses a Node ID class that can never name one node with error 8, not `NODE_NOT_EXISTS`.
     * Multicast-capable routes use {@link #targetNodeIdOrGroup}.
     */
    #targetNodeId(nodeId: number | bigint, command: string): NodeId {
        const target = NodeId(nodeId);
        const classified = nodeIdTarget(target);
        if (classified.kind !== "node") {
            throw ServerError.invalidArguments(
                `${command} cannot address ${classified.className}: node_id must name one node`,
            );
        }
        return target;
    }

    /**
     * For `write_attribute` and `device_command`, the only routes that can multicast. `group` selects the
     * multicast path, which takes no endpoint and gets no answer.
     */
    #targetNodeIdOrGroup(nodeId: number | bigint, command: string): { nodeId: NodeId; group: boolean } {
        const target = NodeId(nodeId);
        const classified = nodeIdTarget(target);
        if (classified.kind === "unusable") {
            throw ServerError.invalidArguments(
                `${command} cannot address ${classified.className}: node_id must name one node or one group`,
            );
        }
        return { nodeId: target, group: classified.kind === "group" };
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

    initiateShutdown(): void {
        this.#shuttingDown = true;
    }

    async register(server: HttpServer) {
        logger.notice(`Starting server: matter-server/${this.#serverVersion} (matter.js/${MATTER_VERSION})`);
        // Use noServer mode with a path-filtered upgrade listener.
        // ws 8.x calls handleUpgrade unconditionally from its own upgrade listener, which
        // sends HTTP 400 for non-matching paths and destroys the socket — breaking other
        // WebSocket endpoints on the same server. By handling upgrade ourselves we only
        // call handleUpgrade when the path actually matches.
        //
        // Reuse a single WSS across all bound HTTP servers (multi-listen-address): create
        // it once, then attach a per-server upgrade listener that forwards into it. That
        // keeps `broadcast`, `unregister`, and the connection bookkeeping consistent.
        const isFirstBind = this.#wss === undefined;
        const wss = (this.#wss ??= new WebSocketServer({ noServer: true }));
        const upgradeHandler = (
            req: { url?: string; _matterHandledUpgrade?: boolean },
            socket: unknown,
            head: unknown,
        ) => {
            const path = req.url?.split("?")[0];
            if (path === "/ws") {
                req._matterHandledUpgrade = true;
                wss.handleUpgrade(
                    req as Parameters<typeof wss.handleUpgrade>[0],
                    socket as Parameters<typeof wss.handleUpgrade>[1],
                    head as Parameters<typeof wss.handleUpgrade>[2],
                    ws => wss.emit("connection", ws, req),
                );
            }
        };
        server.on("upgrade", upgradeHandler);
        this.#removeUpgradeListeners.push(() => server.removeListener("upgrade", upgradeHandler));

        if (!isFirstBind) {
            // Connection + observer wiring below is shared state; only attach once across binds.
            return;
        }

        wss.on("connection", (ws, req: { socket?: { remoteAddress?: string } }) => {
            if (this.#closed || this.#shuttingDown) {
                try {
                    ws.close(1001, "server shutting down");
                } catch {
                    // ignore
                }
                return;
            }

            const connId = nextConnectionLogTag();
            const ownerId = nextConnectionOwnerId();
            logger.info(`[${connId}] WebSocket connection established`);

            let listening = false;
            // thread_diagnostics_updated (schema 12) is sent only to connections that have issued a
            // Thread request, so schema-11 clients (all currently deployed HA installs) never receive an
            // event type they'd crash on. See the schema changelog. network_topology_updated (schema 13)
            // and the camera events are withheld the same way.
            const optIns = { threadDiagnostics: false, webRtc: false };
            let topologyObserverRegistered = false;
            let cameraObserversRegistered = false;
            const observers = new ObserverGroup();
            const connection = new WebSocketConnection(ws, {
                connId,
                getNodeCount: () => this.#commandHandler.getNodeIds().length,
            });
            this.#connections.add(connection);

            // Builds a full node snapshot frame lazily, at actual send time, so coalesced-away updates
            // never pay the (heavy) collect cost and a trailing update for a removed node is skipped.
            const buildNodeDetailsFrame = (
                eventName: "node_added" | "node_updated",
                nodeId: NodeId,
            ): string | undefined => {
                try {
                    const nodeDetails = this.#collectNodeDetails(nodeId);
                    logger.debug(
                        `[${connId}] Sending ${eventName} event for Node ${this.#commandHandler.formatNode(nodeId)}`,
                    );
                    return toBigIntAwareJson({ event: eventName, data: nodeDetails });
                } catch (err) {
                    logger.error(
                        `[${connId}] Failed to collect node details for Node ${this.#commandHandler.formatNode(nodeId)}`,
                        err,
                    );
                    return undefined;
                }
            };
            const sendNodeFullDetails = (eventName: "node_added" | "node_updated", nodeId: NodeId) => {
                // node_updated coalesces per node (bursts collapse to the latest snapshot under
                // backpressure); node_added must not be coalesced away, so it is an ordered send.
                if (eventName === "node_updated") {
                    connection.sendCoalescable(`node:${nodeId}`, () => buildNodeDetailsFrame(eventName, nodeId));
                } else {
                    const frame = buildNodeDetailsFrame(eventName, nodeId);
                    if (frame !== undefined) connection.sendOrdered(frame);
                }
            };

            // node_updated can be triggered several times for one logical change (availability +
            // structure + a lazy populate completing all fire in the same tick). Coalesce per node so
            // each burst sends a single full snapshot rather than several large duplicates per client.
            const pendingNodeUpdated = new Set<NodeId>();
            let nodeUpdatedFlushScheduled = false;
            const flushNodeUpdated = () => {
                nodeUpdatedFlushScheduled = false;
                const nodeIds = [...pendingNodeUpdated];
                pendingNodeUpdated.clear();
                if (this.#closed || this.#shuttingDown || !listening || connectionClosed) return;
                for (const nodeId of nodeIds) {
                    // A trailing update can be queued after the node was removed; skip it instead of
                    // letting #collectNodeDetails throw nodeNotExists and log a spurious error.
                    if (!this.#commandHandler.hasNode(nodeId)) continue;
                    sendNodeFullDetails("node_updated", nodeId);
                }
            };

            // python-matter-server wire contract: the node_updated carrying a new endpoint must reach
            // the client before endpoint_added announces it, or a client that resolves the endpoint
            // against its own node model does not know it yet.
            const flushNodeUpdatedFor = (nodeId: NodeId) => {
                if (!pendingNodeUpdated.delete(nodeId)) return;
                if (this.#closed || this.#shuttingDown || !listening || connectionClosed) return;
                if (!this.#commandHandler.hasNode(nodeId)) return;
                sendNodeFullDetails("node_updated", nodeId);
            };

            const sendNodeDetailsEvent = <E extends EventTypes>(eventName: E, nodeId: NodeId) => {
                if (this.#closed || this.#shuttingDown || !listening) return;

                switch (eventName) {
                    case "node_added":
                        // node_added carries the full snapshot, so it supersedes any pending coalesced
                        // update and must not be overtaken by the deferred flush.
                        pendingNodeUpdated.delete(nodeId);
                        sendNodeFullDetails("node_added", nodeId);
                        break;
                    case "node_updated":
                        pendingNodeUpdated.add(nodeId);
                        if (!nodeUpdatedFlushScheduled) {
                            nodeUpdatedFlushScheduled = true;
                            setImmediate(flushNodeUpdated);
                        }
                        break;
                    case "node_removed":
                        pendingNodeUpdated.delete(nodeId);
                        logger.debug(
                            `[${connId}] Sending node_removed event for Node ${this.#commandHandler.formatNode(nodeId)}`,
                        );
                        connection.sendOrdered(toBigIntAwareJson({ event: eventName, data: nodeId }));
                        break;
                }
            };

            // Register all event listeners using ObserverGroup for easy cleanup
            observers.on(this.#commandHandler.events.attributeChanged, (nodeId, data) => {
                if (this.#closed || this.#shuttingDown || !listening) return;
                const { endpointId, clusterId, attributeId } = data.path;
                const pathStr = `${endpointId}/${clusterId}/${attributeId}`;
                // `data` is emitter-owned; snapshot the value before deferring. Coalesce latest-wins
                // per (node, path) and convert lazily so a superseded value is never converted.
                const rawValue = data.value;
                // Shared Observable: an uncaught throw here aborts the emit and starves other connections.
                try {
                    connection.sendCoalescable(`attr:${nodeId}/${pathStr}`, () => {
                        const clusterData = ClusterMap[clusterId];
                        const value = convertMatterToWebSocketTagBased(
                            rawValue,
                            clusterData?.attributes[attributeId],
                            clusterData?.model,
                        );
                        logger.debug(
                            `[${connId}] Sending attribute_updated event for Node ${this.#commandHandler.formatNode(nodeId)}`,
                            pathStr,
                            value,
                        );
                        return toBigIntAwareJson({ event: "attribute_updated", data: [nodeId, pathStr, value] });
                    });
                } catch (err) {
                    logger.error(
                        `[${connId}] Failed to send attribute_updated for Node ${this.#commandHandler.formatNode(nodeId)} ${pathStr}`,
                        err,
                    );
                }
            });

            observers.on(this.#commandHandler.events.eventChanged, (nodeId, data) => {
                if (this.#closed || this.#shuttingDown || !listening) return;
                const { path, events } = data;
                const { endpointId, clusterId, eventId } = path;
                const clusterData = ClusterMap[clusterId];

                for (const event of events) {
                    // Shared Observable: an uncaught throw aborts the emit and starves other connections;
                    // per event so one bad payload doesn't drop the rest of the batch.
                    try {
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

                        const eventModel = clusterData?.events[eventId];
                        const convertedData =
                            event.data !== undefined
                                ? convertMatterToWebSocketNameBased(event.data, eventModel, clusterData?.model)
                                : null;

                        const nodeEvent: MatterNodeEvent = {
                            node_id: nodeId,
                            endpoint_id: endpointId,
                            cluster_id: clusterId,
                            event_id: eventId,
                            event_number: event.eventNumber,
                            priority: event.priority,
                            timestamp,
                            timestamp_type: timestampType,
                            data: convertedData,
                        };

                        this.#addEventToHistory(nodeEvent);

                        logger.debug(
                            `[${connId}] Sending node_event for Node ${this.#commandHandler.formatNode(nodeId)}`,
                            nodeEvent,
                        );
                        connection.sendOrdered(toBigIntAwareJson({ event: "node_event", data: nodeEvent }));
                    } catch (err) {
                        logger.error(
                            `[${connId}] Failed to send node_event for Node ${this.#commandHandler.formatNode(nodeId)}`,
                            err,
                        );
                    }
                }
            });

            observers.on(this.#commandHandler.events.nodeAdded, nodeId => {
                sendNodeDetailsEvent("node_added", nodeId);
            });

            observers.on(this.#commandHandler.events.nodeStateChanged, (nodeId, state) => {
                // Track last interview time when node becomes connected
                if (state === NodeConnectionState.Connected) {
                    this.#lastInterviewDates.set(nodeId, new Date());
                }
                // Availability changes (and node_updated events) are handled by nodeAvailabilityChanged
                // Individual attribute updates are already sent via attributeChanged events
            });

            // Send node_updated when availability changes (debounced)
            observers.on(this.#commandHandler.events.nodeAvailabilityChanged, (nodeId, available) => {
                logger.info(
                    `[${connId}] Node ${this.#commandHandler.formatNode(nodeId)} availability changed to ${available}`,
                );
                sendNodeDetailsEvent("node_updated", nodeId);
            });

            observers.on(this.#commandHandler.events.nodeStructureChanged, nodeId => {
                sendNodeDetailsEvent("node_updated", nodeId);
            });

            observers.on(this.#commandHandler.events.nodeDecommissioned, nodeId => {
                sendNodeDetailsEvent("node_removed", nodeId);
            });

            observers.on(this.#commandHandler.events.nodeEndpointAdded, (nodeId, endpointId) => {
                if (this.#closed || this.#shuttingDown || !listening) return;
                flushNodeUpdatedFor(nodeId);
                logger.info(
                    `[${connId}] Sending endpoint_added event for Node ${this.#commandHandler.formatNode(nodeId)} endpoint ${endpointId}`,
                );
                connection.sendOrdered(
                    toBigIntAwareJson({ event: "endpoint_added", data: { node_id: nodeId, endpoint_id: endpointId } }),
                );
            });

            observers.on(this.#commandHandler.events.nodeEndpointRemoved, (nodeId, endpointId) => {
                if (this.#closed || this.#shuttingDown || !listening) return;
                logger.info(
                    `[${connId}] Sending endpoint_removed event for Node ${this.#commandHandler.formatNode(nodeId)} endpoint ${endpointId}`,
                );
                connection.sendOrdered(
                    toBigIntAwareJson({
                        event: "endpoint_removed",
                        data: { node_id: nodeId, endpoint_id: endpointId },
                    }),
                );
            });

            // Register test node event listeners
            observers.on(this.#testNodeHandler.nodeAdded, (_nodeId, testNode) => {
                if (this.#closed || this.#shuttingDown || !listening) return;
                logger.info(`[${connId}] Sending node_added event for test node ${testNode.node_id}`);
                connection.sendOrdered(toBigIntAwareJson({ event: "node_added", data: testNode }));
            });

            observers.on(this.#testNodeHandler.nodeRemoved, nodeId => {
                if (this.#closed || this.#shuttingDown || !listening) return;
                logger.info(`[${connId}] Sending node_removed event for test node ${formatNodeId(nodeId)}`);
                connection.sendOrdered(toBigIntAwareJson({ event: "node_removed", data: nodeId }));
            });

            observers.on(this.#controller.threadDiagnostics.events.batchUpdated, batch => {
                if (this.#closed || this.#shuttingDown || !optIns.threadDiagnostics) return;
                // batchUpdated is a shared Observable; a throw here would abort emit and starve other
                // connections' observers, so isolate the serialize/send per connection. Coalesce
                // latest-wins per Thread network — an older diagnostics snapshot is worthless — and
                // serialize lazily so a superseded batch is never serialized.
                try {
                    connection.sendCoalescable(`thread:${batch.extPanIdHex}`, () =>
                        toBigIntAwareJson({
                            event: "thread_diagnostics_updated",
                            data: serializeBatch(batch, this.#controller.threadDiagnostics.remainingTtl(batch)),
                        }),
                    );
                } catch (err) {
                    logger.error(`[${connId}] Failed to send thread_diagnostics_updated`, err);
                }
            });

            // Registered lazily on first opt-in: touching the networkTopology getter here would
            // instantiate the service (timers, event subscriptions) for every connection, even
            // ones that never request topology.
            const ensureTopologyObserver = () => {
                if (topologyObserverRegistered || this.#closed || this.#shuttingDown) return;
                topologyObserverRegistered = true;
                observers.on(this.#controller.networkTopology.events.topologyUpdated, topology => {
                    if (this.#closed || this.#shuttingDown) return;
                    // topologyUpdated is a shared Observable; isolate serialize/send per connection so a
                    // throw here can't starve other connections. The graph is global (not per-network), so
                    // coalesce latest-wins under a single key — an older snapshot is worthless.
                    try {
                        connection.sendCoalescable("network_topology", () =>
                            toBigIntAwareJson({ event: "network_topology_updated", data: topology }),
                        );
                    } catch (err) {
                        logger.error(`[${connId}] Failed to send network_topology_updated`, err);
                    }
                });
            };

            const ensureCameraObservers = () => {
                if (cameraObserversRegistered || this.#closed || this.#shuttingDown) return;
                // Set the flag only after the getter: it can throw, and a set flag would never retry.
                const camera = this.#controller.cameraStreams;
                cameraObserversRegistered = true;
                observers.on(camera.events.sessionEnded, ended => {
                    if (this.#closed || this.#shuttingDown) return;
                    // Skip the requester (it has its response) and non-owners; ownerless ends go to all.
                    if (ended.requestedBy === ownerId) return;
                    if (ended.ownerId !== undefined && ended.ownerId !== ownerId) return;
                    // Shared Observable: an uncaught throw here aborts the emit and starves other connections.
                    try {
                        connection.sendReliable(
                            toBigIntAwareJson({
                                event: "camera_session_ended",
                                data: {
                                    node_id: ended.nodeId,
                                    endpoint_id: ended.endpointId,
                                    webrtc_session_id: ended.webRtcSessionId,
                                },
                            }),
                        );
                    } catch (err) {
                        logger.error(`[${connId}] Failed to send camera_session_ended`, err);
                    }
                });
                observers.on(camera.events.streamEvicted, evicted => {
                    if (this.#closed || this.#shuttingDown) return;
                    try {
                        connection.sendReliable(
                            toBigIntAwareJson({
                                event: "camera_stream_evicted",
                                data: {
                                    node_id: evicted.nodeId,
                                    endpoint_id: evicted.endpointId,
                                    kind: evicted.kind,
                                    stream_id: evicted.streamId,
                                },
                            }),
                        );
                    } catch (err) {
                        logger.error(`[${connId}] Failed to send camera_stream_evicted`, err);
                    }
                });
            };

            observers.on(this.#commandHandler.events.webRtcCallback, data => {
                if (this.#closed || this.#shuttingDown || !optIns.webRtc) return;
                // WebRTC signaling is control-plane: never coalesced or dropped, so send reliably.
                try {
                    const owners = this.#controller.cameraStreamsIfCreated?.signallingOwners(
                        NodeId(data.node_id),
                        EndpointNumber(data.endpoint_id),
                        data.webrtc_session_id,
                    );
                    // Ownerless sessions go to every opted-in connection; withholding would strand them.
                    if (owners !== undefined && !owners.has(ownerId)) return;
                    connection.sendReliable(toBigIntAwareJson({ event: "webrtc_callback", data }));
                } catch (err) {
                    logger.error(`[${connId}] Failed to send webrtc_callback`, err);
                }
            });

            let connectionClosed = false;
            const onClose = () => {
                if (connectionClosed) {
                    return;
                }
                connectionClosed = true;
                pendingNodeUpdated.clear();
                logger.info(`[${connId}] WebSocket connection closed`);
                observers.close();
                this.#connections.delete(connection);
                this.#controller.cameraStreamsIfCreated
                    ?.releaseConnection(ownerId)
                    .catch(err => logger.warn(`[${connId}] Failed to release camera sessions on disconnect`, err));
                if (this.#fabricLabelOwner === connection) {
                    logger.info(`[${connId}] Releasing fabric label ownership (owning connection closed)`);
                    this.#fabricLabelOwner = undefined;
                }
                connection.dispose();
            };

            // Must run before the command is dispatched: the camera can answer an offer, end a session
            // or evict a stream while the command is still in flight.
            const optInToEventsFor = (command: string) => {
                if (THREAD_DIAGNOSTICS_OPT_IN_COMMANDS.has(command)) optIns.threadDiagnostics = true;
                if (NETWORK_TOPOLOGY_OPT_IN_COMMANDS.has(command)) ensureTopologyObserver();
                if (WEBRTC_OPT_IN_COMMANDS.has(command)) optIns.webRtc = true;
                if (CAMERA_OPT_IN_COMMANDS.has(command)) ensureCameraObservers();
            };

            ws.on("message", data => {
                this.#handleWebSocketRequest(
                    connId,
                    ownerId,
                    connection,
                    data.toString(),
                    optInToEventsFor,
                    req?.socket?.remoteAddress,
                )
                    .then(({ response, enableListeners }) => {
                        if (this.#closed) return;
                        if (enableListeners) {
                            // Unlike the event opt-ins, listening starts only once start_listening has
                            // answered: its result is the node list the events then update.
                            listening = true;
                        }
                        connection.sendReliable(toBigIntAwareJson(response));
                    })
                    .catch(err => logger.error(`[${connId}] WebSocket request error`, err));
            });

            ws.on("close", onClose);
            ws.on("error", err => {
                logger.error(`[${connId}] WebSocket error`, err);
                onClose();
            });

            this.#getServerInfo()
                .then(response => {
                    logger.debug(`[${connId}] Sending server info`);
                    connection.sendReliable(toBigIntAwareJson(response));
                })
                .catch(err => logger.error(`[${connId}] WebSocket handshake error`, err));
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
        for (const remove of this.#removeUpgradeListeners) remove();
        this.#removeUpgradeListeners = [];
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

        // Stop per-connection watchdog timers deterministically; the close handlers also dispose,
        // but that races the socket close events.
        for (const connection of this.#connections) connection.dispose();
        this.#connections.clear();

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
        ownerId: string,
        connection: WebSocketConnection,
        data: string,
        optInToEventsFor: (command: string) => void,
        peerAddress?: string,
    ): Promise<{
        response: ErrorResultMessage | SuccessResultMessage;
        enableListeners?: boolean;
    }> {
        let messageId: string | undefined;
        let command: string | undefined;
        try {
            // Parse before logging: an unparseable frame cannot be redacted and may carry a credential.
            const request = parseBigIntAwareJson(data) as { message_id: string; command: string; args: any };
            // Deferred: matter.js calls this only at DEBUG, keeping redaction off the hot path.
            logger.debug(`[${connId}] WebSocket request`, () => redactSensitiveCommandFields(request));
            let args = request.args;
            messageId = request.message_id;
            command = request.command;
            // `request` is an unvalidated cast; a non-string command falls to the switch's default.
            if (typeof command === "string") {
                optInToEventsFor(command);
                args = commandArguments(args, command);
            }
            let result: ResponseOf<any>;
            let enableListeners: boolean | undefined = undefined;
            switch (command) {
                case "start_listening":
                    result = this.#handleStartListening(args);
                    enableListeners = true;
                    break;
                case "set_default_fabric_label":
                    result = await this.#handleSetDefaultFabricLabel(args, connection);
                    break;
                case "get_fabric_label":
                    result = this.#handleGetFabricLabel(args);
                    break;
                case "commission_with_code":
                    result = await this.#handleCommissionWithCode(args);
                    break;
                case "commission_on_network":
                    result = await this.#handleCommissionOnNetwork(args);
                    break;
                case "get_icd_state":
                    result = await this.#handleGetIcdState(args);
                    break;
                case "register_icd":
                    result = await this.#handleRegisterIcd(args);
                    break;
                case "resync_icd":
                    result = await this.#handleResyncIcd(args);
                    break;
                case "unregister_icd":
                    result = await this.#handleUnregisterIcd(args);
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
                    result = await this.#handleDeviceCommand(args, ownerId);
                    break;
                case "send_webrtc_provider_command":
                    result = await this.#handleSendWebRtcProviderCommand(args);
                    break;
                case "camera_get_capabilities":
                    result = await this.#handleCameraGetCapabilities(args);
                    break;
                case "camera_start_stream":
                    result = await this.#handleCameraStartStream(args, ownerId);
                    break;
                case "camera_stop_stream":
                    result = await this.#handleCameraStopStream(args, ownerId);
                    break;
                case "camera_snapshot":
                    result = await this.#handleCameraSnapshot(args);
                    break;
                case "camera_release_stream":
                    result = await this.#handleCameraReleaseStream(args);
                    break;
                case "camera_provide_answer":
                case "camera_provide_ice_candidates":
                    result = await this.#handleCameraSignallingCommand(args, command);
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
                case "remove_wifi_credentials":
                    result = await this.#handleRemoveWifiCredentials(args);
                    break;
                case "remove_thread_dataset":
                    result = await this.#handleRemoveThreadDataset(args);
                    break;
                case "get_all_credentials":
                    result = await this.#handleGetAllCredentials();
                    break;
                case "get_thread_border_routers":
                    result = this.#controller.borderRouters.list();
                    break;
                case "get_thread_diagnostics":
                    result = await this.#handleGetThreadDiagnostics(args);
                    break;
                case "get_network_topology":
                    result = await this.#handleGetNetworkTopology(args);
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
                case "initiate_ota_upload":
                    result = await this.#controller.otaUploads.initiateOtaUpload(peerAddress);
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
                logger.debug(`[${connId}] WebSocket response (${command})`, messageId);
            } else {
                logger.debug(`[${connId}] WebSocket response (${command})`, messageId, result);
            }
            return {
                response: {
                    message_id: messageId ?? "",
                    result,
                },
                enableListeners,
            };
        } catch (err) {
            logger.error(`[${connId}] WebSocket error response (${command})`, messageId, err);
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
            min_supported_schema_version: MIN_SUPPORTED_SCHEMA_VERSION,
            sdk_version: `matter-server/${this.#serverVersion} (matter.js/${MATTER_VERSION})`,
            wifi_credentials_set: !!(this.#config.wifiSsid && this.#config.wifiCredentials),
            wifi_ssid: this.#config.wifiSsid && this.#config.wifiCredentials ? this.#config.wifiSsid : undefined,
            thread_credentials_set: !!this.#config.threadDataset,
            bluetooth_enabled: this.#commandHandler.bleEnabled,
            ble_proxy_enabled: this.#commandHandler.bleProxyEnabled,
            controller_node_id: this.#commandHandler.getCommissionerNodeId(),
        };
    }

    /**
     * Broadcast an event to all connected WebSocket clients.
     */
    #broadcastEvent(event: string, data: unknown) {
        if (!this.#wss || this.#closed || this.#shuttingDown) return;
        const message = toBigIntAwareJson({ event, data });
        // node_updated broadcasts carry a full node snapshot and share the per-node coalescing key
        // with the per-connection observer path, so under backpressure the two collapse to one frame
        // instead of queuing duplicates. Everything else is low-volume and reliability-critical, so
        // it bypasses the queue.
        const nodeId =
            event === "node_updated" && data !== null && typeof data === "object" && "node_id" in data
                ? (data as { node_id: number | bigint }).node_id
                : undefined;
        for (const connection of this.#connections) {
            if (nodeId !== undefined) {
                connection.sendCoalescable(`node:${nodeId}`, () => message);
            } else {
                connection.sendReliable(message);
            }
        }
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
        logger.info("WebSocket server start_listening");
        const data = this.#handleGetNodes({});
        logger.info("WebSocket server start_listening. Returned", data.length, "nodes");
        return data;
    }

    async #handleSetDefaultFabricLabel(
        args: ArgsOf<"set_default_fabric_label">,
        connection: WebSocketConnection,
    ): Promise<ResponseOf<"set_default_fabric_label">> {
        const { label } = args;
        // `null` is the documented reset; an absent label must not fall through to the default label.
        if (label !== null && typeof label !== "string") {
            throw ServerError.invalidArguments("set_default_fabric_label requires label to be a string or null");
        }
        const effectiveLabel = normalizeFabricLabel(label);
        if (this.#config.fabricLabelLocked) {
            if (this.#config.fabricLabel !== effectiveLabel) {
                logger.notice(
                    `[${connection.connId}] Ignoring set_default_fabric_label "${effectiveLabel}" and keeping "${this.#config.fabricLabel}" (pinned via --default-fabric-label)`,
                );
            }
            return null;
        }
        if (this.#fabricLabelOwner !== undefined && this.#fabricLabelOwner !== connection) {
            if (this.#config.fabricLabel !== effectiveLabel) {
                logger.notice(
                    `[${connection.connId}] Ignoring set_default_fabric_label "${effectiveLabel}"; fabric label is owned by connection ${this.#fabricLabelOwner.connId} this session, keeping "${this.#config.fabricLabel}"`,
                );
            }
            return null;
        }
        // Claim before awaiting so a second connection racing its first set can't slip past the guard while
        // this one is suspended on the writes below.
        const previousOwner = this.#fabricLabelOwner;
        this.#fabricLabelOwner = connection;
        try {
            // Apply to matter.js first, persist only on success, so a failed update can't leave the
            // stored label out of sync with the live fabric label.
            await this.#commandHandler.setFabricLabel(effectiveLabel);
            await this.#config.set({ fabricLabel: effectiveLabel });
        } catch (error) {
            // A failed claiming attempt must not lock everyone else out; release only if we just claimed.
            if (previousOwner === undefined) {
                this.#fabricLabelOwner = undefined;
            }
            throw error;
        }
        return null;
    }

    #handleGetFabricLabel(_args: ArgsOf<"get_fabric_label">): ResponseOf<"get_fabric_label"> {
        return { fabric_label: this.#commandHandler.getFabricLabel() ?? this.#config.fabricLabel ?? null };
    }

    /**
     * Commission a node, allocating a fresh node id for each attempt.
     *
     * The node id counter can drift out of sync with the fabric (e.g. after manual storage edits or legacy imports).
     * When that happens matter.js rejects the chosen id with an identity conflict; we then allocate the next id and
     * retry rather than failing the commissioning outright.
     */
    async #commissionWithRetry(buildRequest: (nodeId: NodeId) => CommissioningRequest): Promise<NodeId> {
        let lastError: unknown;
        for (let attempt = 1; attempt <= MAX_COMMISSION_NODE_ID_ATTEMPTS; attempt++) {
            const nodeId = NodeId(
                await this.#config.allocateNodeId(id => this.#commandHandler.isNodeIdInUse(NodeId(id))),
            );
            try {
                const { nodeId: committed } = await this.#commandHandler.commissionNode(buildRequest(nodeId));
                return committed;
            } catch (error) {
                if (!isIdentityConflict(error)) {
                    throw error;
                }
                lastError = error;
                logger.warn(
                    `Node id ${nodeId} conflicts with an existing node on the fabric ` +
                        `(attempt ${attempt}/${MAX_COMMISSION_NODE_ID_ATTEMPTS}), retrying with the next id`,
                );
            }
        }
        const reason = lastError instanceof Error ? `: ${lastError.message}` : "";
        throw ServerError.nodeCommissionFailed(
            `Commission failed: could not find a free node id after ${MAX_COMMISSION_NODE_ID_ATTEMPTS} attempts${reason}`,
            lastError instanceof Error ? lastError : undefined,
        );
    }

    async #handleCommissionWithCode(args: ArgsOf<"commission_with_code">): Promise<ResponseOf<"commission_with_code">> {
        const { code, network_only, wifi_credentials_id, thread_dataset_id } = args;
        const isQrCode = code.startsWith("MT:");

        const wifiId = wifi_credentials_id ?? ConfigStorage.DEFAULT_CREDENTIAL_ID;
        const threadId = thread_dataset_id ?? ConfigStorage.DEFAULT_CREDENTIAL_ID;
        const wifiEntry = this.#config.getWifiCredentials(wifiId);
        const threadEntry = this.#config.getThreadCredentials(threadId);
        if (wifi_credentials_id !== undefined && wifiEntry === undefined) {
            throw ServerError.invalidArguments(`Unknown wifi_credentials_id: ${wifiId}`);
        }
        if (thread_dataset_id !== undefined && threadEntry === undefined) {
            throw ServerError.invalidArguments(`Unknown thread_dataset_id: ${threadId}`);
        }

        let wifiCredentials: ControllerCommissioningFlowOptions["wifiNetwork"] | undefined = undefined;
        let threadCredentials: ControllerCommissioningFlowOptions["threadNetwork"] | undefined = undefined;
        if (!network_only && this.#commandHandler.bleEnabled) {
            // Only apply a stored credential when its values are actually present —
            // an empty ssid/password or dataset would otherwise be pushed to the device.
            if (wifiEntry?.ssid && wifiEntry.credentials) {
                wifiCredentials = {
                    wifiSsid: wifiEntry.ssid,
                    wifiCredentials: wifiEntry.credentials,
                };
            }
            if (threadEntry?.dataset) {
                threadCredentials = {
                    networkName: "",
                    operationalDataset: threadEntry.dataset,
                };
            }
        }

        // Ensure certificates are loaded and initialized
        await this.#controller.certificateService();

        const nodeId = await this.#commissionWithRetry(nodeId => ({
            nodeId,
            onNetworkOnly: network_only,
            ...(isQrCode ? { qrCode: code } : { manualCode: code }),
            wifiCredentials,
            threadCredentials,
        }));

        return this.#collectNodeDetails(nodeId);
    }

    async #handleCommissionOnNetwork(
        args: ArgsOf<"commission_on_network">,
    ): Promise<ResponseOf<"commission_on_network">> {
        const { setup_pin_code, filter_type, filter, ip_addr } = args;

        // Build commissioning request based on filter type
        // Filter types: 0=None, 1=ShortDiscriminator, 2=LongDiscriminator, 3=VendorId, 4=DeviceType
        let commissionRequest: CommissioningRequest;

        const baseRequest = {
            onNetworkOnly: true, // commission_on_network is always network-only
            // Ignore fe80 addresses and better do generic discovery because could be from mobile devices
            knownAddress: ip_addr && !ip_addr.startsWith("fe80") ? { ip: ip_addr, port: 5540 } : undefined,
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
            case 3: // Vendor ID - not optimal but working
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

        // Ensure certificates are loaded and initialized
        await this.#controller.certificateService();

        const nodeId = await this.#commissionWithRetry(nodeId => ({ ...commissionRequest, nodeId }));

        return this.#collectNodeDetails(nodeId);
    }

    #handleGetNodes(args: ArgsOf<"get_nodes">): ResponseOf<"get_nodes"> {
        const { only_available = false } = args;
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
        const nodeId = this.#targetNodeId(node_id, "get_node");
        const handler = this.#handlerFor(nodeId);

        if (!handler.hasNode(nodeId)) {
            throw ServerError.nodeNotExists(node_id);
        }

        // Pass the last interview date for real nodes
        if (handler === this.#commandHandler) {
            await this.#commandHandler.ensureNodePopulated(nodeId);
            return this.#commandHandler.getNodeDetails(nodeId, this.#lastInterviewDates.get(nodeId));
        }
        return handler.getNodeDetails(nodeId);
    }

    async #handleGetNodeIpAddresses(
        args: ArgsOf<"get_node_ip_addresses">,
    ): Promise<ResponseOf<"get_node_ip_addresses">> {
        const { node_id, prefer_cache, scoped } = args;
        const nodeId = this.#targetNodeId(node_id, "get_node_ip_addresses");
        const result = await this.#handlerFor(nodeId).getNodeIpAddresses(nodeId, prefer_cache);
        // scoped=true means keep the interface suffix (e.g., %en0), scoped=false (default) strips it
        if (scoped) {
            return result;
        }
        return result.map(ip => (ip.includes("%") ? ip.split("%")[0] : ip));
    }

    async #handleReadAttribute(args: ArgsOf<"read_attribute">): Promise<ResponseOf<"read_attribute">> {
        const { node_id, attribute_path, fabric_filtered = false } = args;
        const nodeId = this.#targetNodeId(node_id, "read_attribute");

        // Normalize attribute_path to array
        const attributePaths = Array.isArray(attribute_path) ? attribute_path : [attribute_path];

        const result = await this.#handlerFor(nodeId).handleReadAttributes(nodeId, attributePaths, fabric_filtered);

        if (Object.keys(result).length === 0) {
            throw ServerError.sdkStackError("Failed to read attribute: no values returned");
        }

        return result;
    }

    async #handleWriteAttribute(args: ArgsOf<"write_attribute">): Promise<ResponseOf<"write_attribute">> {
        const { node_id, attribute_path, value } = args;
        const { nodeId, group } = this.#targetNodeIdOrGroup(node_id, "write_attribute");
        const { endpointId, clusterId, attributeId } = splitAttributePath(attribute_path);

        if (group) {
            if (clusterId === undefined || attributeId === undefined) {
                throw ServerError.invalidArguments(WRITE_WILDCARD_REFUSAL);
            }
            if (endpointId !== undefined) {
                throw ServerError.invalidArguments(
                    "write_attribute to a Group Node ID takes a wildcard endpoint in attribute_path: a groupcast carries no endpoint, each node's own group table decides which of its endpoints the write reaches",
                );
            }
            await this.#commandHandler.handleGroupWriteAttribute({ nodeId, clusterId, attributeId, value });
            return null;
        }

        if (endpointId === undefined || clusterId === undefined || attributeId === undefined) {
            throw ServerError.invalidArguments(WRITE_WILDCARD_REFUSAL);
        }

        const { status } = await this.#handlerFor(nodeId).handleWriteAttribute({
            nodeId,
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

    async #handleDeviceCommand(
        args: ArgsOf<"device_command">,
        requestedBy: string,
    ): Promise<ResponseOf<"device_command">> {
        const {
            node_id,
            endpoint_id: endpointId,
            cluster_id: clusterId,
            command_name: commandName,
            payload,
            timed_request_timeout_ms: timedInteractionTimeoutMs,
            interaction_timeout_ms: interactionTimeoutMs,
        } = args;

        const { nodeId, group } = this.#targetNodeIdOrGroup(node_id, "device_command");
        if (group) {
            if (endpointId !== undefined && endpointId !== null) {
                throw ServerError.invalidArguments(
                    "device_command to a Group Node ID takes no endpoint_id: a groupcast carries no endpoint, each node's own group table decides which of its endpoints the command reaches",
                );
            }
            // Check the stated value: a wrongly typed timeout converts to `undefined` and would pass.
            for (const [name, stated] of [
                ["timed_request_timeout_ms", timedInteractionTimeoutMs],
                ["interaction_timeout_ms", interactionTimeoutMs],
            ] as const) {
                if (stated !== undefined && stated !== null) {
                    throw ServerError.invalidArguments(
                        `${name} cannot accompany a groupcast: no node answers a group invoke, so there is no response to wait for`,
                    );
                }
            }
            await this.#commandHandler.handleGroupInvoke({
                nodeId,
                clusterId: ClusterId(clusterId),
                commandName,
                data: payload,
            });
            return null;
        }
        if (endpointId === undefined || endpointId === null) {
            throw ServerError.invalidArguments("device_command requires endpoint_id unless node_id is a Group Node ID");
        }

        const camelizedCommand = camelize(commandName);
        const invoke = (): Promise<unknown> =>
            this.#handlerFor(nodeId).handleInvoke({
                nodeId,
                endpointId: EndpointNumber(endpointId),
                clusterId: ClusterId(clusterId),
                commandName: camelizedCommand,
                data: payload,
                timedInteractionTimeoutMs:
                    typeof timedInteractionTimeoutMs === "number" ? Millis(timedInteractionTimeoutMs) : undefined,
            });

        const endsWebRtcSession =
            clusterId === WebRtcTransportProvider.id &&
            camelizedCommand === "endSession" &&
            !TestNodeCommandHandler.isTestNodeId(nodeId);
        const sessionId = endsWebRtcSession ? extractWebRtcSessionId(payload) : undefined;
        if (endsWebRtcSession && sessionId === undefined) {
            logger.debug(
                "EndSession invoked without a recognizable webRtcSessionId; local session tracking left unchanged",
            );
        }
        const result =
            sessionId === undefined
                ? await invoke()
                : await invokeEndSession(invoke, deviceHeldSession =>
                      this.#dropWebRtcSessionRecords(
                          nodeId,
                          EndpointNumber(endpointId),
                          sessionId,
                          requestedBy,
                          deviceHeldSession,
                      ),
                  );

        // Test nodes return null
        if (TestNodeCommandHandler.isTestNodeId(nodeId)) {
            return null;
        }

        const cmdResult = this.#convertCommandDataToWebSocket(ClusterId(clusterId), commandName, result);
        if (cmdResult === undefined) {
            return null;
        }
        return cmdResult;
    }

    /**
     * Never rejects, as {@link invokeEndSession} requires. The manager announces the end to the session's
     * owner, but not to `requestedBy`.
     */
    async #dropWebRtcSessionRecords(
        nodeId: NodeId,
        endpointId: EndpointNumber,
        sessionId: number,
        requestedBy: string,
        deviceHeldSession: boolean,
    ): Promise<void> {
        this.#controller.cameraStreamsIfCreated?.endedByClient(
            nodeId,
            endpointId,
            sessionId,
            requestedBy,
            deviceHeldSession,
        );
        await dropWebRtcSessionTracking(this.#commandHandler, sessionId, nodeId, endpointId);
    }

    async #handleSendWebRtcProviderCommand(args: unknown): Promise<ResponseOf<"send_webrtc_provider_command">> {
        const argsObject = requireArgumentObject(args, "send_webrtc_provider_command");
        rejectUnknownKeys(argsObject, SEND_PROVIDER_ARG_KEYS, "send_webrtc_provider_command argument");
        const { command_name, payload } = argsObject;
        if (command_name === undefined) {
            throw ServerError.invalidArguments(
                `send_webrtc_provider_command requires command_name, one of ${PROVIDER_COMMAND_NAMES.join(", ")}`,
            );
        }
        if (typeof command_name !== "string" || !isProviderCommandName(command_name)) {
            throw ServerError.invalidArguments(
                `Unsupported WebRTC provider command "${String(command_name)}"; expected one of ${PROVIDER_COMMAND_NAMES.join(", ")}`,
            );
        }
        const { nodeId, endpointId } = parseTargetIds(argsObject, "send_webrtc_provider_command");
        const fields = toProviderCommandFields(
            command_name,
            payload,
            `node ${formatNodeId(nodeId)} endpoint ${endpointId}`,
        );
        if (!establishesWebRtcSession(command_name)) {
            await this.#commandHandler.invokeWebRtcSignallingCommand({
                nodeId,
                endpointId,
                commandName: command_name,
                fields,
            });
            return null;
        }
        const response = await this.#commandHandler.invokeWebRtcProviderCommand({
            nodeId,
            endpointId,
            commandName: command_name,
            fields,
        });
        // Convert the matter.js response to WebSocket format the same way #handleDeviceCommand
        // does for generic invokes (bytes, epochs, bitmaps, struct member filtering).
        return this.#convertCommandDataToWebSocket(WebRtcTransportProvider.id, command_name, response);
    }

    /** Answers `null`: the cluster defines no response payload. */
    async #handleCameraSignallingCommand(
        args: unknown,
        command: CameraSignallingCommandName,
    ): Promise<ResponseOf<CameraSignallingCommandName>> {
        const { nodeId, endpointId, commandName, payload } = parseSignallingArgs(args, command);
        const fields = toProviderCommandFields(
            commandName,
            payload,
            `node ${formatNodeId(nodeId)} endpoint ${endpointId}`,
            command,
        );
        await this.#commandHandler.invokeWebRtcSignallingCommand({ nodeId, endpointId, commandName, fields });
        return null;
    }

    async #handleCameraGetCapabilities(args: unknown): Promise<ResponseOf<"camera_get_capabilities">> {
        const { nodeId, endpointId } = parseCapabilitiesArgs(args);
        const capabilities = await this.#controller.cameraStreams.getCapabilities(nodeId, endpointId);
        return toWireCapabilities(capabilities);
    }

    async #handleCameraStartStream(args: unknown, ownerId: string): Promise<ResponseOf<"camera_start_stream">> {
        const parsed = parseStartStreamArgs(args);
        const result = await this.#controller.cameraStreams.startStream({
            nodeId: parsed.nodeId,
            endpointId: parsed.endpointId,
            connectionId: ownerId,
            streamUsage: parsed.streamUsage,
            sdp: parsed.sdp,
            video: parsed.video,
            audio: parsed.audio,
            iceServers: parsed.iceServers,
            iceTransportPolicy: parsed.iceTransportPolicy,
            metadataEnabled: parsed.metadataEnabled,
            allowEviction: parsed.allowEviction,
        });
        return toWireStartStreamResult(result);
    }

    async #handleCameraStopStream(args: unknown, ownerId: string): Promise<ResponseOf<"camera_stop_stream">> {
        const { nodeId, endpointId, webRtcSessionId } = parseStopStreamArgs(args);
        const ended = await this.#controller.cameraStreams.stopStream(nodeId, endpointId, webRtcSessionId, ownerId);
        return { ended };
    }

    async #handleCameraSnapshot(args: unknown): Promise<ResponseOf<"camera_snapshot">> {
        const { nodeId, endpointId, maxResolution, codec, watermarkEnabled, osdEnabled } = parseSnapshotArgs(args);
        const result = await this.#controller.cameraStreams.snapshot({
            nodeId,
            endpointId,
            maxResolution,
            codec,
            watermarkEnabled,
            osdEnabled,
        });
        const wire = toWireSnapshotResult(result);
        logger.debug(
            `camera_snapshot for node ${nodeId} endpoint ${endpointId}: codec ${wire.codec}, ${wire.resolution.width}x${wire.resolution.height}, ${result.data.length} bytes, degraded ${wire.degraded}, stream ${wire.stream_id}`,
        );
        return wire;
    }

    async #handleCameraReleaseStream(args: unknown): Promise<ResponseOf<"camera_release_stream">> {
        const { nodeId, endpointId, kind, streamId } = parseReleaseStreamArgs(args);
        await this.#controller.cameraStreams.releaseStream({ nodeId, endpointId, kind, streamId });
        return null;
    }

    async #handleInterviewNode(args: ArgsOf<"interview_node">): Promise<ResponseOf<"interview_node">> {
        const { node_id } = args;
        const nodeId = this.#targetNodeId(node_id, "interview_node");

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

        // Update last interview date and broadcast node_updated with fresh data
        this.#lastInterviewDates.set(nodeId, new Date());
        this.#broadcastEvent("node_updated", this.#collectNodeDetails(nodeId));

        return null;
    }

    #rejectIcdCommandForTestNode(nodeId: NodeId): void {
        if (TestNodeCommandHandler.isTestNodeId(nodeId)) {
            throw ServerError.invalidArguments("ICD commands are not supported for test nodes");
        }
    }

    async #handleGetIcdState(args: ArgsOf<"get_icd_state">): Promise<ResponseOf<"get_icd_state">> {
        const { node_id } = args;
        const nodeId = this.#targetNodeId(node_id, "get_icd_state");
        this.#rejectIcdCommandForTestNode(nodeId);
        return this.#commandHandler.getIcdState(nodeId);
    }

    async #handleRegisterIcd(args: ArgsOf<"register_icd">): Promise<ResponseOf<"register_icd">> {
        const { node_id, allow_multi_admin, ignored_vendors } = args;
        const nodeId = this.#targetNodeId(node_id, "register_icd");
        this.#rejectIcdCommandForTestNode(nodeId);
        await this.#commandHandler.registerIcd(nodeId, {
            allowMultiAdmin: allow_multi_admin,
            ignoredVendors: ignored_vendors,
        });
        this.#broadcastEvent("node_updated", this.#collectNodeDetails(nodeId));
        return this.#commandHandler.getIcdState(nodeId);
    }

    async #handleResyncIcd(args: ArgsOf<"resync_icd">): Promise<ResponseOf<"resync_icd">> {
        const { node_id } = args;
        const nodeId = this.#targetNodeId(node_id, "resync_icd");
        this.#rejectIcdCommandForTestNode(nodeId);
        await this.#commandHandler.resyncIcd(nodeId);
        return null;
    }

    async #handleUnregisterIcd(args: ArgsOf<"unregister_icd">): Promise<ResponseOf<"unregister_icd">> {
        const { node_id, force = false } = args;
        const nodeId = this.#targetNodeId(node_id, "unregister_icd");
        this.#rejectIcdCommandForTestNode(nodeId);
        await this.#commandHandler.unregisterIcd(nodeId, force);
        this.#broadcastEvent("node_updated", this.#collectNodeDetails(nodeId));
        return this.#commandHandler.getIcdState(nodeId);
    }

    async #handlePingNode(args: ArgsOf<"ping_node">): Promise<ResponseOf<"ping_node">> {
        const { node_id, attempts = 1 } = args;
        const nodeId = this.#targetNodeId(node_id, "ping_node");
        return await this.#handlerFor(nodeId).pingNode(nodeId, attempts);
    }

    async #handleRemoveNode(args: ArgsOf<"remove_node">): Promise<ResponseOf<"remove_node">> {
        const { node_id } = args;
        const nodeId = this.#targetNodeId(node_id, "remove_node");
        await this.#handlerFor(nodeId).removeNode(nodeId);
        return null;
    }

    async #handleSetWifiCredentials(args: ArgsOf<"set_wifi_credentials">): Promise<ResponseOf<"set_wifi_credentials">> {
        const { ssid, credentials, id } = args;
        try {
            await this.#config.setWifiCredentials(id ?? ConfigStorage.DEFAULT_CREDENTIAL_ID, ssid, credentials);
        } catch (e) {
            throw ServerError.invalidArguments(e instanceof Error ? e.message : String(e));
        }
        await this.#safeBroadcastServerInfo();
        return {};
    }

    async #handleSetThreadDataset(args: ArgsOf<"set_thread_dataset">): Promise<ResponseOf<"set_thread_dataset">> {
        const { dataset, id } = args;
        if (typeof dataset !== "string") {
            throw ServerError.invalidArguments("set_thread_dataset requires dataset to be a hex string");
        }
        this.#assertValidDatasetHex(dataset);
        const credId = id ?? ConfigStorage.DEFAULT_CREDENTIAL_ID;
        const previousDataset = this.#config.getThreadCredentials(credId)?.dataset;
        try {
            await this.#config.setThreadCredentials(credId, dataset);
        } catch (e) {
            throw ServerError.invalidArguments(e instanceof Error ? e.message : String(e));
        }
        if (this.#controller.threadDiagnosticsEnabled) {
            registerThreadCredentialsFromHex(this.#controller.credentials, dataset, `set_thread_dataset:${credId}`);
            this.#unregisterThreadIfUnreferenced(previousDataset);
        }
        await this.#safeBroadcastServerInfo();
        return {};
    }

    async #handleGetThreadDiagnostics(
        args: ArgsOf<"get_thread_diagnostics">,
    ): Promise<ResponseOf<"get_thread_diagnostics">> {
        if (args.ext_pan_id === undefined) {
            this.#controller.threadDiagnostics.refreshAllKnown({ force: args.force });
            const diagnostics = this.#controller.threadDiagnostics;
            return diagnostics.listCached().map(batch => serializeBatch(batch, diagnostics.remainingTtl(batch)));
        }
        if (!/^[0-9a-fA-F]{16}$/.test(args.ext_pan_id)) {
            throw ServerError.invalidArguments(`Invalid ext_pan_id "${args.ext_pan_id}": expected 16 hex characters`);
        }
        const batch = await this.#controller.threadDiagnostics.getOrFetch(args.ext_pan_id.toLowerCase(), {
            force: args.force,
        });
        // Explicit null (not undefined) so the "no response" guard doesn't turn "nothing cached /
        // diagnostics disabled" into a generic sdk_stack_error.
        return batch === undefined
            ? null
            : serializeBatch(batch, this.#controller.threadDiagnostics.remainingTtl(batch));
    }

    async #handleGetNetworkTopology(args: ArgsOf<"get_network_topology">): Promise<ResponseOf<"get_network_topology">> {
        // Imported test nodes are served by get_nodes, so the derived graph must include them
        // too. Attached here (not at construction) to keep the service lazily instantiated.
        this.#controller.networkTopology.addNodeSource(this.#testNodeSource);
        if (args.refresh === true) {
            return this.#controller.networkTopology.refresh();
        }
        return this.#controller.networkTopology.getTopology();
    }

    async #handleRemoveWifiCredentials(
        args: ArgsOf<"remove_wifi_credentials">,
    ): Promise<ResponseOf<"remove_wifi_credentials">> {
        await this.#config.removeWifiCredentials(args.id ?? ConfigStorage.DEFAULT_CREDENTIAL_ID);
        await this.#safeBroadcastServerInfo();
        return {};
    }

    async #handleRemoveThreadDataset(
        args: ArgsOf<"remove_thread_dataset">,
    ): Promise<ResponseOf<"remove_thread_dataset">> {
        const credId = args.id ?? ConfigStorage.DEFAULT_CREDENTIAL_ID;
        const removed = this.#config.getThreadCredentials(credId);
        await this.#config.removeThreadCredentials(credId);
        this.#unregisterThreadIfUnreferenced(removed?.dataset);
        await this.#safeBroadcastServerInfo();
        return {};
    }

    async #handleGetAllCredentials(): Promise<ResponseOf<"get_all_credentials">> {
        const wifi = this.#config.listWifiCredentials().map(e => ({ id: e.id, ssid: e.ssid }));
        const ensureDefault = <T extends { id: string }>(arr: T[], def: T): T[] =>
            arr.some(e => e.id === ConfigStorage.DEFAULT_CREDENTIAL_ID) ? arr : [def, ...arr];
        const wifiOut = ensureDefault(wifi, { id: ConfigStorage.DEFAULT_CREDENTIAL_ID, ssid: "" });
        const thread = this.#config.listThreadCredentials().map(e => {
            try {
                const ds = OperationalDataset.decode(e.dataset);
                return {
                    id: e.id,
                    networkName: ds.networkName,
                    extPanId: ds.extPanId === undefined ? undefined : Bytes.toHex(ds.extPanId).toUpperCase(),
                };
            } catch {
                return { id: e.id };
            }
        });
        const threadOut = ensureDefault(thread, { id: ConfigStorage.DEFAULT_CREDENTIAL_ID });
        return { wifi: wifiOut, thread: threadOut };
    }

    #assertValidDatasetHex(dataset: string): void {
        if (!/^[0-9a-fA-F]+$/.test(dataset) || dataset.length % 2 !== 0) {
            throw ServerError.invalidArguments(
                "Invalid Thread operational dataset: must be a non-empty hex string with even length (each byte is two hex characters)",
            );
        }
        try {
            Bytes.fromHex(dataset);
        } catch (error) {
            MatterError.accept(error);
            throw ServerError.invalidArguments(
                `Invalid Thread operational dataset: failed to parse hex string: ${Diagnostic.errorMessage(error)}`,
            );
        }
    }

    async #safeBroadcastServerInfo(): Promise<void> {
        try {
            await this.#broadcastServerInfoUpdated();
        } catch (error) {
            logger.warn("Failed to broadcast server info update", error);
        }
    }

    #unregisterThreadIfUnreferenced(removedDataset: string | undefined): void {
        if (removedDataset === undefined || removedDataset === "") return;
        let removedExtPanId: Bytes | undefined;
        try {
            removedExtPanId = OperationalDataset.decode(removedDataset).extPanId;
        } catch {
            return;
        }
        if (removedExtPanId === undefined) return;
        const target = removedExtPanId;
        const stillReferenced = this.#config.listThreadCredentials().some(e => {
            try {
                const xp = OperationalDataset.decode(e.dataset).extPanId;
                return xp !== undefined && Bytes.areEqual(xp, target);
            } catch {
                return false;
            }
        });
        if (!stillReferenced) this.#controller.credentials.unregister(target);
    }

    async #handleOpenCommissioningWindow(
        args: ArgsOf<"open_commissioning_window">,
    ): Promise<ResponseOf<"open_commissioning_window">> {
        const { node_id, timeout /*, iteration, option, discriminator*/ } = args;
        const nodeId = this.#targetNodeId(node_id, "open_commissioning_window");
        const window = await this.#commandHandler.openCommissioningWindow({ nodeId, timeout });
        return {
            setup_pin_code: window.passcode,
            setup_manual_code: window.manualCode,
            setup_qr_code: window.qrCode,
            discriminator: window.discriminator,
            vendor_id: window.vendorId,
            product_id: window.productId,
            commissioning_timeout: window.commissioningTimeout,
        };
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
            }) => ({
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
        const nodeId = this.#targetNodeId(node_id, "get_matter_fabrics");
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
        await this.#commandHandler.removeFabric(
            this.#targetNodeId(node_id, "remove_matter_fabric"),
            FabricIndex(fabric_index),
        );
        return {};
    }

    async #handleSetAclEntry(args: ArgsOf<"set_acl_entry">): Promise<ResponseOf<"set_acl_entry">> {
        const { node_id, entry } = args;
        return await this.#commandHandler.setAclEntry(this.#targetNodeId(node_id, "set_acl_entry"), entry);
    }

    async #handleSetNodeBinding(args: ArgsOf<"set_node_binding">): Promise<ResponseOf<"set_node_binding">> {
        const { node_id, endpoint, bindings } = args;
        return await this.#commandHandler.setNodeBinding(
            this.#targetNodeId(node_id, "set_node_binding"),
            EndpointNumber(endpoint),
            bindings,
        );
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
        return await this.#commandHandler.checkNodeUpdate(this.#targetNodeId(node_id, "check_node_update"));
    }

    async #handleUpdateNode(args: ArgsOf<"update_node">): Promise<ResponseOf<"update_node">> {
        const { node_id, software_version } = args;
        const targetVersion = typeof software_version === "string" ? parseInt(software_version, 10) : software_version;
        return await this.#commandHandler.updateNode(this.#targetNodeId(node_id, "update_node"), targetVersion);
    }

    #collectNodeDetails(nodeId: NodeId): MatterNode {
        const lastInterviewDate = this.#lastInterviewDates.get(nodeId);
        return this.#commandHandler.getNodeDetails(nodeId, lastInterviewDate);
    }

    #convertCommandDataToWebSocket(
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
                `Cluster ${clusterId} does not have command ${commandName}. Do not convert data to WebSocket format`,
                value,
            );
            return {};
        }

        return convertMatterToWebSocketNameBased(
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
            case LogLevel.NOTICE:
                return "notice";
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
    #stringToLogLevel(level: SettableLogLevelString): LogLevel {
        switch (level) {
            case "critical":
            case "fatal":
                return LogLevel.FATAL;
            case "error":
                return LogLevel.ERROR;
            case "warning":
            case "warn":
                return LogLevel.WARN;
            case "notice":
                return LogLevel.NOTICE;
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
            typeof Logger.level === "string"
                ? this.#stringToLogLevel(Logger.level as SettableLogLevelString)
                : Logger.level;
        const consoleLevel = this.#logLevelToString(currentLevel);

        // Logger.destinations.file throws if file logging is not configured
        let fileLevel: LogLevelString | null = null;
        try {
            const fileDestination = Logger.destinations.file;
            const fileLevelValue =
                typeof fileDestination.level === "string"
                    ? this.#stringToLogLevel(fileDestination.level)
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
