"""Unit tests for read, subscribe, auto subscription and discovery_timeout_s (schema 14)."""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING, Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from matter_server.client import MatterClient
from matter_server.client.exceptions import ConnectionClosed, ServerVersionTooOld
from matter_server.common.errors import MatterError
from matter_server.common.models import (
    APICommand,
    CommandMessage,
    ErrorResultMessage,
    EventMessage,
    EventType,
    InteractionReport,
    ManualOnboardingPayloadResult,
    MatterNodeEvent,
    PathStatus,
    QrOnboardingPayload,
    QrOnboardingPayloadResult,
    ServerInfoMessage,
    SubscribeResult,
    SubscriptionEndedData,
    SubscriptionReportData,
    SuccessResultMessage,
)

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable, Coroutine

BIG_NODE_ID = 2**63 + 5

_NODE_DICT: dict[str, Any] = {
    "node_id": 1,
    "date_commissioned": "2024-01-01T00:00:00",
    "last_interview": "2024-01-01T00:00:00",
    "interview_version": 1,
    "attributes": {},
    "attribute_subscriptions": [],
}

_EVENT: dict[str, Any] = {
    "node_id": 1,
    "endpoint_id": 1,
    "cluster_id": 59,
    "event_id": 1,
    "event_number": 121,
    "priority": 1,
    "timestamp": 1704067200000,
    "timestamp_type": 1,
    "data": {"newPosition": 1},
}


def _bare_client(response: Any = None) -> MatterClient:
    client = MatterClient.__new__(MatterClient)
    client.send_command = AsyncMock(return_value=response)
    client._subscription_listeners = {}
    return client


def _gated_client(schema_version: int) -> MatterClient:
    """Return a client whose real send_command runs the schema gate against `schema_version`."""
    client = MatterClient.__new__(MatterClient)
    connection = MagicMock()
    connection.connected = True
    connection.server_info = ServerInfoMessage(
        fabric_id=1,
        compressed_fabric_id=1,
        schema_version=schema_version,
        min_supported_schema_version=1,
        sdk_version="0.0.0",
        wifi_credentials_set=False,
        thread_credentials_set=False,
        bluetooth_enabled=False,
    )
    client.connection = connection
    client._loop = asyncio.get_running_loop()
    client._result_futures = {}
    client._result_hooks = {}
    client._subscription_listeners = {}
    return client


def _wire_client(schema_version: int, result: Any = None) -> tuple[MatterClient, list[CommandMessage]]:
    """Return a real client whose connection records each CommandMessage and answers it with `result`."""
    client = MatterClient("ws://localhost:5580/ws", MagicMock())
    client._loop = asyncio.get_running_loop()
    sent: list[CommandMessage] = []

    async def send_message(message: CommandMessage) -> None:
        sent.append(message)
        client._handle_incoming_message(SuccessResultMessage(message_id=message.message_id, result=result))

    connection = MagicMock()
    connection.connected = True
    connection.server_info = _gated_client(schema_version).connection.server_info
    connection.send_message = send_message
    client.connection = connection
    return client, sent


def _sent(client: MatterClient) -> tuple[Any, dict[str, Any]]:
    mock = client.send_command
    assert isinstance(mock, AsyncMock)
    args, kwargs = mock.call_args
    return args[0], {key: value for key, value in kwargs.items() if key != "on_result"}


async def test_read_sends_only_given_arguments() -> None:
    client = _bare_client({"attributes": {}, "events": []})
    await client.read(BIG_NODE_ID, attribute_paths=["1/6/0"])
    command, kwargs = _sent(client)
    assert command == APICommand.READ
    assert kwargs == {"require_schema": 14, "node_id": BIG_NODE_ID, "attribute_paths": ["1/6/0"]}


