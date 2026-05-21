"""Python client library for the OHF Matter Server BLE proxy protocol.

This package implements the client side of the BLE proxy WebSocket protocol
exposed by the matter-server's `/ble` endpoint. It bridges a Matter
commissioning controller running on the server to a local BLE adapter on the
client side (Bleak directly, Home Assistant's bluetooth component, ESPHome BLE
proxies, etc.).

The core protocol logic lives in :mod:`matter_ble_proxy.client` and is BLE-
transport-agnostic via the :class:`BleScanSource` and :class:`BleDeviceResolver`
abstractions. A default :class:`BleakScanSource` + :class:`BleakDeviceResolver`
implementation is provided in :mod:`matter_ble_proxy.bleak_backend` for
standalone use; integrators (e.g. Home Assistant) supply their own backend.
"""

from .bleak_backend import BleakDeviceResolver, BleakScanSource
from .client import BleDeviceResolver, BleScanSource, ConnectionState, MatterBleProxy
from .protocol import (
    BINARY_FRAME_HEADER,
    BLE_PROXY_PROTOCOL_VERSION,
    OPCODE_NOTIFICATION,
    OPCODE_READ_RESPONSE,
    OPCODE_WRITE_DATA,
    AdvertisementData,
)

__all__ = [
    "BINARY_FRAME_HEADER",
    "BLE_PROXY_PROTOCOL_VERSION",
    "OPCODE_NOTIFICATION",
    "OPCODE_READ_RESPONSE",
    "OPCODE_WRITE_DATA",
    "AdvertisementData",
    "BleDeviceResolver",
    "BleScanSource",
    "BleakDeviceResolver",
    "BleakScanSource",
    "ConnectionState",
    "MatterBleProxy",
]
