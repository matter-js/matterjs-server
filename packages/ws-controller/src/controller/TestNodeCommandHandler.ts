/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger, NodeId, Observable } from "@matter/main";
import { parseBigIntAwareJson, splitAttributePath } from "../server/Converters.js";
import {
    AttributeResponseStatus,
    AttributesData,
    InvokeRequest,
    MatterNodeData,
    NodeCommandHandler,
    ReadAttributeRequest,
    ReadAttributeResponse,
    WriteAttributeRequest,
} from "../types/CommandHandler.js";
import { MatterNode, TEST_NODE_START } from "../types/WebSocketMessageTypes.js";

const logger = Logger.get("TestNodeCommandHandler");

/**
 * Command handler for test nodes (imported diagnostic dumps).
 * Test nodes are stored in memory and provide mock responses for commands.
 */
export class TestNodeCommandHandler implements NodeCommandHandler {
    #testNodes = new Map<bigint, MatterNode>();

    /** Observable for node added events */
    readonly nodeAdded = new Observable<[nodeId: NodeId, node: MatterNode]>();

    /** Observable for node removed events */
    readonly nodeRemoved = new Observable<[nodeId: NodeId]>();

    /**
     * Check if a node ID is in the test node range (>= TEST_NODE_START).
     */
    static isTestNodeId(nodeId: number | bigint): boolean {
        const bigId = typeof nodeId === "bigint" ? nodeId : BigInt(nodeId);
        return bigId >= TEST_NODE_START;
    }

    /**
     * Check if this handler manages the given node ID.
     */
    hasNode(nodeId: NodeId): boolean {
        return this.#testNodes.has(BigInt(nodeId));
    }

