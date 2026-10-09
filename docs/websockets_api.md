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

`args` may be left out, or sent as `null`, and means an empty argument set either way: a command whose
arguments are all optional answers such a request, and a command with a required argument refuses it
the way it refuses that argument being absent. An `args` that is anything else than a JSON object — a
string, a number, a boolean or an array — is refused with error 8 (`InvalidArguments`) naming the
command.

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

Response includes pairing codes and, *(Matter.js only)*, the window's structured fields, so a client can hand the window to another ecosystem without decoding the QR code. `discriminator` is the long (12-bit) discriminator the device advertises while the window is open, `commissioning_timeout` is the window duration in seconds. Detect these fields by their presence, not by `schema_version`. The `discriminator` request argument is ignored; a random discriminator is used:
```json
{
  "message_id": "1",
  "result": {
    "setup_pin_code": 12345678,
    "setup_manual_code": "35325335079",
    "setup_qr_code": "MT:Y.ABCDEFG123456789",
    "discriminator": 3840,
    "vendor_id": 65521,
    "product_id": 32768,
    "commissioning_timeout": 300
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

Response: one entry for the path written, `[{ "Path": { ... }, "Status": 0 }]`. `Status` is the write
status where one was returned; a write to an imported test node and a write matter.js resolves from its
own cache both report `0` without a device having answered.

A `node_id` in the Group Node ID range multicasts the write to the group. The endpoint must then be the
wildcard — `"*/6/16385"` — because a groupcast carries no endpoint: each node's own group table decides
which of its endpoints the write reaches. The response is `null`, not a status list: a group write is
sent with the response suppressed, so no node answers and there is no status to report. Nothing reports
back, so a groupcast write that every node rejects — a read-only attribute, an attribute none of them
has — is answered exactly like one they all applied. A wildcard cluster or attribute is refused for a
group as it is for a node.

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

A `node_id` in the Group Node ID range multicasts the command to the group. `endpoint_id` must then be
absent or `null`, because a groupcast carries no endpoint: each node's own group table decides which of
its endpoints the command reaches. The response is `null`: a group invoke is sent with the response
suppressed, so no node answers. `timed_request_timeout_ms` and `interaction_timeout_ms` are both refused
for a group — there is no response to wait for — and so is a command the specification requires to be
invoked as a timed request, which a groupcast cannot carry.

Whether a groupcast leaves this server also depends on a group key set existing for the group on the
controller's fabric. This server has no command to provision one yet, so a groupcast to a group that was
never keyed fails with error 0 and a message naming the group.

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

The camera API is a convenience API: seven `camera_*` commands and two events, `camera_session_ended` and `camera_stream_evicted` (see [Server Events](#server-events)). It manages the camera's streams for the client — allocation, reuse, eviction and release — and handles the WebRTC session. The server computes the `VideoStreamAllocate` envelope, works through the device's rejections and tracks each WebRTC session.

The official Matter commands stay available for a client that wants to do this work itself: `send_webrtc_provider_command` (below) for the WebRTC Provider commands, and `device_command` with the cluster's own commands.

Each command below starts with the **minimal request** — the arguments it needs and what it gives back when nothing else is stated. Where a command has optional arguments, a **More control** part follows with a table of them. The detailed rules come last, under a **details** heading. A client that only needs the minimal request can stop reading a command at its details heading.

#### Typical flow

1. *(Optional)* `camera_get_capabilities`: check `features` and `privacy`, and see which codecs the camera states and what is already allocated on it.
2. Register a handler for the `webrtc_callback` event **before** the next step. The camera's answer can arrive before the response to `camera_start_stream` (see [Signalling](#camera_start_stream)).
3. `camera_start_stream` with `stream_usage` and your SDP offer in `sdp`. The server picks or allocates the streams and sends `ProvideOffer`. The response names the session in `webrtc_session_id`.
4. Complete the WebRTC connection. Apply the camera's `answer` from `webrtc_callback`, add the camera's candidates from its `ice_candidates` events, and send your own with `camera_provide_ice_candidates`. If you sent no `sdp`, the camera sends an `offer` event instead, and you answer it with `camera_provide_answer`.
5. `camera_stop_stream` ends the session. The streams stay allocated, so the next `camera_start_stream` can reuse them without a new allocation.
6. *(Optional)* `camera_release_stream` frees a stream you no longer need.

`camera_snapshot` stands on its own: it needs no session and no signalling.

#### Drive a session with the camera commands only

**A session opened with `camera_start_stream` is driven with the `camera_*` commands until it ends:**

- `camera_provide_answer` and `camera_provide_ice_candidates` send the client's half of the signalling.
- `camera_stop_stream` ends the session.

Do not use `send_webrtc_provider_command` or `device_command` `EndSession` for such a session. The server keeps a record of each session it opens — which connection receives its signalling, which streams it holds, and that it is ended exactly once — and only the `camera_*` commands keep that record correct.

- Each of these commands takes `node_id`, `endpoint_id` and `webrtc_session_id` in the spelling the rest of this API uses. A client never needs a cluster field name or the raw route in the middle of a session.
- One exception: a re-offer. An ICE restart, or a change to the tracks of a live session, goes through `send_webrtc_provider_command` with `ProvideOffer`, because `camera_start_stream` always opens a new session (see **Re-offers** under `camera_start_stream`). The session stays the server's for teardown.
- `device_command` `EndSession` still drops the server's records for the session (see `camera_stop_stream`). But it does not share the one `EndSession` the other paths send, and if the camera no longer holds the session it fails with the camera's error instead of returning `ended: false`.

#### camera_get_capabilities

Report what the camera states, and what is allocated on it. It allocates nothing. It takes only `node_id` and `endpoint_id`.

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

The response has:

- `features` and `privacy`: what the camera can do, and whether it will do it right now.
- Four capability groups: `video`, `audio`, `snapshot`, `limits`.
- `allocated` and `sessions`: what is on the camera now.

Optional fields are absent when the camera states nothing for them. The values a later request can send back are listed under [Names](#names).

##### camera_get_capabilities details

`features` is an array of the AVSM features the camera advertises in its `FeatureMap`, spelled as the specification's Feature column spells them: `Audio`, `Video`, `Snapshot`, `Privacy`, `Speaker`, `ImageControl`, `Watermark`, `OnScreenDisplay`, `LocalStorage`, `HighDynamicRange`, `NightVision`. Read this list instead of the cluster's `FeatureMap`.

- The list is in the specification's own bit order.
- A name missing from it is a kind of stream the camera does not have at all. An audio doorbell advertises `Audio` without `Video`, and its `VideoStreamAllocate` answers `UnsupportedCommand`.
- The key is **absent** while the camera has not reported its `FeatureMap`. That is not a camera that advertises nothing: at least one of `Audio`, `Video` and `Snapshot` is mandatory (§11.2.5), so a list that could not be complete is left out instead of reported short. A present list is the complete set.
- The server gates nothing on an unreported map: such a camera gets the request and answers for itself. `hdr_capable` comes from the same map, so it reads `false` in that window.
- On a camera that does not advertise a feature, `camera_start_stream` answers a **demanded** video or audio track with error 102, `reason: "feature"`, naming it in `feature`. A track the caller **left to the server** resolves to absent instead, so a caller that states no `video` key gets an audio-only session from such a camera, not an error.
- `camera_snapshot` is refused the same way on a camera that does not advertise `Snapshot`, before any capability is tried.

`privacy` reports the camera's privacy switches, which are what a camera entity's on/off state is:

| Field | Type | Meaning |
|---|---|---|
| `hard_mode_on` | boolean, optional | `HardPrivacyModeOn` (§11.2.7.22): the physical switch. Blocks every session and every snapshot |
| `soft_livestream_mode_enabled` | boolean, optional | `SoftLivestreamPrivacyModeEnabled` (§11.2.7.21). Blocks a session of stream usage `LiveView`, and every snapshot |
| `soft_recording_mode_enabled` | boolean, optional | `SoftRecordingPrivacyModeEnabled` (§11.2.7.20). Blocks a session of stream usage `Recording` or `Analysis` |

- A field is absent when the camera states no such switch. The two soft switches are gated on the `Privacy` feature and `hard_mode_on` is optional on its own, so absence means there is no switch, never that the switch is off.
- While a switch that covers the call is on, `camera_start_stream` and `camera_snapshot` fail with error 106 naming it. `camera_get_capabilities` keeps answering, because this report is how a client learns why.
- The two soft switches are writable (§11.2.7.20, §11.2.7.21). This API has no command for that; use `write_attribute` on the AV Stream Management cluster to turn one off.

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

There is no resolution list, because the camera does not state one. `codecs` is derived from `rate_distortion_points`, so a camera that states no trade-off point reports an **empty** list. That is what the camera says, not a statement that it can encode nothing: `camera_start_stream` then accepts any of `H264`, `H265`, `H266` and `AV1` and lets the device answer.

`audio`:

| Field | Type | Meaning |
|---|---|---|
| `codecs` | array of names | Microphone codecs |
| `channels` | number, optional | Largest channel count the camera accepts |
| `sample_rates` | array of numbers | Sample rates the camera accepts |
| `bit_depths` | array of numbers | Bit depths the camera accepts |
| `two_way_talk_support` | name, optional | `NotSupported`, `HalfDuplex` or `FullDuplex` |

`snapshot.capabilities` is an array of `{ resolution, max_frame_rate, image_codec, requires_encoded_pixels, requires_hardware_encoder }`. A capability takes one of the camera's encoders only when both flags are true. `requires_hardware_encoder` is always present as a boolean: the underlying Matter field is optional, and a camera that leaves it unstated is reported as `false`.

`limits`:

| Field | Type | Meaning |
|---|---|---|
| `max_encoded_pixel_rate` | number, optional | Pixel-rate budget across all streams |
| `max_concurrent_encoders` | number, optional | How many encoders the camera has |
| `max_network_bandwidth` | number, optional | Bits per second; the server caps a stream's `max_bit_rate` at it |
| `supported_stream_usages` | array of names | Usages the camera accepts |
| `stream_usage_priorities` | array of names | The camera's own ordering of them |

`allocated` lists what is on the camera now, per kind:

| Group | Fields |
|---|---|
| `allocated.video[]` | `video_stream_id`, `stream_usage`, `video_codec`, `min_resolution`, `max_resolution`, `min_frame_rate`, `max_frame_rate`, `min_bit_rate`, `max_bit_rate`, `reference_count`, `allocated_by_server`, `watermark_enabled`, `osd_enabled` |
| `allocated.audio[]` | `audio_stream_id`, `stream_usage`, `audio_codec`, `channel_count`, `sample_rate`, `bit_rate`, `bit_depth`, `reference_count`, `allocated_by_server` |
| `allocated.snapshot[]` | `snapshot_stream_id`, `image_codec`, `min_resolution`, `max_resolution`, `reference_count`, `allocated_by_server`, `frame_rate`, `encoded_pixels`, `hardware_encoder`, `watermark_enabled`, `osd_enabled` |

- `reference_count` is the device's own count of listeners.
- `allocated_by_server` says this server allocated the stream during its current run. It decides whether the server may deallocate the stream unasked. It is not a precondition for `camera_release_stream`, and it is `false` again after a server restart. It is this server's own record, not something the camera confirms. A camera that reports its allocations late, or never, can reuse a stream id this server still has recorded as its own. The flag is then `true` for a stream another controller allocated.
- `encoded_pixels` on a snapshot stream is the camera's statement that the stream counts towards `max_encoded_pixel_rate` (spec §11.2.6.13.8). It reserves `max_resolution` times `frame_rate` of that budget. The server subtracts those reservations, and every allocated video stream's `max_resolution` times `max_frame_rate`, from `max_encoded_pixel_rate` before it asks for a video stream (see **The encoder budget** under `camera_start_stream`). A client doing its own budgeting can compute the same figure.
- `hardware_encoder` on a snapshot stream is the camera's statement that the stream uses one of its `max_concurrent_encoders`. Such a stream holds that encoder for as long as it exists, whatever its `reference_count` says. It is what a client releases when `camera_start_stream` or `camera_snapshot` answers error 103, and error 103's `allocated` names it for that reason. The server counts it when choosing a snapshot capability, and `camera_start_stream` may take it under the rules in **Making room** under `camera_start_stream`.
- `watermark_enabled` and `osd_enabled` are the camera's statement of which overlays it draws on that stream: a manufacturer watermark (spec §11.2.5.7), and text such as date, time and device name (spec §11.2.5.8). Both are always present as booleans. `false` means the camera states no such overlay for that stream; a camera advertising neither `Watermark` nor `OnScreenDisplay` in `features` states that for every stream, since it has none to draw. How these flags affect reuse is described under **The overlays** in `camera_start_stream`. For a snapshot stream this field is the final answer, not the request. At a capability whose `requires_hardware_encoder` is false, the camera may ignore what `camera_snapshot` asked for and copy the source video stream's setting (spec §11.2.8.8.6). Read the result here; do not assume the request was honoured.

`sessions` lists the WebRTC sessions the camera itself holds, read from its `CurrentSessions` attribute:

| Group | Fields |
|---|---|
| `sessions[]` | `webrtc_session_id`, `peer_node_id`, `peer_endpoint_id`, `stream_usage`, `video_stream_ids`, `audio_stream_ids`, `established_by_this_server` |

- This list, not this server's own tracking, is what holds a `reference_count` above zero.
- It is the only place to learn a session id after this server restarted. The server tracks sessions in memory, so a restart loses them, while the camera keeps holding them. Only `EndSession` decrements a stream's reference count.
- A session listed here can be ended with `camera_stop_stream` whether or not this server established it in its current run. The stream it pins can then be released.
- The attribute is fabric-sensitive, so only sessions on this server's own fabric appear.
- Within the fabric, `established_by_this_server` says the camera recorded this server as the session's peer. That is exactly when `camera_stop_stream` can end it: a camera answers `NOT_FOUND` for any other peer's session.
- A session another controller on the fabric holds is still listed, because it explains a reference count this server cannot free.

#### camera_start_stream

Allocate or reuse a stream and open a WebRTC session on it.

##### Minimal request

Required: `node_id`, `endpoint_id` and `stream_usage` — the same data the Matter `ProvideOffer` command takes, without the stream ids: the server chooses those. `stream_usage` is `LiveView`, `Recording` or `Analysis` (not `Internal`). Send your SDP offer in `sdp` as well: without it the server sends `SolicitOffer` and the camera writes the offer (see below).

```json
{
  "message_id": "1",
  "command": "camera_start_stream",
  "args": {
    "node_id": 1,
    "endpoint_id": 1,
    "stream_usage": "LiveView",
    "sdp": "v=0\r\n..."
  }
}
```

What the client gets: the best video stream the camera can serve, within what the offer can decode and within the camera's free encoder capacity, and an audio stream if one can be served.

- **Video.** The codec is the first one the camera states that the offer can decode. The resolution goes up to the sensor size, cut to the decode ceiling in the offer's `a=fmtp` lines. A browser's offer (H.264 level 3.1) therefore gets at most 1280x720. The frame rate is one value, not a range: the highest the offer can decode at that size, up to `max_fps`. The bit rate is capped at the offer's bit-rate ceiling (`max-br`, or the level's) and at the camera's `max_network_bandwidth`, and at 8000000 bit/s when neither states one. The key frame interval is 4000 ms. No overlay is asked for.
- **Retries.** A camera can refuse a request that is inside every limit it publishes. The server then retries with smaller requests (see **Retries** below).
- **Capacity.** A stream already on the camera that fits is reused. A new stream is sized to the camera's free encoder capacity, and frame size is given up before frame rate. When the camera is full, the server may deallocate a stream nothing references, possibly another controller's (`allow_eviction`, below).
- **Audio.** The first microphone codec the offer can receive, with the camera's largest channel count, its highest sample rate and bit depth, and 64000 bit/s. If no audio stream can be served, `audio` is `null` and the session still opens.
- **Without `sdp`.** The server sends `SolicitOffer`. No offer bounds the stream, so only the camera and its encoder capacity do. The camera's offer arrives as a `webrtc_callback` `offer` event; answer it with `camera_provide_answer`.

**Response:** `{ webrtc_session_id, mode, video, audio }`. `mode` is `"provide_offer"` or `"solicit_offer"`. Each of `video` and `audio` is the stream the session carries, with `stream_id`, `codec` and the allocated values, or `null` (all fields are listed under **Response fields** below).

**Signalling.** The camera's half of the signalling arrives on the `webrtc_callback` ([Server Events](#server-events)) event. For a session opened with this command it reaches the connection that opened it and no other. `mode` says what the client owes next:

- After `"provide_offer"` the camera answers with an `answer` event, and the client only trickles candidates with `camera_provide_ice_candidates`.
- After `"solicit_offer"` the camera sends an `offer` event, and the client owes the SDP answer through `camera_provide_answer`.

**Signalling can arrive before this response.** The server applies the `webrtc_callback` opt-in before it dispatches the command, because the camera answers the offer while `camera_start_stream` is still in flight. For `mode: "provide_offer"`, the camera's `answer` and its first ICE candidates can reach the connection before the response frame carrying `webrtc_session_id`. A client that installs its handlers keyed on the id from the response drops them. Register the `webrtc_callback` handler before sending the command, buffer events by their own `webrtc_session_id` until the response lands, then attach the buffered ones to the session it names. There is no ordering guarantee either way — a response bypasses the outbox an event queues into — so a client must handle both orders.

##### More control

Every optional argument, stated or not:

| Argument | Type | What it controls |
|---|---|---|
| `sdp` | string, optional | The offer; absent means `SolicitOffer`. Its media sections decide talkback and which tracks can be carried, and its `a=fmtp` lines bound the stream. See **The offer's media sections** and **The offer's decode ceiling** below |
| `video` | object or `false` | Left out: the server decides. An object of range hints: hard bounds the stream must meet. `false`: no video track |
| `audio` | object or `false` | Left out: the server decides. An object of exact-value hints: hard requirements. `false`: no audio track |
| `ice_servers` | array of objects, optional | ICE servers for the session; limits below |
| `ice_transport_policy` | string, optional | Passed to the WebRTC session setup unchanged. Length 1 to 16: `ProvideOffer`'s `ICETransportPolicy` field states the ceiling of 16, and this server refuses an empty string. Anything else is error 8 before the camera is asked |
| `metadata_enabled` | boolean, optional | Passed to the WebRTC session setup; absent is `false` |
| `allow_eviction` | boolean, optional | Whether the server may deallocate a stream nothing references to serve this request. Absent is `true`; `false` skips that step. See **Making room** below |

`video` hints are **ranges**:

| Key | What it controls |
|---|---|
| `codecs` | Acceptable codecs, in order of preference. The caller's order wins over the camera's |
| `min_resolution`, `max_resolution` | Frame-size floor and ceiling |
| `min_frame_rate`, `max_frame_rate` | Frame-rate floor and ceiling. The server still asks for one frame rate, the highest these allow; the floor is how low a retry or the encoder budget may go |
| `min_bit_rate`, `max_bit_rate` | Bit-rate floor and ceiling |
| `watermark_enabled`, `osd_enabled` | Whether the camera burns in its watermark or a date/time/name banner. See **The overlays** below |

`audio` hints are **exact values**, not ranges:

| Key | What it controls |
|---|---|
| `codecs` | Acceptable codecs |
| `channel_count` | Channel count, at most `audio.channels` from `camera_get_capabilities` |
| `sample_rate` | Sample rate, one of `audio.sample_rates` |
| `bit_rate` | Bit rate |

A request using most of them:

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
    "metadata_enabled": false,
    "allow_eviction": true
  }
}
```

