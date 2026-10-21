"""Tests for matter_server.client.client.MatterClient."""

from __future__ import annotations

import asyncio
import json
from typing import TYPE_CHECKING
from unittest.mock import AsyncMock, MagicMock

import pytest

from chip.clusters import Objects as clusters
from chip.clusters.Types import NullValue
from matter_server.client.client import MatterClient
from matter_server.client.connection import MatterClientConnection, parse_message
from matter_server.common.const import SCHEMA_VERSION
from matter_server.common.errors import CameraStreamIncompatible, IcdMultiAdmin, NodeCommissionFailed
from matter_server.common.models import (
    APICommand,
    BatchedCommandResult,
    CommandMessage,
    ErrorResultMessage,
    MessageType,
    ServerInfoMessage,
    SuccessResultMessage,
)

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable


def _make_client() -> MatterClient:
    return MatterClient(ws_server_url="ws://example.invalid/ws", aiohttp_session=MagicMock())


@pytest.mark.parametrize(
    "message",
    [
        SuccessResultMessage(message_id="late-result", result={"ok": True}),
        ErrorResultMessage(message_id="late-result", error_code=1, details="late error"),
    ],
    ids=["success", "error"],
)
@pytest.mark.parametrize("done_state", ["cancelled", "resolved"])
async def test_handle_incoming_message_ignores_result_for_done_future(
    message: SuccessResultMessage | ErrorResultMessage, done_state: str
) -> None:
    client = _make_client()
    future = asyncio.get_running_loop().create_future()
    client._result_futures[message.message_id] = future

    if done_state == "cancelled":
        future.cancel()
    else:
        future.set_result("existing result")

    client._handle_incoming_message(message)

    if done_state == "cancelled":
        assert future.cancelled()
    else:
        assert future.result() == "existing result"


async def test_handle_incoming_message_resolves_pending_success() -> None:
    client = _make_client()
    future = asyncio.get_running_loop().create_future()
    client._result_futures["pending-success"] = future

    client._handle_incoming_message(SuccessResultMessage(message_id="pending-success", result={"ok": True}))

    assert future.result() == {"ok": True}


async def test_handle_incoming_message_rejects_pending_error() -> None:
    client = _make_client()
    future = asyncio.get_running_loop().create_future()
    client._result_futures["pending-error"] = future

    client._handle_incoming_message(
        ErrorResultMessage(message_id="pending-error", error_code=1, details="expected error")
    )

    error = future.exception()
    assert type(error) is NodeCommissionFailed
    assert str(error) == "expected error"


async def test_handle_incoming_message_keeps_status_and_reason_of_error() -> None:
    client = _make_client()
    future = asyncio.get_running_loop().create_future()
    client._result_futures["pending-error"] = future

    client._handle_incoming_message(
        parse_message(
            {
                "message_id": "pending-error",
                "error_code": 1,
                "details": "rejected",
                "status": 1,
                "cluster_status": 3,
                "reason": "timeout",
            }
        )
    )

    error = future.exception()
    assert isinstance(error, NodeCommissionFailed)
    assert (error.status, error.cluster_status, error.reason) == (1, 3, "timeout")


async def test_handle_incoming_message_leaves_absent_error_fields_unset() -> None:
    client = _make_client()
    future = asyncio.get_running_loop().create_future()
    client._result_futures["pending-error"] = future

    client._handle_incoming_message(parse_message({"message_id": "pending-error", "error_code": 100}))

    error = future.exception()
    assert isinstance(error, IcdMultiAdmin)
    assert (error.status, error.cluster_status, error.reason) == (None, None, None)


async def test_handle_incoming_message_keeps_the_camera_reason_from_the_details() -> None:
    client = _make_client()
    future = asyncio.get_running_loop().create_future()
    client._result_futures["pending-error"] = future
    details = json.dumps(
        {"message": "no shared codec", "reason": "codec", "device": ["H264"], "requested": ["H265"]}
    )

    client._handle_incoming_message(
        parse_message({"message_id": "pending-error", "error_code": 102, "details": details})
    )

    error = future.exception()
    assert isinstance(error, CameraStreamIncompatible)
    assert error.reason == "codec"


async def test_write_attribute_sends_tag_keyed_value() -> None:
    """write_attribute must route struct values through dataclass_to_tag_dict.

    send_command must receive TLV-tag keys ("0".."5"), not field names, or the
    server rejects the write with INVALID_DATA_TYPE.
    """
    client = MatterClient(ws_server_url="ws://example.invalid/ws", aiohttp_session=MagicMock())
    client.send_command = AsyncMock(return_value=None)

    preset = clusters.Thermostat.Structs.PresetStruct(
        presetHandle=b"\x01",
        presetScenario=clusters.Thermostat.Enums.PresetScenarioEnum.kOccupied,
        name=None,
        coolingSetpoint=2500,
        heatingSetpoint=2100,
        builtIn=True,
    )

    await client.write_attribute(node_id=1, attribute_path="1/513/80", value=preset)

    client.send_command.assert_awaited_once_with(
        APICommand.WRITE_ATTRIBUTE,
        require_schema=4,
        node_id=1,
        attribute_path="1/513/80",
        value={
            "0": b"\x01",
            "1": clusters.Thermostat.Enums.PresetScenarioEnum.kOccupied,
            "3": 2500,
            "4": 2100,
            "5": True,
        },
    )


