# matter-ble-proxy

Python client library for the [OHF Matter Server](https://github.com/matter-js/matterjs-server)
BLE proxy WebSocket protocol.

The matter-server can run on a host with no BLE adapter and delegate every BLE
operation to a separate process or device. This library implements the client
side of that protocol so that any Python process with access to a BLE adapter
(via [Bleak](https://github.com/hbldh/bleak), Home Assistant's bluetooth
component, an ESPHome BLE proxy, ...) can act as the BLE bridge.

The protocol is documented in [`docs/ble-proxy-protocol.md`](https://github.com/matter-js/matterjs-server/blob/main/docs/ble-proxy-protocol.md).

## Install

```bash
pip install matter-ble-proxy
```

Python 3.12+ required.

## Standalone CLI

The package ships a reference CLI mirroring the JS `noble-ble-proxy` example.
Useful for testing the matter-server's `/ble` endpoint without Home Assistant
in the loop.

```bash
# Start the matter-server with --ble-proxy in one terminal, then:
matter-ble-proxy --server ws://localhost:5580/ble
```

The CLI uses Bleak directly against the local OS bluetooth adapter.

## Library API

For integrators (Home Assistant, custom add-ons, etc.) wire your own BLE source
in by implementing two ABCs:

```python
from matter_ble_proxy import (
    AdvertisementData,
    BleDeviceResolver,
    BleScanSource,
    MatterBleProxy,
)

class MyScanSource(BleScanSource):
    async def start(self, callback): ...    # call `callback(AdvertisementData(...))`
    async def stop(self): ...

class MyDeviceResolver(BleDeviceResolver):
    async def resolve(self, address): ...   # return a bleak.BLEDevice / address / None

proxy = MatterBleProxy(
    ws_url="ws://localhost:5580/ble",
    scan_source=MyScanSource(),
    device_resolver=MyDeviceResolver(),
)
await proxy.connect()
await proxy.run_until_closed()
await proxy.disconnect()
```

The default Bleak-backed implementations (`BleakScanSource`,
`BleakDeviceResolver`) live in `matter_ble_proxy.bleak_backend`.

### Reconnection

`MatterBleProxy` does not reconnect on its own. When the WebSocket closes — server
restart, network blip, or the caller calling `disconnect()` — `run_until_closed()`
returns after the library releases all BLE resources (active scan stopped, every
peripheral disconnected). The caller decides whether to reconnect:

- The bundled CLI exits on disconnect; restart it manually.
- Home Assistant ties the BLE proxy lifecycle to the matter-server WebSocket: when
  HA reconnects to the matter-server it constructs and connects a fresh
  `MatterBleProxy` for the new session.
- A custom integration can wrap `connect()` + `run_until_closed()` in a retry loop
  with whatever backoff and cancellation policy fits its supervisor.

The library deliberately stays out of this decision so it can plug into hosts
that already own reconnect logic (HA, systemd, etc.) without fighting them.

## Development

This package lives inside the
[matter-js/matterjs-server](https://github.com/matter-js/matterjs-server) repo
and shares its release pipeline. From the repo root:

```bash
npm run python-ble-proxy:install      # create venv + install editable + test deps
npm run python-ble-proxy:lint         # ruff
npm run python-ble-proxy:typecheck    # mypy
npm run python-ble-proxy:test         # pytest
npm run python-ble-proxy:build        # build sdist+wheel
```
