# @matter-server/ble-proxy

BLE proxy support for the Matter server — enables BLE commissioning of Matter devices through a remote Bluetooth adapter over WebSocket.

## Overview

Instead of requiring a Bluetooth adapter on the server host, a **proxy client** sits next to the BLE hardware and executes BLE commands on behalf of the server over a WebSocket connection:

```
[Matter Device]  <-- BLE -->  [Proxy Client]  <-- WebSocket /ble -->  [Matter Server]
```

The primary use case is Home Assistant (with local or ESPHome BLE proxies) acting as the proxy client. See the [BLE Proxy Protocol documentation](../../docs/ble-proxy-protocol.md) for the full protocol specification.

## Enabling BLE Proxy Mode on the Server

Start the Matter server with the `--ble-proxy` flag:

```bash
npm run server -- --ble-proxy
# or
BLE_PROXY=true npm run server
```

This exposes a `/ble` WebSocket endpoint (e.g. `ws://localhost:5580/ble`) that proxy clients connect to.

> **Note:** `--ble-proxy` and `--bluetooth-adapter` are mutually exclusive.

## Noble Example Client

The package includes a reference proxy client that bridges a local Bluetooth adapter to the server using [Noble](https://github.com/stoprocent/noble). This is useful for:
- Testing BLE commissioning without Home Assistant
- Running the server on a machine without native BLE bindings

### Prerequisites

- A host with a Bluetooth adapter (Linux or macOS)
- Server running with `--ble-proxy`
- `@matter/nodejs-ble` optional dependency available (listed in `optionalDependencies`)

For Noble-specific setup (permissions, platform requirements, known limitations), see the
[Noble prerequisites section](https://github.com/matter-js/matter.js/tree/main/packages/nodejs-ble#prerequisites-and-limitations)
in the `@matter/nodejs-ble` README.

### Running

```bash
# Default: connect to ws://localhost:5580/ble
npm run noble-ble-proxy

# Custom server URL
npm run noble-ble-proxy -- --server ws://192.168.1.100:5580/ble

# Specific HCI adapter
npm run noble-ble-proxy -- --hci-id 1

# Help
npm run noble-ble-proxy -- --help
```

Once connected, you will see:

```
Connecting to ws://localhost:5580/ble...
BLE proxy handshake complete (protocol v1)
Connected. BLE proxy active. Press Ctrl+C to stop.
```

The proxy stays connected and handles BLE commissioning commands transparently whenever a commission-via-BLE is triggered.

## Home Assistant Integration

The Home Assistant Matter integration automatically connects to `/ble` when the server reports `bluetooth_enabled: true`. Start the server with `--ble-proxy` (or `ble_proxy: true` in the add-on config). No further HA-side configuration is needed.
