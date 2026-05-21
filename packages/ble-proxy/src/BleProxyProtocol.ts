/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * BLE Proxy Protocol constants, types, and codec.
 * See docs/ble-proxy-protocol.md for the full specification.
 */

// ─── Protocol Version ────────────────────────────────────────────────────────

export const BLE_PROXY_PROTOCOL_VERSION = 1;

// ─── Handshake Messages ──────────────────────────────────────────────────────

export interface HelloMessage {
    type: "hello";
    version: number;
}

export interface HelloResponseMessage {
    type: "hello_response";
    version: number;
    error?: string;
    message?: string;
}

export type HandshakeMessage = HelloMessage | HelloResponseMessage;

// ─── Command Names ───────────────────────────────────────────────────────────

export const BleProxyCommand = {
    StartScan: "start_scan",
    StopScan: "stop_scan",
    Connect: "connect",
    Disconnect: "disconnect",
    DiscoverServices: "discover_services",
    DiscoverCharacteristics: "discover_characteristics",
    ReadCharacteristic: "read_characteristic",
    WriteCharacteristic: "write_characteristic",
    SubscribeCharacteristic: "subscribe_characteristic",
    WriteAndSubscribe: "write_and_subscribe",
    UnsubscribeCharacteristic: "unsubscribe_characteristic",
    RequestMtu: "request_mtu",
} as const;

export type BleProxyCommandName = (typeof BleProxyCommand)[keyof typeof BleProxyCommand];

// ─── Event Names ─────────────────────────────────────────────────────────────

export const BleProxyEvent = {
    DeviceDiscovered: "device_discovered",
    Disconnected: "disconnected",
    ScanStopped: "scan_stopped",
    CharacteristicNotification: "characteristic_notification",
} as const;

export type BleProxyEventName = (typeof BleProxyEvent)[keyof typeof BleProxyEvent];

// ─── Command Args ────────────────────────────────────────────────────────────

export interface StartScanArgs {
    service_uuids?: string[];
    allow_duplicates?: boolean;
}

export interface ConnectArgs {
    address: string;
    timeout?: number;
}

export interface DisconnectArgs {
    connection_handle: number;
}

export interface DiscoverServicesArgs {
    connection_handle: number;
}

export interface DiscoverCharacteristicsArgs {
    connection_handle: number;
    service_uuid: string;
}

export interface ReadCharacteristicArgs {
    connection_handle: number;
    characteristic_uuid: string;
}

export interface WriteCharacteristicArgs {
    connection_handle: number;
    characteristic_uuid: string;
    value: string; // base64
    response?: boolean;
}

export interface SubscribeCharacteristicArgs {
    connection_handle: number;
    characteristic_uuid: string;
}

/**
 * Atomic write-then-subscribe. The client performs the write to `write_uuid`, awaits the
 * GATT Write Response, then enables CCCD on `subscribe_uuid` without any intervening
 * WebSocket round-trip. Used for the Matter BTP handshake on C1/C2 where a peripheral may
 * push the handshake response indication before the client has had time to enable CCCD if
 * the two ops are split across WS commands.
 */
export interface WriteAndSubscribeArgs {
    connection_handle: number;
    write_uuid: string;
    write_value: string; // base64
    write_response?: boolean;
    subscribe_uuid: string;
}

export interface UnsubscribeCharacteristicArgs {
    connection_handle: number;
    characteristic_uuid: string;
}

export interface RequestMtuArgs {
    connection_handle: number;
    mtu: number;
}

// ─── Command Results ─────────────────────────────────────────────────────────

export interface ConnectResult {
    connection_handle: number;
    mtu: number;
}

export interface DiscoverServicesResult {
    services: Array<{ uuid: string }>;
}

export interface DiscoverCharacteristicsResult {
    characteristics: Array<{
        uuid: string;
        properties: string[];
    }>;
}

export interface ReadCharacteristicResult {
    value: string; // base64
}

export interface RequestMtuResult {
    mtu: number;
}

// ─── Event Data ──────────────────────────────────────────────────────────────

export interface DeviceDiscoveredData {
    address: string;
    name?: string;
    rssi?: number;
    connectable: boolean;
    service_data?: Record<string, string>; // uuid -> base64
    manufacturer_data?: Record<string, string>; // id -> base64
    service_uuids?: string[];
}

export interface DisconnectedData {
    connection_handle: number;
    reason?: string;
}

export interface ScanStoppedData {
    reason: string;
}

export interface CharacteristicNotificationData {
    connection_handle: number;
    characteristic_uuid: string;
    value: string; // base64
}

// ─── Command Type Map ────────────────────────────────────────────────────────

