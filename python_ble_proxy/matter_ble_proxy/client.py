"""Core BLE proxy client.

Connects to a matter-server `/ble` WebSocket endpoint, performs the protocol
handshake, and dispatches commands to a pluggable BLE backend.

Two abstractions decouple the protocol logic from the BLE transport:

- :class:`BleScanSource` produces :class:`AdvertisementData` events from some
  scan source (Bleak's `BleakScanner`, Home Assistant's bluetooth component,
  ESPHome BLE proxies, etc.).
- :class:`BleDeviceResolver` turns an `address` string from the server's
  `connect` command into something the local Bleak stack can connect to —
  either a `bleak.BLEDevice` (preferred, carries advertisement context) or
  the address string itself (falls back to Bleak's address-only connect).

The defaults in :mod:`matter_ble_proxy.bleak_backend` cover the standalone
case; Home Assistant supplies its own implementations.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
import asyncio
import base64
import logging
from typing import TYPE_CHECKING, Any

import aiohttp

from .protocol import (
    BINARY_FRAME_HEADER,
    BLE_PROXY_PROTOCOL_VERSION,
    DEFAULT_CONNECT_TIMEOUT_MS,
    HANDSHAKE_TIMEOUT_SECONDS,
    OPCODE_NOTIFICATION,
    OPCODE_WRITE_DATA,
    AdvertisementData,
)

if TYPE_CHECKING:
    from collections.abc import Callable, Coroutine

    from bleak import BleakClient
    from bleak.backends.characteristic import BleakGATTCharacteristic
    from bleak.backends.device import BLEDevice
    from bleak.backends.service import BleakGATTServiceCollection

_LOGGER = logging.getLogger(__name__)

# Trailing 24 hex chars of the Bluetooth SIG Base UUID. A 128-bit UUID whose
# tail matches this is just a wrapped 16-bit (or 32-bit) standard UUID.
_BASE_UUID_TAIL = "00001000800000805f9b34fb"


def _normalize_uuid(uuid: str) -> str:
    """Collapse standard Bluetooth UUIDs to their shortest comparable form.

    Accepts short ("fff6", "FFF6"), canonical dashed ("0000FFF6-…"), or compact
    32-char hex. For a UUID embedded in the Bluetooth Base, returns the short
    hex form. Otherwise returns the compact lowercase hex. Different forms of
    the same UUID always normalize to the same string.
    """
    compact = uuid.lower().replace("-", "")
    if len(compact) == 32 and compact[8:] == _BASE_UUID_TAIL and compact.startswith("0000"):
        return compact[4:8]
    return compact


class BleScanSource(ABC):
    """Pluggable source of BLE advertisements.

    Implementations call the registered callback for every advertisement the
    underlying stack observes. The proxy filters / forwards them to the
    matter-server.
    """

    @abstractmethod
    async def start(self, callback: Callable[[AdvertisementData], None]) -> None:
        """Begin scanning and route ads to `callback`. Idempotent."""

    @abstractmethod
    async def stop(self) -> None:
        """Stop scanning. Idempotent. After stop, no more callbacks fire."""



class BleDeviceResolver(ABC):
    """Pluggable lookup from `address` to a Bleak connect target."""

    @abstractmethod
    async def resolve(self, address: str) -> BLEDevice | str | None:
        """Resolve an address to a Bleak connect target.

        Return a `BLEDevice` if the stack has one cached, else the bare
        address (Bleak will scan + connect by address), or `None` if the
        device is definitively not present.
        """


class ConnectionState:
    """Tracks one open BLE connection."""

    def __init__(self, client: BleakClient, handle: int) -> None:
        """Initialize connection state."""
        self.client = client
        self.handle = handle
        self.services: BleakGATTServiceCollection | None = None
        self.subscriptions: dict[str, BleakGATTCharacteristic] = {}
        self.last_write_characteristic: BleakGATTCharacteristic | None = None
        self.intentional_disconnect = False


class MatterBleProxy:
    """Proxies BLE operations between a matter-server and a local BLE stack.

    Usage:

    ```python
    proxy = MatterBleProxy(
        ws_url="ws://localhost:5580/ble",
        scan_source=BleakScanSource(),
        device_resolver=BleakDeviceResolver(),
    )
    await proxy.connect()
    try:
        # commissioning is driven by the matter-server; the proxy services
        # incoming commands in the background until disconnect() is called.
        await proxy.run_until_closed()
    finally:
        await proxy.disconnect()
    ```
    """

    def __init__(
        self,
        ws_url: str,
        scan_source: BleScanSource,
        device_resolver: BleDeviceResolver,
        *,
        session: aiohttp.ClientSession | None = None,
        task_factory: Callable[[Coroutine[Any, Any, Any]], asyncio.Task[Any]] | None = None,
    ) -> None:
        """Initialize the proxy.

        Args:
            ws_url: URL of the matter-server `/ble` WebSocket endpoint.
            scan_source: BLE advertisement source backend.
            device_resolver: Resolver from address to Bleak connect target.
            session: Optional pre-existing aiohttp session. If `None`, the
                proxy creates and owns one (closed on disconnect).
            task_factory: Optional task factory for fire-and-forget background
                work (e.g. event forwarding). Defaults to
                `asyncio.get_event_loop().create_task`. Pass
                `hass.async_create_task` from Home Assistant.

        """
        self._ws_url = ws_url
        self._scan_source = scan_source
        self._device_resolver = device_resolver
        self._owns_session = session is None
        self._session = session
        self._ws: aiohttp.ClientWebSocketResponse | None = None
        self._connections: dict[int, ConnectionState] = {}
        self._next_handle = 1
        self._scanning = False
        self._message_task: asyncio.Task[None] | None = None
        self._closed_event = asyncio.Event()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._task_factory = task_factory

    async def connect(self) -> None:
        """Connect to the matter-server `/ble` endpoint and perform handshake."""
        _LOGGER.debug("Connecting to BLE proxy endpoint: %s", self._ws_url)
        if self._session is None:
            self._session = aiohttp.ClientSession()
        try:
            self._ws = await self._session.ws_connect(self._ws_url)
        except (aiohttp.ClientError, OSError) as err:
            if self._owns_session:
                await self._session.close()
                self._session = None
            raise ConnectionError(f"Failed to connect to BLE proxy endpoint {self._ws_url}: {err}") from err

        await self._ws.send_json({"type": "hello", "version": BLE_PROXY_PROTOCOL_VERSION})

        try:
            async with asyncio.timeout(HANDSHAKE_TIMEOUT_SECONDS):
                msg = await self._ws.receive()
        except TimeoutError as err:
            await self.disconnect()
            raise ConnectionError("BLE proxy handshake timeout") from err

        if msg.type != aiohttp.WSMsgType.TEXT:
            await self.disconnect()
            raise ConnectionError(f"Expected text message for handshake, got {msg.type}")

        response = msg.json()
        if response.get("type") != "hello_response":
            await self.disconnect()
            raise ConnectionError(f"Expected hello_response, got {response}")
        if "error" in response:
            await self.disconnect()
            raise ConnectionError(
                f"BLE proxy handshake failed: {response.get('error')} - {response.get('message')}",
            )

        _LOGGER.info("BLE proxy connected (protocol v%s)", response.get("version"))

        self._loop = asyncio.get_running_loop()
        self._closed_event.clear()
        self._message_task = self._spawn_task(self._message_loop())

    async def disconnect(self) -> None:
        """Disconnect and clean up all BLE connections."""
        if self._message_task is not None:
            self._message_task.cancel()
            self._message_task = None

        if self._scanning:
            try:
                await self._scan_source.stop()
            except Exception:
                _LOGGER.debug("Error stopping scan source", exc_info=True)
            self._scanning = False

        for conn in list(self._connections.values()):
            try:
                if conn.client.is_connected:
                    conn.intentional_disconnect = True
                    await conn.client.disconnect()
            except Exception:
                _LOGGER.debug("Error disconnecting BLE client", exc_info=True)
        self._connections.clear()

        if self._ws is not None and not self._ws.closed:
            await self._ws.close()
        self._ws = None

        if self._owns_session and self._session is not None and not self._session.closed:
            await self._session.close()
            self._session = None

        self._closed_event.set()

    async def run_until_closed(self) -> None:
        """Block until the WebSocket connection is closed."""
        await self._closed_event.wait()

    # ─── Internals ───────────────────────────────────────────────────────────

    def _spawn_task(self, coro: Coroutine[Any, Any, Any]) -> asyncio.Task[Any]:
        if self._task_factory is not None:
            return self._task_factory(coro)
        return asyncio.get_event_loop().create_task(coro)

    async def _message_loop(self) -> None:
        if self._ws is None:
            return
        try:
            async for msg in self._ws:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    await self._handle_command(msg.json())
                elif msg.type == aiohttp.WSMsgType.BINARY:
                    await self._handle_binary_frame(msg.data)
                elif msg.type in (
                    aiohttp.WSMsgType.CLOSED,
                    aiohttp.WSMsgType.CLOSING,
                    aiohttp.WSMsgType.ERROR,
                ):
                    break
        except asyncio.CancelledError:
            return
        except Exception:
            _LOGGER.exception("Error in BLE proxy message loop")
        finally:
            _LOGGER.warning("BLE proxy WebSocket connection ended")
            self._closed_event.set()

    async def _handle_command(self, msg: dict[str, Any]) -> None:
        cmd_id = msg.get("id")
        command = msg.get("command")
        args = msg.get("args", {})

        if cmd_id is None or command is None:
            _LOGGER.warning("Received invalid command: %s", msg)
            return

        if _LOGGER.isEnabledFor(logging.INFO):
            # Strip base64 payloads from `write_characteristic` and similar commands so
            # the INFO log stays readable during BTP traffic. The full args are still
            # visible at DEBUG via aiohttp's frame log.
            summary = {k: v for k, v in args.items() if k not in {"value"}}
            _LOGGER.info("[←CMD] id=%s %s%s", cmd_id, command, f" {summary}" if summary else "")

        handler = {
            "start_scan": self._handle_start_scan,
            "stop_scan": self._handle_stop_scan,
            "connect": self._handle_connect,
            "disconnect": self._handle_disconnect,
            "discover_services": self._handle_discover_services,
            "discover_characteristics": self._handle_discover_characteristics,
            "read_characteristic": self._handle_read_characteristic,
            "write_characteristic": self._handle_write_characteristic,
            "subscribe_characteristic": self._handle_subscribe_characteristic,
            "unsubscribe_characteristic": self._handle_unsubscribe_characteristic,
            "request_mtu": self._handle_request_mtu,
        }.get(command)

        if handler is None:
            await self._send_error(cmd_id, "internal_error", f"Unknown command: {command}")
            return

        try:
            await handler(cmd_id, args)
        except Exception as err:
            _LOGGER.exception("Error handling command %s", command)
            await self._send_error(cmd_id, "internal_error", str(err))

    # ─── Command Handlers ───────────────────────────────────────────────────

    async def _handle_start_scan(self, cmd_id: int, args: dict[str, Any]) -> None:
        if self._scanning:
            await self._send_error(cmd_id, "already_scanning", "A scan is already in progress")
            return

        service_uuids: list[str] = args.get("service_uuids", [])
        service_uuid_set = {_normalize_uuid(u) for u in service_uuids} if service_uuids else None

        # Per-address fingerprint cache. Bleak callbacks fire on every received
        # advertisement (Matter peripherals broadcast at ~10 Hz), but the server
        # only needs to see one event per state change. Forwarding every ad would
        # spam the WebSocket and serialize behind in-flight commands like connect.
        last_fingerprint: dict[str, tuple[str | None, bool, tuple[str, ...], tuple[tuple[str, bytes], ...]]] = {}

        def _on_advertisement(ad: AdvertisementData) -> None:
            if service_uuid_set is not None:
                advertised = {_normalize_uuid(u) for u in ad.service_uuids}
                # Also accept matches by service-data key, since some stacks only
                # surface a service UUID via its service_data entry. Bleak emits the
                # full canonical 128-bit form even for standard 16-bit UUIDs, while
                # the server sends the short form; _normalize_uuid collapses both to
                # the short form for standard Bluetooth Base UUIDs.
                advertised.update(_normalize_uuid(k) for k in ad.service_data)
                if not service_uuid_set.intersection(advertised):
                    return

            # Build a content-based fingerprint that intentionally ignores rssi.
            # Two ads that differ only in signal strength are not interesting to
            # the server's discovery loop.
            fingerprint = (
                ad.name,
                ad.connectable,
                tuple(sorted(ad.service_uuids)),
                tuple(sorted(ad.service_data.items())),
            )
            if last_fingerprint.get(ad.address) == fingerprint:
                return
            last_fingerprint[ad.address] = fingerprint

            service_data: dict[str, str] = {
                uuid: base64.b64encode(data).decode("ascii") for uuid, data in ad.service_data.items()
            }
            manufacturer_data: dict[str, str] = {
                str(mid): base64.b64encode(data).decode("ascii") for mid, data in ad.manufacturer_data.items()
            }
            event_data: dict[str, Any] = {
                "address": ad.address,
                "name": ad.name,
                "rssi": ad.rssi,
                "connectable": ad.connectable,
                "service_data": service_data,
                "manufacturer_data": manufacturer_data,
                "service_uuids": list(ad.service_uuids),
            }
            self._spawn_task(self._send_event("device_discovered", event_data))

        await self._scan_source.start(_on_advertisement)
        self._scanning = True
        await self._send_success(cmd_id)

    async def _handle_stop_scan(self, cmd_id: int, _args: dict[str, Any]) -> None:
        if not self._scanning:
            await self._send_error(cmd_id, "not_scanning", "No scan is currently active")
            return
        await self._scan_source.stop()
        self._scanning = False
        await self._send_success(cmd_id)

    async def _handle_connect(self, cmd_id: int, args: dict[str, Any]) -> None:
        from bleak import BleakClient

        address: str = args["address"]
        timeout_ms: int = args.get("timeout", DEFAULT_CONNECT_TIMEOUT_MS)

        target = await self._device_resolver.resolve(address)
        if target is None:
            await self._send_error(cmd_id, "device_not_found", f"No BLE device found for address {address}")
            return

        handle = self._next_handle
        self._next_handle = (self._next_handle + 1) & 0xFFFF

        def _on_disconnect(_client: BleakClient) -> None:
            conn = self._connections.get(handle)
            if conn is None or conn.intentional_disconnect:
                return
            self._connections.pop(handle, None)
            loop = self._loop
            if loop is None:
                return
            loop.call_soon_threadsafe(
                self._spawn_task,
                self._send_event("disconnected", {"connection_handle": handle}),
            )

        client = BleakClient(target, disconnected_callback=_on_disconnect)
        try:
            async with asyncio.timeout(timeout_ms / 1000):
                await client.connect()
        except TimeoutError:
            await self._send_error(cmd_id, "connection_failed", f"Timeout connecting to {address}")
            return
        except Exception as err:
            await self._send_error(cmd_id, "connection_failed", f"Failed to connect to {address}: {err}")
            return

        conn = ConnectionState(client, handle)
        self._connections[handle] = conn

        mtu = getattr(client, "mtu_size", 23)
        await self._send_success(cmd_id, {"connection_handle": handle, "mtu": mtu})

    async def _handle_disconnect(self, cmd_id: int, args: dict[str, Any]) -> None:
        handle: int = args["connection_handle"]
        conn = self._connections.pop(handle, None)
        if conn is None:
            await self._send_error(cmd_id, "not_connected", f"No connection with handle {handle}")
            return
        conn.intentional_disconnect = True
        if conn.client.is_connected:
            await conn.client.disconnect()
        await self._send_success(cmd_id)

    async def _handle_discover_services(self, cmd_id: int, args: dict[str, Any]) -> None:
        conn = self._get_connection(args["connection_handle"])
        if conn is None:
            await self._send_error(cmd_id, "not_connected", f"No connection with handle {args['connection_handle']}")
            return
        # Bleak auto-discovers on connect, but `services` can be None if the cache hasn't
        # populated yet or the connection broke between connect and this command.
        services = conn.client.services
        if services is None:
            await self._send_error(cmd_id, "discover_failed", "Service discovery has not completed")
            return
        conn.services = services
        services_list = [{"uuid": service.uuid} for service in services]
        await self._send_success(cmd_id, {"services": services_list})

    async def _handle_discover_characteristics(self, cmd_id: int, args: dict[str, Any]) -> None:
        conn = self._get_connection(args["connection_handle"])
        if conn is None:
            await self._send_error(cmd_id, "not_connected", f"No connection with handle {args['connection_handle']}")
            return

        service_uuid: str = args["service_uuid"]
        if conn.services is None:
            await self._send_error(cmd_id, "service_not_found", "Services not discovered yet")
            return

        service = conn.services.get_service(service_uuid)
        if service is None:
            await self._send_error(cmd_id, "service_not_found", f"Service {service_uuid} not found")
            return

        characteristics = [
            {"uuid": char.uuid, "properties": list(char.properties)} for char in service.characteristics
        ]
        await self._send_success(cmd_id, {"characteristics": characteristics})

    async def _handle_read_characteristic(self, cmd_id: int, args: dict[str, Any]) -> None:
        conn = self._get_connection(args["connection_handle"])
        if conn is None:
            await self._send_error(cmd_id, "not_connected", f"No connection with handle {args['connection_handle']}")
            return
        char_uuid: str = args["characteristic_uuid"]
        try:
            data = await conn.client.read_gatt_char(char_uuid)
        except Exception as err:
            await self._send_error(cmd_id, "read_failed", f"read_gatt_char({char_uuid}): {err}")
            return
        await self._send_success(cmd_id, {"value": base64.b64encode(data).decode("ascii")})

    async def _handle_write_characteristic(self, cmd_id: int, args: dict[str, Any]) -> None:
        conn = self._get_connection(args["connection_handle"])
        if conn is None:
            await self._send_error(cmd_id, "not_connected", f"No connection with handle {args['connection_handle']}")
            return

        char_uuid: str = args["characteristic_uuid"]
        data = base64.b64decode(args["value"])
        response = args.get("response", False)

        try:
            await conn.client.write_gatt_char(char_uuid, data, response=response)
        except Exception as err:
            await self._send_error(cmd_id, "write_failed", f"write_gatt_char({char_uuid}): {err}")
            return

        # Remember the last-written characteristic so subsequent binary
        # WRITE_DATA frames know where to dispatch payload.
        if conn.services is not None:
            char_obj = conn.services.get_characteristic(char_uuid)
            if char_obj is not None:
                conn.last_write_characteristic = char_obj

        await self._send_success(cmd_id)

    async def _handle_subscribe_characteristic(self, cmd_id: int, args: dict[str, Any]) -> None:
        conn = self._get_connection(args["connection_handle"])
        if conn is None:
            await self._send_error(cmd_id, "not_connected", f"No connection with handle {args['connection_handle']}")
            return

        char_uuid: str = args["characteristic_uuid"]
        handle = conn.handle

        def _on_notification(_char: BleakGATTCharacteristic, data: bytearray) -> None:
            frame = BINARY_FRAME_HEADER.pack(OPCODE_NOTIFICATION, handle) + bytes(data)
            loop = self._loop
            if loop is None:
                return
            loop.call_soon_threadsafe(self._spawn_task, self._send_binary(frame))

        try:
            await conn.client.start_notify(char_uuid, _on_notification)
        except Exception as err:
            await self._send_error(cmd_id, "subscribe_failed", f"start_notify({char_uuid}): {err}")
            return

        # Track the subscription so `unsubscribe_characteristic` can detect
        # not-subscribed errors locally without leaning on Bleak's exception.
        if conn.services is not None:
            char_obj = conn.services.get_characteristic(char_uuid)
            if char_obj is not None:
                conn.subscriptions[char_uuid] = char_obj
        await self._send_success(cmd_id)

    async def _handle_unsubscribe_characteristic(self, cmd_id: int, args: dict[str, Any]) -> None:
        conn = self._get_connection(args["connection_handle"])
        if conn is None:
            await self._send_error(cmd_id, "not_connected", f"No connection with handle {args['connection_handle']}")
            return
        char_uuid: str = args["characteristic_uuid"]
        if char_uuid not in conn.subscriptions:
            await self._send_error(cmd_id, "not_subscribed", f"Not subscribed to {char_uuid}")
            return
        try:
            await conn.client.stop_notify(char_uuid)
        except Exception as err:
            await self._send_error(cmd_id, "internal_error", f"stop_notify({char_uuid}): {err}")
            return
        conn.subscriptions.pop(char_uuid, None)
        await self._send_success(cmd_id)

    async def _handle_request_mtu(self, cmd_id: int, args: dict[str, Any]) -> None:
        conn = self._get_connection(args["connection_handle"])
        if conn is None:
            await self._send_error(cmd_id, "not_connected", f"No connection with handle {args['connection_handle']}")
            return
        # Bleak does not expose an explicit MTU request — return the current MTU.
        mtu = getattr(conn.client, "mtu_size", 23)
        await self._send_success(cmd_id, {"mtu": mtu})

    # ─── Binary frame handling ──────────────────────────────────────────────

    async def _handle_binary_frame(self, data: bytes) -> None:
        if len(data) < BINARY_FRAME_HEADER.size:
            _LOGGER.warning("Binary frame too short: %d bytes", len(data))
            return

        opcode, connection_handle = BINARY_FRAME_HEADER.unpack_from(data)
        payload = data[BINARY_FRAME_HEADER.size :]

        if opcode == OPCODE_WRITE_DATA:
            conn = self._get_connection(connection_handle)
            if conn is None or conn.last_write_characteristic is None:
                return
            try:
                # Matter BTP writes on C1 use ATT Write Request (with response).
                # C1 typically does not advertise write-without-response, so a
                # response=False here is silently dropped by the peripheral and
                # the BTP session stalls.
                await conn.client.write_gatt_char(conn.last_write_characteristic, payload, response=True)
            except Exception:
                _LOGGER.warning("Binary write error", exc_info=True)

    # ─── Helpers ─────────────────────────────────────────────────────────────

    def _get_connection(self, handle: int) -> ConnectionState | None:
        return self._connections.get(handle)

    async def _send_success(self, cmd_id: int, result: dict[str, Any] | None = None) -> None:
        if self._ws is not None and not self._ws.closed:
            await self._ws.send_json({"id": cmd_id, "success": True, "result": result or {}})

    async def _send_error(self, cmd_id: int, error: str, message: str) -> None:
        if self._ws is not None and not self._ws.closed:
            await self._ws.send_json({"id": cmd_id, "success": False, "error": error, "message": message})

    async def _send_event(self, event: str, data: dict[str, Any]) -> None:
        if self._ws is not None and not self._ws.closed:
            await self._ws.send_json({"event": event, "data": data})

    async def _send_binary(self, data: bytes) -> None:
        if self._ws is not None and not self._ws.closed:
            await self._ws.send_bytes(data)
