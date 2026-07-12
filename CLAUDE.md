# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Matter.js-based controller with a Python Matter Server compatible WebSocket interface, designed for Home Assistant integration. The server listens on `localhost:5580/ws` and provides a WebSocket API compatible with the Home Assistant Matter integration.

## Build & Development Commands

```bash
# Install dependencies and initial build
npm i

# Build all packages (incremental)
npm run build

# Clean build (full rebuild)
npm run build-clean

# Start the server
npm run server

# Start server with options
npm run server -- --storage-path data --primary-interface en0

# Run tests (uses @matter/testing with mocha).
# Integration tests (Commission On Network) need an explicit network interface,
# otherwise mDNS discovery picks up VPN/utun adapters and the test times out.
# Set both env vars to the active LAN interface (e.g. en0):
PRIMARY_INTERFACE=en0 MATTER_MDNS_NETWORKINTERFACE=en0 npm test

# Lint (oxlint with type-aware checking)
npm run lint
npm run lint-fix

# Format (oxfmt)
npm run format
npm run format-verify
```

## Monorepo Structure

This is an npm workspaces monorepo with six packages:

- **packages/ws-controller** (`@matter-server/ws-controller`): Core Matter controller library wrapping `@project-chip/matter.js`. Exports `MatterController`, `ControllerCommandHandler`, `WebSocketControllerHandler`, `ConfigStorage`, `ThreadDiagnosticsService`. Consumes `@matter/thread-br-client` for Thread Border Router discovery/diagnostics.
- **packages/ws-client** (`@matter-server/ws-client`): WebSocket client library + wire models for the Matter server (used by the dashboard and external clients)
- **packages/dashboard** (`@matter-server/dashboard`): Web UI built with Lit, Rollup, and Material Web Components. Connects to server via WebSocket
- **packages/matter-server** (`matter-server`): Main entry point. HTTP/WebSocket server using Express, combines controller + dashboard
- **packages/ble-proxy** (`@matter-server/ble-proxy`): BLE proxy implementation — proxies BLE operations over WebSocket for remote commissioning
- **packages/custom-clusters** (`@matter-server/custom-clusters`): Custom cluster definitions for matter.js-based projects
- Build tooling is provided by the external `@nacho-iot/js-tools` dev dependency (CLI binaries `nacho-build`, `nacho-run`).

## Architecture

### Server Flow

`MatterServer.ts` → creates `ConfigStorage` + `MatterController` → creates `WebServer` with handlers:

- `WebSocketControllerHandler`: Python Matter Server compatible WS API on `/ws`
- `StaticFileHandler`: Serves dashboard assets

### WebSocket Protocol

The server implements a protocol compatible with Home Assistant's Python Matter Server. Key commands:

- `start_listening`, `commission_with_code`, `device_command`, `read_attribute`, `write_attribute`
- Events: `node_added`, `node_updated`, `node_removed`, `attribute_updated`

### Key Dependencies

- `@project-chip/matter.js`: Core Matter protocol implementation
- `@matter/main`, `@matter/main/general`: Matter.js utilities
- `@matter/nodejs-ble`: Optional BLE support (enable with `--ble` flag)

## Build System

Uses external `@nacho-iot/js-tools` build system:

- TSC for type checking and declaration files
- esbuild for transpilation (ESM + CJS)
- Dashboard uses Rollup for bundling with Babel
- Shared tsconfigs live in `/tsc` at repo root (`tsconfig.base.json`, `tsconfig.lib.json`, `tsconfig.test.json`, `tsconfig.app.json`)

Package-level builds: `nacho-build` (aliased in each package.json)

Dashboard has additional `npm run generate` step for cluster descriptions.

## Node.js Requirements

Engine requirement: `>=22.13.0`

## Code Quality

### Tooling

