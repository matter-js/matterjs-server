"""Process management helpers for integration tests.

Ports the functionality of the JS ProcessHelpers.ts for use in Python integration tests.
Provides helpers to start/stop the Matter.js server and test device subprocesses.
"""

from __future__ import annotations

import asyncio
import os
import shutil
import signal
import subprocess
import tempfile
import time
from pathlib import Path

import aiohttp

REPO_ROOT = Path(__file__).parent.parent.parent.parent  # python_client/tests/helpers -> repo root
SERVER_PORT = 5580
SERVER_WS_URL = f"ws://localhost:{SERVER_PORT}/ws"
DEVICE_PORT = 5540
MANUAL_PAIRING_CODE = "34970112332"


def create_temp_storage_paths() -> tuple[str, str]:
    """Create temporary storage directories for server and device.

    Returns a tuple of (server_storage_path, device_storage_path).
    Both directories are created on disk immediately.
    """
    timestamp = int(time.time() * 1000)
    server_path = os.path.join(tempfile.gettempdir(), f"matter-test-server-{timestamp}")
    device_path = os.path.join(tempfile.gettempdir(), f"matter-test-device-{timestamp}")
    os.makedirs(server_path, exist_ok=True)
    os.makedirs(device_path, exist_ok=True)
    return server_path, device_path


def cleanup_temp_storage(server_path: str, device_path: str) -> None:
    """Remove temporary storage directories.

    Silently ignores errors if directories don't exist or can't be removed.
    """
    for path in (server_path, device_path):
        try:
            shutil.rmtree(path)
        except OSError:
            pass


def start_server(storage_path: str) -> subprocess.Popen:
    """Start the Matter.js server process.

    Args:
        storage_path: Path to the temporary storage directory for server state.

    Returns:
        The subprocess.Popen handle for the running server.
    """
    server_script = REPO_ROOT / "packages" / "matter-server" / "dist" / "esm" / "MatterServer.js"
    return subprocess.Popen(
        [
            "node",
            "--enable-source-maps",
            str(server_script),
            f"--storage-path={storage_path}",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=str(REPO_ROOT),
    )


def start_test_device(storage_path: str) -> subprocess.Popen:
    """Start the test light device process.

    Args:
        storage_path: Path to the temporary storage directory for device state.

    Returns:
        The subprocess.Popen handle for the running test device.
    """
    device_script = (
        REPO_ROOT / "packages" / "matter-server" / "test" / "fixtures" / "TestLightDevice.ts"
    )
    return subprocess.Popen(
        [
            "npx",
            "tsx",
            str(device_script),
            f"--storage-path={storage_path}",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=str(REPO_ROOT),
    )


async def wait_for_port(port: int, timeout: float = 30.0) -> None:
    """Wait for the WebSocket server to accept connections on the given port.

    Repeatedly attempts a WebSocket connection until successful or timeout.

    Args:
        port: The port number to connect to.
        timeout: Maximum time to wait in seconds.

    Raises:
        TimeoutError: If the server doesn't become available within the timeout.
    """
    start = time.monotonic()
    while time.monotonic() - start < timeout:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.ws_connect(f"ws://localhost:{port}/ws", timeout=2):
                    return
        except (aiohttp.ClientError, OSError, asyncio.TimeoutError):
            await asyncio.sleep(0.5)
    raise TimeoutError(f"Timeout waiting for WebSocket server on port {port}")


async def wait_for_device_ready(process: subprocess.Popen, timeout: float = 30.0) -> None:
    """Wait for the test device to be ready by monitoring its stdout.

    Watches for the "Manual pairing code:" or "commissioned" output lines
    that indicate the device is ready to accept connections.

    Args:
        process: The device subprocess to monitor.
        timeout: Maximum time to wait in seconds.

    Raises:
        RuntimeError: If the device process exits unexpectedly.
        TimeoutError: If the device doesn't become ready within the timeout.
    """
    start = time.monotonic()
    assert process.stdout is not None

    while time.monotonic() - start < timeout:
        # Non-blocking readline
        line = process.stdout.readline()
        if not line:
            if process.poll() is not None:
                raise RuntimeError("Device process exited unexpectedly")
            await asyncio.sleep(0.1)
            continue
        line = line.strip()
        if "Manual pairing code:" in line or "commissioned" in line.lower():
            # Give the device's network stack time to fully initialize
            await asyncio.sleep(2)
            return

    raise TimeoutError("Timeout waiting for device to be ready")


def kill_process(process: subprocess.Popen | None, timeout: float = 5.0) -> None:
    """Gracefully kill a process, falling back to SIGKILL if needed.

    Sends SIGINT first to allow graceful shutdown, then SIGKILL if the
    process doesn't exit within the timeout.

    Args:
        process: The process to kill, or None (no-op).
        timeout: Time to wait for graceful shutdown before forcing kill.
    """
    if process is None or process.poll() is not None:
        return
    process.send_signal(signal.SIGINT)
    try:
        process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=2)
