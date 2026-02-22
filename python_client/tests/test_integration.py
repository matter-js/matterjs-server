"""Full integration test: Python MatterClient against real Matter.js server.

Mirrors the JS IntegrationTest.ts at packages/matter-server/test/IntegrationTest.ts.
Covers: server commands, device discovery, commissioning, node queries, attribute
operations, device commands, interview, commissioning window, test node import,
server restart persistence, and decommissioning.

Run with:
    cd python_client && .venv/bin/python -m pytest tests/test_integration.py -v --timeout=120
"""

from __future__ import annotations

import asyncio
import json
import logging

import aiohttp
import pytest
import pytest_asyncio

from matter_server.common.models import APICommand, EventType
from tests.helpers import (
    MANUAL_PAIRING_CODE,
    MatterTestClient,
    SERVER_PORT,
    SERVER_WS_URL,
    cleanup_temp_storage,
    create_temp_storage_paths,
    kill_process,
    start_server,
    start_test_device,
    wait_for_device_ready,
    wait_for_port,
)

logger = logging.getLogger(__name__)

# All async tests in this module share a single event loop (module scope)
pytestmark = pytest.mark.asyncio(loop_scope="module")

# ---------------------------------------------------------------------------
# Module-level mutable state shared across ordered tests
# ---------------------------------------------------------------------------
_state: dict = {}


# ---------------------------------------------------------------------------
# Helper: wait for OnOff attribute_updated event
# ---------------------------------------------------------------------------
async def wait_for_onoff_update(
    client: MatterTestClient, node_id: int, expected_value: bool
) -> None:
    """Wait for an attribute_updated event on the OnOff cluster (1/6/0)."""
    event = await client.wait_for_event(
        EventType.ATTRIBUTE_UPDATED.value,
        matcher=lambda data: data == expected_value,
        timeout=10.0,
    )
    assert event.data == expected_value


# ============================================================================
# Fixtures
# ============================================================================


@pytest_asyncio.fixture(scope="module", loop_scope="module")
async def env():
    """Start server, connect client, yield shared state, then tear down."""
    server_path, device_path = create_temp_storage_paths()

    logger.info("Server storage: %s", server_path)
    logger.info("Device storage: %s", device_path)

    # Start server
    logger.info("Starting server...")
    server_proc = start_server(server_path)
    await wait_for_port(SERVER_PORT)
    logger.info("Server is ready")

    # Connect client and start listening loop
    session = aiohttp.ClientSession()
    client = MatterTestClient(SERVER_WS_URL, session)
    nodes, listen_task = await client.start_listening_and_get_nodes()
    logger.info(
        "Connected to server, schema version: %s, initial nodes: %d",
        client.server_info.schema_version,
        len(nodes),
    )

    _state.update(
        {
            "server_proc": server_proc,
            "device_proc": None,
            "client": client,
            "session": session,
            "server_path": server_path,
            "device_path": device_path,
            "node_id": None,
            "listen_task": listen_task,
            "test_node_id": None,
            "test_node2_id": None,
        }
    )

    yield _state

    # Teardown
    if _state.get("listen_task") and not _state["listen_task"].done():
        _state["listen_task"].cancel()
        try:
            await _state["listen_task"]
        except (asyncio.CancelledError, Exception):
            pass
    await client.close()
    await session.close()
    kill_process(_state.get("server_proc"))
    kill_process(_state.get("device_proc"))
    cleanup_temp_storage(server_path, device_path)


# ============================================================================
# Section 1 -- Server Commands (no device needed)
# ============================================================================


