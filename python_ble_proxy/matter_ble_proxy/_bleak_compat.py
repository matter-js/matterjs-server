"""Compatibility shims for building bleak connection/scan kwargs across bleak versions.

Bleak's API for selecting a specific BlueZ HCI adapter has changed across major
versions.
This module isolates that version-detection logic so callers (BleakClient and
BleakScanner call sites) don't need to duplicate it.
"""

from importlib.metadata import version
from typing import TYPE_CHECKING, Any, cast

if TYPE_CHECKING:
    from bleak.args.bluez import BlueZClientArgs


def get_bleak_client_adapter_arg(hci_id: int | None) -> dict[str, Any]:
    """Build the bleak-version-appropriate kwargs for selecting a BlueZ adapter."""
    # Bleak only supports specifying a hci device on Linux with BlueZ;
    # per https://github.com/hbldh/bleak/discussions/867

    if hci_id is None:
        return {}

    bleak_major_version = int(version("bleak").split(".")[0])
    min_bleak_version_with_bluez_adapter = 3
    adapter = f"hci{hci_id}"

    # the "adapter" key of BlueZClientArgs and BlueZScannerArgs only exists on bleak >= 3.0.0;
    # on older bleak, pass adapter= to BleakClient directly
    # (https://bleak.readthedocs.io/en/latest/history.html)
    if bleak_major_version >= min_bleak_version_with_bluez_adapter:
        bluez_args = cast(
            "BlueZClientArgs", {"adapter": adapter}
        )
        return {"bluez": bluez_args}

    return {"adapter": adapter}
