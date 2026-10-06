"""Tests for connecting the Python client over a unix socket (`unix://<path>` server URL)."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
import tempfile
from typing import TYPE_CHECKING, Any
from unittest.mock import AsyncMock

from aiohttp import ClientSession, web
import pytest

from matter_server.client import connection as connection_module
from matter_server.client.connection import MatterClientConnection
from matter_server.client.exceptions import (
    CannotConnect,
    InvalidMessage,
    NotConnected,
    ServerVersionTooNew,
)
from matter_server.common.const import SCHEMA_VERSION

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator, Generator

SERVER_INFO = {
    "fabric_id": 1,
    "compressed_fabric_id": 2,
    "schema_version": SCHEMA_VERSION,
    "min_supported_schema_version": SCHEMA_VERSION,
    "sdk_version": "test",
    "wifi_credentials_set": False,
    "thread_credentials_set": False,
    "bluetooth_enabled": False,
}


@pytest.fixture
def socket_path() -> Generator[Path]:
    """Return a short socket path; macOS limits unix socket paths to 104 bytes."""
    with tempfile.TemporaryDirectory(prefix="mpc-", dir="/tmp") as directory:
        yield Path(directory) / "ws.sock"


@pytest.fixture
def first_message() -> str:
    """Return the text the server sends when a WebSocket opens; parametrize to override."""
    return json.dumps(SERVER_INFO)


@pytest.fixture
async def unix_server(
    socket_path: Path, first_message: str
) -> AsyncGenerator[list[bytes]]:
    """Serve /ws and /ota-upload on a unix socket; yield the received OTA bodies."""
    uploads: list[bytes] = []

    async def ws_handler(request: web.Request) -> web.WebSocketResponse:
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        await ws.send_str(first_message)
        async for _ in ws:
            pass
        return ws

    async def ota_handler(request: web.Request) -> web.Response:
        uploads.append(await request.read())
        return web.json_response({"upload_id": request.match_info["upload_id"]})

    app = web.Application()
    app.router.add_get("/ws", ws_handler)
    app.router.add_post("/ota-upload/{upload_id}", ota_handler)
    # The client fixture may tear down after this one; don't wait for its connection to close.
    runner = web.AppRunner(app, shutdown_timeout=0.1)
    await runner.setup()
    await web.UnixSite(runner, str(socket_path)).start()
    yield uploads
    await runner.cleanup()


@pytest.fixture
async def tcp_session() -> ClientSession:
    """Return a closed session: any request through it raises, so it proves the socket was used."""
    session = ClientSession()
    await session.close()
    return session


@pytest.fixture
async def connection(
    socket_path: Path, tcp_session: ClientSession
) -> AsyncGenerator[MatterClientConnection]:
    """Return a connection for the socket URL; disconnects on teardown so a failing test cannot hang."""
    connection = MatterClientConnection(f"unix://{socket_path}", tcp_session)
    yield connection
    await connection.disconnect()


@pytest.fixture
def created_sessions(monkeypatch: pytest.MonkeyPatch) -> list[ClientSession]:
    """Record every ClientSession the connection module creates."""
    sessions: list[ClientSession] = []

    def recording_session(*args: Any, **kwargs: Any) -> ClientSession:
        session = ClientSession(*args, **kwargs)
        sessions.append(session)
        return session

    monkeypatch.setattr(connection_module, "ClientSession", recording_session)
    return sessions


@pytest.mark.usefixtures("unix_server")
async def test_connect_over_unix_socket(connection: MatterClientConnection) -> None:
    """Client connects through the socket and receives the server info."""
    await connection.connect()

    assert connection.connected
    assert connection.server_info is not None
    assert connection.server_info.sdk_version == "test"


async def test_ota_upload_over_unix_socket(
    connection: MatterClientConnection, unix_server: list[bytes]
) -> None:
    """The OTA upload POST goes through the socket."""
    await connection.connect()

    status, body = await connection.post_ota_upload("abc", b"firmware")

    assert status == 200
    assert body == {"upload_id": "abc"}
    assert unix_server == [b"firmware"]


@pytest.mark.usefixtures("unix_server")
async def test_disconnect_closes_socket_session(
    connection: MatterClientConnection, created_sessions: list[ClientSession]
) -> None:
    """The session bound to the socket is closed on disconnect."""
    await connection.connect()
    await connection.disconnect()

    assert len(created_sessions) == 1
    assert created_sessions[0].closed


async def test_failed_connect_closes_socket_session(
    connection: MatterClientConnection, created_sessions: list[ClientSession]
) -> None:
    """A connect attempt while the server is down leaves no open session behind."""
    with pytest.raises(CannotConnect):
        await connection.connect()

    assert len(created_sessions) == 1
    assert created_sessions[0].closed


@pytest.mark.usefixtures("unix_server")
@pytest.mark.parametrize(
    ("first_message", "error"),
    [
        (
            json.dumps({**SERVER_INFO, "min_supported_schema_version": SCHEMA_VERSION + 1}),
            ServerVersionTooNew,
        ),
        ("not json", InvalidMessage),
    ],
    ids=["incompatible-schema", "invalid-json"],
)
async def test_rejected_connect_leaves_connection_disconnected(
    connection: MatterClientConnection,
    created_sessions: list[ClientSession],
    error: type[Exception],
) -> None:
    """A connect that fails after the WebSocket opened closes it and its session."""
    with pytest.raises(error):
        await connection.connect()

    assert not connection.connected
    assert len(created_sessions) == 1
    assert created_sessions[0].closed
    with pytest.raises(NotConnected):
        await connection.post_ota_upload("abc", b"firmware")


@pytest.mark.usefixtures("unix_server")
async def test_cancelled_disconnect_still_resets_connection(
    connection: MatterClientConnection, created_sessions: list[ClientSession]
) -> None:
    """A cancel while the WebSocket closes still closes the session and allows a new connect."""
    await connection.connect()
    ws_client = connection._ws_client
    assert ws_client is not None
    ws_client.close = AsyncMock(side_effect=asyncio.CancelledError)

    with pytest.raises(asyncio.CancelledError):
        await connection.disconnect()

    assert not connection.connected
    assert created_sessions[0].closed
    await connection.connect()
    assert connection.connected
