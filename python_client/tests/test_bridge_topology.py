"""Tests for MatterNode/MatterEndpoint bridge and compose parent resolution."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from matter_server.client.models import device_types
from matter_server.client.models.node import MatterEndpoint, MatterNode
from matter_server.common.helpers.util import dataclass_from_dict
from matter_server.common.models import MatterNodeData

if TYPE_CHECKING:
    import pytest

# Descriptor cluster id and attribute ids
_DESCRIPTOR = 29
_DEVICE_TYPE_LIST = 0
_PARTS_LIST = 3

# device type ids used below
_ROOT_NODE = 22
_AGGREGATOR = 14
_BRIDGED_NODE = 19
_ON_OFF_LIGHT = 256
_TEMPERATURE_SENSOR = 770

# BasicInformation (40) / BridgedDeviceBasicInformation (57) NodeLabel attribute
_NODE_LABEL = 5


def _node_label(endpoint: MatterEndpoint) -> str | None:
    """Node label of the device an endpoint belongs to, or None when it has no device info."""
    info = endpoint.device_info
    return None if info is None else info.nodeLabel


def _node_data(attributes: dict[str, object]) -> MatterNodeData:
    """Build MatterNodeData around a raw attribute map."""
    return dataclass_from_dict(
        MatterNodeData,
        {
            "node_id": 1,
            "date_commissioned": "2026-01-01T00:00:00",
            "last_interview": "2026-01-01T00:00:00",
            "interview_version": 1,
            "available": True,
            "is_bridge": True,
            "attributes": attributes,
            "attribute_subscriptions": [],
        },
    )


def _descriptor_attributes(endpoints: dict[int, dict[int, object]]) -> dict[str, object]:
    """Flatten a per-endpoint Descriptor attribute map into raw attribute paths."""
    attributes: dict[str, object] = {}
    for endpoint_id, endpoint_attrs in endpoints.items():
        for attribute_id, value in endpoint_attrs.items():
            attributes[f"{endpoint_id}/{_DESCRIPTOR}/{attribute_id}"] = value
    return attributes


def _node_with_endpoints(
    endpoints: dict[int, dict[int, object]],
    extra_attributes: dict[str, object] | None = None,
) -> MatterNode:
    """Build a MatterNode from a minimal per-endpoint Descriptor attribute map."""
    attributes = _descriptor_attributes(endpoints)
    attributes.update(extra_attributes or {})
    return MatterNode(_node_data(attributes))


def test_nested_aggregator_children_resolve_bridge_parent() -> None:
    """A device nested under an Aggregator resolves get_bridge_parent().

    Matterbridge's demo devices expose exactly this topology: an Aggregator
    endpoint that is itself a bridged device (Aggregator + BridgedNode on the
    same endpoint), with its own further bridged children that carry no
    BridgedNode of their own. The root Aggregator lists the whole family, so
    the nested children appear in both partsLists.
    """
    node = _node_with_endpoints(
        {
            0: {
                _DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}],
                _PARTS_LIST: [1, 100, 101, 102],
            },
            1: {
                _DEVICE_TYPE_LIST: [{"0": _AGGREGATOR, "1": 1}],
                _PARTS_LIST: [100, 101, 102],
            },
            100: {
                _DEVICE_TYPE_LIST: [
                    {"0": _AGGREGATOR, "1": 1},
                    {"0": _BRIDGED_NODE, "1": 1},
                ],
                _PARTS_LIST: [101, 102],
            },
            101: {_DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}]},
            102: {_DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}]},
        }
    )

    aggregator = node.endpoints[100]

    assert aggregator.is_bridged_device
    assert node.get_bridge_parent(100) is node.endpoints[1]

    for child_id in (101, 102):
        child = node.endpoints[child_id]
        assert child.is_bridged_device
        assert node.get_bridge_parent(child_id) is aggregator
        # the children are independent devices, not sub-parts of the aggregator
        assert node.get_compose_parent(child_id) is None
        assert not child.is_composed_device

    assert node.get_bridge_child_ids(100) == (101, 102)
    assert node.get_bridge_child_ids(1) == (100,)


def test_nested_aggregator_resolves_independent_of_endpoint_numbering() -> None:
    """The nested Aggregator wins over the root one whatever the endpoint ids are.

    The closest parent is decided by the partsList relationships, so a nested
    Aggregator numbered below the Aggregator that bridges it - and therefore
    parsed before it - resolves the same way as the usual ascending numbering.
    """
    node = _node_with_endpoints(
        {
            0: {
                _DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}],
                _PARTS_LIST: [900, 20, 21, 22],
            },
            20: {
                _DEVICE_TYPE_LIST: [
                    {"0": _AGGREGATOR, "1": 1},
                    {"0": _BRIDGED_NODE, "1": 1},
                ],
                _PARTS_LIST: [21, 22],
            },
            900: {
                _DEVICE_TYPE_LIST: [{"0": _AGGREGATOR, "1": 1}],
                _PARTS_LIST: [20, 21, 22],
            },
            21: {_DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}]},
            22: {_DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}]},
        }
    )

    assert node.get_bridge_parent(20) is node.endpoints[900]
    assert node.get_bridge_parent(21) is node.endpoints[20]
    assert node.get_bridge_parent(22) is node.endpoints[20]


def test_top_level_bridged_device_is_unaffected() -> None:
    """A plain top-level bridged device (no nesting) keeps working as before."""
    node = _node_with_endpoints(
        {
            0: {
                _DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}],
                _PARTS_LIST: [1, 29],
            },
            1: {
                _DEVICE_TYPE_LIST: [{"0": _AGGREGATOR, "1": 1}],
                _PARTS_LIST: [29],
            },
            29: {
                _DEVICE_TYPE_LIST: [
                    {"0": _ON_OFF_LIGHT, "1": 1},
                    {"0": _BRIDGED_NODE, "1": 1},
                ],
            },
        }
    )

    bridged = node.endpoints[29]

    assert bridged.is_bridged_device
    assert node.get_bridge_parent(29) is node.endpoints[1]
    assert node.get_compose_parent(29) is None


def test_parts_of_a_bridged_composed_device_stay_composed() -> None:
    """Sub-parts of a bridged composed device are parts, not bridged devices.

    The root Aggregator lists them too (Full-Family Pattern), but their closest
    parent is the composed bridged device, so they must resolve to a compose
    parent and stay out of the bridge map.
    """
    node = _node_with_endpoints(
        {
            0: {
                _DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}],
                _PARTS_LIST: [1, 30, 31, 32],
            },
            1: {
                _DEVICE_TYPE_LIST: [{"0": _AGGREGATOR, "1": 1}],
                _PARTS_LIST: [30, 31, 32],
            },
            30: {
                _DEVICE_TYPE_LIST: [{"0": _BRIDGED_NODE, "1": 1}],
                _PARTS_LIST: [31, 32],
            },
            31: {_DEVICE_TYPE_LIST: [{"0": _TEMPERATURE_SENSOR, "1": 1}]},
            32: {_DEVICE_TYPE_LIST: [{"0": _TEMPERATURE_SENSOR, "1": 1}]},
        }
    )

    assert node.endpoints[30].is_bridged_device
    assert node.get_bridge_parent(30) is node.endpoints[1]

    for part_id in (31, 32):
        part = node.endpoints[part_id]
        assert not part.is_bridged_device
        assert part.is_composed_device
        assert node.get_compose_parent(part_id) is node.endpoints[30]
        assert node.get_bridge_parent(part_id) is None


def test_composed_device_parts_resolve_to_their_closest_parent() -> None:
    """A composed device that lists its whole family maps parts to the closest parent."""
    node = _node_with_endpoints(
        {
            0: {
                _DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}],
                _PARTS_LIST: [1, 2, 3],
            },
            2: {
                _DEVICE_TYPE_LIST: [{"0": _TEMPERATURE_SENSOR, "1": 1}],
                _PARTS_LIST: [3],
            },
            1: {
                _DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}],
                _PARTS_LIST: [2, 3],
            },
            3: {_DEVICE_TYPE_LIST: [{"0": _TEMPERATURE_SENSOR, "1": 1}]},
        }
    )

    assert node.get_compose_parent(2) is node.endpoints[1]
    assert node.get_compose_parent(3) is node.endpoints[2]


def test_root_children_have_neither_parent() -> None:
    """The endpoints the root lists are top level, not parts of the root."""
    node = _node_with_endpoints(
        {
            0: {
                _DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}],
                _PARTS_LIST: [1, 2],
            },
            1: {_DEVICE_TYPE_LIST: [{"0": _AGGREGATOR, "1": 1}]},
            2: {_DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}]},
        }
    )

    for endpoint_id in (1, 2):
        assert node.get_compose_parent(endpoint_id) is None
        assert node.get_bridge_parent(endpoint_id) is None
        assert not node.endpoints[endpoint_id].is_bridged_device


def test_parts_list_entries_for_unknown_and_own_endpoints_are_ignored() -> None:
    """A partsList that names a missing endpoint or the endpoint itself maps nothing."""
    node = _node_with_endpoints(
        {
            0: {_DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}], _PARTS_LIST: [1]},
            1: {
                _DEVICE_TYPE_LIST: [{"0": _AGGREGATOR, "1": 1}],
                _PARTS_LIST: [1, 99],
            },
        }
    )

    assert node.get_bridge_parent(1) is None
    assert node.get_bridge_parent(99) is None
    assert node.get_bridge_child_ids(1) == ()


def test_endpoint_without_descriptor_is_skipped() -> None:
    """An endpoint whose Descriptor is not (yet) cached bridges nothing."""
    node = MatterNode(
        _node_data(
            {
                **_descriptor_attributes(
                    {
                        0: {
                            _DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}],
                            _PARTS_LIST: [1, 2],
                        },
                        2: {_DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}]},
                    }
                ),
                f"1/40/{_NODE_LABEL}": "no descriptor here",
            }
        )
    )

    assert 1 in node.endpoints
    assert node.get_bridge_parent(2) is None
    assert node.get_compose_parent(2) is None


def test_cyclic_parts_list_keeps_the_relations_a_tree() -> None:
    """Two endpoints listing each other keep one relation, not both."""
    node = _node_with_endpoints(
        {
            0: {_DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}], _PARTS_LIST: [1, 2]},
            1: {
                _DEVICE_TYPE_LIST: [{"0": _AGGREGATOR, "1": 1}],
                _PARTS_LIST: [2],
            },
            2: {
                _DEVICE_TYPE_LIST: [{"0": _AGGREGATOR, "1": 1}],
                _PARTS_LIST: [1],
            },
        }
    )

    parents = {
        endpoint_id: node.get_bridge_parent(endpoint_id) for endpoint_id in (1, 2)
    }
    assert [parent for parent in parents.values() if parent is not None] != []
    assert None in parents.values()
    assert node.endpoints[1].device_info is None


def test_a_cycle_below_an_aggregator_keeps_the_aggregator_relations() -> None:
    """Endpoints that list each other stay bridged by the Aggregator listing them."""
    node = _node_with_endpoints(
        {
            0: {_DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}], _PARTS_LIST: [1, 2, 3]},
            1: {
                _DEVICE_TYPE_LIST: [{"0": _AGGREGATOR, "1": 1}],
                _PARTS_LIST: [2, 3],
            },
            2: {
                _DEVICE_TYPE_LIST: [
                    {"0": _ON_OFF_LIGHT, "1": 1},
                    {"0": _BRIDGED_NODE, "1": 1},
                ],
                _PARTS_LIST: [3],
            },
            3: {
                _DEVICE_TYPE_LIST: [
                    {"0": _ON_OFF_LIGHT, "1": 1},
                    {"0": _BRIDGED_NODE, "1": 1},
                ],
                _PARTS_LIST: [2],
            },
        }
    )

    assert node.get_bridge_child_ids(1) != ()
    for endpoint_id in (2, 3):
        assert node.endpoints[endpoint_id].is_bridged_device


def test_removing_an_endpoint_drops_the_devices_it_bridged() -> None:
    """A removed Aggregator leaves no dangling parent for the endpoints it bridged."""
    node = _node_with_endpoints(
        {
            0: {_DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}], _PARTS_LIST: [1, 100]},
            1: {
                _DEVICE_TYPE_LIST: [{"0": _AGGREGATOR, "1": 1}],
                _PARTS_LIST: [100],
            },
            100: {_DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}]},
        }
    )

    assert node.endpoints[100].is_bridged_device

    node._remove_endpoint(1)

    assert node.get_bridge_child_ids(1) == ()
    assert node.get_bridge_parent(100) is None
    assert not node.endpoints[100].is_bridged_device


def test_update_resolves_against_the_new_topology() -> None:
    """A second update maps what the node reports now, not what it reported before."""
    node = _node_with_endpoints(
        {
            0: {_DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}], _PARTS_LIST: [1, 100]},
            1: {
                _DEVICE_TYPE_LIST: [{"0": _AGGREGATOR, "1": 1}],
                _PARTS_LIST: [100],
            },
            100: {_DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}]},
        }
    )

    assert node.get_bridge_parent(100) is node.endpoints[1]

    node.update(
        _node_data(
            _descriptor_attributes(
                {
                    0: {
                        _DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}],
                        _PARTS_LIST: [1, 100],
                    },
                    1: {
                        _DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}],
                        _PARTS_LIST: [100],
                    },
                    100: {_DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}]},
                }
            )
        )
    )

    assert node.get_bridge_parent(100) is None
    assert node.get_compose_parent(100) is node.endpoints[1]


def test_bridged_node_device_type_alone_marks_a_bridged_device() -> None:
    """An endpoint carrying BridgedNode is bridged even with no parent resolved."""
    node = _node_with_endpoints(
        {
            0: {_DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}]},
            29: {
                _DEVICE_TYPE_LIST: [
                    {"0": _ON_OFF_LIGHT, "1": 1},
                    {"0": _BRIDGED_NODE, "1": 1},
                ]
            },
        }
    )

    assert node.get_bridge_parent(29) is None
    assert node.endpoints[29].is_bridged_device


def test_device_info_resolution_order() -> None:
    """Device info comes from the endpoint, else its parts parent, else its bridge parent."""
    node = _node_with_endpoints(
        {
            0: {
                _DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}],
                _PARTS_LIST: [1, 100, 101, 102],
            },
            1: {
                _DEVICE_TYPE_LIST: [{"0": _AGGREGATOR, "1": 1}],
                _PARTS_LIST: [100, 101, 102],
            },
            100: {
                _DEVICE_TYPE_LIST: [
                    {"0": _AGGREGATOR, "1": 1},
                    {"0": _BRIDGED_NODE, "1": 1},
                ],
                _PARTS_LIST: [101, 102],
            },
            101: {
                _DEVICE_TYPE_LIST: [
                    {"0": _ON_OFF_LIGHT, "1": 1},
                    {"0": _BRIDGED_NODE, "1": 1},
                ],
                _PARTS_LIST: [102],
            },
            102: {_DEVICE_TYPE_LIST: [{"0": _TEMPERATURE_SENSOR, "1": 1}]},
        },
        {
            f"0/40/{_NODE_LABEL}": "the bridge itself",
            f"100/57/{_NODE_LABEL}": "nested aggregator",
            f"101/57/{_NODE_LABEL}": "bridged light",
        },
    )

    # own BridgedDeviceBasicInformation wins
    assert _node_label(node.endpoints[101]) == "bridged light"
    # a part of a composed bridged device takes its compose parent's info
    assert _node_label(node.endpoints[102]) == "bridged light"
    # the aggregator itself has its own info, the node keeps BasicInformation
    assert _node_label(node.endpoints[100]) == "nested aggregator"
    node_info = node.device_info
    assert node_info is not None
    assert node_info.nodeLabel == "the bridge itself"


def test_device_info_is_none_for_a_bridged_device_the_bridge_does_not_describe(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A bridged device without info of its own gets none, and is reported once.

    The info of the Aggregator above it describes a different device, so handing it out would give
    every device below that Aggregator the same name and serial number.
    """
    with caplog.at_level(logging.WARNING):
        node = _node_with_endpoints(
            {
                0: {
                    _DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}],
                    _PARTS_LIST: [1, 100, 101, 102],
                },
                1: {
                    _DEVICE_TYPE_LIST: [{"0": _AGGREGATOR, "1": 1}],
                    _PARTS_LIST: [100, 101, 102],
                },
                100: {
                    _DEVICE_TYPE_LIST: [
                        {"0": _AGGREGATOR, "1": 1},
                        {"0": _BRIDGED_NODE, "1": 1},
                    ],
                    _PARTS_LIST: [101, 102],
                },
                101: {_DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}]},
                102: {_DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}]},
            },
            {
                f"0/40/{_NODE_LABEL}": "the bridge itself",
                f"100/57/{_NODE_LABEL}": "nested aggregator",
            },
        )

        assert node.endpoints[101].device_info is None
        assert node.endpoints[102].device_info is None
        assert _node_label(node.endpoints[100]) == "nested aggregator"

    warnings = [
        record for record in caplog.records if "without BridgedDeviceBasicInformation" in record.message
    ]
    assert len(warnings) == 2

    caplog.clear()
    node.update(node.node_data)
    assert not [
        record for record in caplog.records if "without BridgedDeviceBasicInformation" in record.message
    ]


