/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BorderRouterEntry } from "@matter/thread-br-client";
import type { MatterNodeData } from "./node.js";
// Re-export so consumers can import the MatterNodeData type from this module
export type { MatterNodeData } from "./node.js";
export type { BorderRouterEntry } from "@matter/thread-br-client";

/** Attribute data stored as path -> value mapping */
export type AttributesData = { [key: string]: unknown };

/*
 * The interfaces below decode the Thread Network Diagnostic TLVs a Border Router / router
 * reports (per the Thread spec / OpenThread `netdiag`). They are all part of the Thread
 * Network diagnostics feature and are @since schema 12.
 */

/** CONNECTIVITY TLV — a node's view of its links to neighbors and the leader. @since schema 12 */
export interface ThreadConnectivity {
    /** Suitability as a parent: -1 low, 0 medium, 1 high. */
    parentPriority: -1 | 0 | 1;
    /** Count of neighbors with link quality 3 (best) / 2 / 1 (worst). */
    linkQuality3: number;
    linkQuality2: number;
    linkQuality1: number;
    /** Routing cost from this node to the leader. */
    leaderCost: number;
    /** Router-ID assignment sequence number (bumped when the router set changes). */
    idSequence: number;
    /** Number of active routers in the Thread network. */
    activeRouters: number;
    /** Buffer size a parent reserves for a sleepy child (bytes). */
    sedBufferSize: number;
    /** Max IPv6 datagrams a parent queues for a sleepy child. */
    sedDatagramCount: number;
}

/** One neighbor-router row within {@link ThreadRoute64}. @since schema 12 */
export interface ThreadRoute64Entry {
    /** Router ID of the neighbor. */
    routerId: number;
    /** Link quality of packets received from / sent to that router (0–3). */
    linkQualityIn: number;
    linkQualityOut: number;
    /** Routing cost to that router. */
    routeCost: number;
}

/** ROUTE64 TLV — the node's routing table to other routers. @since schema 12 */
export interface ThreadRoute64 {
    /** Router-ID assignment sequence number. */
    idSequence: number;
    entries: ThreadRoute64Entry[];
}

/** LEADER_DATA TLV — the current leader / partition identity. @since schema 12 */
export interface ThreadLeaderData {
    /** Thread partition ID (changes on partition merge/split). */
    partitionId: number;
    /** Leader weighting used to arbitrate leadership. */
    weighting: number;
    /** Full and stable-only Network Data version counters. */
    dataVersion: number;
    stableDataVersion: number;
    /** Router ID of the leader. */
    leaderRouterId: number;
}

/** MAC_COUNTERS TLV — IEEE 802.15.4 MAC packet counters since last reset. @since schema 12 */
export interface ThreadMacCounters {
    ifInUnknownProtos: number;
    ifInErrors: number;
    ifOutErrors: number;
    ifInUcastPkts: number;
    ifInBroadcastPkts: number;
    ifInDiscards: number;
    ifOutUcastPkts: number;
    ifOutBroadcastPkts: number;
    ifOutDiscards: number;
}

/** MODE TLV — device capability/role flags. @since schema 12 */
export interface ThreadMode {
    /** Radio stays on when idle (a non-sleepy device). */
    rxOnWhenIdle: boolean;
    /** Full Thread Device (router-eligible) vs a Minimal Thread Device. */
    ftd: boolean;
    /** Requests the full Network Data vs the stable subset. */
    fullNetworkData: boolean;
}

/** CHILD_TABLE TLV entry — one child attached to this (router) node. @since schema 12 */
export interface ThreadChildTableEntry {
    /** Child timeout as a 2^exponent value and its resolved seconds. */
    timeoutExponent: number;
    timeoutSeconds: number;
    /** Link quality of packets received from the child (0–3). */
    incomingLinkQuality: number;
    /** Child ID (low bits of the child's RLOC16). */
    childId: number;
    mode: ThreadMode;
}

