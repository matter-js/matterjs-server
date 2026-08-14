/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeId } from "@matter/main";
import { NodeConnectionState } from "@matter/main";
import { EndpointNumber } from "@matter/main/types";
import { Nodes } from "../src/controller/Nodes.js";

const TEST_NODE_ID = NodeId(1);
const OTHER_NODE_ID = NodeId(2);

describe("Nodes", () => {
    describe("isNodeAvailable", () => {
        let nodes: Nodes;

        beforeEach(() => {
            nodes = new Nodes();
        });

        it("is available when Connected", () => {
            expect(nodes.isNodeAvailable(NodeConnectionState.Connected)).to.equal(true);
        });

        it("is available when Reconnecting", () => {
            expect(nodes.isNodeAvailable(NodeConnectionState.Reconnecting)).to.equal(true);
        });

        it("is unavailable when WaitingForDeviceDiscovery", () => {
            expect(nodes.isNodeAvailable(NodeConnectionState.WaitingForDeviceDiscovery)).to.equal(false);
        });

        it("is unavailable when Disconnected", () => {
            expect(nodes.isNodeAvailable(NodeConnectionState.Disconnected)).to.equal(false);
        });
    });

    describe("processStateChange", () => {
        let nodes: Nodes;

        beforeEach(() => {
            nodes = new Nodes();
        });

        it("reports unavailable when Connected -> Disconnected", () => {
            nodes.seedState(TEST_NODE_ID, NodeConnectionState.Connected);
            const result = nodes.processStateChange(TEST_NODE_ID, NodeConnectionState.Disconnected);
            expect(result.availabilityChanged).to.equal(true);
            if (result.availabilityChanged) {
                expect(result.available).to.equal(false);
            }
        });

        it("reports unavailable when Connected -> WaitingForDeviceDiscovery", () => {
            nodes.seedState(TEST_NODE_ID, NodeConnectionState.Connected);
            const result = nodes.processStateChange(TEST_NODE_ID, NodeConnectionState.WaitingForDeviceDiscovery);
            expect(result.availabilityChanged).to.equal(true);
            if (result.availabilityChanged) {
                expect(result.available).to.equal(false);
            }
        });

        it("reports available when Disconnected -> Connected", () => {
            nodes.seedState(TEST_NODE_ID, NodeConnectionState.Disconnected);
            const result = nodes.processStateChange(TEST_NODE_ID, NodeConnectionState.Connected);
            expect(result.availabilityChanged).to.equal(true);
            if (result.availabilityChanged) {
                expect(result.available).to.equal(true);
            }
        });

        it("does NOT report a change when Connected -> Reconnecting", () => {
            nodes.seedState(TEST_NODE_ID, NodeConnectionState.Connected);
            const result = nodes.processStateChange(TEST_NODE_ID, NodeConnectionState.Reconnecting);
            expect(result.availabilityChanged).to.equal(false);
            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(true);
        });

        it("reports unavailable when Reconnecting -> WaitingForDeviceDiscovery", () => {
            nodes.seedState(TEST_NODE_ID, NodeConnectionState.Connected);
            nodes.processStateChange(TEST_NODE_ID, NodeConnectionState.Reconnecting);
            const result = nodes.processStateChange(TEST_NODE_ID, NodeConnectionState.WaitingForDeviceDiscovery);
            expect(result.availabilityChanged).to.equal(true);
            if (result.availabilityChanged) {
                expect(result.available).to.equal(false);
            }
            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(false);
        });

        it("does NOT report change when unavailable -> another unavailable", () => {
            nodes.seedState(TEST_NODE_ID, NodeConnectionState.Disconnected);
            const result = nodes.processStateChange(TEST_NODE_ID, NodeConnectionState.WaitingForDeviceDiscovery);
            expect(result.availabilityChanged).to.equal(false);
        });

        it("reports available on Connected for unseeded node", () => {
            const result = nodes.processStateChange(TEST_NODE_ID, NodeConnectionState.Connected);
            expect(result.availabilityChanged).to.equal(true);
            if (result.availabilityChanged) {
                expect(result.available).to.equal(true);
            }
        });

        it("full lifecycle: Connected -> Reconnecting -> WaitingForDeviceDiscovery -> Connected", () => {
            nodes.seedState(TEST_NODE_ID, NodeConnectionState.Connected);

            const r1 = nodes.processStateChange(TEST_NODE_ID, NodeConnectionState.Reconnecting);
            expect(r1.availabilityChanged).to.equal(false);
            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(true);

            const r2 = nodes.processStateChange(TEST_NODE_ID, NodeConnectionState.WaitingForDeviceDiscovery);
            expect(r2.availabilityChanged).to.equal(true);
            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(false);

            const r3 = nodes.processStateChange(TEST_NODE_ID, NodeConnectionState.Connected);
            expect(r3.availabilityChanged).to.equal(true);
            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(true);
        });
    });

    describe("isAvailable caching", () => {
        let nodes: Nodes;

        beforeEach(() => {
            nodes = new Nodes();
        });

        it("returns cached debounced value, not recomputed from live state", () => {
            // Seed as Connected (available)
            nodes.seedState(TEST_NODE_ID, NodeConnectionState.Connected);
            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(true);

            const result = nodes.processStateChange(TEST_NODE_ID, NodeConnectionState.Reconnecting);
            expect(result.availabilityChanged).to.equal(false);

            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(true);
        });

        it("returns false for unknown node", () => {
            expect(nodes.isAvailable(NodeId(999))).to.equal(false);
        });
    });

    describe("delete", () => {
        it("clears availability tracking", () => {
            const nodes = new Nodes();
            nodes.seedState(TEST_NODE_ID, NodeConnectionState.Connected);
            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(true);

            nodes.delete(TEST_NODE_ID);
            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(false);
        });

        it("clears queued endpoint additions", () => {
            const nodes = new Nodes();
            nodes.queueEndpointAdded(TEST_NODE_ID, EndpointNumber(32));
            nodes.delete(TEST_NODE_ID);
            expect(nodes.drainPendingEndpointAdds(TEST_NODE_ID)).to.deep.equal([]);
        });
    });

    describe("pending endpoint adds", () => {
        let nodes: Nodes;

        beforeEach(() => {
            nodes = new Nodes();
        });

        it("returns an empty array when nothing is queued", () => {
            expect(nodes.drainPendingEndpointAdds(TEST_NODE_ID)).to.deep.equal([]);
        });

        it("preserves insertion order across multiple queues", () => {
            nodes.queueEndpointAdded(TEST_NODE_ID, EndpointNumber(32));
            nodes.queueEndpointAdded(TEST_NODE_ID, EndpointNumber(33));
            nodes.queueEndpointAdded(TEST_NODE_ID, EndpointNumber(34));

            expect(nodes.drainPendingEndpointAdds(TEST_NODE_ID)).to.deep.equal([
                EndpointNumber(32),
                EndpointNumber(33),
                EndpointNumber(34),
            ]);
        });

        it("clears the queue after draining", () => {
            nodes.queueEndpointAdded(TEST_NODE_ID, EndpointNumber(32));
            nodes.drainPendingEndpointAdds(TEST_NODE_ID);
            expect(nodes.drainPendingEndpointAdds(TEST_NODE_ID)).to.deep.equal([]);
        });

        it("isolates queues per node", () => {
            nodes.queueEndpointAdded(TEST_NODE_ID, EndpointNumber(1));
            nodes.queueEndpointAdded(OTHER_NODE_ID, EndpointNumber(2));

            expect(nodes.drainPendingEndpointAdds(TEST_NODE_ID)).to.deep.equal([EndpointNumber(1)]);
            expect(nodes.drainPendingEndpointAdds(OTHER_NODE_ID)).to.deep.equal([EndpointNumber(2)]);
        });
    });
});