def test_device_types_follow_the_last_reported_list() -> None:
    """An endpoint that stops reporting Aggregator stops bridging its children."""
    node = _node_with_endpoints(
        {
            0: {_DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}], _PARTS_LIST: [1, 100]},
            1: {
                _DEVICE_TYPE_LIST: [{"0": _AGGREGATOR, "1": 1}],
                _PARTS_LIST: [100],
            },
            100: {_DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}]},
        }
    )

    node.update(
        _node_data(
            _descriptor_attributes(
                {
                    0: {
                        _DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}],
                        _PARTS_LIST: [1, 100],
                    },
                    1: {
                        _DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}],
                        _PARTS_LIST: [100],
                    },
                    100: {_DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}]},
                }
            )
        )
    )

    assert node.endpoints[1].device_types == {device_types.OnOffLight}
    assert node.get_bridge_parent(100) is None


def test_device_info_prefers_the_endpoint_over_its_compose_parent() -> None:
    """An endpoint that reports its own bridged device info keeps it."""
    node = _node_with_endpoints(
        {
            0: {
                _DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}],
                _PARTS_LIST: [1, 30, 31],
            },
            1: {
                _DEVICE_TYPE_LIST: [{"0": _AGGREGATOR, "1": 1}],
                _PARTS_LIST: [30, 31],
            },
            30: {
                _DEVICE_TYPE_LIST: [{"0": _BRIDGED_NODE, "1": 1}],
                _PARTS_LIST: [31],
            },
            31: {
                _DEVICE_TYPE_LIST: [
                    {"0": _ON_OFF_LIGHT, "1": 1},
                    {"0": _BRIDGED_NODE, "1": 1},
                ]
            },
        },
        {
            f"30/57/{_NODE_LABEL}": "composed bridged device",
            f"31/57/{_NODE_LABEL}": "its own identity",
        },
    )

    assert node.get_compose_parent(31) is node.endpoints[30]
    assert _node_label(node.endpoints[31]) == "its own identity"


