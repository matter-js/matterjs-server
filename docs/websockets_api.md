# WebSocket API Documentation

This document describes the WebSocket API for the Matter.js server. The server listens on `ws://localhost:5580/ws` by default.

## Connection

On connection, the server immediately sends a `server_info` message with fabric and capability information:

```json
{
  "fabric_id": 1234567890,
  "compressed_fabric_id": 9876543210,
  "schema_version": 12,
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

```json
{
  "message_id": "1",
  "command": "set_default_fabric_label",
  "args": {
    "label": "Home"
  }
}
```

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
    "schema_version": 12,
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

The current schema version is **12** (minimum supported **11**). The server reports `schema_version` and `min_supported_schema_version` in the initial connection message and via `server_info`. Clients should verify that the server's `schema_version` is within their supported range.

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

### Data Differences

| Field | Python | Matter.js |
|-------|--------|-----------|
| `MatterNode.attribute_subscriptions` | Tracks per-node subscriptions | Always empty array |
| Test node IDs | `>= 900000` | `>= 0xFFFF_FFFE_0000_0000` |

### Behavioral Differences

- **Fabric Label**: `set_default_fabric_label` with null/empty resets to "Home" instead of clearing
- **Attribute Subscriptions**: All attributes are subscribed automatically; the `attribute_subscriptions` field is not used
- **Test Nodes**: Use high bigint range to prevent collision with real Matter node IDs
