"""Unit tests for MatterClient event dispatch, incl. unknown-event resilience."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from matter_server.client import MatterClient
from matter_server.common.models import EventMessage, EventType


def _make_client() -> MatterClient:
    return MatterClient("ws://localhost:5580/ws", MagicMock())


def test_unknown_event_is_dropped_without_crashing() -> None:
    """A newer server's unknown event type must not crash the client or reach subscribers."""
    client = _make_client()
    received: list[tuple[object, object]] = []
    client.subscribe_events(lambda event, data: received.append((event, data)))

    # parse_value passes an unknown enum value through as a raw string.
    client._handle_event_message(EventMessage(event="some_future_event", data={"x": 1}))

    assert received == []


def test_known_event_still_dispatches() -> None:
    """A known event type is still forwarded to wildcard subscribers."""
    client = _make_client()
    received: list[tuple[object, object]] = []
    client.subscribe_events(lambda event, data: received.append((event, data)))

    client._handle_event_message(EventMessage(event=EventType.SERVER_SHUTDOWN, data=None))

    assert received == [(EventType.SERVER_SHUTDOWN, None)]


def _node_payload(attributes: dict[str, object]) -> dict[str, object]:
    return {
        "node_id": 1,
        "date_commissioned": "2026-01-01T00:00:00",
        "last_interview": "2026-01-01T00:00:00",
        "interview_version": 1,
        "available": True,
        "is_bridge": True,
        "attributes": attributes,
        "attribute_subscriptions": [],
    }


_BRIDGE_WITH_LIGHT = {
    "0/29/0": [{"0": 22, "1": 1}],
    "0/29/3": [1, 2],
    "1/29/0": [{"0": 14, "1": 1}],
    "1/29/3": [2],
    "2/29/0": [{"0": 256, "1": 1}, {"0": 19, "1": 1}],
}
_BRIDGE_WITHOUT_LIGHT = {
    "0/29/0": [{"0": 22, "1": 1}],
    "0/29/3": [1],
    "1/29/0": [{"0": 14, "1": 1}],
    "1/29/3": [],
}


def test_endpoint_removed_after_a_snapshot_without_it_still_finds_it() -> None:
    """Subscribers find the removed endpoint even when a snapshot without it came first."""
    client = _make_client()
    client._handle_event_message(
        EventMessage(event=EventType.NODE_ADDED, data=_node_payload(_BRIDGE_WITH_LIGHT))
    )
    seen: list[object] = []

    def on_removed(event: EventType, data: dict[str, int]) -> None:
        seen.append(client.get_node(data["node_id"]).endpoints.get(data["endpoint_id"]))

    client.subscribe_events(on_removed, event_filter=EventType.ENDPOINT_REMOVED)
    light = client.get_node(1).endpoints[2]

    client._handle_event_message(
        EventMessage(event=EventType.NODE_UPDATED, data=_node_payload(_BRIDGE_WITHOUT_LIGHT))
    )
    assert client.get_node(1).endpoints[2] is light

    client._handle_event_message(
        EventMessage(event=EventType.ENDPOINT_REMOVED, data={"node_id": 1, "endpoint_id": 2})
    )

    assert seen == [light]
    assert 2 not in client.get_node(1).endpoints


def test_endpoint_added_is_signalled_only_for_an_endpoint_the_node_model_contains() -> None:
    """An endpoint_added the node model cannot resolve is not passed on to subscribers."""
    client = _make_client()
    client._handle_event_message(
        EventMessage(event=EventType.NODE_ADDED, data=_node_payload(_BRIDGE_WITHOUT_LIGHT))
    )
    received: list[object] = []
    client.subscribe_events(
        lambda _event, data: received.append(data), event_filter=EventType.ENDPOINT_ADDED
    )

    client._handle_event_message(
        EventMessage(event=EventType.ENDPOINT_ADDED, data={"node_id": 1, "endpoint_id": 2})
    )
    client._handle_event_message(
        EventMessage(event=EventType.ENDPOINT_ADDED, data={"node_id": 7, "endpoint_id": 2})
    )
    assert received == []

    client._handle_event_message(
        EventMessage(event=EventType.NODE_UPDATED, data=_node_payload(_BRIDGE_WITH_LIGHT))
    )
    client._handle_event_message(
        EventMessage(event=EventType.ENDPOINT_ADDED, data={"node_id": 1, "endpoint_id": 2})
    )
    assert received == [{"node_id": 1, "endpoint_id": 2}]