def test_partial_family_keeps_a_part_with_its_closest_parent() -> None:
    """An Aggregator listing only some descendants does not steal a composed part.

    The Aggregator's partsList here omits 32 and 33, so it is smaller than the composed
    device's, and only the relation between the candidates decides the parent.
    """
    node = _node_with_endpoints(
        {
            0: {
                _DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}],
                _PARTS_LIST: [1, 30, 31, 32, 33],
            },
            1: {
                _DEVICE_TYPE_LIST: [{"0": _AGGREGATOR, "1": 1}],
                _PARTS_LIST: [30, 31],
            },
            30: {
                _DEVICE_TYPE_LIST: [{"0": _BRIDGED_NODE, "1": 1}],
                _PARTS_LIST: [31, 32, 33],
            },
            31: {_DEVICE_TYPE_LIST: [{"0": _TEMPERATURE_SENSOR, "1": 1}]},
            32: {_DEVICE_TYPE_LIST: [{"0": _TEMPERATURE_SENSOR, "1": 1}]},
            33: {_DEVICE_TYPE_LIST: [{"0": _TEMPERATURE_SENSOR, "1": 1}]},
        }
    )

    for part_id in (31, 32, 33):
        assert node.get_compose_parent(part_id) is node.endpoints[30]
        assert node.get_bridge_parent(part_id) is None


