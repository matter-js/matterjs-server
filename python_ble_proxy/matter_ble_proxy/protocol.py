"""Protocol constants, types, and codec for the BLE proxy WebSocket protocol.

See `docs/ble-proxy-protocol.md` in the matter-server repository for the full
specification.
"""

from __future__ import annotations

from dataclasses import dataclass, field
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