The server never goes outside a limit the caller sets, and never swaps a codec. If no stream fits the stated limits, the call fails with error 102. `min_resolution == max_resolution` pins an exact value and reserves that capacity against every other client sharing the camera (spec §11.2.1.2.2). Leave a bound unset unless you need an exact value.

##### camera_start_stream details

**Track statements.** `video` and `audio` each make one of three statements, and both keys work the same way:

- **Present with an object** (`{}` included) asks for the track. If it cannot be resolved, the call fails with the error that says why; the response never answers `null` for it.
- **`false`** declines the track.
- **Left out** leaves the track to the server. `audio` then reports `null` for any reason no audio stream could be resolved. `video` reports `null` only when the camera does not advertise `Video` (see `features`), when the offer rejects the video section or states a direction that will not receive it (`a=sendonly`, `a=inactive`), or when the offer carries no video section at all. A camera that refuses a video allocation still fails the call, since video is what the session is for.

A track that was asked for and could not be resolved fails with:

- error 102 when the camera, the offer or the request rules the track out; `reason` says which;
- error 103 when the camera refused the allocation for lack of capacity;
- error 7 (`SDKStackError`) when the device accepts the allocation but never returns a stream id;
- error 0 (`UnknownError`) for a device status the allocation ladder does not recognize — anything other than `DynamicConstraintError`, `ResourceExhausted` or `ConstraintError`.

