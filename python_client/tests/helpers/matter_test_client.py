"""Extended MatterClient for integration testing.

Ports the functionality of the JS MatterTestClient.ts, providing event
capture and waiting utilities on top of the real Python MatterClient.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any, Callable

import aiohttp

from matter_server.client import MatterClient
from matter_server.common.errors import MatterError
from matter_server.common.models import EventType


@dataclass
class WsEvent:
    """A captured WebSocket event for test assertions."""

    event: str
    data: Any


@dataclass
class EventWaiter:
    """A pending event waiter with optional matcher predicate."""

    event_type: str
    matcher: Callable[[Any], bool] | None
    future: asyncio.Future[WsEvent]


class MatterTestClient(MatterClient):
    """MatterClient extended with testing utilities.

    Provides event capture, event waiting, and convenience methods
    for integration test scenarios.
    """

    def __init__(self, url: str, session: aiohttp.ClientSession):
        super().__init__(url, session)
        self._events: list[WsEvent] = []
        self._waiters: list[EventWaiter] = []
        # Subscribe to all events (no filter = wildcard) to capture them
        self._unsubscribe = self.subscribe_events(callback=self._on_event)

    def _on_event(self, event: EventType, data: Any) -> None:
        """Capture all events for test assertions and resolve pending waiters."""
        ws_event = WsEvent(event=event.value, data=data)
        self._events.append(ws_event)
        # Check if any waiters match this event
        for waiter in list(self._waiters):
            if waiter.event_type == ws_event.event:
                if waiter.matcher is None or waiter.matcher(ws_event.data):
                    self._waiters.remove(waiter)
                    if not waiter.future.done():
                        waiter.future.set_result(ws_event)

    def clear_events(self) -> None:
        """Clear all collected events."""
        self._events.clear()

    def get_events(self) -> list[WsEvent]:
        """Return a copy of collected events."""
        return list(self._events)

    async def wait_for_event(
        self,
        event_type: str,
        matcher: Callable[[Any], bool] | None = None,
        timeout: float = 10.0,
    ) -> WsEvent:
        """Wait for a specific event, checking already-captured events first.

        Args:
            event_type: The event type string to wait for (e.g. "node_added").
            matcher: Optional predicate to filter event data.
            timeout: Maximum time to wait in seconds.

        Returns:
            The matching WsEvent.

        Raises:
            TimeoutError: If no matching event arrives within the timeout.
        """
        # Check already-captured events first
        for event in self._events:
            if event.event == event_type:
                if matcher is None or matcher(event.data):
                    return event

        # Wait for a new matching event
        loop = asyncio.get_running_loop()
        future: asyncio.Future[WsEvent] = loop.create_future()
        waiter = EventWaiter(event_type=event_type, matcher=matcher, future=future)
        self._waiters.append(waiter)

        try:
            return await asyncio.wait_for(future, timeout=timeout)
        except asyncio.TimeoutError:
            if waiter in self._waiters:
                self._waiters.remove(waiter)
            raise TimeoutError(f"Timeout waiting for event: {event_type}") from None

    async def connect_and_get_server_info(self):
        """Connect to the server and return the ServerInfoMessage.

        Returns:
            The ServerInfoMessage received on connection.
        """
        await self.connect()
        return self.server_info

    async def start_listening_and_get_nodes(self):
        """Start listening and return the initial node list.

        Starts the listening loop as a background task and waits for
        the initial node dump to be received.

        Returns:
            A tuple of (nodes_list, listen_task) where listen_task is the
            asyncio.Task running the listen loop. The caller is responsible
            for cancelling the task when done.
        """
        init_ready = asyncio.Event()
        listen_task = asyncio.create_task(self.start_listening(init_ready))
        await asyncio.wait_for(init_ready.wait(), timeout=30)
        nodes = self.get_nodes()
        return nodes, listen_task

    async def fetch_server_info(self):
        """Fetch server info via the server_info API command.

        Returns:
            The raw result from the server_info command.
        """
        return await self.send_command("server_info")

    async def close(self) -> None:
        """Disconnect and cleanup.

        Convenience method that calls disconnect() and waits briefly
        for the connection to fully close.
        """
        await self.disconnect()
        await asyncio.sleep(0.1)

    async def send_command_expect_error(
        self, command: str, args: dict | None = None
    ) -> dict:
        """Send a command and expect it to raise an error.

        Args:
            command: The API command string to send.
            args: Optional keyword arguments for the command.

        Returns:
            A dict with 'error_code' and 'details' from the exception.

        Raises:
            AssertionError: If the command succeeds instead of raising an error.
        """
        try:
            await self.send_command(command, **(args or {}))
            raise AssertionError(f"Expected error for command {command}")
        except MatterError as e:
            return {"error_code": e.error_code, "details": str(e)}
        except Exception as e:
            return {"error_code": getattr(e, "error_code", -1), "details": str(e)}
