# WebSocket API Documentation

This document describes the WebSocket API for the Matter.js server. The server listens on `ws://localhost:5580/ws` by default.

## Connection

On connection, the server immediately sends a `server_info` message with fabric and capability information:

```json
{
  "fabric_id": 1234567890,
  "compressed_fabric_id": 9876543210,
  "schema_version": 14,
  "min_supported_schema_version": 11,
  "sdk_version": "matter-server/1.1.7 (matter.js/0.17.5-alpha)",
  "wifi_credentials_set": true,
  "thread_credentials_set": false,
  "bluetooth_enabled": true
}
```

## Request/Response Format

All commands follow this request format:

```json
{
  "message_id": "unique-id",
  "command": "command_name",
  "args": { ... }
}
```

Successful responses:
```json
{
  "message_id": "unique-id",
  "result": { ... }
}
```

Error responses:
```json
{
  "message_id": "unique-id",
  "error_code": 0,
  "details": "Error description"
}
```

## Commands

### Server Information

**server_info** - Get server information

```json
{
  "message_id": "1",
  "command": "server_info"
}
```

**diagnostics** - Get server diagnostics (info, nodes, and recent events)

```json
{
  "message_id": "1",
  "command": "diagnostics"
}
```

**get_loglevel** - Get current log levels *(Matter.js only)*

Returns the current log level for console output and optionally for file logging (if configured). This command is not available in the Python Matter Server.

```json
{
  "message_id": "1",
  "command": "get_loglevel"
}
```

Response:
```json
{
  "message_id": "1",
  "result": {
    "console_loglevel": "info",
    "file_loglevel": "debug"
  }
}
```

Note: `file_loglevel` is `null` if file logging is not configured.

**set_loglevel** - Set log levels temporarily *(Matter.js only)*

Change the log level for console and/or file logging. Changes are temporary and will be reset on the next server restart. This command is not available in the Python Matter Server.

```json
{
  "message_id": "1",
  "command": "set_loglevel",
  "args": {
    "console_loglevel": "debug",
    "file_loglevel": "info"
  }
}
```

Both arguments are optional - only provide the ones you want to change.

Log levels (from least to most verbose):
- `critical` - Only fatal errors
- `error` - Errors
- `warning` - Warnings and errors
- `notice` - Operator/user-significant lifecycle events
- `info` - Informational messages (default)
- `debug` - Debug output (verbose)

`set_loglevel` also accepts the matter.js aliases `fatal` (= `critical`) and `warn` (= `warning`).

Response returns the current levels after the change:
```json
{
  "message_id": "1",
  "result": {
    "console_loglevel": "debug",
    "file_loglevel": "info"
  }
}
```

### Listening and Node Discovery

**start_listening** - Start receiving events and get all nodes

When the `start_listening` command is issued, the server returns all existing nodes. From that moment on, all events (including node attribute changes) will be forwarded to this WebSocket connection.

```json
{
  "message_id": "1",
  "command": "start_listening"
}
```

**get_nodes** - Get all commissioned nodes

```json
{
  "message_id": "1",
  "command": "get_nodes",
  "args": {
    "only_available": false
  }
}
```

**get_node** - Get a single node by ID

```json
{
  "message_id": "1",
  "command": "get_node",
  "args": {
    "node_id": 1
  }
}
```

**discover** / **discover_commissionable_nodes** - Discover commissionable devices on the network

```json
{
  "message_id": "1",
  "command": "discover"
}
```

### Credentials

WiFi and Thread credentials are stored as **named lists** (schema 12). Each entry has an `id`; the
reserved `default` entry is what pre-12 callers use when they omit `id`, so older clients keep
working unchanged. Storing multiple networks lets commissioning pick which one to use (see
`commission_with_code`), and — for Thread — lets the server query diagnostics from any Border Router
whose network you hold credentials for.

Secrets are **write-only**: they are stored but never returned. `get_all_credentials` returns only
summaries. On `set_*`, a value is required; a WiFi password may be omitted **only** to keep the
already-stored secret for an **unchanged** SSID (re-saving an entry without resending the password).
A blank password on a new/changed SSID, or an empty Thread dataset, is rejected. To clear an entry —
including the reserved `default`, which cannot be deleted from the list — use `remove_wifi_credentials`
/ `remove_thread_dataset` (this zeroes both the SSID and the secret).

**set_wifi_credentials** - Set WiFi credentials for commissioning

Inform the controller about the WiFi credentials it needs to send when commissioning a new device.
Pass an optional `id` to address a named entry (omit for the `default` entry).

```json
{
  "message_id": "1",
  "command": "set_wifi_credentials",
  "args": {
    "ssid": "wifi-name-here",
    "credentials": "wifi-password-here",
    "id": "Guest"
  }
}
```

**set_thread_dataset** - Set Thread credentials for commissioning

Inform the controller about the Thread credentials it needs to use when commissioning a new device.
The dataset must be a non-empty hex-encoded operational dataset. Pass an optional `id` for a named
entry. A dataset carrying `pskc` + `networkKey` additionally enables **MeshCoP diagnostics** for that
Thread network (see Thread Network Diagnostics below).

```json
{
  "message_id": "1",
  "command": "set_thread_dataset",
  "args": {
    "dataset": "hex-encoded-operational-dataset",
    "id": "MyThreadNet"
  }
}
```

**get_all_credentials** - List stored credential summaries (schema 12)

Returns `{ wifi: [{ id, ssid }], thread: [{ id, networkName, extPanId }] }` — summaries only, never
secrets. The `default` entry is always present (treat it as unset unless `server_info`'s
`wifi_credentials_set` / `thread_credentials_set` is true).

```json
{ "message_id": "1", "command": "get_all_credentials" }
```

**remove_wifi_credentials** / **remove_thread_dataset** - Clear a stored entry (schema 12 for a named `id`)

Removes a named entry, or clears the reserved `default` (zeroing its SSID + secret). Omit `id` for the
`default` entry.

```json
{ "message_id": "1", "command": "remove_thread_dataset", "args": { "id": "MyThreadNet" } }
```

**set_default_fabric_label** - Set the default fabric label

Ignored when the server is started with `--default-fabric-label` (env `DEFAULT_FABRIC_LABEL`): the request succeeds but the pinned label is kept. Read the effective value with `get_fabric_label`.

Also ignored per session across connections: the first WebSocket connection to issue `set_default_fabric_label` owns the label for the lifetime of that connection. Other connections' `set_default_fabric_label` requests then succeed but are ignored (and logged) until the owning connection disconnects, at which point the next connection to issue the command claims ownership. This stops two clients (e.g. two Home Assistant instances) from overwriting each other's label.