# root -> Aggregator 1 -> Bridged Node 3 -> part 4 -> part 5
_BRIDGE_WITH_COMPOSED_DEVICE = {
    "0/29/0": [{"0": 22, "1": 1}],
    "0/29/3": [1, 3, 4, 5],
    "1/29/0": [{"0": 14, "1": 1}],
    "1/29/3": [3, 4, 5],
    "3/29/0": [{"0": 19, "1": 1}],
    "3/29/3": [4, 5],
    "4/29/0": [{"0": 256, "1": 1}],
    "4/29/3": [5],
    "5/29/0": [{"0": 770, "1": 1}],
}


@pytest.mark.parametrize(
    ("order", "expected"),
    [
        # the server's order: the removals come before the snapshot without the endpoints
        ([3, 4, 5, "snapshot"], [(3, 3)]),
        ([5, 4, 3, "snapshot"], [(5, 4), (4, 3), (3, 3)]),
        ([4, 3, 5, "snapshot"], [(4, 3), (3, 3)]),
        (["snapshot", 3, 4, 5], [(3, 3)]),
        (["snapshot", 5, 4, 3], [(5, 4), (4, 3), (3, 3)]),
    ],
)
def test_endpoint_removed_resolves_every_part_to_its_device(
    order: list[int | str], expected: list[tuple[int, int]]
) -> None:
    """Each removed endpoint a subscriber finds still has its compose parent, in any order.

    A part that resolved to no device would make Home Assistant remove the device of the node.
    """
    client = _make_client()
    client._handle_event_message(
        EventMessage(event=EventType.NODE_ADDED, data=_node_payload(_BRIDGE_WITH_COMPOSED_DEVICE))
    )
    node = client.get_node(1)
    seen: list[tuple[int, int]] = []

    def on_removed(event: EventType, data: dict[str, int]) -> None:
        if (endpoint := node.endpoints.get(data["endpoint_id"])) is None:
            return
        device = node.get_compose_parent(endpoint.endpoint_id) or endpoint
        seen.append((endpoint.endpoint_id, device.endpoint_id))

    client.subscribe_events(on_removed, event_filter=EventType.ENDPOINT_REMOVED)

    for step in order:
        if step == "snapshot":
            client._handle_event_message(
                EventMessage(event=EventType.NODE_UPDATED, data=_node_payload(_BRIDGE_WITHOUT_LIGHT))
            )
        else:
            client._handle_event_message(
                EventMessage(event=EventType.ENDPOINT_REMOVED, data={"node_id": 1, "endpoint_id": step})
            )

    assert seen == expected
    assert set(node.endpoints) == {0, 1}
    assert node.get_bridge_child_ids(1) == ()


# root -> Aggregator 1 -> Bridged Node 3 with the parts 4 and 5
_BRIDGED_NODE_WITH_TWO_PARTS = {
    "0/29/0": [{"0": 22, "1": 1}],
    "0/29/3": [1, 3, 4, 5],
    "1/29/0": [{"0": 14, "1": 1}],
    "1/29/3": [3, 4, 5],
    "3/29/0": [{"0": 19, "1": 1}],
    "3/29/3": [4, 5],
    "3/57/5": "bridged device 3",
    "4/29/0": [{"0": 256, "1": 1}],
    "4/29/3": [],
    "5/29/0": [{"0": 770, "1": 1}],
}


def _with(attributes: dict[str, object], changes: dict[str, object]) -> dict[str, object]:
    """Return the attributes with the given paths replaced, or dropped where the value is None."""
    result = dict(attributes)
    for path, value in changes.items():
        if value is None:
            result.pop(path, None)
        else:
            result[path] = value
    return result


def _client_with_bridged_node() -> MatterClient:
    client = _make_client()
    client._handle_event_message(
        EventMessage(event=EventType.NODE_ADDED, data=_node_payload(_BRIDGED_NODE_WITH_TWO_PARTS))
    )
    return client


def _send_snapshot(client: MatterClient, attributes: dict[str, object]) -> None:
    client._handle_event_message(EventMessage(event=EventType.NODE_UPDATED, data=_node_payload(attributes)))