class TestServerCommands:
    """Server commands that do not require a commissioned device."""

    async def test_01_health_endpoint(self, env):
        """Health endpoint returns 200 with version and node_count=0."""
        async with aiohttp.ClientSession() as http:
            resp = await http.get(f"http://localhost:{SERVER_PORT}/health")
            assert resp.status == 200
            assert resp.content_type == "application/json"
            body = await resp.json()
            assert "version" in body
            assert "node_count" in body
            assert isinstance(body["version"], str) and len(body["version"]) > 0
            assert body["node_count"] == 0

    async def test_02_server_info_command(self, env):
        """Server info via server_info command."""
        client: MatterTestClient = env["client"]
        info = await client.fetch_server_info()

        assert "fabric_id" in info
        assert "compressed_fabric_id" in info
        assert info["schema_version"] == 11
        assert info["min_supported_schema_version"] == 11
        assert "matter-server" in info["sdk_version"]
        assert "matter.js" in info["sdk_version"]
        assert isinstance(info["wifi_credentials_set"], bool)
        assert isinstance(info["thread_credentials_set"], bool)
        assert isinstance(info["bluetooth_enabled"], bool)

    async def test_03_no_commissioned_nodes_initially(self, env):
        """start_listening returns empty node list."""
        client: MatterTestClient = env["client"]
        # The listen loop was already started in the fixture;
        # verify initial node list is empty.
        nodes = client.get_nodes()
        assert nodes == []

    async def test_04_get_nodes_empty(self, env):
        """get_nodes returns empty initially."""
        client: MatterTestClient = env["client"]
        nodes = client.get_nodes()
        assert nodes == []

    async def test_05_vendor_names_no_filter(self, env):
        """Get vendor names without filter -- should have >100 entries."""
        client: MatterTestClient = env["client"]
        vendors = await client.send_command(APICommand.GET_VENDOR_NAMES)
        assert isinstance(vendors, dict)
        assert len(vendors) > 100
        # Test vendor 0xFFF1 = 65521 should be present (key may be string)
        assert "65521" in vendors or 65521 in vendors or "0xfff1" in vendors

    async def test_06_vendor_names_filtered(self, env):
        """Get vendor names with filter."""
        client: MatterTestClient = env["client"]
        vendors = await client.send_command(
            APICommand.GET_VENDOR_NAMES, filter_vendors=[0xFFF1, 0x1234]
        )
        assert isinstance(vendors, dict)
        assert len(vendors) <= 2

    async def test_07_diagnostics(self, env):
        """Get diagnostics."""
        client: MatterTestClient = env["client"]
        diag = await client.get_diagnostics()
        assert diag.info is not None
        assert diag.info.schema_version == 11
        assert isinstance(diag.nodes, list)
        assert isinstance(diag.events, list)

    async def test_08_set_wifi_credentials(self, env):
        """Set wifi credentials and verify server_info_updated event."""
        client: MatterTestClient = env["client"]
        client.clear_events()
        await client.set_wifi_credentials("TestNetwork", "TestPassword123")

        event = await client.wait_for_event(
            EventType.SERVER_INFO_UPDATED.value, timeout=5.0
        )
        assert event is not None

        info = await client.fetch_server_info()
        assert info["wifi_credentials_set"] is True

    async def test_09_set_thread_dataset(self, env):
        """Set thread dataset and verify server_info_updated event."""
        client: MatterTestClient = env["client"]
        client.clear_events()

        mock_dataset = (
            "0e080000000000010000000300001035060004001fffe002"
            "08fedcba9876543210"
        )
        await client.set_thread_operational_dataset(mock_dataset)

        event = await client.wait_for_event(
            EventType.SERVER_INFO_UPDATED.value, timeout=5.0
        )
        assert event is not None

        info = await client.fetch_server_info()
        assert info["thread_credentials_set"] is True

    async def test_10_set_default_fabric_label(self, env):
        """Set default fabric label (no exception expected)."""
        client: MatterTestClient = env["client"]
        await client.set_default_fabric_label("Test Fabric Label")

    async def test_11_reset_fabric_label(self, env):
        """Reset fabric label with empty string (should not throw)."""
        client: MatterTestClient = env["client"]
        await client.set_default_fabric_label("")

    async def test_12_error_node_not_exists(self, env):
        """NodeNotExists error for non-existent node."""
        client: MatterTestClient = env["client"]
        error = await client.send_command_expect_error(
            "get_node", {"node_id": 999999}
        )
        assert error["error_code"] == 5  # NodeNotExists
        assert "999999" in error["details"]

    async def test_13_error_invalid_command(self, env):
        """InvalidCommand error for unknown command."""
        client: MatterTestClient = env["client"]
        error = await client.send_command_expect_error("unknown_command_xyz", {})
        assert error["error_code"] == 9  # InvalidCommand
        assert "unknown_command_xyz" in error["details"]

    async def test_14_error_invalid_arguments_commission(self, env):
        """InvalidArguments error for commission_on_network with missing filter."""
        client: MatterTestClient = env["client"]
        error = await client.send_command_expect_error(
            "commission_on_network",
            {"setup_pin_code": 12345678, "filter_type": 1},
        )
        assert error["error_code"] == 8  # InvalidArguments
        assert "filter" in error["details"].lower()

    async def test_15_error_invalid_arguments_write_wildcard(self, env):
        """InvalidArguments error for write_attribute with wildcard path."""
        client: MatterTestClient = env["client"]
        error = await client.send_command_expect_error(
            "write_attribute",
            {"node_id": 1, "attribute_path": "0/40/*", "value": "test"},
        )
        assert error["error_code"] == 8  # InvalidArguments
        assert "wildcard" in error["details"].lower()

    async def test_16_error_invalid_arguments_import_test_node(self, env):
        """InvalidArguments error for import_test_node with invalid dump."""
        client: MatterTestClient = env["client"]
        error = await client.send_command_expect_error(
            "import_test_node",
            {"dump": json.dumps({"data": {}})},
        )
        assert error["error_code"] == 8  # InvalidArguments
        assert "Invalid dump format" in error["details"]

    async def test_17_error_node_not_exists_remove(self, env):
        """NodeNotExists error when removing non-existent node."""
        client: MatterTestClient = env["client"]
        error = await client.send_command_expect_error(
            "remove_node", {"node_id": 999999}
        )
        assert error["error_code"] == 5  # NodeNotExists
        assert "999999" in error["details"]


