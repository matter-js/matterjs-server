# BLE Proxy Architecture Design

## Problem Statement

The Matter.js server currently supports BLE commissioning only via a local Bluetooth adapter
(using `@matter/nodejs-ble` which wraps the Noble library). This requires a physical BLE adapter
attached to the machine running the server.

Home Assistant users commonly use ESPHome BLE Proxies - ESP32 devices distributed around their
home that relay BLE traffic back to HA. The HA Bluetooth component abstracts this via Bleak,
making local adapters and ESPHomeb proxies interchangeable.

We want to bridge these two worlds: let the Matter.js server use HA's BLE infrastructure
(including ESPHome proxies) for BLE commissioning, without requiring a local Bluetooth adapter.

## Architecture Overview

Three new components spanning two repositories:

```
+-----------------------------+     +----------------------------------+
|   Home Assistant (Python)   |     |   Matter.js Server (TypeScript)  |
|                             |     |                                  |
|  +-----------------------+  |     |  +----------------------------+  |
|  | Matter Integration    |  |     |  | packages/matter-server     |  |
|  | + BLE Proxy Client    |--+--+--+--| /ble WebSocket endpoint    |  |
|  |   (ble_proxy.py)      |  |  |  |  +------------+---------------+  |
|  +-----------+-----------+  |  |  |               |                  |
|              |              |  |  |  +------------v---------------+  |
|  +-----------v-----------+  |  |  |  | packages/ble-proxy         |  |
|  | HA Bluetooth Component|  | WS  |  | (NEW PACKAGE)              |  |
|  | (BleakClient/Scanner) |  |  |  |  | Implements matter.js Ble   |  |
|  +-----------+-----------+  |  |  |  | abstract class via proxy   |  |
|              |              |  |  |  +----------------------------+  |
|  +-----------v-----------+  |  |  |                                  |
|  | ESPHome BLE Proxy /   |  |  |  |  matter.js controller uses Ble  |
|  | Local BLE Adapter     |  |  |  |  abstraction transparently      |
|  +-----------------------+  |  |  +----------------------------------+
+-----------------------------+  |
                                 |
                    /ble WebSocket (lazy, on-demand)
```

### Key Design Decisions

1. **Matter-server hosts the /ble WebSocket endpoint** on the same host:port as the main `/ws`
   endpoint (e.g. `ws://host:5580/ble`). HA connects to it as a client.

2. **JSON for control messages, binary WebSocket frames for BLE data.** Control messages
   (scan, connect, discover services) use JSON. High-throughput characteristic data
   (BTP writes/notifications) use binary frames for efficiency.

3. **HA uses its Bluetooth component** (not raw Bleak). This gives automatic ESPHome BLE proxy
   support, local adapter support, and multi-scanner capability - all transparent to our code.

4. **Lazy /ble WebSocket connection.** The `/ble` connection is established on-demand when
   BLE commissioning is requested, and torn down after commissioning completes. No persistent
   second connection.

5. **Reuse `bluetooth_enabled` flag.** The existing `bluetooth_enabled` field in
   `server_information` is set to `true` when `--ble-proxy` mode is active. HA and the
   dashboard use this as a capability gate for BLE commissioning UI/commands - no new field
   needed.

6. **Peripheral mode throws `ImplementationError`.** Like the React Native implementation,
   the BLE proxy only supports central (client) mode, not peripheral (server) mode.

## Data Flow: BLE Commissioning