def test_endpoint_without_device_types_classifies_nothing() -> None:
    """An endpoint whose DeviceTypeList is not cached yet is no kind of parent."""
    node = MatterNode(
        _node_data(
            {
                **_descriptor_attributes(
                    {
                        0: {
                            _DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}],
                            _PARTS_LIST: [1, 2],
                        },
                        2: {_DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}]},
                    }
                ),
                f"1/{_DESCRIPTOR}/{_PARTS_LIST}": [2],
            }
        )
    )

    assert node.endpoints[1].device_types == set()
    assert node.get_compose_parent(2) is None
    assert node.get_bridge_parent(2) is None


def test_root_endpoint_is_the_root_without_its_device_type_list() -> None:
    """Endpoint 0 is the Root Node by specification, cached DeviceTypeList or not."""
    node = MatterNode(
        _node_data(
            {
                **_descriptor_attributes(
                    {
                        1: {
                            _DEVICE_TYPE_LIST: [{"0": _AGGREGATOR, "1": 1}],
                            _PARTS_LIST: [2],
                        },
                        2: {_DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}]},
                    }
                ),
                f"0/{_DESCRIPTOR}/{_PARTS_LIST}": [1, 2],
            }
        )
    )

    assert node.get_compose_parent(1) is None
    assert not node.endpoints[1].is_composed_device
    assert node.get_bridge_parent(2) is node.endpoints[1]


