# WebSocket API Schema Changelog

The server advertises a `schema_version` in its `server_info` on connect. Clients gate
version-dependent commands/fields with `require_schema`, and the server keeps supporting a
minimum schema so older clients keep working. This page tracks, per schema version, which
commands, arguments, events, and wire fields were added or changed — so client authors can
see exactly what a given schema level provides.

The server-side constants live in `packages/ws-controller/src/server/WebSocketControllerHandler.ts`
(`SCHEMA_VERSION`, `MIN_SUPPORTED_SCHEMA_VERSION`). Versions predating this document are not
listed retroactively; entries start at the first version maintained here.

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
  - Without `ext_pan_id`: returns the **current cache** for all known networks (an array, possibly empty) **immediately**, and kicks off a background refresh (honoring `force`) whose fresh batches arrive via `thread_diagnostics_updated`. It does not wait for the refresh — use the `ext_pan_id` form when you need synchronously-fresh data for one network.
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
  active session (payload `WebRtcCallbackData`). **Delivered only to connections that have issued a
  `send_webrtc_provider_command`** during their lifetime — the callbacks reach the client driving that
  camera session, not every connection. **Outgoing events carry no `require_schema`**: that mechanism
  gates client *requests*, not server-emitted events — clients detect support via
  `server_info.schema_version`.
