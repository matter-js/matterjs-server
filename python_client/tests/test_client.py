"""Tests for matter_server.client.client.MatterClient."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from chip.clusters import Objects as clusters
from matter_server.client.client import MatterClient
from matter_server.common.errors import MatterError
from matter_server.common.models import APICommand, ErrorResultMessage, SuccessResultMessage


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
    assert isinstance(error, MatterError)
    assert str(error) == "expected error"


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