def test_two_unrelated_candidates_resolve_deterministically() -> None:
    """Two endpoints claiming the same child without listing each other pick one."""
    attributes = _descriptor_attributes(
        {
            0: {_DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}], _PARTS_LIST: [1, 2, 3]},
            1: {
                _DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}],
                _PARTS_LIST: [3],
            },
            2: {
                _DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}],
                _PARTS_LIST: [3],
            },
            3: {_DEVICE_TYPE_LIST: [{"0": _TEMPERATURE_SENSOR, "1": 1}]},
        }
    )

    node = MatterNode(_node_data(attributes))
    reversed_node = MatterNode(_node_data(dict(reversed(list(attributes.items())))))

    assert node.get_compose_parent(3) is node.endpoints[1]
    assert reversed_node.get_compose_parent(3) is reversed_node.endpoints[1]


def test_child_ids_are_reported_in_endpoint_order() -> None:
    """Child endpoint ids come back ordered, whatever order the PartsList used."""
    node = _node_with_endpoints(
        {
            0: {
                _DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}],
                _PARTS_LIST: [1, 3, 11, 19],
            },
            1: {
                _DEVICE_TYPE_LIST: [{"0": _AGGREGATOR, "1": 1}],
                _PARTS_LIST: [11, 3, 19],
            },
            3: {_DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}]},
            11: {_DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}]},
            19: {_DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}]},
        }
    )

    assert node.get_bridge_child_ids(1) == (3, 11, 19)


