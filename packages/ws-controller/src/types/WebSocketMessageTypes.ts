/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

export type AttributesData = { [key: string]: unknown };

export interface MatterNode {
    node_id: number | bigint;
    date_commissioned: string;
    last_interview: string;
    interview_version: number;
    available: boolean;
    is_bridge: boolean;
    attributes: AttributesData;
    attribute_subscriptions: []; // ???
}

export interface APICommands {
    start_listening: {
        requestArgs: void;
        response: Array<MatterNode>;
    };
    set_default_fabric_label: {
        requestArgs: {
            /** Fabric label (null to clear) */
            label: string | null;
        };
        response: null;
    };
    diagnostics: {
        requestArgs: {};
        response: {
            info: ServerInfoMessage;
            nodes: Array<MatterNode>;
            /** Last 25 node events */
            events: Array<MatterNodeEvent>;
        };
    };
    server_info: {
        requestArgs: {};
        response: ServerInfoMessage;
    };
    get_nodes: {
        requestArgs: {
            only_available?: boolean;
        };
        response: Array<MatterNode>;
    };
    get_node: {
        requestArgs: {
            node_id: number | bigint; // ????
        };
        response: MatterNode; // ????
    };
    commission_with_code: {
        requestArgs: {
            code: string;
            network_only?: boolean;
        };
        response: MatterNode;
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
        response: MatterNode;
    };
    set_wifi_credentials: {
        requestArgs: {
            ssid: string;
            credentials: string;
        };
        response: {};
    };
    set_thread_dataset: {
        requestArgs: {
            dataset: string;
        };
        response: {};
    };
    open_commissioning_window: {
        requestArgs: {
            node_id: number | bigint; //????
            timeout: number; // seconds
            iteration?: number; // 1000
            option?: number; // 1??
            discriminator?: number | null; // ???
        };
        response: {
            setup_pin_code: number;
            setup_manual_code: string;
            setup_qr_code: string;
        };
    };
    discover: {
        requestArgs: {};
        response: CommissionableNodeData[];
    };
    interview_node: {
        requestArgs: {
            node_id: number | bigint; // ???
        };
        response: null;
    };
    device_command: {
        requestArgs: {
            node_id: number | bigint; // ??
            endpoint_id: number;
            cluster_id: number;
            command_name: string;
            payload: unknown;
            response_type: unknown; // ????
            timed_request_timeout_ms?: number | null;
            interaction_timeout_ms?: number | null;
        };
        response: unknown;
    };
    remove_node: {
        requestArgs: {
            node_id: number | bigint; // ???
        };
        response: null;
    };
    get_vendor_names: {
        requestArgs: {
            filter_vendors?: Array<number>;
        };
        response: { [key: string]: string };
    };
    subscribe_attribute: {
        requestArgs: {};
        response: {};
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
            node_id: number | bigint; //???,
            attribute_path: string;
            value: unknown;
        };
        response: Array<{
            Path: {
                EndpointId: number;
                ClusterId: number;
                AttributeId: number;
            };
            Status: number;
        }>;
    };
    ping_node: {
        requestArgs: {
            node_id: number | bigint;
            /** Number of ping attempts per IP address (default: 1) */
            attempts?: number;
        };
        response: { [key: string]: boolean };
    };
    import_test_node: {
        requestArgs: {
            dump: string;
        };
        response: null;
    };
    get_node_ip_addresses: {
        requestArgs: {
            node_id: number | bigint; // ????
            prefer_cache: boolean;
            scoped: boolean;
        };
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
        requestArgs: {};
        response: CommissionableNodeData[];
    };
    get_matter_fabrics: {
        requestArgs: { node_id: number | bigint };
        response: MatterFabricData[];
    };
    remove_matter_fabric: {
        requestArgs: {
            node_id: number | bigint;
            fabric_index: number;
        };
        response: {};
    };
    set_acl_entry: {
        requestArgs: {
            node_id: number | bigint;
            entry: AccessControlEntry[];
        };
        response: AttributeWriteResult[] | null;
    };
    set_node_binding: {
        requestArgs: {
            node_id: number | bigint;
            endpoint: number;
            bindings: BindingTarget[];
        };
        response: AttributeWriteResult[] | null;
    };
    get_loglevel: {
        requestArgs: {};
        response: {
            /** Console log level */
            console_loglevel: LogLevelString;
            /** File log level (null if file logging not enabled) */
            file_loglevel: LogLevelString | null;
        };
    };
    set_loglevel: {
        requestArgs: {
            /** Console log level to set */
            console_loglevel?: LogLevelString;
            /** File log level to set (only applied if file logging is enabled) */
            file_loglevel?: LogLevelString;
        };
        response: {
            /** Console log level after change */
            console_loglevel: LogLevelString;
            /** File log level after change (null if file logging not enabled) */
            file_loglevel: LogLevelString | null;
        };
    };
}