```json
{
  "message_id": "1",
  "command": "set_default_fabric_label",
  "args": {
    "label": "Home"
  }
}
```

**get_fabric_label** - Get the currently configured fabric label (schema 12+)

```json
{
  "message_id": "1",
  "command": "get_fabric_label",
  "args": {}
}
```

Response: `{ "fabric_label": "HomeAssistant" }`

### Commissioning

**commission_with_code** - Commission a new device using QR code or manual pairing code

For WiFi or Thread based devices, the credentials need to be set upfront, otherwise commissioning will fail. Supports both QR-code syntax (MT:...) and manual pairing code.

The controller will use Bluetooth for commissioning wireless devices. If Bluetooth is not available, commissioning will only work for devices already on the network (set `network_only: true`).

Using QR code:
```json
{
  "message_id": "1",
  "command": "commission_with_code",
  "args": {
    "code": "MT:Y.ABCDEFG123456789"
  }
}
```

Using manual pairing code (network only):
```json
{
  "message_id": "1",
  "command": "commission_with_code",
  "args": {
    "code": "35325335079",
    "network_only": true
  }
}
```

**commission_on_network** - Commission a device already on the network

Commission using setup PIN code with optional filtering by discriminator or vendor ID.

```json
{
  "message_id": "1",
  "command": "commission_on_network",
  "args": {
    "setup_pin_code": 20202021,
    "filter_type": 2,
    "filter": 3840,
    "ip_addr": "192.168.1.100"
  }
}
```

Filter types:
- `0` - No filter (discover any)
- `1` - Short discriminator
- `2` - Long discriminator
- `3` - Vendor ID

**open_commissioning_window** - Open commissioning window to share a device

Open a commissioning window to allow another controller to commission a device already on this controller.

```json
{
  "message_id": "1",
  "command": "open_commissioning_window",
  "args": {
    "node_id": 1,
    "timeout": 300
  }
}
```

Response includes pairing codes:
```json
{
  "message_id": "1",
  "result": {
    "setup_pin_code": 12345678,
    "setup_manual_code": "35325335079",
    "setup_qr_code": "MT:Y.ABCDEFG123456789"
  }
}
```

### Thread Network Diagnostics

Read-only diagnostics for the Thread networks around the controller (schema 12). This is separate
from Matter-over-Thread commissioning and can be turned off entirely with `--disable-thread-diagnostics`
(env `DISABLE_THREAD_DIAGNOSTICS`) without affecting commissioning.

**How it works**

- The server passively discovers Thread **Border Routers** via mDNS (`_meshcop._udp`) and lists them
  with `get_thread_border_routers` — no credentials required.
- To collect per-node **diagnostics** for a network, the server needs a way in:
  - **MeshCoP (CoAP/DTLS)** — used when you've stored a Thread dataset carrying `pskc` + `networkKey`
    for that network (via `set_thread_dataset`). Stored datasets are registered at startup and
    whenever you set them.
  - **OTBR REST** — used automatically when a discovered Border Router exposes the OpenThread REST API.
  - When both are available the server prefers MeshCoP (CoAP) — it is much faster than the REST
    collection path. A network with neither yields a partial result with reason `no_credentials`.
- **First query is slow, then cached.** Diagnostics are collected over a streaming window (about
  20 seconds): a first partial batch resolves after ~5 s and more nodes fill in until the window
  closes (~20 s). So when a client opens the Thread panel for the first time in a session, expect the
  mesh to **populate progressively over ~20 s**, arriving via `thread_diagnostics_updated` events.
  Results are then **cached (~1 h)** and returned instantly on subsequent queries; pass `force: true`
  to bypass the cache and re-collect.

**get_thread_border_routers** - List discovered Thread Border Routers (passive, no credentials)

```json
{ "message_id": "1", "command": "get_thread_border_routers" }
```

**get_thread_diagnostics** - Fetch per-Thread-network diagnostics

- With `ext_pan_id`: awaits a collection and returns the batch, or `null` when nothing is cached /
  diagnostics are disabled.
- Without `ext_pan_id`: returns the **current cache** for all known networks (an array, possibly empty)
  **immediately**, and kicks off a background refresh whose fresh batches arrive via the
  `thread_diagnostics_updated` event. Use the `ext_pan_id` form when you need synchronously-fresh data
  for one network.
- `force: true` bypasses the cache and re-collects.

```json
{
  "message_id": "1",
  "command": "get_thread_diagnostics",
  "args": { "ext_pan_id": "1122334455667788", "force": false }
}
```

Issuing either Thread command opts the connection in to `thread_diagnostics_updated` events (see
Events); a client that never queries Thread data never receives them.

### Network Topology

**get_network_topology** *(schema 13+)* - Return the whole Matter network as a graph

Derives the Thread mesh and the Wi-Fi star from the nodes' own diagnostics, plus the discovered
Border Routers. Optional `refresh: true` re-reads the diagnostics from every online node first
(seconds, real radio traffic — user-initiated only, never polled). Issuing the command also opts
the connection in to `network_topology_updated` events (see Events).

```json
{
  "message_id": "1",
  "command": "get_network_topology",
  "args": { "refresh": false }
}
```

The response is a `NetworkTopology` (`{ collected_at, nodes[], connections[] }`); see
[the schema changelog](websocket-api-schema-changelog.md) for the node kinds, link directions and
strength values, and `packages/ws-client/src/models/model.ts` for the exact wire shape.

### Attribute Operations

**read_attribute** - Read attribute(s) from a node

Read one or more attributes using path format `endpoint/cluster/attribute`. Supports wildcards using `*`.

Single attribute:
```json
{
  "message_id": "1",
  "command": "read_attribute",
  "args": {
    "node_id": 1,
    "attribute_path": "1/6/0"
  }
}
```

Multiple attributes:
```json
{
  "message_id": "1",
  "command": "read_attribute",
  "args": {
    "node_id": 1,
    "attribute_path": ["1/6/0", "1/6/16384", "0/40/1"]
  }
}
```

Wildcard (all attributes from OnOff cluster):
```json
{
  "message_id": "1",
  "command": "read_attribute",
  "args": {
    "node_id": 1,
    "attribute_path": "1/6/*"
  }
}
```

**write_attribute** - Write an attribute value

```json
{
  "message_id": "1",
  "command": "write_attribute",
  "args": {
    "node_id": 1,
    "attribute_path": "1/6/16385",
    "value": 10
  }
}
```

