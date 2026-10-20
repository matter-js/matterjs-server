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

const client = new MatterClient("ws://localhost:5580/ws", url => new WebSocket(url) as unknown as WebSocketLike);

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

| Method                                                                  | Description                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `startListening()`                                                      | Connect and start receiving events                                                                                                                                                                                                             |
| `disconnect()`                                                          | Disconnect from the server                                                                                                                                                                                                                     |
| `getNodes(onlyAvailable?)`                                              | Get all nodes (optionally only available ones)                                                                                                                                                                                                 |
| `commissionWithCode(code, networkOnly, options?)`                       | Commission a new device; `options` takes `wifiCredentialsId`, `threadDatasetId`, `discoveryTimeoutS` (schema 14) and `timeout`                                                                                                                 |
| `commissionOnNetwork(setupPinCode, options?)`                           | Commission a device already on the network; `options` takes `filterType` (0-4), `filter`, `ipAddr` (schema 6), `discoveryTimeoutS` (schema 14) and `timeout`                                                                                   |
| `removeNode(nodeId)`                                                    | Remove a node from the fabric                                                                                                                                                                                                                  |
| `interviewNode(nodeId)`                                                 | Re-interview a node                                                                                                                                                                                                                            |
| `pingNode(nodeId)`                                                      | Ping a node to check availability                                                                                                                                                                                                              |
| `deviceCommand(nodeId, endpoint, cluster, command, payload?, options?)` | Send a command to a device; `options` takes `timedRequestTimeoutMs`, `interactionTimeoutMs` and `timeout`, or pass a number for `timeout` alone                                                                                                |
| `batchedDeviceCommands(nodeId, commands, options?)` | Send several commands to one node in a single InvokeRequest and get one result per command; `options` takes `timedRequestTimeoutMs`, `interactionTimeoutMs` and `timeout` (schema 14) |
| `readAttribute(nodeId, attributePath, timeout?, fabricFiltered?)` | Read one or more attributes by path |
| `writeAttribute(nodeId, attributePath, value, options?)` | Write an attribute value; `*` as the endpoint writes all endpoints of the node that have it, `options` takes `timedRequestTimeoutMs` (schema 14) and `timeout`, or pass a number for `timeout` alone |
| `read(args)`                                                            | Matter Read with full control over the request (schema 14)                                                                                                                                                                                     |
| `subscribe(args, listener)`                                             | Open a subscription owned by this connection; the result carries the first report, `listener.report` gets the later ones and `listener.ended` its end, also when the connection is lost (schema 14, server with `--disable-auto-subscription`) |
| `unsubscribe(nodeId, subscriptionId)`                                   | End a subscription opened with `subscribe` (schema 14, server with `--disable-auto-subscription`)                                                                                                                                              |
| `enableAutoSubscription(nodeId)`                                        | Switch the server's own subscription to the node on (schema 14, server with `--disable-auto-subscription`)                                                                                                                                     |
| `disableAutoSubscription(nodeId)`                                       | Switch the server's own subscription to the node off (schema 14, server with `--disable-auto-subscription`)                                                                                                                                    |
| `parseOnboardingPayload(code)`                                          | Decode a QR code payload or a manual pairing code without contacting a device (schema 14)                                                                                                                                                      |
| `openCommissioningWindow(nodeId)`                                       | Open commissioning window for sharing                                                                                                                                                                                                          |
| `setWifiCredentials(ssid, password)`                                    | Set WiFi credentials for commissioning                                                                                                                                                                                                         |
| `setThreadOperationalDataset(dataset)`                                  | Set Thread dataset for commissioning                                                                                                                                                                                                           |
| `checkNodeUpdate(nodeId)`                                               | Check for firmware updates                                                                                                                                                                                                                     |
| `updateNode(nodeId, version)`                                           | Start firmware update                                                                                                                                                                                                                          |
| `uploadOtaFile(file)`                                                   | Store a local `.ota` firmware image on the server (schema 13+)                                                                                                                                                                                 |
| `addEventListener(event, callback)`                                     | Listen for events; returns an unsubscribe function                                                                                                                                                                                             |

#### Events

- `nodes_changed`: Fired when a node is added, updated, or removed, or an attribute of a known node changes. The listener receives a `NodesChangedDetail` with `reason`, `nodeId`, and `attributeKey` (`endpoint/cluster/attribute`) for attribute changes
- `server_info_updated`: Fired when server info changes
- `server_shutdown`: Fired when the server announces its shutdown
- `connection_lost`: Fired when connection is lost
- `thread_diagnostics_updated`: Fired when Thread diagnostics change

