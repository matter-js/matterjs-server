# matter-python-client Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a PyPI package `matter-python-client` that provides updated Matter cluster definitions for the JS server, as a drop-in replacement for the client portion of `python-matter-server`.

**Architecture:** Copy client + common Python modules from `python-matter-server`, update custom cluster definitions to match the JS server, publish to PyPI. A thin Node.js test harness reuses the existing `MockMatterServer` to prove interoperability.

**Tech Stack:** Python 3.12+, pytest, pytest-asyncio, aiohttp, Node.js (test mock server)

---

## Source References

- Python Matter Server: `/Users/ingof/DevOHF/python-matter-server/matter_server/`
- JS custom clusters: `packages/custom-clusters/src/clusters/` (this repo)
- JS mock server: `packages/ws-client/test/MockMatterServer.ts` (this repo)
- HA integration: `/Users/ingof/DevOHF/home-assistant-core/homeassistant/components/matter/`

---

### Task 1: Create directory structure and pyproject.toml

**Files:**
- Create: `python_client/pyproject.toml`
- Create: `python_client/matter_server/__init__.py`
- Create: `python_client/matter_server/py.typed`

**Step 1: Create the directories**

```bash
mkdir -p python_client/matter_server/client/models
mkdir -p python_client/matter_server/common/helpers
mkdir -p python_client/tests
```

**Step 2: Write pyproject.toml**

Create `python_client/pyproject.toml`:

```toml
[build-system]
build-backend = "setuptools.build_meta"
requires = ["setuptools>=62.3"]

[project]
authors = [
  {name = "Open Home Foundation", email = "hello@openhomefoundation.io"},
]
classifiers = [
  "Development Status :: 4 - Beta",
  "Intended Audience :: Developers",
  "Programming Language :: Python :: 3.12",
  "Programming Language :: Python :: 3.13",
  "Topic :: Home Automation",
]
dependencies = [
  "aiohttp",
  "orjson",
  "home-assistant-chip-clusters==2025.7.0",
]
description = "Matter Python Client for Home Assistant"
license = {text = "Apache-2.0"}
name = "matter-python-client"
readme = "README.md"
requires-python = ">=3.12"
# The version is set by CI on release
version = "0.0.0"

[project.optional-dependencies]
test = [
  "pytest==9.0.2",
  "pytest-asyncio==1.3.0",
  "pytest-aiohttp==1.1.0",
]

[tool.setuptools]
include-package-data = true
platforms = ["any"]
zip-safe = false

[tool.setuptools.package-data]
matter_server = ["py.typed"]

[tool.setuptools.packages.find]
include = ["matter_server*"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

**Step 3: Write top-level __init__.py and py.typed**

Create `python_client/matter_server/__init__.py`:
```python
"""Matter Python Client for Home Assistant."""
```

Create `python_client/matter_server/py.typed` (empty file, PEP 561 marker).

**Step 4: Commit**

```bash
git add python_client/
git commit -m "feat: scaffold python_client package structure"
```

---

### Task 2: Copy client source files

Copy all client Python files from `python-matter-server`. These files are used as-is with no modifications.

**Files:**
- Copy: `client/__init__.py`, `client/client.py`, `client/connection.py`, `client/exceptions.py`
- Copy: `client/models/__init__.py`, `client/models/device_types.py`, `client/models/node.py`

**Step 1: Copy the client directory**

```bash
cp /Users/ingof/DevOHF/python-matter-server/matter_server/client/__init__.py python_client/matter_server/client/
cp /Users/ingof/DevOHF/python-matter-server/matter_server/client/client.py python_client/matter_server/client/
cp /Users/ingof/DevOHF/python-matter-server/matter_server/client/connection.py python_client/matter_server/client/
cp /Users/ingof/DevOHF/python-matter-server/matter_server/client/exceptions.py python_client/matter_server/client/
cp /Users/ingof/DevOHF/python-matter-server/matter_server/client/models/__init__.py python_client/matter_server/client/models/
cp /Users/ingof/DevOHF/python-matter-server/matter_server/client/models/device_types.py python_client/matter_server/client/models/
cp /Users/ingof/DevOHF/python-matter-server/matter_server/client/models/node.py python_client/matter_server/client/models/
```

**Step 2: Commit**

```bash
git add python_client/matter_server/client/
git commit -m "feat: copy client modules from python-matter-server"
```

---

### Task 3: Copy common source files

Copy the common Python files. Skip `logger.py` (depends on `coloredlogs`, a server-only dependency). Create an empty `helpers/__init__.py`.

**Files:**
- Copy: `common/__init__.py`, `common/const.py`, `common/errors.py`, `common/models.py`
- Copy: `common/custom_clusters.py` (modified in Task 4)
- Copy: `common/helpers/api.py`, `common/helpers/json.py`, `common/helpers/util.py`
- Create: `common/helpers/__init__.py`

**Step 1: Copy common files**

```bash
cp /Users/ingof/DevOHF/python-matter-server/matter_server/common/__init__.py python_client/matter_server/common/
cp /Users/ingof/DevOHF/python-matter-server/matter_server/common/const.py python_client/matter_server/common/
cp /Users/ingof/DevOHF/python-matter-server/matter_server/common/errors.py python_client/matter_server/common/
cp /Users/ingof/DevOHF/python-matter-server/matter_server/common/models.py python_client/matter_server/common/
cp /Users/ingof/DevOHF/python-matter-server/matter_server/common/custom_clusters.py python_client/matter_server/common/
cp /Users/ingof/DevOHF/python-matter-server/matter_server/common/helpers/api.py python_client/matter_server/common/helpers/
cp /Users/ingof/DevOHF/python-matter-server/matter_server/common/helpers/json.py python_client/matter_server/common/helpers/
cp /Users/ingof/DevOHF/python-matter-server/matter_server/common/helpers/util.py python_client/matter_server/common/helpers/
touch python_client/matter_server/common/helpers/__init__.py
```

**Step 2: Commit**

```bash
git add python_client/matter_server/common/
git commit -m "feat: copy common modules from python-matter-server"
```

---

### Task 4: Update custom_clusters.py

Modify `python_client/matter_server/common/custom_clusters.py` to match the JS server's cluster definitions. This is the core change.

**File:** Modify: `python_client/matter_server/common/custom_clusters.py`

**Step 1: Remove polling infrastructure**

Remove these items:
- `VENDOR_ID_EVE` constant
- `should_poll` static method from `CustomClusterMixin` class
- `should_poll` static method from `CustomClusterAttributeMixin` class
- `should_poll_eve_energy()` function
- `check_polled_attributes()` function (at bottom of file)
- All `should_poll = should_poll_eve_energy` lines from Eve attribute classes
- Import of `BasicInformation` and `ElectricalPowerMeasurement` from `chip.clusters.Objects`
- Import of `create_attribute_path_from_attribute` and `parse_attribute_path` from helpers
- The `TYPE_CHECKING` import block and the `MatterNodeData` type reference

**Step 2: Add 8 new EveCluster attributes**

Add to the `EveCluster` class descriptor and as class fields/attribute classes:

1. `getConfig` (0x130A0000, bytes)
2. `setConfig` (0x130A0001, bytes)
3. `loggingMetadata` (0x130A0002, bytes)
4. `loggingData` (0x130A0003, bytes)
5. `lastEventTime` (0x130A0007, uint)
6. `statusFault` (0x130A000C, uint)
7. `childLock` (0x130A0011, bool)
8. `rloc16` (0x130A0012, uint)

Each new attribute needs:
- A `ClusterObjectFieldDescriptor` entry in the `descriptor()` method
- A class field (`name: type | None = None`)
- A nested `@dataclass` class under `Attributes` with `cluster_id`, `attribute_id`, `attribute_type`, and `value`

Follow the exact pattern of existing attributes (e.g. `TimesOpened`, `Watt`).

**Step 3: Change wattAccumulatedControlPoint type**

In `EveCluster`:
- Change descriptor entry from `Type=float32` to `Type=uint`
- Change class field from `float32 | None` to `uint | None`
- Change `WattAccumulatedControlPoint.attribute_type` from `Type=float32` to `Type=uint`
- Change `WattAccumulatedControlPoint.value` from `float32 = 0` to `uint = 0`

**Step 4: Fix HeimanCluster attribute IDs**

Change all attribute IDs from vendor-prefixed to short form:

| Attribute         | Old ID         | New ID   |
|-------------------|---------------|----------|
| tamperAlarm       | 0x00120B0010  | 0x0010   |
| preheatingState   | 0x00120B0011  | 0x0011   |
| noDisturbingState | 0x00120B0012  | 0x0012   |
| sensorType        | 0x00120B0013  | 0x0013   |
| sirenActive       | 0x00120B0014  | 0x0014   |
| alarmMute         | 0x00120B0015  | 0x0015   |
| lowPowerMode      | 0x00120B0016  | 0x0016   |

Update in three places per attribute: descriptor Tag, class field isn't affected (same name), and the nested Attribute class's `attribute_id` property.

**Step 5: Fix NeoCluster types**

Change all four Neo attributes from `float32` to `uint`:
- `watt`, `wattAccumulated`, `current`, `voltage`

In each: descriptor `Type`, class field type annotation, attribute class `attribute_type`, and `value` default.

**Step 6: Verify the file compiles**

```bash
cd python_client && python -c "from matter_server.common.custom_clusters import ALL_CUSTOM_CLUSTERS; print(f'Loaded {len(ALL_CUSTOM_CLUSTERS)} clusters')"
```

Expected: `Loaded 6 clusters`

**Step 7: Commit**

```bash
git add python_client/matter_server/common/custom_clusters.py
git commit -m "feat: update custom clusters to match JS server definitions"
```

---

### Task 5: Write import smoke tests

Verify every import the HA integration uses resolves correctly.

**File:** Create: `python_client/tests/test_imports.py`

**Step 1: Write the test file**

```python
"""Smoke tests verifying all HA integration imports resolve."""