```
1. User triggers commission_with_code on /ws (existing command)

2. ControllerCommandHandler calls controller.commissionNode()
   with discoveryCapabilities: { ble: true }

3. matter.js calls ProxyBleScanner.findCommissionableDevices()
   -> ProxyBleClient sends JSON: {"command": "start_scan", ...}
   -> Over /ble WebSocket to HA

4. HA MatterBleProxy._handle_start_scan():
   - Calls HA bluetooth component scanner
   - ESPHome proxies + local adapters all participate transparently
   - Sends device_discovered events back over /ble WS

5. ProxyBleScanner matches device by discriminator
   -> matter.js calls ProxyBleCentralInterface.openChannel(address)

6. ProxyBleCentralInterface sends sequence over /ble WS:
   connect -> discover_services -> discover_characteristics
   -> HA executes each via BleakClient

7. BTP handshake: write to C1 characteristic, subscribe to C2
   -> Binary frames flow for characteristic data
   -> ProxyBleChannel wraps BtpSessionHandler (same as Noble impl)

8. Matter commissioning proceeds over BTP tunnel
   -> WiFi/Thread credentials delivered to device
   -> Device joins network, operational discovery via mDNS

9. BLE connection closes (device now on IP network)
10. /ble WebSocket torn down
```

## BLE Proxy WebSocket Protocol

### Connection Lifecycle

- HA connects to `ws://host:5580/ble` on demand (when BLE commissioning starts)
- Client sends `hello` with protocol version, server responds with `hello_response`
  (see `docs/ble-proxy-protocol.md` for full handshake spec)
- Only one client connection allowed at a time
- Connection torn down after commissioning completes or on error
- If `/ble` connection fails, commissioning falls back to network-only with a clear error log

### JSON Control Messages (text WebSocket frames)

**Request (server -> HA):**
```json
{
  "id": 1,
  "command": "start_scan",
  "args": {
    "service_uuids": ["fff6"],
    "allow_duplicates": true
  }
}
```

**Response (HA -> server):**
```json
{
  "id": 1,
  "success": true,
  "result": {}
}
```

**Error Response (HA -> server):**
```json
{
  "id": 1,
  "success": false,
  "error": "bluetooth_unavailable",
  "message": "No Bluetooth adapters available"
}
```

**Event (HA -> server, unsolicited):**
```json
{
  "event": "device_discovered",
  "data": {
    "address": "AA:BB:CC:DD:EE:FF",
    "name": "MATTER-3840",
    "rssi": -65,
    "connectable": true,
    "service_data": {"fff6": "AAAPoff/AYA="},
    "mtu": 247
  }
}
```

### Commands

| Command | Direction | Args | Purpose |
|---|---|---|---|
| `start_scan` | server->HA | `service_uuids`, `allow_duplicates` | Start BLE scanning |
| `stop_scan` | server->HA | | Stop BLE scanning |
| `connect` | server->HA | `address` | Connect to peripheral |
| `disconnect` | server->HA | `connection_handle` | Disconnect peripheral |
| `discover_services` | server->HA | `connection_handle` | Discover GATT services |
| `discover_characteristics` | server->HA | `connection_handle`, `service_uuid` | Discover characteristics |
| `read_characteristic` | server->HA | `connection_handle`, `characteristic_uuid` | Read value |
| `write_characteristic` | server->HA | `connection_handle`, `characteristic_uuid`, `value` (base64) | Write value (response in JSON) |
| `subscribe_characteristic` | server->HA | `connection_handle`, `characteristic_uuid` | Subscribe to notifications |
| `unsubscribe_characteristic` | server->HA | `connection_handle`, `characteristic_uuid` | Unsubscribe |
| `request_mtu` | server->HA | `connection_handle`, `mtu` | Request MTU size |

### Events

| Event | Direction | Data | Purpose |
|---|---|---|---|
| `device_discovered` | HA->server | `address`, `name`, `rssi`, `connectable`, `service_data`, `mtu` | BLE device found |
| `connected` | HA->server | `connection_handle`, `address`, `mtu` | Peripheral connected |
| `disconnected` | HA->server | `connection_handle`, `reason` | Peripheral disconnected |
| `scan_stopped` | HA->server | `reason` | Scan ended unexpectedly |

### Binary Frames (binary WebSocket frames)

Used for high-throughput characteristic data (BTP writes and notifications).

```
Binary frame layout:
[1 byte: opcode] [2 bytes: connection_handle (big-endian)] [N bytes: payload]

Opcodes:
0x01 = write_data       (server->HA: write payload to current characteristic)
0x02 = notification      (HA->server: notification data from subscribed characteristic)
0x03 = read_response     (HA->server: response to read_characteristic)
```

