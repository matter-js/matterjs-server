# Home Assistant Matter Integration - BLE Proxy Implementation Guide

This guide documents the changes needed in the Home Assistant `matter` integration
to support BLE commissioning through the matter-server's BLE proxy WebSocket endpoint.

## Prerequisites

- Matter.js server running with `--ble-proxy` flag
- Home Assistant with the `bluetooth` and `bluetooth_adapters` integrations configured
- ESPHome BLE proxy devices on the network (optional - local adapters work too)

## Overview

The HA matter integration acts as the **client** side of the BLE proxy protocol:
1. On setup, if the matter-server reports `bluetooth_enabled: true`, derive the BLE
   proxy URL (`ws://host:5580/ble`) from the main WebSocket URL
2. Connect to the `/ble` endpoint and perform the hello handshake
3. When the server sends BLE commands (scan, connect, discover, etc.), execute them
   using HA's bluetooth component (which transparently routes through ESPHome proxies)
4. Send responses, events, and binary frames back to the server
5. Clean up on unload

## Files Changed

### 1. `manifest.json`

Add `bluetooth_adapters` to dependencies:

```json
{
  "dependencies": ["bluetooth_adapters", "websocket_api"]
}
```

This ensures HA's bluetooth component is available for BLE operations.

### 2. `ble_proxy.py` (NEW)

The core BLE proxy client module. Contains:

- **`MatterBleProxy`** class - connects to `/ble` WebSocket, handles protocol
- **`ConnectionState`** - tracks per-connection BLE state (BleakClient, services, characteristics)
- Command handlers for all 11 protocol commands
- Binary frame handling (WRITE_DATA writes to last-written characteristic)
- Scanning via `async_register_callback` (HA's bluetooth callback API)
- Connection via `async_ble_device_from_address` -> `BleakClient`

Key design decisions:
- Uses `aiohttp.ClientSession.ws_connect()` for WebSocket (consistent with HA patterns)
- BLE scanning uses HA's `async_register_callback` which receives advertisements from all
  sources (local adapters + ESPHome proxies) transparently
- Connection uses `async_ble_device_from_address` to get a `BLEDevice` that HA's bluetooth
  component can route through the appropriate adapter/proxy
- Binary frames use `struct.Struct(">BH")` for header packing (opcode + big-endian handle)
- All async operations use `asyncio.create_task` for fire-and-forget event/notification sends

### 3. `__init__.py`

After the matter client connects and `server_info` is available:

```python
server_info = matter_client.server_info
if server_info and getattr(server_info, "bluetooth_enabled", False):
    ble_proxy_url = base_url.replace("/ws", "/ble")
    ble_proxy = MatterBleProxy(hass, ble_proxy_url)
    await ble_proxy.connect()
    entry.async_on_unload(lambda: hass.async_create_task(ble_proxy.disconnect()))
```

The BLE proxy connection is **eager** (connects during setup if server reports BLE available)
but **non-blocking** (failure just logs a warning, doesn't prevent integration setup).

### 4. `helpers.py`

`MatterEntryData` gets an optional `ble_proxy_url` field for diagnostics.

## Protocol Reference

See `docs/ble-proxy-protocol.md` in the matter-server repository for the complete
protocol specification including:
- Hello handshake (version 1)
- 11 commands (start_scan, stop_scan, connect, disconnect, discover_services, etc.)
- 4 events (device_discovered, disconnected, scan_stopped, characteristic_notification)
- Binary frame format (opcode + connection_handle + payload)

## Testing

### Manual Testing

1. Start matter-server with BLE proxy:
   ```bash
   npm run server -- --ble-proxy
   ```

2. Configure HA matter integration pointing to the server

3. Verify logs show:
   ```
   Matter server reports BLE available, proxy URL: ws://host:5580/ble
   BLE proxy connected (protocol v1)
   ```

4. Commission a Matter device using QR code (not network-only) - this triggers
   BLE scanning and connection through the proxy

### What to Verify

- BLE scanning works through ESPHome proxies
- Matter device is discovered via BLE advertisements
- BTP handshake completes (binary frames flow correctly)
- WiFi/Thread credentials are delivered to the device
- Device transitions to IP network after commissioning
- BLE proxy disconnects cleanly on HA shutdown/reload
