/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeId } from "@matter/main";
import { EndpointNumber } from "@matter/main/types";
import { NodeStates } from "@project-chip/matter.js/device";
import { Nodes } from "../src/controller/Nodes.js";

const TEST_NODE_ID = NodeId(1);
const OTHER_NODE_ID = NodeId(2);

describe("Nodes", () => {
    describe("isNodeAvailable", () => {
        let nodes: Nodes;

        beforeEach(() => {
            nodes = new Nodes();
        });

        it("returns true when Connected (no debounce)", () => {
            expect(nodes.isNodeAvailable(NodeStates.Connected)).to.equal(true);
        });

        it("returns true when Connected even if debounce pending", () => {
            expect(nodes.isNodeAvailable(NodeStates.Connected, true)).to.equal(true);
        });

        it("returns true when Reconnecting with debounce pending", () => {
            expect(nodes.isNodeAvailable(NodeStates.Reconnecting, true)).to.equal(true);
        });

        it("returns true when WaitingForDeviceDiscovery with debounce pending", () => {
            expect(nodes.isNodeAvailable(NodeStates.WaitingForDeviceDiscovery, true)).to.equal(true);
        });

        it("returns true when Disconnected with debounce pending", () => {
            expect(nodes.isNodeAvailable(NodeStates.Disconnected, true)).to.equal(true);
        });

        it("returns false when Reconnecting without debounce", () => {
            expect(nodes.isNodeAvailable(NodeStates.Reconnecting)).to.equal(false);
        });

        it("returns false when Disconnected without debounce", () => {
            expect(nodes.isNodeAvailable(NodeStates.Disconnected)).to.equal(false);
        });

        it("returns false when WaitingForDeviceDiscovery without debounce", () => {
            expect(nodes.isNodeAvailable(NodeStates.WaitingForDeviceDiscovery)).to.equal(false);
        });
    });

    describe("processStateChange", () => {
        let nodes: Nodes;

        beforeEach(() => {
            nodes = new Nodes();
        });

        it("reports unavailable when Connected -> Disconnected (no debounce)", () => {
            nodes.seedState(TEST_NODE_ID, NodeStates.Connected);
            const result = nodes.processStateChange(TEST_NODE_ID, NodeStates.Disconnected, false);
            expect(result.availabilityChanged).to.equal(true);
            if (result.availabilityChanged) {
                expect(result.available).to.equal(false);
            }
        });

        it("reports unavailable when Connected -> WaitingForDeviceDiscovery (no debounce)", () => {
            nodes.seedState(TEST_NODE_ID, NodeStates.Connected);
            const result = nodes.processStateChange(TEST_NODE_ID, NodeStates.WaitingForDeviceDiscovery, false);
            expect(result.availabilityChanged).to.equal(true);
            if (result.availabilityChanged) {
                expect(result.available).to.equal(false);
            }
        });

        it("reports available when Disconnected -> Connected", () => {
            nodes.seedState(TEST_NODE_ID, NodeStates.Disconnected);
            const result = nodes.processStateChange(TEST_NODE_ID, NodeStates.Connected, false);
            expect(result.availabilityChanged).to.equal(true);
            if (result.availabilityChanged) {
                expect(result.available).to.equal(true);
            }
        });

        it("does NOT report change when Connected -> Reconnecting with debounce pending", () => {
            nodes.seedState(TEST_NODE_ID, NodeStates.Connected);
            const result = nodes.processStateChange(TEST_NODE_ID, NodeStates.Reconnecting, true);
            expect(result.availabilityChanged).to.equal(false);
            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(true);
        });

        it("does NOT report change when Reconnecting -> WaitingForDeviceDiscovery with debounce pending", () => {
            nodes.seedState(TEST_NODE_ID, NodeStates.Connected);
            nodes.processStateChange(TEST_NODE_ID, NodeStates.Reconnecting, true);
            const result = nodes.processStateChange(TEST_NODE_ID, NodeStates.WaitingForDeviceDiscovery, true);
            expect(result.availabilityChanged).to.equal(false);
            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(true);
        });

        it("does NOT report change when unavailable -> another unavailable", () => {
            nodes.seedState(TEST_NODE_ID, NodeStates.Disconnected);
            const result = nodes.processStateChange(TEST_NODE_ID, NodeStates.WaitingForDeviceDiscovery, false);
            expect(result.availabilityChanged).to.equal(false);
        });

        it("reports available on Connected for unseeded node", () => {
            const result = nodes.processStateChange(TEST_NODE_ID, NodeStates.Connected, false);
            expect(result.availabilityChanged).to.equal(true);
            if (result.availabilityChanged) {
                expect(result.available).to.equal(true);
            }
        });

        it("Connected -> Reconnecting -> WaitingForDeviceDiscovery stays available while timer armed", () => {
            nodes.seedState(TEST_NODE_ID, NodeStates.Connected);

            // Connected -> Reconnecting: timer armed, debounced, still available
            const r1 = nodes.processStateChange(TEST_NODE_ID, NodeStates.Reconnecting, true);
            expect(r1.availabilityChanged).to.equal(false);
            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(true);

            // Reconnecting -> WaitingForDeviceDiscovery (timer still armed): still available
            const r2 = nodes.processStateChange(TEST_NODE_ID, NodeStates.WaitingForDeviceDiscovery, true);
            expect(r2.availabilityChanged).to.equal(false);
            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(true);

            // WaitingForDeviceDiscovery -> Connected: timer cleared, stays available
            const r3 = nodes.processStateChange(TEST_NODE_ID, NodeStates.Connected, false);
            expect(r3.availabilityChanged).to.equal(false);
            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(true);
        });

        it("emits offline when debounce drops while still non-Connected", () => {
            nodes.seedState(TEST_NODE_ID, NodeStates.Connected);
            nodes.processStateChange(TEST_NODE_ID, NodeStates.Reconnecting, true);

            // Timer expiry simulated by forceUnavailable, then next state change has debouncePending=false
            nodes.forceUnavailable(TEST_NODE_ID);
            const result = nodes.processStateChange(TEST_NODE_ID, NodeStates.WaitingForDeviceDiscovery, false);
            // wasAvailable already false (forceUnavailable) -> no further change
            expect(result.availabilityChanged).to.equal(false);
            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(false);
        });

        it("full lifecycle: Connected -> Reconnecting -> Disconnected -> Connected", () => {
            nodes.seedState(TEST_NODE_ID, NodeStates.Connected);

            // Connected -> Reconnecting: timer armed, no change
            const r1 = nodes.processStateChange(TEST_NODE_ID, NodeStates.Reconnecting, true);
            expect(r1.availabilityChanged).to.equal(false);
            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(true);

            // Reconnecting -> Disconnected with debounce still pending: no change
            const r2 = nodes.processStateChange(TEST_NODE_ID, NodeStates.Disconnected, true);
            expect(r2.availabilityChanged).to.equal(false);
            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(true);

            // Disconnected -> Connected: timer cleared, stays available
            const r3 = nodes.processStateChange(TEST_NODE_ID, NodeStates.Connected, false);
            expect(r3.availabilityChanged).to.equal(false);
            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(true);
        });
    });

    describe("forceUnavailable", () => {
        let nodes: Nodes;

        beforeEach(() => {
            nodes = new Nodes();
        });

        it("returns true and sets unavailable when node was available", () => {
            nodes.seedState(TEST_NODE_ID, NodeStates.Connected);
            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(true);

            const wasAvailable = nodes.forceUnavailable(TEST_NODE_ID);
            expect(wasAvailable).to.equal(true);
            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(false);
        });

        it("returns false when already unavailable", () => {
            nodes.seedState(TEST_NODE_ID, NodeStates.Disconnected);
            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(false);

            const wasAvailable = nodes.forceUnavailable(TEST_NODE_ID);
            expect(wasAvailable).to.equal(false);
        });

        it("isAvailable returns false after forceUnavailable", () => {
            nodes.seedState(TEST_NODE_ID, NodeStates.Connected);
            nodes.forceUnavailable(TEST_NODE_ID);
            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(false);
        });
    });

    describe("isAvailable caching (core bug fix)", () => {
        let nodes: Nodes;

        beforeEach(() => {
            nodes = new Nodes();
        });

        it("returns cached debounced value, not recomputed from live state", () => {
            // Seed as Connected (available)
            nodes.seedState(TEST_NODE_ID, NodeStates.Connected);
            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(true);

            // Transition to Reconnecting with debounce armed: still available
            const result = nodes.processStateChange(TEST_NODE_ID, NodeStates.Reconnecting, true);
            expect(result.availabilityChanged).to.equal(false);

            // isAvailable returns the CACHED debounced value without needing
            // to know the live debounce state.
            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(true);
        });

        it("returns false for unknown node", () => {
            expect(nodes.isAvailable(NodeId(999))).to.equal(false);
        });
    });

    describe("delete", () => {
        it("clears availability tracking", () => {
            const nodes = new Nodes();
            nodes.seedState(TEST_NODE_ID, NodeStates.Connected);
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
