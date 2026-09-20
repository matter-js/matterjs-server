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

Every codec on these commands is a **name**, never a number: `H264`, `H265`, `H266`, `AV1` for video, `OPUS` and `AAC` for audio, `JPEG` and `HEIC` for snapshots. The same names are reported and accepted, matched case-insensitively. Stream usages are names as well: `camera_get_capabilities` reports `Internal`, `Recording`, `Analysis` and `LiveView`, and `camera_start_stream` takes any of them but `Internal`, which marks a stream the device keeps for itself. `two_way_talk_support` is reported as `NotSupported`, `HalfDuplex` or `FullDuplex`. A codec the cluster's enum does not define is reported as its decimal digits and accepted back in that spelling. The stream usages are closed only for requests: `camera_start_stream` takes only the four names above, but a usage value the enum does not define is still reported as its decimal digits, and a stream carrying it cannot be requested back. `two_way_talk_support` is reported the same way — a value the enum does not define comes back as its decimal digits — and has no request side at all: talkback is asked for in the SDP offer, not by a hint.

A name is the same string in both directions, but a reported key is not always a hint key. These are the reported values a later command takes back:

| Reported by `camera_get_capabilities` | Send back as |
|---|---|
| `video.codecs` | `camera_start_stream`'s `video.codecs` |
| `audio.codecs` | `camera_start_stream`'s `audio.codecs` |
| `audio.channels` | `camera_start_stream`'s `audio.channel_count`; the reported value is the ceiling |
| `audio.sample_rates` | `camera_start_stream`'s `audio.sample_rate`; one of the reported values |
| `limits.supported_stream_usages` | `camera_start_stream`'s `stream_usage`, any name but `Internal` |
| `snapshot.capabilities[].image_codec` | `camera_snapshot`'s `codec` |

Everything else the command reports is a fact about the camera rather than a value to send back. `audio.bit_depths` has no hint: `AudioStreamAllocate` takes one bit depth and the server picks it from that list. A key a hint object does not take is refused with `INVALID_ARGUMENTS` instead of being ignored, so a bound can never be dropped without the caller hearing about it.

### camera_get_capabilities

Read-only. Reports device-stated facts in four groups plus `allocated`. Optional fields are absent when the camera states nothing for them.

- `video`: `sensor`, `min_viewport`, `max_fps`, `max_hdr_fps`, `hdr_capable`, `rate_distortion_points` (each `{ codec, resolution, min_bit_rate }`) and `codecs`.
- `audio`: `codecs`, `channels`, `sample_rates`, `bit_depths`, `two_way_talk_support`.
- `snapshot.capabilities`: each `{ resolution, max_frame_rate, image_codec, requires_encoded_pixels, requires_hardware_encoder }`.
- `limits`: `max_encoded_pixel_rate`, `max_concurrent_encoders`, `max_network_bandwidth`, `supported_stream_usages`, `stream_usage_priorities`.
- `allocated.video[]`: `video_stream_id`, `stream_usage`, `video_codec`, `min_resolution`, `max_resolution`, `min_frame_rate`, `max_frame_rate`, `min_bit_rate`, `max_bit_rate`, `reference_count`, `owned_by_server`.
- `allocated.audio[]`: `audio_stream_id`, `stream_usage`, `audio_codec`, `channel_count`, `sample_rate`, `bit_rate`, `bit_depth`, `reference_count`, `owned_by_server`.
- `allocated.snapshot[]`: `snapshot_stream_id`, `image_codec`, `resolution`, `reference_count`, `owned_by_server`.

Every resolution is `{ width, height }`. There is deliberately no resolution list: the device does not expose one, and inventing one reproduces the defect in issue #1054. `video.codecs` is derived from `rate_distortion_points`, so a camera that states no trade-off point reports an empty list; `camera_start_stream` then accepts any video codec name and lets the device answer.

`owned_by_server` says this server allocated the stream, which is what `camera_release_stream` requires. `reference_count` is the device's own count of listeners.

```typescript
const caps = await client.sendCommand("camera_get_capabilities", 0, {
    node_id: nodeId,
    endpoint_id: 1,
});
```

