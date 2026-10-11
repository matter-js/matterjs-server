# WebSocket API Documentation

This document describes the WebSocket API for the Matter.js server. The server listens on `ws://localhost:5580/ws` by default.

## Connection

On connection, the server immediately sends a `server_info` message with fabric and capability information:

```json
{
  "fabric_id": 1234567890,
  "compressed_fabric_id": 9876543210,
  "schema_version": 13,
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

Optional fields of an error response (schema 14):

- `status` and `cluster_status`: when the failure is a Matter status that matter.js reports as received from the
  device, the numeric Matter status code and, if the device sent one, the cluster-specific status code. This is
  always the case for a `device_command` the device rejected, for example with `UNSUPPORTED_COMMAND` (0x81), and for
  any command whose whole interaction the device answered with a status. matter.js does not mark the status of a
  command the server sends on its own behalf (for example to open a commissioning window or remove a fabric), so
  those failures carry no `status`. Neither do arguments the server rejects before anything is sent. `error_code`
  stays as it was.
- `reason`: why commissioning failed, with every `NodeCommissionFailed` error of `commission_with_code` and
  `commission_on_network`, and with a pairing code that cannot be decoded: `not-discovered` (no matching device was
  found; when devices were found but none could be paired, the reason is `timeout` if an attempt timed out, otherwise
  `other`), `passcode-mismatch` (the device rejected the pairing
  code), `invalid-payload` (the pairing code could not be decoded; `error_code` is `InvalidArguments`),
  `attestation-rejected` (the device certificates were not accepted), `timeout` (the device stopped answering or
  commissioning took too long), `other`. Other argument errors carry no `reason`.

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

Response includes pairing codes and, *(Matter.js only)*, the window's structured fields, so a client can hand the window to another ecosystem without decoding the QR code. `discriminator` is the long (12-bit) discriminator the device advertises while the window is open, `commissioning_timeout` is the window duration in seconds. The `discriminator` request argument is ignored; a random discriminator is used:
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

With `--disable-auto-subscription` the server does not discover Border Routers on its own: the first
`get_thread_border_routers`, `get_thread_diagnostics` or `get_network_topology` starts the discovery, so that first
call can return no Border Routers or diagnostics yet. A `get_thread_diagnostics` with `ext_pan_id` that starts the
discovery returns `null` instead of reporting the Border Router as unreachable; repeat it once discovery found it.

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

> [!NOTE]
> When the server runs with `--disable-auto-subscription`, it does not subscribe to nodes, so there are no
> automatic `attribute_updated` or node events from device reports. You are responsible for subscribing as needed,
> or for switching the server's subscription on per node with `enable_auto_subscription` (see
> [Subscriptions and generic read](#subscriptions-and-generic-read)); only recommended for very special use cases. See [CLI: Disabled auto subscription](cli.md#disabled-auto-subscription).

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

The result lists the written path with its Matter status and, when there is one, the cluster-specific status in
`ClusterStatus` (schema 14). The status is usually the device's answer, but can also come from matter.js before
anything is sent, for example `CONSTRAINT_ERROR` (0x87) for a value out of range:

```json
[{ "Path": { "EndpointId": 1, "ClusterId": 6, "AttributeId": 16385 }, "Status": 0 }]
```

### Subscriptions and generic read

Schema 14. These commands give full control over the Matter Read and Subscribe requests. Most clients do not need
them: the server subscribes to every node on its own. `subscribe`, `unsubscribe`, `enable_auto_subscription` and
`disable_auto_subscription` are only available when the server runs with `--disable-auto-subscription`; otherwise
they fail with `InvalidArguments`, before anything is sent to a device. `subscribe` also fails this way for a node
whose auto subscription was switched on with `enable_auto_subscription`. `read` works in both modes. The server does
not advertise schema 14 yet: `server_info` still reports `schema_version` 13 until the version is raised, so a client that gates
on 14 cannot use them yet.

Paths:

- Attribute paths use the [attribute path format](#attribute-path-format) of `read_attribute`, wildcards included.
- Event paths use the same format with an event id: `endpoint/cluster/event`, for example `1/59/1`
  (Switch `InitialPress` on endpoint 1) or `*/59/*`.
- Data version filter paths are `endpoint/cluster` and must name both.
- Every part must be a decimal number or `*`, and a number must be a valid id of its kind (the endpoint fits 16 bits;
  cluster, attribute and event ids fit 32 bits and carry a valid vendor prefix). Unlike `read_attribute`, which reads
  any other part as a wildcard, a malformed path is rejected with `InvalidArguments`. As in `read_attribute`, 65535 as
  endpoint and 4294967295 as cluster, attribute or event id also act as wildcards.
- `event_min` must be an integer from 0 to 2^64-1 and `data_version` one from 0 to 2^32-1, otherwise the request is
  rejected with `InvalidArguments`. Test nodes are not supported (`InvalidArguments`).

Values in the results and reports have the same shape as in `read_attribute` (attributes) and `node_event`
(events). When the device answers a path with a status instead of data (for example an unsupported attribute),
the path is listed in `attribute_status` or `event_status`, keyed by the path in the request format, with the
numeric Matter status code in `status` (as in the `write_attribute` result) and the cluster-specific code in
`cluster_status` when the device sent one. Both fields are left out when there is no status:

```json
{
  "attributes": { "1/6/0": true },
  "events": [],
  "attribute_status": { "1/6/9999": { "status": 134 }, "1/1234/0": { "status": 195 } },
  "event_status": { "1/69/5": { "status": 199 } }
}
```

**read** - Read attributes and events in one Matter Read request

```json
{
  "message_id": "1",
  "command": "read",
  "args": {
    "node_id": 1,
    "attribute_paths": ["1/6/0", "0/40/*"],
    "event_paths": [{ "path": "1/59/*" }],
    "event_min": 120,
    "fabric_filtered": true,
    "data_version_filters": [{ "path": "0/40", "data_version": 3141592 }]
  }
}
```

At least one attribute or event path is required. `fabric_filtered` defaults to `true`, the Matter default (unlike
`read_attribute`, which defaults to `false`). `event_min` becomes the EventFilter of the request; without it the
request has no event filter, also for a node with the server's own subscription, and returns every event the device
still holds on the requested paths. The request goes to the device as given: unlike `read_attribute`, it is not
split into batches and the server adds no data version filters of its own. For a LIT ICD with this controller
registered, matter.js holds the request while the device sleeps and sends it at the next check-in, as it does for
every other request.

Side effects on all clients: matter.js merges the read attribute values into the node state, which sends the usual
`attribute_updated` events to every listening client, but only when `fabric_filtered` is `true`, the default.
matter.js applies a read only when its fabric filter matches the node's subscription settings, which the server
leaves at fabric-filtered, whether or not the node currently has the server's own subscription. With auto
subscription on, the server forwards changes of a node only once its subscription has been active since the server
started, so a read of a node that has not been subscribed yet sends neither event. Every event the read returns is also sent to every listening client as
`node_event` and added to the event history, whatever `fabric_filtered` is and without a check against events
already seen. A read with event paths and a low or no `event_min` therefore replays old events (for example button
presses) to all clients, Home Assistant included, as if they were new.

Response:

```json
{
  "message_id": "1",
  "result": {
    "attributes": { "1/6/0": true, "0/40/1": "Vendor" },
    "events": [
      {
        "node_id": 1, "endpoint_id": 1, "cluster_id": 59, "event_id": 1, "event_number": 121,
        "priority": 1, "timestamp": 1704067200000, "timestamp_type": 1, "data": { "newPosition": 1 }
      }
    ]
  }
}
```

**subscribe** - Open a Matter subscription for this connection

```json
{
  "message_id": "1",
  "command": "subscribe",
  "args": {
    "node_id": 1,
    "attribute_paths": ["1/6/0"],
    "event_paths": [{ "path": "1/59/*", "is_urgent": true }],
    "min_interval": 0,
    "max_interval": 60
  }
}
```

Arguments are those of `read` plus:

- `min_interval`, `max_interval` (required): the MinIntervalFloor and MaxIntervalCeiling in seconds, integers from
  0 to 65535, `max_interval` not below `min_interval`. For intermittently connected (ICD) devices matter.js sends
  a floor of 0 instead of `min_interval`.
- `is_urgent` per event path (optional): the IsUrgent flag of that event path.
- `keep_subscriptions` (optional, default `false`): the KeepSubscriptions flag, sent to the device as given
  (`false` is the default of chip-tool and the Python controller; Matter has no default). `false`, also when left
  out, ends all other subscriptions of this controller to that node, on the device and in the server, including
  those of other connections; each one that was opened with `subscribe` then arrives as `subscription_ended` at its
  connection. `true` keeps them.

The server adds the data versions it already knows for the requested clusters to the request's data version
filters (matter.js does this for every subscription), so the priming report can leave out clusters that did not
change.

Response:

```json
{
  "message_id": "1",
  "result": {
    "subscription_id": 2864434397,
    "attributes": { "1/6/0": false },
    "events": []
  }
}
```

`subscription_id` is the SubscriptionId the device assigned. The rest of the result is the priming report, in the
shape of the `read` result (`attributes`, `events`, `attribute_status`, `event_status`). Later reports follow as
`subscription_report` events after this response. All reports have the same side effects on all clients as `read`:
`attribute_updated` to every listening client, only when `fabric_filtered` is `true`, the default, and every
reported event as `node_event` to every listening client and into the event history, whatever `fabric_filtered` is
and without a check against events already seen.

A subscription belongs to the connection that opened it. It ends when the connection sends `unsubscribe`, when the
connection closes, when the node is removed, and when the server shuts down. It also ends when the device stops
reporting (no report within the max interval plus a response margin) or when another subscription of this
controller to the node is made with `keep_subscriptions` `false` or left out, from any connection. Every end the
connection did not ask for, including node removal, is announced with `subscription_ended`; `unsubscribe` and
closing the connection are not.

The server only learns that a subscription ended on the device when the local subscription times out or matter.js
closes it. A device that dropped the subscription (for example after a reboot) is noticed at the latest after the
max interval plus a response margin; until then the subscription still looks active.

**unsubscribe** - End a subscription of this connection

```json
{
  "message_id": "1",
  "command": "unsubscribe",
  "args": { "subscription_id": 2864434397 }
}
```

Only available with `--disable-auto-subscription`; otherwise it fails with `InvalidArguments`. Returns `null`. An
unknown id, or the id of another connection's subscription, gives an `InvalidArguments` error.
Matter has no unsubscribe message: the server stops accepting reports, and the device ends the subscription at its
next report.

**enable_auto_subscription** / **disable_auto_subscription** - Switch the server's own subscription to one node on or off

```json
{
  "message_id": "1",
  "command": "enable_auto_subscription",
  "args": { "node_id": 1 }
}
```

Only available with `--disable-auto-subscription`; otherwise they fail with `InvalidArguments` and the node is not
changed. Test nodes are not supported (`InvalidArguments`). With the server's own subscription on, a node behaves as
without `--disable-auto-subscription`: device reports send `attribute_updated` and `node_event` to every listening
client, `available` follows the connection to the device, and `register_icd` works. A LIT ICD registers on its own
once subscribed. Polling, time synchronization, fabric label pushes and automatic OTA update checks stay off. The
setting is not kept: every start switches all nodes off again. Switching a node to the state it already has changes
nothing.

The server's subscription asks the device only for events after the highest event number matter.js has received
from the node so far, through any read or subscription.

`enable_auto_subscription` returns `null` once the server's subscription to the node is active, so commands that
need it, such as `register_icd`, work from then on. If the node's subscription is already active, it returns at
once. It fails with an error, and the node stays switched on with matter.js trying to subscribe in the background,
when:

- matter.js finds the device unreachable while waiting: `NodeNotResolving` (4). Only a new finding counts: a node
  that was already marked unreachable before, for example after a failed `read`, is tried again and only fails here
  when that try fails too.
- the subscription is not active within 4 minutes 15 seconds, the time matter.js allows a CASE connection while
  commissioning: `NodeNotReady` (3)
- the node is removed while waiting: `NodeNotExists` (5)
- the server shuts down while waiting: `UnknownError` (0)

It also fails with `NodeNotReady` (3) when `disable_auto_subscription` switches the node off while it waits; the
node then stays switched off. Send `disable_auto_subscription` to switch a node off again after a failure.
`disable_auto_subscription` returns `null` once the server's subscription is closed in the server. A node whose
device cannot be reached becomes unavailable as without `--disable-auto-subscription`.

The server's subscription is made with KeepSubscriptions `false`, so it ends every subscription opened with
`subscribe` to that node once its Subscribe request goes out, which is before a successful
`enable_auto_subscription` returns and, after a failed one, can be much later; each arrives as `subscription_ended`
at its connection. While the node's auto subscription is on, `subscribe` for it fails with `InvalidArguments`, also
when it was enabled while the `subscribe` was in progress. `disable_auto_subscription` ends the server's
subscription; as with `unsubscribe`, the device ends it at its next report.

### Commands

**device_command** - Send a command to a device. Identical commands (same node, endpoint, cluster, command, payload and `timed_request_timeout_ms`) sent in parallel on the same connection are sent to the device once and share the result; commands from different connections are always sent separately.

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

A LIT peer re-registers automatically once subscribed. With `--disable-auto-subscription` the server only drops the
local registration and does not reconnect, unless `enable_auto_subscription` switched the server's own subscription
to the node on; the device registers again only through `register_icd`, which needs the server's own subscription
and so fails for a node without it. A subscription opened with `subscribe` does not count.

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

### Subscription Events

**subscription_report** - A report after the priming report of a subscription opened with `subscribe` (schema 14)

Sent only to the connection that opened the subscription, also when it has not called `start_listening`.

```json
{
  "event": "subscription_report",
  "data": {
    "subscription_id": 2864434397,
    "attributes": { "1/6/0": true },
    "events": []
  }
}
```

`attributes`, `events`, `attribute_status` and `event_status` have the shapes of the `read` result.

Like `node_event`, `subscription_report` is queued under backpressure: when a connection does not read fast enough
and its outgoing queue passes the limit, the oldest queued events are dropped, reports included.
`subscription_ended` is never dropped; it is sent ahead of reports still queued. A report for a subscription can
therefore arrive after its `unsubscribe` response or after its `subscription_ended`. Ignore reports for
subscription ids you no longer track.

**subscription_ended** - A subscription opened with `subscribe` ended without `unsubscribe` (schema 14)

Sent only to the owning connection, for example when the node was removed or the device stopped reporting.

```json
{
  "event": "subscription_ended",
  "data": { "subscription_id": 2864434397 }
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
    "schema_version": 13,
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

A value of a cluster, attribute or event that the server's data model does not know (for example a manufacturer
cluster without a custom cluster definition, or an attribute newer than the server) is sent as decoded from the TLV:
a structure becomes an object keyed by the member's tag number (`{"1": 5, "3": {"0": "a"}}`), bytes become base64,
lists become arrays. This also applies to the event data of `node_event`, which is otherwise keyed by field name.
Exception: the `FeatureMap` of an unknown cluster is sent as `{}`, because matter.js cannot decode its bits without the
cluster definition.

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

The current schema version is **13** (minimum supported **11**). Commands and events marked **(schema 13+)** were added in schema 13. Those marked schema 14 are implemented but not advertised yet: `server_info` reports 13 until the version is raised. See [the schema changelog](websocket-api-schema-changelog.md) for what each version added. The server reports `schema_version` and `min_supported_schema_version` in the initial connection message and via `server_info`. Clients should verify that the server's `schema_version` is within their supported range.

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

## Python Matter Server Compatibility

This API is designed to be compatible with the [Python Matter Server](https://github.com/home-assistant-libs/python-matter-server) WebSocket API.

### Stub Commands

| Command | Status | Notes |
|---------|--------|-------|
| `subscribe_attribute` | Not supported | Answers `InvalidCommand`. The server subscribes to all attributes on its own; use `subscribe` (schema 14) for a subscription of your own |

### Matter.js-Only Commands

These commands are available only in the Matter.js server and not in the Python Matter Server:

| Command | Description |
|---------|-------------|
| `get_loglevel` | Get current console and file log levels |
| `set_loglevel` | Temporarily change log levels (resets on restart) |
| `get_icd_state` | Get ICD Check-In state for a node |
| `register_icd` | Register this controller as an ICD Check-In client |
| `unregister_icd` | Drop this controller's ICD Check-In registration |
| `resync_icd` | Drop the local ICD registration and reconnect (with `--disable-auto-subscription`: only drop it, unless the node's auto subscription is enabled) |
| `get_network_topology` | Return the Thread/Wi-Fi network as a graph (schema 13+) |
| `initiate_ota_upload` | Reserve an id for the `POST /ota-upload/<upload_id>` HTTP endpoint (schema 13+) |
| `read` | Read attributes and events in one Matter Read request (schema 14+) |
| `subscribe` | Open a Matter subscription owned by the connection (schema 14+) |
| `unsubscribe` | End a subscription opened with `subscribe` (schema 14+) |
| `enable_auto_subscription` | Switch the server's own subscription to one node on, with `--disable-auto-subscription` (schema 14+) |
| `disable_auto_subscription` | Switch the server's own subscription to one node off again (schema 14+) |

### Data Differences

| Field | Python | Matter.js |
|-------|--------|-----------|
| `MatterNode.attribute_subscriptions` | Tracks per-node subscriptions | Always empty array |
| Test node IDs | `>= 900000` | `>= 0xFFFF_FFFE_0000_0000` |

### Behavioral Differences

- **Fabric Label**: `set_default_fabric_label` with null/empty resets to "Home" instead of clearing
- **Attribute Subscriptions**: All attributes are subscribed automatically (unless the server runs with `--disable-auto-subscription`); the `attribute_subscriptions` field is not used
- **Test Nodes**: Use high bigint range to prevent collision with real Matter node IDs