A request that leaves nothing for the offer to carry fails with error 102, `reason: "no_media"`, no `track`, and `device` and `requested` both empty; no offer with neither track is sent. That happens when:

- `video: false` and `audio: false` are both stated;
- one track is declined and the other was left to the server and could not be resolved. No microphone, no codec match, a section the offer rejects or will not receive, and a refused allocate all end there the same way.

A track the caller *asked for* that the offer refuses is `reason: "offer"` instead, naming the track. Asking for at least one track succeeds with everything else about the request unchanged.

**Hints.** The keys are listed under **More control** above.

- Any other key under either object is refused with error 8. A range hint sent at the top level instead of under `video` is refused as an unknown argument, not dropped.
- Every numeric hint must be a positive integer, the same rule a resolution's `width` and `height` follow. A negative, zero, fractional, `NaN` or infinite value is refused with error 8.
- Each is bounded by the range of the cluster field it becomes: `channel_count` 1 to 8, `min_frame_rate` and `max_frame_rate` 1 to 65535, `min_bit_rate`, `max_bit_rate`, `bit_rate` and `sample_rate` 1 to 4294967295. A value outside its range is refused with error 8 naming the field and both ends of it.
- `channel_count` has two different refusals: above 8 it is error 8; within 8 but above the `audio.channels` the camera reports it is error 102.
- A floor above its own ceiling — `min_bit_rate` above `max_bit_rate`, `min_frame_rate` above `max_frame_rate` — is a relation between two arguments, not a bound on one value. It passes these checks, and the camera refuses it.

**`ice_servers`:**

- The list takes 0 to 10 entries, the ceiling `ProvideOffer`'s `ICEServers` field states. This is separate from the URL limit per entry, so a client combining several TURN providers is refused with error 8 above ten of them.
- Each entry is `{ urls, username?, credential?, caid? }`.
- `urls` is one URL string or a list of 1 to 10 URLs, each 1 to 2000 characters.
- `username` is 1 to 508 characters, `credential` 1 to 512.
- `caid` is an integer 0 to 65534.
- The struct states the ceilings. The floor of one character is this server's: it refuses an empty string wherever the struct takes one.
- Any other key, an entry naming no URL, or a value past those limits is refused with error 8. The refusal names the field and both ends of its range.
- The server translates each entry into the cluster's `ICEServerStruct` (spec § 11.4.5.3), whose field is `URLs` and always a list.

**Debug-log masking:**

- In the offer, the `a=ice-ufrag` and `a=ice-pwd` values are masked in the server's debug log. Every other line of the offer is logged as sent.
- `username` and `credential` of each ICE server are masked in the server's debug log.
- The TypeScript client library masks the offer a `webrtc_callback` reports the same way in its console output, together with its `ice_servers` credentials.

**The offer's media sections.** Talkback is asked for in the offer:

- An audio section with `a=sendrecv` or `a=sendonly` asks for talkback. So does one stating no direction at all, which is `sendrecv` (RFC 4566 §6).
- `a=sendonly` asks for talkback and refuses the camera's audio in one statement, so such a section gets no audio stream.
- An `sdp` with no section of a kind refuses that kind as well. The answer carries exactly the m-lines of the offer it answers (RFC 3264 §6), so there is nothing to send such a track in.
- Without `sdp` the camera writes the offer itself, and no kind is refused.

**The offer's decode ceiling.** The offer's `a=fmtp` lines are read as the peer's decode ceiling, per codec, and every rung of the allocation is bound by them. Both the explicit parameters and the codec's own level are read, each under that codec's own payload format:

- H.264: `profile-level-id` (mapped through ITU-T H.264 Table A-1 MaxFS / MaxMBPS / MaxBR), plus `max-fs` and `max-mbps` in macroblocks and `max-br` in units of 1000 bits per second (RFC 6184 §8.1). `max-fr` in frames per second is read on an H.264 record as well; RFC 6184 does not define it, it is the VP8 parameter of RFC 7741 §6.1.
- H.265: `level-id` (mapped through ITU-T H.265 Table A.8 MaxLumaPs and Table A.9 MaxLumaSr), plus `max-lps` and `max-lsr` in luma samples, `max-fps` in frames per 100 seconds and `max-br` in the same units (RFC 7798 §7.1).
- Where a record states both a level and an explicit parameter, the explicit one wins: both RFCs define it as signalling a capability at or above the level's.
- A name one codec defines is never read on another codec's record.
- Every browser offers H.264 at level 3.1 with no `max-fs`, so an offer from a browser bounds the stream at 1280x720. A client that wants more offers a higher level.
- A codec whose stated decode ceiling the server cannot read is not selectable for that session. That covers a level the tables do not map — a `profile-level-id` that is not three bytes of base16, or a level value the tables do not list — and a capability parameter whose value is not a whole number, such as `max-fs=8160px`. The parameter overrides the level, so the level does not bound the codec either, and treating the parameter as absent would leave the codec unbounded.
- If that leaves no codec the camera and the peer share, the call fails with error 102 and `reason: "level"`, instead of serving a stream with no bound held against it.
- A codec that states no level and no explicit parameter is unbounded by the offer. The RFC defaults for an absent level are not applied: H.264's is Baseline level 1, and inferring it would refuse offers no peer meant to restrict.

**The encoder budget.** The server asks for a stream that fits inside `max_encoded_pixel_rate` (spec §11.2.7.2) minus what the camera's allocated streams reserve: `max_resolution` times `max_frame_rate` per video stream, plus the same for a snapshot stream whose `encoded_pixels` is set. A camera short of encoder capacity refuses a request at the sensor's maximum, and that refusal would make the server take another controller's stream.

- The budget narrows only the server's own defaults. A floor the caller stated reaches the camera unshrunk, and the camera answers, since it is the arbiter of a parameter conflict (spec §11.2.1.2.2).
- A stream already on the camera is never measured against the budget, because it already draws on it. Reuse costs nothing, however wide the stream is.

**The rung order.** The server tries, in this order:

