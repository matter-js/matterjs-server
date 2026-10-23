/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import WebSocket from "ws";
import {
    CommandTimeoutError,
    ConnectionClosedError,
    DEFAULT_COMMAND_TIMEOUT,
    InvalidServerVersion,
    MatterClient,
    type NodesChangedDetail,
    otaUploadUrl,
    ServerCommandError,
    type ClientLogger,
    consoleLogger,
    type LogDetail,
    WebSocketLike,
} from "../src/index.js";
import { parseBigIntAwareJson, toBigIntAwareJson } from "../src/json-utils.js";
import { MockCommandError, MockMatterServer } from "./MockMatterServer.js";

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
                const dumpString = `{
                    "server_info": {
                        "fabric_id": 2,
                        "compressed_fabric_id": 18258567453835851999,
                    },
                    "node": {
                        "node_id": 115,
                        "attributes": { "0/40/1": "Test Vendor" },
                    },
                }`;
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

            it("should handle negative large numbers", () => {
                const json = '{"value":-18446744069414584320}';
                const result = parseBigIntAwareJson(json) as { value: bigint };
                expect(typeof result.value).to.equal("bigint");
                expect(result.value).to.equal(BigInt("-18446744069414584320"));
            });

            it("should handle negative large numbers in arrays", () => {
                const json = '{"values":[-18446744069414584320, 18446744069414584321]}';
                const result = parseBigIntAwareJson(json) as { values: bigint[] };
                expect(result.values).to.have.length(2);
                expect(result.values[0]).to.equal(BigInt("-18446744069414584320"));
                expect(result.values[1]).to.equal(BigInt("18446744069414584321"));
            });

            it("should NOT convert negative large numbers inside strings", () => {
                const json = '{"dump":"value: -18258567453835851999"}';
                const result = parseBigIntAwareJson(json) as { dump: string };
                expect(typeof result.dump).to.equal("string");
                expect(result.dump).to.equal("value: -18258567453835851999");
            });

            it("should handle floating point numbers", () => {
                const json = '{"value":3.14159}';
                const result = parseBigIntAwareJson(json) as { value: number };
                expect(typeof result.value).to.equal("number");
                expect(result.value).to.equal(3.14159);
            });

            it("should handle negative floating point numbers", () => {
                const json = '{"value":-123.456}';
                const result = parseBigIntAwareJson(json) as { value: number };
                expect(typeof result.value).to.equal("number");
                expect(result.value).to.equal(-123.456);
            });

            it("should handle numbers with exponents", () => {
                const json = '{"value":1.5e10}';
                const result = parseBigIntAwareJson(json) as { value: number };
                expect(typeof result.value).to.equal("number");
                expect(result.value).to.equal(1.5e10);
            });

            it("should handle mixed integers and floats", () => {
                const json = '{"int":18446744069414584320,"float":3.14}';
                const result = parseBigIntAwareJson(json) as { int: bigint; float: number };
                expect(typeof result.int).to.equal("bigint");
                expect(result.int).to.equal(BigInt("18446744069414584320"));
                expect(typeof result.float).to.equal("number");
                expect(result.float).to.equal(3.14);
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

        describe("subscriptions", () => {
            const EMPTY_REPORT = { attributes: {}, events: [] };
            const LIGHT_ON_OFF = { node_id: 1, attribute_paths: ["1/6/0"], min_interval: 0, max_interval: 60 };

            beforeEach(async () => {
                await server.stop();
                server = new MockMatterServer({ serverInfo: { schema_version: 14 } });
                await server.start();
                client = new MatterClient(server.url, createNodeWebSocket);
            });

            it("refuses read, subscribe and unsubscribe on a server below schema 14 without sending them", async () => {
                await server.stop();
                server = new MockMatterServer({ serverInfo: { schema_version: 13 } });
                await server.start();
                client = new MatterClient(server.url, createNodeWebSocket);
                await client.connect();

                for (const call of [
                    () => client.read({ node_id: 1, attribute_paths: ["1/6/0"] }),
                    () => client.subscribe(LIGHT_ON_OFF, recorder().listener),
                    () => client.unsubscribe(1, 7),
                    () => client.enableAutoSubscription(1),
                    () => client.disableAutoSubscription(1),
                ]) {
                    let refusal: unknown;
                    try {
                        await call();
                    } catch (error) {
                        refusal = error;
                    }
                    expect(refusal).to.be.instanceOf(InvalidServerVersion);
                }
                expect(server.getReceivedCommands().map(({ message }) => message.command)).to.deep.equal([]);
            });

            it("sends parseOnboardingPayload on schema 14 and refuses it below", async () => {
                await server.stop();
                server = new MockMatterServer({ serverInfo: { schema_version: 14 } });
                server.onCommand("parse_onboarding_payload", () => ({
                    type: "manual",
                    short_discriminator: 15,
                    setup_pin_code: 20202021,
                }));
                await server.start();
                client = new MatterClient(server.url, createNodeWebSocket);
                await client.connect();

                const parsed = await client.parseOnboardingPayload("34970112332");

                expect(parsed).to.deep.equal({ type: "manual", short_discriminator: 15, setup_pin_code: 20202021 });
                expect(server.getReceivedCommands().map(({ message }) => message.args)).to.deep.equal([
                    { code: "34970112332" },
                ]);

                await server.stop();
                server = new MockMatterServer({ serverInfo: { schema_version: 13 } });
                await server.start();
                client = new MatterClient(server.url, createNodeWebSocket);
                await client.connect();
                let refusal: unknown;
                try {
                    await client.parseOnboardingPayload("34970112332");
                } catch (error) {
                    refusal = error;
                }
                expect(refusal).to.be.instanceOf(InvalidServerVersion);
                expect(server.getReceivedCommands()).to.deep.equal([]);
            });

            it("sends enable and disable auto subscription for the node", async () => {
                const received = new Array<unknown>();
                server.onCommand("enable_auto_subscription", args => {
                    received.push(args);
                    return null;
                });
                server.onCommand("disable_auto_subscription", args => {
                    received.push(args);
                    return null;
                });
                await client.connect();

                await client.enableAutoSubscription(5n);
                await client.disableAutoSubscription(6);

                expect(server.getReceivedCommands().map(({ message }) => message.command)).to.deep.equal([
                    "enable_auto_subscription",
                    "disable_auto_subscription",
                ]);
                expect(received).to.deep.equal([{ node_id: 5 }, { node_id: 6 }]);
            });

            it("sends discovery_timeout_s of commissionWithCode and refuses it below schema 14", async () => {
                const received = new Array<unknown>();
                server.onCommand("commission_with_code", args => {
                    received.push(args);
                    return { node_id: 3 };
                });
                await client.connect();
                await client.commissionWithCode("MT:X", true, { discoveryTimeoutS: 600 });
                await client.commissionWithCode("MT:X", true);

                expect(received).to.deep.equal([
                    { code: "MT:X", network_only: true, discovery_timeout_s: 600 },
                    { code: "MT:X", network_only: true },
                ]);

                await server.stop();
                server = new MockMatterServer({ serverInfo: { schema_version: 13 } });
                await server.start();
                client = new MatterClient(server.url, createNodeWebSocket);
                await client.connect();
                let refusal: unknown;
                try {
                    await client.commissionWithCode("MT:X", true, { discoveryTimeoutS: 600 });
                } catch (error) {
                    refusal = error;
                }
                expect(refusal).to.be.instanceOf(InvalidServerVersion);
                expect(server.getReceivedCommands()).to.deep.equal([]);
            });

            it("sends timed_request_timeout_ms of writeAttribute and refuses it below schema 14", async () => {
                const received = new Array<unknown>();
                server.onCommand("write_attribute", args => {
                    received.push(args);
                    return [];
                });
                await client.connect();
                await client.writeAttribute(1, "*/6/16385", 5, { timedRequestTimeoutMs: 2000 });
                await client.writeAttribute(1, "1/6/16385", 5, 1000);

                expect(received).to.deep.equal([
                    { node_id: 1, attribute_path: "*/6/16385", value: 5, timed_request_timeout_ms: 2000 },
                    { node_id: 1, attribute_path: "1/6/16385", value: 5 },
                ]);

                await server.stop();
                server = new MockMatterServer({ serverInfo: { schema_version: 13 } });
                server.onCommand("write_attribute", () => []);
                await server.start();
                client = new MatterClient(server.url, createNodeWebSocket);
                await client.connect();
                await client.writeAttribute(1, "1/6/16385", 5);
                let refusal: unknown;
                try {
                    await client.writeAttribute(1, "1/6/16385", 5, { timedRequestTimeoutMs: 2000 });
                } catch (error) {
                    refusal = error;
                }
                expect(refusal).to.be.instanceOf(InvalidServerVersion);
                expect(server.getReceivedCommands().map(({ message }) => message.command)).to.deep.equal([
                    "write_attribute",
                ]);
            });

            it("sends batchedDeviceCommands as one request and refuses it below schema 14", async () => {
                const received = new Array<unknown>();
                server.onCommand("batched_device_commands", args => {
                    received.push(args);
                    return [{ status: 0 }, { status: 1 }];
                });
                await client.connect();
                const results = await client.batchedDeviceCommands(
                    1,
                    [
                        { endpointId: 1, clusterId: 6, commandName: "On" },
                        { endpointId: 2, clusterId: 6, commandName: "Toggle", payload: { a: 1 } },
                    ],
                    { timedRequestTimeoutMs: 500, interactionTimeoutMs: 3000 },
                );

                expect(results).to.deep.equal([{ status: 0 }, { status: 1 }]);
                expect(received).to.deep.equal([
                    {
                        node_id: 1,
                        commands: [
                            { endpoint_id: 1, cluster_id: 6, command_name: "On", payload: {} },
                            { endpoint_id: 2, cluster_id: 6, command_name: "Toggle", payload: { a: 1 } },
                        ],
                        timed_request_timeout_ms: 500,
                        interaction_timeout_ms: 3000,
                    },
                ]);

                await server.stop();
                server = new MockMatterServer({ serverInfo: { schema_version: 13 } });
                await server.start();
                client = new MatterClient(server.url, createNodeWebSocket);
                await client.connect();
                let refusal: unknown;
                try {
                    await client.batchedDeviceCommands(1, [{ endpointId: 1, clusterId: 6, commandName: "On" }]);
                } catch (error) {
                    refusal = error;
                }
                expect(refusal).to.be.instanceOf(InvalidServerVersion);
                expect(server.getReceivedCommands()).to.deep.equal([]);
            });

            it("sends the commissionOnNetwork arguments and returns a node", async () => {
                const received = new Array<unknown>();
                server.onCommand("commission_on_network", args => {
                    received.push(args);
                    return { node_id: 3 };
                });
                await client.connect();
                const node = await client.commissionOnNetwork(20202021, {
                    filterType: 2,
                    filter: 3840,
                    ipAddr: "192.168.1.100",
                    discoveryTimeoutS: 600,
                });
                await client.commissionOnNetwork(20202021);

                expect(node.node_id).equals(3);
                expect(received).to.deep.equal([
                    {
                        setup_pin_code: 20202021,
                        filter_type: 2,
                        filter: 3840,
                        ip_addr: "192.168.1.100",
                        discovery_timeout_s: 600,
                    },
                    { setup_pin_code: 20202021 },
                ]);
            });

            it("commissionOnNetwork applies its timeout option", async () => {
                server.onCommand("commission_on_network", () => new Promise(resolve => setTimeout(resolve, 300)));
                await client.connect();

                let timeoutError: unknown;
                try {
                    await client.commissionOnNetwork(20202021, { timeout: 20 });
                } catch (error) {
                    timeoutError = error;
                }
                expect(timeoutError).to.be.instanceOf(CommandTimeoutError);
            });

            it("commissionOnNetwork works below schema 14 unless discoveryTimeoutS is set", async () => {
                await server.stop();
                server = new MockMatterServer({ serverInfo: { schema_version: 13 } });
                server.onCommand("commission_on_network", () => ({ node_id: 3 }));
                await server.start();
                client = new MatterClient(server.url, createNodeWebSocket);
                await client.connect();

                await client.commissionOnNetwork(20202021, { filterType: 1, filter: 15 });
                expect(server.getReceivedCommands()).to.have.length(1);

                let refusal: unknown;
                try {
                    await client.commissionOnNetwork(20202021, { discoveryTimeoutS: 600 });
                } catch (error) {
                    refusal = error;
                }
                expect(refusal).to.be.instanceOf(InvalidServerVersion);
                expect(server.getReceivedCommands()).to.have.length(1);
            });

            it("commissionOnNetwork refuses ipAddr below schema 6", async () => {
                await server.stop();
                server = new MockMatterServer({ serverInfo: { schema_version: 5 } });
                server.onCommand("commission_on_network", () => ({ node_id: 3 }));
                await server.start();
                client = new MatterClient(server.url, createNodeWebSocket);
                await client.connect();

                await client.commissionOnNetwork(20202021);
                let refusal: unknown;
                try {
                    await client.commissionOnNetwork(20202021, { ipAddr: "192.168.1.100" });
                } catch (error) {
                    refusal = error;
                }
                expect(refusal).to.be.instanceOf(InvalidServerVersion);
                expect(server.getReceivedCommands()).to.have.length(1);
            });

            it("commissionOnNetwork refuses filter type 4 below schema 14, but not filter type 3", async () => {
                await server.stop();
                server = new MockMatterServer({ serverInfo: { schema_version: 13 } });
                server.onCommand("commission_on_network", () => ({ node_id: 3 }));
                await server.start();
                client = new MatterClient(server.url, createNodeWebSocket);
                await client.connect();

                await client.commissionOnNetwork(20202021, { filterType: 3, filter: 0xfff1 });
                let refusal: unknown;
                try {
                    await client.commissionOnNetwork(20202021, { filterType: 4, filter: 257 });
                } catch (error) {
                    refusal = error;
                }
                expect(refusal).to.be.instanceOf(InvalidServerVersion);
                expect(server.getReceivedCommands()).to.have.length(1);
            });

            it("plain commissionWithCode passes the gate on a schema 13 server", async () => {
                await server.stop();
                server = new MockMatterServer({ serverInfo: { schema_version: 13 } });
                server.onCommand("commission_with_code", () => ({ node_id: 3 }));
                await server.start();
                client = new MatterClient(server.url, createNodeWebSocket);
                await client.connect();

                const node = await client.commissionWithCode("MT:X", true);
                expect(node.node_id).equals(3);
            });

            it("deviceCommand sends a command without options and without payload", async () => {
                const received = new Array<unknown>();
                server.onCommand("device_command", args => {
                    received.push(args);
                    return null;
                });
                await client.connect();

                await client.deviceCommand(1, 1, 6, "Toggle");

                expect(received).to.deep.equal([
                    {
                        node_id: 1,
                        endpoint_id: 1,
                        cluster_id: 6,
                        command_name: "Toggle",
                        payload: {},
                        response_type: null,
                    },
                ]);
            });

            it("deviceCommand sends the timeouts from an options object and keeps the numeric timeout form", async () => {
                const received = new Array<unknown>();
                server.onCommand("device_command", args => {
                    received.push(args);
                    return null;
                });
                await client.connect();

                await client.deviceCommand(
                    1,
                    1,
                    6,
                    "On",
                    {},
                    {
                        timedRequestTimeoutMs: 5000,
                        interactionTimeoutMs: 30000,
                    },
                );
                await client.deviceCommand(1, 1, 6, "Off", undefined, 1000);

                server.onCommand("device_command", () => new Promise(resolve => setTimeout(resolve, 300)));
                let timeoutError: unknown;
                try {
                    await client.deviceCommand(1, 1, 6, "On", {}, { timeout: 20 });
                } catch (error) {
                    timeoutError = error;
                }
                expect(timeoutError).to.be.instanceOf(CommandTimeoutError);

                let numericTimeoutError: unknown;
                try {
                    await client.deviceCommand(1, 1, 6, "On", {}, 20);
                } catch (error) {
                    numericTimeoutError = error;
                }
                expect(numericTimeoutError).to.be.instanceOf(CommandTimeoutError);

                expect(received).to.deep.equal([
                    {
                        node_id: 1,
                        endpoint_id: 1,
                        cluster_id: 6,
                        command_name: "On",
                        payload: {},
                        response_type: null,
                        timed_request_timeout_ms: 5000,
                        interaction_timeout_ms: 30000,
                    },
                    {
                        node_id: 1,
                        endpoint_id: 1,
                        cluster_id: 6,
                        command_name: "Off",
                        payload: {},
                        response_type: null,
                    },
                ]);
            });

            function recorder() {
                const reports = new Array<number>();
                let ended = 0;
                return {
                    listener: {
                        report: ({ subscription_id }: { subscription_id: number }) => reports.push(subscription_id),
                        ended: () => ended++,
                    },
                    reports,
                    ended: () => ended,
                };
            }

            async function eventsArrived() {
                server.onCommand("get_nodes", () => []);
                await client.getNodes();
            }

            it("passes the reports and the end of a subscription to its listener only", async () => {
                server.onCommand("subscribe", () => {
                    queueMicrotask(() =>
                        server.sendEvent("subscription_report", { node_id: 1, subscription_id: 7, ...EMPTY_REPORT }),
                    );
                    return { subscription_id: 7, ...EMPTY_REPORT };
                });
                await client.connect();
                const own = recorder();

                const result = await client.subscribe(LIGHT_ON_OFF, own.listener);
                server.sendEvent("subscription_report", { node_id: 1, subscription_id: 8, ...EMPTY_REPORT });
                server.sendEvent("subscription_ended", { node_id: 1, subscription_id: 7 });
                server.sendEvent("subscription_report", { node_id: 1, subscription_id: 7, ...EMPTY_REPORT });
                await eventsArrived();

                expect(result.subscription_id).equals(7);
                expect([own.reports, own.ended()]).deep.equals([[7], 1]);
            });

            it("tells apart subscriptions of two nodes that got the same id", async () => {
                server.onCommand("subscribe", () => ({ subscription_id: 7, ...EMPTY_REPORT }));
                await client.connect();
                const first = recorder();
                const second = recorder();

                await client.subscribe(LIGHT_ON_OFF, first.listener);
                await client.subscribe({ ...LIGHT_ON_OFF, node_id: 2n }, second.listener);
                server.sendEvent("subscription_report", { node_id: 2, subscription_id: 7, ...EMPTY_REPORT });
                server.sendEvent("subscription_ended", { node_id: 1, subscription_id: 7 });
                await eventsArrived();
                await client.unsubscribe(2n, 7);

                expect([first.reports, first.ended()]).deep.equals([[], 1]);
                expect([second.reports, second.ended()]).deep.equals([[7], 0]);
                expect(server.getReceivedCommands().at(-1)?.message.args).deep.equals({
                    node_id: 2,
                    subscription_id: 7,
                });
            });

            it("stops calling the listener after unsubscribe", async () => {
                server.onCommand("subscribe", () => ({ subscription_id: 7, ...EMPTY_REPORT }));
                await client.connect();
                const own = recorder();

                await client.subscribe(LIGHT_ON_OFF, own.listener);
                await client.unsubscribe(1, 7);
                server.sendEvent("subscription_report", { node_id: 1, subscription_id: 7, ...EMPTY_REPORT });
                server.sendEvent("subscription_ended", { node_id: 1, subscription_id: 7 });
                await eventsArrived();

                expect([own.reports, own.ended()]).deep.equals([[], 0]);
                expect(server.getReceivedCommands().map(({ message }) => message.command)).includes("unsubscribe");
            });

            it("reads with the request as given", async () => {
                server.onCommand("read", () => EMPTY_REPORT);
                await client.connect();

                const result = await client.read({ node_id: 1, attribute_paths: ["1/6/0"], fabric_filtered: true });

                expect(result).deep.equals(EMPTY_REPORT);
                expect(server.getReceivedCommands().at(-1)?.message.args).deep.equals({
                    node_id: 1,
                    attribute_paths: ["1/6/0"],
                    fabric_filtered: true,
                });
            });

            it("registers no listener when the subscribe fails", async () => {
                server.onCommand("subscribe", () => {
                    throw new MockCommandError("rejected", 8);
                });
                await client.connect();
                const own = recorder();

                const error = await client.subscribe(LIGHT_ON_OFF, own.listener).catch((error: unknown) => error);
                server.sendEvent("subscription_report", { node_id: 1, subscription_id: 7, ...EMPTY_REPORT });
                await eventsArrived();

                expect(error).instanceOf(ServerCommandError);
                expect(own.reports).deep.equals([]);
            });

            it("ends a subscription whose response arrives after the timeout", async () => {
                server.onCommand(
                    "subscribe",
                    () =>
                        new Promise(resolve => setTimeout(() => resolve({ subscription_id: 7, ...EMPTY_REPORT }), 50)),
                );
                await client.connect();
                const own = recorder();

                const error = await client.subscribe(LIGHT_ON_OFF, own.listener, 10).catch((error: unknown) => error);
                const unsubscribed = () =>
                    server.getReceivedCommands().some(({ message }) => message.command === "unsubscribe");
                for (let waited = 0; !unsubscribed() && waited < 2000; waited += 10) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                server.sendEvent("subscription_report", { node_id: 1, subscription_id: 7, ...EMPTY_REPORT });
                await eventsArrived();

                expect(error).instanceOf(CommandTimeoutError);
                expect(own.reports).deep.equals([]);
                expect(server.getReceivedCommands().map(({ message }) => message.args)).deep.includes({
                    node_id: 1,
                    subscription_id: 7,
                });
            });

            it("ends every subscription when the connection is lost", async () => {
                server.onCommand("subscribe", () => ({ subscription_id: 7, ...EMPTY_REPORT }));
                await client.connect();
                const own = recorder();
                const lost = new Promise<void>(resolve => client.addEventListener("connection_lost", resolve));

                await client.subscribe(LIGHT_ON_OFF, own.listener);
                await server.stop();
                await lost;

                expect(own.ended()).equals(1);
            });

            it("gives a listener no report from before a lost connection after reconnecting", async () => {
                server.onCommand("subscribe", () => ({ subscription_id: 7, ...EMPTY_REPORT }));
                await client.connect();
                const own = recorder();
                const lost = new Promise<void>(resolve => client.addEventListener("connection_lost", resolve));
                await client.subscribe(LIGHT_ON_OFF, own.listener);
                const port = server.actualPort;

                await server.stop();
                await lost;
                server = new MockMatterServer({ port, serverInfo: { schema_version: 14 } });
                await server.start();
                await client.connect();
                server.sendEvent("subscription_report", { node_id: 1, subscription_id: 7, ...EMPTY_REPORT });
                await eventsArrived();

                expect([own.reports, own.ended()]).deep.equals([[], 1]);
            });

            it("clears its timeout once the subscription is answered", async () => {
                server.onCommand("subscribe", () => ({ subscription_id: 7, ...EMPTY_REPORT }));
                await client.connect();
                const timeout = 54_321;
                const started = new Array<unknown>();
                const cleared = new Array<unknown>();
                const { setTimeout: realSetTimeout, clearTimeout: realClearTimeout } = globalThis;
                const replace = (name: "setTimeout" | "clearTimeout", value: unknown) =>
                    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
                replace("setTimeout", (handler: () => void, delay?: number) => {
                    const timer = realSetTimeout(handler, delay);
                    if (delay === timeout) {
                        started.push(timer);
                    }
                    return timer;
                });
                replace("clearTimeout", (timer?: ReturnType<typeof realSetTimeout>) => {
                    cleared.push(timer);
                    realClearTimeout(timer);
                });
                try {
                    await client.subscribe(LIGHT_ON_OFF, recorder().listener, timeout);
                } finally {
                    replace("setTimeout", realSetTimeout);
                    replace("clearTimeout", realClearTimeout);
                }

                expect(started.length).equals(1);
                expect(cleared).includes(started[0]);
            });

            for (const timeout of [0, -1]) {
                it(`waits for the answer without a timeout when the timeout is ${timeout}`, async () => {
                    server.onCommand(
                        "subscribe",
                        () =>
                            new Promise(resolve =>
                                setTimeout(() => resolve({ subscription_id: 7, ...EMPTY_REPORT }), 30),
                            ),
                    );
                    await client.connect();

                    const result = await client.subscribe(LIGHT_ON_OFF, recorder().listener, timeout);

                    expect(result.subscription_id).equals(7);
                });
            }

            it("ends the other subscriptions and disconnects when a listener fails on end", async () => {
                let id = 7;
                server.onCommand("subscribe", () => ({ subscription_id: id++, ...EMPTY_REPORT }));
                await client.connect();
                const other = recorder();

                await client.subscribe(LIGHT_ON_OFF, {
                    report: () => {},
                    ended: () => {
                        throw new Error("listener failed");
                    },
                });
                await client.subscribe(LIGHT_ON_OFF, other.listener);
                client.disconnect();

                expect(other.ended()).equals(1);
                expect(client.connection.connected).equals(false);
            });

            it("ends every subscription when the client disconnects", async () => {
                server.onCommand("subscribe", () => ({ subscription_id: 7, ...EMPTY_REPORT }));
                await client.connect();
                const own = recorder();

                await client.subscribe(LIGHT_ON_OFF, own.listener);
                client.disconnect();

                expect(own.ended()).equals(1);
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

            it("round-trips register_icd with args and returns state", async () => {
                let received: Record<string, unknown> | undefined;
                server.onCommand("register_icd", args => {
                    received = args as Record<string, unknown>;
                    return {
                        supported: true,
                        lit_supported: true,
                        registered: true,
                        operating_mode: "LIT",
                        awake: false,
                        available: true,
                        next_expected_checkin: 1234,
                    };
                });
                await client.connect();
                const state = await client.registerIcd(BigInt(5), {
                    allowMultiAdmin: true,
                    ignoredVendors: [4631],
                });
                expect(received?.node_id).to.equal(5);
                expect(received?.allow_multi_admin).to.equal(true);
                expect(received?.ignored_vendors).to.deep.equal([4631]);
                expect(state.registered).to.equal(true);
            });

            it("preserves the device status and commissioning reason on command errors", async () => {
                server.onCommand("register_icd", () => {
                    throw new MockCommandError("failed", 0, { status: 1, cluster_status: 3, reason: "timeout" });
                });
                await client.connect();
                try {
                    await client.registerIcd(BigInt(5));
                    expect.fail("Should have thrown");
                } catch (error) {
                    if (!(error instanceof ServerCommandError)) {
                        throw error;
                    }
                    const { status, clusterStatus, reason } = error;
                    expect({ status, clusterStatus, reason }).to.deep.equal({
                        status: 1,
                        clusterStatus: 3,
                        reason: "timeout",
                    });
                }
            });

            it("preserves error_code on command errors", async () => {
                const details = '{"message":"multi admin","admin_vendor_ids":[4631]}';
                server.onCommand("register_icd", () => {
                    throw new MockCommandError(details, 100);
                });
                await client.connect();
                try {
                    await client.registerIcd(BigInt(5));
                    expect.fail("Should have thrown");
                } catch (error) {
                    expect(error).to.be.instanceOf(ServerCommandError);
                    expect((error as ServerCommandError).errorCode).to.equal(100);
                    expect((error as ServerCommandError).message).to.equal(details);
                    expect((error as ServerCommandError).details).to.deep.equal({
                        message: "multi admin",
                        admin_vendor_ids: [4631],
                    });
                }
            });

            it("round-trips unregister_icd force flag and resync/get state", async () => {
                const state = {
                    supported: true,
                    lit_supported: true,
                    registered: false,
                    operating_mode: "SIT",
                    awake: true,
                    available: true,
                    next_expected_checkin: null,
                };
                let forceSeen: unknown;
                server.onCommand("unregister_icd", args => {
                    forceSeen = (args as Record<string, unknown>).force;
                    return state;
                });
                server.onCommand("resync_icd", () => null);
                server.onCommand("get_icd_state", () => state);
                await client.connect();
                expect((await client.unregisterIcd(7, true)).registered).to.equal(false);
                expect(forceSeen).to.equal(true);
                expect(await client.resyncIcd(7)).to.equal(null);
                expect((await client.getIcdState(7)).operating_mode).to.equal("SIT");
            });
        });

        describe("loglevel", () => {
            it("should round-trip native level names via get_loglevel", async () => {
                server.onCommand("get_loglevel", () => ({
                    console_loglevel: "notice",
                    file_loglevel: "debug",
                }));
                await client.connect();

                const result = await client.getLogLevel();
                expect(result.console_loglevel).to.equal("notice");
                expect(result.file_loglevel).to.equal("debug");
            });

            it("should accept matter.js aliases on set_loglevel while reporting contract names", async () => {
                let received: { console_loglevel?: string; file_loglevel?: string } | undefined;
                server.onCommand("set_loglevel", args => {
                    received = args as { console_loglevel?: string; file_loglevel?: string };
                    return { console_loglevel: "critical", file_loglevel: "warning" };
                });
                await client.connect();

                const result = await client.setLogLevel("fatal", "warn");
                expect(received?.console_loglevel).to.equal("fatal");
                expect(received?.file_loglevel).to.equal("warn");
                expect(result.console_loglevel).to.equal("critical");
                expect(result.file_loglevel).to.equal("warning");
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

            it("hands a thread diagnostics listener only the batch that arrived", async () => {
                server.onCommand("start_listening", () => []);
                await client.startListening();

                const received = new Array<string>();
                client.addThreadDiagnosticsListener(batch => received.push(batch.extPanIdHex));

                server.sendEvent("thread_diagnostics_updated", {
                    extPanIdHex: "1122334455667788",
                    networkName: "A",
                    collectedAt: 1,
                    source: "meshcop",
                    nodes: [],
                });
                server.sendEvent("thread_diagnostics_updated", {
                    extPanIdHex: "8877665544332211",
                    networkName: "B",
                    collectedAt: 2,
                    source: "meshcop",
                    nodes: [],
                });
                await new Promise(resolve => setTimeout(resolve, 100));

                // The accumulating map holds both; a listener that rebuilt its state from it would
                // reinstate the first network on the second event.
                expect(received).to.deep.equal(["1122334455667788", "8877665544332211"]);
                expect(client.threadDiagnostics.size).to.equal(2);
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

            it("hands a camera session ending and a camera eviction to their own listeners", async () => {
                await client.connect();
                const endings = new Array<unknown>();
                const evictions = new Array<unknown>();
                const stopEndings = client.addCameraSessionEndedListener(data => endings.push(data));
                const stopEvictions = client.addCameraStreamEvictedListener(data => evictions.push(data));
                try {
                    server.sendEvent("camera_session_ended", {
                        node_id: 5,
                        endpoint_id: 1,
                        webrtc_session_id: 7,
                    });
                    server.sendEvent("camera_stream_evicted", {
                        node_id: 5,
                        endpoint_id: 1,
                        kind: "snapshot",
                        stream_id: 3,
                    });
                    await new Promise(resolve => setTimeout(resolve, 100));
                } finally {
                    stopEndings();
                    stopEvictions();
                }
                expect(endings).to.deep.equal([{ node_id: 5, endpoint_id: 1, webrtc_session_id: 7 }]);
                expect(evictions).to.deep.equal([{ node_id: 5, endpoint_id: 1, kind: "snapshot", stream_id: 3 }]);

                server.sendEvent("camera_session_ended", {
                    node_id: 5,
                    endpoint_id: 1,
                    webrtc_session_id: 8,
                });
                await new Promise(resolve => setTimeout(resolve, 100));
                expect(endings).to.have.length(1);
            });

            it("keeps the ICE credentials and TURN secret of an incoming offer out of the console", async () => {
                const bigIntSafe = (_key: string, value: unknown) =>
                    typeof value === "bigint" ? value.toString() : value;
                server.onCommand("start_listening", () => []);
                await client.startListening();

                const sdp = [
                    "v=0",
                    "m=video 9 UDP/TLS/RTP/SAVPF 96",
                    "a=ice-ufrag:uNgu3ss4ble-ufrag",
                    "a=ice-pwd:uNgu3ss4ble-ice-password",
                    "a=rtpmap:96 H264/90000",
                ].join("\r\n");
                const logged = new Array<string>();
                const debug = console.debug;
                console.debug = (...args: unknown[]) => {
                    logged.push(args.map(arg => JSON.stringify(arg, bigIntSafe)).join(" "));
                };
                try {
                    server.sendEvent("webrtc_callback", {
                        type: "offer",
                        node_id: 5,
                        session_id: 7,
                        sdp,
                        ice_servers: [
                            { urls: ["turn:turn.example.org:3478"], username: "cam", credential: "uNgu3ss4ble-turn" },
                        ],
                    });
                    await new Promise(resolve => setTimeout(resolve, 100));
                } finally {
                    console.debug = debug;
                }

                const offerLines = logged.filter(line => line.includes("m=video"));
                expect(offerLines.length).to.equal(1);
                for (const line of logged) {
                    expect(line).to.not.contain("uNgu3ss4ble-ufrag");
                    expect(line).to.not.contain("uNgu3ss4ble-ice-password");
                    expect(line).to.not.contain("uNgu3ss4ble-turn");
                }
            });

            it("keeps a snapshot frame out of the console and the rest of the response in it", async () => {
                const frame = `${"Zm9vYmFy".repeat(400)}ZnJhbWUtYnl0ZXMtZG8tbm90LWxvZw==`;
                server.onCommand("camera_snapshot", () => ({
                    data: frame,
                    codec: "JPEG",
                    resolution: { width: 640, height: 480 },
                    degraded: false,
                    stream_id: 3,
                    provenance: "allocated",
                }));
                await client.connect();

                const logged = new Array<string>();
                const debug = console.debug;
                console.debug = (...args: unknown[]) => {
                    logged.push(args.map(arg => JSON.stringify(arg)).join(" "));
                };
                let result;
                try {
                    result = await client.sendCommand("camera_snapshot", 0, { node_id: 5, endpoint_id: 1 });
                } finally {
                    console.debug = debug;
                }

                expect(result.data).to.equal(frame);
                for (const line of logged) {
                    expect(line).to.not.contain("ZnJhbWUtYnl0ZXMtZG8tbm90LWxvZw");
                }
                const frameLine = logged.find(line => line.includes("JPEG"));
                expect(frameLine).to.contain(`[${frame.length} chars omitted]`);
                expect(frameLine).to.contain('"width":640');
                expect(frameLine).to.contain('"height":480');
                expect(frameLine).to.contain('"stream_id":3');
            });

            it("writes its lines to the logger it is given", async () => {
                const lines = new Array<{ level: string; message: string; detail: unknown }>();
                const record =
                    (level: string) =>
                    (message: string, detail?: LogDetail): void => {
                        lines.push({ level, message, detail: detail?.() });
                    };
                const logger: ClientLogger = {
                    debug: record("debug"),
                    info: record("info"),
                    warn: record("warn"),
                    error: record("error"),
                };
                server.onCommand("read_attribute", () => ({ "1/6/0": true }));
                const logged = new MatterClient(server.url, { wsFactory: createNodeWebSocket, logger });
                try {
                    await logged.connect();
                    await logged.sendCommand("read_attribute", 0, { node_id: 5, attribute_path: "1/6/0" });
                    server.sendRaw('{"message_id":"unknown"}');
                    await new Promise(resolve => setTimeout(resolve, 100));
                } finally {
                    logged.disconnect();
                }

                expect(lines.some(line => line.level === "info" && line.message === "WebSocket Connected")).to.be.true;
                const sent = lines.find(line => line.message === "WebSocket send message");
                expect(sent?.level).to.equal("debug");
                expect(sent?.detail).to.deep.include({ command: "read_attribute" });
                const unknown = lines.find(line => line.message === "Received message with unknown format");
                expect(unknown?.level).to.equal("warn");
                expect(unknown?.detail).to.deep.equal({ message_id: "unknown" });
                expect(
                    lines.some(
                        line =>
                            line.message === "WebSocket OnMessage" &&
                            JSON.stringify(line.detail, (_key, value: unknown) =>
                                typeof value === "bigint" ? value.toString() : value,
                            ).includes('"1/6/0":true'),
                    ),
                ).to.be.true;
            });

            it("writes to console by default, with the detail built", () => {
                const written = new Array<unknown[]>();
                const debug = console.debug;
                console.debug = (...args: unknown[]) => {
                    written.push(args);
                };
                try {
                    consoleLogger.debug("plain");
                    consoleLogger.debug("with detail", () => ({ a: 1 }));
                } finally {
                    console.debug = debug;
                }

                expect(written).to.deep.equal([["plain"], ["with detail", { a: 1 }]]);
            });

            // A guard against over-redaction; green on the unmodified baseline too.
            it("logs a short data field of another command in full", async () => {
                server.onCommand("read_attribute", () => ({ data: "1/6/0", node_id: 5 }));
                await client.connect();

                const logged = new Array<string>();
                const debug = console.debug;
                console.debug = (...args: unknown[]) => {
                    logged.push(args.map(arg => JSON.stringify(arg)).join(" "));
                };
                try {
                    await client.sendCommand("read_attribute", 0, {
                        node_id: 5,
                        attribute_path: "1/6/0",
                    });
                } finally {
                    console.debug = debug;
                }

                expect(logged.some(line => line.includes('"data":"1/6/0"'))).to.be.true;
            });

            it("names the node and attribute an attribute_updated event concerns", async () => {
                const nodeId = BigInt("18446744069414584320");
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

                const details = new Array<NodesChangedDetail>();
                client.addEventListener("nodes_changed", detail => {
                    details.push(detail);
                });

                server.sendEvent("attribute_updated", [nodeId, "1/6/0", true]);
                await new Promise(resolve => setTimeout(resolve, 100));

                expect(details).to.deep.equal([{ reason: "attribute_updated", nodeId, attributeKey: "1/6/0" }]);
            });

            it("names the node a node_added event concerns", async () => {
                server.onCommand("start_listening", () => []);
                await client.startListening();

                const nodeId = BigInt("18446744069414584320");
                const details = new Array<NodesChangedDetail>();
                client.addEventListener("nodes_changed", detail => {
                    details.push(detail);
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
                await new Promise(resolve => setTimeout(resolve, 100));

                expect(details).to.deep.equal([{ reason: "node_added", nodeId }]);
            });

            it("names the node a node_updated event concerns", async () => {
                server.onCommand("start_listening", () => []);
                await client.startListening();

                const details = new Array<NodesChangedDetail>();
                client.addEventListener("nodes_changed", detail => {
                    details.push(detail);
                });

                server.sendEvent("node_updated", {
                    node_id: 7,
                    date_commissioned: "2025-01-01T00:00:00.000000",
                    last_interview: "2025-01-01T00:00:00.000000",
                    interview_version: 6,
                    available: true,
                    is_bridge: false,
                    attributes: {},
                });
                await new Promise(resolve => setTimeout(resolve, 100));

                expect(details).to.deep.equal([{ reason: "node_updated", nodeId: 7 }]);
            });

            it("names the node a node_removed event concerns", async () => {
                server.onCommand("start_listening", () => []);
                await client.startListening();

                const details = new Array<NodesChangedDetail>();
                client.addEventListener("nodes_changed", detail => {
                    details.push(detail);
                });

                server.sendEvent("node_removed", 7);
                await new Promise(resolve => setTimeout(resolve, 100));

                expect(details).to.deep.equal([{ reason: "node_removed", nodeId: 7 }]);
            });

            it("passes the detail to a listener that declares no parameter without breaking it", async () => {
                server.onCommand("start_listening", () => []);
                await client.startListening();

                let calls = 0;
                client.addEventListener("nodes_changed", () => {
                    calls++;
                });

                server.sendEvent("node_added", {
                    node_id: 1,
                    date_commissioned: "2025-01-01T00:00:00.000000",
                    last_interview: "2025-01-01T00:00:00.000000",
                    interview_version: 6,
                    available: true,
                    is_bridge: false,
                    attributes: {},
                });
                await new Promise(resolve => setTimeout(resolve, 100));

                expect(calls).to.equal(1);
            });

            it("stops calling a listener after it unsubscribes, also from inside its own call", async () => {
                server.onCommand("start_listening", () => []);
                await client.startListening();

                const calls = new Array<string>();
                const unsubscribeFirst = client.addEventListener("nodes_changed", () => {
                    calls.push("first");
                    unsubscribeFirst();
                });
                client.addEventListener("nodes_changed", () => {
                    calls.push("second");
                });

                server.sendEvent("node_removed", 1);
                await new Promise(resolve => setTimeout(resolve, 100));
                unsubscribeFirst();
                server.sendEvent("node_removed", 2);
                await new Promise(resolve => setTimeout(resolve, 100));

                expect(calls).to.deep.equal(["first", "second", "second"]);
            });

            it("removes only its own registration when the same listener is added twice", async () => {
                server.onCommand("start_listening", () => []);
                await client.startListening();

                let calls = 0;
                const listener = () => {
                    calls++;
                };
                const unsubscribeFirst = client.addEventListener("nodes_changed", listener);
                client.addEventListener("nodes_changed", listener);
                unsubscribeFirst();
                unsubscribeFirst();

                server.sendEvent("node_removed", 1);
                await new Promise(resolve => setTimeout(resolve, 100));

                expect(calls).to.equal(1);
            });

            it("types each event's listener arguments", () => {
                // Compile-time checks only, never called
                function contract(typed: MatterClient) {
                    typed.addEventListener("nodes_changed", detail => {
                        const nodeId: number | bigint = detail.nodeId;
                        if (detail.reason === "attribute_updated") {
                            const attributeKey: string = detail.attributeKey;
                            return [nodeId, attributeKey];
                        }
                        // @ts-expect-error only attribute updates carry an attributeKey
                        return detail.attributeKey;
                    });
                    // @ts-expect-error events other than nodes_changed pass no argument
                    typed.addEventListener("connection_lost", (detail: NodesChangedDetail) => detail);
                    typed.addEventListener("connection_lost", (...args) => {
                        const none: [] = args;
                        return none;
                    });
                    // @ts-expect-error unknown event names are rejected
                    typed.addEventListener("node_changed", () => {});
                }
                expect(contract).to.be.a("function");
            });
        });

        describe("sendWebRtcProviderCommand schema gate", () => {
            async function connectWithSchema(schemaVersion: number): Promise<MatterClient> {
                const gated = new MockMatterServer({ serverInfo: { schema_version: schemaVersion } });
                await gated.start();
                const gatedClient = new MatterClient(gated.url, createNodeWebSocket);
                gated.onCommand("send_webrtc_provider_command", () => null);
                await gatedClient.connect();
                gatedClients.push({ gated, gatedClient });
                return gatedClient;
            }
            async function expectRefused(pending: Promise<unknown>, message: RegExp): Promise<void> {
                let refusal: unknown;
                try {
                    await pending;
                } catch (error) {
                    refusal = error;
                }
                expect(refusal).to.be.instanceOf(InvalidServerVersion);
                expect(refusal).to.have.property("message").that.matches(message);
            }
            const gatedClients = new Array<{ gated: MockMatterServer; gatedClient: MatterClient }>();

            afterEach(async () => {
                for (const { gated, gatedClient } of gatedClients.splice(0)) {
                    if (gatedClient.connection?.connected) gatedClient.disconnect();
                    await gated.stop();
                }
            });

            for (const commandName of ["ProvideAnswer", "ProvideIceCandidates"] as const) {
                it(`refuses ${commandName} against a schema 13 server`, async () => {
                    const old = await connectWithSchema(13);
                    await expectRefused(old.sendWebRtcProviderCommand(1, 1, commandName, {}), /at least api schema 14/);
                });
            }

            it("sends ProvideAnswer to a schema 14 server", async () => {
                const current = await connectWithSchema(14);
                await current.sendWebRtcProviderCommand(1, 1, "ProvideAnswer", {});
            });

            for (const commandName of ["ProvideOffer", "SolicitOffer"] as const) {
                it(`sends ${commandName} to a schema 12 server`, async () => {
                    const older = await connectWithSchema(12);
                    await older.sendWebRtcProviderCommand(1, 1, commandName, {});
                });
            }

            it("refuses ProvideOffer against a schema 11 server", async () => {
                const old = await connectWithSchema(11);
                await expectRefused(old.sendWebRtcProviderCommand(1, 1, "ProvideOffer", {}), /at least api schema 12/);
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

    describe("otaUploadUrl", () => {
        const uploadId = "0123456789abcdef0123456789abcdef";

        it("swaps the /ws mount point for the upload path", () => {
            expect(otaUploadUrl("ws://host:5580/ws", uploadId)).to.equal(`http://host:5580/ota-upload/${uploadId}`);
        });

        it("keeps a sub-path mount point and upgrades wss to https", () => {
            expect(otaUploadUrl("wss://host/matter/ws", uploadId)).to.equal(
                `https://host/matter/ota-upload/${uploadId}`,
            );
        });

        it("does not double the slash when the socket sits at the root", () => {
            expect(otaUploadUrl("ws://host:5580", uploadId)).to.equal(`http://host:5580/ota-upload/${uploadId}`);
            expect(otaUploadUrl("ws://host:5580/", uploadId)).to.equal(`http://host:5580/ota-upload/${uploadId}`);
            expect(otaUploadUrl("wss://host/ws/", uploadId)).to.equal(`https://host/ota-upload/${uploadId}`);
        });

        it("drops a query string carried by the WebSocket URL", () => {
            expect(otaUploadUrl("ws://host:5580/ws?token=abc", uploadId)).to.equal(
                `http://host:5580/ota-upload/${uploadId}`,
            );
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

    describe("command timeouts", () => {
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

        it("should have default timeout of 5 minutes", () => {
            expect(DEFAULT_COMMAND_TIMEOUT).to.equal(5 * 60 * 1000);
            expect(client.commandTimeout).to.equal(DEFAULT_COMMAND_TIMEOUT);
        });

        it("should timeout command and throw CommandTimeoutError", async () => {
            // Handler that never responds (returns promise that never resolves)
            server.onCommand("ping_node", () => new Promise(() => {}));
            await client.connect();

            // Set a short timeout for testing
            client.commandTimeout = 50;

            try {
                await client.pingNode(BigInt(1));
                expect.fail("Should have thrown CommandTimeoutError");
            } catch (error) {
                expect(error).to.be.instanceOf(CommandTimeoutError);
                const timeoutError = error as CommandTimeoutError;
                expect(timeoutError.command).to.equal("ping_node");
                expect(timeoutError.timeoutMs).to.equal(50);
                expect(timeoutError.message).to.include("timed out after 50ms");
            }
        });

        it("should clear timeout on successful response", async () => {
            let handlerCalled = false;
            server.onCommand("get_nodes", () => {
                handlerCalled = true;
                return [];
            });
            await client.connect();

            // Set a short timeout
            client.commandTimeout = 100;

            const result = await client.getNodes();
            expect(handlerCalled).to.be.true;
            expect(result).to.deep.equal([]);
            // If timeout wasn't cleared, the test would fail with unhandled rejection
        });

        it("should clear timeout on error response", async () => {
            server.onCommand("remove_node", () => {
                throw new Error("Node not found");
            });
            await client.connect();

            // Set a short timeout
            client.commandTimeout = 100;

            try {
                await client.removeNode(BigInt(999));
                expect.fail("Should have thrown an error");
            } catch (error) {
                // Should be the server error, not a timeout error
                expect(error).to.not.be.instanceOf(CommandTimeoutError);
                expect((error as Error).message).to.equal("Node not found");
            }
        });

        it("should allow per-command timeout override", async () => {
            server.onCommand("ping_node", () => new Promise(() => {}));
            await client.connect();

            // Default timeout is long
            client.commandTimeout = 10000;

            // But we override with a short timeout
            try {
                await client.pingNode(BigInt(1), 1, 30);
                expect.fail("Should have thrown CommandTimeoutError");
            } catch (error) {
                expect(error).to.be.instanceOf(CommandTimeoutError);
                expect((error as CommandTimeoutError).timeoutMs).to.equal(30);
            }
        });

        it("should disable timeout when set to 0", async function () {
            this.timeout(500); // Mocha test timeout

            server.onCommand("get_nodes", async () => {
                // Delay for 100ms
                await new Promise(resolve => setTimeout(resolve, 100));
                return [];
            });
            await client.connect();

            // Disable timeout
            client.commandTimeout = 0;

            // This should complete even though there's no timeout watching it
            const result = await client.getNodes();
            expect(result).to.deep.equal([]);
        });

        it("should use default timeout when no per-command timeout provided", async () => {
            server.onCommand("ping_node", () => new Promise(() => {}));
            await client.connect();

            // Set default timeout
            client.commandTimeout = 25;

            try {
                await client.pingNode(BigInt(1)); // No per-command timeout
                expect.fail("Should have thrown CommandTimeoutError");
            } catch (error) {
                expect(error).to.be.instanceOf(CommandTimeoutError);
                expect((error as CommandTimeoutError).timeoutMs).to.equal(25);
            }
        });
    });

    describe("connection closed handling", () => {
        let server: MockMatterServer;
        let client: MatterClient;

        beforeEach(async () => {
            server = new MockMatterServer();
            await server.start();
            client = new MatterClient(server.url, createNodeWebSocket);
        });

        afterEach(async () => {
            await server?.stop();
        });

        it("should reject pending commands with ConnectionClosedError on disconnect", async () => {
            // Handler that never responds
            server.onCommand("ping_node", () => new Promise(() => {}));
            await client.connect();

            // Disable timeout to ensure we're testing disconnect behavior
            client.commandTimeout = 0;

            // Start a command but don't await it yet
            const commandPromise = client.pingNode(BigInt(1));

            // Wait a bit then disconnect
            await new Promise(resolve => setTimeout(resolve, 20));
            client.disconnect();

            try {
                await commandPromise;
                expect.fail("Should have thrown ConnectionClosedError");
            } catch (error) {
                expect(error).to.be.instanceOf(ConnectionClosedError);
                expect((error as ConnectionClosedError).message).to.include("Connection closed");
            }
        });

        it("should reject multiple pending commands on disconnect", async () => {
            // Handler that never responds
            server.onCommand("ping_node", () => new Promise(() => {}));
            server.onCommand("get_nodes", () => new Promise(() => {}));
            await client.connect();

            // Disable timeout
            client.commandTimeout = 0;

            // Start multiple commands
            const promise1 = client.pingNode(BigInt(1));
            const promise2 = client.getNodes();

            // Wait a bit then disconnect
            await new Promise(resolve => setTimeout(resolve, 20));
            client.disconnect();

            // Both should reject
            const results = await Promise.allSettled([promise1, promise2]);
            expect(results[0].status).to.equal("rejected");
            expect(results[1].status).to.equal("rejected");
            expect((results[0] as PromiseRejectedResult).reason).to.be.instanceOf(ConnectionClosedError);
            expect((results[1] as PromiseRejectedResult).reason).to.be.instanceOf(ConnectionClosedError);
        });

        it("should reject pending commands when server closes connection", async () => {
            // Handler that never responds
            server.onCommand("ping_node", () => new Promise(() => {}));
            await client.connect();

            // Disable timeout
            client.commandTimeout = 0;

            // Start a command
            const commandPromise = client.pingNode(BigInt(1));

            // Wait a bit then stop the server (simulates connection loss)
            await new Promise(resolve => setTimeout(resolve, 20));
            await server.stop();

            try {
                await commandPromise;
                expect.fail("Should have thrown ConnectionClosedError");
            } catch (error) {
                expect(error).to.be.instanceOf(ConnectionClosedError);
            }
        });
    });
});