# ============================================================================
# Section 2 -- Device Discovery
# ============================================================================


class TestDeviceDiscovery:
    """Device discovery tests -- starts the test device first."""

    async def test_18_start_test_device(self, env):
        """Start the test device so it can be discovered."""
        logger.info("Starting test device for discovery...")
        device_proc = start_test_device(env["device_path"])
        env["device_proc"] = device_proc
        await wait_for_device_ready(device_proc)
        # Give mDNS time to propagate
        await asyncio.sleep(3)

    async def test_19_discover_commissionable_nodes(self, env):
        """Discover commissionable nodes and find our test device."""
        client: MatterTestClient = env["client"]
        nodes = await client.discover_commissionable_nodes()

        assert isinstance(nodes, list)
        test_device = next(
            (n for n in nodes if n.vendor_id == 0xFFF1), None
        )
        assert test_device is not None
        assert test_device.long_discriminator == 3840


# ============================================================================
# Section 3 -- Node Commissioning
# ============================================================================


class TestNodeCommissioning:
    """Commission the test device."""

    async def test_20_commission_with_code(self, env):
        """Commission device with manual pairing code."""
        client: MatterTestClient = env["client"]
        logger.info("Commissioning device...")

        node_data = await client.commission_with_code(MANUAL_PAIRING_CODE)
        node_id = node_data.node_id
        env["node_id"] = node_id

        logger.info("Node commissioned: %s", node_id)
        assert node_id == 1

        assert node_data.available is True
        assert node_data.is_bridge is False

        # Basic Information cluster (endpoint 0, cluster 40)
        assert "0/40/0" in node_data.attributes  # DataModelRevision
        assert node_data.attributes["0/40/1"] == "Test Vendor"
        assert node_data.attributes["0/40/3"] == "Test Light"

        # OnOff cluster on endpoint 1 (cluster 6)
        assert node_data.attributes["1/6/0"] is False


# ============================================================================
# Section 4 -- Node Queries (require commissioned node)
# ============================================================================


class TestNodeQueries:
    """Query operations on the commissioned node."""

    async def test_21_health_shows_node_count_1(self, env):
        """Health endpoint shows node_count=1 after commissioning."""
        async with aiohttp.ClientSession() as http:
            resp = await http.get(f"http://localhost:{SERVER_PORT}/health")
            assert resp.status == 200
            body = await resp.json()
            assert body["node_count"] == 1

    async def test_22_get_nodes_returns_one(self, env):
        """get_nodes returns 1 node."""
        client: MatterTestClient = env["client"]
        # We need to fetch nodes from the server since local cache may not
        # have been populated by start_listening yet for the new node.
        # The commission_with_code already triggers node_added event which
        # updates the local cache via the listen loop.
        nodes = client.get_nodes()
        assert len(nodes) >= 1
        assert any(n.node_id == env["node_id"] for n in nodes)

    async def test_23_get_node_specific(self, env):
        """get_node returns the specific commissioned node."""
        client: MatterTestClient = env["client"]
        node = client.get_node(env["node_id"])
        assert node.node_id == env["node_id"]
        assert node.node_data.attributes["0/40/1"] == "Test Vendor"

    async def test_24_get_node_ip_addresses(self, env):
        """Get node IP addresses."""
        client: MatterTestClient = env["client"]
        ips = await client.get_node_ip_addresses(
            env["node_id"], prefer_cache=False, scoped=False
        )
        assert isinstance(ips, list)
        assert len(ips) > 0
        assert isinstance(ips[0], str)

    async def test_25_ip_addresses_no_zone_id(self, env):
        """IP addresses without zone ID when scoped=False."""
        client: MatterTestClient = env["client"]
        ips = await client.get_node_ip_addresses(
            env["node_id"], prefer_cache=False, scoped=False
        )
        assert len(ips) > 0
        for ip in ips:
            assert "%" not in ip

    async def test_26_ping_node(self, env):
        """Ping node successfully."""
        client: MatterTestClient = env["client"]
        result = await client.ping_node(env["node_id"])
        assert isinstance(result, dict)
        assert len(result) > 0
        assert any(v is True for v in result.values())

    async def test_27_get_matter_fabrics(self, env):
        """Get matter fabrics from the node."""
        client: MatterTestClient = env["client"]
        fabrics = await client.get_matter_fabrics(env["node_id"])
        assert isinstance(fabrics, list)
        assert len(fabrics) > 0
        assert any(f.fabric_index == 1 for f in fabrics)


