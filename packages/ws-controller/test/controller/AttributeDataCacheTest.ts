/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeId } from "@matter/main";
import { AttributeId, ClusterId, EndpointNumber } from "@matter/main/types";
import { NodeStates, PairedNode } from "@project-chip/matter.js/device";
import { AttributeDataCache } from "../../src/controller/AttributeDataCache.js";

/**
 * Cluster definition for creating mock endpoints.
 */
interface MockClusterDef {
    id: number;
    name: string;
    /** Map of camelCase attribute name to { id, value } */
    attributes: Record<string, { id: number; value: unknown }>;
}

/**
 * Creates a mock endpoint with the given endpoint number and cluster definitions.
 * Each behavior satisfies ClusterBehavior.is() (which checks "cluster" in type).
 */
function createMockEndpoint(endpointNumber: number, clusters: MockClusterDef[]) {
    const behaviors = clusters.map(clusterDef => {
        // Build the cluster.attributes structure: { attrName: { id: number }, ... }
        const clusterAttributes: Record<string, { id: number }> = {};
        for (const [name, def] of Object.entries(clusterDef.attributes)) {
            clusterAttributes[name] = { id: def.id };
        }

        return {
            // Having "cluster" property makes ClusterBehavior.is() return true
            cluster: {
                id: ClusterId(clusterDef.id),
                name: clusterDef.name,
                attributes: clusterAttributes,
            },
            // stateValues stored for stateOf lookup
            _state: Object.fromEntries(Object.entries(clusterDef.attributes).map(([name, def]) => [name, def.value])),
        };
    });

    return {
        number: EndpointNumber(endpointNumber),
        behaviors: {
            active: behaviors,
        },
        stateOf(behavior: (typeof behaviors)[number]): Record<string, unknown> {
            return behavior._state;
        },
    };
}

type MockEndpoint = ReturnType<typeof createMockEndpoint>;

/**
 * Creates a mock PairedNode with the given endpoints and options.
 */
function createMockPairedNode(
    nodeId: number,
    endpoints: MockEndpoint[],
    opts?: {
        initialized?: boolean;
        connectionState?: NodeStates;
        isReady?: boolean;
    },
) {
    return {
        nodeId: NodeId(nodeId),
        initialized: opts?.initialized ?? true,
        connectionState: opts?.connectionState ?? NodeStates.Connected,
        isConnected: (opts?.connectionState ?? NodeStates.Connected) === NodeStates.Connected,
        node: {
            lifecycle: {
                isReady: opts?.isReady ?? true,
            },
            endpoints,
        },
    } as unknown as PairedNode;
}

// --- Cluster definitions for test scenarios ---

const onOffCluster: MockClusterDef = {
    id: 6, // OnOff cluster
    name: "OnOff",
    attributes: {
        onOff: { id: 0, value: true },
    },
};

const electricalMeasurementCluster: MockClusterDef = {
    id: 0x0b04, // DraftElectricalMeasurement (2820)
    name: "DraftElectricalMeasurement",
    attributes: {
        rmsVoltage: { id: 0x0505, value: 230 }, // 1285
        rmsCurrent: { id: 0x0508, value: 500 }, // 1288
        activePower: { id: 0x050b, value: 1150 }, // 1291
    },
};

