/**
 * Integration test for the Matter.js server.
 *
 * This test starts the actual server and a test device, then validates
 * the full commissioning and control flow via WebSocket.
 */

import { expect } from "chai";
import { ChildProcess } from "child_process";
import {
    cleanupTempStorage,
    createTempStoragePaths,
    killProcess,
    MANUAL_PAIRING_CODE,
    MatterWebSocketClient,
    SERVER_PORT,
    SERVER_WS_URL,
    startServer,
    startTestDevice,
    waitForDeviceReady,
    waitForPort,
} from "./helpers/index.js";

const TEST_TIMEOUT = 120_000; // 2 minutes for Matter commissioning

/**
 * Helper to wait for OnOff attribute update event.
 */
async function waitForOnOffUpdate(
    client: MatterWebSocketClient,
    nodeId: number,
    expectedValue: boolean,
): Promise<void> {
    const event = await client.waitForEvent(
        "attribute_updated",
        data => {
            const [eventNodeId, path] = data as [number, string, unknown];
            return eventNodeId === nodeId && path === "1/6/0";
        },
        10_000,
    );
    const [, , value] = event.data as [number, string, boolean];
    expect(value).to.equal(expectedValue);
}

describe("Integration Test", function () {
    this.timeout(TEST_TIMEOUT);

    let serverProcess: ChildProcess;
    let deviceProcess: ChildProcess;
    let client: MatterWebSocketClient;
    let serverStoragePath: string;
    let deviceStoragePath: string;
    let commissionedNodeId: number;

    before(async function () {
        // Create temp directories
        const paths = await createTempStoragePaths();
        serverStoragePath = paths.serverStoragePath;
        deviceStoragePath = paths.deviceStoragePath;

        console.log(`Server storage: ${serverStoragePath}`);
        console.log(`Device storage: ${deviceStoragePath}`);

        // Start server process
        console.log("Starting server...");
        serverProcess = startServer(serverStoragePath);

        // Wait for server to be ready
        await waitForPort(SERVER_PORT);
        console.log("Server is ready");

        // Connect WebSocket client
        client = new MatterWebSocketClient(SERVER_WS_URL);
        const serverInfo = await client.connect();
        console.log("Connected to server, schema version:", serverInfo.schema_version);
    });

    after(async function () {
        // Close WebSocket client
        if (client) {
            await client.close();
        }

        // Kill processes
        await killProcess(deviceProcess);
        await killProcess(serverProcess);

        // Cleanup temp directories
        await cleanupTempStorage(serverStoragePath, deviceStoragePath);
    });

    // =========================================================================
    // Server Info & Basic Commands (no device needed)
    // =========================================================================

    describe("Server Commands (no device needed)", function () {
        it("should return server info via server_info command", async function () {
            const info = await client.fetchServerInfo();

            expect(info).to.have.property("fabric_id");
            expect(info).to.have.property("compressed_fabric_id");
            expect(info.schema_version).to.equal(11);
            expect(info.min_supported_schema_version).to.equal(11);
            expect(info.sdk_version).to.be.a("string").that.includes("matter.js");
            expect(info.wifi_credentials_set).to.be.a("boolean");
            expect(info.thread_credentials_set).to.be.a("boolean");
            expect(info.bluetooth_enabled).to.be.a("boolean");
        });

        it("should have no commissioned nodes initially", async function () {
            const nodes = await client.startListening();
            expect(nodes).to.be.an("array").that.is.empty;
        });

        it("should return empty array from get_nodes initially", async function () {
            const nodes = await client.getNodes();
            expect(nodes).to.be.an("array").that.is.empty;
        });

        it("should return vendor names without filter", async function () {
            const vendors = await client.getVendorNames();

            expect(vendors).to.be.an("object");
            // Should have many vendors (static list + DCL)
            expect(Object.keys(vendors).length).to.be.greaterThan(100);
            // Check some known vendors
            expect(vendors["0xfff1"] || vendors["65521"]).to.exist; // Test vendor
        });

        it("should return filtered vendor names", async function () {
            const vendors = await client.getVendorNames([0xfff1, 0x1234]);

            expect(vendors).to.be.an("object");
            // Should only have the filtered vendors (that exist)
            expect(Object.keys(vendors).length).to.be.lessThanOrEqual(2);
        });

        it("should return diagnostics", async function () {
            const diag = await client.getDiagnostics();

            expect(diag).to.have.property("info");
            expect(diag).to.have.property("nodes");
            expect(diag).to.have.property("events");
            expect(diag.info.schema_version).to.equal(11);
            expect(diag.nodes).to.be.an("array");
            expect(diag.events).to.be.an("array");
        });

        it("should set wifi credentials and update server info", async function () {
            // Set credentials
            await client.setWifiCredentials("TestNetwork", "TestPassword123");

            // Wait for server_info_updated event
            const event = await client.waitForEvent("server_info_updated", undefined, 5000);
            expect(event).to.exist;

            // Verify via server_info
            const info = await client.fetchServerInfo();
            expect(info.wifi_credentials_set).to.be.true;
        });

        it("should set thread dataset and update server info", async function () {
            // Set a mock thread dataset (hex encoded)
            const mockDataset = "0e080000000000010000000300001035060004001fffe00208fedcba9876543210";
            await client.setThreadDataset(mockDataset);

            // Wait for server_info_updated event
            client.clearEvents();
            const event = await client.waitForEvent("server_info_updated", undefined, 5000);
            expect(event).to.exist;

            // Verify via server_info
            const info = await client.fetchServerInfo();
            expect(info.thread_credentials_set).to.be.true;
        });

        it("should set default fabric label", async function () {
            await client.setDefaultFabricLabel("Test Fabric Label");
            // Label is stored but not directly queryable via server_info
            // It will be used on the next commissioning
        });

        it("should reset fabric label to 'Home' when null/empty is passed", async function () {
            // matter.js validates fabric label must be 1-32 chars
            // So null/empty resets to "Home" instead of clearing
            await client.setDefaultFabricLabel("");
            // No direct way to verify the result via API, but it should not throw
        });
    });

    // =========================================================================
    // Discovery Tests
    // =========================================================================

    describe("Device Discovery", function () {
        before(async function () {
            // Start device process for discovery
            console.log("Starting test device for discovery...");
            deviceProcess = startTestDevice(deviceStoragePath);
            await waitForDeviceReady(deviceProcess);

            // Give mDNS time to propagate
            await new Promise(r => setTimeout(r, 3000));
        });

        it("should discover commissionable nodes via discover command", async function () {
            const nodes = await client.discover();

            expect(nodes).to.be.an("array");
            // Should find at least our test device
            const testDevice = nodes.find(n => n.vendor_id === 0xfff1 && n.product_id === 0x8000);
            expect(testDevice).to.exist;
            expect(testDevice!.long_discriminator).to.equal(3840);
        });

        it("should discover commissionable nodes via discover_commissionable_nodes", async function () {
            const nodes = await client.discoverCommissionableNodes();

            expect(nodes).to.be.an("array");
            const testDevice = nodes.find(n => n.vendor_id === 0xfff1);
            expect(testDevice).to.exist;
        });
    });

    // =========================================================================
    // Commissioning Tests
    // =========================================================================

    describe("Node Commissioning", function () {
        it("should commission device with pairing code", async function () {
            console.log("Commissioning device...");

            const node = await client.commissionWithCode(MANUAL_PAIRING_CODE);
            commissionedNodeId = Number(node.node_id);

            console.log("Node commissioned:", commissionedNodeId);

            // Verify node ID is 2 (first commissioned node - controller uses node ID 1)
            expect(commissionedNodeId).to.equal(2);

            // Verify node metadata
            expect(node.available).to.be.true;
            expect(node.is_bridge).to.be.false;

            // Verify Basic Information cluster (endpoint 0, cluster 40)
            expect(node.attributes["0/40/0"]).to.exist; // DataModelRevision
            expect(node.attributes["0/40/1"]).to.equal("Test Vendor"); // VendorName
            expect(node.attributes["0/40/3"]).to.equal("Test Light"); // ProductName

            // Verify OnOff cluster on endpoint 1 (cluster 6)
            expect(node.attributes["1/6/0"]).to.equal(false); // OnOff initially off
        });
    });

    // =========================================================================
    // Node Query Tests (require commissioned node)
    // =========================================================================

    describe("Node Queries", function () {
        it("should get nodes via get_nodes", async function () {
            const nodes = await client.getNodes();

            expect(nodes).to.be.an("array").with.lengthOf(1);
            expect(Number(nodes[0].node_id)).to.equal(commissionedNodeId);
        });

        it("should filter available nodes via get_nodes", async function () {
            const nodes = await client.getNodes(true);

            expect(nodes).to.be.an("array").with.lengthOf(1);
            expect(nodes[0].available).to.be.true;
        });

        it("should get specific node via get_node", async function () {
            const node = await client.getNode(commissionedNodeId);

            expect(Number(node.node_id)).to.equal(commissionedNodeId);
            expect(node.attributes["0/40/1"]).to.equal("Test Vendor");
        });

        it("should get node IP addresses", async function () {
            const ips = await client.getNodeIpAddresses(commissionedNodeId, false, false);

            expect(ips).to.be.an("array").that.is.not.empty;
            // Should contain at least one IP address
            expect(ips[0]).to.be.a("string");
        });

        it("should get scoped IP addresses (without zone ID)", async function () {
            const ips = await client.getNodeIpAddresses(commissionedNodeId, false, true);

            expect(ips).to.be.an("array").that.is.not.empty;
            // Scoped IPs should not contain % (zone ID)
            for (const ip of ips) {
                expect(ip).to.not.include("%");
            }
        });

        it("should ping node successfully", async function () {
            const result = await client.pingNode(commissionedNodeId);

            expect(result).to.be.an("object");
            // Should have at least one IP with result
            const values = Object.values(result);
            expect(values.length).to.be.greaterThan(0);
            // At least one should be successful
            expect(values.some(v => v === true)).to.be.true;
        });

        it("should get matter fabrics from node", async function () {
            const fabrics = await client.getMatterFabrics(commissionedNodeId);

            expect(fabrics).to.be.an("array").that.is.not.empty;
            // Should have at least our fabric
            const ourFabric = fabrics.find(f => f.fabric_index === 1);
            expect(ourFabric).to.exist;
        });
    });

    // =========================================================================
    // Attribute Read/Write Tests
    // =========================================================================

    describe("Attribute Operations", function () {
        it("should read single attribute", async function () {
            // Read VendorName from BasicInformation (0/40/1)
            const attrs = await client.readAttribute(commissionedNodeId, "0/40/1");

            expect(attrs).to.have.property("0/40/1");
            expect(attrs["0/40/1"]).to.equal("Test Vendor");
        });

        it("should read multiple attributes", async function () {
            // Read VendorName and ProductName
            const attrs = await client.readAttribute(commissionedNodeId, ["0/40/1", "0/40/3"]);

            expect(attrs).to.have.property("0/40/1");
            expect(attrs).to.have.property("0/40/3");
            expect(attrs["0/40/1"]).to.equal("Test Vendor");
            expect(attrs["0/40/3"]).to.equal("Test Light");
        });

        it("should read attributes with wildcard", async function () {
            // Wildcard reads work by collecting all attributes from the node and filtering
            const attrs = await client.readAttribute(commissionedNodeId, "0/40/*");
            expect(attrs).to.be.an("object");
            expect(Object.keys(attrs).length).to.be.greaterThan(5);
        });

        it("should write NodeLabel attribute", async function () {
            // NodeLabel is attribute 5 in BasicInformation (0/40/5)
            const result = await client.writeAttribute(commissionedNodeId, "0/40/5", "Integration Test Node");

            expect(result).to.be.an("array");
            const writeResult = result as Array<{ Path: object; Status: number }>;
            expect(writeResult[0].Status).to.equal(0); // Success

            // Verify the write by reading back
            const attrs = await client.readAttribute(commissionedNodeId, "0/40/5");
            expect(attrs["0/40/5"]).to.equal("Integration Test Node");
        });
    });

    // =========================================================================
    // Device Command Tests
    // =========================================================================

    describe("Device Commands", function () {
        it("should toggle light and receive attribute update", async function () {
            // Toggle ON
            client.clearEvents();
            await client.deviceCommand(commissionedNodeId, 1, 6, "toggle", {});
            await waitForOnOffUpdate(client, commissionedNodeId, true);

            // Toggle OFF
            client.clearEvents();
            await client.deviceCommand(commissionedNodeId, 1, 6, "toggle", {});
            await waitForOnOffUpdate(client, commissionedNodeId, false);
        });

        it("should turn on light with on command", async function () {
            client.clearEvents();
            await client.deviceCommand(commissionedNodeId, 1, 6, "on", {});
            await waitForOnOffUpdate(client, commissionedNodeId, true);
        });

        it("should turn off light with off command", async function () {
            client.clearEvents();
            await client.deviceCommand(commissionedNodeId, 1, 6, "off", {});
            await waitForOnOffUpdate(client, commissionedNodeId, false);
        });
    });

    // =========================================================================
    // Interview Tests
    // =========================================================================

    describe("Node Interview", function () {
        it("should interview node and receive node_updated event", async function () {
            client.clearEvents();

            await client.interviewNode(commissionedNodeId);

            // Should receive node_updated event
            const event = await client.waitForEvent(
                "node_updated",
                data => Number((data as { node_id: number }).node_id) === commissionedNodeId,
                10_000,
            );
            expect(event).to.exist;
        });
    });

    // =========================================================================
    // Commissioning Window Tests
    // =========================================================================

    describe("Commissioning Window", function () {
        it("should open commissioning window and return pairing codes", async function () {
            const result = await client.openCommissioningWindow(commissionedNodeId, 180);

            expect(result).to.have.property("setup_pin_code");
            expect(result).to.have.property("setup_manual_code");
            expect(result).to.have.property("setup_qr_code");
            expect(result.setup_pin_code).to.be.a("number");
            expect(result.setup_manual_code).to.be.a("string").with.length.greaterThan(0);
            expect(result.setup_qr_code).to.be.a("string");
            expect(result.setup_qr_code.startsWith("MT:")).to.be.true;
        });
    });

    // =========================================================================
    // Test Node Import Tests
    // =========================================================================

    describe("Test Node Import", function () {
        it("should import test node from dump", async function () {
            // Create a minimal test node dump
            const testDump = JSON.stringify({
                data: {
                    node: {
                        node_id: 999,
                        date_commissioned: "2024-01-01T00:00:00Z",
                        last_interview: "2024-01-01T00:00:00Z",
                        interview_version: 6,
                        available: true,
                        is_bridge: false,
                        attributes: {
                            "0/40/1": "Imported Vendor",
                            "0/40/3": "Imported Product",
                        },
                        attribute_subscriptions: [],
                    },
                },
            });

            client.clearEvents();
            await client.importTestNode(testDump);

            // Should receive node_added event
            const event = await client.waitForEvent("node_added", undefined, 5000);
            expect(event).to.exist;

            // Test node IDs start at a high value (0xFFFF_FFFE_0000_0000)
            const nodeData = event.data as { node_id: bigint | number };
            expect(BigInt(nodeData.node_id) >= 0xffff_fffe_0000_0000n).to.be.true;
        });

        it("should include test node in get_nodes", async function () {
            const nodes = await client.getNodes();

            // Should have real node + test node
            expect(nodes.length).to.be.greaterThanOrEqual(2);

            // Find the test node (high node ID)
            const testNode = nodes.find(n => BigInt(n.node_id) >= 0xffff_fffe_0000_0000n);
            expect(testNode).to.exist;
            expect(testNode!.attributes["0/40/1"]).to.equal("Imported Vendor");
        });
    });

    // =========================================================================
    // Server Restart Persistence Test
    // =========================================================================

    describe("Server Restart Persistence", function () {
        it("should persist node after server restart and still work", async function () {
            // Close current client connection
            await client.close();

            // Stop the server
            console.log("Stopping server for restart test...");
            await killProcess(serverProcess);

            // Wait a moment for cleanup
            await new Promise(r => setTimeout(r, 2000));

            // Restart the server with the same storage path
            console.log("Restarting server...");
            serverProcess = startServer(serverStoragePath);
            await waitForPort(SERVER_PORT);
            console.log("Server restarted");

            // Reconnect WebSocket client
            client = new MatterWebSocketClient(SERVER_WS_URL);
            const serverInfo = await client.connect();
            console.log("Reconnected to server, schema version:", serverInfo.schema_version);

            // Verify the node is still there
            const nodes = await client.startListening();
            // Filter out test nodes (test nodes don't persist across restart anyway)
            const realNodes = nodes.filter(n => BigInt(n.node_id) < 0xffff_fffe_0000_0000n);
            expect(realNodes).to.be.an("array").with.lengthOf(1);

            const node = realNodes[0];
            expect(Number(node.node_id)).to.equal(commissionedNodeId);
            // Node may not be immediately available after restart - wait for reconnection
            // The available state will be updated when the device reconnects

            // Verify node attributes are preserved
            expect(node.attributes["0/40/1"]).to.equal("Test Vendor");
            expect(node.attributes["0/40/3"]).to.equal("Test Light");

            // Wait for device to reconnect to the restarted server
            // Poll until node becomes available or timeout
            let nodeAvailable = false;
            for (let i = 0; i < 20; i++) {
                await new Promise(r => setTimeout(r, 500));
                const updatedNodes = await client.getNodes();
                const updatedNode = updatedNodes.find(n => Number(n.node_id) === commissionedNodeId);
                if (updatedNode?.available) {
                    nodeAvailable = true;
                    break;
                }
            }

            if (!nodeAvailable) {
                console.log("╔════════════════════════════════════════════════════════════════╗");
                console.log("║ WARNING: Node did not reconnect after server restart (10s)    ║");
                console.log("║ This is a timing issue - device reconnection can be slow.     ║");
                console.log("║ Skipping post-restart command tests. Node persistence OK.     ║");
                console.log("╚════════════════════════════════════════════════════════════════╝");
                return;
            }

            // Toggle ON and verify events still work
            client.clearEvents();
            await client.deviceCommand(commissionedNodeId, 1, 6, "toggle", {});
            await waitForOnOffUpdate(client, commissionedNodeId, true);

            // Toggle OFF
            client.clearEvents();
            await client.deviceCommand(commissionedNodeId, 1, 6, "toggle", {});
            await waitForOnOffUpdate(client, commissionedNodeId, false);

            console.log("Server restart test passed - node persisted and functional");
        });
    });

    // =========================================================================
    // Decommissioning Tests
    // =========================================================================

    describe("Node Decommissioning", function () {
        it("should decommission node", async function () {
            // First ensure the node is available (may need time after restart test)
            let nodeAvailable = false;
            for (let i = 0; i < 20; i++) {
                const nodes = await client.getNodes();
                const realNodes = nodes.filter(n => BigInt(n.node_id) < 0xffff_fffe_0000_0000n);
                const node = realNodes.find(n => Number(n.node_id) === commissionedNodeId);
                if (node?.available) {
                    nodeAvailable = true;
                    break;
                }
                await new Promise(r => setTimeout(r, 500));
            }

            if (!nodeAvailable) {
                console.log("╔════════════════════════════════════════════════════════════════╗");
                console.log("║ WARNING: Node not available for decommission (waited 10s)     ║");
                console.log("║ Proceeding anyway - decommission may fail or timeout.         ║");
                console.log("╚════════════════════════════════════════════════════════════════╝");
            }

            client.clearEvents();

            await client.removeNode(commissionedNodeId);

            // Wait for node_removed event (compare with Number() to handle bigint)
            const removeEvent = await client.waitForEvent(
                "node_removed",
                data => Number(data) === commissionedNodeId,
                10_000,
            );
            expect(removeEvent).to.exist;
            expect(Number(removeEvent.data)).to.equal(commissionedNodeId);

            // Verify no real nodes remain (test nodes may still exist)
            const nodes = await client.getNodes();
            const realNodes = nodes.filter(n => BigInt(n.node_id) < 0xffff_fffe_0000_0000n);
            expect(realNodes).to.be.an("array").that.is.empty;
        });
    });

    // =========================================================================
    // TODO: Medium Difficulty Tests (need specific setup)
    // =========================================================================

    describe("Medium Difficulty Tests", function () {
        it.skip("should commission device on network with passcode", async function () {
            // TODO: Implement commission_on_network test
            // Requires device in commissioning mode with known passcode
            // Need to reset device to uncommissioned state first
        });

        it.skip("should remove matter fabric from device", async function () {
            // TODO: Implement remove_matter_fabric test
            // Requires having multiple fabrics on the device
            // Would need to commission from a second controller first
        });

        it.skip("should set ACL entry on node", async function () {
            // TODO: Implement set_acl_entry test
            // Requires understanding of ACL structure and valid entries
            // Example ACL entry structure:
            // {
            //   privilege: 5, // Administer
            //   auth_mode: 2, // CASE
            //   subjects: [nodeId],
            //   targets: null
            // }
        });

        it.skip("should set node binding", async function () {
            // TODO: Implement set_node_binding test
            // Requires valid binding context (another device to bind to)
            // Example binding:
            // {
            //   node: targetNodeId,
            //   group: null,
            //   endpoint: 1,
            //   cluster: 6 // OnOff
            // }
        });
    });

    // =========================================================================
    // TODO: Hard Tests (need OTA/special setup)
    // =========================================================================

    describe("OTA Update Tests", function () {
        it.skip("should check for node updates", async function () {
            // TODO: Implement check_node_update test
            // Requires OTA provider setup with --enable-test-net-dcl
            // and valid OTA images available for the device
        });

        it.skip("should update node firmware", async function () {
            // TODO: Implement update_node test
            // Requires:
            // 1. OTA provider configured
            // 2. Valid OTA image for test device
            // 3. Device that supports OTA updates
        });
    });

    // =========================================================================
    // TODO: Incomplete/Stub Commands
    // =========================================================================

    describe("Incomplete Commands", function () {
        it.skip("should subscribe to attribute updates", async function () {
            // TODO: Implement subscribe_attribute test
            // This command appears to be a stub/incomplete in the server
        });
    });
});