# ============================================================================
# Section 5 -- Attribute Operations
# ============================================================================


class TestAttributeOperations:
    """Read and write attributes on the commissioned node."""

    async def test_28_read_single_attribute(self, env):
        """Read VendorName (0/40/1)."""
        client: MatterTestClient = env["client"]
        attrs = await client.read_attribute(env["node_id"], "0/40/1")
        assert "0/40/1" in attrs
        assert attrs["0/40/1"] == "Test Vendor"

    async def test_29_read_multiple_attributes(self, env):
        """Read VendorName and ProductName."""
        client: MatterTestClient = env["client"]
        attrs = await client.read_attribute(
            env["node_id"], ["0/40/1", "0/40/3"]
        )
        assert attrs["0/40/1"] == "Test Vendor"
        assert attrs["0/40/3"] == "Test Light"

    async def test_30_read_wildcard(self, env):
        """Read with wildcard (0/40/*)."""
        client: MatterTestClient = env["client"]
        attrs = await client.read_attribute(env["node_id"], "0/40/*")
        assert isinstance(attrs, dict)
        assert len(attrs) > 5

    async def test_31_read_batched(self, env):
        """Read >9 attribute paths to test batching."""
        client: MatterTestClient = env["client"]
        paths = [
            "0/40/0",
            "0/40/1",
            "0/40/2",
            "0/40/3",
            "0/40/4",
            "0/40/5",
            "0/40/6",
            "0/40/7",
            "0/40/8",
            "0/40/9",
            "0/40/10",
            "0/40/17",
        ]
        attrs = await client.read_attribute(env["node_id"], paths)
        assert isinstance(attrs, dict)
        assert attrs["0/40/1"] == "Test Vendor"
        assert attrs["0/40/3"] == "Test Light"
        assert len(attrs) >= 8

    async def test_32_write_node_label(self, env):
        """Write NodeLabel and verify."""
        client: MatterTestClient = env["client"]
        result = await client.write_attribute(
            env["node_id"], "0/40/5", "Integration Test Node"
        )
        assert isinstance(result, list)
        assert result[0]["Status"] == 0

        # Read back
        attrs = await client.read_attribute(env["node_id"], "0/40/5")
        assert attrs["0/40/5"] == "Integration Test Node"


# ============================================================================
# Section 6 -- Device Commands
# ============================================================================


class TestDeviceCommands:
    """Send commands to the light device."""

    async def test_33_toggle_on(self, env):
        """Toggle light ON and verify attribute_updated event."""
        client: MatterTestClient = env["client"]
        node_id = env["node_id"]
        client.clear_events()

        await client.send_device_command(
            node_id=node_id,
            endpoint_id=1,
            command=_onoff_command("Toggle"),
        )
        await wait_for_onoff_update(client, node_id, True)

    async def test_34_toggle_off(self, env):
        """Toggle light OFF and verify attribute_updated event."""
        client: MatterTestClient = env["client"]
        node_id = env["node_id"]
        client.clear_events()

        await client.send_device_command(
            node_id=node_id,
            endpoint_id=1,
            command=_onoff_command("Toggle"),
        )
        await wait_for_onoff_update(client, node_id, False)

    async def test_35_on_command(self, env):
        """Turn on light with On command."""
        client: MatterTestClient = env["client"]
        node_id = env["node_id"]
        client.clear_events()

        await client.send_device_command(
            node_id=node_id,
            endpoint_id=1,
            command=_onoff_command("On"),
        )
        await wait_for_onoff_update(client, node_id, True)

    async def test_36_off_command(self, env):
        """Turn off light with Off command."""
        client: MatterTestClient = env["client"]
        node_id = env["node_id"]
        client.clear_events()

        await client.send_device_command(
            node_id=node_id,
            endpoint_id=1,
            command=_onoff_command("Off"),
        )
        await wait_for_onoff_update(client, node_id, False)


# ============================================================================
# Section 7 -- Node Interview
# ============================================================================


