# WebSocket API Schema Changelog

The server advertises a `schema_version` in its `server_info` on connect. Clients gate
version-dependent commands/fields with `require_schema`, and the server keeps supporting a
minimum schema so older clients keep working. This page tracks, per schema version, which
commands, arguments, events, and wire fields were added or changed — so client authors can
see exactly what a given schema level provides.

The server-side constants live in `packages/ws-controller/src/server/WebSocketControllerHandler.ts`
(`SCHEMA_VERSION`, `MIN_SUPPORTED_SCHEMA_VERSION`). Versions predating this document are not
listed retroactively; entries start at the first version maintained here.

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