/** Log level string values matching CLI options */
export type LogLevelString = "critical" | "error" | "warning" | "info" | "debug";

/**
 * Access Control Entry structure for set_acl_entry command.
 * Uses snake_case field names matching our API convention.
 */
export interface AccessControlEntry {
    /** 1=View, 3=Operate, 4=Manage, 5=Administer */
    privilege: number;
    /** 1=PASE, 2=CASE, 3=Group */
    auth_mode: number;
    /** List of subject NodeIds or GroupIds */
    subjects: Array<number | bigint> | null;
    /** Optional target restrictions */
    targets: AccessControlTarget[] | null;
}

export interface AccessControlTarget {
    cluster: number | null;
    endpoint: number | null;
    device_type: number | null;
}

/**
 * Binding target structure for set_node_binding command.
 * Matches Python Matter Server's TargetStruct.
 */
export interface BindingTarget {
    /** Target node ID */
    node: number | bigint | null;
    /** Target group ID */
    group: number | null;
    /** Target endpoint */
    endpoint: number | null;
    /** Target cluster */
    cluster: number | null;
}

/** Attribute write result for set_acl_entry and set_node_binding responses */
export interface AttributeWriteResult {
    path: {
        endpoint_id: number;
        cluster_id: number;
        attribute_id: number;
    };
    status: number;
}

export interface ServerInfoMessage {
    fabric_id: bigint; // not number
    compressed_fabric_id: bigint; // not number
    schema_version: number;
    min_supported_schema_version: number;
    sdk_version: string;
    wifi_credentials_set: boolean;
    thread_credentials_set: boolean;
    bluetooth_enabled: boolean;
}

/**
 * Matter node event structure for node_event WebSocket event.
 * Matches Python Matter Server's MatterNodeEvent.
 */
export interface MatterNodeEvent {
    node_id: number | bigint;
    endpoint_id: number;
    cluster_id: number;
    event_id: number;
    event_number: number | bigint;
    priority: number; // 0=Debug, 1=Info, 2=Critical
    timestamp: number | bigint;
    timestamp_type: number; // 0=System, 1=Epoch, 2=POSIX
    data: unknown | null;
}