async def test_read_sends_every_argument_as_on_the_wire() -> None:
    client = _bare_client({"attributes": {}, "events": []})
    await client.read(
        1,
        attribute_paths=["0/40/*"],
        event_paths=[{"path": "1/59/*"}],
        event_min=2**40,
        fabric_filtered=False,
        data_version_filters=[{"path": "0/40", "data_version": 3141592}],
    )
    _, kwargs = _sent(client)
    assert kwargs == {
        "require_schema": 14,
        "node_id": 1,
        "attribute_paths": ["0/40/*"],
        "event_paths": [{"path": "1/59/*"}],
        "event_min": 2**40,
        "fabric_filtered": False,
        "data_version_filters": [{"path": "0/40", "data_version": 3141592}],
    }


async def test_read_parses_the_report() -> None:
    client = _bare_client(
        {
            "attributes": {"1/6/0": True, "0/40/1": "Vendor", "1/8/0": {"0": 1}},
            "events": [_EVENT],
            "attribute_status": {"1/6/9999": {"status": 134}, "1/1234/0": {"status": 195, "cluster_status": 3}},
            "event_status": {"1/69/5": {"status": 199}},
            "data_versions": {"1/6": 2771420034, "0/40": 7},
        }
    )
    report = await client.read(1, attribute_paths=["*/*/*"])
    assert isinstance(report, InteractionReport)
    assert report.attributes == {"1/6/0": True, "0/40/1": "Vendor", "1/8/0": {"0": 1}}
    assert report.events == [MatterNodeEvent(**_EVENT)]
    assert report.attribute_status == {"1/6/9999": PathStatus(134), "1/1234/0": PathStatus(195, 3)}
    assert report.event_status == {"1/69/5": PathStatus(199)}
    assert report.data_versions == {"1/6": 2771420034, "0/40": 7}


async def test_read_without_status_maps() -> None:
    client = _bare_client({"attributes": {"1/6/0": True}, "events": []})
    report = await client.read(1, attribute_paths=["1/6/0"])
    assert report.attribute_status is None
    assert report.event_status is None
    assert report.events == []


async def test_subscribe_sends_only_given_arguments() -> None:
    client = _bare_client({"subscription_id": 1, "attributes": {}, "events": []})
    await client.subscribe(BIG_NODE_ID, 0, 60, attribute_paths=["1/6/0"])
    command, kwargs = _sent(client)
    assert command == APICommand.SUBSCRIBE
    assert kwargs == {
        "require_schema": 14,
        "node_id": BIG_NODE_ID,
        "min_interval": 0,
        "max_interval": 60,
        "attribute_paths": ["1/6/0"],
    }


async def test_subscribe_sends_every_argument_as_on_the_wire() -> None:
    client = _bare_client({"subscription_id": 1, "attributes": {}, "events": []})
    await client.subscribe(
        1,
        5,
        120,
        attribute_paths=["1/6/0"],
        event_paths=[{"path": "1/59/*", "is_urgent": True}],
        event_min=7,
        fabric_filtered=False,
        data_version_filters=[{"path": "0/40", "data_version": 1}],
        keep_subscriptions=False,
    )
    _, kwargs = _sent(client)
    assert kwargs == {
        "require_schema": 14,
        "node_id": 1,
        "min_interval": 5,
        "max_interval": 120,
        "attribute_paths": ["1/6/0"],
        "event_paths": [{"path": "1/59/*", "is_urgent": True}],
        "event_min": 7,
        "fabric_filtered": False,
        "data_version_filters": [{"path": "0/40", "data_version": 1}],
        "keep_subscriptions": False,
    }


async def test_subscribe_parses_the_priming_report() -> None:
    client = _bare_client(
        {
            "subscription_id": 2864434397,
            "attributes": {"1/6/0": False},
            "events": [_EVENT],
            "attribute_status": {"1/6/9999": {"status": 134}},
        }
    )
    result = await client.subscribe(1, 0, 60, attribute_paths=["1/6/0"])
    assert isinstance(result, SubscribeResult)
    assert result.subscription_id == 2864434397
    assert result.attributes == {"1/6/0": False}
    assert result.events == [MatterNodeEvent(**_EVENT)]
    assert result.attribute_status == {"1/6/9999": PathStatus(134)}
    assert result.event_status is None