describe("AttributeDataCache", () => {
    let cache: AttributeDataCache;

    beforeEach(() => {
        cache = new AttributeDataCache();
    });

    describe("basic cache population", () => {
        it("should populate cache from a node with multiple endpoints", () => {
            const endpoint1 = createMockEndpoint(1, [onOffCluster]);
            const endpoint2 = createMockEndpoint(2, [electricalMeasurementCluster]);
            const node = createMockPairedNode(1, [endpoint1, endpoint2]);

            cache.add(node);

            const attributes = cache.get(NodeId(1));
            expect(attributes).to.not.be.undefined;

            // OnOff attribute on endpoint 1
            expect(attributes!["1/6/0"]).to.equal(true);

            // ElectricalMeasurement attributes on endpoint 2
            expect(attributes!["2/2820/1285"]).to.equal(230); // rmsVoltage
            expect(attributes!["2/2820/1288"]).to.equal(500); // rmsCurrent
            expect(attributes!["2/2820/1291"]).to.equal(1150); // activePower
        });

        it("should not populate cache when node is not initialized", () => {
            const endpoint1 = createMockEndpoint(1, [onOffCluster]);
            const node = createMockPairedNode(1, [endpoint1], { initialized: false });

            cache.add(node);

            const attributes = cache.get(NodeId(1));
            expect(attributes).to.be.undefined;
        });

        it("should not populate cache when node is disconnected", () => {
            const endpoint1 = createMockEndpoint(1, [onOffCluster]);
            const node = createMockPairedNode(1, [endpoint1], { connectionState: NodeStates.Disconnected });

            cache.add(node);

            const attributes = cache.get(NodeId(1));
            expect(attributes).to.be.undefined;
        });
    });

    describe("cache replacement on update", () => {
        it("should preserve previously-cached endpoints missing from current update", () => {
            // Initial state: node has both OnOff and ElectricalMeasurement endpoints
            const endpoint1 = createMockEndpoint(1, [onOffCluster]);
            const endpoint2 = createMockEndpoint(2, [electricalMeasurementCluster]);
            const node = createMockPairedNode(1, [endpoint1, endpoint2]);

            cache.add(node);

            // Verify both endpoints are cached
            let attributes = cache.get(NodeId(1))!;
            expect(attributes["1/6/0"]).to.equal(true);
            expect(attributes["2/2820/1285"]).to.equal(230);

            // Update with only endpoint 1 (simulating endpoint 2 not being ready).
            // The cache should preserve endpoint 2's attributes from the previous
            // population, since endpoint 2 was not explicitly removed.
            const nodeWithPartialEndpoints = createMockPairedNode(1, [endpoint1]);
            cache.update(nodeWithPartialEndpoints);

            attributes = cache.get(NodeId(1))!;
            expect(attributes["1/6/0"]).to.equal(true);
            // Endpoint 2 attributes should still be present (preserved from previous cache)
            expect(attributes["2/2820/1285"]).to.equal(230);
            expect(attributes["2/2820/1288"]).to.equal(500);
            expect(attributes["2/2820/1291"]).to.equal(1150);
        });

        it("should preserve old cache when node is not ready on update", () => {
            const endpoint1 = createMockEndpoint(1, [onOffCluster]);
            const endpoint2 = createMockEndpoint(2, [electricalMeasurementCluster]);
            const node = createMockPairedNode(1, [endpoint1, endpoint2]);

            cache.add(node);

            // Update with a node that reports not ready
            const notReadyNode = createMockPairedNode(1, [endpoint1], { isReady: false });
            cache.update(notReadyNode);

            // Old cache should be preserved because the guard clause prevents replacement
            const attributes = cache.get(NodeId(1))!;
            expect(attributes["1/6/0"]).to.equal(true);
            expect(attributes["2/2820/1285"]).to.equal(230);
        });

        it("should preserve old cache when node is disconnected on update", () => {
            const endpoint1 = createMockEndpoint(1, [onOffCluster]);
            const endpoint2 = createMockEndpoint(2, [electricalMeasurementCluster]);
            const node = createMockPairedNode(1, [endpoint1, endpoint2]);

            cache.add(node);

            // Update with a disconnected node
            const disconnectedNode = createMockPairedNode(1, [endpoint1], {
                connectionState: NodeStates.Disconnected,
            });
            cache.update(disconnectedNode);

            // Old cache should be preserved
            const attributes = cache.get(NodeId(1))!;
            expect(attributes["1/6/0"]).to.equal(true);
            expect(attributes["2/2820/1285"]).to.equal(230);
        });
    });

    describe("structureChanged scenario - partial endpoint availability", () => {
        it("should retain energy meter attributes when structureChanged fires with incomplete endpoints", () => {
            // Step 1: Initial state - device has both switch (endpoint 1) and
            // energy meter (endpoint 2)
            const switchEndpoint = createMockEndpoint(1, [onOffCluster]);
            const energyEndpoint = createMockEndpoint(2, [electricalMeasurementCluster]);
            const fullNode = createMockPairedNode(1, [switchEndpoint, energyEndpoint]);

            cache.add(fullNode);

            // Step 2: Verify both endpoints' attributes are in the cache
            let attributes = cache.get(NodeId(1))!;
            expect(attributes["1/6/0"]).to.equal(true);
            expect(attributes["2/2820/1285"]).to.equal(230);
            expect(attributes["2/2820/1288"]).to.equal(500);
            expect(attributes["2/2820/1291"]).to.equal(1150);

            // Step 3: Simulate structureChanged firing during reconnection where
            // only the switch endpoint is ready (energy meter still initializing).
            // This is what ControllerCommandHandler.ts:318-323 does:
            //   node.events.structureChanged.on(() => {
            //       if (node.isConnected) {
            //           attributeCache.update(node);
            //       }
            //   });
            const partialNode = createMockPairedNode(1, [switchEndpoint]);
            cache.update(partialNode);

            // Step 4: The cache should retain previously-known endpoint 2 attributes.
            // If these are lost, HA receives a node_updated without them, marks
            // them unavailable, and when they reappear creates duplicates with _2 suffix.
            attributes = cache.get(NodeId(1))!;
            expect(attributes["1/6/0"]).to.equal(true);
            expect(attributes["2/2820/1285"]).to.equal(230); // rmsVoltage retained
            expect(attributes["2/2820/1288"]).to.equal(500); // rmsCurrent retained
            expect(attributes["2/2820/1291"]).to.equal(1150); // activePower retained
        });

        it("should retain cluster attributes when a cluster behavior is not yet active", () => {
            // Scenario: endpoint 2 exists but its ElectricalMeasurement behavior
            // is not yet active (e.g., still initializing)
            const switchEndpoint = createMockEndpoint(1, [onOffCluster]);
            const energyEndpoint = createMockEndpoint(2, [electricalMeasurementCluster]);
            const fullNode = createMockPairedNode(1, [switchEndpoint, energyEndpoint]);

            cache.add(fullNode);

            // Verify initial state
            let attributes = cache.get(NodeId(1))!;
            expect(attributes["2/2820/1285"]).to.equal(230);

            // Simulate: endpoint 2 exists but has no active behaviors
            const emptyEndpoint2 = createMockEndpoint(2, []); // no clusters active yet
            const partialNode = createMockPairedNode(1, [switchEndpoint, emptyEndpoint2]);
            cache.update(partialNode);

            // Energy meter attributes should be preserved from previous cache
            attributes = cache.get(NodeId(1))!;
            expect(attributes["1/6/0"]).to.equal(true);
            expect(attributes["2/2820/1285"]).to.equal(230);
        });
    });

    describe("incremental attribute updates", () => {
        it("should update a single attribute without affecting others", () => {
            const endpoint1 = createMockEndpoint(1, [onOffCluster]);
            const endpoint2 = createMockEndpoint(2, [electricalMeasurementCluster]);
            const node = createMockPairedNode(1, [endpoint1, endpoint2]);

            cache.add(node);

            // Update just the rmsVoltage via updateAttribute
            cache.updateAttribute(NodeId(1), {
                path: {
                    endpointId: EndpointNumber(2),
                    clusterId: ClusterId(0x0b04),
                    attributeId: AttributeId(0x0505),
                },
                value: 231,
                version: 1,
            } as any);

            const attributes = cache.get(NodeId(1))!;

            // The updated attribute should have the new value
            expect(attributes["2/2820/1285"]).to.equal(231);

            // Other attributes should be unchanged
            expect(attributes["1/6/0"]).to.equal(true);
            expect(attributes["2/2820/1288"]).to.equal(500);
            expect(attributes["2/2820/1291"]).to.equal(1150);
        });
    });
});
