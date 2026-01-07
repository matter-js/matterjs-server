import { MatterNode } from "./node.js";

/** Attribute data stored as path -> value mapping */
export type AttributesData = { [key: string]: unknown };

export interface APICommands {
    start_listening: {
        requestArgs: Record<string, never>;
        response: Array<MatterNode>;
    };
    diagnostics: {
        requestArgs: Record<string, never>;
        response: {
            info: ServerInfoMessage;
            nodes: Array<MatterNode>;
            events: Array<MatterNodeEvent>;
        };
    };
    server_info: {
        requestArgs: Record<string, never>;
        response: ServerInfoMessage;
    };
    get_nodes: {
        requestArgs: { only_available?: boolean };
        response: Array<MatterNode>;
    };
    get_node: {
        requestArgs: { node_id: number | bigint };
        response: MatterNode;
    };
    commission_with_code: {
        requestArgs: { code: string; network_only?: boolean };
        response: MatterNode;
    };
    commission_on_network: {
        requestArgs: {
            setup_pin_code: number;
            filter_type?: number;
            filter?: number;
            ip_addr?: string;
        };
        response: MatterNode;
    };
    set_wifi_credentials: {
        requestArgs: { ssid: string; credentials: string };
        response: Record<string, never>;
    };
    set_thread_dataset: {
        requestArgs: { dataset: string };
        response: Record<string, never>;
    };
    open_commissioning_window: {
        requestArgs: {
            node_id: number | bigint;
            timeout?: number;
            iteration?: number;
            option?: number;
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
    device_command: {
        requestArgs: {
            node_id: number | bigint;
            endpoint_id: number;
            cluster_id: number;
            command_name: string;
            payload: unknown;
            response_type: unknown;
            timed_request_timeout_ms?: number | null;
            interaction_timeout_ms?: number | null;
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
            attribute_path: string | string[];
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

export interface ServerInfoMessage {
    fabric_id: number | bigint;
    compressed_fabric_id: number | bigint;
    schema_version: number;
    min_supported_schema_version: number;
    sdk_version: string;
    wifi_credentials_set: boolean;
    thread_credentials_set: boolean;
    bluetooth_enabled: boolean;
}

interface ServerEventNodeAdded {
    event: "node_added";
    data: MatterNode;
}
interface ServerEventNodeUpdated {
    event: "node_updated";
    data: MatterNode;
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

export type EventMessage =
    | ServerEventNodeAdded
    | ServerEventNodeUpdated
    | ServerEventNodeRemoved
    | ServerEventNodeEvent
    | ServerEventAttributeUpdated
    | ServerEventServerShutdown
    | ServerEventEndpointAdded
    | ServerEventEndpointRemoved
    | ServerEventInfoUpdated;

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

export type NotificationType = "success" | "info" | "warning" | "error";
export type NodePingResult = Record<string, boolean>;
