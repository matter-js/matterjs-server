/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeId } from "@matter/main";
import { NodeStates, PairedNode } from "@project-chip/matter.js/device";
import { DiscoveredDevice, MdnsDeviceScanner, MdnsDeviceScannerDeps } from "../src/controller/MdnsDeviceScanner.js";

/** Create a mock PairedNode with the given connection state. */
function mockNode(state: NodeStates): PairedNode & { triggerReconnectCalls: number } {
    let triggerReconnectCalls = 0;
    return {
        get connectionState() {
            return state;
        },
        triggerReconnect() {
            triggerReconnectCalls++;
        },
        get triggerReconnectCalls() {
            return triggerReconnectCalls;
        },
    } as unknown as PairedNode & { triggerReconnectCalls: number };
}

/** A discovered device result with one address. */
const FOUND_DEVICE: DiscoveredDevice = {
    addresses: [{ ip: "192.168.1.100" }],
};

describe("MdnsDeviceScanner", () => {
    describe("scanNow", () => {
        it("should only scan nodes in WaitingForDeviceDiscovery state", async () => {
            const connectedNode = mockNode(NodeStates.Connected);
            const reconnectingNode = mockNode(NodeStates.Reconnecting);
            const waitingNode = mockNode(NodeStates.WaitingForDeviceDiscovery);

            const nodeMap = new Map<bigint, PairedNode & { triggerReconnectCalls: number }>([
                [1n, connectedNode],
                [2n, reconnectingNode],
                [3n, waitingNode],
            ]);

            const discoveredNodeIds: bigint[] = [];

            const deps: MdnsDeviceScannerDeps = {
                getNodeIds: () => [...nodeMap.keys()].map(id => NodeId(id)),
                getNode: (nodeId: NodeId) => {
                    const node = nodeMap.get(BigInt(nodeId));
                    if (!node) throw new Error(`Node ${nodeId} not found`);
                    return node;
                },
                findDevice: async (nodeId: NodeId) => {
                    discoveredNodeIds.push(BigInt(nodeId));
                    return FOUND_DEVICE;
                },
            };

            const scanner = new MdnsDeviceScanner(deps);

            await scanner.scanNow();
            scanner.stop();

            // findDevice should only have been called for the WaitingForDeviceDiscovery node
            expect(discoveredNodeIds).to.deep.equal([3n]);

            // triggerReconnect should only have been called on the waiting node
            expect(connectedNode.triggerReconnectCalls).to.equal(0);
            expect(reconnectingNode.triggerReconnectCalls).to.equal(0);
            expect(waitingNode.triggerReconnectCalls).to.equal(1);
        });

        it("should not trigger reconnect when device has empty addresses", async () => {
            const waitingNode = mockNode(NodeStates.WaitingForDeviceDiscovery);

            const deps: MdnsDeviceScannerDeps = {
                getNodeIds: () => [NodeId(1n)],
                getNode: () => waitingNode,
                findDevice: async () => ({ addresses: [] }),
            };

            const scanner = new MdnsDeviceScanner(deps);

            await scanner.scanNow();
            scanner.stop();

            expect(waitingNode.triggerReconnectCalls).to.equal(0);
        });

        it("should not trigger reconnect if state changed during mDNS query", async () => {
            let currentState = NodeStates.WaitingForDeviceDiscovery;
            let triggerReconnectCalls = 0;
            const node = {
                get connectionState() {
                    return currentState;
                },
                triggerReconnect() {
                    triggerReconnectCalls++;
                },
            } as unknown as PairedNode;

            const deps: MdnsDeviceScannerDeps = {
                getNodeIds: () => [NodeId(1n)],
                getNode: () => node,
                findDevice: async () => {
                    // Simulate the node reconnecting via another path during the mDNS query
                    currentState = NodeStates.Connected;
                    return FOUND_DEVICE;
                },
            };

            const scanner = new MdnsDeviceScanner(deps);

            await scanner.scanNow();
            scanner.stop();

            expect(triggerReconnectCalls).to.equal(0);
        });

        it("should handle node removed during scan", async () => {
            let getNodeCallCount = 0;
            const waitingNode = mockNode(NodeStates.WaitingForDeviceDiscovery);

            const deps: MdnsDeviceScannerDeps = {
                getNodeIds: () => [NodeId(1n)],
                getNode: () => {
                    getNodeCallCount++;
                    if (getNodeCallCount > 1) {
                        // First call is during filtering (returns the node).
                        // Second call is inside #scanNode — node was removed.
                        throw new Error("Node not found");
                    }
                    return waitingNode;
                },
                findDevice: async () => {
                    throw new Error("should not be called");
                },
            };

            const scanner = new MdnsDeviceScanner(deps);

            // Should not throw despite getNode failing inside #scanNode
            await scanner.scanNow();
            scanner.stop();

            expect(waitingNode.triggerReconnectCalls).to.equal(0);
        });

        it("should not trigger reconnect when mDNS finds nothing", async () => {
            const waitingNode = mockNode(NodeStates.WaitingForDeviceDiscovery);

            const deps: MdnsDeviceScannerDeps = {
                getNodeIds: () => [NodeId(1n)],
                getNode: () => waitingNode,
                findDevice: async () => undefined,
            };

            const scanner = new MdnsDeviceScanner(deps);

            await scanner.scanNow();
            scanner.stop();

            expect(waitingNode.triggerReconnectCalls).to.equal(0);
        });

        it("should handle findDevice throwing an error", async () => {
            const waitingNode = mockNode(NodeStates.WaitingForDeviceDiscovery);

            const deps: MdnsDeviceScannerDeps = {
                getNodeIds: () => [NodeId(1n)],
                getNode: () => waitingNode,
                findDevice: async () => {
                    throw new Error("mDNS network failure");
                },
            };

            const scanner = new MdnsDeviceScanner(deps);

            // Should not throw despite findDevice failing
            await scanner.scanNow();
            scanner.stop();

            expect(waitingNode.triggerReconnectCalls).to.equal(0);
        });

        it("should handle no nodes at all", async () => {
            let findDeviceCalled = false;

            const deps: MdnsDeviceScannerDeps = {
                getNodeIds: () => [],
                getNode: () => {
                    throw new Error("should not be called");
                },
                findDevice: async () => {
                    findDeviceCalled = true;
                    return FOUND_DEVICE;
                },
            };

            const scanner = new MdnsDeviceScanner(deps);

            await scanner.scanNow();
            scanner.stop();

            expect(findDeviceCalled).to.be.false;
        });

        it("should handle all nodes connected", async () => {
            let findDeviceCalled = false;

            const deps: MdnsDeviceScannerDeps = {
                getNodeIds: () => [NodeId(1n), NodeId(2n)],
                getNode: () => mockNode(NodeStates.Connected),
                findDevice: async () => {
                    findDeviceCalled = true;
                    return FOUND_DEVICE;
                },
            };

            const scanner = new MdnsDeviceScanner(deps);

            await scanner.scanNow();
            scanner.stop();

            expect(findDeviceCalled).to.be.false;
        });

        it("should not scan after stop", async () => {
            let findDeviceCalled = false;
            const waitingNode = mockNode(NodeStates.WaitingForDeviceDiscovery);

            const deps: MdnsDeviceScannerDeps = {
                getNodeIds: () => [NodeId(1n)],
                getNode: () => waitingNode,
                findDevice: async () => {
                    findDeviceCalled = true;
                    return FOUND_DEVICE;
                },
            };

            const scanner = new MdnsDeviceScanner(deps);

            scanner.stop();
            await scanner.scanNow();

            expect(findDeviceCalled).to.be.false;
            expect(waitingNode.triggerReconnectCalls).to.equal(0);
        });
    });
});
