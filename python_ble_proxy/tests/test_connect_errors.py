"""Tests for connect-failure classification into structured wire error codes."""

from __future__ import annotations

from matter_ble_proxy.client import _classify_connect_error


class BleakOutOfConnectionSlotsError(Exception):
    pass


class BleakAbortedError(Exception):
    pass


class BleakDeviceNotFoundError(Exception):
    pass


class BleakNotFoundError(Exception):
    pass


class BleakBluetoothNotAvailableError(Exception):
    pass


ADDR = "AA:BB:CC:DD:EE:FF"


def test_out_of_slots_by_type_name():
    code, msg = _classify_connect_error(BleakOutOfConnectionSlotsError("x"), ADDR)
    assert code == "out_of_connection_slots"
    assert ADDR in msg


def test_out_of_slots_by_message_marker():
    err = Exception("No backend with an available connection slot that can reach address AA:BB was found")
    code, _ = _classify_connect_error(err, ADDR)
    assert code == "out_of_connection_slots"


def test_out_of_slots_esp_cancel_marker():
    code, _ = _classify_connect_error(Exception("ESP_GATT_CONN_CONN_CANCEL"), ADDR)
    assert code == "out_of_connection_slots"


def test_connection_aborted_by_type_name():
    code, _ = _classify_connect_error(BleakAbortedError("x"), ADDR)
    assert code == "connection_aborted"


def test_connection_aborted_by_marker():
    code, _ = _classify_connect_error(Exception("le-connection-abort-by-local"), ADDR)
    assert code == "connection_aborted"


def test_device_not_found_by_type_name():
    code, _ = _classify_connect_error(BleakDeviceNotFoundError("x"), ADDR)
    assert code == "device_not_found"


def test_device_not_found_legacy_name():
    code, _ = _classify_connect_error(BleakNotFoundError("x"), ADDR)
    assert code == "device_not_found"


def test_connection_aborted_esp32_markers():
    for marker in ("br-connection-canceled", "ESP_GATT_CONN_TERMINATE_PEER_USER", "ESP_GATT_CONN_TERMINATE_LOCAL_HOST"):
        code, _ = _classify_connect_error(Exception(marker), ADDR)
        assert code == "connection_aborted", f"expected connection_aborted for marker {marker!r}"


def test_bluetooth_unavailable_by_type_name():
    code, msg = _classify_connect_error(BleakBluetoothNotAvailableError("adapter off"), ADDR)
    assert code == "bluetooth_unavailable"
    assert ADDR in msg


def test_generic_failure():
    code, _ = _classify_connect_error(Exception("something else"), ADDR)
    assert code == "connection_failed"