### Commands

**device_command** - Send a command to a device

```json
{
  "message_id": "1",
  "command": "device_command",
  "args": {
    "node_id": 1,
    "endpoint_id": 1,
    "cluster_id": 6,
    "command_name": "on",
    "payload": {}
  }
}
```

Command with parameters (e.g., move to level):
```json
{
  "message_id": "1",
  "command": "device_command",
  "args": {
    "node_id": 1,
    "endpoint_id": 1,
    "cluster_id": 8,
    "command_name": "moveToLevelWithOnOff",
    "payload": {
      "level": 128,
      "transitionTime": 10
    }
  }
}
```

Optional parameters:
- `response_type`: Client SDK type hint (currently ignored by the server)
- `timed_request_timeout_ms`: Timeout for timed interactions (required for some commands like door lock)

### Node Management

**interview_node** - Re-interview a node (refresh its data)

```json
{
  "message_id": "1",
  "command": "interview_node",
  "args": {
    "node_id": 1
  }
}
```

**ping_node** - Ping a node to check connectivity

```json
{
  "message_id": "1",
  "command": "ping_node",
  "args": {
    "node_id": 1,
    "attempts": 3
  }
}
```

**get_node_ip_addresses** - Get IP addresses for a node

```json
{
  "message_id": "1",
  "command": "get_node_ip_addresses",
  "args": {
    "node_id": 1,
    "prefer_cache": false,
    "scoped": false
  }
}
```

**remove_node** - Remove/decommission a node

```json
{
  "message_id": "1",
  "command": "remove_node",
  "args": {
    "node_id": 1
  }
}
```

### Fabric Management

**get_matter_fabrics** - Get all fabrics on a node

```json
{
  "message_id": "1",
  "command": "get_matter_fabrics",
  "args": {
    "node_id": 1
  }
}
```

**remove_matter_fabric** - Remove a fabric from a node

```json
{
  "message_id": "1",
  "command": "remove_matter_fabric",
  "args": {
    "node_id": 1,
    "fabric_index": 2
  }
}
```

### ACL and Bindings

**set_acl_entry** - Set ACL entries on a node

Replaces the ACL entries for the controller's fabric on the target node. The server automatically determines the fabric index.

```json
{
  "message_id": "1",
  "command": "set_acl_entry",
  "args": {
    "node_id": 1,
    "entry": [
      {
        "privilege": 5,
        "auth_mode": 2,
        "subjects": [112233],
        "targets": null
      }
    ]
  }
}
```

Entry fields:
- `privilege`: 1=View, 3=Operate, 4=Manage, 5=Administer
- `auth_mode`: 1=PASE, 2=CASE, 3=Group
- `subjects`: Array of NodeIds or GroupIds (or null)
- `targets`: Optional target restrictions (or null) - each target has `cluster`, `endpoint`, `device_type` fields

**set_node_binding** - Set bindings on a node endpoint

```json
{
  "message_id": "1",
  "command": "set_node_binding",
  "args": {
    "node_id": 1,
    "endpoint": 1,
    "bindings": [
      {
        "node": 2,
        "endpoint": 1,
        "cluster": 6
      }
    ]
  }
}
```

### Firmware Updates

**check_node_update** - Check for available firmware updates

```json
{
  "message_id": "1",
  "command": "check_node_update",
  "args": {
    "node_id": 1
  }
}
```

**update_node** - Apply a firmware update

```json
{
  "message_id": "1",
  "command": "update_node",
  "args": {
    "node_id": 1,
    "software_version": 2
  }
}
```

**initiate_ota_upload** *(schema 13+)* - Reserve an id for uploading a local `.ota` firmware file

Returns an `upload_id` that must be POSTed to `/ota-upload/<upload_id>` (see HTTP Endpoints
below) within `expires_in` seconds, from the same client that reserved it. Reserving an id also
claims one of the server's limited in-flight upload slots, so a client must follow through or let
the reservation expire before retrying. Requires OTA support to be enabled (no `--disable-ota`).

```json
{
  "message_id": "1",
  "command": "initiate_ota_upload",
  "args": {}
}
```

```json
{
  "upload_id": "3f9a1c2e8b7d4a10f6c9e0b2d4a17853",
  "expires_in": 60,
  "max_size": 67108864
}
```

### ICD Management

Manage this controller's Intermittently Connected Device (ICD) Check-In registration with a peer node.
Read the details about ICD devices and consequences of changing the ICD mode carefully before applying any changes.

**get_icd_state** - Get ICD state for a node

```json
{
  "message_id": "1",
  "command": "get_icd_state",
  "args": {
    "node_id": 1
  }
}
```

Response (`IcdStateData`):

```json
{
  "supported": true,
  "lit_supported": true,
  "registered": true,
  "operating_mode": "LIT",
  "awake": false,
  "available": true,
  "next_expected_checkin": 1735689600000
}
```

If the node has no ICD Management cluster, `supported` is `false` and all other fields are `false`/`null`.

**register_icd** - Register this controller as an ICD Check-In client

```json
{
  "message_id": "1",
  "command": "register_icd",
  "args": {
    "node_id": 1,
    "allow_multi_admin": false,
    "ignored_vendors": [4874]
  }
}
```

Response: `IcdStateData` (see `get_icd_state`).

Fails with error code `100 IcdMultiAdmin` if the peer has other-vendor administrators and `allow_multi_admin` is not set.

**unregister_icd** - Drop this controller's ICD Check-In registration

If other ecosystems are still registered the device might stay in the LIT mode, and connecting to the device might take a long time, and the server might automatically re-register after the next connection.

```json
{
  "message_id": "1",
  "command": "unregister_icd",
  "args": {
    "node_id": 1,
    "force": false
  }
}
```

Response: `IcdStateData` (see `get_icd_state`). `force` skips the peer round-trip (for an unreachable peer) and only clears local state.

**resync_icd** - Drop the local ICD registration and reconnect

This should be the last resort to try to get an ICD device in LIT mode connected again. Before doing this try to restart the device. It can take up to the "maximum IdleMode Time" of the device before it reconnects.

```json
{
  "message_id": "1",
  "command": "resync_icd",
  "args": {
    "node_id": 1
  }
}
```

A LIT peer re-registers automatically once subscribed.

### Camera Streaming (schema 14+)

Five commands cover a Matter camera's stream lifecycle. The server computes the `VideoStreamAllocate` envelope, reuses or allocates streams, walks the device's rejections and tracks the WebRTC session, so a client does not have to. The raw `send_webrtc_provider_command` / `device_command` path keeps working for a client doing its own allocation.