The `connection_handle` is assigned by the HA side in the `connected` event response and used
to multiplex multiple concurrent BLE connections over a single WebSocket.

The characteristic UUID context for binary frames is established by the preceding JSON
`subscribe_characteristic` or `write_characteristic` command that set up the binary channel.

## TypeScript: packages/ble-proxy

New package in this monorepo implementing the matter.js `Ble` abstract class via the proxy protocol.

### File Structure

```
packages/ble-proxy/
├── package.json              # @matter-server/ble-proxy
├── tsconfig.json
├── src/
│   ├── index.ts              # Exports ProxyBle
│   ├── ProxyBle.ts           # Extends Ble abstract class
│   ├── ProxyBleClient.ts     # Sends scan commands over WS
│   ├── ProxyBleScanner.ts    # Implements Scanner interface
│   ├── ProxyBleChannel.ts    # ConnectionlessTransport + BleChannel
│   └── BleProxyProtocol.ts   # Protocol types, binary frame codec
└── test/
    ├── BleProxyTestClient.ts # WS client for testing (speaks HA side of protocol)
    ├── MockBleDevice.ts      # Simulates a Matter BLE peripheral
    └── BleProxyTest.ts       # Integration tests
```

### Class Mapping

| matter.js interface | nodejs-ble implementation | ble-proxy implementation |
|---|---|---|
| `Ble` (abstract) | `NodeJsBle` | `ProxyBle` |
| Low-level BLE client | `NobleBleClient` (uses Noble) | `ProxyBleClient` (uses WebSocket) |
| `Scanner` | `BleScanner` | `ProxyBleScanner` |
| `ConnectionlessTransport` | `NobleBleCentralInterface` | `ProxyBleCentralInterface` |
| `BleChannel<Bytes>` | `NobleBleChannel` | `ProxyBleChannel` |
| `BlePeripheralInterface` | `BlenoPeripheralInterface` | Throws `ImplementationError` |

### ProxyBle (entry point)

```typescript
export class ProxyBle extends Ble {
    #handler: BleProxyHandler;  // Reference to the /ble WebSocket handler
    #bleScanner?: ProxyBleScanner;
    #bleCentralInterface?: ProxyBleCentralInterface;

    constructor(handler: BleProxyHandler) {
        super();
        this.#handler = handler;
    }

    get peripheralInterface(): BlePeripheralInterface {
        throw new ImplementationError("BLE Proxy only supports central mode");
    }

    get centralInterface(): ConnectionlessTransport {
        if (!this.#bleCentralInterface) {
            this.#bleCentralInterface = new ProxyBleCentralInterface(
                this.scanner as ProxyBleScanner,
                this.#handler,
            );
        }
        return this.#bleCentralInterface;
    }

    get scanner(): Scanner {
        if (!this.#bleScanner) {
            this.#bleScanner = new ProxyBleScanner(
                new ProxyBleClient(this.#handler),
            );
        }
        return this.#bleScanner;
    }
}
```

### ProxyBleClient (replaces NobleBleClient)

Instead of calling `noble.startScanningAsync()`, sends `{"command": "start_scan"}` over WS.
Instead of listening to Noble's `discover` event, listens for `device_discovered` WS events.

Key methods:
- `startScanning()` - sends start_scan command, waits for response
- `stopScanning()` - sends stop_scan command
- `setDiscoveryCallback(cb)` - registers callback for device_discovered events
- `close()` - cleanup

### ProxyBleCentralInterface (replaces NobleBleCentralInterface)

`openChannel(address)` sends a sequence of commands over WS:
1. `connect` - establishes BLE connection via HA's BleakClient
2. `discover_services` - finds the Matter service (fff6)
3. `discover_characteristics` - finds C1 (write), C2 (subscribe), C3 (read)
4. `subscribe_characteristic` on C2 - sets up notification channel
5. Creates `ProxyBleChannel` wrapping `BtpSessionHandler`

### ProxyBleChannel (replaces NobleBleChannel)