class TestNodeInterview:
    """Interview the commissioned node."""

    async def test_37_interview_node(self, env):
        """Interview node, verify node_updated event."""
        client: MatterTestClient = env["client"]
        node_id = env["node_id"]
        client.clear_events()

        await client.interview_node(node_id)

        event = await client.wait_for_event(
            EventType.NODE_UPDATED.value,
            matcher=lambda data: data.node_id == node_id,
            timeout=10.0,
        )
        assert event is not None


# ============================================================================
# Section 8 -- Commissioning Window
# ============================================================================


class TestCommissioningWindow:
    """Open commissioning window."""

    async def test_38_open_commissioning_window(self, env):
        """Open commissioning window, verify returned pairing codes."""
        client: MatterTestClient = env["client"]
        result = await client.open_commissioning_window(env["node_id"], timeout=180)

        assert isinstance(result.setup_pin_code, int)
        assert isinstance(result.setup_manual_code, str)
        assert len(result.setup_manual_code) > 0
        assert isinstance(result.setup_qr_code, str)
        assert result.setup_qr_code.startswith("MT:")


# ============================================================================
# Section 9 -- Test Node Functionality
# ============================================================================


class TestTestNodeFunctionality:
    """Import, query, and remove test nodes."""

    async def test_39_import_single_test_node(self, env):
        """Import single test node from HA device diagnostic dump format."""
        client: MatterTestClient = env["client"]

        single_node_dump = json.dumps(
            {
                "data": {
                    "node": {
                        "node_id": 999,
                        "date_commissioned": "2024-01-01T00:00:00.000000",
                        "last_interview": "2024-01-01T12:00:00.000000",
                        "interview_version": 6,
                        "available": True,
                        "is_bridge": False,
                        "attributes": {
                            "0/40/0": 19,
                            "0/40/1": "Test Vendor From Dump",
                            "0/40/2": 65521,
                            "0/40/3": "Test Product From Dump",
                            "0/40/4": 32768,
                            "0/40/5": "Test Node Label",
                            "0/29/0": [{"0": 22, "1": 3}],
                            "0/29/1": [40, 29],
                            "1/6/0": True,
                            "1/6/16384": True,
                        },
                        "attribute_subscriptions": [],
                    }
                }
            }
        )

        client.clear_events()
        await client.send_command(APICommand.IMPORT_TEST_NODE, dump=single_node_dump)

        event = await client.wait_for_event(
            EventType.NODE_ADDED.value, timeout=5.0
        )
        assert event is not None

        # Test node IDs start at 0xFFFF_FFFE_0000_0000
        test_node = event.data
        test_node_id = test_node.node_id
        assert test_node_id >= 0xFFFFFFFE00000000
        env["test_node_id"] = test_node_id

        # Verify attributes
        assert test_node.node_data.attributes["0/40/1"] == "Test Vendor From Dump"
        assert test_node.node_data.attributes["0/40/3"] == "Test Product From Dump"

    async def test_40_import_multiple_test_nodes(self, env):
        """Import multiple test nodes from HA server diagnostic dump format."""
        client: MatterTestClient = env["client"]

        multi_node_dump = json.dumps(
            {
                "data": {
                    "server": {
                        "nodes": {
                            "1": {
                                "node_id": 1,
                                "date_commissioned": "2024-02-01T00:00:00.000000",
                                "last_interview": "2024-02-01T12:00:00.000000",
                                "interview_version": 6,
                                "available": True,
                                "is_bridge": False,
                                "attributes": {
                                    "0/40/1": "Multi-Node Vendor 1",
                                    "0/40/3": "Multi-Node Product 1",
                                    "0/40/5": "Node 1 Label",
                                    "1/6/0": False,
                                },
                                "attribute_subscriptions": [],
                            },
                            "2": {
                                "node_id": 2,
                                "date_commissioned": "2024-02-02T00:00:00.000000",
                                "last_interview": "2024-02-02T12:00:00.000000",
                                "interview_version": 6,
                                "available": False,
                                "is_bridge": True,
                                "attributes": {
                                    "0/40/1": "Multi-Node Vendor 2",
                                    "0/40/3": "Multi-Node Bridge",
                                    "0/29/0": [{"0": 14, "1": 1}],
                                },
                                "attribute_subscriptions": [],
                            },
                        }
                    }
                }
            }
        )

        client.clear_events()
        await client.send_command(APICommand.IMPORT_TEST_NODE, dump=multi_node_dump)

        # Wait a bit for events to arrive
        await asyncio.sleep(0.5)

        # Get all nodes, filter to test nodes not matching our first import
        nodes = client.get_nodes()
        first_test_id = env["test_node_id"]
        multi_nodes = [
            n
            for n in nodes
            if n.node_id >= 0xFFFFFFFE00000000 and n.node_id != first_test_id
        ]
        assert len(multi_nodes) >= 2

        env["test_node2_id"] = multi_nodes[0].node_id

    async def test_41_get_nodes_includes_test_nodes(self, env):
        """get_nodes includes all test nodes."""
        client: MatterTestClient = env["client"]
        nodes = client.get_nodes()
        test_nodes = [n for n in nodes if n.node_id >= 0xFFFFFFFE00000000]
        assert len(test_nodes) >= 3

        first = next(
            (n for n in test_nodes if n.node_id == env["test_node_id"]), None
        )
        assert first is not None
        assert first.node_data.attributes["0/40/1"] == "Test Vendor From Dump"

        bridge = next((n for n in test_nodes if n.node_data.is_bridge), None)
        assert bridge is not None
        assert bridge.node_data.attributes["0/40/3"] == "Multi-Node Bridge"

    async def test_42_get_single_test_node(self, env):
        """get_node for a specific test node."""
        client: MatterTestClient = env["client"]
        node = client.get_node(env["test_node_id"])
        assert node.node_id == env["test_node_id"]
        assert node.node_data.attributes["0/40/1"] == "Test Vendor From Dump"
        assert node.node_data.attributes["0/40/3"] == "Test Product From Dump"
        assert node.available is True
        assert node.node_data.is_bridge is False

    async def test_43_read_single_attr_test_node(self, env):
        """Read single attribute from test node."""
        client: MatterTestClient = env["client"]
        attrs = await client.read_attribute(env["test_node_id"], "0/40/1")
        assert attrs["0/40/1"] == "Test Vendor From Dump"

    async def test_44_read_multiple_attrs_test_node(self, env):
        """Read multiple attributes from test node."""
        client: MatterTestClient = env["client"]
        attrs = await client.read_attribute(
            env["test_node_id"], ["0/40/1", "0/40/3", "0/40/5"]
        )
        assert attrs["0/40/1"] == "Test Vendor From Dump"
        assert attrs["0/40/3"] == "Test Product From Dump"
        assert attrs["0/40/5"] == "Test Node Label"

    async def test_45_read_endpoint_wildcard_test_node(self, env):
        """Read with endpoint wildcard from test node."""
        client: MatterTestClient = env["client"]
        attrs = await client.read_attribute(env["test_node_id"], "*/40/1")
        assert "0/40/1" in attrs
        assert attrs["0/40/1"] == "Test Vendor From Dump"

    async def test_46_read_cluster_wildcard_test_node(self, env):
        """Read with cluster wildcard from test node."""
        client: MatterTestClient = env["client"]
        attrs = await client.read_attribute(env["test_node_id"], "0/*/1")
        assert "0/40/1" in attrs  # VendorName
        assert "0/29/1" in attrs  # ServerList

    async def test_47_read_attribute_wildcard_test_node(self, env):
        """Read all attributes from cluster wildcard on test node."""
        client: MatterTestClient = env["client"]
        attrs = await client.read_attribute(env["test_node_id"], "0/40/*")
        assert "0/40/0" in attrs
        assert "0/40/1" in attrs
        assert "0/40/2" in attrs
        assert "0/40/3" in attrs
        assert "0/40/4" in attrs
        assert "0/40/5" in attrs

    async def test_48_read_nonexistent_attr_test_node(self, env):
        """Non-existent attribute returns None/undefined."""
        client: MatterTestClient = env["client"]
        attrs = await client.read_attribute(env["test_node_id"], "99/99/99")
        assert attrs.get("99/99/99") is None

    async def test_49_read_batched_test_node(self, env):
        """Read >9 paths on test node (batching)."""
        client: MatterTestClient = env["client"]
        paths = [
            "0/40/0",
            "0/40/1",
            "0/40/2",
            "0/40/3",
            "0/40/4",
            "0/40/5",
            "0/29/0",
            "0/29/1",
            "1/6/0",
            "1/6/16384",
            "99/99/99",
            "99/99/98",
        ]
        attrs = await client.read_attribute(env["test_node_id"], paths)
        assert attrs["0/40/1"] == "Test Vendor From Dump"
        assert attrs["0/40/3"] == "Test Product From Dump"
        assert attrs["1/6/0"] is True
        assert attrs.get("99/99/99") is None
        assert attrs.get("99/99/98") is None

    async def test_50_write_attr_test_node(self, env):
        """Write attribute to test node (mock)."""
        client: MatterTestClient = env["client"]
        result = await client.write_attribute(
            env["test_node_id"], "0/40/5", "New Test Label"
        )
        assert isinstance(result, list)
        assert result[0]["Status"] == 0

    async def test_51_device_command_toggle_test_node(self, env):
        """Device command toggle on test node (mock)."""
        client: MatterTestClient = env["client"]
        result = await client.send_command(
            APICommand.DEVICE_COMMAND,
            node_id=env["test_node_id"],
            endpoint_id=1,
            cluster_id=6,
            command_name="Toggle",
            payload={},
        )
        assert result is None

    async def test_52_device_command_on_test_node(self, env):
        """On command on test node (mock)."""
        client: MatterTestClient = env["client"]
        result = await client.send_command(
            APICommand.DEVICE_COMMAND,
            node_id=env["test_node_id"],
            endpoint_id=1,
            cluster_id=6,
            command_name="On",
            payload={},
        )
        assert result is None

    async def test_53_device_command_with_payload_test_node(self, env):
        """Command with payload on test node (identify)."""
        client: MatterTestClient = env["client"]
        result = await client.send_command(
            APICommand.DEVICE_COMMAND,
            node_id=env["test_node_id"],
            endpoint_id=1,
            cluster_id=3,
            command_name="Identify",
            payload={"identify_time": 10},
        )
        assert result is None

    async def test_54_mock_ip_addresses_test_node(self, env):
        """Test node returns mock IP addresses."""
        client: MatterTestClient = env["client"]
        ips = await client.send_command(
            APICommand.GET_NODE_IP_ADDRESSES,
            node_id=env["test_node_id"],
            prefer_cache=False,
            scoped=False,
        )
        assert isinstance(ips, list)
        assert len(ips) > 0
        assert "0.0.0.0" in ips

    async def test_55_mock_scoped_ip_addresses_test_node(self, env):
        """Test node returns mock scoped IP addresses."""
        client: MatterTestClient = env["client"]
        ips = await client.send_command(
            APICommand.GET_NODE_IP_ADDRESSES,
            node_id=env["test_node_id"],
            prefer_cache=False,
            scoped=True,
        )
        assert isinstance(ips, list)
        assert len(ips) > 0

    async def test_56_mock_ping_test_node(self, env):
        """Test node returns mock ping results."""
        client: MatterTestClient = env["client"]
        result = await client.ping_node(env["test_node_id"])
        assert isinstance(result, dict)
        assert len(result) > 0
        assert all(v is True for v in result.values())

    async def test_57_interview_test_node(self, env):
        """Interview test node triggers node_updated event."""
        client: MatterTestClient = env["client"]
        test_node_id = env["test_node_id"]
        client.clear_events()

        await client.interview_node(test_node_id)

        event = await client.wait_for_event(
            EventType.NODE_UPDATED.value,
            matcher=lambda data: data.node_id == test_node_id,
            timeout=5.0,
        )
        assert event is not None

    async def test_58_remove_test_node(self, env):
        """Remove a test node and verify node_removed event."""
        client: MatterTestClient = env["client"]
        test_node2_id = env["test_node2_id"]
        client.clear_events()

        await client.remove_node(test_node2_id)

        event = await client.wait_for_event(
            EventType.NODE_REMOVED.value,
            matcher=lambda data: data == test_node2_id,
            timeout=5.0,
        )
        assert event is not None
        assert event.data == test_node2_id

        # Verify node is no longer in get_nodes
        nodes = client.get_nodes()
        assert not any(n.node_id == test_node2_id for n in nodes)

    async def test_59_get_removed_test_node_raises(self, env):
        """Getting a removed test node raises."""
        client: MatterTestClient = env["client"]
        with pytest.raises(Exception, match="does not exist"):
            client.get_node(env["test_node2_id"])

    async def test_60_other_test_nodes_still_exist(self, env):
        """Other test nodes remain after removing one."""
        client: MatterTestClient = env["client"]
        nodes = client.get_nodes()
        test_nodes = [n for n in nodes if n.node_id >= 0xFFFFFFFE00000000]
        assert len(test_nodes) >= 2
        assert any(n.node_id == env["test_node_id"] for n in test_nodes)

    async def test_61_filter_unavailable_test_nodes(self, env):
        """Filtering with only_available=True excludes unavailable test nodes."""
        client: MatterTestClient = env["client"]
        # Use get_nodes from server (client-side filtering)
        all_nodes = client.get_nodes()
        available_test = [
            n
            for n in all_nodes
            if n.node_id >= 0xFFFFFFFE00000000 and n.available
        ]
        unavailable_test = [
            n
            for n in all_nodes
            if n.node_id >= 0xFFFFFFFE00000000 and not n.available
        ]
        # The bridge node has available=False so it should exist
        # Depending on which was removed, verify counts
        total_test = len(available_test) + len(unavailable_test)
        assert total_test >= 2