async def test_unsubscribe_sends_node_and_subscription_id() -> None:
    client = _bare_client(None)
    await client.unsubscribe(BIG_NODE_ID, 2864434397)
    command, kwargs = _sent(client)
    assert command == APICommand.UNSUBSCRIBE
    assert kwargs == {"require_schema": 14, "node_id": BIG_NODE_ID, "subscription_id": 2864434397}


@pytest.mark.parametrize(
    ("method", "command"),
    [
        ("enable_auto_subscription", APICommand.ENABLE_AUTO_SUBSCRIPTION),
        ("disable_auto_subscription", APICommand.DISABLE_AUTO_SUBSCRIPTION),
    ],
)
async def test_auto_subscription_commands_send_the_node(method: str, command: APICommand) -> None:
    client = _bare_client(None)
    await getattr(client, method)(BIG_NODE_ID)
    sent_command, kwargs = _sent(client)
    assert sent_command == command
    assert kwargs == {"require_schema": 14, "node_id": BIG_NODE_ID}


async def test_commission_with_code_sends_discovery_timeout() -> None:
    client = _bare_client(_NODE_DICT)
    await client.commission_with_code("MT:x", discovery_timeout_s=600)
    _, kwargs = _sent(client)
    assert kwargs["require_schema"] == 14
    assert kwargs["discovery_timeout_s"] == 600


async def test_commission_with_code_omits_discovery_timeout_when_none() -> None:
    client = _bare_client(_NODE_DICT)
    await client.commission_with_code("MT:x", wifi_credentials_id="Home")
    _, kwargs = _sent(client)
    assert kwargs["require_schema"] == 12
    assert "discovery_timeout_s" not in kwargs


async def test_commission_on_network_sends_discovery_timeout() -> None:
    client = _bare_client(_NODE_DICT)
    await client.commission_on_network(20202021, discovery_timeout_s=600)
    _, kwargs = _sent(client)
    assert kwargs["require_schema"] == 14
    assert kwargs["discovery_timeout_s"] == 600
    assert kwargs["setup_pin_code"] == 20202021


@pytest.mark.parametrize(("filter_type", "schema"), [(4, 14), (3, None), (1, None)])
async def test_commission_on_network_requires_schema_14_for_filter_type_4(
    filter_type: int, schema: int | None
) -> None:
    client = _bare_client(_NODE_DICT)
    await client.commission_on_network(20202021, filter_type=filter_type, filter=257)
    _, kwargs = _sent(client)
    assert kwargs["require_schema"] == schema
    assert kwargs["filter_type"] == filter_type


async def test_commission_on_network_omits_discovery_timeout_when_none() -> None:
    client = _bare_client(_NODE_DICT)
    await client.commission_on_network(20202021, ip_addr="10.0.0.2")
    _, kwargs = _sent(client)
    assert kwargs["require_schema"] == 6
    assert "discovery_timeout_s" not in kwargs


_CALLS: list[tuple[Callable[[MatterClient], Awaitable[object]], str]] = [
    (lambda c: c.read(1, attribute_paths=["1/6/0"]), "read"),
    (lambda c: c.subscribe(1, 0, 60, attribute_paths=["1/6/0"]), "subscribe"),
    (lambda c: c.unsubscribe(1, 5), "unsubscribe"),
    (lambda c: c.enable_auto_subscription(1), "enable_auto_subscription"),
    (lambda c: c.disable_auto_subscription(1), "disable_auto_subscription"),
    (lambda c: c.commission_with_code("MT:x", discovery_timeout_s=60), "commission_with_code"),
    (lambda c: c.commission_on_network(20202021, discovery_timeout_s=60), "commission_on_network"),
]


@pytest.mark.parametrize("call", [call for call, _ in _CALLS], ids=[name for _, name in _CALLS])
async def test_call_is_refused_by_a_schema_13_server_before_sending(
    call: Callable[[MatterClient], Awaitable[object]],
) -> None:
    client = _gated_client(13)
    # A send that gets through the gate must fail the test at once; the real send_command would
    # otherwise wait forever for a response.
    send_message = AsyncMock(side_effect=AssertionError("sent despite the schema gate"))
    client.connection.send_message = send_message
    with pytest.raises(ServerVersionTooOld):
        await call(client)
    send_message.assert_not_awaited()


