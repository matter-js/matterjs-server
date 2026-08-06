"""Unit tests for the two-step OTA firmware upload (schema 13)."""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import AsyncMock, MagicMock

import pytest

from matter_server.client import MatterClient
from matter_server.client.connection import MatterClientConnection
from matter_server.client.exceptions import InvalidMessage
from matter_server.common.errors import MatterError, OtaUploadError
from matter_server.common.models import APICommand, MatterSoftwareVersion, UpdateSource

if TYPE_CHECKING:
    from pathlib import Path

_UPLOAD_ID = "0123456789abcdef0123456789abcdef"
_MAX_SIZE = 1024
_TICKET = {"upload_id": _UPLOAD_ID, "expires_in": 60, "max_size": _MAX_SIZE}

_STORED = {
    "vid": 65521,
    "pid": 32768,
    "software_version": 3,
    "software_version_string": "3.0",
    "min_applicable_software_version": 0,
    "max_applicable_software_version": 2,
    "release_notes_url": None,
    "update_source": "local",
}


def _client(
    post_result: tuple[int, dict | None],
) -> tuple[MatterClient, AsyncMock, AsyncMock]:
    """Client whose WebSocket hands out a ticket and whose POST returns a canned result.

    Returns the client plus the send_command and post_ota_upload mocks to assert on.
    """
    client = MatterClient.__new__(MatterClient)
    send_command = AsyncMock(return_value=_TICKET)
    client.send_command = send_command
    post_ota_upload = AsyncMock(return_value=post_result)
    connection = MagicMock()
    connection.post_ota_upload = post_ota_upload
    client.connection = connection
    return client, send_command, post_ota_upload


def test_upload_url_derives_from_the_websocket_url() -> None:
    session = MagicMock()
    upload_id = _UPLOAD_ID

    assert (
        MatterClientConnection("ws://host:5580/ws", session).ota_upload_url(upload_id)
        == f"http://host:5580/ota-upload/{upload_id}"
    )
    assert (
        MatterClientConnection("wss://host/matter/ws", session).ota_upload_url(upload_id)
        == f"https://host/matter/ota-upload/{upload_id}"
    )
    assert (
        MatterClientConnection("ws://host:5580", session).ota_upload_url(upload_id)
        == f"http://host:5580/ota-upload/{upload_id}"
    )


async def test_upload_reserves_an_id_with_schema_13_then_posts_the_bytes() -> None:
    client, send_command, post_ota_upload = _client((200, _STORED))

    result = await client.upload_ota_file(b"\x00" * 64)

    args, kwargs = send_command.call_args
    assert args[0] == APICommand.INITIATE_OTA_UPLOAD
    assert kwargs.get("require_schema") == 13
    post_ota_upload.assert_awaited_once_with(_UPLOAD_ID, b"\x00" * 64)
    assert result == MatterSoftwareVersion(
        vid=65521,
        pid=32768,
        software_version=3,
        software_version_string="3.0",
        firmware_information=None,
        min_applicable_software_version=0,
        max_applicable_software_version=2,
        release_notes_url=None,
        update_source=UpdateSource.LOCAL,
    )


async def test_upload_reads_the_image_from_a_path(tmp_path: Path) -> None:
    image = tmp_path / "firmware.ota"
    image.write_bytes(b"\x01\x02\x03")
    client, _, post_ota_upload = _client((200, _STORED))

    await client.upload_ota_file(image)

    post_ota_upload.assert_awaited_once_with(_UPLOAD_ID, b"\x01\x02\x03")


async def test_upload_leaves_the_size_limit_to_the_server() -> None:
    """A reservation cannot be handed back, so an oversized image must not be caught locally."""
    client, _, post_ota_upload = _client(
        (413, {"error": "Firmware image exceeds the 64 MB limit"})
    )

    with pytest.raises(MatterError, match="exceeds the 64 MB limit"):
        await client.upload_ota_file(b"\x00" * (_MAX_SIZE + 1))

    post_ota_upload.assert_awaited_once()


async def test_upload_maps_the_server_error_code_to_its_exception() -> None:
    client, _, _ = _client((400, {"error_code": 101, "message": "Invalid OTA image header"}))

    with pytest.raises(OtaUploadError, match="Invalid OTA image header"):
        await client.upload_ota_file(b"\x00" * 8)


async def test_upload_reports_an_error_response_without_an_error_code() -> None:
    client, _, _ = _client((413, {"error": "Firmware image exceeds the 64 MB limit"}))

    with pytest.raises(MatterError, match="exceeds the 64 MB limit"):
        await client.upload_ota_file(b"\x00" * 8)


async def test_upload_reports_a_non_json_error_response() -> None:
    client, _, _ = _client((502, None))

    with pytest.raises(MatterError, match="HTTP 502"):
        await client.upload_ota_file(b"\x00" * 8)


async def test_upload_reports_a_non_json_success_response() -> None:
    client, _, _ = _client((200, None))

    with pytest.raises(InvalidMessage):
        await client.upload_ota_file(b"\x00" * 8)