Every codec on these commands is a **name**, not a number: `H264`, `H265`, `H266`, `AV1` (video), `OPUS`, `AAC` (audio), `JPEG`, `HEIC` (snapshot). Stream usages are names too: `Internal`, `Recording`, `Analysis`, `LiveView`, and so is `two_way_talk_support` (`NotSupported`, `HalfDuplex`, `FullDuplex`). All these names are matched case-insensitively. The codec set is open: a codec the cluster enum does not define is reported as its decimal digits and accepted back in that spelling. The stream usages are closed only for requests, not for reports: `camera_start_stream` takes only the four names above and refuses `Internal`, which marks a stream the device keeps for itself, but `camera_get_capabilities` still reports a usage the enum does not define as its decimal digits, and a stream carrying it cannot be requested back. `two_way_talk_support` is reported the same way — a value the enum does not define comes back as its decimal digits — and has no request side at all: talkback is asked for in the SDP offer, not by a hint. An audio section whose direction is `a=sendrecv` or `a=sendonly` asks for it, and so does one stating no direction at all, which is `sendrecv` (RFC 4566 §6). `a=sendonly` asks for talkback and refuses the camera's audio in one statement, so such a section gets no audio stream. An `sdp` that carries no section of a kind at all refuses that kind as well: the answer carries exactly the m-lines of the offer it answers (RFC 3264 §6), so there is nothing for such a track to be sent in. Without `sdp` the camera writes the offer itself and no kind is refused.

A name is the same string in both directions, but a reported key is not always a hint key. These are the values `camera_get_capabilities` reports that a later command takes back:

| Reported by `camera_get_capabilities` | Send back as |
|---|---|
| `video.codecs` | `camera_start_stream`'s `video.codecs` |
| `audio.codecs` | `camera_start_stream`'s `audio.codecs` |
| `audio.channels` | `camera_start_stream`'s `audio.channel_count`; the reported value is the ceiling |
| `audio.sample_rates` | `camera_start_stream`'s `audio.sample_rate`; one of the reported values |
| `limits.supported_stream_usages` | `camera_start_stream`'s `stream_usage`, any name but `Internal` |
| `snapshot.capabilities[].image_codec` | `camera_snapshot`'s `codec` |

Everything else the command reports is a fact about the camera rather than a value to send back. `audio.bit_depths` has no hint: `AudioStreamAllocate` takes one bit depth and the server picks it from that list. A key a hint object does not take is refused with error 8 instead of being ignored, so a bound can never be dropped without the caller hearing about it.

Every `resolution`, `min_resolution`, `max_resolution` and `sensor` on these commands is an object `{ "width": number, "height": number }`. On an argument — `camera_start_stream`'s `video.min_resolution` / `max_resolution` and `camera_snapshot`'s `max_resolution` — both fields must be positive integers, and a negative, zero, fractional, `NaN`, or infinite value is refused with error 8 instead of reaching the camera.

**camera_get_capabilities** - Report what the camera states, and what is allocated on it

```json
{
  "message_id": "1",
  "command": "camera_get_capabilities",
  "args": {
    "node_id": 1,
    "endpoint_id": 1
  }
}
```

Allocates nothing. The response has four groups plus `allocated`. Optional fields are absent when the camera states nothing for them.

`video`:

| Field | Type | Meaning |
|---|---|---|
| `sensor` | resolution, optional | Sensor size |
| `min_viewport` | resolution, optional | Smallest viewport the camera states |
| `max_fps` | number, optional | Frame-rate ceiling |
| `max_hdr_fps` | number, optional | Frame-rate ceiling in HDR |
| `hdr_capable` | boolean, optional | Whether the camera can encode HDR |
| `rate_distortion_points` | array | `{ codec, resolution, min_bit_rate }` per entry: the bit rate a codec needs at a resolution |
| `codecs` | array of names | The distinct codecs found in `rate_distortion_points` |

There is deliberately no resolution list: the camera does not state one. `codecs` is derived from `rate_distortion_points`, so a camera that states no trade-off point reports an **empty** list. That is what the camera says, not a statement that it can encode nothing — `camera_start_stream` then accepts any of `H264`, `H265`, `H266` and `AV1` and lets the device answer.

`audio`:

| Field | Type | Meaning |
|---|---|---|
| `codecs` | array of names | Microphone codecs |
| `channels` | number, optional | Largest channel count the camera accepts |
| `sample_rates` | array of numbers | Sample rates the camera accepts |
| `bit_depths` | array of numbers | Bit depths the camera accepts |
| `two_way_talk_support` | name, optional | `NotSupported`, `HalfDuplex` or `FullDuplex` |

`snapshot.capabilities` is an array of `{ resolution, max_frame_rate, image_codec, requires_encoded_pixels, requires_hardware_encoder }`. A capability takes one of the camera's encoders only when both flags are true. `requires_hardware_encoder` is always present as a boolean; the underlying Matter field is optional, and the server reports a camera that leaves it unstated as `false`.

`limits`:

| Field | Type | Meaning |
|---|---|---|
| `max_encoded_pixel_rate` | number, optional | Pixel-rate budget across all streams |
| `max_concurrent_encoders` | number, optional | How many encoders the camera has |
| `max_network_bandwidth` | number, optional | Bits per second; the server caps a stream's `max_bit_rate` at it |
| `supported_stream_usages` | array of names | Usages the camera accepts |
| `stream_usage_priorities` | array of names | The camera's own ordering of them |

`allocated` lists what is on the camera now, per kind. `reference_count` is the device's own count of listeners. `owned_by_server` says this server allocated the stream during its current run, which is what decides whether it may deallocate the stream unasked. It is not a precondition for `camera_release_stream`, and it is false again after a server restart. It is this server's own record rather than a device fact: a camera that reports its allocations late or not at all can reissue a stream id the server still has an allocation recorded under, and the flag is then true for a stream someone else allocated.

| Group | Fields |
|---|---|
| `allocated.video[]` | `video_stream_id`, `stream_usage`, `video_codec`, `min_resolution`, `max_resolution`, `min_frame_rate`, `max_frame_rate`, `min_bit_rate`, `max_bit_rate`, `reference_count`, `owned_by_server` |
| `allocated.audio[]` | `audio_stream_id`, `stream_usage`, `audio_codec`, `channel_count`, `sample_rate`, `bit_rate`, `bit_depth`, `reference_count`, `owned_by_server` |
| `allocated.snapshot[]` | `snapshot_stream_id`, `image_codec`, `min_resolution`, `max_resolution`, `reference_count`, `owned_by_server` |

