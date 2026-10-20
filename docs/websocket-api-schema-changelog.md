# WebSocket API Schema Changelog

The server advertises a `schema_version` in its `server_info` on connect. Clients gate
version-dependent commands/fields with `require_schema`, and the server keeps supporting a
minimum schema so older clients keep working. This page tracks, per schema version, which
commands, arguments, events, and wire fields were added or changed — so client authors can
see exactly what a given schema level provides.

The server-side constants live in `packages/ws-controller/src/server/WebSocketControllerHandler.ts`
(`SCHEMA_VERSION`, `MIN_SUPPORTED_SCHEMA_VERSION`). Versions predating this document are not
listed retroactively; entries start at the first version maintained here.

## Schema 14

Minimum supported: 11 (older clients keep working with the pre-14 command shapes).

Clients detect everything below via `server_info.schema_version >= 14`. The full reference, with every
argument, range and error payload, is in [websockets_api.md](websockets_api.md#camera-streaming-schema-14).

### Camera API

A convenience API for Matter cameras. The server manages the camera's streams for the client: it
picks stream settings the camera supports, reuses a matching stream when one exists, allocates a new
one otherwise, frees idle streams when the camera runs out of capacity, and tracks each WebRTC
session. A client that wants to do this itself can still use the Matter commands directly
(`send_webrtc_provider_command`, or `device_command` with the cluster's own commands).

New commands:

- **`camera_get_capabilities`** — what the camera says it supports: video and audio codecs, sensor
  size, frame rates, snapshot formats, encoder limits, supported features, privacy switches, the
  streams currently allocated, and the WebRTC sessions the camera holds. It reports only what the
  camera states; there is no resolution list, because the camera does not publish one.
- **`camera_start_stream`** — opens a WebRTC session. The client can limit video (codecs, resolution,
  frame rate, bit rate, watermark and on-screen display) and audio (codec, channels, sample rate,
  bit rate). The server never goes outside these limits: if no stream fits them, the call fails with
  error 102 instead of returning something the client did not ask for. The response names the
  session id, each stream, and whether the stream was newly allocated or reused. The camera is
  asked to play the client's audio only with `talkback: true`; otherwise the server makes the
  offer's audio sections not send. The response's `talkback` says whether the server expects the
  camera to take the client's audio: it needs the flag, an offer that sends audio, a camera that
  states it can talk back and an audio stream in the session. An optional `client_session_key` (1 to
  128 characters, unique among the connection's starting and open sessions) is the client's own name
  for the session: every event of the session carries it, and the two commands below accept it in
  place of the session id, also before the response arrived.
- **`camera_provide_answer`**, **`camera_provide_ice_candidates`** — send the client's SDP answer and
  ICE candidates for a session, so a client never needs the raw WebRTC commands. Candidates sent with a
  `client_session_key` while the session is still starting are queued and sent after the
  `camera_start_stream` response.
- **`camera_stop_stream`** — ends a session. The streams stay allocated for reuse. It also ends a
  session left open by a server restart (the session id is listed by `camera_get_capabilities`). With
  a `client_session_key` whose start is still running, it cancels that start.
- **`camera_snapshot`** — captures one image and returns it base64-encoded. The snapshot stream stays
  allocated for the next call. Optional `resolution` (`{ width }`, `{ height }` or both) states the size
  the client wants: the server picks the smallest fitting capability and asks the camera to scale the
  image to it. `max_resolution` stays a ceiling.
- **`camera_release_stream`** — deallocates a stream. The camera refuses while a session still uses
  it (error 104).

New events, sent only to connections that have used a `camera_*` command. `send_webrtc_provider_command`
opts a connection in to `webrtc_callback` only:

- **`camera_session_ended`** — a session this connection opened ended without its own command. Sent for
  every such end, the camera's own `End` included, so a client listens in one place. `cause` says why:
  `peer`, `other_connection`, `camera_restarted`, `camera_dropped` or `node_removed`; `reason` carries the
  camera's end reason for `peer`.
- **`camera_stream_evicted`** — the server deallocated an idle stream to make room for a new request.
  Whoever used that stream has to allocate it again.

Behaviour worth knowing:

- Codecs, stream usages and talk modes are names (`H264`, `LiveView`, `FullDuplex`), not numbers. A
  name from `camera_get_capabilities` can be sent back unchanged.
- The camera commands accept only a `node_id` that names a node (not a group or another special id),
  and refuse unknown arguments with error 8.
- A failed `camera_start_stream` or `camera_snapshot` frees the streams it allocated.
- A new video stream runs at 30 fps at most unless the client asks for more with `max_frame_rate` or
  `min_frame_rate`. Some cameras accept higher rates they cannot deliver.
- When the camera is out of capacity, the server first lowers its own default settings, then frees an
  idle stream: its own snapshot streams, its own video streams, then another controller's snapshot
  streams and video streams. `allow_eviction: false` stops it from freeing streams.
- A stream already on the camera is reused whatever its stream usage, when it fits the request. The
  session keeps the `stream_usage` the client asked for.
- When the camera answers an allocate with a stream it already has, the server checks that stream
  against the bounds the caller stated. For video it then looks for another existing stream within
  the bounds and fails with error 102 only when there is none. A snapshot stream outside the bounds
  fails with error 102; an audio stream outside them is dropped unless the caller demanded audio.
- The `webrtc_callback` events of a session opened with `camera_start_stream` arrive after its
  response. A client library may still run an event handler before the code after the awaited
  response, so match events by `client_session_key` rather than by `webrtc_session_id`.
- After an unclean stop, the server ends the sessions a camera still holds for it once the camera's
  first report arrives, so they do not keep streams pinned.
- When a camera refuses a `SolicitOffer`, or a `ProvideOffer` for a new session, with a `turns:` or
  `stuns:` ICE server as `INVALID_IN_STATE` (`camera_start_stream` and `send_webrtc_provider_command`),
  the server pushes its time and sends the same offer once more: the camera refuses such an offer while
  its UTC time is not set (§ 11.5.6.1.10, § 11.5.6.3.12). An accepted offer costs no extra request. If the
  push fails or the second offer is refused, the client gets the camera's refusal.
- Changing a running session (ICE restart, other tracks) needs a new `ProvideOffer` on the raw
  `send_webrtc_provider_command` route; `camera_start_stream` always opens a new session.

### New error codes 102–106

OHF extensions; python-matter-server codes stop at 11. Each carries JSON details (see
[camera error details](websockets_api.md#camera-error-details)).

- **102 `CameraStreamIncompatible`** — the camera, the SDP offer or the request rules the stream out.
  `reason` says which, and whether the client can fix it by changing the arguments (`codec`,
  `bounds`), by changing the SDP offer (`offer`, `level`), or not at all (`feature`, `capability`,
  `no_media`).
- **103 `CameraResourceExhausted`** — the camera has no capacity left. `allocated` lists the streams
  that use it, so a client can release one of its own and retry.
- **104 `CameraStreamInUse`** — `camera_release_stream` on a stream a session still uses.
- **105 `CameraNotSupported`** — the endpoint lacks a camera cluster the command needs.
- **106 `CameraPrivacyMode`** — a privacy switch on the camera blocks the request.

### Changes to existing commands and events

- **`send_webrtc_provider_command`**
  - Also relays `ProvideAnswer` and `ProvideIceCandidates`. `EndSession` goes through
    `camera_stop_stream`.
  - The camera's answer to an offer sent this way reaches the `answer` event with each media section's
    direction narrowed to what that offer allows (RFC 3264 §6.1), re-offers included.
  - Checks every payload field against the cluster definition and refuses a bad field with error 8.
    Newly refused: unknown keys, the same field given twice, missing mandatory fields, and a payload
    that gives both the stream list and the old single stream id.
  - `ice_servers` takes the documented `{ urls, username?, credential?, caid? }` shape. Before, that
    shape failed in the encoder.
  - Payload keys match with case and separators ignored, so `webrtc_session_id` and `sdpMLineIndex`
    are accepted.
- **`webrtc_callback`** — a session opened with `camera_start_stream` sends its events only to the
  connection that opened it. The opt-in now happens before the command runs, so the camera's first
  answer is no longer lost.
- **`device_command` with `EndSession`** also produces `camera_session_ended`.
- **`commission_on_network` `filter_type` 4** searches by the device type in `filter`; before, it
  searched for any device. Without `filter` it is refused with error 8.
- **`device_command` `interaction_timeout_ms`** is applied to the command; before, the server accepted
  it and ignored it. Anything other than an integer from 0 to 2^53-1 is refused with error 8.
- **New command `batched_device_commands`** `{ node_id, commands: [{ endpoint_id, cluster_id, command_name, payload? }],
  timed_request_timeout_ms?, interaction_timeout_ms? }` → `[{ status, cluster_status?, response? }]`, one entry per
  command in request order. Sends all commands in one InvokeRequest, never split or combined with other commands.
  Refused with `InvalidArguments` before sending: an empty list, a bad command, more commands than the node's
  MaxPathsPerInvoke, an invalid timeout, a Group Node ID or a WebRTC Transport Provider command.
- **`device_command`** refuses a command that is not in the server's model for the cluster, or fields matter.js cannot
  encode, with `InvalidArguments`; before, it failed with `UnknownError`.
- **`write_attribute`** takes `*` as the endpoint for a unicast node and writes every endpoint that has the
  attribute in one Write request; the result has one entry per endpoint the device answered for. The new
  `timed_request_timeout_ms` (0 to 65535; 0 counts as not given) sends a timed write. A wildcard cluster or
  attribute stays refused, and so does a malformed path to a node (only digits or `*` per segment, three segments).
- **`device_command` `timed_request_timeout_ms`** that is not an integer from 0 to 65535 is refused with error 8;
  before, such a value was ignored and the command was sent without a timed request.
- **`args`** — every command treats a missing or `null` `args` as no arguments, and refuses a
  non-object `args` with error 8.
- **`node_id`** — every command that targets a node refuses a `node_id` that can never name one (a
  CAT, PAKE, Unspecified or reserved id, and a Group id except on the two commands below) with error 8.
  Before, it answered `NODE_NOT_EXISTS`.
- **`write_attribute` and `device_command` to a Group Node ID** send a groupcast and answer `null`.
  The attribute path takes a wildcard endpoint. Before, a group write answered status 0, a success no
  device reported.

### Commissioning window

- **`discriminator`, `vendor_id`, `product_id`, `commissioning_timeout` in the `open_commissioning_window` result** (presence-detectable only: some schema-13 servers send them too, so check for the fields, not the schema version). `discriminator` is the long (12-bit) discriminator the device advertises while the window is open, `vendor_id`/`product_id` are the device's Vendor-ID and Product-ID from the BasicInformation cluster, `commissioning_timeout` is the window duration in seconds. They match the values encoded in the returned pairing codes; they are returned separately so clients (for example mobile apps sharing the device to another ecosystem) need no Matter QR decoder.

### Node data

- **`endpoint_parents` in node data** (every message that carries node data, for example `get_node`, `start_listening` and `node_updated`). Maps endpoints in `attributes` other than 0 to their direct parent endpoint (JSON keys are strings), `0` for a top-level endpoint. An endpoint whose parent the server does not know has no entry. A test node imported from a dump without the field has none. When the field is absent (server below schema 14, or such a test node), derive the parents from the Descriptor PartsLists as before.

### Error details

- **Optional `status` / `cluster_status` on error responses**: the Matter status the device answered with, when matter.js reports the failure as one: always for a `device_command` the device rejected, not for commands the server sends on its own behalf. `error_code` is unchanged.
- **Optional `reason` on `NodeCommissionFailed` errors of `commission_with_code` / `commission_on_network`, and on an undecodable pairing code**: `not-discovered`, `passcode-mismatch`, `invalid-payload`, `attestation-rejected`, `timeout` or `other`. A pairing code that cannot be decoded now fails with `InvalidArguments` and `reason: "invalid-payload"` instead of `UnknownError`.
- **Optional `ClusterStatus` in the `write_attribute` result**, next to `Status`, when the device sent a cluster-specific status.

### Commissioning

- **New command `parse_onboarding_payload`** `{ code }` → `{ type: "qr", payloads: [{ version, vendor_id?, product_id?,
  flow_type, discovery_capabilities, discriminator, setup_pin_code }] }` or `{ type: "manual",
  short_discriminator, setup_pin_code, vendor_id?, product_id? }`. Decodes a code as `commission_with_code` does, without
  contacting a device. An undecodable code fails with `InvalidArguments` and `reason` `invalid-payload`; an unexpected
  error while decoding fails with `SDKStackError`.
- **Optional `discovery_timeout_s` on `commission_with_code` and `commission_on_network`**: how long, in seconds, to find the device and set up PASE with it (above 0, at most 172800; `null` counts as not given). Without it matter.js searches for 3 minutes. The commissioning steps after PASE are not limited, and on `commission_on_network` the attempt at `ip_addr` keeps the matter.js PASE limit.

### Subscriptions and generic read

Meant only for the special `--disable-auto-subscription` mode, not for normal operation; the server's own subscription is much more reliable.

- **New command `read`** → `{ attributes, events, attribute_status?, event_status? }`. One Matter Read request with `attribute_paths`, `event_paths` (`[{ path }]`, `path` is `endpoint/cluster/event`), `event_min`, `fabric_filtered` (default `true`) and `data_version_filters` (`[{ path: "endpoint/cluster", data_version }]`). Without `event_min` the request has no event filter and returns all events the device holds. Refused with `InvalidArguments` before anything is sent: an argument of the wrong type, a malformed path or invalid id, no path, `event_min` or `data_version` out of range, `event_min` without `event_paths` and a non-empty `data_version_filters` without `attribute_paths`. `attributes` uses the `read_attribute` shape, `events` the `node_event` shape. `attribute_status` / `event_status` map each path the device answered with a status to `{ status, cluster_status? }` (numeric Matter status codes) and are left out when there is none.
- **New command `subscribe`** → `{ subscription_id, attributes, events, attribute_status?, event_status? }`: the id and the priming report in the `read` result shape. The `read` arguments plus `min_interval` / `max_interval` (seconds), `is_urgent` per event path and `keep_subscriptions` (default `false`, passed to the device as given; `false`, also when left out, ends all other subscriptions of this controller to the same node, including those of other connections, which arrive as `subscription_ended` at their connections). Only available when the server runs with `--disable-auto-subscription` and the node's auto subscription is off, otherwise `InvalidArguments`. `subscription_id` is the SubscriptionId the device assigned. The `read` refusals apply, and intervals outside 0 to 65535 or `max_interval` below `min_interval` are refused with `InvalidArguments` too. The subscription belongs to the connection that opened it and ends with `unsubscribe`, when that connection closes, when the node is removed or when the server shuts down.
- **`data_versions`** in the `read` and `subscribe` results and in `subscription_report`: `{ "endpoint/cluster":
  data_version }` for each cluster with a reported attribute value, left out when there is none. `subscribe` sends only
  the data version filters the caller gives, as `read` does, so the priming report holds every requested cluster the
  caller does not filter.
- **New command `unsubscribe`** (`{ node_id, subscription_id }`) → `null`. Ids are assigned per device, so the node is part of the name. Only available with `--disable-auto-subscription`. A `subscription_id` that is not an integer from 0 to 2^32-1, and a subscription this connection does not hold under that node and id, give `InvalidArguments`.
- **New commands `enable_auto_subscription` and `disable_auto_subscription`** (`{ node_id }`) → `null`. Switch the server's own subscription to one node on or off. Only available with `--disable-auto-subscription`, otherwise `InvalidArguments`; not kept across a restart. `enable_auto_subscription` returns once the server's subscription is active and fails with `NodeNotResolving` when matter.js finds the device unreachable while waiting, `NodeNotReady` when the subscription is not active within 4 minutes 15 seconds, `NodeNotExists` when the node is removed meanwhile and `UnknownError` when the server shuts down meanwhile, and the node then stays switched on; it fails with `NodeNotReady` when `disable_auto_subscription` switches the node off meanwhile, also during a `resync_icd`, and when a `resync_icd` meanwhile cannot switch the subscription back on. `disable_auto_subscription` returns once the subscription is closed. Enabling ends the node's subscriptions opened with `subscribe` (`subscription_ended`), and `subscribe` for a node with auto subscription on gives `InvalidArguments`.
- **New event `subscription_report`** → `{ node_id, subscription_id, attributes, events, attribute_status?, event_status? }`. Sent only to the connection that opened the subscription, whether or not it called `start_listening`; it carries the reports after the priming report, which the `subscribe` response carries.
- **New event `subscription_ended`** → `{ node_id, subscription_id }`. Sent to the owning connection when its subscription ends without `unsubscribe` (node removed, device stopped reporting, another subscription with `keep_subscriptions: false`); not sent for `unsubscribe`, when the connection closes or when the server shuts down (the connections are closed first; `server_shutdown` announces it). Never dropped under backpressure; reports for the id can still arrive after it.
- **`subscribe_attribute` removed from the client model.** The server never implemented it and answers `InvalidCommand`.

## Schema 13

Minimum supported: 11 (older clients keep working with the pre-13 command shapes).

### Network topology

- **New command `get_network_topology`** → a `NetworkTopology` (`{ collected_at, nodes[], connections[] }`) describing the whole Matter network as a graph: the Thread mesh (nodes + neighbor/route-table links, with external neighbors and mDNS-discovered Border Routers) and the Wi-Fi star (one `wifi_ap` pseudo-node per BSSID — id `ap_<BSSID>` with colons stripped, e.g. `ap_112233445566` — stations linked to it). Ethernet nodes appear unlinked. Optional `refresh` argument re-reads the Thread neighbor/route tables, routing role and network name (and Wi-Fi diagnostics) from every online node before building the snapshot (slower — seconds; best-effort, concurrency-capped, under an overall deadline, and shared between concurrent requesters); omitted/`false` builds from the current attribute cache.
  - Node kinds: `matter` (commissioned here; carries `node_id`), `border_router`, `thread_unknown` (a neighbour not commissioned on this fabric), `wifi_ap`. Thread connections keep both observed directions (`source_to_target` / `target_to_source`) so asymmetric links stay legible; the top-level `strength` is the strongest observed direction. `strength` values are `strong` / `medium` / `weak` / `none` / `unknown` — `none` means the link was observed dead (Thread pairs with no live direction are omitted entirely), `unknown` means no measurement was available (e.g. a Wi-Fi station whose RSSI can't be read) and must not be rendered as a dead link. Border Router classification depends on mDNS discovery: when the server runs with Thread diagnostics disabled, no `border_router` nodes appear and every external neighbour is reported as `thread_unknown`.
- **New event `network_topology_updated`** → a `NetworkTopology`, emitted (debounced, latest-wins coalesced) whenever the derived graph changes, plus a slow periodic refresh so sleepy-device drift is eventually reflected. **Delivered only to connections that have issued `get_network_topology`** during their lifetime — mirroring the schema-12 `thread_diagnostics_updated` opt-in so pre-schema-13 clients never receive an event type they didn't subscribe to. **Outgoing events carry no `require_schema`**; clients detect support via `server_info.schema_version >= 13`.
- **`host_name` on `border_router` nodes** (added after 1.4.0 shipped schema 13, so there is **no version signal** for it — treat it as presence-detectable only). The Border Router's mDNS host name as a *display label*, not an address: the trailing dot and a `.local` suffix are stripped (`"Cuisine.local."` -> `"Cuisine"`). Several vendors report an identical `vendor_name`/`model_name` pair for every unit they ship, which renders a multi-BR network as a row of identical labels; prefer `host_name` when present and keep the `vendor_name`/`model_name` fallback, which is permanent — the field is absent both on older servers and whenever a Border Router's `_meshcop` SRV host name was never resolved. The raw FQDN remains available verbatim via the schema-12 `get_thread_border_routers`.
- **`ssid` / `bssid` on Wi-Fi nodes** (also added after 1.4.0, presence-detectable only). Both are set on `wifi_ap` nodes and on the `matter` stations joined to them — stations previously carried no network identity at all. `bssid` is the radio address that `network_name` already carries on `wifi_ap` nodes, now under a self-describing name; `network_name` keeps its old value there so existing consumers are unaffected, and is superseded for Wi-Fi. `ssid` comes from NetworkCommissioning (`0/49/1`), whose `networkID` is the SSID only for Wi-Fi — it is the extended PAN id for Thread and the interface name for Ethernet — and some devices leave it empty, so a `bssid` fallback stays necessary. Note that one BSSID is one AP radio: a mesh reports several `wifi_ap` nodes sharing an `ssid`.

See `packages/ws-client/src/models/model.ts` for the exact `NetworkTopology` / `NetworkTopologyNode` /
`NetworkTopologyConnection` wire shapes (each field documented inline).

> This first iteration derives Thread links from the nodes' own `ThreadNetworkDiagnostics` (neighbor +
> route tables) and classifies externals against the passively-discovered Border Router registry. The
> richer MeshCoP diagnostic enrichment (route64 / childTable → router-to-router links and
> diagnostic-only mesh nodes) is a planned follow-up; the wire model already accommodates it.

### OTA firmware upload

- **New command `initiate_ota_upload`** (no arguments) → `{ upload_id, expires_in, max_size }`. Authorizes exactly one upload of a local `.ota` firmware image and claims one of the server's limited in-flight upload slots. `upload_id` is a random 32-hex string, single-use, bound to the client that reserved it, and valid for `expires_in` seconds — that window bounds when the following POST may *start*; the transfer itself is bounded by `max_size` (bytes), not by time. Fails with `OtaUploadError` (101) when OTA support is disabled (`--disable-ota`) or all slots are taken (`--ota-upload-max-in-flight`, default 5).
- **New HTTP endpoint `POST /ota-upload/<upload_id>`** on the same listener as `/ws` — not a WebSocket command, so a firmware image neither pays the ~33% base64 overhead nor has to be buffered whole in memory. Body is the raw `.ota` bytes. Answers `200` with a `MatterSoftwareVersion` (`update_source: "local"`), `400` `{ error_code, message }` for a corrupt image / unknown / expired / already-used / foreign-client id, `404` for a malformed id, `413` when the image exceeds `max_size` (`--ota-upload-max-size-mb`, default 64). The reservation and the staged file are always discarded before the response is sent, success or failure.
- **New error code `OtaUploadError` = 101** (OHF extension; python-matter-server codes stop at 11).
- Stored images are indexed by the vendor ID / product ID / software version in their header, not against a node: `check_node_update` surfaces one for any node whose vendor/product matches (its cached answer for that vendor/product is dropped on upload). *Test* images are only served when the server also runs with `--enable-test-net-dcl`, the same restriction that applies to `--ota-provider-dir`.
- **Clients detect support via `server_info.schema_version >= 13`** — the endpoint is unavailable both on older servers and when OTA is disabled.

## Schema 12

Minimum supported: 11 (older clients keep working with the pre-12 command shapes).

### Credentials — named credential lists

- **New command `get_all_credentials`** → `{ wifi: { id, ssid }[], thread: { id, networkName, extPanId }[] }` (summaries only; secrets stay write-only and are never returned).
- **Optional `id` argument** on `set_wifi_credentials`, `set_thread_dataset`, `remove_wifi_credentials`, `remove_thread_dataset`. Omitted → the reserved `default` entry (backward-compatible with pre-12 callers).
- **`wifi_credentials_id` / `thread_dataset_id`** arguments on `commission_with_code`, selecting which stored credential to use.
- **`set_wifi_credentials` blank-password semantics.** A password is required on set; an empty `credentials` is accepted only to keep the stored (write-only) password when the `ssid` is unchanged (re-saving an entry without resending the secret). A blank credential with a new/changed SSID — or on a first set with nothing to keep — is rejected (`invalid_arguments`), so the old secret is never re-paired with a different network. To clear an entry — including the reserved `default` — use `remove_wifi_credentials` / `remove_thread_dataset`, which zeroes both the SSID and the secret. (`set_thread_dataset` likewise requires a non-empty dataset.)

### Thread Network diagnostics

- **New command `get_thread_diagnostics`.** Args: optional `ext_pan_id` (single network) and `force` (bypass cache).
  - With `ext_pan_id`: awaits a collection and returns the `ThreadDiagnosticsBatch`, or `null` when nothing is cached / diagnostics are disabled.
  - Without `ext_pan_id`: returns the **current cache** for all known networks (an array, possibly empty) **immediately**, and kicks off a background refresh (honoring `force`) whose fresh batches arrive via `thread_diagnostics_updated`. It does not wait for the refresh — use the `ext_pan_id` form when you need synchronously-fresh data for one network. A batch older than the server's cache TTL is not returned, so a caller never receives evidence the server itself would no longer serve as a cache hit. That covers a snapshot of a query that was still running when it was taken (`in_progress`, `meshcop_no_responses_yet`, `rest_no_responses_yet`): what it reports is the state of a query that has long since finished or died. The exception is a batch whose `partialReason` reports a query that ended without data (`timeout`, `dtls_failed`, `border_router_unreachable`, `petition_rejected`, `no_credentials`, `no_source`, `rest_unreachable`, `rest_protocol`); it is returned at any age, because it explains a failure rather than describing a network.
- **`ThreadDiagnosticsBatch.expiresInMs`** (added after the schema 13 release — presence-detectable only): how long the batch stays current, in ms from when the server sent it, absent when it never expires. It is a duration rather than a deadline so a client measures it against its own clock and needs no agreement with the server's. Once it elapses the server stops serving that batch; a client holding one should drop it rather than keep treating it as current.
- **New event `thread_diagnostics_updated`** → a `ThreadDiagnosticsBatch`, emitted as batches stream in from Border Routers. **Delivered only to connections that have issued a Thread request** (`get_thread_diagnostics` or `get_thread_border_routers`) during their lifetime. This gates the schema-12 event away from older (schema-11) clients — which would disconnect on an unknown event type — until they opt in by requesting Thread data. A client that never uses the Thread API never receives it.
- **`get_thread_border_routers`** entries gained mDNS-sourced fields (software/record version, border-agent id).

See `packages/ws-client/src/models/model.ts` for the exact `ThreadDiagnosticsBatch` /
`ThreadDiagnosticsNode` / `BorderRouterEntry` wire shapes (each field is documented inline,
with the schema version that introduced it).

### Fabric label

- **New command `get_fabric_label`** → `{ fabric_label: string | null }` — returns the currently configured fabric label so clients can read it instead of assuming their own value. Counterpart to `set_default_fabric_label`.
- **`set_default_fabric_label` may be ignored.** When the server is started with `--default-fabric-label` (env `DEFAULT_FABRIC_LABEL`), the label is pinned: `set_default_fabric_label` is accepted but does nothing (the server logs the ignored value and keeps the pinned one). Read the effective value with `get_fabric_label`.
- **`set_default_fabric_label` is owned per connection.** Independent of the CLI pin, the first connection to issue `set_default_fabric_label` in a server session owns the label while it stays connected; other connections' set requests are accepted but ignored (and logged) until the owner disconnects. Ownership then passes to the next connection that issues the command.

### WebRTC camera live view

The WebRTC command + event first shipped under schema 11 (PR #644) without being documented or
gated; schema 12 is where they're formally specified, so treat WebRTC as a schema-12 capability
(`server_info.schema_version >= 12`).

- **Command `send_webrtc_provider_command`** (client→server) — relays a `ProvideOffer` / `SolicitOffer`
  to a camera endpoint's WebRTC provider.
- **Event `webrtc_callback`** (server→client) — `offer` / `answer` / `ice_candidates` / `end` for an
  active session (payload `WebRtcCallbackData`). An `offer`'s `ice_servers` use the same
  `{ urls, username?, credential?, caid? }` shape `camera_start_stream` takes, with `urls` a list.
  Servers built on matter.js before 0.18 sent the key as `urLs`; a client that supports them accepts both. **Delivered only to connections that have issued a
  `send_webrtc_provider_command`** during their lifetime — the callbacks reach the client driving that
  camera session, not every connection. (Schema 14 widens that opt-in to the camera commands and routes
  the event to the session's owning connection; see below.) **Outgoing events carry no `require_schema`**: that mechanism
  gates client *requests*, not server-emitted events — clients detect support via
  `server_info.schema_version`.
