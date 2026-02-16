# BLE Proxy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the BLE proxy system that allows the Matter.js server to perform BLE commissioning through a remote BLE-capable client (Home Assistant or Noble-based reference client) over a WebSocket protocol.

**Architecture:** A new `packages/ble-proxy` package implements the matter.js `Ble` abstract class by proxying BLE operations over a `/ble` WebSocket. The server-side proxies scan/connect/GATT operations as JSON commands; characteristic data flows as binary WebSocket frames. A Noble-based reference client provides a standalone BLE proxy for testing and local BLE use without HA.

**Tech Stack:** TypeScript, matter.js BLE abstractions (`Ble`, `Scanner`, `ConnectionlessTransport`, `BleChannel`, `BtpSessionHandler`), WebSocket (`ws` library), `@matter/nodejs-ble` (for reference client only)

**Design docs:**
- Architecture: `docs/plans/2026-02-05-ble-proxy-design.md`
- Protocol spec: `docs/ble-proxy-protocol.md`

**Verify commands (run after each task):**
```bash
npm run build          # Must pass
npm run lint           # Must pass
npm run format-verify  # Must pass (run npm run format to fix)
npm test               # Must pass
```

---

### Task 1: Create packages/ble-proxy package scaffold

**Files:**
- Create: `packages/ble-proxy/package.json`
- Create: `packages/ble-proxy/tsconfig.json`
- Create: `packages/ble-proxy/src/tsconfig.json`
- Create: `packages/ble-proxy/src/index.ts`
- Modify: root `package.json` (add workspace)

**Step 1: Create package.json**

Create `packages/ble-proxy/package.json`:

```json
{
    "name": "@matter-server/ble-proxy",
    "version": "0.0.0-git",
    "type": "module",
    "description": "BLE proxy implementation for matter.js - proxies BLE operations over WebSocket",
    "bugs": {
        "url": "https://github.com/matter-js/matterjs-server/issues"
    },
    "homepage": "https://github.com/matter-js/matterjs-server",
    "repository": {
        "type": "git",
        "url": "git+https://github.com/matter-js/matterjs-server.git"
    },
    "author": "Open Home Foundation",
    "main": "dist/esm/index.js",
    "scripts": {
        "clean": "matter-build clean",
        "build": "matter-build",
        "build-clean": "matter-build --clean",
        "noble-ble-proxy": "matter-run src/example/noble-ble-proxy.ts"
    },
    "engines": {
        "node": ">=20.19.0 <22.0.0 || >=22.13.0"
    },
    "dependencies": {
        "@matter/main": "0.16.9-alpha.0-20260204-fd5b6ed86",
        "@matter/protocol": "0.16.9-alpha.0-20260204-fd5b6ed86",
        "ws": "^8.19.0"
    },
    "optionalDependencies": {
        "@matter/nodejs-ble": "0.16.9-alpha.0-20260204-fd5b6ed86"
    },
    "devDependencies": {
        "@types/node": "^25.0.10",
        "@types/ws": "^8.18.1"
    },
    "files": [
        "dist/**/*",
        "src/**/*",
        "LICENSE",
        "README.md"
    ],
    "publishConfig": {
        "access": "public"
    }
}
```

**Step 2: Create tsconfig files**

Create `packages/ble-proxy/tsconfig.json`:
```json
{
    "compilerOptions": { "composite": true },
    "files": [],
    "references": [{ "path": "src" }]
}
```

Create `packages/ble-proxy/src/tsconfig.json`:
```json
{
    "extends": "../../tools/tsc/tsconfig.lib.json",
    "compilerOptions": {
        "types": ["node"]
    },
    "references": []
}
```

**Step 3: Create initial index.ts**

Create `packages/ble-proxy/src/index.ts`:
```typescript
/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @matter-server/ble-proxy - BLE proxy for matter.js over WebSocket
 */

export * from "./BleProxyProtocol.js";
```

**Step 4: Add workspace to root package.json**

In root `package.json`, add `"packages/ble-proxy"` to the `workspaces` array, before `"packages/matter-server"` (since matter-server will depend on it):

```json
"workspaces": [
    "packages/tools",
    "packages/custom-clusters",
    "packages/ws-controller",
    "packages/ws-client",
    "packages/dashboard",
    "packages/ble-proxy",
    "packages/matter-server"
]
```