async def test_plain_commission_with_code_passes_a_schema_13_server() -> None:
    client, sent = _wire_client(13, _NODE_DICT)
    await client.commission_with_code("MT:x")
    assert sent[0].args == {"code": "MT:x", "network_only": False}


async def test_plain_commission_on_network_passes_a_schema_13_server() -> None:
    client, sent = _wire_client(13, _NODE_DICT)
    await client.commission_on_network(20202021)
    assert sent[0].args == {"setup_pin_code": 20202021, "ip_addr": None}


async def test_commission_on_network_sends_filter_and_float_timeout() -> None:
    client, sent = _wire_client(14, _NODE_DICT)
    await client.commission_on_network(20202021, filter_type=2, filter=3840, discovery_timeout_s=2.5)
    assert sent[0].command == APICommand.COMMISSION_ON_NETWORK
    assert sent[0].args == {
        "setup_pin_code": 20202021,
        "ip_addr": None,
        "filter_type": 2,
        "filter": 3840,
        "discovery_timeout_s": 2.5,
    }


async def test_commission_on_network_sends_filter_type_zero() -> None:
    client, sent = _wire_client(13, _NODE_DICT)
    await client.commission_on_network(20202021, filter_type=0, filter=0)
    assert sent[0].args == {"setup_pin_code": 20202021, "ip_addr": None, "filter_type": 0, "filter": 0}


async def test_subscribe_message_on_the_wire() -> None:
    client, sent = _wire_client(14, {"subscription_id": 5, "attributes": {}, "events": []})
    await client.subscribe(BIG_NODE_ID, 0, 60, attribute_paths=["1/6/0"], keep_subscriptions=False)
    assert sent[0].command == "subscribe"
    assert sent[0].args == {
        "node_id": BIG_NODE_ID,
        "min_interval": 0,
        "max_interval": 60,
        "attribute_paths": ["1/6/0"],
        "keep_subscriptions": False,
    }


def _report(node_id: int, subscription_id: int) -> EventMessage:
    return EventMessage(
        event=EventType.SUBSCRIPTION_REPORT,
        data={"node_id": node_id, "subscription_id": subscription_id, "attributes": {"1/6/0": True}, "events": []},
    )


def _ended(node_id: int, subscription_id: int) -> EventMessage:
    return EventMessage(
        event=EventType.SUBSCRIPTION_ENDED, data={"node_id": node_id, "subscription_id": subscription_id}
    )


async def test_listener_sees_reports_delivered_in_the_same_receive_pass_as_the_response() -> None:
    client = MatterClient("ws://localhost:5580/ws", MagicMock())
    client._loop = asyncio.get_running_loop()
    sent: list[CommandMessage] = []

    sent_one = asyncio.Event()

    async def send_message(message: CommandMessage) -> None:
        sent.append(message)
        sent_one.set()

    connection = MagicMock()
    connection.connected = True
    connection.server_info = _gated_client(14).connection.server_info
    connection.send_message = send_message
    client.connection = connection
    received: list[tuple[EventType, Any]] = []
    task = asyncio.create_task(
        client.subscribe(1, 0, 60, attribute_paths=["1/6/0"], listener=lambda e, d: received.append((e, d)))
    )
    await asyncio.wait_for(sent_one.wait(), 1)

    # The receive loop handles buffered frames back to back without yielding to the subscribe() caller.
    client._handle_incoming_message(
        SuccessResultMessage(
            message_id=sent[0].message_id, result={"subscription_id": 7, "attributes": {}, "events": []}
        )
    )
    client._handle_incoming_message(_report(1, 7))
    client._handle_incoming_message(_report(1, 8))
    client._handle_incoming_message(_ended(1, 7))
    client._handle_incoming_message(_report(1, 7))
    await task

    assert received == [
        (
            EventType.SUBSCRIPTION_REPORT,
            SubscriptionReportData(node_id=1, subscription_id=7, attributes={"1/6/0": True}, events=[]),
        ),
        (EventType.SUBSCRIPTION_ENDED, SubscriptionEndedData(node_id=1, subscription_id=7)),
    ]