### Server Info

The `serverInfo` property contains information about the connected Matter server:

```typescript
interface ServerInfoMessage {
    fabric_id: bigint; // The fabric ID
    compressed_fabric_id: bigint; // Compressed fabric ID (global ID)
    fabric_index?: number; // The fabric index (OHF Matter Server only)
    schema_version: number; // API schema version
    min_supported_schema_version: number;
    sdk_version: string; // Server SDK version string
    wifi_credentials_set: boolean; // Whether WiFi credentials are configured
    thread_credentials_set: boolean; // Whether Thread dataset is configured
    bluetooth_enabled: boolean; // Whether BLE commissioning is available
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

### Debug Logging

The client writes every message to `console.debug`:

- `Connection.sendMessage` logs each outgoing command.
- `Connection.onmessage` logs each incoming frame.
- `MatterClient` logs each event a second time, and logs a frame of no known shape to `console.warn`.

What a logged line may contain is decided by the shape of the value wherever possible, not by the command. A response carries only its `message_id`, not the name of the command it answers.

Secrets are masked:

- **Outgoing arguments, by field name.** Setup codes and passcodes, Wi-Fi passphrases, Thread operational datasets, symmetric key material and PINs are masked at any depth under `args`, with case and separators in the field name ignored. This name list applies to outgoing arguments only, because several of its names mean something harmless in a response. Structure nested more than eight levels deep under `args` is masked as a whole.
- **Both directions, by shape.**
    - An ICE server's `username` and `credential` are masked wherever they sit under a member that names a list of ICE servers: `ice_servers` on `camera_start_stream` and on a `webrtc_callback` offer, or `ICEServers` in a `send_webrtc_provider_command` or `device_command` payload. The member name is matched with case and all separators removed, the widest rule the server uses to match a payload key to a field. An entry that names no URL is masked too.
    - The `a=ice-ufrag` and `a=ice-pwd` values inside an `sdp` are masked wherever the SDP appears. A `webrtc_callback` offer carries the camera's own. The rest of the SDP is logged unchanged: the DTLS fingerprint, the codecs and the directions are what a failed session is diagnosed from.

Bulk content in incoming messages is logged as its length. A string longer than 1024 characters in an incoming frame or event is logged as `[<n> chars omitted]`, both as a field value and as a bare array entry (the shape `attribute_updated` uses for a value). So a `camera_snapshot` response's base64 frame does not flood the console, while its `codec`, `resolution`, `degraded`, `stream_id` and `provenance` are logged as sent. An `sdp` is handled by the masking rule first and keeps all its lines, whatever its length. Two cases are not shortened:

- Outgoing arguments, whatever their length: they are the record of what the caller asked for.
- A string nested more than eight levels deep in an incoming message, which the walk does not reach.

`redactSensitiveCommandFields` (outgoing commands) and `redactIncomingMessage` (incoming frames) are exported for a consumer that does its own logging.

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

The camera API is a convenience layer over a Matter camera's AV Stream Management and WebRTC Transport Provider clusters. It consists of seven `camera_*` commands and two events. It includes stream management (allocation, reuse, eviction and release) and WebRTC session handling. The official Matter commands stay available through `sendWebRtcProviderCommand` and `deviceCommand` for a client that wants to manage streams itself; the camera API does that work for the client.

The camera commands need a server that reports `schema_version >= 14`. They have no dedicated wrapper methods. Call them through `client.sendCommand(command, 14, args)`: the request arguments and the response are typed through `APICommands`, and passing `14` as the required schema makes the call throw `InvalidServerVersion` on an older server, instead of sending it a command it does not know.

This section covers use from TypeScript. The wire protocol, including every argument's range, the allocation rules and the full error payloads, is documented in [docs/websockets_api.md](https://github.com/matter-js/matterjs-server/blob/main/docs/websockets_api.md) under "Camera Streaming (schema 14+)" and "Error Codes".

### Typical flow

1. _(Optional)_ `camera_get_capabilities`: check `features` and `privacy`, and see what the camera states and what is already allocated.
2. Register a `webrtc_callback` listener **before** the next step. It matches the session's events by the `client_session_key` you choose (see [Signalling and event ordering](#signalling-and-event-ordering)).
3. `camera_start_stream` with `stream_usage`, your SDP offer in `sdp` and your key in `client_session_key`. The response names the session in `webrtc_session_id`.
4. Apply the camera's `answer` event and its `ice_candidates` events, and send your own candidates with `camera_provide_ice_candidates` and the key, without waiting for the response. Without `sdp`, the camera sends an `offer` event instead, and you answer it with `camera_provide_answer`.
5. `camera_stop_stream` with the key ends the session, also while `camera_start_stream` is still running. The streams stay allocated, so the next `camera_start_stream` can reuse them.
6. _(Optional)_ `camera_release_stream` frees a stream you no longer need.

`camera_snapshot` needs no session and no signalling.

**A session opened with `camera_start_stream` is driven with the `camera_*` commands until it ends:** `camera_provide_answer`, `camera_provide_ice_candidates` and `camera_stop_stream`. Do not use `sendWebRtcProviderCommand` or `deviceCommand` `EndSession` for it. The server keeps a record of each session it opens (which connection receives its signalling, which streams it holds, and that it is ended exactly once), and only the `camera_*` commands keep that record correct. The one exception is a re-offer (an ICE restart, or different tracks): it goes through `sendWebRtcProviderCommand`, because `camera_start_stream` always opens a new session (see [Starting a stream](#starting-a-stream)).

### Commands

| Command                         | Response type              | Purpose                                                                                                                                      |
| ------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `camera_get_capabilities`       | `CameraCapabilitiesResult` | Read-only. Features, privacy switches, video/audio/snapshot capabilities, limits, allocated streams and the camera's current WebRTC sessions |
| `camera_start_stream`           | `CameraStartStreamResult`  | Reuses or allocates streams and opens a WebRTC session: `ProvideOffer` when `sdp` is given, `SolicitOffer` otherwise                         |
| `camera_provide_answer`         | `null`                     | Sends the client's SDP answer to an offer the camera sent (`ProvideAnswer`)                                                                  |
| `camera_provide_ice_candidates` | `null`                     | Trickles the client's ICE candidates into a session (`ProvideIceCandidates`)                                                                 |
| `camera_stop_stream`            | `{ ended: boolean }`       | Ends a WebRTC session (`EndSession`). The streams stay allocated, so a later `camera_start_stream` can reuse them                            |
| `camera_snapshot`               | `CameraSnapshotResult`     | Captures one still image, base64-encoded in `data`                                                                                           |
| `camera_release_stream`         | `null`                     | Deallocates a `"video"`, `"audio"` or `"snapshot"` stream (`CameraStreamKind`)                                                               |

Every command takes `node_id` (`number | bigint`) and `endpoint_id`. Send a node id above `Number.MAX_SAFE_INTEGER` as a `bigint`; the client's JSON handling encodes it without loss. The request types used by `camera_start_stream` are `CameraVideoHints`, `CameraAudioHints` and `CameraIceServer`; ICE candidates in both directions are `WebRtcIceCandidate`.

An argument key a command does not know, including a key inside a hint object, is refused with error 8 (`INVALID_ARGUMENTS`) instead of being ignored. So a misspelled bound is never silently dropped.

### Values are names

Codecs, stream usages and talkback support are strings, matched case-insensitively. Codecs are `H264`, `H265`, `H266`, `AV1` (video), `OPUS`, `AAC` (audio) and `JPEG`, `HEIC` (snapshot). `stream_usage` is `LiveView`, `Recording` or `Analysis`; `camera_get_capabilities` also reports `Internal`, which marks a stream allocated for the device's own use and cannot be requested. A value the cluster's enum does not define is reported as its decimal digits.

These reported values are what a later request takes back:

| Reported by `camera_get_capabilities` | Send back as                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| `video.codecs`                        | `camera_start_stream`'s `video.codecs`                                           |
| `audio.codecs`                        | `camera_start_stream`'s `audio.codecs`                                           |
| `audio.channels`                      | `camera_start_stream`'s `audio.channel_count`; the reported value is the ceiling |
| `audio.sample_rates`                  | `camera_start_stream`'s `audio.sample_rate`; one of the reported values          |
| `limits.supported_stream_usages`      | `camera_start_stream`'s `stream_usage`, any name but `Internal`                  |
| `snapshot.capabilities[].image_codec` | `camera_snapshot`'s `codec`                                                      |

Read `features` rather than the cluster's `FeatureMap`. The key is absent until the camera has reported its `FeatureMap`; a present list is the complete set. Read `privacy` before starting a session or taking a snapshot: a switch that is on makes those calls fail with error 106. Resolutions are `CameraResolution` (`{ width, height }`). There is no resolution list, because the device does not expose one.

### Starting a stream

**Minimal call.** `stream_usage` is the only required argument beyond the target. Send your SDP offer in `sdp` as well:

```typescript
const stream = await client.sendCommand("camera_start_stream", 14, {
    node_id: nodeId,
    endpoint_id: 1,
    stream_usage: "LiveView",
    sdp: offer.sdp,
});
```

This gets the best video stream the camera can serve, within what the offer can decode and within the camera's free encoder capacity. A stream already on the camera is reused when it fits. A browser's offer (H.264 level 3.1) gets at most 1280x720. Audio is added when the camera can serve it; otherwise `audio` is `null` and the session still opens. When the camera is full, the server may deallocate a stream nothing references, possibly another controller's (see `allow_eviction` below). Without `sdp` the server sends `SolicitOffer` and the camera writes the offer.

**More control.** The optional arguments:

- `video` / `audio`: hints, or `false` to exclude the track. Left out, the server decides. Video hints are ranges (`min_*` / `max_*` for resolution, frame rate and bit rate, plus `codecs`, `watermark_enabled`, `osd_enabled`). Audio hints are exact values (`codecs`, `channel_count`, `sample_rate`, `bit_rate`). The `audio` key being present at all, `{}` included, asks for audio.
- Every stated hint is a hard bound. The call fails with error 102 rather than returning a stream outside it. Setting `min == max` pins an exact value and takes capacity from every other client sharing the camera, so leave a bound unset unless you need it.
- `allow_eviction` (default `true`): whether the server may deallocate a stream nothing references to make room. Set it to `false` to skip eviction. The server still falls back to a degraded existing stream, so the call can still succeed with `degraded: true`.
- `talkback` (default `false`): whether the offer may ask the camera to play the client's audio. Browsers offer audio as `sendrecv`, so without it the server makes the offer's audio sections not send before the camera sees them. `true` forwards the offer unchanged and requires `sdp`. A camera that answers `sendrecv` anyway gets its answer narrowed by the server to the directions the offer allows, so the client applies the answer as it arrives.
- `sdp`, `ice_servers`, `ice_transport_policy`, `metadata_enabled`: passed to the WebRTC session setup.

The result (`CameraStartStreamResult`) carries `webrtc_session_id`, `mode` (`"provide_offer"` or `"solicit_offer"`), `video`, `audio` and `talkback`. `talkback` is `true` when it was asked for, the offer's audio can send, the camera states half or full duplex and `audio` is not `null`; the audio direction in the camera's answer is the final word. A track is `null` when the caller declined it, or left it out and none could be resolved. A track the caller asked for is never `null`; the call fails instead. On the video track:

- `stream_id` is what `camera_release_stream` takes.
- `provenance` (`CameraStreamProvenance`, one of `CAMERA_STREAM_PROVENANCES`): `allocated` by this call, `reused` from an earlier allocation by this server, or `adopted` from a stream this server did not allocate.
- `degraded: true` means the stream is outside the server's default range but still inside every bound the caller stated.
- `evicted_stream_ids` lists streams the server deallocated to make room. Such a stream may have belonged to another controller.
- `narrowed_by_encoder_budget` (`CameraEncoderBudgetNarrowing`) lists ceilings the camera's remaining encoder capacity lowered, with the value the server would otherwise have asked for.

`mode` says what the client does next. After `"provide_offer"` the camera sends an `answer` event. After `"solicit_offer"` the camera sends an `offer` event, and the client replies with `camera_provide_answer`.

To change a live session (an ICE restart, or different tracks), send a `ProvideOffer` with `sendWebRtcProviderCommand` and the existing `webRtcSessionId` in the payload. `camera_start_stream` always opens a new session. End the session with `camera_stop_stream` as usual.

### Signalling and event ordering

The camera's signalling arrives on the `webrtc_callback` event, typed as `WebRtcCallbackData` (`event_type` `offer`, `answer`, `ice_candidates` or `end`). Subscribe with `client.addWebRtcCallbackListener(...)`, which returns an unsubscribe function. For a session opened with `camera_start_stream`, the events reach only the connection that opened it.

**Name the session yourself.** `client_session_key` (1 to 128 characters, unique among the connection's starting and open sessions) is your own name for the session. Every `webrtc_callback` and `camera_session_ended` event of the session carries it as `client_session_key`, and `camera_provide_ice_candidates` and `camera_stop_stream` accept it in place of `webrtc_session_id`. A client therefore never needs the session id before it can act:

- The server sends a starting session's events only after the `camera_start_stream` response. Node's `ws` still delivers several frames of one read without yielding, so a listener can run before the code after `await` has stored anything. Matching by key does not depend on that order.
- Candidates sent with the key while `camera_start_stream` is still running are queued on the server and sent to the camera right after the response, in order (at most 64 per start). That command answers once its candidates were sent. Keep naming the session by its key: a command naming the id is not ordered behind queued candidates.
- `camera_stop_stream` with the key of a start still running cancels it: the start fails with error 7, and `ended` says whether the camera had opened a session that the server then ended.
- A key that names no starting or open session of this connection is error 8 for `camera_provide_ice_candidates` and `ended: false` for `camera_stop_stream`.

The key is scoped to the connection, but match `node_id` and `endpoint_id` as well when one listener serves several cameras. Compare node ids with `String(...)`, because an event may carry a `number` or a `bigint`.

```typescript
import { MatterClient, type WebRtcCallbackData } from "@matter-server/ws-client";

