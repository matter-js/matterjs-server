"""Unit tests for credential method → send_command translation and schema gating."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from matter_server.client import MatterClient
from matter_server.client.exceptions import ServerVersionTooOld
from matter_server.common.models import APICommand, ServerInfoMessage


def _bare_client() -> MatterClient:
    """Construct a MatterClient without connecting (for monkeypatching send_command)."""
    return MatterClient.__new__(MatterClient)


def _gated_client(schema_version: int) -> MatterClient:
    """Construct a MatterClient with a stub connection that reports a given schema version."""
    client = MatterClient.__new__(MatterClient)
    server_info = ServerInfoMessage(
        fabric_id=1,
        compressed_fabric_id=1,
        schema_version=schema_version,
        min_supported_schema_version=1,
        sdk_version="0.0.0",
        wifi_credentials_set=False,
        thread_credentials_set=False,
        bluetooth_enabled=False,
    )
    connection = MagicMock()
    connection.connected = True
    connection.server_info = server_info
    client.connection = connection
    return client


async def test_set_wifi_default_passes_no_schema_gate() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=None)
    await c.set_wifi_credentials("S", "C")
    c.send_command.assert_awaited_once()
    _, kwargs = c.send_command.call_args
    assert kwargs.get("require_schema") is None
    assert kwargs["ssid"] == "S"
    assert kwargs["credentials"] == "C"
    assert kwargs["id"] == "default"


async def test_set_wifi_with_id_uses_schema_12() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=None)
    await c.set_wifi_credentials("S", "C", entry_id="Garage")
    _, kwargs = c.send_command.call_args
    assert kwargs.get("require_schema") == 12
    assert kwargs["id"] == "Garage"


async def test_set_thread_default_passes_no_schema_gate() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=None)
    await c.set_thread_operational_dataset("DEADBEEF")
    _, kwargs = c.send_command.call_args
    assert kwargs.get("require_schema") is None
    assert kwargs["dataset"] == "DEADBEEF"
    assert kwargs["id"] == "default"


async def test_set_thread_with_id_uses_schema_12() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=None)
    await c.set_thread_operational_dataset("DEADBEEF", entry_id="Extra")
    _, kwargs = c.send_command.call_args
    assert kwargs.get("require_schema") == 12
    assert kwargs["id"] == "Extra"


async def test_remove_wifi_default_passes_no_schema_gate() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=None)
    await c.remove_wifi_credentials()
    _, kwargs = c.send_command.call_args
    assert kwargs.get("require_schema") is None
    assert kwargs["id"] == "default"


async def test_remove_wifi_with_id_uses_schema_12() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=None)
    await c.remove_wifi_credentials(entry_id="Garage")
    _, kwargs = c.send_command.call_args
    assert kwargs.get("require_schema") == 12
    assert kwargs["id"] == "Garage"


async def test_remove_thread_default_passes_no_schema_gate() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=None)
    await c.remove_thread_dataset()
    _, kwargs = c.send_command.call_args
    assert kwargs.get("require_schema") is None
    assert kwargs["id"] == "default"


async def test_remove_thread_with_id_uses_schema_12() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=None)
    await c.remove_thread_dataset(entry_id="Extra")
    _, kwargs = c.send_command.call_args
    assert kwargs.get("require_schema") == 12
    assert kwargs["id"] == "Extra"


async def test_get_all_credentials_uses_schema_12() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value={"wifi": [], "thread": []})
    res = await c.get_all_credentials()
    args, kwargs = c.send_command.call_args
    assert args[0] == APICommand.GET_ALL_CREDENTIALS
    assert kwargs.get("require_schema") == 12
    assert res == {"wifi": [], "thread": []}


_MINIMAL_NODE_DICT = {
    "node_id": 1,
    "date_commissioned": "2024-01-01T00:00:00",
    "last_interview": "2024-01-01T00:00:00",
    "interview_version": 1,
    "attributes": {},
    "attribute_subscriptions": [],
}


async def test_commission_with_thread_id_uses_schema_12() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=_MINIMAL_NODE_DICT)
    await c.commission_with_code("MT:x", thread_dataset_id="Extra")
    _, kwargs = c.send_command.call_args
    assert kwargs.get("require_schema") == 12
    assert kwargs["thread_dataset_id"] == "Extra"


async def test_commission_with_wifi_id_uses_schema_12() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=_MINIMAL_NODE_DICT)
    await c.commission_with_code("MT:x", wifi_credentials_id="Home")
    _, kwargs = c.send_command.call_args
    assert kwargs.get("require_schema") == 12
    assert kwargs["wifi_credentials_id"] == "Home"


async def test_commission_default_no_schema_gate() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=_MINIMAL_NODE_DICT)
    await c.commission_with_code("MT:x")
    _, kwargs = c.send_command.call_args
    assert kwargs.get("require_schema") is None
    assert "wifi_credentials_id" not in kwargs
    assert "thread_dataset_id" not in kwargs


async def test_schema_gate_raises_server_version_too_old() -> None:
    """Prove require_schema=12 actually enforces the gate against a schema_version=11 server."""
    c = _gated_client(schema_version=11)
    # Exercise _prepare_message directly — send_command also checks _loop before the gate.
    with pytest.raises(ServerVersionTooOld):
        c._prepare_message(APICommand.SET_WIFI_CREDENTIALS, require_schema=12, ssid="S", credentials="C", id="Garage")


async def test_get_thread_border_routers_uses_schema_12() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=[])
    await c.get_thread_border_routers()
    args, kwargs = c.send_command.call_args
    assert args[0] == APICommand.GET_THREAD_BORDER_ROUTERS
    assert kwargs.get("require_schema") == 12


async def test_get_thread_diagnostics_all_networks() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=[])
    await c.get_thread_diagnostics()
    args, kwargs = c.send_command.call_args
    assert args[0] == APICommand.GET_THREAD_DIAGNOSTICS
    assert kwargs.get("require_schema") == 12
    assert "ext_pan_id" not in kwargs
    assert "force" not in kwargs


async def test_get_thread_diagnostics_single_network_forced() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=None)
    await c.get_thread_diagnostics(ext_pan_id="2011201402051977", force=True)
    _, kwargs = c.send_command.call_args
    assert kwargs["ext_pan_id"] == "2011201402051977"
    assert kwargs["force"] is True
