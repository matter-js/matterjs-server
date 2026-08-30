"""Unit tests for the pluggable connect_strategy hook on MatterBleProxy."""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import AsyncMock, MagicMock

import pytest

from matter_ble_proxy.client import (
    BleDeviceResolver,
    BleScanSource,
    MatterBleProxy,
    default_connect_strategy,
)

if TYPE_CHECKING:
    from bleak.backends.device import BLEDevice

    from matter_ble_proxy.client import ConnectStrategy


class _StubScanSource(BleScanSource):
    async def start(self, callback: object) -> None:
        pass

    async def stop(self) -> None:
        pass


class _StubResolver(BleDeviceResolver):
    def __init__(self, target: BLEDevice | str | None) -> None:
        self._target = target

    async def resolve(self, address: str) -> BLEDevice | str | None:
        return self._target


def _make_proxy(
    *,
    resolver: BleDeviceResolver,
    connect_strategy: ConnectStrategy | None = None,
) -> tuple[MatterBleProxy, AsyncMock, AsyncMock]:
    """Build a MatterBleProxy with WS plumbing mocked out."""
    proxy = MatterBleProxy(
        ws_url="ws://test/ble",
        scan_source=_StubScanSource(),
        device_resolver=resolver,
        connect_strategy=connect_strategy,
    )
    send_success = AsyncMock()
    send_error = AsyncMock()
    proxy._send_success = send_success  # type: ignore[method-assign]
    proxy._send_error = send_error  # type: ignore[method-assign]
    return proxy, send_success, send_error


def test_default_connect_strategy_used_when_none_provided() -> None:
    """Constructor wires `default_connect_strategy` when caller passes None."""
    proxy, _, _ = _make_proxy(resolver=_StubResolver(None))
    assert proxy._connect_strategy is default_connect_strategy


def test_custom_connect_strategy_replaces_default() -> None:
    """Constructor stores the supplied strategy verbatim."""
    sentinel = AsyncMock()
    proxy, _, _ = _make_proxy(
        resolver=_StubResolver(None), connect_strategy=sentinel
    )
    assert proxy._connect_strategy is sentinel


@pytest.mark.asyncio
async def test_handle_connect_invokes_strategy_with_target_and_timeout() -> None:
    """`_handle_connect` resolves the address then calls the strategy."""
    target = "AA:BB:CC:DD:EE:FF"
    client = MagicMock()
    client.mtu_size = 247
    strategy = AsyncMock(return_value=client)

    proxy, send_success, _ = _make_proxy(
        resolver=_StubResolver(target), connect_strategy=strategy
    )
    await proxy._handle_connect(
        cmd_id=1, args={"address": "AA:BB:CC:DD:EE:FF", "timeout": 8000}
    )

    strategy.assert_awaited_once()
    strategy_args = strategy.await_args
    assert strategy_args is not None
    call_target, _on_disconnect, timeout_ms = strategy_args.args
    assert call_target is target
    assert callable(_on_disconnect)
    assert timeout_ms == 8000
    send_success.assert_awaited_once()
    success_args = send_success.await_args
    assert success_args is not None
    assert success_args.args[1]["mtu"] == 247
    assert 1 in proxy._connections


@pytest.mark.asyncio
async def test_handle_connect_reports_device_not_found_without_calling_strategy() -> (
    None
):
    """When the resolver returns None the strategy is never invoked."""
    strategy = AsyncMock()
    proxy, _, send_error = _make_proxy(
        resolver=_StubResolver(None), connect_strategy=strategy
    )
    await proxy._handle_connect(cmd_id=2, args={"address": "AA:BB:CC:DD:EE:FF"})

    strategy.assert_not_awaited()
    send_error.assert_awaited_once()
    await_args = send_error.await_args
    assert await_args is not None
    assert await_args.args[1] == "device_not_found"


@pytest.mark.asyncio
async def test_handle_connect_maps_timeout_error_to_connection_failed() -> None:
    """A `TimeoutError` from the strategy surfaces as `connection_failed`."""
    strategy = AsyncMock(side_effect=TimeoutError())
    proxy, _, send_error = _make_proxy(
        resolver=_StubResolver("AA:BB:CC:DD:EE:FF"), connect_strategy=strategy
    )
    await proxy._handle_connect(cmd_id=3, args={"address": "AA:BB:CC:DD:EE:FF"})

    send_error.assert_awaited_once()
    await_args = send_error.await_args
    assert await_args is not None
    code = await_args.args[1]
    message = await_args.args[2]
    assert code == "connection_failed"
    assert "Timeout" in message


@pytest.mark.asyncio
async def test_handle_connect_maps_arbitrary_exception_to_connection_failed() -> None:
    """Any other exception from the strategy is reported as `connection_failed`."""
    strategy = AsyncMock(side_effect=RuntimeError("boom"))
    proxy, _, send_error = _make_proxy(
        resolver=_StubResolver("AA:BB:CC:DD:EE:FF"), connect_strategy=strategy
    )
    await proxy._handle_connect(cmd_id=4, args={"address": "AA:BB:CC:DD:EE:FF"})

    send_error.assert_awaited_once()
    await_args = send_error.await_args
    assert await_args is not None
    assert await_args.args[1] == "connection_failed"
    assert "boom" in await_args.args[2]