/** MLE_COUNTERS TLV — Mesh Link Establishment role/state counters. @since schema 12 */
export interface ThreadMleCounters {
    /** Number of times the node entered each role. */
    disabledRole: number;
    detachedRole: number;
    childRole: number;
    routerRole: number;
    leaderRole: number;
    /** Attach / partition-change bookkeeping. */
    attachAttempts: number;
    partitionIdChanges: number;
    betterPartitionAttachAttempts: number;
    parentChanges: number;
    /** Cumulative time spent tracked / in each role, in milliseconds (64-bit). */
    trackedTime: bigint;
    disabledTime: bigint;
    detachedTime: bigint;
    childTime: bigint;
    routerTime: bigint;
    leaderTime: bigint;
}

/**
 * Diagnostics for a single Thread node, assembled from the diagnostic TLVs it returned.
 * Every field is optional: a node only reports the TLVs it supports / were requested.
 * @since schema 12
 */
export interface ThreadDiagnosticsNode {
    /** 16-char uppercase hex of the 64-bit Thread MAC (extended address). */
    extMacAddress?: string;
    /** Short 16-bit routing locator (router+child) within the mesh. */
    rloc16?: number;
    mode?: ThreadMode;
    /** Polling/child timeout in seconds. */
    timeout?: number;
    connectivity?: ThreadConnectivity;
    route64?: ThreadRoute64;
    leaderData?: ThreadLeaderData;
    /** Hex-encoded raw Network Data blob (prefixes, routes, services). */
    networkData?: string;
    /** Per-node IPv6 addresses, each 16-byte address as uppercase hex. */
    ipv6Addresses?: string[];
    macCounters?: ThreadMacCounters;
    childTable?: ThreadChildTableEntry[];
    /** Supported channel pages (radio band identifiers). */
    channelPages?: number[];
    /** Max child timeout this node grants, in seconds. */
    maxChildTimeout?: number;
    /** 16-char uppercase hex EUI-64 (factory-assigned identifier). */
    eui64?: string;
    /** Thread protocol version the node implements. */
    version?: number;
    /** Vendor identity strings (VENDOR_NAME / MODEL / SW_VERSION TLVs). */
    vendorName?: string;
    vendorModel?: string;
    vendorSwVersion?: string;
    /** OpenThread (or other) stack build string. */
    threadStackVersion?: string;
    vendorAppUrl?: string;
    mleCounters?: ThreadMleCounters;
    /** Battery level (0–100%) and supply voltage (mV) for battery-powered nodes. */
    batteryLevel?: number;
    supplyVoltage?: number;
    /** TLVs this decoder does not model, preserved verbatim; `value` is uppercase hex. */
    unknown?: Array<{ type: number; value: string }>;
}

/** Why a {@link ThreadDiagnosticsBatch} is incomplete (absent when the batch is complete). @since schema 12 */
export type ThreadDiagnosticsPartialReason =
    | "petition_rejected"
    | "dtls_failed"
    | "border_router_unreachable"
    | "no_credentials"
    | "no_source"
    | "rest_unreachable"
    | "rest_protocol"
    | "timeout"
    /** Streaming multicast query is still active; this is a snapshot, more nodes may follow. */
    | "in_progress"
    /** Streaming multicast query is active but no responses have arrived yet. */
    | "meshcop_no_responses_yet"
    /** REST collection query is active but no responses have arrived yet. */
    | "rest_no_responses_yet";

/**
 * One Thread network's diagnostics snapshot, keyed by extended PAN ID, delivered by
 * `get_thread_diagnostics` and streamed via the `thread_diagnostics_updated` event.
 * @since schema 12
 */
export interface ThreadDiagnosticsBatch {
    /** 16-char uppercase hex extended PAN ID — the network this batch describes. */
    extPanIdHex: string;
    networkName: string;
    /** Epoch ms when the batch was assembled. */
    collectedAt: number;
    /**
     * Which transport produced it: MeshCoP (CoAP/DTLS) or the OTBR REST API.
     * `"none"` when no transport was attempted (e.g. a terminal `border_router_unreachable`
     * or `no_credentials` partial).
     */
    source: "meshcop" | "otbr-rest" | "none";
    nodes: ThreadDiagnosticsNode[];
    /** Set when the snapshot is partial or the query could not complete; see {@link ThreadDiagnosticsPartialReason}. */
    partialReason?: ThreadDiagnosticsPartialReason;
}

export type WebRtcEventType = "offer" | "answer" | "ice_candidates" | "end";

export interface WebRtcIceCandidate {
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
}

export interface WebRtcOfferData {
    sdp: string;
    ice_servers?: unknown[];
    ice_transport_policy?: string;
}

