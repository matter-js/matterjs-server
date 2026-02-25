# GitHub Copilot Instructions

## Project Overview

A Matter.js-based controller with a Python Matter Server-compatible WebSocket interface, designed for Home Assistant integration. The server listens on `localhost:5580/ws` and speaks the same protocol as the Python Matter Server, making it a drop-in replacement for Home Assistant's Matter integration.

## Build, Test & Lint Commands

```bash
# Install and full build
npm i

# Incremental build
npm run build

# Clean rebuild
npm run build-clean

# Run all tests
npm test

# Run a single test file
npx mocha --require tsx path/to/SomeTest.ts

# Lint
npm run lint
npm run lint-fix

# Format (rewrites files in-place — run BEFORE lint/build)
npm run format
npm run format-verify
```

> **MANDATORY — no exceptions:** After every code change, always run these four commands **in this exact order** before considering the work done:
> ```bash
> npm run format   # rewrites files in-place — MUST be first
> npm run lint
> npm run build
> npm test
> ```
> Skipping `format` is the most common mistake — oxfmt rewrites files in-place and the build/lint validate the formatted output. If you skip it, CI will fail.

**CI enforces formatting and linting.** The `check-and-lint` job in `build-test.js.yml` runs `npm run format-verify` and `npm run lint` and all other CI jobs (`test`, `build-non-linux`) are gated on it. PRs will fail if either check does not pass.

### Debugging

```bash
# Send a WebSocket command to a running server
npm run send-command -- ws://localhost:5580/ws server_info
npm run send-command -- ws://localhost:5580/ws get_node '{"node_id": 1}'
npm run send-command -- ws://localhost:5580/ws device_command '{"node_id":1,"endpoint_id":1,"cluster_id":6,"command_name":"toggle","payload":{}}'
```

## Monorepo Structure

npm workspaces with six packages:

| Package | Name | Role |
|---------|------|------|
| `packages/tools` | `@matter/tools` | Private build infrastructure (esbuild + TSC). Provides `matter-build`, `matter-run`, `matter-version` binaries. **Never published.** |
| `packages/custom-clusters` | `@matter-server/custom-clusters` | Vendor-specific Matter cluster definitions (Eve, Inovelli, Heiman, etc.) registered into the Matter model at startup |
| `packages/ws-controller` | `@matter-server/ws-controller` | Core library: wraps `@project-chip/matter.js`, exports `MatterController`, `ControllerCommandHandler`, `WebSocketControllerHandler`, `ConfigStorage` |
| `packages/ws-client` | `@matter-server/ws-client` | WebSocket client library (used by the dashboard and for external consumers) |
| `packages/dashboard` | `@matter-server/dashboard` | Web UI (Lit + Material Web + Rollup) |
| `packages/matter-server` | `matter-server` | Main entry point: Express HTTP server, wires everything together |

## Architecture

### Server startup flow
`MatterServer.ts` → CLI options → Logger setup → `ConfigStorage` + `MatterController` → `WebServer` with:
- `WebSocketControllerHandler` — Python Matter Server-compatible WS API on `/ws`
- `StaticFileHandler` — serves dashboard assets
- `HealthHandler` — `/health` endpoint

Custom clusters are registered at import time via `import "@matter-server/custom-clusters"` in `MatterServer.ts`. The registration in `custom-clusters/src/register.ts` pushes each cluster definition into `MatterModel` and `ClusterRegistry`.

### WebSocket Protocol (Schema version 11)
Messages follow the Python Matter Server protocol. Key commands: `start_listening`, `commission_with_code`, `commission_on_network`, `device_command`, `read_attribute`, `write_attribute`, `subscribe_attribute`, `get_nodes`, `get_node`, `server_info`, `diagnostics`.

Events emitted to all clients: `node_added`, `node_updated`, `node_removed`, `attribute_updated`.