1. Reuse a stream the camera already produces, or one this server allocated that the camera has not reported yet.
2. Allocate inside the encoder budget.
3. Retry with a smaller range when the camera refuses one (see **Retries** below).
4. Take a stream nothing references and allocate again with the freed capacity (see **Making room** below).
5. Hand out an existing stream that meets every bound the caller stated, but not the range the server computed (`degraded`).

- Smaller ranges are tried before anything is taken: the range is the server's to give up, while an idle stream is somebody's reservation. Spec §11.2.1.1 asks commissioners to pre-allocate streams and keep them.
- A stream that rung 5 could hand out — one meeting every bound the caller stated — is never taken. Destroying it and then failing would cost its holder an id for a request that very stream would have served.
- Once a stream has been taken, the server starts again from the best range the camera refused only for lack of capacity. Paying for capacity and not using it therefore cannot cost the caller picture size or frame rate.

**Retries.** Cameras accept a `VideoStreamAllocate` only when the whole requested range fits one of their internal stream profiles, and they do not publish all of a profile's limits. The Aqara G350, for example, refuses any frame rate range reaching below 30, any bit rate over 2 Mbit/s and any key frame interval other than 4000 ms, and its attributes state none of these. This is why the server always asks for one frame rate, never a range, and uses a key frame interval of 4000 ms. The spec recommends 4000 ms only for push transports; the value is used here because it is the only one this camera accepted.

- When the camera answers `DynamicConstraintError` (it cannot serve that range), the server halves the bit-rate ceiling first, up to four times, then the width and height, up to two times, and the frame rate last, up to two times. Each step keeps the earlier ones. Frame rate goes last because it is the only one of the three whose lower limit cameras do not publish. If the camera refuses a lower frame rate, the server does not go lower.
- When the camera answers `ResourceExhausted` (it has no capacity), the server first tries a smaller size, then takes a stream (see **Making room** below), and lowers the frame rate only when nothing can be taken. A lower bit rate does not free encoder capacity, so it is not tried for this.
- No step goes below a floor or above a ceiling the caller stated, or past the offer's decode ceiling.
- A request makes at most 12 allocate attempts.

**Making room (eviction).** With `allow_eviction` absent or `true`, the server may deallocate a stream nothing references:

- A video stream, whoever allocated it.
- A snapshot stream this server allocated in its current run (`allocated_by_server`), nothing references, and whose loss frees capacity the refused allocate can use: an encoder (`hardware_encoder`), or a share of `max_encoded_pixel_rate` on a camera that states one. A snapshot stream this server allocated moments ago counts even before the camera reports it. A snapshot stream another controller allocated is never taken.

Order: the server takes nothing of another controller's while it still holds an idle stream of its own that this step could take. Its own snapshot streams go first, then its own video streams, and a foreign video stream last. The camera's `stream_usage_priorities` orders each of those groups.

Reporting:

- A taken video stream comes back in the response's `video.evicted_stream_ids`.
- A taken snapshot stream is reported by the `camera_stream_evicted` event, not in `video.evicted_stream_ids`, which carries video stream ids.
- If the request then does not use the capacity a taken snapshot stream freed, the server allocates a snapshot stream of the same range back, under a new id.

`allow_eviction: false` skips this step, for a caller that must not disturb a long-lived allocation. The degraded rung still runs, so the call can still succeed with `degraded: true`; otherwise the camera's `ResourceExhausted` fails it with error 103. The flag governs this request alone: another client's request with the default still takes what it needs, and no record says which connection a stream belongs to.

**The overlays.** `video.watermark_enabled` and `video.osd_enabled` say whether the camera burns its watermark, or a date/time/name banner, into the picture.

