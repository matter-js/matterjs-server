"""Tests for bridge topology resolution against a node snapshot of a real bridge.

The snapshot in `fixtures/bridge_node.json` is the `get_node` payload the server returns for
`packages/matter-server/test/fixtures/TestBridgeDevice.ts`, captured after commissioning it. It
carries the endpoint structure a matter.js bridge really reports, including the Full-Family
PartsList of an aggregator.

It keeps only the Descriptor, Basic Information and Bridged Device Basic Information clusters the
tests read. The rest of a capture describes the host that ran it - network interfaces, addresses
and operational credentials - and has no place in the repository.
"""

from __future__ import annotations

import json
from pathlib import Path

from matter_server.client.models.node import MatterNode
from matter_server.common.helpers.util import dataclass_from_dict
from matter_server.common.models import MatterNodeData

_FIXTURE = Path(__file__).parent / "fixtures" / "bridge_node.json"

_ON_OFF_LIGHT_DEVICE_TYPE = 256

# endpoint layout of the fixture device
_LOCAL_LIGHT = 1
_PRIMARY_AGGREGATOR = 2
_BRIDGED_LIGHT = 3
_COMPOSED_SENSOR = 4
_COMPOSED_TEMPERATURE = 5
_COMPOSED_HUMIDITY = 6
_NESTED_AGGREGATOR = 7
_NESTED_LIGHT = 8
_NESTED_SENSOR = 9
_NESTED_UNTAGGED_LIGHT = 10
_NESTED_UNTAGGED_LIGHT_2 = 11
_SECONDARY_AGGREGATOR = 12
_SECONDARY_LIGHT = 13


def _bridge_node() -> MatterNode:
    return MatterNode(dataclass_from_dict(MatterNodeData, json.loads(_FIXTURE.read_text())))


def test_the_bridge_reports_a_full_family_parts_list() -> None:
    """The captured snapshot has the shape the resolution has to cope with."""
    node = _bridge_node()

    assert node.node_data.is_bridge is True
    # the aggregator lists the parts of its bridged devices as well
    assert sorted(node.get_attribute_value(_PRIMARY_AGGREGATOR, 29, 3)) == [
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
    ]
    assert node.get_attribute_value(_COMPOSED_SENSOR, 29, 3) == [5, 6]
    assert sorted(node.get_attribute_value(_NESTED_AGGREGATOR, 29, 3)) == [8, 9, 10, 11]
    # the nested aggregator bridges a device that does not report the Bridged Node device type
    untagged_types = {
        device_type.deviceType
        for device_type in node.get_attribute_value(_NESTED_UNTAGGED_LIGHT, 29, 0)
    }
    assert untagged_types == {_ON_OFF_LIGHT_DEVICE_TYPE}


def test_every_endpoint_resolves_to_the_device_it_belongs_to() -> None:
    """Each endpoint of the real bridge resolves to the parent a user would name."""
    node = _bridge_node()

    expected_bridge_parents = {
        _BRIDGED_LIGHT: _PRIMARY_AGGREGATOR,
        _COMPOSED_SENSOR: _PRIMARY_AGGREGATOR,
        _NESTED_AGGREGATOR: _PRIMARY_AGGREGATOR,
        _NESTED_LIGHT: _NESTED_AGGREGATOR,
        _NESTED_SENSOR: _NESTED_AGGREGATOR,
        _NESTED_UNTAGGED_LIGHT: _NESTED_AGGREGATOR,
        _NESTED_UNTAGGED_LIGHT_2: _NESTED_AGGREGATOR,
        _SECONDARY_LIGHT: _SECONDARY_AGGREGATOR,
    }
    expected_compose_parents = {
        _COMPOSED_TEMPERATURE: _COMPOSED_SENSOR,
        _COMPOSED_HUMIDITY: _COMPOSED_SENSOR,
    }

    bridge_parents = {
        endpoint_id: parent.endpoint_id
        for endpoint_id in node.endpoints
        if (parent := node.get_bridge_parent(endpoint_id)) is not None
    }
    compose_parents = {
        endpoint_id: parent.endpoint_id
        for endpoint_id in node.endpoints
        if (parent := node.get_compose_parent(endpoint_id)) is not None
    }

    assert bridge_parents == expected_bridge_parents
    assert compose_parents == expected_compose_parents

    assert node.get_bridge_child_ids(_PRIMARY_AGGREGATOR) == (
        _BRIDGED_LIGHT,
        _COMPOSED_SENSOR,
        _NESTED_AGGREGATOR,
    )
    assert node.get_bridge_child_ids(_NESTED_AGGREGATOR) == (
        _NESTED_LIGHT,
        _NESTED_SENSOR,
        _NESTED_UNTAGGED_LIGHT,
        _NESTED_UNTAGGED_LIGHT_2,
    )
    assert node.get_compose_child_ids(_COMPOSED_SENSOR) == (
        _COMPOSED_TEMPERATURE,
        _COMPOSED_HUMIDITY,
    )


def test_bridged_and_composed_flags_follow_the_device_structure() -> None:
    """Only the endpoints that are devices of their own count as bridged."""
    node = _bridge_node()

    bridged = {
        endpoint_id for endpoint_id, endpoint in node.endpoints.items() if endpoint.is_bridged_device
    }
    composed = {
        endpoint_id for endpoint_id, endpoint in node.endpoints.items() if endpoint.is_composed_device
    }

    assert bridged == {
        _BRIDGED_LIGHT,
        _COMPOSED_SENSOR,
        _NESTED_AGGREGATOR,
        _NESTED_LIGHT,
        _NESTED_SENSOR,
        _NESTED_UNTAGGED_LIGHT,
        _NESTED_UNTAGGED_LIGHT_2,
        _SECONDARY_LIGHT,
    }
    assert composed == {_COMPOSED_TEMPERATURE, _COMPOSED_HUMIDITY}
    # the aggregators and the light that is not bridged stay plain endpoints of the node
    for endpoint_id in (_LOCAL_LIGHT, _PRIMARY_AGGREGATOR, _SECONDARY_AGGREGATOR):
        assert endpoint_id not in bridged
        assert endpoint_id not in composed


def test_device_info_names_the_device_an_endpoint_belongs_to() -> None:
    """Device info comes from the bridged device, and its parts share it.

    The two endpoints the bridge does not describe get no info at all: the Aggregator above them
    is a different device, and handing out its info would give both the same name and serial
    number.
    """
    node = _bridge_node()

    labels = {
        endpoint_id: getattr(node.endpoints[endpoint_id].device_info, "nodeLabel", None)
        for endpoint_id in sorted(node.endpoints)
    }

    assert labels == {
        0: "Test Bridge",
        _LOCAL_LIGHT: "Test Bridge",
        _PRIMARY_AGGREGATOR: "Test Bridge",
        _BRIDGED_LIGHT: "Bridged Light",
        _COMPOSED_SENSOR: "Composed Sensor",
        _COMPOSED_TEMPERATURE: "Composed Sensor",
        _COMPOSED_HUMIDITY: "Composed Sensor",
        _NESTED_AGGREGATOR: "Nested Aggregator",
        _NESTED_LIGHT: "Nested Light",
        _NESTED_SENSOR: "Nested Sensor",
        _NESTED_UNTAGGED_LIGHT: None,
        _NESTED_UNTAGGED_LIGHT_2: None,
        _SECONDARY_AGGREGATOR: "Test Bridge",
        _SECONDARY_LIGHT: "Secondary Light",
    }
