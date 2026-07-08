"""Unit tests for ICD method → send_command translation, schema gating, and errors."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from matter_server.client import MatterClient
from matter_server.client.exceptions import ServerVersionTooOld
from matter_server.common.errors import IcdMultiAdmin, exception_from_error_code
from matter_server.common.models import APICommand, IcdStateData, ServerInfoMessage


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


_FULL_ICD_STATE = {
    "supported": True,
    "lit_supported": True,
    "registered": True,
    "operating_mode": "LIT",
    "awake": False,
    "available": True,
    "next_expected_checkin": 1735689600000,
}

_UNSUPPORTED_ICD_STATE = {
    "supported": False,
    "lit_supported": False,
    "registered": False,
    "operating_mode": None,
    "awake": None,
    "available": None,
    "next_expected_checkin": None,
}


async def test_get_icd_state_uses_schema_12() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=_FULL_ICD_STATE)
    result = await c.get_icd_state(123)
    args, kwargs = c.send_command.call_args
    assert args[0] == APICommand.GET_ICD_STATE
    assert kwargs.get("require_schema") == 12
    assert kwargs["node_id"] == 123
    assert result == IcdStateData(
        supported=True,
        lit_supported=True,
        registered=True,
        operating_mode="LIT",
        awake=False,
        available=True,
        next_expected_checkin=1735689600000,
    )


async def test_get_icd_state_unsupported_all_null() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=_UNSUPPORTED_ICD_STATE)
    result = await c.get_icd_state(123)
    assert result == IcdStateData(
        supported=False,
        lit_supported=False,
        registered=False,
        operating_mode=None,
        awake=None,
        available=None,
        next_expected_checkin=None,
    )


async def test_register_icd_no_options() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=_FULL_ICD_STATE)
    await c.register_icd(123)
    args, kwargs = c.send_command.call_args
    assert args[0] == APICommand.REGISTER_ICD
    assert kwargs.get("require_schema") == 12
    assert kwargs["node_id"] == 123
    assert "allow_multi_admin" not in kwargs
    assert "ignored_vendors" not in kwargs


async def test_register_icd_with_options() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=_FULL_ICD_STATE)
    result = await c.register_icd(123, allow_multi_admin=True, ignored_vendors=[4631, 4362])
    _, kwargs = c.send_command.call_args
    assert kwargs["allow_multi_admin"] is True
    assert kwargs["ignored_vendors"] == [4631, 4362]
    assert isinstance(result, IcdStateData)


async def test_unregister_icd_default_force() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=_UNSUPPORTED_ICD_STATE)
    result = await c.unregister_icd(123)
    args, kwargs = c.send_command.call_args
    assert args[0] == APICommand.UNREGISTER_ICD
    assert kwargs.get("require_schema") == 12
    assert kwargs["node_id"] == 123
    assert kwargs["force"] is False
    assert isinstance(result, IcdStateData)


async def test_unregister_icd_force_true() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=_UNSUPPORTED_ICD_STATE)
    await c.unregister_icd(123, force=True)
    _, kwargs = c.send_command.call_args
    assert kwargs["force"] is True


async def test_resync_icd() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=None)
    await c.resync_icd(123)
    args, kwargs = c.send_command.call_args
    assert args[0] == APICommand.RESYNC_ICD
    assert kwargs.get("require_schema") == 12
    assert kwargs["node_id"] == 123


@pytest.mark.parametrize(
    "command",
    [
        APICommand.GET_ICD_STATE,
        APICommand.REGISTER_ICD,
        APICommand.RESYNC_ICD,
        APICommand.UNREGISTER_ICD,
    ],
)
async def test_schema_gate_raises_server_version_too_old(command: APICommand) -> None:
    """Prove require_schema=12 actually enforces the gate against a schema_version=11 server."""
    c = _gated_client(schema_version=11)
    # Exercise _prepare_message directly — send_command also checks _loop before the gate.
    with pytest.raises(ServerVersionTooOld):
        c._prepare_message(command, require_schema=12, node_id=123)


def test_icd_multi_admin_error_code_mapping() -> None:
    assert exception_from_error_code(100) is IcdMultiAdmin


def test_icd_multi_admin_parses_json_details() -> None:
    details = '{"message": "Other admins may not support LIT", "admin_vendor_ids": [4631, 4362]}'
    exc = IcdMultiAdmin(details)
    assert exc.admin_vendor_ids == [4631, 4362]
    assert str(exc) == "Other admins may not support LIT"


def test_icd_multi_admin_handles_plain_text() -> None:
    exc = IcdMultiAdmin("some plain text error")
    assert exc.admin_vendor_ids == []
    assert str(exc) == "some plain text error"


def test_icd_multi_admin_handles_none() -> None:
    exc = IcdMultiAdmin()
    assert exc.admin_vendor_ids == []
    assert str(exc) == "ICD registration rejected: the peer has administrator fabrics from other vendors"


def test_icd_multi_admin_handles_json_without_message() -> None:
    exc = IcdMultiAdmin('{"admin_vendor_ids": [4631]}')
    assert exc.admin_vendor_ids == [4631]
    assert str(exc) == "ICD registration rejected: the peer has administrator fabrics from other vendors"


def test_icd_multi_admin_handles_null_message() -> None:
    exc = IcdMultiAdmin('{"message": null, "admin_vendor_ids": [4631]}')
    assert exc.admin_vendor_ids == [4631]
    assert str(exc) == "ICD registration rejected: the peer has administrator fabrics from other vendors"


def test_icd_multi_admin_handles_non_dict_json() -> None:
    exc = IcdMultiAdmin("[1, 2]")
    assert exc.admin_vendor_ids == []
    assert str(exc) == "[1, 2]"


def test_icd_multi_admin_handles_null_vendor_ids() -> None:
    exc = IcdMultiAdmin('{"message": "rejected", "admin_vendor_ids": null}')
    assert exc.admin_vendor_ids == []
    assert str(exc) == "rejected"
