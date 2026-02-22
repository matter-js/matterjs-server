# Python Client for the OHF Matter Server

A PyPI package (`matter-python-client`) providing Python bindings for the [OHF Matter Server](https://github.com/matter-js/matterjs-server). This is a drop-in replacement for the client portion of [`python-matter-server`](https://github.com/matter-js/python-matter-server), with custom cluster definitions updated to match the Matter.js server.

## Origin

The client and common modules were copied from [`python-matter-server` v8.1.2](https://github.com/matter-js/python-matter-server) and modified:

- **Source**: `matter_server/client/` and `matter_server/common/` from python-matter-server
- **Modified**: `matter_server/common/custom_clusters.py` — updated to match the JS server's cluster definitions
- **Excluded**: `matter_server/server/` (the JS server replaces it), `common/helpers/logger.py` (depends on `coloredlogs`, a server-only dependency)

### Custom Cluster Changes

| Cluster | Change |
|---------|--------|
| EveCluster | +8 attributes (getConfig, setConfig, loggingMetadata, loggingData, lastEventTime, statusFault, childLock, rloc16), wattAccumulatedControlPoint type fixed |
| HeimanCluster | Attribute IDs shortened to match JS server |
| NeoCluster | Types changed from float32 to uint |
| Polling | Removed (JS server handles polling natively) |

## Package

- **PyPI name**: `matter-python-client`
- **Python module**: `matter_server` (same import path as `python-matter-server`)
- **Python**: >= 3.12
- **Dependencies**: `aiohttp`, `orjson`, `home-assistant-chip-clusters`

## npm Scripts (from monorepo root)

```bash
# First-time setup: create venv and install with test dependencies
npm run python:install

# Run unit + mock server tests (fast, ~1s)
npm run python:test

# Run full integration tests against real Matter.js server + test device (~40s)
npm run python:test-integration

# Run all Python tests
npm run python:test-all

# Build the PyPI package (.tar.gz + .whl)
npm run python:build
```

## Usage

The package provides the same `matter_server.client` API as `python-matter-server`:

```python
import aiohttp
from matter_server.client import MatterClient

async with aiohttp.ClientSession() as session:
    client = MatterClient("ws://localhost:5580/ws", session)
    await client.connect()

    init_ready = asyncio.Event()
    listen_task = asyncio.create_task(client.start_listening(init_ready))
    await init_ready.wait()

    nodes = client.get_nodes()
```

To use this package instead of `python-matter-server` in the Home Assistant Matter integration, change `manifest.json`:

```diff
- "requirements": ["python-matter-server==8.1.2"],
+ "requirements": ["matter-python-client==1.0.0"],
```

## Testing

The test suite has three layers:

- **Import smoke tests** (8 tests) — verify all HA integration imports resolve
- **Mock server tests** (4 tests) — Python client against JS MockMatterServer subprocess
- **Integration tests** (63 tests) — Python client against real Matter.js server + test device, mirroring the JS `IntegrationTest.ts`
