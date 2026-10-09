"""Protocol constants, types, and codec for the BLE proxy WebSocket protocol.

See `docs/ble-proxy-protocol.md` in the matter-server repository for the full
specification.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
import struct

# Current protocol version. Must match the matter-server's
# `BLE_PROXY_PROTOCOL_VERSION` constant; the server rejects clients that send
# a different version in the `hello` handshake.
BLE_PROXY_PROTOCOL_VERSION = 1

# Binary frame opcodes. See `docs/ble-proxy-protocol.md` § Binary Frame Protocol.
OPCODE_WRITE_DATA = 0x01
OPCODE_NOTIFICATION = 0x02
OPCODE_READ_RESPONSE = 0x03

# Binary frame header: opcode (1 byte) + connection_handle (2 bytes big-endian).
BINARY_FRAME_HEADER = struct.Struct(">BH")

# Handshake must complete within this many seconds or the connection is closed.
HANDSHAKE_TIMEOUT_SECONDS = 10.0

# Default connect timeout for a BLE peripheral if the server's `connect` command
# does not include an explicit `timeout`. Matter BLE commissioning windows are
# 15 minutes; this only caps a single connect attempt.
DEFAULT_CONNECT_TIMEOUT_MS = 30_000


class BleProxyCommand(StrEnum):
    """Commands the server may send to a client.

    Mirrors `BleProxyCommand` in `packages/ble-proxy/src/BleProxyProtocol.ts`; a client must
    implement every member of this enum.
    """

    START_SCAN = "start_scan"
    STOP_SCAN = "stop_scan"
    CONNECT = "connect"
    DISCONNECT = "disconnect"
    DISCOVER_SERVICES = "discover_services"
    DISCOVER_CHARACTERISTICS = "discover_characteristics"
    READ_CHARACTERISTIC = "read_characteristic"
    WRITE_CHARACTERISTIC = "write_characteristic"
    SUBSCRIBE_CHARACTERISTIC = "subscribe_characteristic"
    WRITE_AND_SUBSCRIBE = "write_and_subscribe"
    UNSUBSCRIBE_CHARACTERISTIC = "unsubscribe_characteristic"
    REQUEST_MTU = "request_mtu"


class BleProxyErrorCode(StrEnum):
    """Error codes a client may return in a command response.

    Mirrors `BleProxyErrorCode` in `packages/ble-proxy/src/BleProxyProtocol.ts`; the wire
    value of every member is its name lowercased.
    """

    BLUETOOTH_UNAVAILABLE = "bluetooth_unavailable"
    ALREADY_SCANNING = "already_scanning"
    NOT_SCANNING = "not_scanning"
    DEVICE_NOT_FOUND = "device_not_found"
    CONNECTION_FAILED = "connection_failed"
    ALREADY_CONNECTED = "already_connected"
    NOT_CONNECTED = "not_connected"
    TIMEOUT = "timeout"
    SERVICE_NOT_FOUND = "service_not_found"
    CHARACTERISTIC_NOT_FOUND = "characteristic_not_found"
    READ_FAILED = "read_failed"
    WRITE_FAILED = "write_failed"
    SUBSCRIBE_FAILED = "subscribe_failed"
    NOT_SUBSCRIBED = "not_subscribed"
    NOTIFY_NOT_SUPPORTED = "notify_not_supported"
    MTU_REQUEST_FAILED = "mtu_request_failed"
    DISCOVERY_FAILED = "discovery_failed"
    INTERNAL_ERROR = "internal_error"


@dataclass(slots=True)
class AdvertisementData:
    """One BLE advertisement reported through `device_discovered` events.

    The fields mirror the JSON `device_discovered` event payload defined in
    the protocol spec. Backend implementations build this from their native
    scan source (Bleak, Home Assistant bluetooth, ESPHome BLE proxy, etc.)
    and hand it to :class:`MatterBleProxy` which forwards it to the server.
    """

    address: str
    """Peripheral MAC address (Linux/Windows) or CoreBluetooth UUID (macOS)."""

    name: str | None = None
    """Local device name from the advertisement payload, if any."""

    rssi: int | None = None
    """Signal strength in dBm, if available."""

    connectable: bool = False
    """True if the peripheral advertises that it accepts connections."""

    service_data: dict[str, bytes] = field(default_factory=dict)
    """Service-data map keyed by service UUID (any form: short, dashed, compact)."""

    manufacturer_data: dict[int, bytes] = field(default_factory=dict)
    """Manufacturer-specific data keyed by company id."""

    service_uuids: list[str] = field(default_factory=list)
    """List of advertised service UUIDs."""