**camera_start_stream** - Allocate or reuse a stream and open a WebRTC session

`ProvideOffer` when `sdp` is given, `SolicitOffer` otherwise.

```json
{
  "message_id": "1",
  "command": "camera_start_stream",
  "args": {
    "node_id": 1,
    "endpoint_id": 1,
    "stream_usage": "LiveView",
    "sdp": "v=0\r\n...",
    "video": { "codecs": ["H264"], "max_resolution": { "width": 1920, "height": 1080 } },
    "audio": false,
    "ice_servers": [{ "urls": "stun:stun.example.org:3478" }],
    "ice_transport_policy": "all",
    "metadata_enabled": false
  }
}
```

| Argument | Type | Meaning |
|---|---|---|
| `stream_usage` | name, required | Any reported usage but `Internal` |
| `sdp` | string, optional | The offer; absent means `SolicitOffer` |
| `video` | object or `false` | Range hints, or `false` to leave the track out |
| `audio` | object or `false` | Exact-value hints, or `false` to leave the track out |
| `ice_servers` | array of objects, optional | Each entry is `{ urls, username?, credential?, caid? }`. `urls` is one URL string or a list of up to 10, each at most 2000 characters; `username` is at most 508 and `credential` at most 512; `caid` is an integer 0 to 65534. Any other key, an entry naming no URL, or a value past those limits is refused with error 8. The server translates each entry into the cluster's `ICEServerStruct` (spec § 11.4.5.3), whose field is `URLs` and always a list. `username` and `credential` are masked in the server's debug log |
| `ice_transport_policy` | string, optional | Passed to the WebRTC session setup unchanged |
| `metadata_enabled` | boolean, optional | Passed to the WebRTC session setup; absent is `false` |

`video` takes **ranges**: `codecs`, `min_resolution`, `max_resolution`, `min_frame_rate`, `max_frame_rate`, `min_bit_rate`, `max_bit_rate`. `audio` takes **exact values**, not ranges: `codecs`, `channel_count`, `sample_rate`, `bit_rate`. Any other key under either object is refused with error 8. The command's own arguments are refused the same way, so a range hint sent at the top level instead of under `video` is an error rather than a silently dropped bound. Every numeric hint value must be a positive integer, the same rule a resolution's `width` and `height` follow; a negative, zero, fractional, `NaN`, or infinite value is refused with error 8 rather than reaching the camera.

Every bound the caller states is hard in both directions: a codec list, floor or ceiling that nothing satisfies fails with error 102 rather than returning something else. Setting `min_resolution == max_resolution` pins an exact value, and takes that capacity from every other client sharing the camera (spec §15.2.1.2.2), so leave a bound unset unless an exact value is required.

`video` and `audio` each make one of three statements, and both keys work the same way. Present with an object — `{}` included — asks for that track: if it cannot be resolved the call fails with the error that says why, rather than answering `null` for it. `false` declines the track. Left out leaves the track to the server: `audio` then reports `null` for any reason no audio stream could be resolved, while `video` reports `null` only when the offer rejects the video section, states a direction that will not receive it (`a=sendonly`, `a=inactive`), or carries no video section at all — a camera that refuses a video allocation still fails the call, since video is what the session is for. A track that was asked for and could not be resolved fails with error 102 when no capability, codec or range fits, error 103 when the camera refused the allocation for lack of capacity, or error 7 (`SDKStackError`) when the device accepts the allocation but never returns a stream id. A device status the allocation ladder does not recognize — anything other than `DynamicConstraintError`, `ResourceExhausted` or `ConstraintError` — is not translated into one of those codes and surfaces as error 0 (`UnknownError`) instead.

A request that leaves nothing for the offer to carry fails with error 102, `reason: "capability"`, no `track`, and `device` and `requested` both empty, rather than sending an offer with neither track. That happens when `video: false` and `audio: false` are both stated, and when one track is declined and the other was left to the server and could not be resolved — no microphone, no codec match, a section the offer rejects or will not receive, or a refused allocate all end there the same way. Asking for at least one track succeeds with everything else about the request unchanged.

Response: `{ webrtc_session_id, mode, video, audio }`. `mode` is `"provide_offer"` or `"solicit_offer"`. A track is `null` when the caller declined it with `false`, and when the caller left it out and no stream could be resolved for it. A track the caller asked for is never `null`: the call fails instead.

| Field | On | Meaning |
|---|---|---|
| `stream_id` | both | The id `camera_release_stream` takes for this track's `kind`. A stream this call allocated can also be reached later through `camera_get_capabilities`'s matching `video_stream_id` / `audio_stream_id` |
| `codec` | both | Codec name |
| `resolution` | video | `{ min, max }`, each a resolution |
| `frame_rate` | video | `{ min, max }` |
| `bit_rate` | video | `{ min, max }` |
| `channel_count`, `sample_rate`, `bit_rate`, `bit_depth` | audio | The allocated values |
| `reused` | both | The stream was already on the camera |
| `allocated_by_server` | both | This server allocated the stream in its current run. False for a stream it adopted, which `camera_release_stream` can free just the same |
| `degraded` | video, optional | Present and `true` when the stream does not fit the range the server computed, though it stays inside every bound the caller stated. Absent otherwise |

Answer SDP and ICE candidates keep arriving on the `webrtc_callback` event.

**camera_stop_stream** - End the WebRTC session, keep the allocation

```json
{
  "message_id": "1",
  "command": "camera_stop_stream",
  "args": {
    "node_id": 1,
    "endpoint_id": 1,
    "webrtc_session_id": 3
  }
}
```

Response: `{ "ended": true }`. `ended` is `false` when this call ended no live session: either the id is not one this server tracks for that node and endpoint, or the camera answered `NOT_FOUND` for it, which is an id the camera could not resolve to one of its sessions — one the peer had already ended, or one that was never its own. In the second case the server drops its local records for the id as well; ending a session through `device_command` with `EndSession` drops the same records.

An `EndSession` the camera refuses for any other reason is an error response, not `ended: false`. That now also covers an `EndSession` another path sent first: a closing connection and the shutdown pass end the sessions they own, there is one `EndSession` per session however many paths reach it, and a `camera_stop_stream` naming a session one of them is already ending waits on that same invoke and reports its outcome. So the error can report an `EndSession` this request did not itself send. Either way the session is still open and the server still tracks it, so sending `camera_stop_stream` again is the retry.