def test_removing_a_composed_parent_drops_its_parts() -> None:
    """Removing a composed device leaves its parts without a compose parent."""
    node = _node_with_endpoints(
        {
            0: {_DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}], _PARTS_LIST: [1, 30, 31]},
            1: {
                _DEVICE_TYPE_LIST: [{"0": _AGGREGATOR, "1": 1}],
                _PARTS_LIST: [30, 31],
            },
            30: {
                _DEVICE_TYPE_LIST: [{"0": _BRIDGED_NODE, "1": 1}],
                _PARTS_LIST: [31],
            },
            31: {_DEVICE_TYPE_LIST: [{"0": _TEMPERATURE_SENSOR, "1": 1}]},
        }
    )

    assert node.get_compose_parent(31) is node.endpoints[30]

    node._remove_endpoint(30)

    assert node.get_compose_child_ids(30) == ()
    assert node.get_compose_parent(31) is None
    assert node.get_bridge_parent(31) is node.endpoints[1]


def test_device_info_walks_a_deep_chain_without_recursing() -> None:
    """A long chain of composed endpoints resolves without exhausting the stack."""
    depth = 2000
    endpoints: dict[int, dict[int, object]] = {
        0: {
            _DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}],
            _PARTS_LIST: list(range(1, depth + 1)),
        }
    }
    for endpoint_id in range(1, depth + 1):
        endpoints[endpoint_id] = {
            _DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}],
            _PARTS_LIST: [endpoint_id + 1] if endpoint_id < depth else [],
        }

    node = _node_with_endpoints(endpoints, {f"0/40/{_NODE_LABEL}": "the node itself"})

    assert _node_label(node.endpoints[depth]) == "the node itself"