export interface WebRtcAnswerData {
    sdp: string;
}

export interface WebRtcIceCandidatesData {
    ice_candidates: WebRtcIceCandidate[];
}

export interface WebRtcEndData {
    reason: number;
}

interface WebRtcCallbackBase {
    webrtc_session_id: number;
    node_id: number | bigint;
    endpoint_id: number;
    fabric_index: number;
}

export type WebRtcCallbackData =
    | (WebRtcCallbackBase & { event_type: "offer"; data: WebRtcOfferData | null })
    | (WebRtcCallbackBase & { event_type: "answer"; data: WebRtcAnswerData | null })
    | (WebRtcCallbackBase & { event_type: "ice_candidates"; data: WebRtcIceCandidatesData | null })
    | (WebRtcCallbackBase & { event_type: "end"; data: WebRtcEndData | null });

export interface APICommands {
    start_listening: {
        requestArgs: Record<string, never>;
        response: Array<MatterNodeData>;
    };
    diagnostics: {
        requestArgs: Record<string, never>;
        response: {
            info: ServerInfoMessage;
            nodes: Array<MatterNodeData>;
            events: Array<MatterNodeEvent>;
        };
    };
    server_info: {
        requestArgs: Record<string, never>;
        response: ServerInfoMessage;
    };
    get_nodes: {
        requestArgs: { only_available?: boolean };
        response: Array<MatterNodeData>;
    };
    get_node: {
        requestArgs: { node_id: number | bigint };
        response: MatterNodeData;
    };
    commission_with_code: {
        requestArgs: { code: string; network_only?: boolean; wifi_credentials_id?: string; thread_dataset_id?: string };
        response: MatterNodeData;
    };
    commission_on_network: {
        requestArgs: {
            setup_pin_code: number;
            /** Discovery filter type: 0=None, 1=ShortDiscriminator, 2=LongDiscriminator, 3=VendorId, 4=DeviceType */
            filter_type?: number;
            /** Filter value (discriminator, vendor ID, or device type depending on filter_type) */
            filter?: number;
            /** Direct IP address for commissioning */
            ip_addr?: string;
        };
        response: MatterNodeData;
    };
    set_wifi_credentials: {
        requestArgs: { ssid: string; credentials: string; id?: string };
        response: Record<string, never>;
    };
    set_thread_dataset: {
        requestArgs: { dataset: string; id?: string };
        response: Record<string, never>;
    };
    remove_wifi_credentials: {
        requestArgs: { id?: string };
        response: Record<string, never>;
    };
    remove_thread_dataset: {
        requestArgs: { id?: string };
        response: Record<string, never>;
    };
    /** List stored WiFi/Thread credential summaries (no secrets). @since schema 12 */
    get_all_credentials: {
        requestArgs: Record<string, never>;
        response: AllCredentialsSummary;
    };
    /** mDNS-discovered Thread Border Routers (passive). @since schema 12 */
    get_thread_border_routers: {
        requestArgs: Record<string, never>;
        response: BorderRouterEntry[];
    };
    /**
     * Per-Thread-network diagnostics. `ext_pan_id` selects one network (returns the batch, or `null`
     * when nothing is cached / diagnostics are disabled); omitted returns an array of all known
     * networks. `force` bypasses the cache. Also streamed via the `thread_diagnostics_updated` event.
     * @since schema 12
     */
    get_thread_diagnostics: {
        requestArgs: { ext_pan_id?: string; force?: boolean };
        response: ThreadDiagnosticsBatch | ThreadDiagnosticsBatch[] | null;
    };
    open_commissioning_window: {
        requestArgs: {
            node_id: number | bigint;
            timeout?: number;
            iteration?: number;
            /**
             * Commissioning window type: 0=Enhanced, 1=Basic.
             * Currently ignored by the server (always uses Enhanced).
             */
            option?: 0 | 1;
            /** Discriminator value (null for random) */
            discriminator?: number | null;
        };
        response: CommissioningParameters;
    };
    discover: {
        requestArgs: Record<string, never>;
        response: CommissionableNodeData[];
    };
    interview_node: {
        requestArgs: { node_id: number | bigint };
        response: null;
    };
    get_icd_state: {
        requestArgs: { node_id: number | bigint };
        response: IcdStateData;
    };
    register_icd: {
        requestArgs: {
            node_id: number | bigint;
            allow_multi_admin?: boolean;
            ignored_vendors?: number[];
        };
        response: IcdStateData;
    };
    resync_icd: {
        requestArgs: { node_id: number | bigint };
        response: null;
    };
    unregister_icd: {
        requestArgs: { node_id: number | bigint; force?: boolean };
        response: IcdStateData;
    };
    device_command: {
        requestArgs: {
            node_id: number | bigint;
            endpoint_id: number;
            cluster_id: number;
            command_name: string;
            payload: unknown;
            /** Response type hint passed by the client SDK (currently unused by server) */
            response_type: unknown;
            timed_request_timeout_ms?: number | null;
            interaction_timeout_ms?: number | null;
        };
        response: unknown;
    };
    send_webrtc_provider_command: {
        requestArgs: {
            node_id: number | bigint;
            endpoint_id: number;
            command_name: "ProvideOffer" | "SolicitOffer";
            payload: Record<string, unknown>;
        };
        response: unknown;
    };
    remove_node: {
        requestArgs: { node_id: number | bigint };
        response: null;
    };
    get_vendor_names: {
        requestArgs: { filter_vendors?: Array<number> };
        response: { [key: string]: string };
    };
    subscribe_attribute: {
        requestArgs: Record<string, never>;
        response: Record<string, never>;
    };
    read_attribute: {
        requestArgs: {
            node_id: number | bigint;
            /** Single attribute path or array of paths. Supports wildcards (*) for cluster and attribute IDs. */
            attribute_path: string | string[];
            /** Filter by fabric (default: false) */
            fabric_filtered?: boolean;
        };
        response: AttributesData;
    };
    write_attribute: {
        requestArgs: {
            node_id: number | bigint;
            attribute_path: string;
            value: unknown;
        };
        response: Array<{
            Path: { EndpointId: number; ClusterId: number; AttributeId: number };
            Status: number;
        }>;
    };
    ping_node: {
        requestArgs: { node_id: number | bigint; attempts?: number };
        response: NodePingResult;
    };
    import_test_node: {
        requestArgs: { dump: string };
        response: null;
    };
    get_node_ip_addresses: {
        requestArgs: { node_id: number | bigint; prefer_cache?: boolean; scoped?: boolean };
        response: Array<string>;
    };
    check_node_update: {
        requestArgs: { node_id: number | bigint };
        response: MatterSoftwareVersion | null;
    };
    update_node: {
        requestArgs: { node_id: number | bigint; software_version: number | string };
        response: MatterSoftwareVersion | null;
    };
    discover_commissionable_nodes: {
        requestArgs: Record<string, never>;
        response: CommissionableNodeData[];
    };
    get_matter_fabrics: {
        requestArgs: { node_id: number | bigint };
        response: MatterFabricData[];
    };
    remove_matter_fabric: {
        requestArgs: { node_id: number | bigint; fabric_index: number };
        response: Record<string, never>;
    };
    set_acl_entry: {
        requestArgs: { node_id: number | bigint; entry: AccessControlEntry[] };
        response: AttributeWriteResult[] | null;
    };
    set_node_binding: {
        requestArgs: { node_id: number | bigint; endpoint: number; bindings: BindingTarget[] };
        response: AttributeWriteResult[] | null;
    };
    set_default_fabric_label: {
        requestArgs: { label: string | null };
        response: null;
    };
    get_fabric_label: {
        requestArgs: Record<string, never>;
        response: { fabric_label: string | null };
    };
    get_loglevel: {
        requestArgs: Record<string, never>;
        response: LogLevelResponse;
    };
    set_loglevel: {
        requestArgs: { console_loglevel?: SettableLogLevelString; file_loglevel?: SettableLogLevelString };
        response: LogLevelResponse;
    };
}