import pytest


def test_client_imports():
    """All client module imports used by HA integration must resolve."""
    from matter_server.client import MatterClient
    from matter_server.client.exceptions import CannotConnect, InvalidServerVersion

    assert MatterClient is not None
    assert CannotConnect is not None
    assert InvalidServerVersion is not None


def test_client_model_imports():
    """All client model imports used by HA integration must resolve."""
    from matter_server.client.models import device_types
    from matter_server.client.models.device_types import BridgedNode, DeviceType
    from matter_server.client.models.node import MatterEndpoint, MatterNode

    assert device_types is not None
    assert BridgedNode is not None
    assert DeviceType is not None
    assert MatterEndpoint is not None
    assert MatterNode is not None


def test_common_model_imports():
    """All common model imports used by HA integration must resolve."""
    from matter_server.common.models import (
        EventType,
        MatterSoftwareVersion,
        ServerInfoMessage,
        UpdateSource,
    )
    from matter_server.common.errors import (
        MatterError,
        NodeNotExists,
        UpdateCheckError,
        UpdateError,
    )

    assert EventType is not None
    assert ServerInfoMessage is not None
    assert MatterSoftwareVersion is not None
    assert UpdateSource is not None
    assert MatterError is not None
    assert NodeNotExists is not None
    assert UpdateCheckError is not None
    assert UpdateError is not None


def test_helper_imports():
    """All helper imports used by HA integration must resolve."""
    from matter_server.common.helpers.util import (
        create_attribute_path,
        create_attribute_path_from_attribute,
        dataclass_to_dict,
        parse_attribute_path,
    )

    assert create_attribute_path is not None
    assert create_attribute_path_from_attribute is not None
    assert dataclass_to_dict is not None
    assert parse_attribute_path is not None


def test_custom_cluster_imports():
    """All custom cluster imports used by HA integration must resolve."""
    from matter_server.common.custom_clusters import (
        DraftElectricalMeasurementCluster,
        EveCluster,
        InovelliCluster,
        NeoCluster,
        ThirdRealityMeteringCluster,
    )

    assert EveCluster is not None
    assert InovelliCluster is not None
    assert NeoCluster is not None
    assert ThirdRealityMeteringCluster is not None
    assert DraftElectricalMeasurementCluster is not None