async def test_write_attribute_sends_timed_request_timeout_with_schema_14() -> None:
    client = MatterClient(ws_server_url="ws://example.invalid/ws", aiohttp_session=MagicMock())
    client.send_command = AsyncMock(return_value=[])

    await client.write_attribute(
        node_id=1, attribute_path="*/6/16385", value=5, timed_request_timeout_ms=2000
    )

    client.send_command.assert_awaited_once_with(
        APICommand.WRITE_ATTRIBUTE,
        require_schema=14,
        node_id=1,
        attribute_path="*/6/16385",
        value=5,
        timed_request_timeout_ms=2000,
    )


async def test_send_batched_device_commands_sends_one_request_and_parses_results() -> None:
    client = MatterClient(ws_server_url="ws://example.invalid/ws", aiohttp_session=MagicMock())
    client.send_command = AsyncMock(
        return_value=[{"status": 0}, {"status": 1, "cluster_status": 3, "response": {"a": 1}}]
    )

    results = await client.send_batched_device_commands(
        node_id=1,
        commands=[(1, clusters.OnOff.Commands.On()), (2, clusters.OnOff.Commands.Toggle())],
        timed_request_timeout_ms=500,
    )

    assert results == [
        BatchedCommandResult(status=0),
        BatchedCommandResult(status=1, cluster_status=3, response={"a": 1}),
    ]
    client.send_command.assert_awaited_once_with(
        APICommand.BATCHED_DEVICE_COMMANDS,
        require_schema=14,
        node_id=1,
        commands=[
            {"endpoint_id": 1, "cluster_id": 6, "command_name": "On", "payload": {}},
            {"endpoint_id": 2, "cluster_id": 6, "command_name": "Toggle", "payload": {}},
        ],
        timed_request_timeout_ms=500,
        interaction_timeout_ms=None,
    )


async def test_handle_incoming_message_ignores_result_without_listener() -> None:
    client = _make_client()
    unrelated = asyncio.get_running_loop().create_future()
    client._result_futures["other"] = unrelated

    client._handle_incoming_message(SuccessResultMessage(message_id="unknown", result={"ok": True}))

    assert client._result_futures == {"other": unrelated}
    assert not unrelated.done()


_FAKE_SERVER_SCHEMA_VERSION = 13


class _FakeConnection(MatterClientConnection):
    """Connection stub driving the client read loop from an in-memory queue."""

    def __init__(self, send_error: Exception | None = None) -> None:
        super().__init__(ws_server_url="ws://example.invalid/ws", aiohttp_session=MagicMock())
        self.sent = list[CommandMessage]()
        self.send_error = send_error
        self.is_connected = False
        self.on_receive: Callable[[], Awaitable[None]] | None = None
        self.message_sent = asyncio.Event()
        self._incoming = asyncio.Queue[MessageType]()

    @property
    def connected(self) -> bool:
        return self.is_connected

    async def connect(self) -> None:
        self.is_connected = True
        self.server_info = ServerInfoMessage(
            fabric_id=1,
            compressed_fabric_id=1,
            schema_version=_FAKE_SERVER_SCHEMA_VERSION,
            min_supported_schema_version=SCHEMA_VERSION,
            sdk_version="test",
            wifi_credentials_set=False,
            thread_credentials_set=False,
            bluetooth_enabled=False,
        )

    async def disconnect(self) -> None:
        self.is_connected = False

    async def send_message(self, message: CommandMessage) -> None:
        if self.send_error is not None:
            raise self.send_error
        self.sent.append(message)
        self.message_sent.set()

    async def receive_message_or_raise(self) -> MessageType:
        message = await self._incoming.get()
        if self.on_receive is not None:
            await self.on_receive()
        return message

    def deliver(self, message: MessageType) -> None:
        self._incoming.put_nowait(message)


async def test_send_command_forgets_the_future_when_the_send_fails() -> None:
    client = _make_client()
    connection = _FakeConnection(send_error=ConnectionResetError("Cannot write to closing transport"))
    connection.is_connected = True
    client.connection = connection
    client._loop = asyncio.get_running_loop()

    with pytest.raises(ConnectionResetError):
        await client.send_command(APICommand.SERVER_DIAGNOSTICS)

    assert client._result_futures == {}


