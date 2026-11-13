"""Unit tests for thermostat-preset method → send_command translation and schema gating."""

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


async def test_set_thermostat_preset_create_omits_unset_fields() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=None)
    await c.set_thermostat_preset(123, 1, preset_scenario=4)
    args, kwargs = c.send_command.call_args
    assert args[0] == APICommand.SET_THERMOSTAT_PRESET
    assert kwargs.get("require_schema") == 15
    assert kwargs["node_id"] == 123
    assert kwargs["endpoint_id"] == 1
    assert kwargs["preset_handle"] is None
    assert kwargs["preset_scenario"] == 4
    assert "name" not in kwargs
    assert "heating_setpoint" not in kwargs
    assert "cooling_setpoint" not in kwargs


async def test_set_thermostat_preset_distinguishes_omit_from_null() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=None)
    await c.set_thermostat_preset(123, 1, preset_handle="abc", name=None, heating_setpoint=2100)
    _, kwargs = c.send_command.call_args
    assert kwargs["name"] is None
    assert kwargs["heating_setpoint"] == 2100
    assert "cooling_setpoint" not in kwargs


async def test_clear_thermostat_preset() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=None)
    await c.clear_thermostat_preset(123, 1, "abc")
    args, kwargs = c.send_command.call_args
    assert args[0] == APICommand.CLEAR_THERMOSTAT_PRESET
    assert kwargs.get("require_schema") == 15
    assert kwargs["node_id"] == 123
    assert kwargs["endpoint_id"] == 1
    assert kwargs["preset_handle"] == "abc"


async def test_set_active_preset_clears_with_none() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=None)
    await c.set_active_preset(123, 1, None)
    args, kwargs = c.send_command.call_args
    assert args[0] == APICommand.SET_ACTIVE_PRESET
    assert kwargs.get("require_schema") == 15
    assert kwargs["preset_handle"] is None


@pytest.mark.parametrize(
    "command",
    [
        APICommand.SET_THERMOSTAT_PRESET,
        APICommand.CLEAR_THERMOSTAT_PRESET,
        APICommand.SET_ACTIVE_PRESET,
    ],
)
async def test_schema_gate_raises_server_version_too_old(command: APICommand) -> None:
    """Prove require_schema=15 actually enforces the gate against a schema_version=14 server."""
    c = _gated_client(schema_version=14)
    # Exercise _prepare_message directly — send_command also checks _loop before the gate.
    with pytest.raises(ServerVersionTooOld):
        c._prepare_message(command, require_schema=15, node_id=123, endpoint_id=1)
