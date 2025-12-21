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
npm run server -- --storage-path=.ha1 --mdns-networkinterface=en0

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

- **packages/tools** (`@matter/tools`): Build infrastructure using esbuild + TSC. Provides `matter-build`, `matter-run`, `matter-version` binaries
- **packages/controller** (`@matter-server/controller`): Core Matter controller library wrapping `@project-chip/matter.js`. Exports `MatterController`, `ControllerCommandHandler`, `WebSocketControllerHandler`, `ConfigStorage`
- **packages/dashboard** (`@matter-server/dashboard`): Web UI built with Lit, Rollup, and Material Web Components. Connects to server via WebSocket
- **packages/matter-server** (`matter-server`): Main entry point. HTTP/WebSocket server using Express, combines controller + dashboard

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
- `@matter/main`, `@matter/general`: Matter.js utilities
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