### camera_start_stream

Starts or reuses a video/audio stream and a WebRTC session: `ProvideOffer` when `sdp` is given, `SolicitOffer` otherwise. `video` hints are **ranges** — `codecs`, `min_resolution`, `max_resolution`, `min_frame_rate`, `max_frame_rate`, `min_bit_rate`, `max_bit_rate` — matching `VideoStreamAllocate`'s own shape. `audio` hints are exact values: `codecs`, `channel_count`, `sample_rate`, `bit_rate`. Pass `false` for a hint to exclude that track. `ice_servers`, `ice_transport_policy` and `metadata_enabled` pass through to the WebRTC session setup. `stream_usage` is the only required argument beyond the target.

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

`codecs` is a hard filter on both tracks: if the camera supports none of the codecs the caller names, the call fails with `CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE` instead of falling back to a codec the caller did not ask for. The video codec list in the SDP offer binds the same way, so a peer that offered H.264 only is never handed an H.265 stream. An audio offer that shares no codec with the camera ends in absence rather than failure for a caller that stated nothing under `audio`: the session is set up video-only.

Every bound the caller states is hard at every rung — whether the stream is freshly allocated, reused, or handed out degraded — floors included: a `min_resolution`, `min_frame_rate` or `min_bit_rate` that nothing can reach fails with `CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE` rather than succeeding with a stream below what was asked for. The error carries `bound: { field, requested, limit }`, where `field` is the hint key in the spelling `camera_start_stream` takes it back in — `min_resolution`, `min_frame_rate` or `min_bit_rate` under `video`, `sample_rate` or `channel_count` under `audio` — and `limit` is the ceiling in force after the sensor, the SDP offer and the caller's own `max_*` have all been applied — an offer that caps the pixel count can therefore make a floor unsatisfiable that the camera alone could serve. `max_network_bandwidth` from `camera_get_capabilities` is one of those ceilings. Setting `min_resolution == max_resolution` (or the frame-rate / bit-rate equivalent) pins an exact value and fails hard if the camera cannot serve it. The Matter spec requires a camera to honour an allocated stream's minimum configuration for the life of that stream and to reject a later request it cannot accommodate alongside it (§15.2.1.2.2), so pinning `min == max` takes stream capacity away from every other client sharing the camera. Leave a bound unset unless an exact value is actually required.

`stream_usage` is a bound like any other, and the only mandatory one: a `LiveView` request is never answered with a `Recording` stream, however little capacity the camera has left.

The `audio` hints are exact values rather than ranges: `codecs`, `channel_count`, `sample_rate`, `bit_rate`. Each is as hard as a video bound, and **stating any of them asks for audio**. A `sample_rate` the camera does not list and a `channel_count` above the `audio.channels` it reports fail with `CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE` carrying `bound: { field, requested, limit }` — where `limit` is the camera's maximum, or the list of sample rates it accepts — rather than being replaced by the camera's own best or clamped down. `bit_rate` has no camera-stated capability to check it against, so it is carried into the allocation and a stream already allocated at another bit rate is not handed back in its place. Read `audio.sample_rates` and `audio.channels` from `camera_get_capabilities` before stating either.