async def test_listener_is_matched_by_node_and_subscription_id() -> None:
    client, _ = _wire_client(14, {"subscription_id": 7, "attributes": {}, "events": []})
    received: list[Any] = []
    await client.subscribe(1, 0, 60, attribute_paths=["1/6/0"], listener=lambda _, d: received.append(d))
    client._handle_incoming_message(_report(2, 7))
    assert received == []


async def test_listener_is_removed_by_unsubscribe() -> None:
    client, _ = _wire_client(14, {"subscription_id": 7, "attributes": {}, "events": []})
    received: list[Any] = []
    await client.subscribe(1, 0, 60, attribute_paths=["1/6/0"], listener=lambda _, d: received.append(d))
    await client.unsubscribe(1, 7)
    client._handle_incoming_message(_report(1, 7))
    assert received == []


async def test_listener_is_removed_by_a_failed_unsubscribe() -> None:
    client, _ = _wire_client(14, {"subscription_id": 7, "attributes": {}, "events": []})
    received: list[Any] = []
    await client.subscribe(1, 0, 60, attribute_paths=["1/6/0"], listener=lambda _, d: received.append(d))
    client.connection.send_message = AsyncMock(side_effect=RuntimeError("send failed"))
    with pytest.raises(RuntimeError):
        await client.unsubscribe(1, 7)
    client._handle_incoming_message(_report(1, 7))
    assert received == []


async def test_node_subscribers_still_get_reports_without_a_listener() -> None:
    client, _ = _wire_client(14, {"subscription_id": 7, "attributes": {}, "events": []})
    await client.subscribe(1, 0, 60, attribute_paths=["1/6/0"])
    seen: list[Any] = []
    client.subscribe_events(lambda e, _: seen.append(e), node_filter=1)
    client._handle_incoming_message(_report(1, 7))
    assert seen == [EventType.SUBSCRIPTION_REPORT]


_SUBSCRIBED: dict[str, Any] = {"subscription_id": 7, "attributes": {}, "events": []}


def _manual_client() -> tuple[MatterClient, asyncio.Queue[CommandMessage]]:
    """Return a real client whose sent messages queue up unanswered until the test responds."""
    client = MatterClient("ws://localhost:5580/ws", MagicMock())
    client._loop = asyncio.get_running_loop()
    sent: asyncio.Queue[CommandMessage] = asyncio.Queue()

    async def send_message(message: CommandMessage) -> None:
        sent.put_nowait(message)

    connection = MagicMock()
    connection.connected = True
    connection.server_info = _gated_client(14).connection.server_info
    connection.send_message = send_message
    connection.disconnect = AsyncMock()
    client.connection = connection
    return client, sent


async def _next(sent: asyncio.Queue[CommandMessage]) -> CommandMessage:
    return await asyncio.wait_for(sent.get(), 1)


def _respond(client: MatterClient, message: CommandMessage, result: Any) -> None:
    client._handle_incoming_message(SuccessResultMessage(message_id=message.message_id, result=result))


async def _subscribed(
    client: MatterClient, sent: asyncio.Queue[CommandMessage], node_id: int, received: list[Any]
) -> None:
    task = asyncio.create_task(
        client.subscribe(node_id, 0, 60, attribute_paths=["1/6/0"], listener=lambda e, d: received.append((e, d)))
    )
    _respond(client, await _next(sent), _SUBSCRIBED)
    await asyncio.wait_for(task, 1)


async def _expect_cleanup_unsubscribe(client: MatterClient, sent: asyncio.Queue[CommandMessage]) -> None:
    unsubscribe = await _next(sent)
    assert unsubscribe.command == APICommand.UNSUBSCRIBE
    assert unsubscribe.args == {"node_id": 1, "subscription_id": 7}
    _respond(client, unsubscribe, None)
    await asyncio.wait_for(asyncio.gather(*client._background_tasks), 1)