- Both fields are mandatory on `VideoStreamAllocate` for a camera that advertises the matching feature, and forbidden for one that does not (spec §11.2.8.4, conformance `WMARK` / `OSD`). The server sends them exactly when `features` names `Watermark` / `OnScreenDisplay`.
- While the camera has not reported its `FeatureMap` (`features` absent), the server gates nothing: a flag the caller stated is sent as stated and the camera answers for itself, and a flag the caller left out is not sent.
- `true` for a feature the camera does not advertise fails with error 102, `reason: "feature"`, naming it in `feature`. `false` is accepted there, because such a camera has no overlay to apply.
- Left unset, the server asks for no overlay (`VideoStreamStruct`'s own fallback for both flags is 0).
- The server does not *reuse* a stream whose flags differ from what the request resolved to, for a camera that advertises the feature. On a camera advertising neither feature, and while `features` is absent, nothing about the overlays is compared, because there is nothing to compare against.
- Only the `degraded` rung may hand out a stream whose overlays differ, and it says so with `degraded: true`. State the field to have it honoured at every rung.
- In the response, `video.watermark_enabled` / `video.osd_enabled` are the camera's own statement for a reused or degraded stream, and what the server asked for on a freshly allocated one, which the camera accepted and applied. One exception: the cluster's deduplication may answer an allocate with the id of an existing stream whose overlays differ, because the reference implementation's dedup adjusts the range parameters only. Read `allocated.video[]` from `camera_get_capabilities` if the distinction matters.

**Response fields.**

- A track is `null` when the caller declined it with `false`, or left it out and no stream could be resolved. A track the caller asked for is never `null`: the call fails instead.
- The `webrtc_session_id` names a session that had not ended when the server recorded it. A session ended between the camera answering the offer and that record — by the camera itself, or by another connection's `camera_stop_stream` or `EndSession` for the id the camera just issued — fails the call with error 7 and gives the streams back. An id whose signalling would reach nothing is never returned.
- Any failed call deallocates the streams it allocated for the attempt. The caller never receives their ids, so it could not release them itself.

| Field | On | Meaning |
|---|---|---|
| `stream_id` | both | The id `camera_release_stream` takes for this track's `kind`. A stream this call allocated can also be found later through `camera_get_capabilities`'s matching `video_stream_id` / `audio_stream_id` |
| `codec` | both | Codec name |
| `resolution` | video | `{ min, max }`, each a resolution |
| `frame_rate` | video | `{ min, max }` |
| `bit_rate` | video | `{ min, max }` |
| `channel_count`, `sample_rate`, `bit_rate`, `bit_depth` | audio | The allocated values |
| `provenance` | both | `allocated` (this call allocated it on the camera), `reused` (already there, and this server allocated it earlier in this run) or `adopted` (already there, not allocated by this server; `camera_get_capabilities` reports it as `allocated_by_server: false`). None of the three decides whether `camera_release_stream` can free the stream: the camera decides, by reference count and by the `Internal` stream usage, never by who allocated it |
| `degraded` | video | `true` when the stream does not fit the range the server computed but meets every bound the caller stated. Always present, `false` when the stream fits. `camera_snapshot` uses the same name for the same class of decision |
| `watermark_enabled`, `osd_enabled` | video | Which overlays the stream carries; see **The overlays** above. Worth reading even when the request stated neither: unstated asks for no overlay, but the `degraded` rung may hand out a stream that has one. Both `false` for a camera advertising neither feature |
| `evicted_stream_ids` | video, optional | Video stream ids this request deallocated, whichever rung then served it. Absent when it took nothing. An id listed here may have belonged to another controller and is gone for good; that controller has to allocate again |
| `narrowed_by_encoder_budget` | video, optional | The ceilings the encoder budget lowered, as `{ "max_frame_rate"?, "max_resolution"? }`, each carrying what the server would have asked for with a free budget. See below |

`narrowed_by_encoder_budget`:

- Absent when the budget lowered nothing. Reported for a freshly allocated stream only: a reused or degraded stream carries the camera's own range, which the budget had no part in.
- `max_encoded_pixel_rate` is what the camera's encoders can produce in total, and every stream the camera holds spends it. The budget gives up frame size before frame rate, and lowers the frame rate only once the size is at its floor. `{"max_resolution": {"width": 2560, "height": 1440}}` beside a smaller `resolution.max` says another stream's reservation is the reason, not the camera's own limit.
- It is not `degraded`: the stream fits the range the server computed, and it is that range which was narrowed.
- A caller that needs a frame rate states `min_frame_rate`, which the budget may not narrow past. Freeing one of its own streams with `camera_release_stream` or `camera_stop_stream` gives the budget back.
- The ladder may narrow the range again after a device refusal, so `frame_rate.max` can be lower still. These values are the unbudgeted ceilings, not a measure of the whole gap.

**Re-offers.** An ICE restart, or a change to the tracks a live session carries, is a second `ProvideOffer` naming the existing session id (§11.5.6.3, with `WebRTCSessionID` stated instead of null). `camera_start_stream` always opens a new session, so a re-offer goes through `send_webrtc_provider_command` with `command_name: "ProvideOffer"` and the existing `webRtcSessionId` in the payload. For teardown the session stays the server's: `camera_stop_stream` still ends it, and `camera_session_ended` still reports another connection ending it.

#### camera_provide_answer

Answer the offer a camera sent. All four arguments are required.

```json
{
  "message_id": "1",
  "command": "camera_provide_answer",
  "args": {
    "node_id": 1,
    "endpoint_id": 1,
    "webrtc_session_id": 3,
    "sdp": "v=0\r\n..."
  }
}
```

The other half of a `camera_start_stream` that stated no `sdp`. The camera writes the offer and delivers it as a `webrtc_callback` `offer` event; this command sends the answer back. `webrtc_session_id` is the id that event carries, which is the one `camera_start_stream` answered with.

- `webrtc_session_id` and `sdp` are both required. A missing one is error 8 naming `camera_provide_answer`.
- Both are checked against the cluster's `ProvideAnswer` definition before the camera is asked: the id against its field's range — a uint16, so 0 to 65535 — and `sdp` for being a string (the field states no length).
- The id does not have to be one this server established in its current run, for the same reason as for `camera_stop_stream`: the camera holds the session and decides. It answers `NOT_FOUND` for anything that is not its own session with this server on this fabric.
- The sending connection does not have to be the one that opened the session. Session ownership decides which `webrtc_callback` events a connection receives, not which commands it may send.

Response: `null`. The cluster defines no response payload for `ProvideAnswer`. A session id the camera cannot resolve to one of its own comes back as the camera's own error.

#### camera_provide_ice_candidates

Trickle ICE candidates into a session. All four arguments are required.

```json
{
  "message_id": "1",
  "command": "camera_provide_ice_candidates",
  "args": {
    "node_id": 1,
    "endpoint_id": 1,
    "webrtc_session_id": 3,
    "ice_candidates": [{ "candidate": "candidate:1 1 UDP 2130706431 192.0.2.1 50000 typ host", "sdpMid": "0", "sdpMLineIndex": 0 }]
  }
}
```

- An entry is `{ candidate, sdpMid, sdpMLineIndex }`, the W3C `RTCIceCandidateInit` spelling a `webrtc_callback` `ice_candidates` event reports. A candidate read from that event goes back unchanged.
- `sdpMid` and `sdpMLineIndex` are stated on every entry and may be `null`.
- The list takes at least one entry, the floor `ProvideIceCandidates`' own field states.
- `webrtc_session_id` and the sending connection follow the same rules as for `camera_provide_answer`.

Without trickled candidates a camera learns its peer's addresses from the initial SDP alone. That can decide whether a session connects through a relay after the first round or does not connect at all.

Response: `null`, as for `camera_provide_answer`.

#### camera_stop_stream

End the WebRTC session and keep the allocation. All three arguments are required.

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

Response: `{ "ended": true }`. The session's streams stay allocated, so a later `camera_start_stream` can reuse them; `camera_release_stream` frees them.

- `webrtc_session_id` is a uint16, so an integer 0 to 65535. A value outside that names no session the camera can have and is refused with error 8, not answered as an unknown session.
- The id does not have to be one this server established in its current run. A session `camera_get_capabilities` lists can be ended too. That is the way back after an ungraceful restart: the server's own tracking is gone, the camera still holds the session, and its streams stay pinned at `reference_count` above zero until it is ended.
- The camera checks the server, not the WebSocket connection: any connection can end any session this server holds on that camera, including one another connection started.
- There is one `EndSession` per session, however many paths reach it. A closing connection and the shutdown pass end the sessions they own. A `camera_stop_stream` naming a session one of them is already ending waits on that same invoke and reports its outcome.
- `ended` is `false` when the camera answered `NOT_FOUND`: an id it could not resolve to one of its own sessions with this server — one the peer had already ended, one it never held, or one belonging to another controller. The server then drops its local records for the id as well.
- An `EndSession` the camera refuses for any other reason is an error response, not `ended: false`. Because of the shared invoke above, the error can report an `EndSession` this request did not send itself. Either way the session is still open on the camera, so sending `camera_stop_stream` again is the retry.

Ending a session with `device_command` and `EndSession` drops the same two local records, in this order: this server's camera session registry, then the requestor-side session tracking. A failure of the second is logged and does not fail the command: the `EndSession` already succeeded on the camera, and an error would invite a retry the camera can only answer with `NOT_FOUND`.

#### camera_snapshot

Capture one still frame.

##### Minimal request

Required: `node_id` and `endpoint_id`.

```json
{
  "message_id": "1",
  "command": "camera_snapshot",
  "args": {
    "node_id": 1,
    "endpoint_id": 1
  }
}
```

What the client gets: a frame from the largest snapshot capability the camera states, in any image codec, with no overlay asked for. A snapshot stream the camera already has is used when it is no smaller. When all of the camera's encoders are taken, a capability that needs no hardware encoder comes first. The snapshot stream stays allocated for the next call.

**Response:** `{ data, codec, resolution, degraded, stream_id, provenance }`.

- `data` is the image bytes, base64-encoded.
- `degraded: true` says the frame is smaller than the best capability the request's own bounds allowed.
- `stream_id` names the snapshot stream the frame came from. A successful call always leaves that stream on the camera, so this is the id `camera_release_stream` takes. That release can still fail with error 104 while something references the stream.
- `provenance` says where that stream came from, with the values and meaning `camera_start_stream` uses: `allocated` (this call allocated it), `reused` (already there, and this server allocated it earlier in this run) or `adopted` (already there, not allocated by this server). A client that releases only the snapshot streams it caused releases the ones answered with `allocated`.

##### More control

| Argument | Type | What it controls |
|---|---|---|
| `max_resolution` | resolution, optional | Ceiling on the frame size. A capability larger in either dimension is not used |
| `codec` | name, optional | Image codec, from `snapshot.capabilities[].image_codec` |
| `watermark_enabled` | boolean, optional | Whether the camera burns in its watermark. See the overlay rules below |
| `osd_enabled` | boolean, optional | Whether the camera burns in a date/time/name banner |

```json
{
  "message_id": "1",
  "command": "camera_snapshot",
  "args": {
    "node_id": 1,
    "endpoint_id": 1,
    "max_resolution": { "width": 1280, "height": 720 },
    "codec": "JPEG",
    "watermark_enabled": false,
    "osd_enabled": false
  }
}
```

`max_resolution`, `codec`, `watermark_enabled` and `osd_enabled` are the only arguments besides `node_id` and `endpoint_id`. Any other key is refused with error 8.

##### camera_snapshot details

Overlays work as under `camera_start_stream`'s `video` (see **The overlays** there):

- Mandatory on `SnapshotStreamAllocate` for a camera advertising the matching feature, forbidden for one that does not (spec §11.2.8.8, conformance `WMARK` / `OSD`).
- `true` for a feature the camera does not advertise fails with error 102 naming it; `false` is accepted there; unset asks for no overlay.
- A snapshot stream whose overlays differ from what the request resolved to is not adopted.
- Weaker than for video: at a capability whose `requires_hardware_encoder` is false the camera **may** ignore both fields and apply the source video stream's setting instead (spec §11.2.8.8.6). The request is not a guarantee; `camera_get_capabilities`'s `allocated.snapshot` reports what the camera actually did.

Choosing a stream:

- The call captures from a snapshot stream the camera already has, whoever allocated it, whenever one fits the request's own bounds and is no smaller than the capability it would otherwise allocate. Allocating a stream per call is what the cluster asks controllers to avoid.
- When the camera's encoders are all taken, the server prefers a capability that needs no hardware encoder. How many are taken is counted from the referenced video streams plus the snapshot streams with `hardware_encoder` set, against `max_concurrent_encoders`. So one viewer on a camera that states four encoders costs nothing.
- A stream the call allocates is left in place for the next call, whatever capability it came from. A call that fails deallocates the stream it allocated for the attempt. At most one such stream exists per snapshot capability, because `SnapshotStreamAllocate` answers a matching request with the id it already issued.
- A stream allocated at a capability that requires the hardware encoder holds one of `max_concurrent_encoders` while it exists. After a successful capture `camera_snapshot` never gives it back itself: a deallocate it cannot await to the end would make this response name a stream that is being removed. A later `camera_start_stream` that runs out of capacity takes it instead of failing, under the rules in **Making room** under `camera_start_stream`, and reports it in a `camera_stream_evicted` event. The client therefore does not have to release it to start a stream, and the next `camera_snapshot` allocates one again.
- A stream left in place shows under `camera_get_capabilities`'s `allocated.snapshot`, and `camera_release_stream` frees it. Both read what the camera reports: on a camera that never reports its allocated snapshot streams, the stream is there but neither command can name it.

#### camera_release_stream

Deallocate a stream nothing references. All four arguments are required.

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

- `kind` is `"video"`, `"audio"` or `"snapshot"`.
- `stream_id` is the `stream_id` a `camera_start_stream` or `camera_snapshot` response carried, or a `video_stream_id` / `audio_stream_id` / `snapshot_stream_id` from `camera_get_capabilities`. Every stream id is a uint16, so a `stream_id` outside 0 to 65535 is refused with error 8 before the camera is asked.
- The stream need not be one this server allocated. The cluster protects a stream by its reference count and by the `Internal` stream usage, not by who created it, so the command forwards to the camera and reports what it answers.
- The camera decides whether the stream can go: the deallocate always goes out. Its `INVALID_IN_STATE` is reported as error 104, because that is what the reference implementation answers for a reference count above 0, and for nothing else.
- The reference count the server holds is a cached, subscription-backed view that can be behind the device in either direction, so it decides nothing. It only fills in `reference_count` in the error detail when it is above zero, and is absent from the detail otherwise. A stream the server reads as referenced is still released when the camera accepts it.
- A missing AV Stream Management cluster is error 105, a malformed argument error 8. An id the camera does not know, or a video or audio stream marked `Internal`, comes back as the device's own error.

Response: `null`. A failure is an error response — error 104 while a listener still references the stream, the camera's own status otherwise — so a success has nothing to report.

#### Rules for all camera commands

##### Argument rules

- `args` must be an object when stated. A message that leaves it out or sends `null` has an empty argument set, so it fails with error 8 for the missing `node_id`. A string, number, boolean or array is refused with error 8 naming the command.
- An unknown argument key is refused with error 8, not dropped: a dropped key would answer a request the client did not make. The refusal names the key and lists the keys the command takes.
- `node_id` must name one node: an operational node id, or a test node id. A group id or another special id (Matter Core specification § 2.5.5, Table 4) is refused with error 8, because a camera command talks to one camera.
- Send a large `node_id` as an integer literal or a bigint, not in exponent form: a JSON number above 2^53 cannot hold every integer, so the server refuses it with error 8 instead of addressing a different node.
- `endpoint_id` is a valid endpoint number (0 to 65534).

##### Names

Codecs, stream usages and talkback modes are names, not numbers. All names are matched case-insensitively.

- Codecs: `H264`, `H265`, `H266`, `AV1` (video), `OPUS`, `AAC` (audio), `JPEG`, `HEIC` (snapshot). The codec set is open: a codec the cluster enum does not define is reported as its decimal digits and accepted back in that spelling.
- Stream usages: `Internal`, `Recording`, `Analysis`, `LiveView`. They are closed for requests only. `camera_start_stream` refuses `Internal`, which marks a stream the device keeps for itself, and any name not in this list. `camera_get_capabilities` still reports a usage the enum does not define as its decimal digits; a stream carrying it cannot be requested back.
- `two_way_talk_support`: `NotSupported`, `HalfDuplex`, `FullDuplex`. A value the enum does not define is reported as its decimal digits. It has no request side: talkback is asked for in the SDP offer, not by a hint (see **The offer's media sections** under `camera_start_stream`).

A client can send these reported values back in a request (the key name can differ):

| Reported by `camera_get_capabilities` | Send back as |
|---|---|
| `video.codecs` | `camera_start_stream`'s `video.codecs` |
| `audio.codecs` | `camera_start_stream`'s `audio.codecs` |
| `audio.channels` | `camera_start_stream`'s `audio.channel_count`, at most the reported number |
| `audio.sample_rates` | `camera_start_stream`'s `audio.sample_rate`, one of the reported rates |
| `limits.supported_stream_usages` | `camera_start_stream`'s `stream_usage`, any name but `Internal` |
| `snapshot.capabilities[].image_codec` | `camera_snapshot`'s `codec` |

Everything else the command reports is a fact about the camera, not a value to send back. `audio.bit_depths` has no hint: `AudioStreamAllocate` takes one bit depth and the server picks it from that list. A key a hint object does not take is refused with error 8 instead of being ignored, so a bound is never dropped without the caller hearing about it.

##### Resolutions

Every `resolution`, `min_resolution`, `max_resolution` and `sensor` on these commands is an object `{ "width": number, "height": number }`. On an argument — `camera_start_stream`'s `video.min_resolution` / `max_resolution` and `camera_snapshot`'s `max_resolution` — both fields must be an integer 1 to 65535, the range `VideoResolutionStruct` encodes them in. A negative, zero, fractional, `NaN`, infinite or larger value is refused with error 8 instead of reaching the camera.

#### send_webrtc_provider_command

Send `ProvideOffer`, `SolicitOffer`, `ProvideAnswer` or `ProvideIceCandidates` yourself.

```json
{
  "message_id": "1",
  "command": "send_webrtc_provider_command",
  "args": {
    "node_id": 1,
    "endpoint_id": 1,
    "command_name": "ProvideOffer",
    "payload": {
      "webRtcSessionId": null,
      "sdp": "v=0\r\n...",
      "streamUsage": 3,
      "videoStreams": [1],
      "ice_servers": [{ "urls": "stun:stun.example.org:3478" }]
    }
  }
}
```

The official WebRTC Provider commands, for a client that allocates its own streams, and for the signalling of any session, whichever command opened it.

`command_name` is one of:

- `ProvideOffer`, `SolicitOffer` (schema 12+): establish a session. The server fills in the originating endpoint, reconciles the stream fields against the camera's cluster revision and registers the session with its local WebRTC requestor. The response carries the camera's answer.
- `ProvideAnswer`, `ProvideIceCandidates` (schema 14+): signal for a session the camera already holds. They establish nothing. The response is `null`, because the cluster defines no response payload for either. An id the camera cannot resolve to one of its own sessions comes back as the camera's own error. A server below schema 14 refuses them as an unsupported `command_name`.

No other provider command is reachable this way. `EndSession` is not: `camera_stop_stream` owns it, because one session gets one `EndSession` and this server's local records for the session go with that invoke. A client that opened its session with `camera_start_stream` does not need this command for signalling: `camera_provide_answer` and `camera_provide_ice_candidates` send the same two commands with the same checks.

**Top-level arguments.** Only `node_id`, `endpoint_id`, `command_name` and `payload` are accepted. Any other key is refused with error 8, and so is an `args` that is not an object. A missing or `null` `args` is an empty argument set and fails with error 8 for the missing `command_name`. `node_id` and `endpoint_id` follow the [argument rules of the camera commands](#argument-rules): a fractional, negative or out-of-range `node_id` is error 8. An `endpoint_id` the node does not have, or one without the WebRTC Provider cluster, is error 8 too.

**Payload keys.** `payload` carries the command's own fields.

- A key is matched to a field with case and word separators ignored. `ice_servers`, `iceServers` and `IceServers` name the same field. So do `webrtc_session_id` (the spelling the rest of this API uses), `webRtcSessionId` and the Python Matter Server's `webRtcSessionID`.
- The same matching applies inside an `ice_candidates` entry, which is how the event's `sdpMLineIndex` reaches the cluster's `SDPMLineIndex`. Entries take the form described under `camera_provide_ice_candidates`.
- `ice_servers` takes the shape `camera_start_stream` and the `webrtc_callback` `offer` event use — `{ urls, username?, credential?, caid? }` with the limits listed under `camera_start_stream` — so ICE servers read from an offer can be sent straight back.
- `originatingEndpointId` is the server's own and is dropped.
- A key naming no field of the command is refused with error 8. So is a second key resolving to a field another key already filled. matter.js drops what it cannot place, and a duplicate would overwrite silently, so the caller would get a session it did not ask for.

**Field checks.** Every field is checked against the cluster's own definition before the camera is asked:

- each number against the range its field encodes in;
- each string against the length its field states: 1 to the ceiling where it states one, at least the floor where it states only that; a field stating neither, such as `sdp` and a candidate's `candidate`, takes any string;
- each list against the entry count its field takes;
- each field the command states as mandatory for being present.

A value that fails is refused with error 8 naming the key as sent, instead of failing in the TLV encoder. What the cluster makes conditional stays the camera's to answer: `streamUsage` is optional on `ProvideOffer`, because a re-offer of an existing session does not restate it, so the server refuses a first offer that omits it only after the camera has answered. `streamUsage` is bounded by its width, not by the enum's defined values: on this route the client owns the allocation, so the camera answers for a usage it does not serve.

**Stream forms.** `ProvideOffer` and `SolicitOffer` state the session's streams in one of two forms, never both: the `videoStreams` / `audioStreams` lists of cluster revision 2, or the `videoStreamId` / `audioStreamId` the lists deprecate.

- A camera fails the command with `INVALID_COMMAND` when a list is present beside a singular id, and the test spans both media kinds, not each on its own (§11.5.6.1 and §11.5.6.3, Effect on Receipt). A payload stating both forms is refused with error 8, instead of having one of them dropped: `{"videoStreams": [5], "audioStreamId": null}` asks for video stream 5 and auto-selected audio, and sending the list alone would open a video-only session.
- A form the camera takes is sent as stated.
- The one conversion: a list sent to a camera whose WebRTC Provider does not state cluster revision 2, or whose revision this server has not read yet. Such a camera drops a list on receipt, and the session comes up with streams nobody chose. It carries a single id per media kind, so a one-entry list is converted to the singular id. Any other length is refused with error 8 instead of being cut to its first entry; the refusal says whether the camera stated a revision below 2 or none has been read.
- An empty list is refused at every revision, because the field takes 1 to 16 entries.

**Changes for existing clients.** These payloads reached the camera on servers below schema 14 and are now refused with error 8: a key the command does not state, the same field twice under two spellings, a missing mandatory field, a payload that is not an object, and an ICE server spelled with the cluster's `URLs` instead of `urls`. A `node_id` that is fractional, negative or out of range was an uncaught conversion failure, or a node lookup reporting a node this server does not hold.

**Not through `device_command`.** The generic `device_command` route is not an alternative way to start a session or to signal for one. It serves every cluster and takes each payload in that cluster's own field names, so an ICE server sent that way uses the cluster's `URLs` spelling and a candidate its `SDPMLineIndex`. It invokes nothing else: it does not fill in the originating endpoint, does not reconcile the singular `videoStreamId` against the `videoStreams` list, and does not register the session with the local WebRTC requestor. A `ProvideOffer` sent that way produces a session no `webrtc_callback` can be routed for, and streams that stay referenced with no way to end them but `EndSession` by hand.

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

**webrtc_callback** *(schema 12+)* - A camera signalled for a WebRTC session

The camera's half of the WebRTC signalling: its offer, its answer, its ICE candidates and its end of
the session, each carrying `event_type`, `webrtc_session_id`, `node_id`, `endpoint_id`, `fabric_index`
and a per-type `data`, which is `null` on a callback that carried no payload.

```json
{
  "event": "webrtc_callback",
  "data": {
    "event_type": "offer",
    "webrtc_session_id": 3,
    "node_id": 1,
    "endpoint_id": 1,
    "fabric_index": 1,
    "data": {
      "sdp": "v=0\r\n...",
      "ice_servers": [{ "urls": ["stun:stun.example.org:3478"] }],
      "ice_transport_policy": "all"
    }
  }
}
```

| `event_type` | `data` |
|---|---|
| `offer` | `{ sdp, ice_servers?, ice_transport_policy? }`. Answer it with `camera_provide_answer` |
| `answer` | `{ sdp }` |
| `ice_candidates` | `{ ice_candidates: [{ candidate, sdpMid, sdpMLineIndex }] }`. Send yours with `camera_provide_ice_candidates` |
| `end` | `{ reason }`, the cluster's `WebRTCEndReasonEnum` as a number |

**Delivered only to connections that have issued a WebRTC command** — `camera_start_stream`,
`camera_provide_answer`, `camera_provide_ice_candidates` or `send_webrtc_provider_command` — during
their lifetime, so a client that never asked for a session never receives an event type it does not
know.

Among those connections it is **routed to the one that owns the session**: a session opened by
`camera_start_stream` reaches the connection that opened it and no other, for every event type,
including the camera's `end`.

A session this server holds no record of reaches every opted-in connection instead: nothing names an
owner for it, and withholding the signalling would strand a session no client could complete. Three
cases reach that. A session opened on the raw `send_webrtc_provider_command` route registers nothing
with the camera subsystem, so its signalling is broadcast — including to a client driving a managed
session on the same camera. An event for a session whose record has already been dropped is broadcast
too. So is an event that arrives in the window between the server registering a session with its local
WebRTC requestor and recording it — the requestor answers `NOT_FOUND` for every signalling command
naming a session it has not registered, the camera's offer included, so nothing arrives before that
registration.

**camera_session_ended** *(schema 14+)* - Another connection ended a session this connection opened

```json
{
  "event": "camera_session_ended",
  "data": { "node_id": 1, "endpoint_id": 1, "webrtc_session_id": 3 }
}
```

Any connection may end any of this server's sessions, with `camera_stop_stream` or with `EndSession` through the generic `device_command` route. The camera's own `PeerNodeID` and fabric check decides that, not this server's records. So a session can end without the client that opened it doing anything. This event tells that client, instead of its next command failing.

Delivery:

- **Only to connections that have issued a camera command** — any `camera_*` command, or `send_webrtc_provider_command`. A pre-schema-14 client never receives an event type it does not know.
- Among those, **to the connection that opened the session**.
- Never to the connection whose `camera_stop_stream` or `device_command` `EndSession` ended it. That connection has the answer to its own command, and a second report of the same fact would give it two messages with no order between them.
- A session this server holds no record of — one opened on the raw `send_webrtc_provider_command` route — is announced to every other such connection instead. Nothing names an owner, so withholding it would tell nobody; `webrtc_callback` broadcasts such a session's signalling for the same reason.

Four endings send nothing, because the client already knows or cannot be told:

| Ending | Why no event |
|---|---|
| The peer sent `End` | The owner receives it as a `webrtc_callback` `end` event |
| The client's own `camera_stop_stream`, or its own `EndSession` on the `device_command` route | That command's response is the answer |
| The owning connection closed | The only connection this concerns is the one that went away |
| The server is shutting down | Every socket is closed before the sessions are ended; the `server_shutdown` event is what a client sees |

When `EndSession` fails:

- With anything but the camera's `NOT_FOUND`: the session is still open and is not announced. The next stop, disconnect or shutdown reaches it again.
- With `NOT_FOUND`: the camera states it holds no such session. The server's records go, and the owner is told even though the command failed.
- For an id no record named, nothing is announced, because there was no session on either side to report.

`send_webrtc_provider_command` cannot send `EndSession` at all.

**camera_stream_evicted** *(schema 14+)* - The server deallocated a stream to make room for a request

```json
{
  "event": "camera_stream_evicted",
  "data": { "node_id": 1, "endpoint_id": 1, "kind": "video", "stream_id": 7 }
}
```

- `kind` is `"video"` or `"snapshot"`, the two kinds the make-room step can take. An audio stream holds neither an encoder nor a share of the camera's encoded pixel rate.
- The id is gone for good. Where the server allocates a replacement for the same range, the camera issues a new id, and a client still holding the old one has to allocate again.
- Sent to every connection that has issued a camera command, including the one the room was made for: no record says which connection holds a stream.
- For a video stream, that caller also reads the same ids in its `camera_start_stream` response under `video.evicted_stream_ids`. For a snapshot stream this event is the only report, because that field carries video stream ids.

When the server takes a stream is described under **Making room** in `camera_start_stream`.

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

- Serializes BigInt values as unquoted numbers in JSON (e.g., `18446744069414584320` instead of `"18446744069414584320"`), at full 64-bit width for positive and negative values
- Because JSON has only a single numeric literal type, clients must use a parser or configuration that preserves large integer literals (or field-aware handling for known ID/counter fields) rather than relying on a drop-in `JSON.parse` replacement
- Standard JSON parsing that eagerly maps all numbers to IEEE-754 doubles may silently lose precision for these values instead of throwing an error; avoid using such parsers for Matter IDs and counters
- Non-JavaScript clients should use JSON parsing options/libraries that can keep large integers as big-integer types for these fields (for example: Python's `json` or `orjson`, which read 64-bit integers exactly — the bundled Python client uses `orjson` — Java's `BigInteger`-aware parsers, or Go's `encoding/json` with `UseNumber` combined with `math/big.Int`)
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
| 102 | CameraStreamIncompatible | OHF extension. The camera, the offer or the request rules the stream out; `reason` says which. `details` is a JSON string: `{"message": string, "reason": "codec" \| "bounds" \| "feature" \| "capability" \| "offer" \| "no_media" \| "level", "track"?: "video" \| "audio", "feature"?: string, "device": string[], "requested": string[], "bound"?: {"field": string, "requested": string, "limit": string}, "device_status"?: number}`. See [camera error details](#camera-error-details) |
| 103 | CameraResourceExhausted | OHF extension. The camera refused the allocation for lack of capacity. `details` is a JSON string: `{"message": string, "allocated": [{"kind": "video" \| "audio" \| "snapshot", "stream_id": number, "reference_count": number}], "max_concurrent_encoders"?: number, "max_encoded_pixel_rate"?: number}`. See [camera error details](#camera-error-details) |
| 104 | CameraStreamInUse | OHF extension. `camera_release_stream` targeted a stream a listener still references. `details` is a JSON string: `{"message": string, "stream_id": number, "reference_count"?: number}`. See [camera error details](#camera-error-details) |
| 105 | CameraNotSupported | OHF extension. The endpoint lacks a cluster the camera command needs. `details` is a JSON string: `{"message": string, "missing_clusters": number[]}`. See [camera error details](#camera-error-details) |
| 106 | CameraPrivacyMode | OHF extension. The camera's privacy switch forbids the call. `details` is a JSON string: `{"message": string, "modes": string[], "device_status": number}`. See [camera error details](#camera-error-details) |

### Camera error details

**102 CameraStreamIncompatible.**

`reason` states one thing per value, so no other field has to be read to tell two failures apart. Where a client can act on each is fixed:

- `codec` and `bounds`: in the command's arguments.
- `offer` and `level`: in the SDP the client sends.
- `feature`, `capability` and `no_media`: in neither; no narrowing of this request reaches them.

| `reason` | Meaning |
|---|---|
| `codec` | The codec lists do not overlap |
| `bounds` | The requested range cannot be served. `bound` names the single caller bound when the server ruled it out before asking the camera |
| `feature` | The camera's `FeatureMap` does not advertise what the request needs. The `feature` field names it as `camera_get_capabilities`'s `features` spells it: `Video`, `Audio` or `Snapshot` for a demanded track, `Watermark` / `OnScreenDisplay` for a demanded overlay. An overlay refusal carries `track: "video"` on `camera_start_stream` and no `track` on `camera_snapshot`; it is answered by not asking for that overlay |
| `capability` | The camera advertises the feature but states no capability the request could use: an empty `snapshot.capabilities`, or `audio` capabilities naming no codec, sample rate or bit depth |
| `offer` | The `sdp` the caller sent rejects this track's media section (`m=` line with port 0), states a direction that will not receive it (`a=sendonly`, `a=inactive`), or carries no such section at all. `track` names the kind; `requested` carries the caller's own codec list for it, empty when it stated none |
| `no_media` | A `camera_start_stream` request left nothing for the offer to carry: `video: false` with `audio: false`, or one track declined while the other was left to the server and could not be resolved. No `track`; `device` and `requested` both empty. Answered by asking for at least one track — unless the camera advertises neither `Audio` nor `Video`: then the same shape answers a request that left both tracks to the server, and no track can be asked for at all. `features` from `camera_get_capabilities` tells the two apart |
| `level` | The camera and the peer share a codec, but for every shared one the `a=fmtp` record states a decode ceiling the server cannot read: a level outside the codec's level tables, or a capability parameter whose value is not a whole number. No ceiling could be held against the stream. `requested` names the offered codecs whose ceiling could not be read |

Fields:

- `feature` is carried by `reason: "feature"` only.
- `track` names which `camera_start_stream` track the failure is about. It is absent when the failure is about the request as a whole (`no_media`) or about a command that resolves no track.
- `device` / `requested` are codec names in the other cases. `requested` is the codec the request resolved to, which is the caller's own choice when it stated one.
- `bound` is reported by `camera_start_stream` only. A `camera_snapshot` ceiling that excludes every capability answers `reason: "bounds"` without it.
- `bound.field` is the hint key in the spelling `camera_start_stream` takes back: `min_resolution`, `min_frame_rate` or `min_bit_rate` under `video`, `sample_rate` or `channel_count` under `audio`.
- `bound.requested` is the value the caller stated. `bound.limit` is what it ran into: the ceiling in force after every narrowing, or the set of values the device lists when it answers with a set, such as for `sample_rate`.
- An offer's `a=fmtp` limits narrow only the codec that stated them, so the same offer can produce a different `bound.limit` for a different codec.
- `device_status` is the Matter status a device rejection answered with.

A caller that asks for audio and gets none can also see error 103 (capacity), error 7 (`SDKStackError`, the device answered with no stream id), or error 0 (`UnknownError`, an unrecognized device status) instead of this code.

**103 CameraResourceExhausted.** The camera answered `ResourceExhausted` and the allocation ladder found nothing else to try.

- `ResourceExhausted` is all the camera states. Which resource ran out is not part of it, so the message names none.
- `max_concurrent_encoders` and `max_encoded_pixel_rate` are the camera's own attributes, reported whatever kind was refused, and only when the camera states them.
- `allocated` lists the streams that hold the capacity, which is not always the kind that was asked for:
  - A refused video or snapshot allocation lists every allocated video stream, referenced or not, plus the snapshot streams with `hardware_encoder` set. For a video allocation, a stream the request itself deallocated is not listed.
  - A refused audio allocation lists the audio streams.

**104 CameraStreamInUse.** Raised by `camera_release_stream`.

- The refusal is always the camera's own `INVALID_IN_STATE`.
- `reference_count` is the count the server last read, present only when that cached count is above zero.
- Every other outcome about the stream is the camera's answer, forwarded.

**105 CameraNotSupported.**

- `camera_start_stream` requires both the AV Stream Management cluster and the WebRTC Provider cluster, and raises this when either is missing.
- `camera_get_capabilities`, `camera_snapshot` and `camera_release_stream` check only the AV Stream Management cluster. A camera missing just the WebRTC Provider cluster still answers those three normally.
- `camera_provide_answer` and `camera_provide_ice_candidates` check neither and never raise this code. They invoke a provider command on a session the camera already holds, through the same invoke path as `send_webrtc_provider_command`, so an endpoint without the WebRTC Provider cluster fails exactly as it does there.
- `missing_clusters` names the absent cluster ids, so one entry means the other cluster is there.
- An endpoint the node does not have lacks both clusters, and `missing_clusters` names both.

**106 CameraPrivacyMode.** Raised by `camera_start_stream` and `camera_snapshot`.

- `modes` names every switch from `camera_get_capabilities`'s `privacy` that forbids this call — `hard_mode_on`, `soft_livestream_mode_enabled`, `soft_recording_mode_enabled` — not only the one the camera answered on. The device reports one status for all of them and states no order between them.
- It is a device state, not a request the client can change: no other stream usage, codec or bound succeeds while the switch is on. That is why it is not error 102.
- The refusal is always the camera's own `INVALID_IN_STATE`, reported in `device_status`. The server checks no switch before the invoke: the switches are read from a subscription-backed view that can lag in either direction, and a refusal decided on a stale "on" would leave no path that reaches the device.
- `INVALID_IN_STATE` also answers several things that are not privacy — a `turns:` ICE server on a camera whose `UTCTime` is null, among others. An `INVALID_IN_STATE` that no reported switch covers is answered as error 0 with the device's own status, not blamed on privacy.

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
| `send_webrtc_provider_command` | Send `ProvideOffer`, `SolicitOffer`, `ProvideAnswer` or `ProvideIceCandidates` to a camera endpoint yourself (schema 12+) |
| `camera_get_capabilities` | Report a camera endpoint's stated capabilities and current stream allocations (schema 14+) |
| `camera_start_stream` | Allocate or reuse a video/audio stream and open a WebRTC session on it (schema 14+) |
| `camera_provide_answer` | Answer the offer a camera sent for a session, as `ProvideAnswer` (schema 14+) |
| `camera_provide_ice_candidates` | Trickle ICE candidates into a session, as `ProvideIceCandidates` (schema 14+) |
| `camera_stop_stream` | End a WebRTC session, keeping the stream allocation (schema 14+) |
| `camera_snapshot` | Capture one still frame from a camera endpoint (schema 14+) |
| `camera_release_stream` | Deallocate a stream nothing references (schema 14+) |

### Data Differences

| Field | Python | Matter.js |
|-------|--------|-----------|
| `MatterNode.attribute_subscriptions` | Tracks per-node subscriptions | Always empty array |
| Test node IDs | `>= 900000` | `>= 0xFFFF_FFFE_0000_0000` |

### Behavioral Differences

- **Fabric Label**: `set_default_fabric_label` with null or an empty label resets to "HomeAssistant" instead of clearing. The argument itself is required: a message that states no `label` is refused with error 8 rather than resetting
- **Attribute Subscriptions**: All attributes are subscribed automatically; the `attribute_subscriptions` field is not used
- **Test Nodes**: Use high bigint range to prevent collision with real Matter node IDs
- **Malformed `args`**: An `args` that is not a JSON object is refused with error 8. The Python Matter
  Server fails while decoding the frame instead, with an error its message handler does not catch, and
  closes the connection without answering the request
- **Unknown argument keys**: The `camera_*` commands and `send_webrtc_provider_command` refuse an
  argument key they do not know with error 8, listing the keys they accept. The Python Matter Server
  ignores unknown keys (`parse_arguments` is called with `strict=False`). The difference is confined to
  commands the Python server does not have, and it is deliberate: a request whose argument was ignored
  gets a result nobody asked for
- **A missing required argument**: The Python server converts each argument against the handler's type
  hints, so a missing or mistyped one is error 8 for every command. Here each command checks its own
  arguments: the `camera_*` commands, `send_webrtc_provider_command`, `set_thread_dataset`,
  `set_wifi_credentials` and `set_default_fabric_label` answer error 8, while a command that hands
  `node_id` straight to the Matter conversion — `get_node`, `interview_node`, `ping_node` and the
  other node-targeted ones — reports a missing or non-numeric one as error 0 (`UnknownError`)
- **Node ID classes**: every node-targeted command refuses a `node_id` whose class can never name a
  node, with error 8 naming the class. Accepted are the Operational range (a commissioned node) and
  the Temporary Local range (this server's imported test nodes); a CASE Authenticated Tag, a PAKE key
  identifier, the Unspecified Node ID and the reserved ranges are refused (Matter Core specification
  § 2.5.5, Table 4). A Group Node ID is accepted by `write_attribute` and `device_command`, which
  multicast to the group, and refused by every other command, which needs one node's answer. Group id
  `0` is refused everywhere: the specification calls it the Null or unspecified Group ID, so it names
  no group (§ 2.5.4, Table 2). The
  Python Matter Server hands all of them to the node lookup and answers `NODE_NOT_EXISTS`, which says
  the node is not commissioned rather than that the argument could never name one
- **Commands that read no arguments**: `server_info`, `get_all_credentials`, `get_thread_border_routers`,
  `discover`, `get_loglevel` and `initiate_ota_upload` still require `args` to be an object when the
  message states one, although they read nothing from it
