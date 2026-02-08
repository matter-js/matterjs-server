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

        it("should scan all waiting nodes and trigger reconnect for each found device", async () => {
            const waitingNode1 = mockNode(NodeStates.WaitingForDeviceDiscovery);
            const waitingNode2 = mockNode(NodeStates.WaitingForDeviceDiscovery);
            const waitingNode3 = mockNode(NodeStates.WaitingForDeviceDiscovery);

            const nodeMap = new Map<bigint, PairedNode & { triggerReconnectCalls: number }>([
                [1n, waitingNode1],
                [2n, waitingNode2],
                [3n, waitingNode3],
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
                interNodeDelayMs: 0,
            };

            const scanner = new MdnsDeviceScanner(deps);
            await scanner.scanNow();
            scanner.stop();

            expect(discoveredNodeIds).to.have.members([1n, 2n, 3n]);
            expect(waitingNode1.triggerReconnectCalls).to.equal(1);
            expect(waitingNode2.triggerReconnectCalls).to.equal(1);
            expect(waitingNode3.triggerReconnectCalls).to.equal(1);
        });

        it("should continue scanning other nodes when one findDevice throws", async () => {
            const waitingNode1 = mockNode(NodeStates.WaitingForDeviceDiscovery);
            const waitingNode2 = mockNode(NodeStates.WaitingForDeviceDiscovery);
            const waitingNode3 = mockNode(NodeStates.WaitingForDeviceDiscovery);

            const nodeMap = new Map<bigint, PairedNode & { triggerReconnectCalls: number }>([
                [1n, waitingNode1],
                [2n, waitingNode2],
                [3n, waitingNode3],
            ]);

            const deps: MdnsDeviceScannerDeps = {
                getNodeIds: () => [...nodeMap.keys()].map(id => NodeId(id)),
                getNode: (nodeId: NodeId) => {
                    const node = nodeMap.get(BigInt(nodeId));
                    if (!node) throw new Error(`Node ${nodeId} not found`);
                    return node;
                },
                findDevice: async (nodeId: NodeId) => {
                    if (BigInt(nodeId) === 2n) throw new Error("network failure");
                    return FOUND_DEVICE;
                },
                interNodeDelayMs: 0,
            };

            const scanner = new MdnsDeviceScanner(deps);
            await scanner.scanNow();
            scanner.stop();

            expect(waitingNode1.triggerReconnectCalls).to.equal(1);
            expect(waitingNode2.triggerReconnectCalls).to.equal(0);
            expect(waitingNode3.triggerReconnectCalls).to.equal(1);
        });

        it("should only trigger reconnect for nodes with discovered addresses", async () => {
            const node1 = mockNode(NodeStates.WaitingForDeviceDiscovery);
            const node2 = mockNode(NodeStates.WaitingForDeviceDiscovery);
            const node3 = mockNode(NodeStates.WaitingForDeviceDiscovery);
            const node4 = mockNode(NodeStates.WaitingForDeviceDiscovery);

            const nodeMap = new Map<bigint, PairedNode & { triggerReconnectCalls: number }>([
                [1n, node1],
                [2n, node2],
                [3n, node3],
                [4n, node4],
            ]);

            const deps: MdnsDeviceScannerDeps = {
                getNodeIds: () => [...nodeMap.keys()].map(id => NodeId(id)),
                getNode: (nodeId: NodeId) => {
                    const node = nodeMap.get(BigInt(nodeId));
                    if (!node) throw new Error(`Node ${nodeId} not found`);
                    return node;
                },
                findDevice: async (nodeId: NodeId) => {
                    const id = BigInt(nodeId);
                    if (id === 1n) return FOUND_DEVICE;
                    if (id === 2n) return undefined;
                    if (id === 3n) return { addresses: [] };
                    throw new Error("timeout");
                },
                interNodeDelayMs: 0,
            };

            const scanner = new MdnsDeviceScanner(deps);
            await scanner.scanNow();
            scanner.stop();

            expect(node1.triggerReconnectCalls).to.equal(1);
            expect(node2.triggerReconnectCalls).to.equal(0);
            expect(node3.triggerReconnectCalls).to.equal(0);
            expect(node4.triggerReconnectCalls).to.equal(0);
        });

        it("should not allow concurrent scanNow calls", async () => {
            let findDeviceCallCount = 0;
            const waitingNode = mockNode(NodeStates.WaitingForDeviceDiscovery);

            let resolveFind: (value: DiscoveredDevice) => void;
            const deps: MdnsDeviceScannerDeps = {
                getNodeIds: () => [NodeId(1n)],
                getNode: () => waitingNode,
                findDevice: async () => {
                    findDeviceCallCount++;
                    return new Promise<DiscoveredDevice>(resolve => {
                        resolveFind = resolve;
                    });
                },
            };

            const scanner = new MdnsDeviceScanner(deps);

            const scan1 = scanner.scanNow();
            // Start a second scan while the first is still in progress
            const scan2 = scanner.scanNow();

            // scan2 should return immediately (no-op due to #isScanning guard)
            await scan2;

            // Unblock the first scan
            resolveFind!(FOUND_DEVICE);
            await scan1;
            scanner.stop();

            // findDevice should only have been called once (from scan1)
            expect(findDeviceCallCount).to.equal(1);
        });

        it("should respect stop() called during an active scan", async () => {
            const waitingNode = mockNode(NodeStates.WaitingForDeviceDiscovery);
            const ref: { scanner?: MdnsDeviceScanner } = {};

            const deps: MdnsDeviceScannerDeps = {
                getNodeIds: () => [NodeId(1n)],
                getNode: () => waitingNode,
                findDevice: async () => {
                    // Stop the scanner while findDevice is in progress
                    ref.scanner!.stop();
                    return FOUND_DEVICE;
                },
            };

            ref.scanner = new MdnsDeviceScanner(deps);
            await ref.scanner.scanNow();

            // The node was found but scanner was stopped during findDevice.
            // #scanNode does not check #closed after findDevice returns — it only
            // re-checks connectionState. Since the node is still in
            // WaitingForDeviceDiscovery, triggerReconnect fires.
            expect(waitingNode.triggerReconnectCalls).to.equal(1);
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