`start_listening` response is not logged (see `skipMessageContentInLogFor` in `WebSocketControllerHandler.ts`).

### Attribute path format
All `MatterNode.attributes` keys and attribute event paths use `"endpointId/clusterId/attributeId"` as decimal strings (e.g., `"0/40/4"` = endpoint 0, BasicInformation cluster, SoftwareVersion). Wildcards (`*`) are supported in read/subscribe commands.

### BigInt handling
The WS protocol uses a custom JSON serialiser (`toBigIntAwareJson`) and parser (`parseBigIntAwareJson`). Large numbers (≥15 digits, exceeding `MAX_SAFE_INTEGER`) are transmitted as raw decimal numbers (not quoted). Use these helpers — not `JSON.stringify/parse` — whenever serialising WS messages.

### Event broadcasting rules
Attribute changes normally emit granular `attribute_updated` events. Changes to the **BasicInformation** (0x28) or **BridgedDeviceBasicInformation** (0x39) clusters trigger a full `node_updated` broadcast instead (firmware version, product name, etc. are reflected in the node object).

### `ModelMapper` / cluster metadata
`ClusterMap` in `ws-controller/src/model/ModelMapper.ts` is built at module load time from `MatterModel.standard`. It indexes clusters by lowercase name and numeric ID. `GlobalAttributes` (IDs 65528–65533) are indexed by both name and numeric ID to support decoding in custom/unknown clusters.

## Dashboard

Built with **Lit 3.x**, **Material Web 2.4.x** (`md-*` elements), and **`@mdi/js`** SVG icons.

### Critical styling rule
**Never use hardcoded colors.** Always use CSS variables defined in `public/index.html`:
```css
/* Correct */
color: var(--text-color, rgba(0,0,0,0.6));
background: var(--md-sys-color-surface);

/* Wrong */
color: #333;
color: grey;
```
Key variables: `--md-sys-color-primary/surface/on-surface/on-surface-variant`, `--text-color`, `--danger-color`, `--primary-color`.

Dark mode is applied via `html.dark-theme body` overrides. Always verify changes in both themes.

### Dashboard build pipeline
The dashboard build runs: `generate` (produces `src/client/models/descriptions.ts` from cluster definitions) → `matter-build` (TSC + esbuild) → `bundle` (Rollup + Babel). The root `npm run build` orchestrates this automatically.

### Dashboard conventions
- Component styles: `static override styles = css\`...\`` (Lit inline pattern)
- Icons: import SVG paths from `@mdi/js` (e.g., `mdiSignalCellular3`) and render via `<ha-svg-icon .path=${...}>`
Base tsconfig targets **ES2022**. The dashboard includes the `"es2023"` lib to enable ES2023 features such as `Array.prototype.toSorted()`.
- Theme management: `src/util/theme-service.ts` singleton; supports `light`/`dark`/`system`; persisted in `localStorage` as `matterTheme`
- The dashboard connects to the server via `@matter-server/ws-client`; avoid `location.reload()` when server may be offline — use WebSocket reconnect instead
- Connection lists (Thread neighbors, WiFi nodes) are sorted by signal quality descending: RSSI preferred, LQI as fallback, missing values sort last

### TypeScript target
Base tsconfig targets **ES2022**. The dashboard adds `"ES2023.Array"` to its lib to enable `Array.prototype.toSorted()`.

## Custom Clusters

To add a vendor cluster:
1. Create `packages/custom-clusters/src/clusters/<vendor>.ts` using the decorator-based DSL (`@cluster`, `@attribute`, `@writable`, etc. from `@matter/main/model`)
2. Export it from `packages/custom-clusters/src/clusters/index.ts`
3. Run `npm run generate` (inside `packages/dashboard`) to regenerate `descriptions.ts`

## Plan Documents

Files in `docs/plans/` are working documents only — **never commit them to git**.

## Node.js Requirement

`>=20.19.0 <22.0.0 || >=22.13.0`