**Step 5: Run `npm install` to link the new workspace**

```bash
npm install
```

**Step 6: Verify build**

```bash
npm run build
```

Expected: Build succeeds (ble-proxy compiles but exports nothing useful yet).

**Step 7: Commit**

```
feat(ble-proxy): scaffold packages/ble-proxy package
```

---

### Task 2: BleProxyProtocol - Message types and binary frame codec

**Files:**
- Create: `packages/ble-proxy/src/BleProxyProtocol.ts`

**Step 1: Create protocol types and codec**

Create `packages/ble-proxy/src/BleProxyProtocol.ts` with:

- Protocol version constant (`BLE_PROXY_PROTOCOL_VERSION = 1`)
- Hello/HelloResponse message types
- Command names enum (all 11 commands from the protocol spec)
- Event names enum (all 4 events)
- TypeScript interfaces for every command args/result and event data
- Binary frame opcodes enum (`WRITE_DATA = 0x01`, `NOTIFICATION = 0x02`, `READ_RESPONSE = 0x03`)
- `encodeBinaryFrame(opcode, connectionHandle, payload)` -> `Uint8Array`
- `decodeBinaryFrame(data)` -> `{ opcode, connectionHandle, payload }`
- Error codes string union type

Reference the protocol spec at `docs/ble-proxy-protocol.md` for exact field names and types.

**Step 2: Verify build**

```bash
npm run build && npm run lint
```

**Step 3: Commit**

```
feat(ble-proxy): add protocol types and binary frame codec
```

---

### Task 3: BleProxyHandler - WebSocket server endpoint for /ble

**Files:**
- Create: `packages/ble-proxy/src/BleProxyHandler.ts`
- Modify: `packages/ble-proxy/src/index.ts` (add export)

This is the `/ble` WebSocket server endpoint. It implements `WebServerHandler` and manages:
- Accepting a single WebSocket client connection on the `/ble` path
- Hello handshake with version validation
- Routing JSON commands from `ProxyBleClient`/`ProxyBleScanner` to the connected WS client
- Routing binary frames bidirectionally
- Connection state management (connected/disconnected)

**Step 1: Implement BleProxyHandler**

Create `packages/ble-proxy/src/BleProxyHandler.ts`:

- Class `BleProxyHandler implements WebServerHandler`
- Constructor: no args
- `register(server)`: Creates `WebSocketServer` on `/ble` path, similar to how `WebSocketControllerHandler` uses `new WebSocketServer({ noServer: true })` and listens to the HTTP server's `upgrade` event for the `/ble` path
- `unregister()`: Closes WebSocket server and active connections
- `get connected(): boolean` - whether a client is connected and handshake completed
- `async sendCommand(command, args)`: Sends a JSON command to the client, returns a Promise that resolves with the response. Uses incrementing message IDs. Rejects if no client connected.
- `sendBinaryFrame(opcode, connectionHandle, payload)`: Sends a binary frame to the client
- `onEvent(callback)`: Register callback for JSON events from the client
- `onBinaryFrame(callback)`: Register callback for binary frames from the client
- Hello handshake: on connection, wait for `{type: "hello", version: 1}` within 10 seconds, respond with `{type: "hello_response", version: 1}`

Add `WebServerHandler` import from `@matter-server/ws-controller` - note this creates a dependency on ws-controller. Alternatively, since `WebServerHandler` is just a simple interface (`register(server)`, `unregister()`), and `HttpServer` is just `ReturnType<typeof createServer>`, we can define them locally or import from ws-controller. Prefer importing from ws-controller to stay consistent.

Add `@matter-server/ws-controller` as a dependency in `packages/ble-proxy/package.json`:
```json
"dependencies": {
    "@matter-server/ws-controller": "*",
    ...
}
```

And add the tsconfig reference in `packages/ble-proxy/src/tsconfig.json`:
```json
"references": [
    { "path": "../../ws-controller/src" }
]
```

**Step 2: Export from index.ts**

Add to `packages/ble-proxy/src/index.ts`:
```typescript
export * from "./BleProxyHandler.js";
```

**Step 3: Verify build**

```bash
npm run build && npm run lint
```

**Step 4: Commit**

