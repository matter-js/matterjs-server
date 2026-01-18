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

# Run tests (uses @matter/testing with mocha)
npm test

# Lint
npm run lint
npm run lint-fix

# Format
npm run format
npm run format-verify
```

## Monorepo Structure

This is an npm workspaces monorepo with four packages:

- **packages/ws-controller** (`@matter-server/ws-controller`): Core Matter controller library wrapping `@project-chip/matter.js`. Exports `MatterController`, `ControllerCommandHandler`, `WebSocketControllerHandler`, `ConfigStorage`
- **packages/dashboard** (`@matter-server/dashboard`): Web UI built with Lit, Rollup, and Material Web Components. Connects to server via WebSocket
- **packages/matter-server** (`matter-server`): Main entry point. HTTP/WebSocket server using Express, combines controller + dashboard
- **packages/tools** (`@matter/tools`) (private unpublished package only!): Build infrastructure using esbuild + TSC. Provides `matter-build`, `matter-run`, `matter-version` binaries

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

Uses custom `@matter/tools` build system:
- TSC for type checking and declaration files
- esbuild for transpilation (ESM + CJS)
- Dashboard uses Rollup for bundling with Babel

Package-level builds: `matter-build` (aliased in each package.json)
Dashboard has additional `npm run generate` step for cluster descriptions.

## Node.js Requirements

Engine requirement: `>=20.19.0 <22.0.0 || >=22.13.0`

## Code Quality Checklist

**Always run these checks before considering work complete:**

```bash
# 1. Format code (required)
npm run format

# 2. Lint (required)
npm run lint

# 3. Build (required)
npm run build

# 4. Run tests (required)
npm test
```

All four checks must pass. Fix any issues before committing.

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
