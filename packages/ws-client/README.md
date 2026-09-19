# Open Home Foundation Matter(.js) Server - JavaScript WebSocket Client

![Matter Logo](https://github.com/matter-js/matterjs-server/raw/main/docs/matter_logo.svg)

This package provides a JavaScript WebSocket client library for connecting to the [OHF Matter Server](https://github.com/matter-js/matterjs-server). It can be used in both browser and Node.js environments.

The Open Home Foundation Matter Server software component is a project of the [Open Home Foundation](https://www.openhomefoundation.org/).

## Installation

```bash
npm install @matter-server/ws-client
```

## Usage

### Browser

In a browser environment, the client uses the native WebSocket API:

```typescript
import { MatterClient } from "@matter-server/ws-client";

const client = new MatterClient("ws://localhost:5580/ws");

// Start listening for events and load initial node data
await client.startListening();

// Access connected nodes
console.log("Connected nodes:", client.nodes);

// Listen for node changes
client.addEventListener("nodes_changed", () => {
    console.log("Nodes updated:", client.nodes);
});

// Commission a new device
const node = await client.commissionWithCode("MT:Y3.5UNQO100KA0648G00", false);
console.log("Commissioned node:", node.node_id);

// Send a device command (e.g., toggle a light)
await client.deviceCommand(node.node_id, 1, 6, "toggle");

// Disconnect when done
client.disconnect();
```

### Node.js

For Node.js, you need to provide a WebSocket factory using the `ws` package:

```typescript
import { MatterClient } from "@matter-server/ws-client";
import WebSocket from "ws";

const client = new MatterClient(
    "ws://localhost:5580/ws",
    (url) => new WebSocket(url) as unknown as WebSocketLike
);

await client.startListening();
console.log("Server info:", client.serverInfo);
console.log("Connected nodes:", Object.keys(client.nodes).length);
```

## API Reference

### MatterClient

The main client class for interacting with the Matter server.

#### Constructor

```typescript
new MatterClient(url: string, wsFactory?: WebSocketFactory)
```

- `url`: WebSocket URL to connect to (e.g., `ws://localhost:5580/ws`)
- `wsFactory`: Optional factory function to create WebSocket instances (required for Node.js)

#### Properties

- `connection`: The underlying `Connection` instance
- `nodes`: Record of all Matter nodes indexed by node ID
- `serverInfo`: Server information (fabric ID, SDK version, etc.)
- `serverBaseAddress`: The base address extracted from the URL
- `isProduction`: Whether connected to a production server (for UI purposes)
- `commandTimeout`: Default timeout for commands in milliseconds (default: 5 minutes). Set to `0` to disable timeouts.

#### Methods

| Method | Description |
|--------|-------------|
| `startListening()` | Connect and start receiving events |
| `disconnect()` | Disconnect from the server |
| `getNodes(onlyAvailable?)` | Get all nodes (optionally only available ones) |
| `commissionWithCode(code, networkOnly)` | Commission a new device |
| `removeNode(nodeId)` | Remove a node from the fabric |
| `interviewNode(nodeId)` | Re-interview a node |
| `pingNode(nodeId)` | Ping a node to check availability |
| `deviceCommand(nodeId, endpoint, cluster, command, payload?)` | Send a command to a device |
| `readAttribute(nodeId, endpoint, cluster, attribute)` | Read an attribute value |
| `writeAttribute(nodeId, endpoint, cluster, attribute, value)` | Write an attribute value |
| `openCommissioningWindow(nodeId)` | Open commissioning window for sharing |
| `setWifiCredentials(ssid, password)` | Set WiFi credentials for commissioning |
| `setThreadOperationalDataset(dataset)` | Set Thread dataset for commissioning |
| `checkNodeUpdate(nodeId)` | Check for firmware updates |
| `updateNode(nodeId, version)` | Start firmware update |
| `uploadOtaFile(file)` | Store a local `.ota` firmware image on the server (schema 13+) |
| `addEventListener(event, callback)` | Listen for events |
| `removeEventListener(event, callback)` | Remove event listener |

#### Events

- `nodes_changed`: Fired when any node is added, updated, or removed
- `server_info_updated`: Fired when server info changes
- `connection_lost`: Fired when connection is lost

### Server Info

The `serverInfo` property contains information about the connected Matter server:

```typescript
interface ServerInfoMessage {
    fabric_id: bigint;              // The fabric ID
    compressed_fabric_id: bigint;   // Compressed fabric ID (global ID)
    fabric_index?: number;          // The fabric index (OHF Matter Server only)
    schema_version: number;         // API schema version
    min_supported_schema_version: number;
    sdk_version: string;            // Server SDK version string
    wifi_credentials_set: boolean;  // Whether WiFi credentials are configured
    thread_credentials_set: boolean; // Whether Thread dataset is configured
    bluetooth_enabled: boolean;     // Whether BLE commissioning is available
}
```

**Note:** The `fabric_index` field is specific to OHF Matter Server and is not available in Python Matter Server. When connecting to Python Matter Server, this field will be undefined.

### Command Timeouts

All commands have a default timeout of 5 minutes (300,000ms) to prevent promises from hanging indefinitely if the server doesn't respond. You can configure this behavior globally or per-call:

```typescript
import { MatterClient, CommandTimeoutError, DEFAULT_COMMAND_TIMEOUT } from "@matter-server/ws-client";

const client = new MatterClient("ws://localhost:5580/ws");

// Check the default timeout (5 minutes)
console.log(DEFAULT_COMMAND_TIMEOUT); // 300000

// Change the default timeout for all commands (e.g., 1 minute)
client.commandTimeout = 60000;

// Disable timeouts entirely (not recommended)
client.commandTimeout = 0;

// Override timeout for a specific call (e.g., 30 seconds for a quick command)
await client.deviceCommand(nodeId, 1, 6, "toggle", {}, 30000);

// Use a longer timeout for operations that take time (e.g., 10 minutes for commissioning)
await client.commissionWithCode("MT:Y3.5UNQO100KA0648G00", false, 600000);

// Handle timeout errors
try {
    await client.deviceCommand(nodeId, 1, 6, "toggle");
} catch (err) {
    if (err instanceof CommandTimeoutError) {
        console.log(`Command '${err.command}' timed out after ${err.timeoutMs}ms`);
    }
}
```

All client methods accept an optional `timeout` parameter as their last argument to override the default timeout for that specific call.

### Connection Handling

When the WebSocket connection is closed (either by calling `disconnect()` or due to connection loss), all pending commands are automatically rejected with a `ConnectionClosedError`:

```typescript
import { MatterClient, ConnectionClosedError } from "@matter-server/ws-client";

const client = new MatterClient("ws://localhost:5580/ws");
await client.connect();

// Start a long-running command
const commandPromise = client.commissionWithCode("MT:Y3.5UNQO100KA0648G00", false);

// If the connection is lost or disconnected while the command is pending:
try {
    await commandPromise;
} catch (err) {
    if (err instanceof ConnectionClosedError) {
        console.log("Connection was closed while command was pending");
    }
}

// Listen for connection loss events
client.addEventListener("connection_lost", () => {
    console.log("Connection to server was lost");
});
```

### Other Exports

```typescript
import {
    // Core classes
    MatterClient,
    MatterNode,
    Connection,

    // Exceptions
    MatterError,
    InvalidServerVersion,
    CommandTimeoutError,
    ConnectionClosedError,

    // Constants
    DEFAULT_COMMAND_TIMEOUT,

    // Types
    ServerInfoMessage,
    EventMessage,
    MatterNodeData,
    AccessControlEntry,
    BindingTarget,
    CommissionableNodeData,
    MatterSoftwareVersion,

    // Utilities
    toBigIntAwareJson,
    parseBigIntAwareJson,

    // WebSocket types
    WebSocketLike,
    WebSocketFactory,
} from "@matter-server/ws-client";
```

## Camera Streaming

Five commands cover a Matter camera's stream lifecycle: capability discovery, envelope-based stream allocation, WebRTC session teardown, snapshots, and manual stream release. The server computes the `VideoStreamAllocate` envelope, matches or allocates streams, and handles encoder exhaustion, so a client no longer has to. They have no dedicated wrapper methods yet; call them through `client.sendCommand(...)`. The raw `send_webrtc_provider_command` / `device_command` paths keep working unchanged for a client doing its own allocation.

### camera_get_capabilities

Read-only. Reports device-stated facts — sensor size, `RateDistortionTradeOffPoints`, snapshot capabilities, encoder limits, and currently allocated streams. There is deliberately no resolution list: the device does not expose one, and inventing one reproduces the defect in issue #1054.

```typescript
const caps = await client.sendCommand("camera_get_capabilities", 0, {
    node_id: nodeId,
    endpoint_id: 1,
});
```

### camera_start_stream

Starts or reuses a video/audio stream and a WebRTC session: `ProvideOffer` when `sdp` is given, `SolicitOffer` otherwise. `video` / `audio` hints are **ranges** — `codecs`, `min_resolution`, `max_resolution`, `min_frame_rate`, `max_frame_rate`, `min_bit_rate`, `max_bit_rate` — matching `VideoStreamAllocate`'s own shape. Pass `false` for a hint to exclude that track.

```typescript
const stream = await client.sendCommand("camera_start_stream", 0, {
    node_id: nodeId,
    endpoint_id: 1,
    stream_usage: "LiveView",
    sdp: offerSdp,
    video: { max_resolution: { width: 1920, height: 1080 } },
});
```

Setting `min_resolution == max_resolution` (or the frame-rate / bit-rate equivalent) pins an exact value and fails hard if the camera cannot serve it. The Matter spec requires a camera to honour an allocated stream's minimum configuration for the life of that stream and to reject a later request it cannot accommodate alongside it (§15.2.1.2.2), so pinning `min == max` takes stream capacity away from every other client sharing the camera. Leave a bound unset unless an exact value is actually required.

Answer SDP and ICE candidates keep arriving on the existing `webrtc_callback` event; this command replaces stream setup, not negotiation. Answering a solicited offer stays on the raw path (`ProvideAnswer` via `device_command`), since the answer carries no stream selection.

### camera_stop_stream

Ends the WebRTC session (`EndSession`) without releasing the underlying stream allocation, so a later `camera_start_stream` on the same endpoint can reuse it.

```typescript
await client.sendCommand("camera_stop_stream", 0, {
    node_id: nodeId,
    endpoint_id: 1,
    webrtc_session_id: stream.webrtc_session_id,
});
```

### camera_snapshot

Requests a single still frame. If a video stream on the endpoint is already live, the server prefers a snapshot capability that does not require the hardware encoder and clamps the resolution down to it, reporting `downgraded: true`; otherwise it uses the highest-resolution capability available.

```typescript
const snap = await client.sendCommand("camera_snapshot", 0, {
    node_id: nodeId,
    endpoint_id: 1,
});
// snap.data is base64-encoded image bytes; snap.downgraded is true when a live stream forced a lower capability
```

### camera_release_stream

Force-deallocates a stream the server owns, so the next request allocates fresh instead of reusing it.

```typescript
await client.sendCommand("camera_release_stream", 0, {
    node_id: nodeId,
    endpoint_id: 1,
    kind: "video",
    stream_id: stream.video.stream_id,
});
```

Fails with `CAMERA_STREAM_IN_USE_ERROR_CODE` if the stream still has an active listener, and `CAMERA_STREAM_NOT_OWNED_ERROR_CODE` if the server did not allocate it — releasing never breaks a live session.

### Camera error codes

| Code | Constant | When |
|---|---|---|
| 102 | `CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE` | No codec both sides support, or the caller's range cannot be met |
| 103 | `CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE` | The device has no encoder capacity left once the allocation ladder is exhausted |
| 104 | `CAMERA_STREAM_IN_USE_ERROR_CODE` | `camera_release_stream` targeted a stream a listener still references |
| 105 | `CAMERA_STREAM_NOT_OWNED_ERROR_CODE` | `camera_release_stream` targeted a stream the server did not allocate |
| 106 | `CAMERA_NOT_SUPPORTED_ERROR_CODE` | The endpoint lacks the AV Stream Management or WebRTC Provider cluster |

## JSON Utilities

The package includes utilities for handling JSON serialization with BigInt support (for numbers exceeding JavaScript's MAX_SAFE_INTEGER):

```typescript
import { toBigIntAwareJson, parseBigIntAwareJson } from "@matter-server/ws-client";

// Convert JavaScript object to JSON string with BigInt support
const jsonStr = toBigIntAwareJson({ nodeId: 12345678901234567890n });

// Parse JSON with large numbers converted to BigInt
const obj = parseBigIntAwareJson('{"nodeId": 12345678901234567890}');
```

## More Information

Please refer to https://github.com/matter-js/matterjs-server/blob/main/README.md for more information about the OHF Matter Server project.