def test_eve_new_attributes_exist():
    """New Eve attributes added for JS server must be accessible."""
    from matter_server.common.custom_clusters import EveCluster

    attrs = EveCluster.Attributes
    # New attributes
    assert hasattr(attrs, "GetConfig")
    assert hasattr(attrs, "SetConfig")
    assert hasattr(attrs, "LoggingMetadata")
    assert hasattr(attrs, "LoggingData")
    assert hasattr(attrs, "LastEventTime")
    assert hasattr(attrs, "StatusFault")
    assert hasattr(attrs, "ChildLock")
    assert hasattr(attrs, "Rloc16")
    # Existing attributes still present
    assert hasattr(attrs, "Watt")
    assert hasattr(attrs, "Voltage")
    assert hasattr(attrs, "Current")


def test_heiman_short_attribute_ids():
    """Heiman cluster must use short attribute IDs matching JS server."""
    from matter_server.common.custom_clusters import HeimanCluster

    assert HeimanCluster.Attributes.TamperAlarm.attribute_id == 0x0010
    assert HeimanCluster.Attributes.PreheatingState.attribute_id == 0x0011
    assert HeimanCluster.Attributes.NoDisturbingState.attribute_id == 0x0012
    assert HeimanCluster.Attributes.SensorType.attribute_id == 0x0013
    assert HeimanCluster.Attributes.SirenActive.attribute_id == 0x0014
    assert HeimanCluster.Attributes.AlarmMute.attribute_id == 0x0015
    assert HeimanCluster.Attributes.LowPowerMode.attribute_id == 0x0016


def test_polling_removed():
    """Polling infrastructure must not exist."""
    import matter_server.common.custom_clusters as cc

    assert not hasattr(cc, "should_poll_eve_energy")
    assert not hasattr(cc, "check_polled_attributes")
    assert not hasattr(cc, "VENDOR_ID_EVE")
```

**Step 2: Install the package in dev mode and run tests**

```bash
cd python_client && pip install -e ".[test]" && pytest tests/test_imports.py -v
```

Expected: All tests pass.

**Step 3: Commit**

```bash
git add python_client/tests/test_imports.py
git commit -m "test: add import smoke tests for HA integration compatibility"
```

---

### Task 6: Create JS mock server test harness

Write a small Node.js script that wraps `MockMatterServer` and exposes it as a standalone process. The Python tests start this process and connect to it.

**Files:**
- Create: `python_client/tests/mock_server.mjs`
- Create: `python_client/tests/conftest.py`

**Step 1: Write the Node.js mock server wrapper**

Create `python_client/tests/mock_server.mjs`:

```javascript
/**
 * Standalone mock server for Python client testing.
 * Wraps the existing MockMatterServer from ws-client tests.
 *
 * Usage: node mock_server.mjs [port]
 * Prints "READY:<port>" to stdout when ready.
 * Handles commands from stdin as JSON lines:
 *   {"action": "register_command", "command": "start_listening", "result": {...}}
 *   {"action": "send_event", "event": "node_added", "data": {...}}
 *   {"action": "stop"}
 */

import { MockMatterServer } from "../../packages/ws-client/test/MockMatterServer.ts";

const port = parseInt(process.argv[2] || "0", 10);
const server = new MockMatterServer({ port });

await server.start();
console.log(`READY:${server.actualPort}`);

// Default handlers
server.onCommand("start_listening", () => ({
    nodes: [],
}));

// Read commands from stdin
process.stdin.setEncoding("utf-8");
let buffer = "";

process.stdin.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
        if (!line.trim()) continue;
        try {
            const cmd = JSON.parse(line);
            handleStdinCommand(cmd);
        } catch (e) {
            console.error("Invalid command:", e.message);
        }
    }
});

function handleStdinCommand(cmd) {
    switch (cmd.action) {
        case "register_command":
            server.onCommand(cmd.command, () => cmd.result);
            console.log(`REGISTERED:${cmd.command}`);
            break;
        case "send_event":
            server.sendEvent(cmd.event, cmd.data);
            console.log(`EVENT_SENT:${cmd.event}`);
            break;
        case "stop":
            server.stop().then(() => process.exit(0));
            break;
        default:
            console.error(`Unknown action: ${cmd.action}`);
    }
}