/** Utility type to extract request args for a command */
export type ArgsOf<R extends keyof APICommands> = APICommands[R]["requestArgs"];

/** Utility type to extract response type for a command */
export type ResponseOf<R extends keyof APICommands> = APICommands[R]["response"];

/**
 * Log levels the server reports (`get_loglevel`/`set_loglevel` response): the
 * Python Matter Server names plus `notice`.
 */
export type LogLevelString = "critical" | "error" | "warning" | "notice" | "info" | "debug";

/**
 * Log levels `set_loglevel` accepts as input: the reported names plus the
 * matter.js aliases `fatal` (= `critical`) and `warn` (= `warning`).
 */
export type SettableLogLevelString = LogLevelString | "fatal" | "warn";

/** Response for get_loglevel and set_loglevel commands */
export interface LogLevelResponse {
    console_loglevel: LogLevelString;
    file_loglevel: LogLevelString | null;
}

/** Access Control Entry for set_acl_entry command */
export interface AccessControlEntry {
    privilege: number;
    auth_mode: number;
    subjects: Array<number | bigint> | null;
    targets: AccessControlTarget[] | null;
}

export interface AccessControlTarget {
    cluster: number | null;
    endpoint: number | null;
    device_type: number | null;
}

/** Binding target for set_node_binding command */
export interface BindingTarget {
    node: number | bigint | null;
    group: number | null;
    endpoint: number | null;
    cluster: number | null;
}

