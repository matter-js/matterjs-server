/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import WebSocket from "ws";
import { MatterClient, WebSocketLike } from "../src/index.js";
import { parseBigIntAwareJson, toBigIntAwareJson } from "../src/json-utils.js";
import { MockMatterServer } from "./MockMatterServer.js";

/**
 * Node.js WebSocket factory for MatterClient.
 */
function createNodeWebSocket(url: string): WebSocketLike {
    return new WebSocket(url) as unknown as WebSocketLike;
}

describe("ws-client", () => {
    describe("json-utils", () => {
        describe("parseBigIntAwareJson", () => {
            it("should parse simple JSON with small numbers", () => {
                const json = '{"value":123}';
                const result = parseBigIntAwareJson(json) as { value: number };
                expect(result.value).to.equal(123);
            });

            it("should convert large numbers to BigInt", () => {
                const json = '{"node_id":18446744069414584320}';
                const result = parseBigIntAwareJson(json) as { node_id: bigint };
                expect(typeof result.node_id).to.equal("bigint");
                expect(result.node_id).to.equal(BigInt("18446744069414584320"));
            });

            it("should NOT convert large numbers inside string values", () => {
                const json = '{"dump":"compressed_fabric_id: 18258567453835851999"}';
                const result = parseBigIntAwareJson(json) as { dump: string };
                expect(typeof result.dump).to.equal("string");
                expect(result.dump).to.equal("compressed_fabric_id: 18258567453835851999");
            });

            it("should handle nested JSON strings with large numbers", () => {
                // Simulate import_test_node payload: JSON inside a string field
                const innerJson = '{"compressed_fabric_id": 18258567453835851999}';
                const outerJson = JSON.stringify({ dump: innerJson });
                const result = parseBigIntAwareJson(outerJson) as { dump: string };
                expect(typeof result.dump).to.equal("string");
                expect(result.dump).to.equal(innerJson);
            });

            it("should handle mixed: large numbers in strings AND as actual values", () => {
                const json = '{"dump":"id: 18258567453835851999","actual_id":18446744069414584320}';
                const result = parseBigIntAwareJson(json) as { dump: string; actual_id: bigint };
                expect(typeof result.dump).to.equal("string");
                expect(result.dump).to.equal("id: 18258567453835851999");
                expect(typeof result.actual_id).to.equal("bigint");
                expect(result.actual_id).to.equal(BigInt("18446744069414584320"));
            });

            it("should handle escaped quotes in strings with large numbers", () => {
                const json = '{"msg":"value with \\"quote\\" and number: 18258567453835851999"}';
                const result = parseBigIntAwareJson(json) as { msg: string };
                expect(typeof result.msg).to.equal("string");
                expect(result.msg).to.equal('value with "quote" and number: 18258567453835851999');
            });

            it("should handle arrays with large numbers", () => {
                const json = '{"nodes":[18446744069414584320,18446744069414584321]}';
                const result = parseBigIntAwareJson(json) as { nodes: bigint[] };
                expect(result.nodes).to.have.length(2);
                expect(typeof result.nodes[0]).to.equal("bigint");
                expect(result.nodes[0]).to.equal(BigInt("18446744069414584320"));
            });

            it("should handle large numbers in arrays inside strings", () => {
                const json = '{"dump":"[18258567453835851999, 12345678901234567890]"}';
                const result = parseBigIntAwareJson(json) as { dump: string };
                expect(typeof result.dump).to.equal("string");
                expect(result.dump).to.equal("[18258567453835851999, 12345678901234567890]");
            });

            it("should handle real-world import_test_node message", () => {
                // This simulates the actual problematic message structure
                const innerData = {
                    server_info: {
                        fabric_id: 2,
                        compressed_fabric_id: 18258567453835851999,
                    },
                    node: {
                        node_id: 115,
                        attributes: { "0/40/1": "Test Vendor" },
                    },
                };
                const dumpString = JSON.stringify(innerData);
                const outerMessage = {
                    message_id: "2",
                    command: "import_test_node",
                    args: { dump: dumpString },
                };
                const json = JSON.stringify(outerMessage);

                const result = parseBigIntAwareJson(json) as typeof outerMessage;

                expect(result.message_id).to.equal("2");
                expect(result.command).to.equal("import_test_node");
                expect(typeof result.args.dump).to.equal("string");
                // The dump string should be preserved exactly
                expect(result.args.dump).to.equal(dumpString);
            });
        });

        describe("toBigIntAwareJson", () => {
            it("should serialize small numbers as numbers", () => {
                const result = toBigIntAwareJson({ value: 123 });
                expect(result).to.equal('{"value":123}');
            });

            it("should serialize small BigInt as numbers", () => {
                const result = toBigIntAwareJson({ value: BigInt(123) });
                expect(result).to.equal('{"value":123}');
            });

            it("should serialize large BigInt as raw numbers (not strings)", () => {
                const result = toBigIntAwareJson({ node_id: BigInt("18446744069414584320") });
                expect(result).to.equal('{"node_id":18446744069414584320}');
            });
        });

        describe("round-trip", () => {
            it("should round-trip large BigInt values", () => {
                const original = { node_id: BigInt("18446744069414584320") };
                const json = toBigIntAwareJson(original);
                const parsed = parseBigIntAwareJson(json) as typeof original;
                expect(parsed.node_id).to.equal(original.node_id);
            });
        });
    });

    describe("MatterClient with MockMatterServer", () => {
        let server: MockMatterServer;
        let client: MatterClient;

        beforeEach(async () => {
            server = new MockMatterServer();
            await server.start();
            client = new MatterClient(server.url, createNodeWebSocket);
        });

        afterEach(async () => {
            if (client?.connection?.connected) {
                client.disconnect();
            }
            await server?.stop();
        });

        describe("connection", () => {
            it("should connect and receive server info", async () => {
                await client.connect();
                expect(client.connection.connected).to.be.true;
                expect(client.serverInfo).to.exist;
                expect(client.serverInfo.schema_version).to.equal(11);
            });

            it("should receive BigInt fabric_id from server info", async () => {
                await client.connect();
                expect(typeof client.serverInfo.fabric_id).to.equal("bigint");
                expect(client.serverInfo.fabric_id).to.equal(BigInt("1234567890123456789"));
            });

            it("should receive BigInt compressed_fabric_id from server info", async () => {
                await client.connect();
                expect(typeof client.serverInfo.compressed_fabric_id).to.equal("bigint");
                expect(client.serverInfo.compressed_fabric_id).to.equal(BigInt("18258567453835851999"));
            });
        });

        describe("commands", () => {
            it("should send command and receive response", async () => {
                server.onCommand("get_nodes", () => []);
                await client.connect();

                const nodes = await client.getNodes();
                expect(nodes).to.deep.equal([]);
            });

            it("should send BigInt node_id in commands", async () => {
                const nodeId = BigInt("18446744069414584320");
                server.onCommand("get_node", args => {
                    const typedArgs = args as { node_id: bigint };
                    // Verify the server received a bigint
                    expect(typeof typedArgs.node_id).to.equal("bigint");
                    expect(typedArgs.node_id).to.equal(nodeId);
                    return {
                        node_id: typedArgs.node_id,
                        date_commissioned: "2025-01-01T00:00:00.000000",
                        last_interview: "2025-01-01T00:00:00.000000",
                        interview_version: 6,
                        available: true,
                        is_bridge: false,
                        attributes: {},
                    };
                });
                await client.connect();

                const node = await client.getNode(nodeId);
                expect(node.node_id).to.equal(nodeId);
            });

            it("should receive BigInt values in response", async () => {
                const nodeId = BigInt("18446744069414584320");
                server.onCommand("get_nodes", () => [
                    {
                        node_id: nodeId,
                        date_commissioned: "2025-01-01T00:00:00.000000",
                        last_interview: "2025-01-01T00:00:00.000000",
                        interview_version: 6,
                        available: true,
                        is_bridge: false,
                        attributes: {},
                    },
                ]);
                await client.connect();

                const nodes = await client.getNodes();
                expect(nodes).to.have.length(1);
                expect(typeof nodes[0].node_id).to.equal("bigint");
                expect(nodes[0].node_id).to.equal(nodeId);
            });

            it("should handle import_test_node with large numbers in dump string", async () => {
                let receivedDump: string | undefined;
                server.onCommand("import_test_node", args => {
                    const typedArgs = args as { dump: string };
                    receivedDump = typedArgs.dump;
                    return null;
                });
                await client.connect();

                // The dump contains a large number that should NOT be converted to BigInt
                const dumpWithLargeNumber = '{"compressed_fabric_id": 18258567453835851999}';
                await client.importTestNode(dumpWithLargeNumber);

                // Verify the server received the exact string
                expect(receivedDump).to.equal(dumpWithLargeNumber);
            });

            it("should handle error responses", async () => {
                server.onCommand("remove_node", () => {
                    throw new Error("Node not found");
                });
                await client.connect();

                try {
                    await client.removeNode(BigInt(999));
                    expect.fail("Should have thrown an error");
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    expect((error as Error).message).to.equal("Node not found");
                }
            });
        });

        describe("events", () => {
            it("should receive node_added event with BigInt node_id", async () => {
                server.onCommand("start_listening", () => []);
                await client.startListening();

                const nodeId = BigInt("18446744069414584320");
                let nodesChangedCalled = false;
                client.addEventListener("nodes_changed", () => {
                    nodesChangedCalled = true;
                });

                server.sendEvent("node_added", {
                    node_id: nodeId,
                    date_commissioned: "2025-01-01T00:00:00.000000",
                    last_interview: "2025-01-01T00:00:00.000000",
                    interview_version: 6,
                    available: true,
                    is_bridge: false,
                    attributes: {},
                });

                // Wait for event to be processed
                await new Promise(resolve => setTimeout(resolve, 100));

                expect(nodesChangedCalled).to.be.true;
                const nodeKey = String(nodeId);
                expect(client.nodes[nodeKey]).to.exist;
            });

            it("should receive attribute_updated event with BigInt node_id", async () => {
                const nodeId = BigInt("18446744069414584320");

                // Set up initial node
                server.onCommand("start_listening", () => [
                    {
                        node_id: nodeId,
                        date_commissioned: "2025-01-01T00:00:00.000000",
                        last_interview: "2025-01-01T00:00:00.000000",
                        interview_version: 6,
                        available: true,
                        is_bridge: false,
                        attributes: { "1/6/0": false },
                    },
                ]);

                await client.startListening();

                let nodesChangedCalled = false;
                client.addEventListener("nodes_changed", () => {
                    nodesChangedCalled = true;
                });

                // Send attribute update event
                server.sendEvent("attribute_updated", [nodeId, "1/6/0", true]);

                // Wait for event to be processed
                await new Promise(resolve => setTimeout(resolve, 100));

                expect(nodesChangedCalled).to.be.true;
                const nodeKey = String(nodeId);
                expect(client.nodes[nodeKey]?.attributes["1/6/0"]).to.equal(true);
            });
        });

        describe("raw message handling", () => {
            it("should correctly parse messages with large numbers only as JSON values", async () => {
                await client.connect();
                server.clearReceivedCommands();

                // Send a command that includes a string with a large number
                server.onCommand("write_attribute", args => {
                    return args;
                });

                const testValue = "Device ID: 18258567453835851999";
                await client.writeAttribute(BigInt(1), "0/40/5", testValue);

                const commands = server.getReceivedCommands();
                expect(commands).to.have.length(1);

                // Parse the raw message to verify it was sent correctly
                const parsed = parseBigIntAwareJson(commands[0].raw) as {
                    args: { value: string };
                };
                expect(parsed.args.value).to.equal(testValue);
            });
        });
    });

    describe("Connection class", () => {
        let server: MockMatterServer;

        beforeEach(async () => {
            server = new MockMatterServer();
            await server.start();
        });

        afterEach(async () => {
            await server?.stop();
        });

        it("should throw if connecting when already connected", async () => {
            const client = new MatterClient(server.url, createNodeWebSocket);
            await client.connect();

            try {
                await client.connect();
                // Should not reach here - the client guards against double connect
            } catch {
                // Expected - connection already exists
            } finally {
                client.disconnect();
            }
        });

        it("should handle disconnect gracefully", async () => {
            const client = new MatterClient(server.url, createNodeWebSocket);
            await client.connect();
            expect(client.connection.connected).to.be.true;

            client.disconnect();
            expect(client.connection.connected).to.be.false;
        });
    });
});