@pytest.mark.parametrize(
    ("snapshot", "removed"),
    [
        # the parent stops listing the part, the Aggregator still lists it
        (_with(_BRIDGED_NODE_WITH_TWO_PARTS, {"3/29/3": [4]}), 5),
        # no endpoint but the root lists the part
        (
            _with(
                _BRIDGED_NODE_WITH_TWO_PARTS,
                {"3/29/3": [4], "1/29/3": [3, 4], "0/29/3": [1, 3, 4, 5]},
            ),
            5,
        ),
        # the parent reports no Descriptor
        (_with(_BRIDGED_NODE_WITH_TWO_PARTS, {"3/29/0": None, "3/29/3": None}), 4),
        # the parent still lists its parts, but reports no device types
        (_with(_BRIDGED_NODE_WITH_TWO_PARTS, {"3/29/0": []}), 5),
    ],
)
def test_a_snapshot_naming_no_parent_keeps_the_device_of_a_part_until_its_removal(
    snapshot: dict[str, object], removed: int
) -> None:
    """A part the snapshot names no parent for still resolves to its device when its removal arrives.

    Resolving to no device there, Home Assistant would remove the device of the node.
    """
    client = _client_with_bridged_node()
    node = client.get_node(1)
    seen: list[object] = []

    def on_removed(event: EventType, data: dict[str, int]) -> None:
        seen.append(node.get_compose_parent(data["endpoint_id"]))

    client.subscribe_events(on_removed, event_filter=EventType.ENDPOINT_REMOVED)

    _send_snapshot(client, snapshot)
    client._handle_event_message(
        EventMessage(event=EventType.ENDPOINT_REMOVED, data={"node_id": 1, "endpoint_id": removed})
    )

    assert seen == [node.endpoints[3]]
    assert removed not in node.endpoints
    assert node.get_compose_child_ids(3) == tuple(sorted({4, 5} - {removed}))


@pytest.mark.parametrize(
    "changes",
    [
        # no Descriptor at all
        {"3/29/0": None, "3/29/3": None},
        # a Descriptor without its DeviceTypeList
        {"3/29/0": None},
    ],
)
def test_an_endpoint_reporting_no_device_types_keeps_them_until_its_removal(changes: dict[str, object]) -> None:
    """A bridged device whose DeviceTypeList a snapshot lacks is still bridged when its removal arrives.

    Without its Bridged Node device type Home Assistant would remove the device of the node instead.
    """
    client = _client_with_bridged_node()
    node = client.get_node(1)
    seen: list[bool] = []

    def on_removed(event: EventType, data: dict[str, int]) -> None:
        seen.append(node.endpoints[data["endpoint_id"]].is_bridged_device)

    client.subscribe_events(on_removed, event_filter=EventType.ENDPOINT_REMOVED)

    _send_snapshot(client, _with(_BRIDGED_NODE_WITH_TWO_PARTS, changes))
    client._handle_event_message(EventMessage(event=EventType.ENDPOINT_REMOVED, data={"node_id": 1, "endpoint_id": 3}))

    assert seen == [True]


def test_a_snapshot_naming_another_parent_replaces_the_relation() -> None:
    """A part another endpoint lists as its closest parent becomes a part of that endpoint."""
    client = _client_with_bridged_node()
    node = client.get_node(1)

    _send_snapshot(client, _with(_BRIDGED_NODE_WITH_TWO_PARTS, {"4/29/3": [5]}))

    assert node.get_compose_parent(5) is node.endpoints[4]
    assert node.get_compose_child_ids(3) == (4,)


@pytest.mark.parametrize(
    ("part_device_types", "bridged"),
    [
        ([{"0": 770, "1": 1}], False),
        ([{"0": 770, "1": 1}, {"0": 19, "1": 1}], True),
    ],
)
def test_a_snapshot_naming_the_same_parent_reclassifies_the_relation(
    part_device_types: list[dict[str, int]], bridged: bool
) -> None:
    """The parent a snapshot names again classifies the part anew, also into no relation."""
    client = _client_with_bridged_node()
    node = client.get_node(1)

    _send_snapshot(
        client,
        _with(
            _BRIDGED_NODE_WITH_TWO_PARTS,
            {"3/29/0": [{"0": 14, "1": 1}], "5/29/0": part_device_types},
        ),
    )

    assert node.get_compose_parent(5) is None
    assert node.get_compose_parent(4) is None
    assert node.get_bridge_parent(5) is (node.endpoints[3] if bridged else None)