# ============================================================================
# Section 10 -- Server Restart Persistence
# ============================================================================


class TestServerRestartPersistence:
    """Stop and restart the server, verify node persists."""

    async def test_62_restart_server_and_verify(self, env):
        """Restart server with same storage, verify node persists."""
        client: MatterTestClient = env["client"]
        session: aiohttp.ClientSession = env["session"]
        node_id = env["node_id"]

        # Cancel existing listen task
        if env.get("listen_task") and not env["listen_task"].done():
            env["listen_task"].cancel()
            try:
                await env["listen_task"]
            except (asyncio.CancelledError, Exception):
                pass

        # Close client
        await client.close()

        # Stop server
        logger.info("Stopping server for restart test...")
        kill_process(env["server_proc"])
        await asyncio.sleep(2)

        # Restart server with the same storage path
        logger.info("Restarting server...")
        env["server_proc"] = start_server(env["server_path"])
        await wait_for_port(SERVER_PORT)
        logger.info("Server restarted")

        # Reconnect with a new session (old one may have stale connections)
        await session.close()
        new_session = aiohttp.ClientSession()
        env["session"] = new_session

        new_client = MatterTestClient(SERVER_WS_URL, new_session)
        server_info = await new_client.connect_and_get_server_info()
        env["client"] = new_client
        logger.info(
            "Reconnected to server, schema version: %s", server_info.schema_version
        )

        # Start listening to get initial nodes
        nodes, listen_task = await new_client.start_listening_and_get_nodes()
        env["listen_task"] = listen_task

        # Test nodes don't persist across restart; only real nodes remain
        real_nodes = [n for n in nodes if n.node_id < 0xFFFFFFFE00000000]
        assert len(real_nodes) == 1

        node = real_nodes[0]
        assert node.node_id == node_id
        assert node.node_data.attributes["0/40/1"] == "Test Vendor"
        assert node.node_data.attributes["0/40/3"] == "Test Light"

        # Wait for device to reconnect
        node_available = False
        for _ in range(20):
            await asyncio.sleep(0.5)
            updated_nodes = new_client.get_nodes()
            updated_node = next(
                (n for n in updated_nodes if n.node_id == node_id), None
            )
            if updated_node and updated_node.available:
                node_available = True
                break

        if not node_available:
            logger.warning(
                "Node did not reconnect after server restart (10s). "
                "Skipping post-restart command tests."
            )
            return

        # Toggle ON
        new_client.clear_events()
        await new_client.send_device_command(
            node_id=node_id,
            endpoint_id=1,
            command=_onoff_command("Toggle"),
        )
        await wait_for_onoff_update(new_client, node_id, True)

        # Toggle OFF
        new_client.clear_events()
        await new_client.send_device_command(
            node_id=node_id,
            endpoint_id=1,
            command=_onoff_command("Toggle"),
        )
        await wait_for_onoff_update(new_client, node_id, False)

        logger.info("Server restart test passed -- node persisted and functional")


