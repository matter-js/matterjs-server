# Design: matter-python-client Package

## Problem

The Matter.js server replaces the Python Matter Server but keeps its WebSocket API.
Home Assistant's Matter integration depends on `python-matter-server` for its Python client library.
The JS server's custom cluster definitions differ from the Python server's. The HA integration
needs a client whose cluster definitions match the JS server.

## Solution

Create a new PyPI package `matter-python-client` that provides the `matter_server.client` and
`matter_server.common` Python modules. This package is a drop-in replacement for the client
portion of `python-matter-server`. The HA integration swaps its dependency; no code changes needed.

## Scope

- Custom cluster definitions only (no WebSocket protocol or API changes)
- Client-only package (no server code)
- Published from this repo's CI to PyPI

## Directory Structure

```
python_client/
    pyproject.toml
    matter_server/
        __init__.py
        py.typed
        client/
            __init__.py
            client.py
            connection.py
            exceptions.py
            models/
                __init__.py
                device_types.py
                node.py
        common/
            __init__.py
            const.py
            custom_clusters.py      # updated
            errors.py
            models.py
            helpers/
                __init__.py
                api.py
                json.py
                logger.py
                util.py
    tests/
        conftest.py
        test_client_integration.py
        test_imports.py
```

Source files are copied from `python-matter-server` at
`/Users/ingof/DevOHF/python-matter-server/matter_server/` (client + common directories).

## Custom Cluster Changes

### EveCluster (0x130AFC01) -- 8 attributes added

| Attribute        | Tag        | Type  | Access |
|------------------|------------|-------|--------|
| getConfig        | 0x130a0000 | bytes | read   |
| setConfig        | 0x130a0001 | bytes | write  |
| loggingMetadata  | 0x130a0002 | bytes | read   |
| loggingData      | 0x130a0003 | bytes | read   |
| lastEventTime    | 0x130a0007 | uint  | read   |
| statusFault      | 0x130a000c | uint  | read   |
| childLock        | 0x130a0011 | bool  | write  |
| rloc16           | 0x130a0012 | uint  | read   |

Also: `wattAccumulatedControlPoint` type changes from `float32` to `uint`.

### HeimanCluster (0x120BFC01) -- attribute IDs shortened

All attribute IDs change from vendor-prefixed to short form:

| Attribute        | Old ID       | New ID |
|------------------|-------------|--------|
| tamperAlarm      | 0x00120B0010 | 0x0010 |
| preheatingState  | 0x00120B0011 | 0x0011 |
| noDisturbingState| 0x00120B0012 | 0x0012 |
| sensorType       | 0x00120B0013 | 0x0013 |
| sirenActive      | 0x00120B0014 | 0x0014 |
| alarmMute        | 0x00120B0015 | 0x0015 |
| lowPowerMode     | 0x00120B0016 | 0x0016 |

### NeoCluster (0x125DFC11) -- types updated

All four attributes (`watt`, `wattAccumulated`, `current`, `voltage`) change from
`float32` to `uint`.

### Polling removed

Remove `should_poll_eve_energy()`, `check_polled_attributes()`, and all `should_poll`
methods from `CustomClusterMixin` and `CustomClusterAttributeMixin`. The JS server handles
polling natively.

### Unchanged clusters

InovelliCluster, ThirdRealityMeteringCluster, and DraftElectricalMeasurementCluster remain
identical to the Python Matter Server's definitions.

## Package Configuration

`python_client/pyproject.toml`:

- **Name:** `matter-python-client`
- **Version:** `0.0.0` (set by CI from release tag)
- **Python:** `>=3.12`
- **Dependencies:** `aiohttp`, `orjson`, `home-assistant-chip-clusters==2025.7.0`
- **No console scripts** (library only)
- **Module:** `matter_server` (same import path as `python-matter-server`)

Server-only dependencies excluded: `aiorun`, `coloredlogs`, `cryptography`, `zeroconf`,
`home-assistant-chip-core`.

## HA Integration Change

One-line change in `homeassistant/components/matter/manifest.json`:

```diff
- "requirements": ["python-matter-server==8.1.2"],
+ "requirements": ["matter-python-client==1.0.0"],
```

All integration imports remain unchanged. No code modifications needed.

## Testing

### Integration tests against JS mock server

Start the JS `MockMatterServer` (from `packages/ws-client/test/MockMatterServer.ts`) as a
Node.js subprocess. Connect the Python `MatterClient` to it. Validate the same scenarios
tested in `WsClientTest.ts`:

- Connect and receive `ServerInfoMessage`
- Send commands, receive success and error responses
- Receive events (`node_added`, `attribute_updated`)
- Connection loss handling

This proves the Python client works with the JS server -- the actual deployment scenario.

### Import smoke tests

Lightweight tests that verify all imports used by the HA integration resolve correctly:
`MatterClient`, `EventType`, `ServerInfoMessage`, custom cluster classes, helper functions.

### CI requirements

Tests need both Node.js (mock server) and Python (client). Both are available in CI.

## CI Release Workflow

New workflow `release-python-client.yml`:

- **Trigger:** GitHub release with `python-client-*` tag (e.g. `python-client-1.0.0`)
- **Steps:** Extract version from tag, set in `pyproject.toml`, build with `python3 -m build`
  from `python_client/`, publish to PyPI
- **Secret:** `PYPI_TOKEN`

## What remains untouched

- Python Matter Server repo (`/Users/ingof/DevOHF/python-matter-server/`)
- Home Assistant addon (`/Users/ingof/DevOHF/homeassistant-addons/matter_server/`)
- The addon's `beta` flag (controls which server runs, unrelated to the client)
