"""Reference Bleak-based CLI for the matter-ble-proxy client library.

Connects to a matter-server `/ble` WebSocket endpoint and bridges a local
Bleak adapter into it. Useful for:

- exercising the BLE proxy protocol end-to-end without Home Assistant
- reproducing protocol bugs against a controlled BLE adapter
- smoke-testing matter-server BLE commissioning from another machine

Usage:
    matter-ble-proxy --server ws://localhost:5580/ble

The same flag set as the JS `noble-ble-proxy` example.
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import logging
import signal
import sys

from matter_ble_proxy.bleak_backend import BleakDeviceResolver, BleakScanSource
from matter_ble_proxy.client import MatterBleProxy

_LOGGER = logging.getLogger("matter_ble_proxy.cli")


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Bleak-based BLE proxy client for matter-server's /ble endpoint",
    )
    parser.add_argument(
        "--server",
        default="ws://localhost:5580/ble",
        help="matter-server BLE proxy URL (default: %(default)s)",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging level (default: %(default)s)",
    )
    return parser.parse_args(argv)


async def _run(server_url: str) -> int:
    scan_source = BleakScanSource()
    device_resolver = BleakDeviceResolver(scan_source)
    proxy = MatterBleProxy(server_url, scan_source, device_resolver)

    _LOGGER.info("Connecting to %s...", server_url)
    try:
        await proxy.connect()
    except ConnectionError:
        _LOGGER.exception("Failed to connect")
        return 1

    _LOGGER.info("Connected. BLE proxy active. Press Ctrl+C to stop.")

    stop_event = asyncio.Event()

    def _request_stop() -> None:
        _LOGGER.info("Shutting down...")
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        # add_signal_handler raises NotImplementedError on Windows and inside
        # some restricted async runtimes; fall back to KeyboardInterrupt there.
        with contextlib.suppress(NotImplementedError):
            loop.add_signal_handler(sig, _request_stop)

    try:
        await asyncio.wait(
            [
                asyncio.create_task(proxy.run_until_closed()),
                asyncio.create_task(stop_event.wait()),
            ],
            return_when=asyncio.FIRST_COMPLETED,
        )
    finally:
        await proxy.disconnect()

    return 0


def main(argv: list[str] | None = None) -> int:
    """Console entry point for the `matter-ble-proxy` script."""
    args = _parse_args(argv)
    logging.basicConfig(
        level=args.log_level,
        format="%(asctime)s.%(msecs)03d %(levelname)s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    try:
        return asyncio.run(_run(args.server))
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    sys.exit(main())