const pc = new RTCPeerConnection();
pc.addTransceiver("video", { direction: "recvonly" });
const key = `living-room-${Date.now()}`;

const handleSignalling = async (event: WebRtcCallbackData) => {
    switch (event.event_type) {
        case "answer":
            if (event.data) await pc.setRemoteDescription({ type: "answer", sdp: event.data.sdp });
            break;
        case "ice_candidates":
            for (const candidate of event.data?.ice_candidates ?? []) await pc.addIceCandidate(candidate);
            break;
        case "end":
            pc.close();
            break;
    }
};

const stopSignalling = client.addWebRtcCallbackListener(event => {
    if (event.client_session_key !== key) return;
    handleSignalling(event).catch(err => console.error("Signalling failed", err));
});

let startSent = false;
const earlyCandidates = new Array<RTCIceCandidate>();
const sendCandidate = (candidate: RTCIceCandidate) =>
    client
        .sendCommand("camera_provide_ice_candidates", 14, {
            node_id: nodeId,
            endpoint_id: 1,
            client_session_key: key,
            ice_candidates: [
                { candidate: candidate.candidate, sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex },
            ],
        })
        .catch(err => console.error("Sending ICE candidates failed", err));

pc.onicecandidate = ({ candidate }) => {
    if (!candidate) return;
    // The key names the session from the moment camera_start_stream is sent, not before.
    if (startSent) sendCandidate(candidate);
    else earlyCandidates.push(candidate);
};

