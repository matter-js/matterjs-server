"""Wire contract for 64-bit integers between the server/ws-client JSON and the Python client.

The fixtures live with the TypeScript tests (packages/ws-client/test/JsonUtilsTest.ts): bigint-wire.json is what
the server writes, bigint-wire.python.json is what json_dumps writes for the same data.
"""

from __future__ import annotations

from pathlib import Path

from matter_server.common.helpers.json import json_dumps, json_loads

FIXTURES = Path(__file__).parents[2] / "packages" / "ws-client" / "test" / "fixtures"

EXPECTED = {
    "u64_max": 18446744073709551615,
    "small": 42,
    "safe_max": 9007199254740991,
    "above_safe": 9007199254740993,
    "below_safe": -9007199254740993,
    "i64_min": -9223372036854775808,
    "list": [112233, 18446744073709355009, -9007199254740993],
    "nested": [{"subjects": [9007199254740993]}],
    "hex_like_string": "0x20000000000001",
    "marker_like_string": "__BIGINT__kitchen",
    "float": 1.5,
    "plain_number": 7,
}


def test_reads_server_json_exactly() -> None:
    """Every integer the server writes, up to the full u64/i64 range, arrives as an exact int."""
    data = json_loads(FIXTURES.joinpath("bigint-wire.json").read_text())
    assert data == EXPECTED
    assert all(type(value) is int for value in data["list"])
    assert type(data["u64_max"]) is int
    assert type(data["i64_min"]) is int


def test_writes_json_the_server_reads() -> None:
    """json_dumps output matches the fixture the TypeScript side parses."""
    assert json_dumps(EXPECTED) + "\n" == FIXTURES.joinpath("bigint-wire.python.json").read_text()