/** Attribute write result for set_acl_entry and set_node_binding responses */
export interface AttributeWriteResult {
    path: { endpoint_id: number; cluster_id: number; attribute_id: number };
    status: number;
}

/** Matter node event structure */
export interface MatterNodeEvent {
    node_id: number | bigint;
    endpoint_id: number;
    cluster_id: number;
    event_id: number;
    event_number: number | bigint;
    priority: number;
    timestamp: number | bigint;
    timestamp_type: number;
    data: unknown | null;
}

export interface CommandMessage {
    message_id: string;
    command: keyof APICommands;
    args?: APICommands[keyof APICommands]["requestArgs"];
}

export interface AllCredentialsSummary {
    wifi: Array<{ id: string; ssid: string }>;
    thread: Array<{ id: string; networkName?: string; extPanId?: string }>;
}

export interface ServerInfoMessage {
    fabric_id: number | bigint;
    compressed_fabric_id: number | bigint;
    /** The fabric index. Note: Only available with OHF Matter Server, not Python Matter Server. */
    fabric_index?: number;
    schema_version: number;
    min_supported_schema_version: number;
    sdk_version: string;
    wifi_credentials_set: boolean;
    wifi_ssid?: string;
    thread_credentials_set: boolean;
    bluetooth_enabled: boolean;
    /** True when BLE proxy mode is enabled (server exposes `/ble` WebSocket endpoint for a remote proxy client). Note: Only available with OHF Matter Server, not Python Matter Server. */
    ble_proxy_enabled?: boolean;
    /** The controller's own operational (CASE) node id. Note: Only available with OHF Matter Server, not Python Matter Server. */
    controller_node_id?: number | bigint;
}

/** WebSocket event types and their data payloads */
export interface APIEvents {
    node_added: {
        data: MatterNodeData;
    };
    node_updated: {
        data: MatterNodeData;
    };
    node_removed: {
        data: number | bigint;
    };
    node_event: {
        data: MatterNodeEvent;
    };
    attribute_updated: {
        data: [node_id: number | bigint, attribute_path: string, value: unknown];
    };
    server_shutdown: {
        data: Record<string, never>;
    };
    endpoint_added: {
        data: { node_id: number | bigint; endpoint_id: number };
    };
    endpoint_removed: {
        data: { node_id: number | bigint; endpoint_id: number };
    };
    server_info_updated: {
        data: ServerInfoMessage;
    };
    thread_diagnostics_updated: {
        data: ThreadDiagnosticsBatch;
    };
    webrtc_callback: {
        data: WebRtcCallbackData;
    };
}

/** All known event type names */
export type EventTypes = keyof APIEvents;