const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
if (offer.sdp === undefined) throw new Error("Browser produced no SDP offer");

const starting = client.sendCommand("camera_start_stream", 14, {
    node_id: nodeId,
    endpoint_id: 1,
    stream_usage: "LiveView",
    sdp: offer.sdp,
    video: { max_resolution: { width: 1920, height: 1080 } },
    audio: false,
    ice_servers: [{ urls: "stun:stun.example.org:3478" }],
    client_session_key: key,
});
startSent = true;
for (const candidate of earlyCandidates.splice(0)) sendCandidate(candidate);
const stream = await starting;
console.log("session", stream.webrtc_session_id);

// Later: end the session. The stream stays allocated for reuse.
const { ended } = await client.sendCommand("camera_stop_stream", 14, {
    node_id: nodeId,
    endpoint_id: 1,
    client_session_key: key,
});
stopSignalling();
```

Without a key, the events of a starting session still arrive after the response, and a client matches them by `webrtc_session_id`. It must then store the id in `sendCommand`'s `onResult` callback, which runs before the next message is handled, and hold its local candidates until it has the id.

### Stopping, snapshots and releasing streams

- `camera_stop_stream` answers `ended: false` when the camera answered `NOT_FOUND`: an unknown id, a session that already ended, or another controller's session. Any other failure rejects, and the session is then still open on the camera, so the call can be retried. Any connection can end any session this server holds on the camera. After a server restart, `camera_get_capabilities`' `sessions` (`CameraWebRtcSession[]`) is the only way to learn a session id again; an entry with `established_by_this_server: true` can be ended.
- `camera_snapshot` needs only `node_id` and `endpoint_id`. The minimal call returns a frame from the largest snapshot capability the camera states, in any image codec, with no overlay asked for. For more control it takes optional `max_resolution` (a frame-size ceiling), `resolution` (the size wanted, `CameraResolutionTarget`: a width, a height or both; the server picks the smallest fitting capability and asks the camera to scale to it, which the camera may decline, so check the result's `resolution`), `codec` (an image codec from `snapshot.capabilities[].image_codec`), `watermark_enabled` and `osd_enabled`. The result's `stream_id` names the snapshot stream that served the frame, which stays allocated for the next call. Its `provenance` (`CameraStreamProvenance`) says whether this call allocated that stream (`allocated`) or found it on the camera (`reused`, `adopted`), so a client that releases only what it caused releases the `allocated` ones. A snapshot stream that uses the camera's hardware encoder holds it until released. On single-encoder hardware a later `camera_start_stream` can take such a stream back, but only when this server allocated it, nothing references it, and `allow_eviction` is not `false`. `camera_stream_evicted` reports it. Otherwise the call fails with error 103 until the stream is released. `degraded: true` means the frame has fewer pixels than the best capability within the request's bounds; with `resolution`, it means the frame is smaller, in every side the target states, than both the target and the capability the target selected.
- `camera_release_stream` frees a stream whoever allocated it; the camera itself refuses an id it does not know and a video or audio stream of usage `Internal`. It fails with error 104 while a listener still references the stream, so releasing never breaks a live session.

### Camera events

A connection receives these two events once it has issued any `camera_*` command; `send_webrtc_provider_command` does not count. Each listener method returns an unsubscribe function.

```typescript
const stopWatchingSessions = client.addCameraSessionEndedListener(ended => {
    console.log(`session ${ended.webrtc_session_id} has ended`);
});
const stopWatchingStreams = client.addCameraStreamEvictedListener(evicted => {
    console.log(`${evicted.kind} stream ${evicted.stream_id} was deallocated`);
});
```

- `camera_session_ended` (`CameraSessionEndedData`): a session this connection opened ended without its own command. It is sent for every such end, so a client listens here alone; `cause` says why (`peer` with the camera's `reason`, `other_connection`, `camera_restarted`, `camera_dropped`, `node_removed`, see `CameraSessionEndCause`). A session the server holds no record of, such as one opened with `sendWebRtcProviderCommand`, is reported to every connection that has used the camera API when another connection ended it and the camera still held it. It never reaches the connection whose own command ended the session.
- `camera_stream_evicted` (`CameraStreamEvictedData`, `kind` `"video"` or `"snapshot"`): the server deallocated a stream to make room for another request. It reaches every connection that has used the camera API. The id is gone for good; a replacement gets a new id. For a snapshot stream this event is the only report.

### Camera errors

A failed command rejects with `ServerCommandError`. `errorCode` is the wire error code and `message` the wire `details` string. For the camera error codes and error 100, `details` holds that string parsed as JSON, typed per code in `ServerErrorDetailsByCode`. `err.hasDetails(code)` narrows `details` to that code's type. `details` is undefined for any other code, and when the parsed value does not satisfy that code's type: a required field missing, a field of the wrong type, or a value outside the type's set (an unknown `reason`, `kind` or privacy mode). Code that has narrowed `details` can therefore use every field its type declares. For error 102, `cameraStreamIncompatibleDetails(err, reason)` returns the details typed to one `reason`, or undefined. A malformed argument is error 8 (`INVALID_ARGUMENTS`) with a plain-text message that names the key.

| Code | Constant                                | `details` (type)                                                                                        | Meaning                                                                                     |
| ---- | --------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 100  | `ICD_MULTI_ADMIN_ERROR_CODE`            | `IcdMultiAdminErrorDetails`: `message`, `admin_vendor_ids`                                              | ICD registration refused: the peer has administrators from other vendors                    |
| 102  | `CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE` | `CameraStreamIncompatibleErrorDetails`: `message`, `reason`, `track?`, `feature?`, `device`, `requested`, `bound?`, `device_status?` | No stream can meet the request. Branch on `reason`                                          |
| 103  | `CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE`  | `CameraResourceExhaustedErrorDetails`: `message`, `allocated` (`CameraOccupyingStream[]`), `max_concurrent_encoders?`, `max_encoded_pixel_rate?` | The camera has no capacity left. `allocated` lists the streams holding it (see below)       |
| 104  | `CAMERA_STREAM_IN_USE_ERROR_CODE`       | `CameraStreamInUseErrorDetails`: `message`, `stream_id`, `reference_count?`                             | `camera_release_stream` on a stream that is still referenced                                |
| 105  | `CAMERA_NOT_SUPPORTED_ERROR_CODE`       | `CameraNotSupportedErrorDetails`: `message`, `missing_clusters`                                         | The endpoint lacks a cluster the command needs                                              |
| 106  | `CAMERA_PRIVACY_MODE_ERROR_CODE`        | `CameraPrivacyModeErrorDetails`: `message`, `modes` (`CameraPrivacyMode[]`), `device_status`            | A privacy switch forbids the session or snapshot. No other argument succeeds while it is on |

The error 102 `reason` is one of `CAMERA_INCOMPATIBLE_REASONS` (type `CameraStreamIncompatibleReason`). Each value has one meaning, so a client never needs a second field to tell two cases apart:

- `codec`: no codec both sides support. Change `video.codecs` / `audio.codecs` or the codecs in the offer.
- `bounds`: a stated bound the camera cannot meet. On `camera_start_stream`, `bound` (`CameraStreamIncompatibleBound`) names the bound when the server ruled it out before asking the camera: `field` is a `CameraBoundField` (one of `CAMERA_BOUND_FIELDS`), with `requested` and `limit` as text.
- `feature`: the camera does not advertise a feature the request needs. `feature` names it as `features` spells it.
- `capability`: the camera advertises the feature but states no capability the request could use.
- `offer`: the SDP offer rejects this track's media section, will not receive it, or has none. `track` names the kind.
- `no_media`: the request leaves no track for the session. Ask for at least one track.
- `level`: the offer states a codec decode ceiling the server cannot read. Change the `a=fmtp` line or the level in the offer.

`codec` is fixed in the command arguments or the SDP, `bounds` and `no_media` in the command arguments, `offer` and `level` in the SDP. `feature` and `capability` cannot be fixed by changing the request.

The error 103 `allocated` list: for a video stream or a snapshot, every allocated video stream plus every snapshot stream that uses the hardware encoder (`hardware_encoder: true`); for audio, every allocated audio stream. Streams nothing references are listed too.

A request that asked for audio and cannot get it can also fail with error 103 (no capacity), error 7 (`SDKStackError`, the device returned no stream id) or error 0 (`UnknownError`, a device status the server does not recognize).

```typescript
import {
    CAMERA_PRIVACY_MODE_ERROR_CODE,
    CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE,
    cameraStreamIncompatibleDetails,
    ServerCommandError,
} from "@matter-server/ws-client";