process.on("SIGTERM", () => server.stop().then(() => process.exit(0)));
process.on("SIGINT", () => server.stop().then(() => process.exit(0)));
```

**Step 2: Write the pytest conftest with mock server fixture**

Create `python_client/tests/conftest.py`:

```python
"""Shared test fixtures for Python client tests."""

from __future__ import annotations

import asyncio
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import AsyncGenerator, Generator

import pytest
import pytest_asyncio

REPO_ROOT = Path(__file__).parent.parent.parent
MOCK_SERVER_SCRIPT = Path(__file__).parent / "mock_server.mjs"


class MockServerProcess:
    """Manages the Node.js mock server subprocess."""

    def __init__(self, process: subprocess.Popen, port: int):
        self.process = process
        self.port = port
        self.url = f"ws://127.0.0.1:{port}/ws"

    def send_command(self, cmd: dict) -> None:
        """Send a command to the mock server via stdin."""
        line = json.dumps(cmd) + "\n"
        assert self.process.stdin is not None
        self.process.stdin.write(line)
        self.process.stdin.flush()

    def register_command(self, command: str, result: object) -> None:
        """Register a command handler on the mock server."""
        self.send_command({"action": "register_command", "command": command, "result": result})

    def send_event(self, event: str, data: object) -> None:
        """Send an event to all connected clients."""
        self.send_command({"action": "send_event", "event": event, "data": data})

    def stop(self) -> None:
        """Stop the mock server."""
        if self.process.poll() is None:
            self.process.terminate()
            self.process.wait(timeout=5)


