"""Unit tests for the network topology command, schema gating, and event parsing."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from matter_server.client import MatterClient
from matter_server.client.exceptions import ServerVersionTooOld
from matter_server.common.models import (
    APICommand,
    EventMessage,
    EventType,
    NetworkTopology,
    NetworkTopologyConnection,
    NetworkTopologyNode,
    ServerInfoMessage,
    TopologyDirectionInfo,
)


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


_WIRE_TOPOLOGY = {
    "collected_at": 1767888000000,
    "nodes": [
        {
            "id": "1",
            "kind": "matter",
            "network_type": "thread",
            "node_id": 1,
            "role": "leader",
            "available": True,
            "ext_address": "AABBCCDDEEFF0001",
            "rloc16": 1024,
            "ext_pan_id": "1122334455667788",
            "network_name": "OpenThread",
        },
        {
            "id": "br_1122AABBCC334455",
            "kind": "border_router",
            "network_type": "thread",
            "role": "router",
            "ext_address": "1122AABBCC334455",
            "vendor_name": "Apple",
            "last_seen": 1767887990000,
        },
        {"id": "5", "kind": "matter", "network_type": "wifi", "node_id": 5, "role": "station"},
        {"id": "ap_112233445566", "kind": "wifi_ap", "network_type": "wifi", "role": "ap"},
    ],
    "connections": [
        {
            "source": "1",
            "target": "br_1122AABBCC334455",
            "network": "thread",
            "strength": "medium",
            "source_to_target": {"strength": "medium", "lqi": 2, "rssi": -70},
        },
        {
            "source": "5",
            "target": "ap_112233445566",
            "network": "wifi",
            "strength": "strong",
            "source_to_target": {"strength": "strong", "rssi": -55},
        },
    ],
}


async def test_get_network_topology_uses_schema_13() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=_WIRE_TOPOLOGY)
    result = await c.get_network_topology()
    args, kwargs = c.send_command.call_args
    assert args[0] == APICommand.GET_NETWORK_TOPOLOGY
    assert kwargs.get("require_schema") == 13
    assert kwargs.get("refresh") is False

    assert isinstance(result, NetworkTopology)
    assert result.collected_at == 1767888000000
    assert [n.id for n in result.nodes] == ["1", "br_1122AABBCC334455", "5", "ap_112233445566"]
    node1 = result.nodes[0]
    assert node1 == NetworkTopologyNode(
        id="1",
        kind="matter",
        network_type="thread",
        node_id=1,
        role="leader",
        available=True,
        ext_address="AABBCCDDEEFF0001",
        rloc16=1024,
        ext_pan_id="1122334455667788",
        network_name="OpenThread",
    )
    thread_link = result.connections[0]
    assert thread_link == NetworkTopologyConnection(
        source="1",
        target="br_1122AABBCC334455",
        network="thread",
        strength="medium",
        source_to_target=TopologyDirectionInfo(strength="medium", lqi=2, rssi=-70),
    )
    assert thread_link.target_to_source is None


async def test_get_network_topology_refresh_passthrough() -> None:
    c = _bare_client()
    c.send_command = AsyncMock(return_value=_WIRE_TOPOLOGY)
    await c.get_network_topology(refresh=True)
    _, kwargs = c.send_command.call_args
    assert kwargs.get("refresh") is True


def test_get_network_topology_rejected_on_schema_12() -> None:
    """Prove require_schema=13 actually enforces the gate against a schema-12 server."""
    c = _gated_client(schema_version=12)
    with pytest.raises(ServerVersionTooOld):
        c._prepare_message(APICommand.GET_NETWORK_TOPOLOGY, require_schema=13, refresh=False)


async def test_wire_dict_with_unknown_keys_and_values_parses() -> None:
    """A newer server's extra fields and new kind/role/strength values must not break parsing."""
    wire = {
        "collected_at": 1,
        "future_field": "ignored",
        "nodes": [
            {
                "id": "x",
                "kind": "quantum_relay",  # unknown future kind
                "network_type": "thread",
                "role": "overlord",  # unknown future role
                "another_future_field": {"nested": True},
            }
        ],
        "connections": [
            {
                "source": "x",
                "target": "y",
                "network": "thread",
                "strength": "superb",  # unknown future strength
                "future_metric": 42,
            }
        ],
    }
    c = _bare_client()
    c.send_command = AsyncMock(return_value=wire)
    result = await c.get_network_topology()
    assert result.nodes[0].kind == "quantum_relay"
    assert result.nodes[0].role == "overlord"
    assert result.nodes[0].node_id is None
    assert result.connections[0].strength == "superb"
    assert result.connections[0].source_to_target is None


def test_network_topology_updated_event_parses_typed() -> None:
    """The event payload reaches subscribers as a parsed NetworkTopology."""
    client = MatterClient("ws://localhost:5580/ws", MagicMock())
    received: list[tuple[object, object]] = []
    client.subscribe_events(lambda event, data: received.append((event, data)))

    client._handle_event_message(
        EventMessage(event=EventType.NETWORK_TOPOLOGY_UPDATED, data=_WIRE_TOPOLOGY)
    )

    assert len(received) == 1
    event, data = received[0]
    assert event == EventType.NETWORK_TOPOLOGY_UPDATED
    assert isinstance(data, NetworkTopology)
    assert len(data.nodes) == 4
    assert data.connections[1].source_to_target == TopologyDirectionInfo(strength="strong", rssi=-55)