Every other way a caller that stated an `audio` value can end up with no audio stream fails the same way, instead of quietly returning `audio: null`: a camera with no microphone or no stated codec, sample-rate or bit-depth list fails with `reason: "capability"`, a codec narrowing that leaves nothing with `reason: "codec"` (`device` reports the camera's own codecs, so a caller can see whether its own offer or the camera is the blocker), and a device that refuses `AudioStreamAllocate` with `reason: "bounds"` and the device's status, or error 103 for a capacity refusal. A fourth outcome carries no `reason` at all: when the device accepts `AudioStreamAllocate` but answers with no `AudioStreamID`, the call fails with error 7 (`SDKStackError`) instead of `CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE`. A device status the allocation ladder does not recognize is not translated into any of those codes either; it surfaces unchanged as error 0 (`UnknownError`). A caller that stated nothing under `audio` gets `audio: null` in all of those cases and the video track proceeds alone.

A request that leaves nothing for the offer to carry fails with `CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE` (`reason: "capability"`, `device` and `requested` both empty) instead of sending an offer with neither track. That happens when `video: false` and `audio: false` are both stated, or when `video: false` is stated and no audio stream could be resolved for a caller that left `audio` to the server — no microphone, no codec match, or a refused allocate all end there the same way. Asking for at least one track succeeds.

When every video stream is already in use and none can be freed, the response may still succeed with a stream that does not fit the server's own default range — only within any bounds the caller stated — and reports that as `video.degraded: true`. A caller who pinned an exact bound is never given a stream outside what it asked for. A stream matching its pins that also fits the range the server computed for the axes it did not pin (frame rate, bit rate) is reused and not flagged `degraded`; one that matches the pins but falls outside that range is handed out only after allocation fails, flagged `degraded: true`, and otherwise the call fails. When the camera is out of capacity and the only unreferenced stream carries a different `stream_usage`, that stream is deallocated to make room rather than handed over, and put back if the retry does not use the capacity. Audio has no degraded rung: it resolves a stream, fails typed, or — for a caller that stated no `audio` value — reports `audio: null`.

When the call fails, any stream it allocated for the session is deallocated before the error returns: the caller never receives those `stream_id`s, so `camera_release_stream` could not reach them. A stream the call reused is left in place.

An audio m-line offering to send asks for talkback. The server cannot make a camera that reports `two_way_talk_support: NotSupported` accept it, so the mismatch is logged and the session proceeds one-way; check `two_way_talk_support` from `camera_get_capabilities` before offering.

The response is `{ webrtc_session_id, mode, video, audio }`. `mode` is `"provide_offer"` or `"solicit_offer"`. `video` and `audio` are `null` when the track was left out, and `audio` is also `null` when no audio stream was resolved for a caller that stated no `audio` value.

- `video`: `stream_id`, `codec`, `resolution` (`{ min, max }`), `frame_rate` (`{ min, max }`), `bit_rate` (`{ min, max }`), `reused`, `allocated_by_server`, and `degraded` when it applies.
- `audio`: `stream_id`, `codec`, `channel_count`, `sample_rate`, `bit_rate`, `bit_depth`, `reused`, `allocated_by_server`.

`stream_id` is what `camera_release_stream` takes for that track's `kind`. A stream this call allocated can also be reached later through `camera_get_capabilities`'s matching `video_stream_id` / `audio_stream_id`, once it is listed there with `owned_by_server: true`. `reused` says the stream was already on the camera, and `allocated_by_server` says this server allocated it, so `camera_release_stream` can free it. `degraded` is present and `true` only on `video`, for a stream that does not fit the range the server computed while still meeting every bound the caller stated; it is absent otherwise.

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

Requests a single still frame. The snapshot stream this call allocates is deallocated again before the response is sent, on success as well as on failure, which is why the response names no stream: a capability that requires the hardware encoder holds one of the camera's `max_concurrent_encoders` for as long as the stream is allocated, so keeping one would make the next call fail with `CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE` on single-encoder hardware and would block video allocation. The server allocates its own stream rather than capturing from one the device already lists: that stream may be another controller's, and the allocated-stream list is a cached view that can still name a stream the camera no longer has. If the device refuses to take the stream back, it stays allocated and server-owned, and `camera_get_capabilities` reports it under `allocated.snapshot` with `owned_by_server: true` so `camera_release_stream` can free it. If the camera has no encoder free, the server prefers a snapshot capability that does not require the hardware encoder and clamps the resolution down to it; otherwise it uses the highest-resolution capability available. Free is counted against the camera's own `max_concurrent_encoders`: a referenced video stream takes one, so one viewer on a camera that states four encoders leaves three. Allocated snapshot streams are not counted, because the device's `allocated.snapshot` list lags a deallocation and a poll would otherwise see the stream its own previous call already gave back. `downgraded: true` means the frame is smaller than the capability the request's own bounds would have allowed had an encoder been free — a camera whose best capability needs no encoder anyway, and one with encoders to spare, report no downgrade while streaming; a device that refuses the best capability and serves a smaller one does. A capability requires the hardware encoder only when the device declares both `requires_encoded_pixels` and `requires_hardware_encoder` true, so `requires_encoded_pixels` on its own does not mean an encoder is taken. `requires_hardware_encoder` is always present as a boolean; the underlying Matter field is optional, and a camera that leaves it unstated is reported as `false`.

`max_resolution` and an image codec name in `codec` narrow which device-declared capability is chosen, and neither is dropped to make the request fit: when no capability is left the call fails with `CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE` rather than returning a frame larger than stated or in another codec. Leaving them unset picks the best capability available under the current encoder state. `node_id`, `endpoint_id`, `max_resolution` and `codec` are the only arguments the command takes; any other key is refused with error 8, the same as an unknown hint key on `camera_start_stream`.

When the device refuses the capability it was offered, the server tries the next one down before failing. A refusal that no retry can fix comes back as `CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE` carrying the device's status, and a capacity refusal as `CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE`; snapshots use the same error codes as `camera_start_stream`.

```typescript
const snap = await client.sendCommand("camera_snapshot", 0, {
    node_id: nodeId,
    endpoint_id: 1,
    max_resolution: { width: 1280, height: 720 },
    codec: "JPEG",
});
// snap.data is base64-encoded image bytes; snap.downgraded is true when the frame is smaller than the best capability the request allowed
```

### camera_release_stream

Force-deallocates a stream the server owns, so the next request allocates fresh instead of reusing it. `kind` is `"video"`, `"audio"` or `"snapshot"`, and `stream_id` is the `stream_id` a `camera_start_stream` response carried for that track, or a `video_stream_id` / `audio_stream_id` / `snapshot_stream_id` from `camera_get_capabilities` with `owned_by_server: true`. `kind: "snapshot"` only ever names a stream a `camera_snapshot` allocated and the device then refused to take back; every other snapshot stream fails with `CAMERA_STREAM_NOT_OWNED_ERROR_CODE`.

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
| 102 | `CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE` | No codec both sides support, or the caller's range cannot be met. `reason` says which: `codec` for codec lists that do not overlap and `bounds` for a range the camera cannot serve; both can be answered by asking for something else. `capability` covers two different cases. First, a device that states no capability of that kind at all — not answerable by asking for something else. Second, a `camera_start_stream` request that leaves both tracks out: `video: false` with `audio: false`, or `video: false` with no audio stream resolved for a caller that left `audio` to the server. That second case reports `device` and `requested` both empty, and is fixed by asking for at least one track. `device` and `requested` are codec names otherwise. `bound: { field, requested, limit }` names the single caller bound the server ruled out before asking the device, on `camera_start_stream` only — a video range bound, or an audio `sample_rate` or `channel_count`, whose `limit` is the set of values the device lists; a `camera_snapshot` ceiling that leaves no capability reports `bounds` without it. `requested` is the codec the request resolved to, which is the caller's own choice when it stated one. `device_status` carries the Matter status the device answered with: `ConstraintError` (135) means the request was structurally invalid and was not retried, `DynamicConstraintError` (207) means narrowing was tried and exhausted. A caller that asks for audio and gets none can also see error 103 (capacity), error 7 (`SDKStackError`, the device answered with no stream id), or error 0 (`UnknownError`, an unrecognized device status) instead of this code; see the `camera_start_stream` section |
| 103 | `CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE` | The device has no encoder capacity left once the allocation ladder is exhausted |
| 104 | `CAMERA_STREAM_IN_USE_ERROR_CODE` | `camera_release_stream` targeted a stream a listener still references |
| 105 | `CAMERA_STREAM_NOT_OWNED_ERROR_CODE` | `camera_release_stream` targeted a stream the server did not allocate |
| 106 | `CAMERA_NOT_SUPPORTED_ERROR_CODE` | `camera_start_stream` raises this when the endpoint lacks the AV Stream Management or the WebRTC Provider cluster, checked before any stream is allocated. `camera_get_capabilities`, `camera_snapshot` and `camera_release_stream` check only the AV Stream Management cluster, so a camera missing just the WebRTC Provider cluster still answers those three normally. `missing_clusters` lists every cluster id that is absent |

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
