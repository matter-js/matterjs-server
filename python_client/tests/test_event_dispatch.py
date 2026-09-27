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


_NODE_SCOPED_CAMERA_EVENTS = [
    (EventType.WEBRTC_CALLBACK, {"node_id": 7, "endpoint_id": 1, "event_type": "answer"}),
    (EventType.CAMERA_SESSION_ENDED, {"node_id": 7, "endpoint_id": 1, "webrtc_session_id": 5}),
    (EventType.CAMERA_STREAM_EVICTED, {"node_id": 7, "endpoint_id": 1, "kind": "snapshot", "stream_id": 3}),
]


@pytest.mark.parametrize(("event_type", "data"), _NODE_SCOPED_CAMERA_EVENTS)
def test_node_scoped_camera_event_reaches_a_node_filtered_subscriber(
    event_type: EventType, data: dict
) -> None:
    """Home Assistant subscribes per node, so an event carrying node_id must be routed by it."""
    client = _make_client()
    received: list[tuple[object, object]] = []
    client.subscribe_events(lambda event, payload: received.append((event, payload)), node_filter=7)

    client._handle_event_message(EventMessage(event=event_type, data=data))

    assert received == [(event_type, data)]


@pytest.mark.parametrize(("event_type", "data"), _NODE_SCOPED_CAMERA_EVENTS)
def test_node_scoped_camera_event_is_withheld_from_another_node(
    event_type: EventType, data: dict
) -> None:
    """The node id routes the event rather than merely travelling with it."""
    client = _make_client()
    received: list[tuple[object, object]] = []
    client.subscribe_events(lambda event, payload: received.append((event, payload)), node_filter=8)

    client._handle_event_message(EventMessage(event=event_type, data=data))

    assert received == []