Wraps `BtpSessionHandler` (reused from matter.js protocol package) but routes
characteristic writes as binary WS frames instead of Noble calls:

- `BtpSessionHandler` write callback -> binary frame opcode 0x01 -> WS -> HA -> BleakClient write
- HA BleakClient notification -> binary frame opcode 0x02 -> WS -> `BtpSessionHandler.handleIncomingBleData()`

### Test Utilities

**BleProxyTestClient:** Connects to `/ble` as a WebSocket client, simulating the HA side.
Allows registering command handlers and sending events/binary frames.

**MockBleDevice:** Simulates a Matter-compatible BLE peripheral with configurable:
- Advertisement data (discriminator, vendor/product ID)
- GATT services and characteristics (C1, C2, C3)
- BTP handshake response generation

## Python: HA Matter Integration Changes

### Modified Files

| File | Change |
|---|---|
| `manifest.json` | Add `"bluetooth_adapters"` to dependencies |
| `__init__.py` | Lazy BLE proxy connection on commissioning |
| `ble_proxy.py` | **NEW** - BLE proxy WebSocket client |
| `const.py` | Add BLE-related constants |

### manifest.json

```json
{
  "dependencies": ["websocket_api", "bluetooth_adapters"],
  "requirements": ["python-matter-server==8.1.2"]
}
```

### ble_proxy.py

Core module that connects to `/ble` and proxies BLE operations:

```python
class MatterBleProxy:
    """Proxies BLE operations from matter-server to HA's bluetooth stack."""

    def __init__(self, hass: HomeAssistant, ws_url: str):
        self._hass = hass
        self._ws_url = ws_url        # e.g. ws://host:5580/ble
        self._ws = None               # aiohttp WebSocket connection
        self._connections: dict[int, BleakClient] = {}  # handle -> client
        self._next_handle = 1

    async def connect(self) -> None:
        """Connect to the matter-server /ble endpoint."""

    async def disconnect(self) -> None:
        """Disconnect and clean up all BLE connections."""

    async def _message_loop(self) -> None:
        """Main loop processing commands from matter-server."""

    async def _handle_start_scan(self, msg_id: int, args: dict) -> None:
        """Start BLE scanning using HA's bluetooth component."""
        # Uses HA's bluetooth scanner infrastructure
        # Registers callback that sends device_discovered events

    async def _handle_connect(self, msg_id: int, args: dict) -> None:
        """Connect to a BLE device using BleakClient."""
        # HA bluetooth component routes through ESPHome proxy if needed
        # Assigns connection_handle, stores BleakClient

    async def _handle_discover_services(self, msg_id, args) -> None:
        """Discover GATT services on connected device."""

    async def _handle_discover_characteristics(self, msg_id, args) -> None:
        """Discover characteristics for a specific service."""

    async def _handle_subscribe_characteristic(self, msg_id, args) -> None:
        """Subscribe to notifications - data sent as binary frames."""

    async def _handle_write_characteristic(self, msg_id, args) -> None:
        """Write data to a characteristic."""

    async def _handle_binary_frame(self, data: bytes) -> None:
        """Handle binary frame (write_data from server)."""
```

### __init__.py Changes

```python
async def async_setup_entry(hass, entry):
    # ... existing setup code ...

    # Store BLE proxy URL for lazy connection
    base_url = entry.data[CONF_URL]  # e.g. ws://host:5580/ws
    ble_url = base_url.replace("/ws", "/ble")
    # BLE proxy created on-demand during commissioning
    matter_entry_data.ble_proxy_url = ble_url
```

The actual BLE proxy connection happens lazily when commissioning requests BLE.

### Design Principle

The HA side does NOT understand Matter or BTP. It faithfully proxies raw BLE GATT operations
(scan, connect, service discovery, characteristic read/write/subscribe). All Matter-specific
logic (BTP handshake, message assembly, commissioning protocol) stays in the TypeScript
`packages/ble-proxy`.

## Noble BLE Proxy Example (Reference Client)

A Noble-based reference implementation of the BLE proxy client protocol, packaged as a
runnable example in `packages/ble-proxy`. This serves three purposes:

1. **Reference implementation** - Shows how to implement the client side of the protocol
2. **Standalone local BLE** - Use a local Bluetooth adapter without HA, via the proxy protocol
3. **Integration testing** - Test the full proxy pipeline with real BLE hardware

### File Structure

```
packages/ble-proxy/
├── src/
│   ├── ...                           # (proxy implementation files from above)
│   └── example/
│       ├── NobleBleProxyClient.ts     # Noble-based protocol client
│       └── noble-ble-proxy.ts         # CLI entry point
└── package.json
```

### NobleBleProxyClient

Connects to the matter-server `/ble` WebSocket as a client and fulfills BLE commands
using Noble (the same library used by `@matter/nodejs-ble`):

```typescript
import { NobleBleClient } from "@matter/nodejs-ble";

export class NobleBleProxyClient {
    #ws: WebSocket;
    #nobleClient: NobleBleClient;
    #connections = new Map<number, Peripheral>();
    #subscriptions = new Map<string, Characteristic>();  // handle:uuid -> char
    #nextHandle = 1;

    constructor(wsUrl: string, hciId?: number) {
        this.#nobleClient = new NobleBleClient({ hciId });
    }

    async connect(): Promise<void> {
        // Connect to ws://host:5580/ble
        // Send hello {version: 1}
        // Wait for hello_response
        // Start message loop
    }

    // Command handlers - called when server sends commands:

    async handleStartScan(id: number, args: object): Promise<void> {
        // this.#nobleClient.startScanning()
        // this.#nobleClient.setDiscoveryCallback((peripheral, data) => {
        //     sendEvent("device_discovered", { address, name, rssi, ... })
        // })
    }

    async handleConnect(id: number, args: { address: string }): Promise<void> {
        // Get peripheral from nobleClient's discovered devices
        // peripheral.connectAsync()
        // Assign connection handle
        // sendResponse(id, { connection_handle, mtu })
    }

    async handleDiscoverServices(id: number, args: object): Promise<void> {
        // peripheral.discoverServicesAsync()
        // sendResponse(id, { services: [...] })
    }

    async handleDiscoverCharacteristics(id: number, args: object): Promise<void> {
        // service.discoverCharacteristicsAsync()
        // sendResponse(id, { characteristics: [...] })
    }

    async handleWriteCharacteristic(id: number, args: object): Promise<void> {
        // characteristic.writeAsync(data, withoutResponse)
    }

    async handleSubscribeCharacteristic(id: number, args: object): Promise<void> {
        // characteristic.subscribeAsync()
        // characteristic.on("data", (data) => {
        //     sendBinaryFrame(0x02, handle, data)  // notification
        // })
    }

    async handleBinaryFrame(opcode: number, handle: number, data: Bytes): Promise<void> {
        // opcode 0x01 (WRITE_DATA): characteristic.writeAsync(data)
    }

    // ... disconnect, read, unsubscribe, request_mtu handlers
}
```

### CLI Entry Point (`noble-ble-proxy.ts`)

```typescript
#!/usr/bin/env node
import { NobleBleProxyClient } from "./NobleBleProxyClient.js";

// Usage: npx noble-ble-proxy --server ws://localhost:5580/ble --hci-id 0
const client = new NobleBleProxyClient(serverUrl, hciId);
await client.connect();
// Runs until WebSocket closes or SIGINT
```

### package.json Addition

```json
{
  "scripts": {
    "noble-ble-proxy": "matter-run src/example/noble-ble-proxy.ts"
  },
  "optionalDependencies": {
    "@matter/nodejs-ble": "..."
  }
}
```

The root `package.json` also gets a convenience script:

```json
{
  "scripts": {
    "noble-ble-proxy": "npm run noble-ble-proxy -w packages/ble-proxy"
  }
}
```

### Usage

```bash
# Start matter-server in BLE proxy mode
npm run server -- --ble-proxy

# In a separate terminal, start the Noble BLE proxy client
npm run noble-ble-proxy -- --server ws://localhost:5580/ble --hci-id 0
```

