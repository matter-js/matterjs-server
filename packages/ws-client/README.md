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

Five commands cover a Matter camera's stream lifecycle: capability discovery, envelope-based stream allocation, WebRTC session teardown, snapshots, and manual stream release. The server computes the `VideoStreamAllocate` envelope, matches or allocates streams, and handles encoder exhaustion, so a client no longer has to. They have no dedicated wrapper methods yet; call them through `client.sendCommand(...)`. The raw `send_webrtc_provider_command` / `device_command` paths keep working unchanged for a client doing its own allocation. They need a server reporting `schema_version >= 14`.

Every codec on these commands is a **name**, never a number: `H264`, `H265`, `H266`, `AV1` for video, `OPUS` and `AAC` for audio, `JPEG` and `HEIC` for snapshots. The same names are reported and accepted, matched case-insensitively, so a codec read from `camera_get_capabilities` can be sent straight back as a `camera_start_stream` hint or a `camera_snapshot` codec. Stream usages are names as well: `camera_get_capabilities` reports `Recording`, `Analysis` and `LiveView`, the names `camera_start_stream` takes, matched case-insensitively (`Internal` is device-only and refused). `two_way_talk_support` is reported as `NotSupported`, `HalfDuplex` or `FullDuplex`. A codec the cluster's enum does not define is reported as its decimal digits and accepted back in that spelling; the stream usages are a closed set and only the three names are accepted.

### camera_get_capabilities

Read-only. Reports device-stated facts: `video` (sensor size, `RateDistortionTradeOffPoints`, codecs), `audio` (codecs, channel count, sample rates, bit depths, two-way talk support), `snapshot.capabilities`, `limits` (`max_encoded_pixel_rate`, `max_concurrent_encoders`, `max_network_bandwidth`, `supported_stream_usages`, `stream_usage_priorities`), and `allocated` streams per kind with their reference counts. There is deliberately no resolution list: the device does not expose one, and inventing one reproduces the defect in issue #1054.

```typescript
const caps = await client.sendCommand("camera_get_capabilities", 0, {
    node_id: nodeId,
    endpoint_id: 1,
});
```

### camera_start_stream

Starts or reuses a video/audio stream and a WebRTC session: `ProvideOffer` when `sdp` is given, `SolicitOffer` otherwise. `video` / `audio` hints are **ranges** — `codecs`, `min_resolution`, `max_resolution`, `min_frame_rate`, `max_frame_rate`, `min_bit_rate`, `max_bit_rate` — matching `VideoStreamAllocate`'s own shape. Pass `false` for a hint to exclude that track. `ice_servers`, `ice_transport_policy` and `metadata_enabled` pass through to the WebRTC session setup.

```typescript
const stream = await client.sendCommand("camera_start_stream", 0, {
    node_id: nodeId,
    endpoint_id: 1,
    stream_usage: "LiveView",
    sdp: offerSdp,
    video: { max_resolution: { width: 1920, height: 1080 } },
    ice_servers: [{ urls: "stun:stun.example.org:3478" }],
});
```

`codecs` is a hard filter on both tracks: if the camera supports none of the codecs the caller names, the call fails with `CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE` instead of falling back to a codec the caller did not ask for. The video codec list in the SDP offer binds the same way, so a peer that offered H.264 only is never handed an H.265 stream. An audio offer that shares no codec with the camera is the one case that ends in absence rather than failure: the session is set up video-only.

Every bound the caller states is hard, floors included: a `min_resolution`, `min_frame_rate` or `min_bit_rate` that nothing can reach fails with `CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE` rather than succeeding with a stream below what was asked for. The error carries `bound: { field, requested, limit }`, where `limit` is the ceiling in force after the sensor, the SDP offer and the caller's own `max_*` have all been applied — an offer that caps the pixel count can therefore make a floor unsatisfiable that the camera alone could serve. `max_network_bandwidth` from `camera_get_capabilities` is one of those ceilings. Setting `min_resolution == max_resolution` (or the frame-rate / bit-rate equivalent) pins an exact value and fails hard if the camera cannot serve it. The Matter spec requires a camera to honour an allocated stream's minimum configuration for the life of that stream and to reject a later request it cannot accommodate alongside it (§15.2.1.2.2), so pinning `min == max` takes stream capacity away from every other client sharing the camera. Leave a bound unset unless an exact value is actually required.

When every video stream is already in use and none can be freed, the response may still succeed with a stream that does not fit the server's own default range — only within any bounds the caller stated — and reports that as `video.degraded: true`. A caller who pinned an exact bound gets a typed failure instead of a degraded result, never a stream outside what it asked for. Audio has no equivalent fallback: if no audio stream can be resolved, `audio` in the response is simply `null` and the video track proceeds alone.

