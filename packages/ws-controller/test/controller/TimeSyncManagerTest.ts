/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeId } from "@matter/main";
import { hasTimeSyncCluster, TimeSyncManager, TimeSyncConnector } from "../../src/controller/TimeSyncManager.js";
import { AttributesData } from "../../src/types/CommandHandler.js";

// TimeSynchronization cluster ID = 0x38 (56 decimal), always on endpoint 0
// Attribute keys follow the format: endpoint/cluster/attribute
const TIME_SYNC_ATTRIBUTE_PREFIX = "0/56/";

// timeFailure event: clusterId=0x38, eventId=0x3
const TIME_SYNC_CLUSTER_ID = 0x0038;
const TIME_FAILURE_EVENT_ID = 0x03;

function createMockConnector(overrides?: Partial<TimeSyncConnector>): TimeSyncConnector & {
    syncTimeCalls: NodeId[];
} {
    const syncTimeCalls: NodeId[] = [];

    return {
        syncTimeCalls,
        syncTime:
            overrides?.syncTime ??
            (async (nodeId: NodeId) => {
                syncTimeCalls.push(nodeId);
            }),
        nodeConnected: overrides?.nodeConnected ?? (() => true),
    };
}

function makeTimeFailureEvent(nodeId?: NodeId) {
    return {
        path: {
            nodeId: nodeId ?? NodeId(1),
            endpointId: 0,
            clusterId: TIME_SYNC_CLUSTER_ID,
            eventId: TIME_FAILURE_EVENT_ID,
        },
        events: [],
    } as any;
}

function makeUnrelatedEvent() {
    return {
        path: {
            nodeId: NodeId(1),
            endpointId: 0,
            clusterId: 0x0028, // BasicInformation
            eventId: 0x00,
        },
        events: [],
    } as any;
}

describe("hasTimeSyncCluster", () => {
    it("returns true when TimeSynchronization attributes exist", () => {
        const attributes: AttributesData = {
            "0/40/0": 17, // BasicInformation
            [`${TIME_SYNC_ATTRIBUTE_PREFIX}0`]: null, // TimeSynchronization.utcTime
            [`${TIME_SYNC_ATTRIBUTE_PREFIX}1`]: 0, // TimeSynchronization.granularity
        };
        expect(hasTimeSyncCluster(attributes)).to.be.true;
    });

    it("returns false when no TimeSynchronization attributes exist", () => {
        const attributes: AttributesData = {
            "0/40/0": 17, // BasicInformation
            "0/40/2": 4874, // VendorID
            "1/6/0": false, // OnOff
        };
        expect(hasTimeSyncCluster(attributes)).to.be.false;
    });

    it("returns false for empty attributes", () => {
        expect(hasTimeSyncCluster({})).to.be.false;
    });

    it("returns false when TimeSynchronization cluster is on non-root endpoint", () => {
        const attributes: AttributesData = {
            "1/56/0": null, // TimeSynchronization on endpoint 1 (not spec-compliant)
        };
        expect(hasTimeSyncCluster(attributes)).to.be.false;
    });
});