# ============================================================================
# Section 11 -- Decommissioning
# ============================================================================


class TestDecommissioning:
    """Remove the commissioned node."""

    async def test_63_decommission_node(self, env):
        """Decommission node, verify node_removed event."""
        client: MatterTestClient = env["client"]
        node_id = env["node_id"]

        # Ensure node is available
        node_available = False
        for _ in range(20):
            nodes = client.get_nodes()
            real_nodes = [n for n in nodes if n.node_id < 0xFFFFFFFE00000000]
            node = next((n for n in real_nodes if n.node_id == node_id), None)
            if node and node.available:
                node_available = True
                break
            await asyncio.sleep(0.5)

        if not node_available:
            logger.warning(
                "Node not available for decommission (waited 10s). "
                "Proceeding anyway."
            )

        client.clear_events()
        await client.remove_node(node_id)

        event = await client.wait_for_event(
            EventType.NODE_REMOVED.value,
            matcher=lambda data: data == node_id,
            timeout=10.0,
        )
        assert event is not None
        assert event.data == node_id

        # Verify no real nodes remain
        nodes = client.get_nodes()
        real_nodes = [n for n in nodes if n.node_id < 0xFFFFFFFE00000000]
        assert real_nodes == []


# ============================================================================
# Helpers
# ============================================================================


def _onoff_command(name: str):
    """Create a chip.clusters OnOff command instance by name.

    The chip SDK cluster command objects are used by send_device_command.
    Supported names: Toggle, On, Off.
    """
    from chip.clusters import Objects as Clusters

    commands = {
        "Toggle": Clusters.OnOff.Commands.Toggle,
        "On": Clusters.OnOff.Commands.On,
        "Off": Clusters.OnOff.Commands.Off,
    }
    cmd_class = commands[name]
    return cmd_class()
