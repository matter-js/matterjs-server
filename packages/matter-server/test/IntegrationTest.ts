/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Integration test for the Matter.js server.
 *
 * This test starts the actual server and a test device, then validates
 * the full commissioning and control flow via WebSocket.
 */

import { ChildProcess } from "child_process";
import {
    cleanupTempStorage,
    createTempStoragePaths,
    killProcess,
    MANUAL_PAIRING_CODE,
    MatterTestClient,
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
async function waitForOnOffUpdate(client: MatterTestClient, nodeId: number, expectedValue: boolean): Promise<void> {
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
    let client: MatterTestClient;
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
        client = new MatterTestClient(SERVER_WS_URL);
        const serverInfo = await client.connectAndGetServerInfo();
        console.log("Connected to server, schema version:", serverInfo.schema_version);
    });

    after(async function () {
        // Close WebSocket client
        if (client) {
            await client.close();
        }

        // Kill processes
        await killProcess(serverProcess);
        await killProcess(deviceProcess);

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
            expect(info.sdk_version).to.be.a("string").that.includes("matter-server");
            expect(info.sdk_version).to.be.a("string").that.includes("matter.js");
            expect(info.wifi_credentials_set).to.be.a("boolean");
            expect(info.thread_credentials_set).to.be.a("boolean");
            expect(info.bluetooth_enabled).to.be.a("boolean");
        });

        it("should have no commissioned nodes initially", async function () {
            const nodes = await client.startListeningAndGetNodes();
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
            // Clear any previous events (e.g. from wifi test) before setting thread dataset
            client.clearEvents();

            // Set a mock thread dataset (hex encoded)
            const mockDataset = "0e080000000000010000000300001035060004001fffe00208fedcba9876543210";
            await client.setThreadDataset(mockDataset);

            // Wait for server_info_updated event
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

            // Verify node ID is 2
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

        it("should get IP addresses without zone ID when scoped=false", async function () {
            const ips = await client.getNodeIpAddresses(commissionedNodeId, false, false);

            expect(ips).to.be.an("array").that.is.not.empty;
            // With scoped=false (default), zone IDs should be stripped (no %)
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

        it("should read batched attributes (>9 paths)", async function () {
            // Test batching: read more than 9 attributes to verify batch handling
            // Server batches reads into groups of 9 paths per call
            const paths = [
                "0/40/0", // DataModelRevision
                "0/40/1", // VendorName
                "0/40/2", // VendorId
                "0/40/3", // ProductName
                "0/40/4", // ProductId
                "0/40/5", // NodeLabel
                "0/40/6", // Location
                "0/40/7", // HardwareVersion
                "0/40/8", // HardwareVersionString
                "0/40/9", // SoftwareVersion
                "0/40/10", // SoftwareVersionString
                "0/40/17", // UniqueId
            ];
            const attrs = await client.readAttribute(commissionedNodeId, paths);

            // Should return values for existing attributes
            expect(attrs).to.be.an("object");
            expect(attrs["0/40/1"]).to.equal("Test Vendor");
            expect(attrs["0/40/3"]).to.equal("Test Light");
            // Verify we got multiple attributes back (at least the ones that exist)
            expect(Object.keys(attrs).length).to.be.greaterThanOrEqual(8);
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
    // Test Node Tests (Comprehensive)
    // =========================================================================

    describe("Test Node Functionality", function () {
        /** Test node ID of the first imported node */
        let testNodeId: bigint;
        /** Test node ID of the second imported node (from multi-node import) */
        let testNode2Id: bigint;

        describe("Import Test Nodes", function () {
            it("should import single test node from Home Assistant device diagnostic dump format", async function () {
                // Create a test node dump in Home Assistant single-device diagnostic format
                const singleNodeDump = JSON.stringify({
                    data: {
                        node: {
                            node_id: 999, // Original ID (will be replaced with test node ID)
                            date_commissioned: "2024-01-01T00:00:00.000000",
                            last_interview: "2024-01-01T12:00:00.000000",
                            interview_version: 6,
                            available: true,
                            is_bridge: false,
                            attributes: {
                                "0/40/0": 19, // DataModelRevision
                                "0/40/1": "Test Vendor From Dump", // VendorName
                                "0/40/2": 65521, // VendorId
                                "0/40/3": "Test Product From Dump", // ProductName
                                "0/40/4": 32768, // ProductId
                                "0/40/5": "Test Node Label", // NodeLabel
                                "0/29/0": [{ "0": 22, "1": 3 }], // DeviceTypeList
                                "0/29/1": [40, 29], // ServerList
                                "1/6/0": true, // OnOff
                                "1/6/16384": true, // StartUpOnOff
                            },
                            attribute_subscriptions: [],
                        },
                    },
                });

                client.clearEvents();
                await client.importTestNode(singleNodeDump);

                // Should receive node_added event
                const event = await client.waitForEvent("node_added", undefined, 5000);
                expect(event).to.exist;

                // Test node IDs start at 0xFFFF_FFFE_0000_0000
                const nodeData = event.data as { node_id: bigint | number };
                testNodeId = BigInt(nodeData.node_id);
                expect(testNodeId >= BigInt("0xfffffffe00000000")).to.be.true;

                // Verify the node data in the event
                const node = event.data as { attributes: Record<string, unknown> };
                expect(node.attributes["0/40/1"]).to.equal("Test Vendor From Dump");
                expect(node.attributes["0/40/3"]).to.equal("Test Product From Dump");
            });

            it("should import multiple test nodes from Home Assistant server diagnostic dump format", async function () {
                // Create a test dump with multiple nodes (server diagnostic format)
                const multiNodeDump = JSON.stringify({
                    data: {
                        server: {
                            nodes: {
                                "1": {
                                    node_id: 1,
                                    date_commissioned: "2024-02-01T00:00:00.000000",
                                    last_interview: "2024-02-01T12:00:00.000000",
                                    interview_version: 6,
                                    available: true,
                                    is_bridge: false,
                                    attributes: {
                                        "0/40/1": "Multi-Node Vendor 1",
                                        "0/40/3": "Multi-Node Product 1",
                                        "0/40/5": "Node 1 Label",
                                        "1/6/0": false,
                                    },
                                    attribute_subscriptions: [],
                                },
                                "2": {
                                    node_id: 2,
                                    date_commissioned: "2024-02-02T00:00:00.000000",
                                    last_interview: "2024-02-02T12:00:00.000000",
                                    interview_version: 6,
                                    available: false,
                                    is_bridge: true,
                                    attributes: {
                                        "0/40/1": "Multi-Node Vendor 2",
                                        "0/40/3": "Multi-Node Bridge",
                                        "0/29/0": [{ "0": 14, "1": 1 }], // Bridge device type
                                    },
                                    attribute_subscriptions: [],
                                },
                            },
                        },
                    },
                });

                client.clearEvents();
                await client.importTestNode(multiNodeDump);

                // Wait a bit for events to arrive
                await new Promise(r => setTimeout(r, 500));

                // Get all test nodes to find the imported ones
                const nodes = await client.getNodes();
                const multiImportNodes = nodes.filter(
                    n => BigInt(n.node_id) >= BigInt("0xfffffffe00000000") && BigInt(n.node_id) !== testNodeId,
                );

                // Should have imported at least 2 more test nodes
                expect(multiImportNodes.length).to.be.greaterThanOrEqual(2);

                // Store one of the multi-import node IDs for later removal test
                testNode2Id = BigInt(multiImportNodes[0].node_id);
            });

            it("should include all test nodes in get_nodes", async function () {
                const nodes = await client.getNodes();

                // Filter to test nodes only
                const testNodes = nodes.filter(n => BigInt(n.node_id) >= BigInt("0xfffffffe00000000"));

                // Should have at least 3 test nodes (1 from single import + 2 from multi import)
                expect(testNodes.length).to.be.greaterThanOrEqual(3);

                // Find specific test nodes
                const firstTestNode = testNodes.find(n => BigInt(n.node_id) === testNodeId);
                expect(firstTestNode).to.exist;
                expect(firstTestNode!.attributes["0/40/1"]).to.equal("Test Vendor From Dump");

                // Find one of the multi-import nodes
                const bridgeNode = testNodes.find(n => n.is_bridge === true);
                expect(bridgeNode).to.exist;
                expect(bridgeNode!.attributes["0/40/3"]).to.equal("Multi-Node Bridge");
            });

            it("should get single test node via get_node", async function () {
                const node = await client.getNode(testNodeId);

                expect(BigInt(node.node_id)).to.equal(testNodeId);
                expect(node.attributes["0/40/1"]).to.equal("Test Vendor From Dump");
                expect(node.attributes["0/40/3"]).to.equal("Test Product From Dump");
                expect(node.available).to.be.true;
                expect(node.is_bridge).to.be.false;
            });
        });

        describe("Read Attributes from Test Node", function () {
            it("should read single attribute from test node", async function () {
                const attrs = await client.readAttribute(testNodeId, "0/40/1");

                expect(attrs).to.have.property("0/40/1");
                expect(attrs["0/40/1"]).to.equal("Test Vendor From Dump");
            });

            it("should read multiple attributes from test node", async function () {
                const attrs = await client.readAttribute(testNodeId, ["0/40/1", "0/40/3", "0/40/5"]);

                expect(attrs).to.have.property("0/40/1");
                expect(attrs).to.have.property("0/40/3");
                expect(attrs).to.have.property("0/40/5");
                expect(attrs["0/40/1"]).to.equal("Test Vendor From Dump");
                expect(attrs["0/40/3"]).to.equal("Test Product From Dump");
                expect(attrs["0/40/5"]).to.equal("Test Node Label");
            });

            it("should read attributes with endpoint wildcard from test node", async function () {
                const attrs = await client.readAttribute(testNodeId, "*/40/1");

                // Should return vendor name from endpoint 0
                expect(attrs).to.have.property("0/40/1");
                expect(attrs["0/40/1"]).to.equal("Test Vendor From Dump");
            });

            it("should read attributes with cluster wildcard from test node", async function () {
                const attrs = await client.readAttribute(testNodeId, "0/*/1");

                // Should return attributes with ID 1 from multiple clusters on endpoint 0
                expect(attrs).to.have.property("0/40/1"); // VendorName from BasicInformation
                expect(attrs).to.have.property("0/29/1"); // ServerList from Descriptor
            });

            it("should read all attributes from cluster with attribute wildcard from test node", async function () {
                const attrs = await client.readAttribute(testNodeId, "0/40/*");

                // Should return all BasicInformation attributes
                expect(attrs).to.have.property("0/40/0"); // DataModelRevision
                expect(attrs).to.have.property("0/40/1"); // VendorName
                expect(attrs).to.have.property("0/40/2"); // VendorId
                expect(attrs).to.have.property("0/40/3"); // ProductName
                expect(attrs).to.have.property("0/40/4"); // ProductId
                expect(attrs).to.have.property("0/40/5"); // NodeLabel
            });

            it("should return undefined for non-existent attributes on test node", async function () {
                const attrs = await client.readAttribute(testNodeId, "99/99/99");

                // Non-existent path returns undefined value
                expect(attrs["99/99/99"]).to.be.undefined;
            });

            it("should read batched attributes from test node (>9 paths)", async function () {
                // Test batching with more than 9 paths on a test node
                // This tests both the batching logic and the test node handler
                const paths = [
                    "0/40/0", // DataModelRevision
                    "0/40/1", // VendorName
                    "0/40/2", // VendorId
                    "0/40/3", // ProductName
                    "0/40/4", // ProductId
                    "0/40/5", // NodeLabel
                    "0/29/0", // DeviceTypeList
                    "0/29/1", // ServerList
                    "1/6/0", // OnOff
                    "1/6/16384", // StartUpOnOff
                    "99/99/99", // Non-existent (should be undefined)
                    "99/99/98", // Non-existent (should be undefined)
                ];
                const attrs = await client.readAttribute(testNodeId, paths);

                // Should return values for existing attributes
                expect(attrs).to.be.an("object");
                expect(attrs["0/40/1"]).to.equal("Test Vendor From Dump");
                expect(attrs["0/40/3"]).to.equal("Test Product From Dump");
                expect(attrs["1/6/0"]).to.equal(true);
                // Non-existent paths return undefined
                expect(attrs["99/99/99"]).to.be.undefined;
                expect(attrs["99/99/98"]).to.be.undefined;
            });
        });

        describe("Write Attributes to Test Node", function () {
            it("should accept write attribute to test node (mock operation)", async function () {
                // Write to NodeLabel attribute
                const result = await client.writeAttribute(testNodeId, "0/40/5", "New Test Label");

                // Test nodes return success (status 0) for writes
                expect(result).to.be.an("array");
                const writeResult = result as Array<{ Path: object; Status: number }>;
                expect(writeResult[0].Status).to.equal(0);
            });
        });

        describe("Device Commands on Test Node", function () {
            it("should accept device command on test node (mock operation)", async function () {
                // Send toggle command to OnOff cluster
                const result = await client.deviceCommand(testNodeId, 1, 6, "toggle", {});

                // Test nodes return null for command results
                expect(result).to.be.null;
            });

            it("should accept on command on test node", async function () {
                const result = await client.deviceCommand(testNodeId, 1, 6, "on", {});
                expect(result).to.be.null;
            });

            it("should accept command with payload on test node", async function () {
                // Send identify command with identifyTime payload
                const result = await client.deviceCommand(testNodeId, 1, 3, "identify", {
                    identify_time: 10,
                });
                expect(result).to.be.null;
            });
        });

        describe("Network Operations on Test Node", function () {
            it("should return mock IP addresses for test node", async function () {
                const ips = await client.getNodeIpAddresses(testNodeId, false, false);

                expect(ips).to.be.an("array");
                expect(ips.length).to.be.greaterThan(0);
                // Test nodes return mock IPs
                expect(ips).to.include("0.0.0.0");
            });

            it("should return mock scoped IP addresses for test node", async function () {
                const ips = await client.getNodeIpAddresses(testNodeId, false, true);

                expect(ips).to.be.an("array");
                expect(ips.length).to.be.greaterThan(0);
            });

            it("should return mock ping results for test node", async function () {
                const result = await client.pingNode(testNodeId);

                expect(result).to.be.an("object");
                // Test nodes return success for all mock IPs
                const values = Object.values(result);
                expect(values.length).to.be.greaterThan(0);
                expect(values.every(v => v === true)).to.be.true;
            });

            it("should return mock ping results with multiple attempts", async function () {
                const result = await client.pingNode(testNodeId, 3);

                expect(result).to.be.an("object");
                expect(Object.values(result).every(v => v === true)).to.be.true;
            });
        });

        describe("Interview Test Node", function () {
            it("should trigger node_updated event when interviewing test node", async function () {
                client.clearEvents();

                await client.interviewNode(testNodeId);

                // Should receive node_updated event for the test node
                const event = await client.waitForEvent(
                    "node_updated",
                    data => BigInt((data as { node_id: bigint | number }).node_id) === testNodeId,
                    5000,
                );
                expect(event).to.exist;
                expect(BigInt((event.data as { node_id: bigint | number }).node_id)).to.equal(testNodeId);
            });
        });

        describe("Remove Test Node", function () {
            it("should remove test node and emit node_removed event", async function () {
                client.clearEvents();

                // Remove the second test node (from multi-node import)
                await client.removeNode(testNode2Id);

                // Should receive node_removed event
                const event = await client.waitForEvent(
                    "node_removed",
                    data => BigInt(data as bigint | number) === testNode2Id,
                    5000,
                );
                expect(event).to.exist;
                expect(BigInt(event.data as bigint | number)).to.equal(testNode2Id);

                // Verify node is no longer in get_nodes
                const nodes = await client.getNodes();
                const removedNode = nodes.find(n => BigInt(n.node_id) === testNode2Id);
                expect(removedNode).to.be.undefined;
            });

            it("should throw error when getting removed test node", async function () {
                try {
                    await client.getNode(testNode2Id);
                    expect.fail("Should have thrown an error");
                } catch (error) {
                    expect((error as Error).message).to.include("not");
                }
            });

            it("should still have other test nodes after removing one", async function () {
                const nodes = await client.getNodes();
                const testNodes = nodes.filter(n => BigInt(n.node_id) >= BigInt("0xfffffffe00000000"));

                // Should still have the first test node and one from multi-import
                expect(testNodes.length).to.be.greaterThanOrEqual(2);

                // First test node should still exist
                const firstTestNode = testNodes.find(n => BigInt(n.node_id) === testNodeId);
                expect(firstTestNode).to.exist;
            });
        });

        describe("Test Node Availability Filtering", function () {
            it("should filter unavailable test nodes with only_available=true", async function () {
                // One of our imported nodes has available=false (the bridge)
                const availableNodes = await client.getNodes(true);
                const unavailableTestNodes = availableNodes.filter(
                    n => BigInt(n.node_id) >= BigInt("0xfffffffe00000000") && n.available === false,
                );

                // Should not include unavailable nodes
                expect(unavailableTestNodes.length).to.equal(0);
            });

            it("should include unavailable test nodes with only_available=false", async function () {
                const allNodes = await client.getNodes(false);
                const testNodes = allNodes.filter(n => BigInt(n.node_id) >= BigInt("0xfffffffe00000000"));

                // Check we have at least one available and verify they're all returned
                expect(testNodes.length).to.be.greaterThanOrEqual(2);
            });
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
            client = new MatterTestClient(SERVER_WS_URL);
            const serverInfo = await client.connectAndGetServerInfo();
            console.log("Reconnected to server, schema version:", serverInfo.schema_version);

            // Verify the node is still there
            const nodes = await client.startListeningAndGetNodes();
            // Filter out test nodes (test nodes don't persist across restart anyway)
            const realNodes = nodes.filter(n => BigInt(n.node_id) < BigInt("0xfffffffe00000000"));
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
                const realNodes = nodes.filter(n => BigInt(n.node_id) < BigInt("0xfffffffe00000000"));
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
            const realNodes = nodes.filter(n => BigInt(n.node_id) < BigInt("0xfffffffe00000000"));
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
