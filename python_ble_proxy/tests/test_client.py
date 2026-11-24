"""Unit tests for the proxy client's command dispatch."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from matter_ble_proxy.client import BleDeviceResolver, BleScanSource, ConnectionState, MatterBleProxy
from matter_ble_proxy.protocol import (
    BINARY_FRAME_HEADER,
    OPCODE_WRITE_DATA,
    BleProxyCommand,
    BleProxyErrorCode,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    from matter_ble_proxy.protocol import AdvertisementData


class _StubScanSource(BleScanSource):
    def __init__(self) -> None:
        self.starts = 0
        self.stops = 0
        self.callback: Callable[[AdvertisementData], None] | None = None

    async def start(self, callback: Callable[[AdvertisementData], None]) -> None:
        self.starts += 1
        self.callback = callback

    async def stop(self) -> None:
        self.stops += 1
        self.callback = None


class _StubDeviceResolver(BleDeviceResolver):
    async def resolve(self, address: str) -> str | None:
        return address


class _StubWebSocket:
    """Captures what the client would send, standing in for the aiohttp socket."""

    closed = False

    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    async def send_json(self, payload: dict[str, Any]) -> None:
        self.sent.append(payload)


def _proxy() -> tuple[MatterBleProxy, _StubWebSocket]:
    proxy, ws, _scan_source = _proxy_with_scan_source()
    return proxy, ws


def _proxy_with_scan_source() -> tuple[MatterBleProxy, _StubWebSocket, _StubScanSource]:
    scan_source = _StubScanSource()
    proxy = MatterBleProxy(
        ws_url="ws://localhost:5580/ble",
        scan_source=scan_source,
        device_resolver=_StubDeviceResolver(),
    )
    ws = _StubWebSocket()
    proxy._ws = ws  # type: ignore[assignment]
    return proxy, ws, scan_source


def test_every_protocol_command_has_a_handler():
    proxy, _ = _proxy()
    implemented = set(proxy._handlers)
    assert [command for command in BleProxyCommand if command not in implemented] == []


async def test_unknown_command_is_reported_as_an_error():
    proxy, ws = _proxy()

    await proxy._handle_command({"id": 7, "command": "teleport", "args": {}})

    assert ws.sent == [
        {
            "id": 7,
            "success": False,
            "error": BleProxyErrorCode.INTERNAL_ERROR.value,
            "message": "Unknown command: teleport",
        }
    ]


class _StubBleakClient:
    """Records the GATT calls the handlers make, standing in for BleakClient."""

    is_connected = True
    services: Any = None

    def __init__(self) -> None:
        self.start_notify_uuids: list[str] = []
        self.stop_notify_uuids: list[str] = []
        self.writes: list[tuple[str, bytes, bool]] = []

    async def start_notify(self, uuid: str, callback: object) -> None:
        self.start_notify_uuids.append(uuid)

    async def stop_notify(self, uuid: str) -> None:
        self.stop_notify_uuids.append(uuid)

    async def write_gatt_char(self, uuid: str, data: bytes, response: bool) -> None:
        self.writes.append((uuid, data, response))


def _connection(proxy: MatterBleProxy, handle: int) -> tuple[ConnectionState, _StubBleakClient]:
    client = _StubBleakClient()
    conn = ConnectionState(client, handle)  # type: ignore[arg-type]
    proxy._connections[handle] = conn
    return conn, client


async def test_subscribe_to_an_already_subscribed_uuid_does_not_reenter_start_notify():
    proxy, ws = _proxy()
    conn, client = _connection(proxy, 1)
    conn.subscriptions.add("fff6")

    await proxy._handle_subscribe_characteristic(3, {"connection_handle": 1, "characteristic_uuid": "fff6"})

    assert client.start_notify_uuids == []
    assert ws.sent == [{"id": 3, "success": True, "result": {}}]


async def test_unsubscribe_accepts_another_spelling_of_the_subscribed_uuid():
    proxy, ws = _proxy()
    conn, client = _connection(proxy, 1)

    await proxy._handle_subscribe_characteristic(3, {"connection_handle": 1, "characteristic_uuid": "fff6"})
    await proxy._handle_unsubscribe_characteristic(
        4, {"connection_handle": 1, "characteristic_uuid": "0000FFF6-0000-1000-8000-00805F9B34FB"}
    )

    assert client.start_notify_uuids == ["fff6"]
    assert conn.subscriptions == set()
    assert ws.sent == [
        {"id": 3, "success": True, "result": {}},
        {"id": 4, "success": True, "result": {}},
    ]


async def test_write_and_subscribe_skips_a_second_cccd_enable():
    proxy, ws = _proxy()
    conn, client = _connection(proxy, 1)
    conn.subscriptions.add("fff7")

    await proxy._handle_write_and_subscribe(
        4,
        {
            "connection_handle": 1,
            "write_uuid": "fff6",
            "write_value": "AQID",
            "write_response": True,
            "subscribe_uuid": "fff7",
        },
    )

    assert client.writes == [("fff6", b"\x01\x02\x03", True)]
    assert conn.last_write_uuid == "fff6"
    assert client.start_notify_uuids == []
    assert ws.sent == [{"id": 4, "success": True, "result": {}}]


async def test_subscription_is_tracked_without_prior_service_discovery():
    proxy, ws = _proxy()
    conn, client = _connection(proxy, 1)
    assert conn.services is None

    await proxy._handle_subscribe_characteristic(1, {"connection_handle": 1, "characteristic_uuid": "fff6"})
    await proxy._handle_subscribe_characteristic(2, {"connection_handle": 1, "characteristic_uuid": "fff6"})

    assert conn.subscriptions == {"fff6"}
    assert client.start_notify_uuids == ["fff6"]
    assert [msg["success"] for msg in ws.sent] == [True, True]


async def test_unsubscribe_works_without_prior_service_discovery():
    proxy, ws = _proxy()
    conn, client = _connection(proxy, 1)

    await proxy._handle_subscribe_characteristic(1, {"connection_handle": 1, "characteristic_uuid": "fff6"})
    await proxy._handle_unsubscribe_characteristic(2, {"connection_handle": 1, "characteristic_uuid": "fff6"})

    assert client.stop_notify_uuids == ["fff6"]
    assert conn.subscriptions == set()
    assert [msg["success"] for msg in ws.sent] == [True, True]


async def test_binary_write_data_targets_the_last_written_uuid_without_discovery():
    proxy, _ws = _proxy()
    conn, client = _connection(proxy, 1)

    await proxy._handle_write_characteristic(
        1, {"connection_handle": 1, "characteristic_uuid": "fff6", "value": "AQID"}
    )
    assert conn.last_write_uuid == "fff6"

    await proxy._handle_binary_frame(BINARY_FRAME_HEADER.pack(OPCODE_WRITE_DATA, 1) + b"\x04\x05")

    assert client.writes == [("fff6", b"\x01\x02\x03", False), ("fff6", b"\x04\x05", True)]


async def test_repeated_start_scan_with_the_same_parameters_is_satisfied_by_the_running_scan():
    proxy, ws, scan_source = _proxy_with_scan_source()
    args = {"service_uuids": ["fff6"], "allow_duplicates": False}

    await proxy._handle_start_scan(1, dict(args))
    await proxy._handle_start_scan(2, dict(args))

    assert (scan_source.starts, scan_source.stops) == (1, 0)
    assert [msg["success"] for msg in ws.sent] == [True, True]


async def test_start_scan_with_changed_parameters_rearms_the_scan():
    proxy, ws, scan_source = _proxy_with_scan_source()

    await proxy._handle_start_scan(1, {"service_uuids": ["fff6"], "allow_duplicates": False})
    first_callback = scan_source.callback

    await proxy._handle_start_scan(2, {"service_uuids": ["fff7"], "allow_duplicates": False})

    assert (scan_source.starts, scan_source.stops) == (2, 1)
    assert scan_source.callback is not first_callback
    assert [msg["success"] for msg in ws.sent] == [True, True]


async def test_start_scan_after_stop_scan_starts_a_fresh_scan():
    proxy, _ws, scan_source = _proxy_with_scan_source()
    args = {"service_uuids": ["fff6"], "allow_duplicates": False}

    await proxy._handle_start_scan(1, dict(args))
    await proxy._handle_stop_scan(2, {})
    await proxy._handle_start_scan(3, dict(args))

    assert (scan_source.starts, scan_source.stops) == (2, 1)


class _StubChar:
    def __init__(self, max_write_without_response_size: int) -> None:
        self.max_write_without_response_size = max_write_without_response_size


class _StubService:
    def __init__(self, *sizes: int) -> None:
        self.characteristics = [_StubChar(size) for size in sizes]


def _mtu_connection(
    proxy: MatterBleProxy, *, mtu_size: int | None, char_sizes: tuple[int, ...] | None
) -> _StubBleakClient:
    _conn, client = _connection(proxy, 1)
    if mtu_size is not None:
        client.mtu_size = mtu_size  # type: ignore[attr-defined]
    if char_sizes is not None:
        client.services = [_StubService(*char_sizes)]
    return client


async def test_request_mtu_derives_att_mtu_from_characteristic_write_size_when_mtu_size_is_default():
    proxy, ws = _proxy()
    _mtu_connection(proxy, mtu_size=23, char_sizes=(20, 244))

    await proxy._handle_request_mtu(5, {"connection_handle": 1})

    assert ws.sent == [{"id": 5, "success": True, "result": {"mtu": 247}}]


async def test_request_mtu_falls_back_to_23_without_any_mtu_information():
    """Characterization: the fallback the handler had before the write-size lookup."""
    proxy, ws = _proxy()
    _mtu_connection(proxy, mtu_size=None, char_sizes=None)

    await proxy._handle_request_mtu(5, {"connection_handle": 1})

    assert ws.sent == [{"id": 5, "success": True, "result": {"mtu": 23}}]


async def test_request_mtu_prefers_backend_mtu_size_over_cached_characteristic_sizes():
    proxy, ws = _proxy()
    _mtu_connection(proxy, mtu_size=185, char_sizes=(244,))

    await proxy._handle_request_mtu(5, {"connection_handle": 1})

    assert ws.sent == [{"id": 5, "success": True, "result": {"mtu": 185}}]


async def test_connect_reports_att_mtu_derived_from_characteristic_write_size(monkeypatch):
    proxy, ws = _proxy()
    stub = _StubBleakClient()
    stub.mtu_size = 23  # type: ignore[attr-defined]
    stub.services = [_StubService(244)]

    async def _connect() -> None:
        return None

    stub.connect = _connect  # type: ignore[attr-defined]
    monkeypatch.setattr("bleak.BleakClient", lambda *_args, **_kwargs: stub)

    await proxy._handle_connect(6, {"address": "AA:BB:CC:DD:EE:FF"})

    assert ws.sent[0]["result"]["mtu"] == 247


async def test_request_mtu_falls_back_to_23_when_service_discovery_has_not_completed():
    from bleak.exc import BleakError

    class _UndiscoveredClient(_StubBleakClient):
        mtu_size = 23

        @property
        def services(self) -> Any:
            raise BleakError("Service Discovery has not been performed yet")

    proxy, ws = _proxy()
    proxy._connections[1] = ConnectionState(_UndiscoveredClient(), 1)  # type: ignore[arg-type]

    await proxy._handle_request_mtu(5, {"connection_handle": 1})

    assert ws.sent == [{"id": 5, "success": True, "result": {"mtu": 23}}]