Ending a session with `device_command` and `EndSession` drops the same two local records, in that order: this server's camera session registry, then the requestor-side session tracking. A failure of the second is logged and does not fail the command — the `EndSession` already succeeded on the camera, and reporting an error would invite a retry the camera can only answer `NOT_FOUND`.

**camera_snapshot** - Capture one still frame

```json
{
  "message_id": "1",
  "command": "camera_snapshot",
  "args": {
    "node_id": 1,
    "endpoint_id": 1,
    "max_resolution": { "width": 1280, "height": 720 },
    "codec": "JPEG"
  }
}
```

`max_resolution` and `codec` are the only arguments besides `node_id` and `endpoint_id`; any other key is refused with error 8, the same as an unknown hint key on `camera_start_stream`.

Response: `{ data, codec, resolution, downgraded, stream_id? }`. `data` is base64-encoded image bytes. When the camera's encoders are all taken, the server prefers a capability that needs no hardware encoder; how many are taken is counted from the referenced video streams against `max_concurrent_encoders`, so one viewer on a camera that states four encoders costs nothing. `downgraded: true` says the frame is smaller than the best capability the request's own bounds allowed. `stream_id` is present exactly when the server left the stream the frame came from on the camera, so its presence is what says the stream is there and names the id `camera_release_stream` takes; that release can still fail with error 104 while something references the stream. It is absent only when the server gave the stream back before the response and the camera accepted that, which it does for a stream it allocated at a capability that requires the hardware encoder. A give-back the camera refuses leaves the stream allocated, and the response then names it like any other, so the field always describes what is on the camera rather than what the call intended. A stream the call adopted is always named, whatever capability it was allocated at, because the call gives nothing back for it. The call captures from a snapshot stream the camera already has, whoever allocated it, whenever one fits the request's own bounds and is no smaller than the capability it would otherwise allocate; allocating a stream per call is what the cluster asks controllers to avoid. A stream it does allocate is left in place for the next call, unless its capability requires the hardware encoder — such a stream holds one of `max_concurrent_encoders` for as long as it exists, so on a camera with one encoder keeping it would make the next call fail with error 103 and block video allocation, and that one is deallocated again before the response is sent. A stream left in place shows under `camera_get_capabilities`'s `allocated.snapshot` and `camera_release_stream` frees it, both of which read what the camera reports: on a camera that never reports its allocated snapshot streams the stream is there but neither command can name it. At most one such stream exists per snapshot capability, because `SnapshotStreamAllocate` answers a matching request with the id it already issued.

**camera_release_stream** - Deallocate a stream nothing references

```json
{
  "message_id": "1",
  "command": "camera_release_stream",
  "args": {
    "node_id": 1,
    "endpoint_id": 1,
    "kind": "video",
    "stream_id": 1
  }
}
```

`kind` is `"video"`, `"audio"` or `"snapshot"`. `stream_id` is the `stream_id` a `camera_start_stream` response carried for that track, or a `video_stream_id` / `audio_stream_id` / `snapshot_stream_id` from `camera_get_capabilities`. The stream need not be one this server allocated: the cluster protects a stream by its reference count and by the `Internal` stream usage, not by who created it, so the command forwards to the camera and reports what it answers. Error 104, on the reference count the server last read, is the only refusal about the stream the server makes itself; a missing AV Stream Management cluster is still 106 and a malformed argument still 8. An id the camera does not know, or a video or audio stream marked `Internal`, comes back as the device's own error.

Response: `{ "released": true }`. Fails with 104 while a listener still references the stream.

### Vendor Information

**get_vendor_names** - Get vendor names by ID

```json
{
  "message_id": "1",
  "command": "get_vendor_names",
  "args": {
    "filter_vendors": [4874, 65521]
  }
}
```

### Test Nodes

**import_test_node** - Import test node(s) from a diagnostic dump

Import nodes from Home Assistant diagnostic dumps for testing purposes. Test nodes have node IDs >= 0xFFFFFFFE00000000.

```json
{
  "message_id": "1",
  "command": "import_test_node",
  "args": {
    "dump": "{\"data\":{\"node\":{...}}}"
  }
}
```

## HTTP Endpoints

Some functionality is exposed over plain HTTP instead of the WebSocket command channel,
served by the same listener/port as `/ws`.

**POST /ota-upload/&lt;upload_id&gt;** *(schema 13+)* - Store a local `.ota` firmware file in the OTA image store

Uploading is a two-step process. First call the `initiate_ota_upload` WebSocket command (see
Firmware Updates above) to reserve an `upload_id`; this also claims one of the server's limited
in-flight upload slots, so the POST must follow within `expires_in` seconds. Then POST the raw
`.ota` file bytes (no base64/JSON envelope) to that id. The id is single-use, only accepted from
the client that reserved it, and is discarded once the POST is received, whether the upload
succeeds or fails. The image is stored by vendor ID / product ID / software version parsed from
its header, not tied to any particular node — `check_node_update` will surface it for any node
whose vendor/product matches. The endpoint exists only while OTA support is enabled; with
`--disable-ota` it is not registered at all.

A *test* image (typically vendor ID `0xfff1`) is stored like any other, but the OTA provider only
serves test images when the server also runs with `--enable-test-net-dcl` — the same restriction
that applies to `--ota-provider-dir`.

```
POST /ota-upload/3f9a1c2e8b7d4a10f6c9e0b2d4a17853
Content-Type: application/octet-stream

<raw .ota file bytes>
```

Responses:

- `200` with a JSON body matching the `MatterSoftwareVersion` shape (see `update_node`/
  `check_node_update` above) on success.
- `400` with `{ "error_code": number, "message": string }` on a corrupt image, an unknown/
  expired/already-used upload id, or disabled OTA support (`error_code` 101, `OtaUploadError` —
  see Error Codes below).
- `404` with `{ "error": string }` if the path doesn't carry a well-formed upload id.
- `405` with an `Allow: POST` header for any other method.
- `413` with `{ "error": string }` if the upload exceeds the server's size limit
  (`--ota-upload-max-size-mb`, default 64 MB). The remaining body is not read; the connection is
  closed with the response.
- `503` with `{ "error": string }` while the server is shutting down.

## Events

Events are sent to clients that have called `start_listening`. Events have this format:

```json
{
  "event": "event_name",
  "data": { ... }
}
```

### Node Events

**node_added** - A new node was commissioned or imported

