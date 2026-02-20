"""Shared test fixtures for Python client tests."""

from __future__ import annotations

import json
import select
import subprocess
from pathlib import Path
from typing import Generator

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent
MOCK_SERVER_SCRIPT = Path(__file__).parent / "mock_server.mjs"

STARTUP_TIMEOUT_SECONDS = 30


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
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()


@pytest.fixture(scope="session")
def mock_server() -> Generator[MockServerProcess, None, None]:
    """Start the JS MockMatterServer as a subprocess."""
    proc = subprocess.Popen(
        ["npx", "tsx", str(MOCK_SERVER_SCRIPT)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=str(REPO_ROOT),
    )

    # Wait for READY:<port> message with timeout
    assert proc.stdout is not None
    ready, _, _ = select.select([proc.stdout], [], [], STARTUP_TIMEOUT_SECONDS)
    if not ready:
        proc.kill()
        raise RuntimeError(
            f"Mock server failed to start within {STARTUP_TIMEOUT_SECONDS} seconds"
        )

    line = proc.stdout.readline().strip()
    if not line.startswith("READY:"):
        proc.kill()
        proc.wait()
        stderr = proc.stderr.read() if proc.stderr else ""
        raise RuntimeError(f"Mock server failed to start. stdout={line!r}, stderr={stderr!r}")

    port = int(line.split(":")[1])
    server = MockServerProcess(proc, port)

    yield server

    server.stop()