async def _cancel_task(task: asyncio.Task[Any]) -> None:
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await asyncio.wait_for(task, 1)


async def _let_it_time_out(task: asyncio.Task[Any]) -> None:
    with pytest.raises(TimeoutError):
        await asyncio.wait_for(task, 1)


@pytest.mark.parametrize(
    ("make_call", "abandon"),
    [
        (lambda call: call, _cancel_task),
        (lambda call: asyncio.wait_for(call, 0.01), _let_it_time_out),
    ],
    ids=["cancelled", "timed_out"],
)
async def test_subscribe_abandoned_before_the_response_ends_the_subscription(
    make_call: Callable[[Coroutine[Any, Any, SubscribeResult]], Coroutine[Any, Any, SubscribeResult]],
    abandon: Callable[[asyncio.Task[Any]], Awaitable[None]],
) -> None:
    client, sent = _manual_client()
    received: list[Any] = []
    task = asyncio.create_task(
        make_call(client.subscribe(1, 0, 60, attribute_paths=["1/6/0"], listener=lambda _, d: received.append(d)))
    )
    subscribe = await _next(sent)
    await abandon(task)

    _respond(client, subscribe, _SUBSCRIBED)
    client._handle_incoming_message(_report(1, 7))

    await _expect_cleanup_unsubscribe(client, sent)
    assert received == []
    assert client._subscription_listeners == {}
    assert client._result_hooks == {}


async def test_subscribe_cancelled_after_the_response_was_handled_ends_the_subscription() -> None:
    """The response is handled, then the caller is cancelled before it resumes: subscribe() cleans up."""
    client, sent = _manual_client()
    received: list[Any] = []
    task = asyncio.create_task(
        client.subscribe(1, 0, 60, attribute_paths=["1/6/0"], listener=lambda _, d: received.append(d))
    )
    subscribe = await _next(sent)
    _respond(client, subscribe, _SUBSCRIBED)
    await _cancel_task(task)

    client._handle_incoming_message(_report(1, 7))

    await _expect_cleanup_unsubscribe(client, sent)
    assert received == []
    assert client._subscription_listeners == {}


async def test_a_failed_cleanup_unsubscribe_is_logged(caplog: pytest.LogCaptureFixture) -> None:
    client, sent = _manual_client()
    task = asyncio.create_task(client.subscribe(1, 0, 60, attribute_paths=["1/6/0"]))
    subscribe = await _next(sent)
    await _cancel_task(task)
    _respond(client, subscribe, _SUBSCRIBED)

    unsubscribe = await _next(sent)
    client._handle_incoming_message(
        ErrorResultMessage(message_id=unsubscribe.message_id, error_code=0, details="no such subscription")
    )
    await asyncio.wait_for(asyncio.gather(*client._background_tasks), 1)

    assert "Could not end subscription 7 of node 1 after its subscribe call was abandoned" in caplog.text


async def test_unsubscribe_removes_the_listener_before_the_response() -> None:
    client, sent = _manual_client()
    old: list[Any] = []
    await _subscribed(client, sent, 1, old)
    unsubscribe_task = asyncio.create_task(client.unsubscribe(1, 7))
    unsubscribe = await _next(sent)

    client._handle_incoming_message(_report(1, 7))
    assert old == []

    # The device frees id 7 once it handled the unsubscribe, so a new subscription can get it
    # before the unsubscribe response arrives.
    new: list[Any] = []
    await _subscribed(client, sent, 1, new)
    _respond(client, unsubscribe, None)
    await asyncio.wait_for(unsubscribe_task, 1)

    client._handle_incoming_message(_report(1, 7))
    assert old == []
    assert [event for event, _ in new] == [EventType.SUBSCRIPTION_REPORT]