```json
{
  "event": "node_added",
  "data": {
    "node_id": 1,
    "date_commissioned": "2024-01-01T00:00:00.000000",
    "last_interview": "2024-01-01T12:00:00.000000",
    "interview_version": 6,
    "available": true,
    "is_bridge": false,
    "attributes": { ... },
    "attribute_subscriptions": []
  }
}
```

**node_updated** - A node's structure or availability changed

```json
{
  "event": "node_updated",
  "data": { ... }
}
```

**node_removed** - A node was decommissioned

```json
{
  "event": "node_removed",
  "data": 1
}
```

### Attribute Events

**attribute_updated** - An attribute value changed

```json
{
  "event": "attribute_updated",
  "data": [1, "1/6/0", true]
}
```

Format: `[node_id, "endpoint/cluster/attribute", value]`

### Endpoint Events

**endpoint_added** - An endpoint was added to a node (bridges)

```json
{
  "event": "endpoint_added",
  "data": {
    "node_id": 1,
    "endpoint_id": 3
  }
}
```

**endpoint_removed** - An endpoint was removed from a node

```json
{
  "event": "endpoint_removed",
  "data": {
    "node_id": 1,
    "endpoint_id": 3
  }
}
```

### Matter Events

**node_event** - A Matter event occurred (e.g., button press, switch position)

```json
{
  "event": "node_event",
  "data": {
    "node_id": 1,
    "endpoint_id": 1,
    "cluster_id": 59,
    "event_id": 1,
    "event_number": 12345,
    "priority": 1,
    "timestamp": 1704067200000,
    "timestamp_type": 1,
    "data": { "newPosition": 1 }
  }
}
```

### Server Events

**server_info_updated** - Server configuration changed (e.g., credentials set)

```json
{
  "event": "server_info_updated",
  "data": {
    "fabric_id": 1234567890,
    "compressed_fabric_id": 9876543210,
    "schema_version": 14,
    "min_supported_schema_version": 11,
    "sdk_version": "matter-server/1.1.7 (matter.js/0.17.5-alpha)",
    "wifi_credentials_set": true,
    "thread_credentials_set": true,
    "bluetooth_enabled": true
  }
}
```

**server_shutdown** - Server is shutting down

```json
{
  "event": "server_shutdown",
  "data": {}
}
```

**thread_diagnostics_updated** - A Thread network's diagnostics batch changed (schema 12)

Streamed as diagnostics are collected from Border Routers. On first collection for a network the
batch arrives incomplete and is refined over the ~20 s window (a `partialReason` marks incomplete /
failed batches; it is absent once complete). **Delivered only to connections that have issued a
Thread request** (`get_thread_diagnostics` / `get_thread_border_routers`) during their lifetime, so
older clients that don't understand the event never receive it.

```json
{
  "event": "thread_diagnostics_updated",
  "data": {
    "extPanIdHex": "1122334455667788",
    "networkName": "MyThreadNet",
    "collectedAt": 1730000000000,
    "source": "meshcop",
    "nodes": [],
    "partialReason": "in_progress"
  }
}
```

**network_topology_updated** *(schema 13+)* - The derived network graph changed

Carries the same `NetworkTopology` payload as `get_network_topology`, debounced and latest-wins
coalesced, plus a slow periodic refresh so sleepy-device drift is eventually reflected.
**Delivered only to connections that have issued `get_network_topology`** during their lifetime, so
pre-schema-13 clients never receive it.

## Attribute Path Format

Attribute paths use the format: `endpoint/cluster/attribute`

- `1/6/0` - Endpoint 1, OnOff cluster (6), OnOff attribute (0)
- `0/40/1` - Endpoint 0, BasicInformation cluster (40), VendorName attribute (1)
- `*/6/*` - All endpoints, OnOff cluster, all attributes (wildcard)

## Common Cluster IDs

| Cluster | ID | Description |
|---------|-----|-------------|
| Identify | 3 | Identify device |
| Groups | 4 | Group membership |
| OnOff | 6 | On/Off control |
| LevelControl | 8 | Dimming/level |
| Descriptor | 29 | Endpoint descriptor |
| BasicInformation | 40 | Device information |
| OtaSoftwareUpdateRequestor | 42 | OTA updates |
| ColorControl | 768 | Color/temperature |
| DoorLock | 257 | Door locks |
| WindowCovering | 258 | Blinds/shades |
| Thermostat | 513 | HVAC control |

## Schema Version

The current schema version is **14** (minimum supported **11**). Commands and events added in the current schema are marked **(schema 14+)** below; see [the schema changelog](websocket-api-schema-changelog.md) for what each version added. The server reports `schema_version` and `min_supported_schema_version` in the initial connection message and via `server_info`. Clients should verify that the server's `schema_version` is within their supported range.

## BigInt Handling

Node IDs and some other fields (e.g., `fabric_id`, `compressed_fabric_id`, `event_number`, `timestamp`) may be BigInt values that exceed `Number.MAX_SAFE_INTEGER`. The server uses a custom JSON serializer that:

- Serializes BigInt values as unquoted numbers in JSON (e.g., `18446744069414584320` instead of `"18446744069414584320"`)
- Because JSON has only a single numeric literal type, clients must use a parser or configuration that preserves large integer literals (or field-aware handling for known ID/counter fields) rather than relying on a drop-in `JSON.parse` replacement
- Standard JSON parsing that eagerly maps all numbers to IEEE-754 doubles may silently lose precision for these values instead of throwing an error; avoid using such parsers for Matter IDs and counters
- Non-JavaScript clients should use JSON parsing options/libraries that can keep large integers as big-integer types for these fields (for example: Python's `json` with custom decoders, Java's `BigInteger`-aware parsers, or Go's `encoding/json` with `UseNumber` combined with `math/big.Int`)
- The `@matter-server/ws-client` package handles this automatically

## Error Codes

Error codes match the [Python Matter Server](https://github.com/home-assistant-libs/python-matter-server) for API compatibility.

| Code | Name | Description |
|------|------|-------------|
| 0 | UnknownError | Generic/unknown error |
| 1 | NodeCommissionFailed | Node commissioning failed |
| 2 | NodeInterviewFailed | Node interview failed |
| 3 | NodeNotReady | Node is not ready (offline or not yet interviewed) |
| 4 | NodeNotResolving | Node not resolving (CASE session establishment failed) |
| 5 | NodeNotExists | Node does not exist |
| 6 | VersionMismatch | SDK version mismatch |
| 7 | SDKStackError | SDK/Stack error |
| 8 | InvalidArguments | Invalid command arguments |
| 9 | InvalidCommand | Invalid/unknown command |
| 10 | UpdateCheckError | OTA update check failed |
| 11 | UpdateError | OTA update failed |
| 100 | IcdMultiAdmin | OHF extension (not in Python Matter Server). ICD registration rejected because other-vendor administrator fabrics may not support LIT. `details` is a JSON string: `{"message": string, "admin_vendor_ids": number[]}` |
| 101 | OtaUploadError | OHF extension (not in Python Matter Server). `initiate_ota_upload` or `POST /ota-upload/<upload_id>` failed: corrupt image, unknown/expired/already-used upload id, disabled OTA support, or store failure |
| 102 | CameraStreamIncompatible | OHF extension. No codec or stream range suits both the camera and the caller. `details` is a JSON string: `{"message": string, "reason": "codec" \| "bounds" \| "capability", "track"?: "video" \| "audio", "device": string[], "requested": string[], "bound"?: {"field": string, "requested": string, "limit": string}, "device_status"?: number}`. `track` names which `camera_start_stream` track the failure is about, and is absent when the failure is about the request as a whole or about a command that resolves no track. `codec` means the codec lists do not overlap and `bounds` that the requested range cannot be served; both can be fixed by asking for something else. `capability` covers two different cases, which `track` tells apart. First, a track the caller asked for cannot exist: the camera states no capability of that kind, or the offer rejects that media section — no different request can succeed. `track` is `"video"` or `"audio"` there, and `requested` carries the caller's own codec list for that track, which is empty when it stated none. Second, a `camera_start_stream` request left both tracks out: `video: false` with `audio: false`, or one track declined while the other was left to the server and could not be resolved. That case carries no `track`, reports `device` and `requested` both empty, and is fixed by asking for at least one track. `device`/`requested` are codec names otherwise — `requested` is the codec the request resolved to, which is the caller's own choice when it stated one. `bound` names the single caller bound the server ruled out before asking the device, and only `camera_start_stream` reports it; a `camera_snapshot` ceiling that excludes every capability answers `reason: "bounds"` without it. `bound.field` is the hint key in the spelling `camera_start_stream` takes it back in: `min_resolution`, `min_frame_rate` or `min_bit_rate` under `video`, `sample_rate` or `channel_count` under `audio`. `bound.requested` is the value the caller stated and `bound.limit` what it ran into — the ceiling in force after every narrowing, or the set of values the device lists when it answers with a set, such as for `sample_rate`. An offer's `a=fmtp` limits narrow only the codec that stated them, so the same offer can produce a different `bound.limit` for a different codec. `device_status` is the Matter status a device rejection answered with. A caller that asks for audio and gets none can also see error 103 (capacity), error 7 (`SDKStackError`, the device answered with no stream id), or error 0 (`UnknownError`, an unrecognized device status) instead of this code |
| 103 | CameraResourceExhausted | OHF extension. The camera refused the allocation for lack of capacity — it answered `ResourceExhausted` and the allocation ladder found nothing else to try. `ResourceExhausted` is all the camera states; which resource ran out is not part of it, so the message names none. `details` is a JSON string: `{"message": string, "allocated": [{"kind": "video" \| "audio" \| "snapshot", "stream_id": number, "reference_count": number}], "max_concurrent_encoders"?: number, "max_encoded_pixel_rate"?: number}`; the two limits are the camera's own attributes, reported whatever kind was refused and only when the camera states them. `allocated` lists the streams that hold the capacity, which is not always the kind that was asked for: a refused snapshot reports the video streams, because a referenced video stream is what holds an encoder, while a refused audio allocation reports the audio streams |
| 104 | CameraStreamInUse | OHF extension. `camera_release_stream` targeted a stream a listener still references. `details` is a JSON string: `{"message": string, "stream_id": number, "reference_count": number}`. It is the only refusal about the stream the server makes on its own; every other outcome about the stream is the camera's answer forwarded |
| 106 | CameraNotSupported | OHF extension. `camera_start_stream` requires both the AV Stream Management cluster and the WebRTC Provider cluster, and raises this when either is missing. `camera_get_capabilities`, `camera_snapshot` and `camera_release_stream` check only the AV Stream Management cluster, so a camera missing just the WebRTC Provider cluster still answers those three normally. `details` is a JSON string: `{"message": string, "missing_clusters": number[]}`; `missing_clusters` names the cluster ids that are absent, so one entry means the other cluster is there |

## Python Matter Server Compatibility

This API is designed to be compatible with the [Python Matter Server](https://github.com/home-assistant-libs/python-matter-server) WebSocket API.

### Stub Commands

| Command | Status | Notes |
|---------|--------|-------|
| `subscribe_attribute` | Stub | Not implemented (Matter.js handles subscriptions internally) |

### Matter.js-Only Commands

These commands are available only in the Matter.js server and not in the Python Matter Server:

| Command | Description |
|---------|-------------|
| `get_loglevel` | Get current console and file log levels |
| `set_loglevel` | Temporarily change log levels (resets on restart) |
| `get_icd_state` | Get ICD Check-In state for a node |
| `register_icd` | Register this controller as an ICD Check-In client |
| `unregister_icd` | Drop this controller's ICD Check-In registration |
| `resync_icd` | Drop the local ICD registration and reconnect |
| `get_network_topology` | Return the Thread/Wi-Fi network as a graph (schema 13+) |
| `initiate_ota_upload` | Reserve an id for the `POST /ota-upload/<upload_id>` HTTP endpoint (schema 13+) |
| `camera_get_capabilities` | Report a camera endpoint's stated capabilities and current stream allocations (schema 14+) |
| `camera_start_stream` | Allocate or reuse a video/audio stream and open a WebRTC session on it (schema 14+) |
| `camera_stop_stream` | End a WebRTC session started that way, keeping the stream allocation (schema 14+) |
| `camera_snapshot` | Capture one still frame from a camera endpoint (schema 14+) |
| `camera_release_stream` | Deallocate a stream nothing references (schema 14+) |

### Data Differences

| Field | Python | Matter.js |
|-------|--------|-----------|
| `MatterNode.attribute_subscriptions` | Tracks per-node subscriptions | Always empty array |
| Test node IDs | `>= 900000` | `>= 0xFFFF_FFFE_0000_0000` |

### Behavioral Differences

- **Fabric Label**: `set_default_fabric_label` with null/empty resets to "Home" instead of clearing
- **Attribute Subscriptions**: All attributes are subscribed automatically; the `attribute_subscriptions` field is not used
- **Test Nodes**: Use high bigint range to prevent collision with real Matter node IDs