    /**
     * Get all test node IDs.
     */
    getNodeIds(): NodeId[] {
        return Array.from(this.#testNodes.keys()).map(id => NodeId(id));
    }

    /**
     * Get all test nodes.
     */
    getNodes(): MatterNode[] {
        return Array.from(this.#testNodes.values());
    }

    /**
     * Get a test node by ID.
     */
    getNode(nodeId: NodeId): MatterNode | undefined {
        return this.#testNodes.get(BigInt(nodeId));
    }

    /**
     * Get full node details in WebSocket API format.
     */
    async getNodeDetails(nodeId: NodeId): Promise<MatterNodeData> {
        const testNode = this.#testNodes.get(BigInt(nodeId));
        if (testNode === undefined) {
            throw new Error(`Test node ${nodeId} not found`);
        }
        return testNode;
    }

    /**
     * Read multiple attributes from a test node by path strings.
     * Handles wildcards in paths.
     */
    async handleReadAttributes(
        nodeId: NodeId,
        attributePaths: string[],
        _fabricFiltered?: boolean,
    ): Promise<AttributesData> {
        const testNode = this.#testNodes.get(BigInt(nodeId));
        if (testNode === undefined) {
            throw new Error(`Test node ${nodeId} not found`);
        }

        const result: AttributesData = {};
        for (const path of attributePaths) {
            const { endpointId, clusterId, attributeId } = splitAttributePath(path);

            // Handle wildcards by matching all attributes
            if (path.includes("*")) {
                for (const [attrPath, value] of Object.entries(testNode.attributes)) {
                    const parts = attrPath.split("/").map(Number);
                    if (
                        (endpointId === undefined || parts[0] === endpointId) &&
                        (clusterId === undefined || parts[1] === clusterId) &&
                        (attributeId === undefined || parts[2] === attributeId)
                    ) {
                        result[attrPath] = value;
                    }
                }
            } else {
                result[path] = testNode.attributes[path];
            }
        }
        return result;
    }

    /**
     * Import test nodes from a diagnostic dump.
     * @param dump JSON string containing the diagnostic dump
     * @returns Array of imported node IDs
     */
    importTestNodes(dump: string): NodeId[] {
        // Parse the JSON dump (handles large node IDs as BigInt)
        const dumpData = parseBigIntAwareJson(dump) as any;

        // Extract nodes from dump - can be single node or multiple nodes
        // Format from Home Assistant diagnostics:
        // - Single node: dump_data.data.node
        // - Multiple nodes (server dump): dump_data.data.server.nodes
        let dumpNodes: Array<MatterNode>;

        if (dumpData?.data?.node) {
            dumpNodes = [dumpData.data.node];
        } else if (dumpData?.data?.server?.nodes) {
            dumpNodes = Object.values(dumpData.data.server.nodes);
        } else if (dumpData?.data?.nodes) {
            // Alternative format: direct nodes array
            dumpNodes = Object.values(dumpData.data.nodes);
        } else {
            throw new Error("Invalid dump format: cannot find node data");
        }

        // Find the next available test node ID
        let nextTestNodeId: bigint = TEST_NODE_START;
        for (const existingId of this.#testNodes.keys()) {
            if (existingId >= nextTestNodeId) {
                nextTestNodeId = existingId + 1n;
            }
        }

        const importedNodeIds: NodeId[] = [];

        // Process each node from the dump
        for (const nodeDict of dumpNodes) {
            const testNodeId: bigint = nextTestNodeId++;
            const nodeId = NodeId(testNodeId);

            // Create MatterNode with test node ID, keeping original attributes as-is
            const testNode: MatterNode = {
                node_id: testNodeId,
                date_commissioned: nodeDict.date_commissioned,
                last_interview: nodeDict.last_interview,
                interview_version: nodeDict.interview_version,
                available: nodeDict.available,
                is_bridge: nodeDict.is_bridge,
                attributes: nodeDict.attributes,
                attribute_subscriptions: [],
            };

            // Store the test node
            this.#testNodes.set(testNodeId, testNode);
            importedNodeIds.push(nodeId);

            logger.info(`Imported test node ${testNodeId} with ${Object.keys(testNode.attributes).length} attributes`);

            // Emit node_added event
            this.nodeAdded.emit(nodeId, testNode);
        }

        return importedNodeIds;
    }

    /**
     * Read attributes from a test node.
     * Returns values from the stored attributes map.
     */
    async handleReadAttribute(data: ReadAttributeRequest): Promise<ReadAttributeResponse> {
        const { nodeId, endpointId, clusterId, attributeId } = data;
        const testNode = this.#testNodes.get(BigInt(nodeId));

        if (testNode === undefined) {
            throw new Error(`Test node ${nodeId} not found`);
        }

        const values: ReadAttributeResponse["values"] = [];

        // Build the path pattern for matching
        const hasWildcards = endpointId === undefined || clusterId === undefined || attributeId === undefined;

        if (hasWildcards) {
            // Match against all stored attributes
            for (const [attrPath, value] of Object.entries(testNode.attributes)) {
                const parts = attrPath.split("/").map(Number);
                if (
                    (endpointId === undefined || parts[0] === endpointId) &&
                    (clusterId === undefined || parts[1] === clusterId) &&
                    (attributeId === undefined || parts[2] === attributeId)
                ) {
                    values.push({
                        endpointId: parts[0],
                        clusterId: parts[1],
                        attributeId: parts[2],
                        dataVersion: 0,
                        value,
                    });
                }
            }
        } else {
            // Direct path lookup
            const path = `${endpointId}/${clusterId}/${attributeId}`;
            const value = testNode.attributes[path];
            if (value !== undefined) {
                values.push({
                    endpointId,
                    clusterId,
                    attributeId,
                    dataVersion: 0,
                    value,
                });
            }
        }

        logger.debug(`read_attribute for test node ${nodeId}: ${values.length} values`);
        return { values };
    }

    /**
     * Write an attribute to a test node.
     * Logs the write and returns success (no actual write occurs).
     */
    async handleWriteAttribute(data: WriteAttributeRequest): Promise<AttributeResponseStatus> {
        const { nodeId, endpointId, clusterId, attributeId, value } = data;

        logger.debug(
            `write_attribute for test node ${nodeId} on ${endpointId}/${clusterId}/${attributeId} - value: ${JSON.stringify(value)}`,
        );

        return {
            endpointId,
            clusterId,
            attributeId,
            status: 0, // Success
        };
    }

    /**
     * Invoke a command on a test node.
     * Logs the command and returns null (no actual command execution).
     */
    async handleInvoke(data: InvokeRequest): Promise<unknown> {
        const { nodeId, endpointId, clusterId, commandName, data: payload } = data;

        logger.debug(
            `device_command for test node ${nodeId} on endpoint ${endpointId} - ` +
                `cluster ${clusterId} - command ${commandName} - payload: ${JSON.stringify(payload)}`,
        );

        return null;
    }

    /**
     * Get IP addresses for a test node.
     * Returns mock IP addresses.
     */
    async getNodeIpAddresses(_nodeId: NodeId, _preferCache?: boolean): Promise<string[]> {
        return ["0.0.0.0", "0000:1111:2222:3333:4444"];
    }

    /**
     * Ping a test node.
     * Returns mock success results.
     */
    async pingNode(_nodeId: NodeId, _attempts?: number): Promise<Record<string, boolean>> {
        return { "0.0.0.0": true, "0000:1111:2222:3333:4444": true };
    }

    /**
     * Remove a test node.
     */
    async removeNode(nodeId: NodeId): Promise<void> {
        const bigId = BigInt(nodeId);
        if (!this.#testNodes.has(bigId)) {
            throw new Error(`Test node ${nodeId} not found`);
        }

        logger.info(`Removing test node ${nodeId}`);
        this.#testNodes.delete(bigId);

        // Emit node_removed event
        this.nodeRemoved.emit(nodeId);
    }
}