async def test_disconnect_ends_every_listener_once() -> None:
    client, sent = _manual_client()
    received: list[Any] = []
    await _subscribed(client, sent, 1, received)
    await _subscribed(client, sent, 2, received)
    node_events: list[Any] = []
    client.subscribe_events(lambda e, _: node_events.append(e))

    await client.disconnect()
    await client.disconnect()
    client._handle_incoming_message(_report(1, 7))

    assert received == [
        (EventType.SUBSCRIPTION_ENDED, SubscriptionEndedData(node_id=1, subscription_id=7)),
        (EventType.SUBSCRIPTION_ENDED, SubscriptionEndedData(node_id=2, subscription_id=7)),
    ]
    assert node_events == [EventType.SUBSCRIPTION_REPORT]


async def test_connection_loss_ends_every_listener() -> None:
    client, sent = _manual_client()
    received: list[Any] = []
    await _subscribed(client, sent, 1, received)
    client.connection.receive_message_or_raise = AsyncMock(
        side_effect=[SuccessResultMessage(message_id="start", result=[]), ConnectionClosed("lost")]
    )

    await asyncio.wait_for(client.start_listening(), 1)

    assert received == [(EventType.SUBSCRIPTION_ENDED, SubscriptionEndedData(node_id=1, subscription_id=7))]
    assert client._subscription_listeners == {}


async def test_a_raising_listener_on_disconnect_does_not_starve_the_others(caplog: pytest.LogCaptureFixture) -> None:
    client, sent = _manual_client()
    ended: list[tuple[EventType, int]] = []

    def raising(_event: EventType, _data: Any) -> None:
        raise RuntimeError("listener failed")

    def recording(event: EventType, data: Any) -> None:
        ended.append((event, data.subscription_id))

    for listener, subscription_id in ((raising, 7), (recording, 8)):
        task = asyncio.create_task(client.subscribe(1, 0, 60, attribute_paths=["1/6/0"], listener=listener))
        _respond(client, await _next(sent), {**_SUBSCRIBED, "subscription_id": subscription_id})
        await asyncio.wait_for(task, 1)

    with caplog.at_level(logging.ERROR):
        await client.disconnect()

    assert ended == [(EventType.SUBSCRIPTION_ENDED, 8)]
    assert "listener for 1/7 failed on subscription_ended" in caplog.text
    assert client._subscription_listeners == {}


async def test_result_hook_is_dropped_on_an_error_response() -> None:
    client, sent = _manual_client()
    task = asyncio.create_task(client.subscribe(1, 0, 60, attribute_paths=["1/6/0"]))
    subscribe = await _next(sent)
    client._handle_incoming_message(ErrorResultMessage(message_id=subscribe.message_id, error_code=0))
    with pytest.raises(MatterError):
        await asyncio.wait_for(task, 1)
    assert client._result_hooks == {}


async def test_result_hook_is_dropped_when_the_send_fails() -> None:
    client, _ = _manual_client()
    client.connection.send_message = AsyncMock(side_effect=RuntimeError("send failed"))
    with pytest.raises(RuntimeError):
        await asyncio.wait_for(client.subscribe(1, 0, 60, attribute_paths=["1/6/0"]), 1)
    assert client._result_hooks == {}


async def test_result_hook_is_dropped_on_disconnect() -> None:
    client, sent = _manual_client()
    task = asyncio.create_task(client.subscribe(1, 0, 60, attribute_paths=["1/6/0"]))
    await _next(sent)
    await client.disconnect()
    with pytest.raises(asyncio.CancelledError):
        await asyncio.wait_for(task, 1)
    assert client._result_hooks == {}


async def test_cancel_after_subscription_ended_sends_no_unsubscribe() -> None:
    client, sent = _manual_client()
    received: list[Any] = []
    task = asyncio.create_task(
        client.subscribe(1, 0, 60, attribute_paths=["1/6/0"], listener=lambda e, _: received.append(e))
    )
    _respond(client, await _next(sent), _SUBSCRIBED)
    client._handle_incoming_message(_ended(1, 7))
    await _cancel_task(task)

    await asyncio.sleep(0)
    assert received == [EventType.SUBSCRIPTION_ENDED]
    assert sent.empty()
    assert not client._background_tasks