interface APIEvents {
    node_added: {
        data: MatterNode;
    };
    node_updated: {
        data: MatterNode;
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
}

export type EventMessage<E extends keyof APIEvents> = {
    event: E;
    data: APIEvents[E]["data"];
};
export type EventTypes = keyof APIEvents;

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

export type NotificationType = "success" | "info" | "warning" | "error";
export type NodePingResult = Record<string, boolean>;

/**
 * WebSocket Command Message generic type.
 */
export interface CommandMessage {
    message_id: string;
    command: keyof APICommands;
    args?: APICommands[keyof APICommands]["requestArgs"];
}

/** WebSocket Result Message base fields type */
interface ResultMessageBase {
    message_id: string;
}

/** WebSocket Error Result Message type */
export interface ErrorResultMessage extends ResultMessageBase {
    error_code: number;
    details?: string;
}

/** WebSocket Success Result Message type */
export interface SuccessResultMessage<T extends keyof APICommands> extends ResultMessageBase {
    result: APICommands[T]["response"];
}

export type ArgsOf<R extends keyof APICommands> = APICommands[R]["requestArgs"];
export type ResponseOf<R extends keyof APICommands> = APICommands[R]["response"];

/**
 * Minimum test node ID. Node IDs >= this value are reserved for test nodes.
 * Uses high 64-bit range (0xFFFF_FFFE_0000_0000) to avoid collision with real node IDs.
 */
export const TEST_NODE_START = 0xffff_fffe_0000_0000n;

/**
 * Error codes matching Python Matter Server for API compatibility.
 * @see https://github.com/home-assistant-libs/python-matter-server/blob/main/matter_server/common/errors.py
 */
export enum ServerErrorCode {
    /** Generic/unknown error */
    UnknownError = 0,
    /** Node commissioning failed */
    NodeCommissionFailed = 1,
    /** Node interview failed */
    NodeInterviewFailed = 2,
    /** Node is not ready (offline or not yet interviewed) */
    NodeNotReady = 3,
    /** Node not resolving (CASE session establishment failed) */
    NodeNotResolving = 4,
    /** Node does not exist */
    NodeNotExists = 5,
    /** SDK version mismatch */
    VersionMismatch = 6,
    /** SDK/Stack error */
    SDKStackError = 7,
    /** Invalid command arguments */
    InvalidArguments = 8,
    /** Invalid/unknown command */
    InvalidCommand = 9,
    /** OTA update check failed */
    UpdateCheckError = 10,
    /** OTA update failed */
    UpdateError = 11,
}

/**
 * Custom error class for server errors with typed error codes.
 * Use this to throw errors that will be properly mapped to Python-compatible error codes.
 */
export class ServerError extends Error {
    constructor(
        public readonly code: ServerErrorCode,
        message: string,
        cause?: Error,
    ) {
        super(message, { cause });
        this.name = "ServerError";
    }

    static unknownError(message: string, cause?: Error): ServerError {
        return new ServerError(ServerErrorCode.UnknownError, message, cause);
    }

    static nodeCommissionFailed(message: string, cause?: Error): ServerError {
        return new ServerError(ServerErrorCode.NodeCommissionFailed, message, cause);
    }

    static nodeInterviewFailed(message: string, cause?: Error): ServerError {
        return new ServerError(ServerErrorCode.NodeInterviewFailed, message, cause);
    }

    static nodeNotReady(nodeId: number | bigint, cause?: Error): ServerError {
        return new ServerError(ServerErrorCode.NodeNotReady, `Node ${nodeId} is not ready`, cause);
    }

    static nodeNotResolving(nodeId: number | bigint, cause?: Error): ServerError {
        return new ServerError(ServerErrorCode.NodeNotResolving, `Node ${nodeId} is not resolving`, cause);
    }

    static nodeNotExists(nodeId: number | bigint): ServerError {
        return new ServerError(ServerErrorCode.NodeNotExists, `Node ${nodeId} does not exist`);
    }

    static versionMismatch(message: string): ServerError {
        return new ServerError(ServerErrorCode.VersionMismatch, message);
    }

    static sdkStackError(message: string, cause?: Error): ServerError {
        return new ServerError(ServerErrorCode.SDKStackError, message, cause);
    }

    static invalidArguments(message: string): ServerError {
        return new ServerError(ServerErrorCode.InvalidArguments, message);
    }

    static invalidCommand(command: string): ServerError {
        return new ServerError(ServerErrorCode.InvalidCommand, `Unknown command: ${command}`);
    }

    static updateCheckError(message: string, cause?: Error): ServerError {
        return new ServerError(ServerErrorCode.UpdateCheckError, message, cause);
    }

    static updateError(message: string, cause?: Error): ServerError {
        return new ServerError(ServerErrorCode.UpdateError, message, cause);
    }
}