try {
    await client.sendCommand("camera_start_stream", 14, { node_id: nodeId, endpoint_id: 1, stream_usage: "LiveView" });
} catch (err) {
    if (!(err instanceof ServerCommandError)) throw err;
    const bounds = cameraStreamIncompatibleDetails(err, "bounds");
    if (bounds !== undefined) {
        console.log("bound not met", bounds.bound);
    } else if (err.hasDetails(CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE)) {
        console.log(`incompatible: ${err.details.reason}`);
    } else if (err.hasDetails(CAMERA_PRIVACY_MODE_ERROR_CODE)) {
        console.log(`privacy switch on: ${err.details.modes.join(", ")}`);
    } else {
        throw err;
    }
}
```

### Using the Matter commands directly

A client that manages streams itself uses `client.sendWebRtcProviderCommand(nodeId, endpointId, commandName, payload)`. `commandName` is a `WebRtcProviderCommandName`: `ProvideOffer`, `SolicitOffer`, `ProvideAnswer` or `ProvideIceCandidates`. `EndSession` is not available this way; use `camera_stop_stream`. The payload takes the cluster's fields, with case and word separators in a key ignored, and `ice_servers` in the `CameraIceServer` shape. The server checks every field and refuses an unknown key, a duplicate key and a `ProvideOffer` / `SolicitOffer` payload that states streams in both the list and the singular form. See [docs/websockets_api.md](https://github.com/matter-js/matterjs-server/blob/main/docs/websockets_api.md) for the exact rules.

`deviceCommand` also reaches the WebRTC Transport Provider cluster, but as a plain invoke in the cluster's own field names. It does not register the session with the server, so no `webrtc_callback` event is routed for a session started that way.

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
