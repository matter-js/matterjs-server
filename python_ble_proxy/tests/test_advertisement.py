"""Unit tests for the commissionable advertisement decoder."""

from __future__ import annotations

import subprocess
import sys

import pytest

from matter_ble_proxy.advertisement import (
    COMMISSIONABLE_SERVICE_UUID,
    CommissionableAdvertisement,
    parse_commissionable_advertisement,
)

SERVICE_DATA_KEY = "0000fff6-0000-1000-8000-00805f9b34fb"
# Commissionable, discriminator 3840, vendor 0xFFF1, product 0x8000.
COMMISSIONABLE = bytes([0x00, 0x00, 0x0F, 0xF1, 0xFF, 0x00, 0x80, 0x00])
# Advertisement version 1, discriminator 0x234, flags 0x03.
VERSIONED = bytes([0x00, 0x34, 0x12, 0x00, 0x00, 0x00, 0x00, 0x03])


@pytest.mark.parametrize(
    ("data", "expected"),
    [
        pytest.param(
            COMMISSIONABLE,
            CommissionableAdvertisement(
                discriminator=3840,
                vendor_id=0xFFF1,
                product_id=0x8000,
                advertisement_version=0,
                flags=0,
            ),
            id="fields_are_little_endian",
        ),
        pytest.param(
            VERSIONED,
            CommissionableAdvertisement(
                discriminator=0x234,
                vendor_id=0,
                product_id=0,
                advertisement_version=1,
                flags=0x03,
            ),
            id="version_is_the_discriminator_high_nibble",
        ),
    ],
)
def test_decodes(data, expected):
    assert parse_commissionable_advertisement({SERVICE_DATA_KEY: data}) == expected


@pytest.mark.parametrize("uuid", [COMMISSIONABLE_SERVICE_UUID, "0000FFF6", SERVICE_DATA_KEY.upper()])
def test_finds_the_service_data_whichever_way_the_uuid_is_spelled(uuid):
    assert parse_commissionable_advertisement({uuid: COMMISSIONABLE}) is not None


@pytest.mark.parametrize(
    "service_data",
    [
        pytest.param({SERVICE_DATA_KEY: bytes([0x01, *COMMISSIONABLE[1:]])}, id="not_commissionable"),
        pytest.param({SERVICE_DATA_KEY: COMMISSIONABLE[:7]}, id="short"),
        pytest.param({"0000fe07-0000-1000-8000-00805f9b34fb": COMMISSIONABLE}, id="another_service"),
        pytest.param({}, id="no_service_data"),
    ],
)
def test_rejects(service_data):
    assert parse_commissionable_advertisement(service_data) is None


def test_decoding_does_not_need_bleak():
    code = "import sys, matter_ble_proxy; assert 'bleak' not in sys.modules"
    subprocess.run([sys.executable, "-c", code], check=True)