def test_device_info_without_a_root_endpoint() -> None:
    """Endpoints resolve device info even when endpoint 0 is not cached."""
    node = MatterNode(
        _node_data(
            _descriptor_attributes(
                {
                    1: {
                        _DEVICE_TYPE_LIST: [{"0": _AGGREGATOR, "1": 1}],
                        _PARTS_LIST: [2],
                    },
                    2: {_DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}]},
                }
            )
        )
    )

    # endpoint 1 is neither bridged nor a part, so it resolves to the node that has no info yet
    assert node.endpoints[1].device_info is None
    assert node.device_info is None
    # endpoint 2 is bridged by endpoint 1 and reports no info of its own
    assert node.endpoints[2].device_info is None


def test_an_endpoint_missing_from_a_snapshot_is_dropped() -> None:
    """The endpoints of a node are the ones its snapshot reports."""
    node = _node_with_endpoints(
        {
            0: {_DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}], _PARTS_LIST: [1, 100]},
            1: {
                _DEVICE_TYPE_LIST: [{"0": _AGGREGATOR, "1": 1}],
                _PARTS_LIST: [100],
            },
            100: {_DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}]},
        }
    )

    assert node.get_bridge_parent(100) is node.endpoints[1]

    node.update(
        _node_data(
            _descriptor_attributes(
                {
                    0: {
                        _DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}],
                        _PARTS_LIST: [100],
                    },
                    100: {_DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}]},
                }
            )
        )
    )

    assert 1 not in node.endpoints
    assert node.get_bridge_parent(100) is None
    assert not node.endpoints[100].is_bridged_device


def test_a_bridged_device_is_reported_again_after_it_came_back(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """An endpoint the node reports again is reported again when it still has no info."""
    node = _node_with_endpoints(
        {
            0: {_DEVICE_TYPE_LIST: [{"0": _ROOT_NODE, "1": 1}], _PARTS_LIST: [1, 100]},
            1: {
                _DEVICE_TYPE_LIST: [{"0": _AGGREGATOR, "1": 1}],
                _PARTS_LIST: [100],
            },
            100: {_DEVICE_TYPE_LIST: [{"0": _ON_OFF_LIGHT, "1": 1}]},
        }
    )
    node._remove_endpoint(100)

    with caplog.at_level(logging.WARNING):
        caplog.clear()
        node.update(node.node_data)

    assert [
        record for record in caplog.records if "without BridgedDeviceBasicInformation" in record.message
    ]