async def test_disconnect_during_cleanup_unsubscribe_logs_no_warning(caplog: pytest.LogCaptureFixture) -> None:
    client, sent = _manual_client()
    task = asyncio.create_task(client.subscribe(1, 0, 60, attribute_paths=["1/6/0"]))
    subscribe = await _next(sent)
    await _cancel_task(task)
    _respond(client, subscribe, _SUBSCRIBED)
    await _next(sent)

    cleanup = list(client._background_tasks)
    await client.disconnect()
    await asyncio.wait_for(asyncio.gather(*cleanup, return_exceptions=True), 1)

    assert cleanup
    assert all(task.cancelled() for task in cleanup)
    assert not [record for record in caplog.records if record.levelno >= logging.WARNING]


async def test_a_raising_listener_on_a_report_keeps_the_client_running(caplog: pytest.LogCaptureFixture) -> None:
    client, sent = _manual_client()

    def raising(_event: EventType, _data: Any) -> None:
        raise RuntimeError("listener failed")

    task = asyncio.create_task(client.subscribe(1, 0, 60, attribute_paths=["1/6/0"], listener=raising))
    _respond(client, await _next(sent), _SUBSCRIBED)
    await asyncio.wait_for(task, 1)
    client.connection.receive_message_or_raise = AsyncMock(
        side_effect=[
            SuccessResultMessage(message_id="start", result=[]),
            _report(1, 7),
            _ended(1, 7),
            ConnectionClosed("done"),
        ]
    )

    with caplog.at_level(logging.ERROR):
        await asyncio.wait_for(client.start_listening(), 1)

    assert "listener for 1/7 failed on subscription_report" in caplog.text
    assert "listener for 1/7 failed on subscription_ended" in caplog.text


async def test_subscribe_cancelled_while_disconnecting_sends_no_unsubscribe() -> None:
    client, sent = _manual_client()
    task = asyncio.create_task(client.subscribe(1, 0, 60, attribute_paths=["1/6/0"]))
    _respond(client, await _next(sent), _SUBSCRIBED)
    task.cancel()

    await client.disconnect()

    with pytest.raises(asyncio.CancelledError):
        await asyncio.wait_for(task, 1)
    assert sent.empty()
    assert not client._background_tasks


async def test_parse_onboarding_payload_returns_the_qr_payloads() -> None:
    payload = {
        "version": 0,
        "vendor_id": 65521,
        "product_id": 32768,
        "flow_type": 0,
        "discovery_capabilities": 4,
        "discriminator": 3840,
        "setup_pin_code": 20202021,
    }
    client, sent = _wire_client(14, {"type": "qr", "payloads": [payload]})

    result = await client.parse_onboarding_payload("MT:Y.K90AFN00KA0648G00")

    assert result == QrOnboardingPayloadResult(
        type="qr",
        payloads=[
            QrOnboardingPayload(
                version=0,
                vendor_id=65521,
                product_id=32768,
                flow_type=0,
                discovery_capabilities=4,
                discriminator=3840,
                setup_pin_code=20202021,
            )
        ],
    )
    assert [(message.command, message.args) for message in sent] == [
        (APICommand.PARSE_ONBOARDING_PAYLOAD, {"code": "MT:Y.K90AFN00KA0648G00"})
    ]


async def test_parse_onboarding_payload_returns_a_manual_code() -> None:
    client, _ = _wire_client(14, {"type": "manual", "short_discriminator": 15, "setup_pin_code": 20202021})

    result = await client.parse_onboarding_payload("34970112332")

    assert result == ManualOnboardingPayloadResult(type="manual", short_discriminator=15, setup_pin_code=20202021)


async def test_parse_onboarding_payload_is_refused_below_schema_14() -> None:
    client, sent = _wire_client(13)

    with pytest.raises(ServerVersionTooOld):
        await client.parse_onboarding_payload("34970112332")
    assert sent == []