describe("TimeSyncManager", () => {
    it("syncs time immediately when registering a node with TimeSynchronization cluster", () => {
        const connector = createMockConnector();
        const manager = new TimeSyncManager(connector);
        const nodeId = NodeId(1);

        const attributes: AttributesData = {
            [`${TIME_SYNC_ATTRIBUTE_PREFIX}0`]: null,
            [`${TIME_SYNC_ATTRIBUTE_PREFIX}1`]: 0,
        };

        manager.registerNode(nodeId, attributes);
        expect(connector.syncTimeCalls).to.have.lengthOf(1);
        expect(connector.syncTimeCalls[0]).to.equal(nodeId);
        manager.stop();
    });

    it("does not sync nodes without TimeSynchronization cluster", () => {
        const connector = createMockConnector();
        const manager = new TimeSyncManager(connector);
        const nodeId = NodeId(1);

        const attributes: AttributesData = {
            "0/40/0": 17,
            "1/6/0": false,
        };

        manager.registerNode(nodeId, attributes);
        expect(connector.syncTimeCalls).to.have.lengthOf(0);
        manager.stop();
    });

    it("syncs time on timeFailure event", () => {
        const connector = createMockConnector();
        const manager = new TimeSyncManager(connector);
        const nodeId = NodeId(1);

        // Register the node first
        const attributes: AttributesData = {
            [`${TIME_SYNC_ATTRIBUTE_PREFIX}0`]: null,
            [`${TIME_SYNC_ATTRIBUTE_PREFIX}1`]: 0,
        };
        manager.registerNode(nodeId, attributes);
        connector.syncTimeCalls.length = 0; // clear the initial sync call

        manager.handleEvent(nodeId, makeTimeFailureEvent(nodeId));
        expect(connector.syncTimeCalls).to.have.lengthOf(1);
        expect(connector.syncTimeCalls[0]).to.equal(nodeId);
        manager.stop();
    });

    it("does not sync on unrelated events", () => {
        const connector = createMockConnector();
        const manager = new TimeSyncManager(connector);
        const nodeId = NodeId(1);

        const attributes: AttributesData = {
            [`${TIME_SYNC_ATTRIBUTE_PREFIX}0`]: null,
            [`${TIME_SYNC_ATTRIBUTE_PREFIX}1`]: 0,
        };
        manager.registerNode(nodeId, attributes);
        connector.syncTimeCalls.length = 0;

        manager.handleEvent(nodeId, makeUnrelatedEvent());
        expect(connector.syncTimeCalls).to.have.lengthOf(0);
        manager.stop();
    });

    it("does not sync after unregisterNode", () => {
        const connector = createMockConnector();
        const manager = new TimeSyncManager(connector);
        const nodeId = NodeId(1);

        const attributes: AttributesData = {
            [`${TIME_SYNC_ATTRIBUTE_PREFIX}0`]: null,
            [`${TIME_SYNC_ATTRIBUTE_PREFIX}1`]: 0,
        };
        manager.registerNode(nodeId, attributes);
        connector.syncTimeCalls.length = 0;

        manager.unregisterNode(nodeId);
        manager.handleEvent(nodeId, makeTimeFailureEvent(nodeId));
        expect(connector.syncTimeCalls).to.have.lengthOf(0);
        manager.stop();
    });

    it("does not sync after stop", () => {
        const connector = createMockConnector();
        const manager = new TimeSyncManager(connector);
        const nodeId = NodeId(1);

        const attributes: AttributesData = {
            [`${TIME_SYNC_ATTRIBUTE_PREFIX}0`]: null,
            [`${TIME_SYNC_ATTRIBUTE_PREFIX}1`]: 0,
        };
        manager.registerNode(nodeId, attributes);
        connector.syncTimeCalls.length = 0;

        manager.stop();
        manager.handleEvent(nodeId, makeTimeFailureEvent(nodeId));
        expect(connector.syncTimeCalls).to.have.lengthOf(0);
    });

    it("skips sync when node is not connected", () => {
        const connector = createMockConnector({ nodeConnected: () => false });
        const manager = new TimeSyncManager(connector);
        const nodeId = NodeId(1);

        const attributes: AttributesData = {
            [`${TIME_SYNC_ATTRIBUTE_PREFIX}0`]: null,
            [`${TIME_SYNC_ATTRIBUTE_PREFIX}1`]: 0,
        };
        manager.registerNode(nodeId, attributes);
        expect(connector.syncTimeCalls).to.have.lengthOf(0);
        manager.stop();
    });

    it("handles syncTime errors without throwing", () => {
        const connector = createMockConnector({
            syncTime: async () => {
                throw new Error("connection lost");
            },
        });
        const manager = new TimeSyncManager(connector);
        const nodeId = NodeId(1);

        const attributes: AttributesData = {
            [`${TIME_SYNC_ATTRIBUTE_PREFIX}0`]: null,
            [`${TIME_SYNC_ATTRIBUTE_PREFIX}1`]: 0,
        };

        // Should not throw
        expect(() => manager.registerNode(nodeId, attributes)).to.not.throw();
        manager.stop();
    });
});