interface ServerEventNodeAdded {
    event: "node_added";
    data: MatterNodeData;
}
interface ServerEventNodeUpdated {
    event: "node_updated";
    data: MatterNodeData;
}
interface ServerEventNodeRemoved {
    event: "node_removed";
    data: number | bigint;
}
interface ServerEventNodeEvent {
    event: "node_event";
    data: MatterNodeEvent;
}
interface ServerEventAttributeUpdated {
    event: "attribute_updated";
    data: [number | bigint, string, unknown];
}
interface ServerEventServerShutdown {
    event: "server_shutdown";
    data: Record<string, never>;
}
interface ServerEventEndpointAdded {
    event: "endpoint_added";
    data: { node_id: number | bigint; endpoint_id: number };
}
interface ServerEventEndpointRemoved {
    event: "endpoint_removed";
    data: { node_id: number | bigint; endpoint_id: number };
}
interface ServerEventInfoUpdated {
    event: "server_info_updated";
    data: ServerInfoMessage;
}
interface ServerEventThreadDiagnosticsUpdated {
    event: "thread_diagnostics_updated";
    data: ThreadDiagnosticsBatch;
}
interface ServerEventWebRtcCallback {
    event: "webrtc_callback";
    data: WebRtcCallbackData;
}

export type EventMessage =
    | ServerEventNodeAdded
    | ServerEventNodeUpdated
    | ServerEventNodeRemoved
    | ServerEventNodeEvent
    | ServerEventAttributeUpdated
    | ServerEventServerShutdown
    | ServerEventEndpointAdded
    | ServerEventEndpointRemoved
    | ServerEventInfoUpdated
    | ServerEventThreadDiagnosticsUpdated
    | ServerEventWebRtcCallback;

export interface ResultMessageBase {
    message_id: string;
}

export interface ErrorResultMessage extends ResultMessageBase {
    error_code: number;
    details?: string;
}

export interface SuccessResultMessage extends ResultMessageBase {
    result: unknown;
}

export interface WebSocketConfig {
    host: string;
    port: string;
    scheme: string;
    path: string;
}

export enum UpdateSource {
    MAIN_NET_DCL = "main-net-dcl",
    TEST_NET_DCL = "test-net-dcl",
    LOCAL = "local",
}

export interface MatterSoftwareVersion {
    vid: number;
    pid: number;
    software_version: number;
    software_version_string: string;
    firmware_information?: string;
    min_applicable_software_version: number;
    max_applicable_software_version: number;
    release_notes_url?: string;
    update_source: UpdateSource;
}

export interface CommissioningParameters {
    setup_pin_code: number;
    setup_manual_code: string;
    setup_qr_code: string;
}

export interface CommissionableNodeData {
    instance_name?: string;
    host_name?: string;
    port?: number;
    long_discriminator?: number;
    vendor_id?: number;
    product_id?: number;
    commissioning_mode?: number;
    device_type?: number;
    device_name?: string;
    pairing_instruction?: string;
    pairing_hint?: number;
    mrp_retry_interval_idle?: number;
    mrp_retry_interval_active?: number;
    supports_tcp?: boolean;
    addresses?: string[];
    rotating_id?: string;
}

export interface MatterFabricData {
    fabric_id?: number | bigint;
    vendor_id?: number;
    fabric_index?: number;
    fabric_label?: string;
    vendor_name?: string;
}

/**
 * Error code used when ICD registration is rejected because other administrator fabrics may not
 * support LIT. OHF extension (python-matter-server codes stop at 11); the error `details` is a JSON
 * string `{"message": string, "admin_vendor_ids": number[]}`.
 */
export const ICD_MULTI_ADMIN_ERROR_CODE = 100;

/** ICD controller-side state for a node. Note: Only available with OHF Matter Server. */
export interface IcdStateData {
    supported: boolean;
    lit_supported: boolean;
    registered: boolean;
    operating_mode: "SIT" | "LIT" | null;
    awake: boolean | null;
    available: boolean | null;
    /** Epoch milliseconds of the next expected check-in, if known. */
    next_expected_checkin: number | null;
}

export type NotificationType = "success" | "info" | "warning" | "error";
export type NodePingResult = Record<string, boolean>;

/**
 * Minimum test node ID. Node IDs >= this value are reserved for test nodes.
 * Uses high 64-bit range (0xFFFF_FFFE_0000_0000) to avoid collision with real node IDs.
 */
export const TEST_NODE_START = 0xffff_fffe_0000_0000n;

/**
 * Check if a node ID is in the test node range (>= TEST_NODE_START).
 * Test nodes are imported diagnostic dumps, not real commissioned devices.
 */
export function isTestNodeId(nodeId: number | bigint): boolean {
    const bigId = typeof nodeId === "bigint" ? nodeId : BigInt(nodeId);
    return bigId >= TEST_NODE_START;
}