When the call fails, any stream it allocated for the session is deallocated before the error returns: the caller never receives those `stream_id`s, so `camera_release_stream` could not reach them. A stream the call reused is left in place.

An audio m-line offering to send asks for talkback. The server cannot make a camera that reports `two_way_talk_support: NotSupported` accept it, so the mismatch is logged and the session proceeds one-way; check `two_way_talk_support` from `camera_get_capabilities` before offering.

Answer SDP and ICE candidates keep arriving on the existing `webrtc_callback` event; this command replaces stream setup, not negotiation. Answering a solicited offer stays on the raw path (`ProvideAnswer` via `device_command`), since the answer carries no stream selection.

### camera_stop_stream

Ends the WebRTC session (`EndSession`) without releasing the underlying stream allocation, so a later `camera_start_stream` on the same endpoint can reuse it.

```typescript
const { ended } = await client.sendCommand("camera_stop_stream", 0, {
    node_id: nodeId,
    endpoint_id: 1,
    webrtc_session_id: stream.webrtc_session_id,
});
```

`ended` is `false` when `webrtc_session_id` is not a session tracked for this `node_id`/`endpoint_id` — an unknown id, an already-ended session, or one that belongs to a different node or endpoint — rather than ending an arbitrary session by guessing its id.

### camera_snapshot

Requests a single still frame, always from a freshly allocated snapshot stream — an existing snapshot stream is never reused the way a video or audio stream is. If a video stream on the endpoint is already live, the server prefers a snapshot capability that does not require the hardware encoder and clamps the resolution down to it; otherwise it uses the highest-resolution capability available. `downgraded: true` means the frame is smaller than the capability the request's own bounds would have allowed had the encoder been free — a camera whose best capability needs no encoder anyway reports no downgrade while streaming, and a device that refuses the best capability and serves a smaller one does. A capability requires the hardware encoder only when the device declares both `requires_encoded_pixels` and `requires_hardware_encoder`: the second field is defined only when the first is true, so `requires_encoded_pixels` on its own does not mean an encoder is taken. `max_resolution` and an image codec name in `codec` narrow which device-declared capability is chosen, and neither is dropped to make the request fit: when no capability is left the call fails with `CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE` rather than returning a frame larger than stated or in another codec. Leaving them unset picks the best capability available under the current encoder state.

A snapshot stream whose capture then fails is deallocated before the error returns, for the same reason: its `stream_id` only ever reaches the caller on success. When the device refuses the capability it was offered, the server tries the next one down before failing. A refusal that no retry can fix comes back as `CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE` carrying the device's status, and a capacity refusal as `CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE`; snapshots use the same error codes as `camera_start_stream`.

```typescript
const snap = await client.sendCommand("camera_snapshot", 0, {
    node_id: nodeId,
    endpoint_id: 1,
    max_resolution: { width: 1280, height: 720 },
    codec: "JPEG",
});
// snap.data is base64-encoded image bytes; snap.downgraded is true when the frame is smaller than the best capability the request allowed
// snap.stream_id identifies the snapshot stream this call allocated; pass it to camera_release_stream to free it
// snap.reused is always false and snap.allocated_by_server always true, since every call allocates fresh
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
| 102 | `CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE` | No codec both sides support, or the caller's range cannot be met. `reason` says which: `codec` for codec lists that do not overlap, `bounds` for a range the camera cannot serve, `capability` for a device that states no capability of that kind at all — the first two can be answered by asking for something else, the third cannot. `device` and `requested` are codec names. `bound: { field, requested, limit }` names the single caller bound the server ruled out before asking the device, on `camera_start_stream` only; a `camera_snapshot` ceiling that leaves no capability reports `bounds` without it. `requested` is the codec the request resolved to, which is the caller's own choice when it stated one. `device_status` carries the Matter status the device answered with: `ConstraintError` (135) means the request was structurally invalid and was not retried, `DynamicConstraintError` (207) means narrowing was tried and exhausted |
| 103 | `CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE` | The device has no encoder capacity left once the allocation ladder is exhausted |
| 104 | `CAMERA_STREAM_IN_USE_ERROR_CODE` | `camera_release_stream` targeted a stream a listener still references |
| 105 | `CAMERA_STREAM_NOT_OWNED_ERROR_CODE` | `camera_release_stream` targeted a stream the server did not allocate |
| 106 | `CAMERA_NOT_SUPPORTED_ERROR_CODE` | The endpoint lacks the AV Stream Management or WebRTC Provider cluster. `missing_clusters` lists every one that is absent; a missing provider is reported before any stream is allocated |

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
