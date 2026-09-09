"""Checks the Python protocol enums against the TypeScript definitions they mirror.

The enums' own tests only compare Python to Python; without this, a command or error code
added on the TypeScript side leaves the Python client non-conformant with every test green.
Skipped only when the package is tested standalone, without the repository around it — a
moved or renamed TypeScript source must fail, not silently disable the check.
"""

from __future__ import annotations

from pathlib import Path
import re

import pytest

from matter_ble_proxy.protocol import BleProxyCommand, BleProxyErrorCode

_TS_PROTOCOL = Path(__file__).parents[2] / "packages" / "ble-proxy" / "src" / "BleProxyProtocol.ts"


def _ts_wire_values(const_name: str) -> set[str]:
    source = _TS_PROTOCOL.read_text()
    match = re.search(rf"export const {const_name} = {{(.*?)}} as const;", source, re.DOTALL)
    assert match is not None, f"{const_name} not found in {_TS_PROTOCOL}"
    block = match.group(1)
    values = set(re.findall(r':\s*"([a-z0-9_]+)"', block))
    # A member whose value the pattern cannot read would drop out of both sides of the
    # comparison and pass silently, so every declared member must be accounted for.
    assert len(values) == len(re.findall(r"^\s*\w+:", block, re.MULTILINE))
    return values


pytestmark = pytest.mark.skipif(
    not (_TS_PROTOCOL.parents[3] / "packages").is_dir(), reason="TypeScript sources not available"
)


def test_commands_match_typescript():
    assert {command.value for command in BleProxyCommand} == _ts_wire_values("BleProxyCommand")


def test_error_codes_match_typescript():
    assert {code.value for code in BleProxyErrorCode} == _ts_wire_values("BleProxyErrorCode")
