"""Integration tests: Python MatterClient against JS MockMatterServer."""

from __future__ import annotations

import asyncio

import aiohttp
import pytest


@pytest.fixture
async def client_session():
    """Create an aiohttp client session."""
    async with aiohttp.ClientSession() as session:
        yield session


@pytest.mark.asyncio
async def test_connect_and_receive_server_info(mock_server, client_session):
    """Client connects and receives ServerInfoMessage from JS mock server."""
    from matter_server.client import MatterClient

    client = MatterClient(mock_server.url, client_session)
    await client.connect()

    assert client.server_info is not None
    assert client.server_info.schema_version == 11
    assert client.server_info.sdk_version == "2025.1.0"
    assert client.server_info.fabric_id is not None

    await client.disconnect()


@pytest.mark.asyncio
async def test_start_listening(mock_server, client_session):
    """Client can call start_listening and receive empty node list."""
    from matter_server.client import MatterClient

    client = MatterClient(mock_server.url, client_session)

    init_ready = asyncio.Event()
    listen_task = asyncio.create_task(client.start_listening(init_ready))

    async with asyncio.timeout(10):
        await init_ready.wait()

    nodes = client.get_nodes()
    assert isinstance(nodes, list)
    assert len(nodes) == 0

    await client.disconnect()
    listen_task.cancel()
    try:
        await listen_task
    except asyncio.CancelledError:
        pass


@pytest.mark.asyncio
async def test_send_command_and_receive_response(mock_server, client_session):
    """Client sends a command and receives the result via the listen loop."""
    from matter_server.client import MatterClient

    mock_server.register_command("diagnostics", {"info": "test"})
    # Small delay for the command to be registered on the mock server
    await asyncio.sleep(0.1)

    client = MatterClient(mock_server.url, client_session)

    # start_listening must be running to process command responses
    init_ready = asyncio.Event()
    listen_task = asyncio.create_task(client.start_listening(init_ready))

    async with asyncio.timeout(10):
        await init_ready.wait()

    result = await client.send_command("diagnostics")
    assert result == {"info": "test"}

    await client.disconnect()
    listen_task.cancel()
    try:
        await listen_task
    except asyncio.CancelledError:
        pass


@pytest.mark.asyncio
async def test_disconnect(mock_server, client_session):
    """Client connects and disconnects cleanly."""
    from matter_server.client import MatterClient

    client = MatterClient(mock_server.url, client_session)
    await client.connect()
    assert client.connection.connected

    await client.disconnect()
    assert not client.connection.connected