```
feat(ble-proxy): add BleProxyHandler WebSocket server for /ble
```

---

### Task 4: ProxyBleClient - BLE scanning over WebSocket

**Files:**
- Create: `packages/ble-proxy/src/ProxyBleClient.ts`

Replaces `NobleBleClient` from `@matter/nodejs-ble`. Instead of calling Noble, sends
`start_scan`/`stop_scan` commands over the WebSocket and listens for `device_discovered` events.

**Step 1: Implement ProxyBleClient**

Must match the interface that `BleScanner` expects from its client (see `NobleBleClient` and `ReactNativeBleClient` for the contract):

- `setDiscoveryCallback(callback: (peripheral: ProxyPeripheral, manufacturerData: Bytes) => void)`
- `async startScanning(): Promise<void>`
- `async stopScanning(): Promise<void>`
- `close(): void`

Since the real implementations pass a Noble `Peripheral` or RN `Device` to the callback, and our `BleScanner` needs to store the peripheral for later `getDiscoveredDevice()`, define a `ProxyPeripheral` type that captures what comes from `device_discovered` events: `{ address: string, name?: string, rssi?: number, connectable: boolean, serviceData: Map<string, Bytes>, mtu?: number }`.

The `ProxyBleClient` takes a `BleProxyHandler` reference and uses `handler.sendCommand("start_scan", ...)` and `handler.onEvent(...)`.

**Step 2: Verify build**

```bash
npm run build && npm run lint
```

**Step 3: Commit**

```
feat(ble-proxy): add ProxyBleClient for scanning over WebSocket
```

---

### Task 5: ProxyBleScanner - Implements matter.js Scanner interface

**Files:**
- Create: `packages/ble-proxy/src/ProxyBleScanner.ts`

Implements the `Scanner` interface from matter.js. This is modeled directly on `BleScanner`
from `@matter/nodejs-ble` (see `packages/nodejs-ble/src/BleScanner.ts` which we read earlier).

**Step 1: Implement ProxyBleScanner**

