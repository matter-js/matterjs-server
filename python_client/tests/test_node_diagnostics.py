"""Unit tests for the node type derived by node_diagnostics."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock

import pytest

from matter_server.client import MatterClient
from matter_server.client.models.node import MatterNode, NetworkType, NodeType
from matter_server.common.models import MatterNodeData

# GeneralDiagnostics/NetworkInterfaces and ThreadNetworkDiagnostics/RoutingRole
NETWORK_INTERFACES = "0/51/0"
ROUTING_ROLE = "{endpoint}/53/1"

INTERFACE_TYPE_THREAD = 4
INTERFACE_TYPE_ETHERNET = 2

ROUTING_ROLE_END_DEVICE = 4
ROUTING_ROLE_LEADER = 6


def _interface(interface_type: int) -> dict[str, Any]:
    """Return one operational network interface of the given type."""
    return {
        "name": "iface",
        "isOperational": True,
        "offPremiseServicesReachableIPv4": None,
        "offPremiseServicesReachableIPv6": None,
        "hardwareAddress": b"\x00\x11\x22\x33\x44\x55",
        "IPv4Addresses": [],
        "IPv6Addresses": [],
        "type": interface_type,
    }


def _node(attributes: dict[str, Any]) -> MatterNode:
    """Return a MatterNode carrying the given raw attributes."""
    return MatterNode(
        MatterNodeData(
            node_id=1,
            date_commissioned=datetime(2026, 1, 1, tzinfo=UTC),
            last_interview=datetime(2026, 1, 1, tzinfo=UTC),
            interview_version=6,
            available=True,
            attributes=attributes,
        )
    )


def _client(node: MatterNode) -> MatterClient:
    """Return a client that reports the given node and nothing else."""
    client = MatterClient.__new__(MatterClient)
    client.get_node = lambda _node_id: node  # type: ignore[method-assign]
    client.get_node_ip_addresses = AsyncMock(return_value=[])  # type: ignore[method-assign]
    client.get_matter_fabrics = AsyncMock(return_value=[])  # type: ignore[method-assign]
    return client


@pytest.mark.asyncio
async def test_thread_node_type_from_root_endpoint() -> None:
    """A Thread-attached node is classified from its root endpoint as before."""
    node = _node(
        {
            NETWORK_INTERFACES: [_interface(INTERFACE_TYPE_THREAD)],
            ROUTING_ROLE.format(endpoint=0): ROUTING_ROLE_END_DEVICE,
        }
    )

    result = await _client(node).node_diagnostics(node_id=1)

    assert result.network_type == NetworkType.THREAD
    assert result.node_type == NodeType.END_DEVICE


@pytest.mark.asyncio
async def test_node_type_from_application_endpoint() -> None:
    """A border router reports Thread from the endpoint that carries it.

    Such a node is reached over Ethernet and serves its Thread diagnostics
    beside the border router management cluster rather than on the root
    endpoint, so neither the network type nor the endpoint used to say
    anything about the role it plays in the mesh.
    """
    node = _node(
        {
            NETWORK_INTERFACES: [_interface(INTERFACE_TYPE_ETHERNET)],
            ROUTING_ROLE.format(endpoint=1): ROUTING_ROLE_LEADER,
        }
    )

    result = await _client(node).node_diagnostics(node_id=1)

    assert result.network_type == NetworkType.ETHERNET
    assert result.node_type == NodeType.ROUTING_END_DEVICE


@pytest.mark.asyncio
async def test_wifi_node_type_without_thread() -> None:
    """A Wi-Fi node without Thread diagnostics stays an end device."""
    node = _node({NETWORK_INTERFACES: [_interface(1)]})

    result = await _client(node).node_diagnostics(node_id=1)

    assert result.network_type == NetworkType.WIFI
    assert result.node_type == NodeType.END_DEVICE
