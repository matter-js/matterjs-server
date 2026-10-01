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

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .advertisement import (
    COMMISSIONABLE_SERVICE_UUID,
    CommissionableAdvertisement,
    parse_commissionable_advertisement,
)
from .client import BleDeviceResolver, BleScanSource, ConnectionState, MatterBleProxy
from .protocol import (
    BINARY_FRAME_HEADER,
    BLE_PROXY_PROTOCOL_VERSION,
    OPCODE_NOTIFICATION,
    OPCODE_READ_RESPONSE,
    OPCODE_WRITE_DATA,
    AdvertisementData,
    BleProxyCommand,
    BleProxyErrorCode,
)

if TYPE_CHECKING:
    from .bleak_backend import BleakDeviceResolver, BleakScanSource


def __getattr__(name: str) -> Any:
    """Only the default backend needs bleak, so defer that import until it is asked for."""
    if name in ("BleakDeviceResolver", "BleakScanSource"):
        from . import bleak_backend

        return getattr(bleak_backend, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "BINARY_FRAME_HEADER",
    "BLE_PROXY_PROTOCOL_VERSION",
    "COMMISSIONABLE_SERVICE_UUID",
    "OPCODE_NOTIFICATION",
    "OPCODE_READ_RESPONSE",
    "OPCODE_WRITE_DATA",
    "AdvertisementData",
    "BleDeviceResolver",
    "BleProxyCommand",
    "BleProxyErrorCode",
    "BleScanSource",
    "BleakDeviceResolver",
    "BleakScanSource",
    "CommissionableAdvertisement",
    "ConnectionState",
    "MatterBleProxy",
    "parse_commissionable_advertisement",
]
