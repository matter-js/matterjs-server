"""Unit tests for MatterClient event dispatch, incl. unknown-event resilience."""

from __future__ import annotations

from unittest.mock import MagicMock

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
