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
- **`set_wifi_credentials` blank-password semantics.** An empty `credentials` on `set_wifi_credentials` keeps the stored (write-only) password **only when the `ssid` is unchanged** — it lets a client re-save an entry without resending the secret. If the `ssid` changes, the old password is dropped (not re-paired with the new network), and `server_info.wifi_credentials_set` reports `false` until a password is supplied.

### Thread Network diagnostics

- **New command `get_thread_diagnostics`** → per-Thread-network `ThreadDiagnosticsBatch` (or an array of them for the no-argument form; `undefined` when nothing is cached). Args: optional `extPanId` (single network) and `force` (bypass cache).
- **New event `thread_diagnostics_updated`** → a `ThreadDiagnosticsBatch`, emitted as batches stream in from Border Routers. **Delivered only to connections that have issued a Thread request** (`get_thread_diagnostics` or `get_thread_border_routers`) during their lifetime. This gates the schema-12 event away from older (schema-11) clients — which would disconnect on an unknown event type — until they opt in by requesting Thread data. A client that never uses the Thread API never receives it.
- **`get_thread_border_routers`** entries gained mDNS-sourced fields (software/record version, border-agent id).

See `packages/ws-client/src/models/model.ts` for the exact `ThreadDiagnosticsBatch` /
`ThreadDiagnosticsNode` / `BorderRouterEntry` wire shapes (each field is documented inline,
with the schema version that introduced it).