Must implement the `Scanner` interface:
- `readonly type = ChannelType.BLE`
- `findCommissionableDevices(identifier, timeout?, ignoreExistingRecords?): Promise<CommissionableDevice[]>`
- `findCommissionableDevicesContinuously(identifier, callback, timeout?, cancelSignal?): Promise<CommissionableDevice[]>`
- `getDiscoveredCommissionableDevices(identifier): CommissionableDevice[]`
- `cancelCommissionableDeviceDiscovery(identifier, resolvePromise?)`
- `findOperationalDevice(): Promise<undefined>` (BLE doesn't support operational discovery)
- `getDiscoveredOperationalDevice(): undefined`
- `getDiscoveredDevice(address): DiscoveredBleDevice` (used by the central interface)
- `close(): Promise<void>`

Copy the waiter/query pattern from `BleScanner` - it works well and is proven. Adapt `#handleDiscoveredDevice` to work with `ProxyPeripheral` instead of Noble `Peripheral`.

**Step 2: Verify build**

```bash
npm run build && npm run lint
```

**Step 3: Commit**

```
feat(ble-proxy): add ProxyBleScanner implementing matter.js Scanner
```

---

### Task 6: ProxyBleCentralInterface and ProxyBleChannel - GATT operations over WebSocket

**Files:**
- Create: `packages/ble-proxy/src/ProxyBleChannel.ts`

This is the most complex piece. `ProxyBleCentralInterface` implements `ConnectionlessTransport`
and `ProxyBleChannel` extends `BleChannel<Bytes>`.

**Step 1: Implement ProxyBleCentralInterface**

Implements `ConnectionlessTransport`:
- `openChannel(address: ServerAddress): Promise<Channel<Bytes>>`
- `onData(listener): ConnectionlessTransport.Listener`
- `close(): Promise<void>`
- `supports(type: ChannelType): boolean`

`openChannel` sequence (modeled on `NobleBleCentralInterface.openChannel` but using JSON commands instead of Noble calls):
1. `sendCommand("connect", { address })` -> get `connection_handle` and `mtu`
2. `sendCommand("discover_services", { connection_handle })` -> find `fff6`
3. `sendCommand("discover_characteristics", { connection_handle, service_uuid })` -> find C1, C2, C3
4. If C3 present and device has additional data: `sendCommand("read_characteristic", { connection_handle, characteristic_uuid: C3 })`
5. `sendCommand("write_characteristic", { connection_handle, characteristic_uuid: C1, value, response: false })` (BTP handshake)
6. `sendCommand("subscribe_characteristic", { connection_handle, characteristic_uuid: C2 })`
7. Wait for BTP handshake response via binary frame (opcode `0x02`)
8. Create `BtpSessionHandler.createAsCentral(...)` passing:
   - Write callback: sends binary frame opcode `0x01`
   - Disconnect callback: sends `disconnect` command
   - Message callback: forwards to `onMatterMessageListener`
9. Register binary frame handler for opcode `0x02` -> `btpSession.handleIncomingBleData()`
10. Return `ProxyBleChannel`

Include timeout handling and retry logic similar to `NobleBleCentralInterface` (connection guards with timeouts).

**Step 2: Implement ProxyBleChannel**

Extends `BleChannel<Bytes>`:
- Constructor: takes `connection_handle`, `BtpSessionHandler`, disconnect callback
- `send(data)`: delegates to `btpSession.sendMatterMessage(data)`
- `close()`: closes BTP session, sends disconnect
- `get name()`: returns `ble-proxy://address`
- Track `connected` state; handle `disconnected` event from WS

**Step 3: Verify build**

```bash
npm run build && npm run lint
```

**Step 4: Commit**

```
feat(ble-proxy): add ProxyBleCentralInterface and ProxyBleChannel
```

---

### Task 7: ProxyBle - Entry point extending matter.js Ble abstract class

**Files:**
- Create: `packages/ble-proxy/src/ProxyBle.ts`
- Modify: `packages/ble-proxy/src/index.ts` (add exports for all classes)

**Step 1: Implement ProxyBle**

Extends the `Ble` abstract class (from `@matter/protocol`):

```typescript
export class ProxyBle extends Ble {
    #handler: BleProxyHandler;
    #bleScanner?: ProxyBleScanner;
    #bleCentralInterface?: ProxyBleCentralInterface;
    #proxyBleClient?: ProxyBleClient;

    constructor(handler: BleProxyHandler) {
        super();
        this.#handler = handler;
    }

    get peripheralInterface(): BlePeripheralInterface {
        throw new ImplementationError("BLE Proxy only supports central mode, not peripheral");
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
            if (!this.#proxyBleClient) {
                this.#proxyBleClient = new ProxyBleClient(this.#handler);
            }
            this.#bleScanner = new ProxyBleScanner(this.#proxyBleClient);
        }
        return this.#bleScanner;
    }
}
```

**Step 2: Update index.ts with all exports**

```typescript
export * from "./BleProxyProtocol.js";
export * from "./BleProxyHandler.js";
export * from "./ProxyBle.js";
export * from "./ProxyBleClient.js";
export * from "./ProxyBleScanner.js";
export * from "./ProxyBleChannel.js";
```

**Step 3: Verify build**

```bash
npm run build && npm run lint
```

**Step 4: Commit**

```
feat(ble-proxy): add ProxyBle entry point implementing Ble abstract class
```

---

### Task 8: Integrate into matter-server - CLI flag and startup

**Files:**
- Modify: `packages/matter-server/src/cli.ts` (add `--ble-proxy` flag)
- Modify: `packages/matter-server/src/MatterServer.ts` (register handler, create ProxyBle)
- Modify: `packages/matter-server/package.json` (add ble-proxy dependency)
- Modify: `packages/matter-server/src/tsconfig.json` (add reference)

**Step 1: Add --ble-proxy CLI flag**

In `packages/matter-server/src/cli.ts`:

Add to `CliOptions` interface:
```typescript
bleProxy: boolean;
```

Add after the `--bluetooth-adapter` option:
```typescript
.addOption(
    new Option("--ble-proxy [value]", "Enable BLE proxy mode (for remote BLE via WebSocket)")
        .argParser(parseBooleanEnv)
        .preset(true)
        .default(false)
        .env("BLE_PROXY"),
)
```

Add to return value:
```typescript
bleProxy: opts.bleProxy,
```

**Step 2: Wire up in MatterServer.ts**

Add import:
```typescript
import { BleProxyHandler, ProxyBle } from "@matter-server/ble-proxy";
```

After the existing BLE adapter block (line ~92), add:
```typescript
if (cliOptions.bleProxy) {
    if (cliOptions.bluetoothAdapter !== null) {
        logger.warn("--ble-proxy and --bluetooth-adapter are mutually exclusive. Using --ble-proxy.");
    }
    env.vars.set("ble.enable", true);
    logger.info("BLE proxy mode enabled");
}
```

In the `start()` function, before creating the `WebServer` (line ~194), add the BLE proxy handler:
```typescript
let bleProxyHandler: BleProxyHandler | undefined;
if (cliOptions.bleProxy) {
    bleProxyHandler = new BleProxyHandler();
    handlers.push(bleProxyHandler);
}
```

Register `ProxyBle` with the matter.js environment. Look at how `@matter/nodejs-ble` registers itself - it sets `Ble` on the environment. We need to do the same with `ProxyBle`. Check the matter.js source for the registration pattern (likely `Environment.default.set(Ble, new ProxyBle(handler))`).

**Step 3: Add dependency in package.json**

In `packages/matter-server/package.json` add to dependencies:
```json
"@matter-server/ble-proxy": "*"
```

In `packages/matter-server/src/tsconfig.json` add to references:
```json
{ "path": "../../ble-proxy/src" }
```

**Step 4: Verify build and test**

```bash
npm install
npm run build && npm run lint && npm test
```

**Step 5: Commit**

```
feat(matter-server): integrate BLE proxy with --ble-proxy CLI flag
```

---

### Task 9: Noble BLE Proxy reference client

**Files:**
- Create: `packages/ble-proxy/src/example/NobleBleProxyClient.ts`
- Create: `packages/ble-proxy/src/example/noble-ble-proxy.ts`

**Step 1: Implement NobleBleProxyClient**

A WebSocket client that connects to `ws://host:port/ble` and implements the client side
of the BLE proxy protocol using Noble (via `@matter/nodejs-ble` classes):

- Connects to WS, sends `hello`, waits for `hello_response`
- Listens for JSON commands, dispatches to handlers
- `start_scan` handler: Uses `NobleBleClient.startScanning()` and sends `device_discovered` events
- `connect` handler: Uses Noble `peripheral.connectAsync()`, assigns connection handle
- `discover_services` handler: Uses `peripheral.discoverServicesAsync()`
- `discover_characteristics` handler: Uses `service.discoverCharacteristicsAsync()`
- `read_characteristic` handler: Uses `characteristic.readAsync()`
- `write_characteristic` handler: Uses `characteristic.writeAsync()`
- `subscribe_characteristic` handler: Uses `characteristic.subscribeAsync()`, sends binary `0x02` frames for notifications
- Handles binary `0x01` frames by writing to the appropriate characteristic
- `disconnect`, `stop_scan`, `unsubscribe_characteristic`, `request_mtu` handlers

This is essentially the inverse of `ProxyBleClient`/`ProxyBleChannel` - it receives commands
and executes them with real BLE hardware.

**Step 2: Implement CLI entry point**

Create `packages/ble-proxy/src/example/noble-ble-proxy.ts`:

```typescript
#!/usr/bin/env node
import { Command, Option } from "commander";
import { NobleBleProxyClient } from "./NobleBleProxyClient.js";

const program = new Command();
program
    .name("noble-ble-proxy")
    .description("Noble-based BLE proxy client for Matter.js server")
    .addOption(new Option("--server <url>", "Matter server BLE proxy URL").default("ws://localhost:5580/ble"))
    .addOption(new Option("--hci-id <id>", "Bluetooth adapter HCI ID").argParser(parseInt))
    .parse();

const opts = program.opts();
const client = new NobleBleProxyClient(opts.server, opts.hciId);

console.log(`Connecting to ${opts.server}...`);
await client.connect();
console.log("Connected. BLE proxy active. Press Ctrl+C to stop.");

process.on("SIGINT", () => {
    client.close();
    process.exit(0);
});
```

**Step 3: Add convenience script to root package.json**

```json
"noble-ble-proxy": "npm run noble-ble-proxy -w packages/ble-proxy"
```

**Step 4: Verify build**

```bash
npm run build && npm run lint
```

Note: `commander` is already available from the matter-server package but might need to be added to ble-proxy's dependencies. Add it if needed.

**Step 5: Commit**

```
feat(ble-proxy): add Noble-based reference BLE proxy client
```

---

### Task 10: Test utilities - BleProxyTestClient and MockBleDevice

**Files:**
- Create: `packages/ble-proxy/test/tsconfig.json`
- Create: `packages/ble-proxy/test/BleProxyTestClient.ts`
- Create: `packages/ble-proxy/test/MockBleDevice.ts`
- Create: `packages/ble-proxy/test/BleProxyProtocolTest.ts`
- Modify: `packages/ble-proxy/tsconfig.json` (add test reference)

**Step 1: Create test tsconfig**

Create `packages/ble-proxy/test/tsconfig.json`:
```json
{
    "extends": "../../tools/tsc/tsconfig.test.json",
    "references": [
        { "path": "../src" }
    ]
}
```

Update `packages/ble-proxy/tsconfig.json`:
```json
{
    "compilerOptions": { "composite": true },
    "files": [],
    "references": [{ "path": "src" }, { "path": "test" }]
}
```

**Step 2: Implement BleProxyTestClient**

A WebSocket client for tests that simulates the HA side:

- `connect(url)`: Connect to `/ble`, perform hello handshake
- `onCommand(command, handler)`: Register handler for a specific command
- `sendEvent(event, data)`: Send a JSON event
- `sendBinaryFrame(opcode, handle, payload)`: Send a binary frame
- `close()`: Disconnect
- `waitForCommand(command, timeout?)`: Wait for a specific command (returns a promise)

**Step 3: Implement MockBleDevice**

Simulates a Matter-compatible BLE peripheral:

- Constructor: `new MockBleDevice({ discriminator, vendorId, productId })`
- `get advertisementServiceData(): Bytes` - 8-byte Matter BLE advertisement payload
- `get address(): string` - Mock MAC address
- GATT service/characteristic structure with C1, C2, C3
- `handleBtpHandshake(request: Bytes): Bytes` - Generate handshake response

**Step 4: Write protocol codec tests**

Create `packages/ble-proxy/test/BleProxyProtocolTest.ts`:

- Test `encodeBinaryFrame` / `decodeBinaryFrame` roundtrip
- Test with various opcodes, connection handles, payloads
- Test edge cases: empty payload, max connection handle (0xFFFF)

**Step 5: Verify build and test**

```bash
npm run build && npm test
```

**Step 6: Commit**

```
feat(ble-proxy): add test utilities and protocol codec tests
```

---

### Task 11: Integration test - full proxy pipeline with mock device

**Files:**
- Create: `packages/ble-proxy/test/BleProxyIntegrationTest.ts`

**Step 1: Write integration test**

Test the full pipeline:
1. Create a `BleProxyHandler` and register it on a test HTTP server
2. Connect `BleProxyTestClient` to the handler
3. Create `ProxyBle` with the handler
4. Call `proxyBle.scanner.findCommissionableDevices()` from the server side
5. Verify the test client receives `start_scan` command
6. Have the test client respond with a mock `device_discovered` event
7. Verify the scanner returns the discovered device
8. Test `stop_scan` is sent

Also test connection flow:
1. Call `proxyBle.centralInterface.openChannel(address)`
2. Verify test client receives `connect`, `discover_services`, `discover_characteristics`, `subscribe_characteristic` commands in sequence
3. Respond appropriately from test client with mock GATT data
4. Verify BTP handshake flows through binary frames

**Step 2: Verify all tests pass**

```bash
npm run build && npm test
```

**Step 3: Commit**

```
test(ble-proxy): add integration tests for full proxy pipeline
```

---

### Task 12: Final verification and cleanup

**Step 1: Run full quality checklist**

```bash
npm run format
npm run lint
npm run build
npm test
```

**Step 2: Verify server starts with --ble-proxy**

```bash
npm run server -- --ble-proxy
```

Expected: Server starts, logs "BLE proxy mode enabled", `/ble` WebSocket endpoint available.

**Step 3: Verify --bluetooth-adapter still works**

```bash
npm run server -- --bluetooth-adapter 0
```

Expected: Server starts with native BLE (existing behavior unchanged).

**Step 4: Commit any cleanup**

```
chore(ble-proxy): final cleanup and formatting
```