/** Maps each command name to its args and result types for type-safe sendCommand. */
export interface BleProxyCommandMap {
    [BleProxyCommand.StartScan]: { args: StartScanArgs; result: void };
    [BleProxyCommand.StopScan]: { args: undefined; result: void };
    [BleProxyCommand.Connect]: { args: ConnectArgs; result: ConnectResult };
    [BleProxyCommand.Disconnect]: { args: DisconnectArgs; result: void };
    [BleProxyCommand.DiscoverServices]: { args: DiscoverServicesArgs; result: DiscoverServicesResult };
    [BleProxyCommand.DiscoverCharacteristics]: {
        args: DiscoverCharacteristicsArgs;
        result: DiscoverCharacteristicsResult;
    };
    [BleProxyCommand.ReadCharacteristic]: { args: ReadCharacteristicArgs; result: ReadCharacteristicResult };
    [BleProxyCommand.WriteCharacteristic]: { args: WriteCharacteristicArgs; result: void };
    [BleProxyCommand.SubscribeCharacteristic]: { args: SubscribeCharacteristicArgs; result: void };
    [BleProxyCommand.WriteAndSubscribe]: { args: WriteAndSubscribeArgs; result: void };
    [BleProxyCommand.UnsubscribeCharacteristic]: { args: UnsubscribeCharacteristicArgs; result: void };
    [BleProxyCommand.RequestMtu]: { args: RequestMtuArgs; result: RequestMtuResult };
}

// ─── JSON Message Envelopes ──────────────────────────────────────────────────

export interface CommandMessage {
    id: number;
    command: BleProxyCommandName;
    args?: Record<string, unknown>;
}

export interface SuccessResponseMessage {
    id: number;
    success: true;
    result?: Record<string, unknown>;
}

export interface ErrorResponseMessage {
    id: number;
    success: false;
    error: string;
    message: string;
}

export type ResponseMessage = SuccessResponseMessage | ErrorResponseMessage;

export interface EventMessage {
    event: BleProxyEventName;
    data: Record<string, unknown>;
}

// ─── Error Codes ─────────────────────────────────────────────────────────────

export const BleProxyErrorCode = {
    BluetoothUnavailable: "bluetooth_unavailable",
    AlreadyScanning: "already_scanning",
    NotScanning: "not_scanning",
    DeviceNotFound: "device_not_found",
    ConnectionFailed: "connection_failed",
    AlreadyConnected: "already_connected",
    NotConnected: "not_connected",
    Timeout: "timeout",
    ServiceNotFound: "service_not_found",
    CharacteristicNotFound: "characteristic_not_found",
    ReadFailed: "read_failed",
    WriteFailed: "write_failed",
    SubscribeFailed: "subscribe_failed",
    NotSubscribed: "not_subscribed",
    NotifyNotSupported: "notify_not_supported",
    MtuRequestFailed: "mtu_request_failed",
    DiscoveryFailed: "discovery_failed",
    InternalError: "internal_error",
} as const;

export type BleProxyErrorCodeValue = (typeof BleProxyErrorCode)[keyof typeof BleProxyErrorCode];

// ─── Binary Frame Opcodes ────────────────────────────────────────────────────

export const BinaryFrameOpcode = {
    /** Server -> Client: write payload to the active write characteristic */
    WriteData: 0x01,
    /** Client -> Server: notification data from a subscribed characteristic */
    Notification: 0x02,
    /** Client -> Server: response data for a read_characteristic command */
    ReadResponse: 0x03,
} as const;

export type BinaryFrameOpcodeValue = (typeof BinaryFrameOpcode)[keyof typeof BinaryFrameOpcode];

// ─── Binary Frame Codec ──────────────────────────────────────────────────────

/**
 * Binary frame layout:
 * [1 byte: opcode] [2 bytes: connection_handle big-endian] [N bytes: payload]
 *
 * Minimum frame size: 3 bytes (opcode + handle, empty payload).
 */

const BINARY_FRAME_HEADER_SIZE = 3;

export interface BinaryFrame {
    opcode: number;
    connectionHandle: number;
    payload: Uint8Array;
}

export function encodeBinaryFrame(opcode: number, connectionHandle: number, payload: Uint8Array): Uint8Array {
    const frame = new Uint8Array(BINARY_FRAME_HEADER_SIZE + payload.length);
    frame[0] = opcode & 0xff;
    frame[1] = (connectionHandle >> 8) & 0xff;
    frame[2] = connectionHandle & 0xff;
    frame.set(payload, BINARY_FRAME_HEADER_SIZE);
    return frame;
}

export function decodeBinaryFrame(data: Uint8Array): BinaryFrame {
    if (data.length < BINARY_FRAME_HEADER_SIZE) {
        throw new Error(`Binary frame too short: ${data.length} bytes, minimum ${BINARY_FRAME_HEADER_SIZE}`);
    }
    return {
        opcode: data[0],
        connectionHandle: (data[1] << 8) | data[2],
        payload: data.subarray(BINARY_FRAME_HEADER_SIZE),
    };
}