async def test_late_result_after_disconnect_keeps_the_read_loop_alive(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level("DEBUG", logger="matter_server.client")
    client = _make_client()
    connection = _FakeConnection()
    client.connection = connection

    init_ready = asyncio.Event()
    listen_task = asyncio.create_task(client.start_listening(init_ready))
    connection.deliver(SuccessResultMessage(message_id="start-listening", result=[]))
    await asyncio.wait_for(init_ready.wait(), timeout=1)

    connection.message_sent.clear()
    command_task = asyncio.create_task(client.send_command(APICommand.SERVER_DIAGNOSTICS))
    await asyncio.wait_for(connection.message_sent.wait(), timeout=1)
    message_id = next(iter(client._result_futures))

    # disconnect must land between the wire read and the handler, or the race cannot occur
    connection.on_receive = client.disconnect
    connection.deliver(SuccessResultMessage(message_id=message_id, result={"late": True}))

    await asyncio.wait_for(listen_task, timeout=1)
    with pytest.raises(asyncio.CancelledError):
        await command_task
    assert client._result_futures == {}
    assert f"Result arrived for already settled message id {message_id}" in caplog.text


_WIFI = clusters.NetworkCommissioning.Bitmaps.Feature.kWiFiNetworkInterface
_THREAD = clusters.NetworkCommissioning.Bitmaps.Feature.kThreadNetworkInterface
_ETHERNET = clusters.NetworkCommissioning.Bitmaps.Feature.kEthernetNetworkInterface
_XPAN_ID = b"\x01\x23\x45\x67\x89\xab\xcd\xef"


@pytest.mark.parametrize(
    ("interface_type", "feature_map", "thread_name", "last_network_id", "networks", "expected"),
    [
        ("thread", _THREAD, "TestThreadNetwork", _XPAN_ID, [], "TestThreadNetwork"),
        ("thread", _THREAD, NullValue, _XPAN_ID, [(True, _XPAN_ID)], None),
        ("thread", _THREAD, None, _XPAN_ID, [(True, _XPAN_ID)], None),
        ("wifi", _WIFI, None, b"HomeWiFi", [], "HomeWiFi"),
        ("wifi", _WIFI, None, None, [(False, b"OtherWiFi"), (True, b"BackupWiFi")], "BackupWiFi"),
        ("wifi", _THREAD, None, _XPAN_ID, [(True, _XPAN_ID)], None),
        ("wifi", None, None, b"HomeWiFi", [(True, b"HomeWiFi")], None),
        ("unknown", _WIFI, None, b"HomeWiFi", [], "HomeWiFi"),
        ("unknown", _THREAD, None, _XPAN_ID, [(True, _XPAN_ID)], None),
        ("ethernet", _ETHERNET, None, b"eth0", [(True, b"eth0")], None),
        ("ethernet", _WIFI, None, b"HomeWiFi", [(True, b"HomeWiFi")], None),
    ],
    ids=[
        "thread-diagnostics-name",
        "thread-null-network-name",
        "thread-without-diagnostics-cluster",
        "wifi-last-network-id",
        "wifi-connected-network",
        "wifi-with-thread-commissioning",
        "wifi-without-network-commissioning",
        "unknown-interface-wifi-commissioning",
        "unknown-interface-thread-commissioning",
        "ethernet-no-ssid",
        "ethernet-with-wifi-commissioning",
    ],
)
async def test_node_diagnostics_network_name(
    interface_type: str,
    feature_map: int | None,
    thread_name: object,
    last_network_id: bytes | None,
    networks: list[tuple[bool, bytes]],
    expected: str | None,
) -> None:
    """Only Wi-Fi NetworkIDs are decoded as network names; Thread names come from the diagnostics cluster."""
    client = _make_client()
    node = MagicMock()
    node.available = True
    node.node_data.is_bridge = False
    interface_enum = clusters.GeneralDiagnostics.Enums.InterfaceTypeEnum
    interface_types = {
        "thread": interface_enum.kThread,
        "wifi": interface_enum.kWiFi,
        "ethernet": interface_enum.kEthernet,
    }
    interfaces = []
    if interface_type in interface_types:
        interface = MagicMock(
            isOperational=True,
            type=interface_types[interface_type],
            hardwareAddress=b"\x01\x02\x03\x04\x05\x06",
        )
        interfaces.append(interface)
    network_attrs = clusters.NetworkCommissioning.Attributes

    def attribute_value(endpoint: int, cluster: object, attribute: object) -> object:
        if attribute == clusters.GeneralDiagnostics.Attributes.NetworkInterfaces:
            return interfaces
        if attribute == network_attrs.FeatureMap:
            return feature_map
        if attribute == network_attrs.LastNetworkID:
            return last_network_id
        if attribute == network_attrs.Networks:
            return [MagicMock(connected=connected, networkID=network_id) for connected, network_id in networks]
        if attribute == clusters.OperationalCredentials.Attributes.CurrentFabricIndex:
            return 1
        return None

    node.get_attribute_value.side_effect = attribute_value
    node.get_cluster.return_value = (
        MagicMock(
            networkName=thread_name,
            routingRole=clusters.ThreadNetworkDiagnostics.Enums.RoutingRoleEnum.kEndDevice,
        )
        if thread_name is not None
        else None
    )
    client.get_node = MagicMock(return_value=node)
    client.get_node_ip_addresses = AsyncMock(return_value=["fd00::1"])
    client.get_matter_fabrics = AsyncMock(return_value=[])

    diagnostics = await client.node_diagnostics(42)

    assert diagnostics.network_name == expected
    assert diagnostics.network_type.name == interface_type.upper()
