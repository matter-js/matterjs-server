"""Decoder for the Matter commissionable BLE advertisement (Core spec 5.4.2.5.6)."""

from __future__ import annotations

from dataclasses import dataclass
import struct
from typing import TYPE_CHECKING

from .protocol import normalize_uuid

if TYPE_CHECKING:
    from collections.abc import Mapping

# The service UUID a device open for commissioning publishes its service data under.
COMMISSIONABLE_SERVICE_UUID = "fff6"

_OPCODE_COMMISSIONABLE = 0x00
# opcode, version << 12 | discriminator, vendor, product, flags
_COMMISSIONABLE = struct.Struct("<BHHHB")
_SIZE = _COMMISSIONABLE.size
# The spelling every bluetooth stack we have seen uses, tried before normalizing keys.
_SERVICE_DATA_KEY = "0000fff6-0000-1000-8000-00805f9b34fb"


@dataclass(frozen=True, slots=True)
class CommissionableAdvertisement:
    """A device advertising that it is open for commissioning."""

    discriminator: int
    """Identifies the device during commissioning; the setup code carries it too."""

    vendor_id: int
    """Vendor id, or 0 when the device does not advertise one."""

    product_id: int
    """Product id, or 0 when the device does not advertise one."""

    advertisement_version: int
    """Layout version of the advertisement; the fields above are version 0."""

    flags: int
    """Advertisement flags; bit 0 means additional commissioning data is available."""


def parse_commissionable_advertisement(
    service_data: Mapping[str, bytes],
) -> CommissionableAdvertisement | None:
    """Decode an advertisement's service data, or None if it is not commissionable."""
    data = service_data.get(_SERVICE_DATA_KEY)
    if data is None:
        data = next(
            (value for uuid, value in service_data.items() if normalize_uuid(uuid) == COMMISSIONABLE_SERVICE_UUID),
            None,
        )
    if data is None or len(data) < _SIZE or data[0] != _OPCODE_COMMISSIONABLE:
        return None
    _, discriminator, vendor_id, product_id, flags = _COMMISSIONABLE.unpack_from(data)
    return CommissionableAdvertisement(
        discriminator=discriminator & 0x0FFF,
        vendor_id=vendor_id,
        product_id=product_id,
        advertisement_version=discriminator >> 12,
        flags=flags,
    )
