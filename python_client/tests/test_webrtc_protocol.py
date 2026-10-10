"""Tests for the WebRTC additions to the websocket protocol model."""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING
from unittest.mock import MagicMock

import pytest

if TYPE_CHECKING:
    from matter_server.client.client import WebRtcProviderCommandName

from matter_server.client import MatterClient
from matter_server.client.exceptions import ServerVersionTooOld
from matter_server.common.helpers.util import dataclass_from_dict
from matter_server.common.models import (
    APICommand,
    CommandMessage,
    EventType,
    ServerInfoMessage,
    WebRTCCallbackData,
    WebRTCIceCandidate,
)


def test_event_type_webrtc_callback_value():
    assert EventType.WEBRTC_CALLBACK.value == "webrtc_callback"


def test_api_command_send_webrtc_provider_command_value():
    assert APICommand.SEND_WEBRTC_PROVIDER_COMMAND.value == "send_webrtc_provider_command"


def test_api_command_covers_every_camera_command():
    """The server's seven camera commands all need a name here."""
    assert {command.value for command in APICommand if command.value.startswith("camera_")} == {
        "camera_get_capabilities",
        "camera_start_stream",
        "camera_provide_answer",
        "camera_provide_ice_candidates",
        "camera_stop_stream",
        "camera_snapshot",
        "camera_release_stream",
    }


def test_webrtc_callback_data_parses_from_the_wire():
    wire = {
        "event_type": "end",
        "webrtc_session_id": 5,
        "node_id": 100,
        "endpoint_id": 2,
        "fabric_index": 1,
        "data": {"reason": 3},
    }
    payload = dataclass_from_dict(WebRTCCallbackData, wire)
    assert payload.event_type == "end"
    assert payload.data == {"reason": 3}


def test_webrtc_callback_data_roundtrip():
    payload = WebRTCCallbackData(
        event_type="answer",
        webrtc_session_id=5,
        node_id=100,
        endpoint_id=2,
        fabric_index=1,
        data={"sdp": "v=0"},
    )
    assert payload.event_type == "answer"
    assert payload.webrtc_session_id == 5
    assert payload.data == {"sdp": "v=0"}


def test_webrtc_ice_candidate_optional_fields():
    c = WebRTCIceCandidate(candidate="candidate:foo")
    assert c.sdpMid is None
    assert c.sdpMLineIndex is None


def _signalling_client(schema_version: int) -> MatterClient:
    """A client that reports a schema version and answers every command with None."""
    client = MatterClient.__new__(MatterClient)
    client._result_futures = {}
    client._loop = asyncio.get_running_loop()
    connection = MagicMock()
    connection.connected = True
    connection.server_info = ServerInfoMessage(
        fabric_id=1,
        compressed_fabric_id=1,
        schema_version=schema_version,
        min_supported_schema_version=1,
        sdk_version="0.0.0",
        wifi_credentials_set=False,
        thread_credentials_set=False,
        bluetooth_enabled=False,
    )

    async def send_message(message: CommandMessage) -> None:
        client._result_futures[message.message_id].set_result(None)

    connection.send_message = send_message
    client.connection = connection
    return client


@pytest.mark.parametrize("command_name", ["ProvideAnswer", "ProvideIceCandidates"])
async def test_signalling_variants_require_schema_14(
    command_name: WebRtcProviderCommandName,
) -> None:
    """A schema 13 server does not relay them, so the client must refuse before sending."""
    client = _signalling_client(schema_version=13)
    with pytest.raises(ServerVersionTooOld):
        await client.send_webrtc_provider_command(1, 1, command_name, {})

    client = _signalling_client(schema_version=14)
    assert await client.send_webrtc_provider_command(1, 1, command_name, {}) is None


@pytest.mark.parametrize("command_name", ["ProvideOffer", "SolicitOffer"])
async def test_offer_variants_still_require_only_schema_12(
    command_name: WebRtcProviderCommandName,
) -> None:
    """They have been relayed since schema 12 and must not be gated behind 14."""
    client = _signalling_client(schema_version=12)
    assert await client.send_webrtc_provider_command(1, 1, command_name, {}) is None
