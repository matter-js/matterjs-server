"""Unit tests for the protocol codec and constants."""

from __future__ import annotations

from matter_ble_proxy.client import _normalize_uuid
from matter_ble_proxy.protocol import (
    BINARY_FRAME_HEADER,
    BLE_PROXY_PROTOCOL_VERSION,
    OPCODE_NOTIFICATION,
    OPCODE_READ_RESPONSE,
    OPCODE_WRITE_DATA,
    AdvertisementData,
)


def test_protocol_version_is_v1():
    assert BLE_PROXY_PROTOCOL_VERSION == 1


def test_opcodes_are_distinct():
    assert {OPCODE_WRITE_DATA, OPCODE_NOTIFICATION, OPCODE_READ_RESPONSE} == {0x01, 0x02, 0x03}


def test_binary_frame_roundtrip():
    payload = b"\xde\xad\xbe\xef"
    frame = BINARY_FRAME_HEADER.pack(OPCODE_WRITE_DATA, 0x1234) + payload
    assert len(frame) == BINARY_FRAME_HEADER.size + len(payload)

    opcode, handle = BINARY_FRAME_HEADER.unpack_from(frame)
    assert opcode == OPCODE_WRITE_DATA
    assert handle == 0x1234
    assert frame[BINARY_FRAME_HEADER.size :] == payload


def test_normalize_uuid_short_forms_match():
    short = _normalize_uuid("fff6")
    short_upper = _normalize_uuid("FFF6")
    padded_32bit = _normalize_uuid("0000fff6")
    padded_32bit_upper = _normalize_uuid("0000FFF6")
    full_dashed = _normalize_uuid("0000fff6-0000-1000-8000-00805f9b34fb")
    full_dashed_upper = _normalize_uuid("0000FFF6-0000-1000-8000-00805F9B34FB")
    full_compact = _normalize_uuid("0000fff600001000800000805f9b34fb")
    assert short == "fff6"
    assert (
        short == short_upper == padded_32bit == padded_32bit_upper == full_dashed == full_dashed_upper == full_compact
    )


def test_normalize_uuid_keeps_custom_uuids_compact():
    custom = _normalize_uuid("18EE2EF5-263D-4559-959F-4F9C429F9D11")
    assert custom == "18ee2ef5263d4559959f4f9c429f9d11"


def test_advertisement_data_defaults():
    ad = AdvertisementData(address="aa:bb:cc:dd:ee:ff")
    assert ad.address == "aa:bb:cc:dd:ee:ff"
    assert ad.name is None
    assert ad.rssi is None
    assert ad.connectable is False
    assert ad.service_data == {}
    assert ad.manufacturer_data == {}
    assert ad.service_uuids == []
