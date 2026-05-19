"""Default Bleak-based backend for the BLE proxy client.

Use these when the host process owns its own BLE adapter directly via Bleak
(CLI tools, integration tests, single-tenant servers). Home Assistant supplies
a different backend that wires into its bluetooth component.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from bleak import BleakScanner

from .client import BleDeviceResolver, BleScanSource
from .protocol import AdvertisementData

if TYPE_CHECKING:
    from collections.abc import Callable

    from bleak.backends.device import BLEDevice
    from bleak.backends.scanner import AdvertisementData as BleakAdvertisementData

_LOGGER = logging.getLogger(__name__)


class BleakScanSource(BleScanSource):
    """Scan source backed by a directly-managed `BleakScanner`.

    The scanner is created on each :meth:`start` and torn down on :meth:`stop`,
    so the BLE adapter sits idle whenever the matter-server is not actively
    scanning. The first `start_scan` after a process boot pays the native
    cold-start cost (CoreBluetooth state transition to `powered_on`, DBus
    handshake) — typically tens to hundreds of milliseconds.
    """

    def __init__(self) -> None:
        """Initialize."""
        self._scanner: BleakScanner | None = None
        self._callback: Callable[[AdvertisementData], None] | None = None
        # Cache the most recent BLEDevice per address so BleakDeviceResolver
        # can hand a fully-formed device to BleakClient (more reliable than
        # connecting by address alone on some platforms).
        self._device_cache: dict[str, BLEDevice] = {}

    @property
    def device_cache(self) -> dict[str, BLEDevice]:
        """Read-only access for paired :class:`BleakDeviceResolver`."""
        return self._device_cache

    async def start(self, callback: Callable[[AdvertisementData], None]) -> None:
        """Start the scanner if not already running."""
        self._callback = callback
        if self._scanner is not None:
            return
        self._scanner = BleakScanner(detection_callback=self._on_detection)
        await self._scanner.start()

    async def stop(self) -> None:
        """Stop the scanner and release the BLE adapter."""
        scanner = self._scanner
        self._scanner = None
        self._callback = None
        if scanner is not None:
            try:
                await scanner.stop()
            except Exception:
                _LOGGER.debug("Error stopping BleakScanner", exc_info=True)

    def _on_detection(self, device: BLEDevice, advertisement: BleakAdvertisementData) -> None:
        self._device_cache[device.address] = device
        cb = self._callback
        if cb is None:
            return
        ad = AdvertisementData(
            address=device.address,
            name=advertisement.local_name or device.name,
            rssi=advertisement.rssi,
            connectable=True,  # Bleak does not expose this directly; assume true.
            service_data=dict(advertisement.service_data),
            manufacturer_data=dict(advertisement.manufacturer_data),
            service_uuids=list(advertisement.service_uuids),
        )
        try:
            cb(ad)
        except Exception:
            _LOGGER.exception("BLE proxy advertisement callback raised")


class BleakDeviceResolver(BleDeviceResolver):
    """Default resolver: prefer a cached `BLEDevice`, fall back to the address.

    When paired with :class:`BleakScanSource`, the resolver reuses the device
    object the scanner observed. Without a paired source it returns the raw
    address — Bleak then performs its own short scan inside `connect()`.
    """

    def __init__(self, scan_source: BleakScanSource | None = None) -> None:
        """Initialize."""
        self._scan_source = scan_source

    async def resolve(self, address: str) -> BLEDevice | str | None:
        """Return cached `BLEDevice` if available, else the address."""
        if self._scan_source is not None:
            device = self._scan_source.device_cache.get(address)
            if device is not None:
                return device
        return address