- **Linter**: [oxlint](https://oxc.rs) with type-aware checking (config: `.oxlintrc.json`)
- **Formatter**: [oxfmt](https://oxc.rs) (config: `.oxfmtrc.json`)
- Both are Rust-based and run in <1s across the entire monorepo

### Checklist

**Always run these checks before considering work complete:**

```bash
# 1. Format code (required - MUST run first, oxfmt rewrites files in-place)
npm run format

# 2. Lint (required)
npm run lint

# 3. Build (required)
npm run build

# 4. Run tests (required). See note above — integration tests need both
#    PRIMARY_INTERFACE and MATTER_MDNS_NETWORKINTERFACE set to the active LAN
#    interface (e.g. en0). Without them, the Commission On Network test times out
#    when mDNS picks a VPN/utun interface.
PRIMARY_INTERFACE=en0 MATTER_MDNS_NETWORKINTERFACE=en0 npm test
```

All four checks must pass **in this order**. `npm run format` must be run **before** build/lint — it rewrites files in-place using oxfmt and the build/lint must validate the formatted output. Skipping format leads to formatting drift that gets caught later.

#### Test scoping during iteration

For fast iteration while working on a single workspace package, run scoped tests via the npm `-w` flag from the repo root. Example for `ws-controller`:

```bash
npm test -w @matter-server/ws-controller
```

This is the preferred verification mode for in-package work; the full `npm test` is the final gate before declaring work done.

#### Pre-existing integration test caveats

`packages/matter-server/test/IntegrationTest.ts` contains end-to-end tests that depend on real mDNS multicast and a live Matter device handshake on the local network. On developer machines and in some CI environments these can flake or fail with errors like:

- `Integration Test > Device Discovery > should discover commissionable nodes via discover command — expected undefined to exist`
- `Integration Test > Commission On Network > should commission device using passcode and long discriminator — expected '<vendor>' to equal 'Test Vendor'`

When the full `npm test` reports only these matter-server integration failures and your changes are confined to other packages (e.g. `ws-controller` non-discovery code paths, `dashboard`), treat them as pre-existing environment failures rather than regressions. Confirm by running scoped tests for your package via `npm test -w <workspace>`. Per the global "When tests fail" rule, ask before chasing failures you suspect are pre-existing.

### Plan Documents

Plan/design documents in `docs/plans/` are working files only. **Never commit them to git.** They may exist locally for reference but must not be included in any commit.

### Code Comments

WHY not WHAT. Only add a WHAT comment if the logic is genuinely non-obvious. Keep comments minimal. Audit every `//` and `/** */` before commit; **default to deleting, not shortening** — a wordy comment that survives review shorter is still a failure.

**Decisive test (primary lens):** *"Would I need this comment to understand the code later if I had to fix something right here?"* If no → delete. This catches the true-but-useless comment the checklist below lets slip.

Before adding any comment, ask in order:

1. Does the commit message / `git blame` already carry this context? → no comment.
2. Would a reader seeing only the final code (not the diff) benefit? → if no, no comment.
3. Does the code already speak for itself via identifiers + jsdoc? → if yes, no comment.
4. Am I narrating the change I just made rather than stating an invariant of the code? → put it in the commit message, not the code.
5. Can I say the WHY in ≤1 line? → if no, it's almost certainly over-explanation.

**Acceptable (rare) — keep to 1 line:**

- An invariant a future refactor could innocently break (forward-looking).
- A non-obvious spec / RFC / library constraint the code depends on.
- A tradeoff record ("we accept X because Y is worse").
- Cross-file / library coupling the type system can't express.

Example from this codebase: `// Shared Observable: an uncaught throw here aborts the emit and starves other connections` on a `try/catch` around an observer body — matter.js's `Observable.emit` catches each observer error but its default `handleError` *rethrows*, so a per-connection throw aborts the shared emit and starves other connections; without the comment a future fixer assumes the guard is redundant and removes it.

**Always-bad (delete on sight):**

- WHAT-restatement of an identifier or `if` condition (`// Store event in the buffer` above `this.#addEventToHistory(...)`).
- Changelog / historical narration ("Moved from A to B because…", "this used to do Y").
- "Now do X" above code that does X; multi-line explanations of what the diff does.
- Pointing at structure the reader can see ("Cleanup lives on an outer `.finally`", "Using a Map keyed by X").
- Mechanism trivia about standard APIs (".finally runs in a microtask", "Promise.all rejects on first failure").
- Rejected-alternative justification (`// .then().catch(), not .then(a,b)…`) — once the code IS that form, what it *isn't* is irrelevant; state the invariant, not the counterfactual.

## Dashboard Development

### Technology Stack

- **Lit 3.x**: Web components framework with TypeScript decorators
- **Material Web 2.4.x**: Material Design 3 components (`md-*` elements)
- **@mdi/js**: Material Design Icons as SVG paths
- **CSS Variables**: All colors use CSS custom properties for theming

### Styling Patterns

- All components use inline `static override styles = css\`...\`` (Lit pattern)
- Colors must use CSS variables from `public/index.html`, not hardcoded values
- Key variables: `--md-sys-color-primary`, `--md-sys-color-surface`, `--md-sys-color-on-surface`, `--md-sys-color-on-surface-variant`
- Dark mode: Variables overridden in `html.dark-theme body` selector

### Theme-Aware Colors

When defining colors in dashboard components, **always use CSS variables** that are defined for both light and dark themes:

```css
/* CORRECT - uses theme variable with fallback */
color: var(--text-color, rgba(0, 0, 0, 0.6));
background: var(--md-sys-color-surface);

/* WRONG - hardcoded color won't adapt to dark mode */
color: rgba(0, 0, 0, 0.6);
color: #333333;
color: grey;
```

Available theme variables defined in `public/index.html`:

- `--text-color`: Secondary text (grey) - adapts for light/dark
- `--danger-color`: Error/warning red
- `--primary-color`: Primary accent color
- `--md-sys-color-*`: Material Design system colors

Always verify new colors look correct in both light AND dark themes before committing.

### Theme System

- `src/util/theme-service.ts`: Singleton managing theme state
- Supports: `light`, `dark`, `system` (OS auto-detect)
- Persisted in localStorage (`matterTheme` key)
- Query parameter override: `?theme=dark|light|system`

### Key Dashboard Files

- `public/index.html`: CSS variables for light/dark themes
- `src/util/theme-service.ts`: Theme management singleton
- `src/pages/components/header.ts`: Header bar with theme toggle
- `src/pages/matter-dashboard-app.ts`: Main app with connection states
- `src/components/ha-svg-icon.ts`: Custom SVG icon component

### Common Pitfalls

- Don't use hardcoded colors like `#673ab7` or `cornsilk` - use CSS variables
- Material Web components need proper `--md-sys-color-*` variables to render correctly in dark mode
- When adding status/error pages, include the header component for consistent UX
- The dashboard is served by the Matter Server, so `location.reload()` fails when server is offline - use WebSocket reconnect instead

## Design Context

### Users

Two distinct audiences served equally:

1. **Home Assistant power users** — technically capable smart home enthusiasts managing their Matter network. Need clear device status, easy commissioning, and network health at a glance.
2. **Developers and testers** — building or debugging Matter integrations. Need raw data, attribute inspection, cluster details, and diagnostic information.

Both audiences benefit from information density. Neither needs hand-holding.

### Brand Personality

**Utilitarian, dense, reliable.** Tool-first. The dashboard should feel like a well-built instrument panel — everything needed visible, nothing decorative for its own sake.

### Aesthetic Direction

- Material Design 3 as foundation — refine rather than replace
- Both light and dark modes, equal quality in each
- Current design is acceptable baseline — improvements focus on polish, color mode consistency, spacing, and information hierarchy
- Anti-references: not a "hacker dashboard", not overly decorative, not consumer marketing

### Design Principles

1. **Density over decoration** — Show more data in less space. Every pixel earns its place.
2. **State clarity** — Online/offline, connection quality, commissioning status must be instantly readable. Color-code consistently.
3. **Both modes, equal quality** — Light and dark themes both intentional, not one an afterthought.
4. **Material as infrastructure** — Use MD components for consistency, override tokens where it improves the tool feel.
5. **Progressive detail** — Overview first, drill-down on demand.