This gives the same end result as `--bluetooth-adapter 0` but through the proxy protocol,
validating the full proxy pipeline. It also serves as a standalone BLE bridge for
environments without Home Assistant.

## matter-server Changes

### New CLI Flag

```
--ble-proxy [value]    Enable BLE proxy mode (for Home Assistant BLE integration)
```

When `--ble-proxy` is set:
- `ProxyBle` is created instead of `NodeJsBle`
- `/ble` WebSocket endpoint is registered
- `bluetooth_enabled: true` is reported in `server_information`

`--ble-proxy` and `--bluetooth-adapter` are mutually exclusive.

### Modified Files

| File | Change |
|---|---|
| `packages/matter-server/src/cli.ts` | Add `--ble-proxy` flag |
| `packages/matter-server/src/MatterServer.ts` | Register BleProxyHandler, create ProxyBle |
| `packages/matter-server/package.json` | Add `@matter-server/ble-proxy` dependency |
| `packages/ws-controller/.../WebSocketControllerHandler.ts` | `bluetooth_enabled` from proxy state |
| Root `package.json` | Add `packages/ble-proxy` to workspaces |

## Implementation Phases

### Phase 1: Protocol Specification

Write `docs/ble-proxy-protocol.md` as a standalone specification. This is the shared contract
between TypeScript and Python implementations and serves as documentation for third-party
implementors.

### Phase 2: TypeScript Implementation

Build in the matter-server repo (this repo), bottom-up:

1. **BleProxyProtocol.ts** - Message types, binary frame codec
2. **BleProxyHandler** - WebSocket handler for /ble endpoint (in packages/matter-server)
3. **ProxyBleClient + ProxyBleScanner** - Scanning over WS
4. **ProxyBleCentralInterface + ProxyBleChannel** - Connection/BTP over WS
5. **ProxyBle** - Entry point, CLI integration
6. **NobleBleProxyClient** - Noble-based reference client (`npm run noble-ble-proxy`)
7. **Test utilities** - BleProxyTestClient, MockBleDevice, integration tests

The Noble reference client (step 6) validates the full proxy pipeline with real BLE hardware
and serves as the reference implementation for the protocol's client side.

### Phase 3: Python/HA Implementation

Build in the home-assistant-core repo:

1. **ble_proxy.py** - WebSocket client, command dispatch, BleakClient management
2. **__init__.py changes** - Lazy connection lifecycle
3. **manifest.json** - Add bluetooth_adapters dependency

### Phase 4: Integration Testing

- Unit tests for protocol codec (both sides)
- Mock WebSocket tests using BleProxyTestClient + MockBleDevice
- End-to-end with Noble client: `npm run server -- --ble-proxy` + `npm run noble-ble-proxy -- --hci-id 0`
  then commission a real Matter device over BLE
- End-to-end with HA: matter-server + HA matter integration + ESPHome BLE proxy

## Error Handling

| Scenario | Behavior |
|---|---|
| `/ble` WebSocket fails to connect | Log error, commissioning falls back to network-only |
| HA bluetooth component unavailable | `start_scan` returns error, surfaced to user |
| BLE device not found during scan | Normal timeout behavior (same as native BLE) |
| BLE connection drops mid-commissioning | `disconnected` event sent, matter.js retry logic |
| `/ble` WebSocket drops mid-commissioning | ProxyBleClient detects, rejects pending operations |
| ESPHome proxy goes offline | HA bluetooth handles this transparently |
| Multiple concurrent commissions | Each gets its own `connection_handle` |

## Future Considerations

- **Bidirectional proxy**: If needed, the protocol could support HA initiating BLE operations
  (e.g. for device diagnostics), but this is out of scope for the initial implementation.
- **Protocol versioning**: Add a version handshake if the protocol evolves significantly.
- **Compression**: Binary frames could use compression for large payloads, but BTP MTU limits
  make this unlikely to be needed.
- **Authentication**: The `/ble` endpoint is on localhost only (same as `/ws`), so no additional
  auth is needed for the initial implementation.