@pytest.fixture(scope="session")
def mock_server() -> Generator[MockServerProcess, None, None]:
    """Start the JS MockMatterServer as a subprocess."""
    # tsx is needed to run TypeScript directly
    proc = subprocess.Popen(
        ["npx", "tsx", str(MOCK_SERVER_SCRIPT)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=str(REPO_ROOT),
    )

    # Wait for READY:<port> message
    assert proc.stdout is not None
    line = proc.stdout.readline().strip()
    if not line.startswith("READY:"):
        stderr = proc.stderr.read() if proc.stderr else ""
        proc.kill()
        raise RuntimeError(f"Mock server failed to start. stdout={line!r}, stderr={stderr!r}")

    port = int(line.split(":")[1])
    server = MockServerProcess(proc, port)

    yield server

    server.stop()
```

**Step 3: Verify the mock server starts**

```bash
cd /Users/ingof/DevOHF/matterjs-server/pyclient-matterjs-server && npx tsx python_client/tests/mock_server.mjs
```

Expected: Prints `READY:<port>` then waits. Ctrl+C to stop.

**Step 4: Commit**

```bash
git add python_client/tests/mock_server.mjs python_client/tests/conftest.py
git commit -m "test: add JS mock server harness for Python client integration tests"
```

---

### Task 7: Write client integration tests

Test the Python `MatterClient` against the JS mock server.

**File:** Create: `python_client/tests/test_client_integration.py`

**Step 1: Write the integration test file**

```python
"""Integration tests: Python MatterClient against JS MockMatterServer."""

from __future__ import annotations

import asyncio

import aiohttp
import pytest

from matter_server.client import MatterClient


@pytest.fixture
async def client_session() -> aiohttp.ClientSession:
    """Create an aiohttp client session."""
    async with aiohttp.ClientSession() as session:
        yield session


@pytest.mark.asyncio
async def test_connect_and_receive_server_info(mock_server, client_session):
    """Client connects and receives ServerInfoMessage from JS mock server."""
    client = MatterClient(mock_server.url, client_session)
    await client.connect()

    assert client.server_info is not None
    assert client.server_info.schema_version == 11
    assert client.server_info.sdk_version == "2025.1.0"
    assert client.server_info.fabric_id is not None

    client.disconnect()


@pytest.mark.asyncio
async def test_start_listening(mock_server, client_session):
    """Client can call start_listening and receive empty node list."""
    client = MatterClient(mock_server.url, client_session)
    await client.connect()

    init_ready = asyncio.Event()
    listen_task = asyncio.create_task(client.start_listening(init_ready))

    async with asyncio.timeout(10):
        await init_ready.wait()

    nodes = client.get_nodes()
    assert isinstance(nodes, list)

    client.disconnect()
    listen_task.cancel()
    try:
        await listen_task
    except asyncio.CancelledError:
        pass


@pytest.mark.asyncio
async def test_send_command_and_receive_response(mock_server, client_session):
    """Client sends a command and receives the result."""
    mock_server.register_command("server_diagnostics", {"info": "test"})

    client = MatterClient(mock_server.url, client_session)
    await client.connect()

    result = await client.send_command("server_diagnostics")
    assert result == {"info": "test"}

    client.disconnect()


@pytest.mark.asyncio
async def test_disconnect(mock_server, client_session):
    """Client connects and disconnects cleanly."""
    client = MatterClient(mock_server.url, client_session)
    await client.connect()
    assert client.connection.connected

    client.disconnect()
```

**Step 2: Run the integration tests**

```bash
cd python_client && pytest tests/test_client_integration.py -v
```

Expected: All tests pass.

**Step 3: Commit**

```bash
git add python_client/tests/test_client_integration.py
git commit -m "test: add Python client integration tests against JS mock server"
```

---

### Task 8: Create CI release workflow

**File:** Create: `.github/workflows/release-python-client.yml`

**Step 1: Write the workflow**

```yaml
name: Release Python Client

on:
  release:
    types: [published]

env:
  PYTHON_VERSION: "3.12"

jobs:
  release-python-client:
    name: Build and publish Python client to PyPI
    if: startsWith(github.event.release.tag_name, 'python-client-')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Get version from tag
        id: version
        run: echo "version=${GITHUB_REF#refs/tags/python-client-}" >> $GITHUB_OUTPUT

      - name: Set up Python ${{ env.PYTHON_VERSION }}
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Install build tools
        run: pip install build tomli tomli-w

      - name: Set version in pyproject.toml
        shell: python
        run: |
          import tomli, tomli_w
          with open("python_client/pyproject.toml", "rb") as f:
              pyproject = tomli.load(f)
          pyproject["project"]["version"] = "${{ steps.version.outputs.version }}"
          with open("python_client/pyproject.toml", "wb") as f:
              tomli_w.dump(pyproject, f)

      - name: Build package
        run: python3 -m build python_client/

      - name: Publish to PyPI
        uses: pypa/gh-action-pypi-publish@v1.8.14
        with:
          user: __token__
          password: ${{ secrets.PYPI_TOKEN }}
          packages-dir: python_client/dist/
```

**Step 2: Commit**

```bash
git add .github/workflows/release-python-client.yml
git commit -m "ci: add Python client release workflow for PyPI publishing"
```

---

### Task 9: Create CI test workflow

**File:** Create: `.github/workflows/test-python-client.yml`

**Step 1: Write the test workflow**

```yaml
name: Test Python Client

on:
  push:
    paths:
      - "python_client/**"
      - "packages/ws-client/test/MockMatterServer.ts"
  pull_request:
    paths:
      - "python_client/**"
      - "packages/ws-client/test/MockMatterServer.ts"

env:
  PYTHON_VERSION: "3.12"

jobs:
  test-python-client:
    name: Python client tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python ${{ env.PYTHON_VERSION }}
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Install Node.js dependencies
        run: npm ci

      - name: Build JS packages
        run: npm run build

      - name: Install Python client with test dependencies
        run: pip install -e "python_client/[test]"

      - name: Run Python client tests
        run: pytest python_client/tests/ -v
```

**Step 2: Commit**

```bash
git add .github/workflows/test-python-client.yml
git commit -m "ci: add Python client test workflow"
```

---

### Task 10: Final verification

**Step 1: Run all tests end-to-end**

```bash
# From repo root
cd python_client && pip install -e ".[test]" && pytest tests/ -v
```

Expected: All import tests and integration tests pass.

**Step 2: Verify the package builds**

```bash
cd python_client && pip install build && python -m build
```

Expected: Creates `dist/matter_python_client-0.0.0.tar.gz` and `dist/matter_python_client-0.0.0-py3-none-any.whl`.

**Step 3: Verify the JS server build still passes**

```bash
cd /Users/ingof/DevOHF/matterjs-server/pyclient-matterjs-server
npm run format && npm run lint && npm run build && npm test
```

Expected: All pass (Python client directory should not affect JS build).
