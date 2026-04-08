/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeId } from "@matter/main";
import { NodeStates } from "@project-chip/matter.js/device";
import { Nodes } from "../src/controller/Nodes.js";

const TEST_NODE_ID = NodeId(1);

describe("Nodes", () => {
    describe("isNodeAvailable", () => {
        let nodes: Nodes;

        beforeEach(() => {
            nodes = new Nodes();
        });

        it("should return true when Connected", () => {
            expect(nodes.isNodeAvailable(NodeStates.Connected)).to.equal(true);
        });

        it("should return true when Reconnecting from Connected (debounce)", () => {
            expect(nodes.isNodeAvailable(NodeStates.Reconnecting, NodeStates.Connected)).to.equal(true);
        });

        it("should return false when Reconnecting from non-Connected state", () => {
            expect(nodes.isNodeAvailable(NodeStates.Reconnecting, NodeStates.WaitingForDeviceDiscovery)).to.equal(
                false,
            );
        });

        it("should return false when Reconnecting with no previous state", () => {
            expect(nodes.isNodeAvailable(NodeStates.Reconnecting)).to.equal(false);
        });

        it("should return false when Disconnected", () => {
            expect(nodes.isNodeAvailable(NodeStates.Disconnected)).to.equal(false);
        });

        it("should return false when Disconnected even if previously Connected", () => {
            expect(nodes.isNodeAvailable(NodeStates.Disconnected, NodeStates.Connected)).to.equal(false);
        });

        it("should return false when WaitingForDeviceDiscovery", () => {
            expect(nodes.isNodeAvailable(NodeStates.WaitingForDeviceDiscovery)).to.equal(false);
        });
    });

    describe("processStateChange", () => {
        let nodes: Nodes;

        beforeEach(() => {
            nodes = new Nodes();
        });

        it("should emit availability changed when Connected node transitions to Disconnected", () => {
            // Seed as Connected (available)
            nodes.seedState(TEST_NODE_ID, NodeStates.Connected);

            // Transition to Disconnected
            const result = nodes.processStateChange(TEST_NODE_ID, NodeStates.Disconnected);

            expect(result.availabilityChanged).to.equal(true);
            if (result.availabilityChanged) {
                expect(result.available).to.equal(false);
            }
        });

        it("should emit availability changed when Connected node transitions to WaitingForDeviceDiscovery", () => {
            nodes.seedState(TEST_NODE_ID, NodeStates.Connected);

            const result = nodes.processStateChange(TEST_NODE_ID, NodeStates.WaitingForDeviceDiscovery);

            expect(result.availabilityChanged).to.equal(true);
            if (result.availabilityChanged) {
                expect(result.available).to.equal(false);
            }
        });

        it("should emit availability changed when Disconnected node transitions to Connected", () => {
            nodes.seedState(TEST_NODE_ID, NodeStates.Disconnected);

            const result = nodes.processStateChange(TEST_NODE_ID, NodeStates.Connected);

            expect(result.availabilityChanged).to.equal(true);
            if (result.availabilityChanged) {
                expect(result.available).to.equal(true);
            }
        });

        it("should not emit availability changed when Connected node transitions to Reconnecting (debounce)", () => {
            nodes.seedState(TEST_NODE_ID, NodeStates.Connected);

            const result = nodes.processStateChange(TEST_NODE_ID, NodeStates.Reconnecting);

            expect(result.availabilityChanged).to.equal(false);
        });

        it("should not emit availability changed when already unavailable node transitions between unavailable states", () => {
            nodes.seedState(TEST_NODE_ID, NodeStates.Disconnected);

            const result = nodes.processStateChange(TEST_NODE_ID, NodeStates.WaitingForDeviceDiscovery);

            expect(result.availabilityChanged).to.equal(false);
        });

        it("should track state across multiple transitions (Connected -> Reconnecting -> Disconnected)", () => {
            nodes.seedState(TEST_NODE_ID, NodeStates.Connected);

            // Connected -> Reconnecting: still available (debounce)
            const result1 = nodes.processStateChange(TEST_NODE_ID, NodeStates.Reconnecting);
            expect(result1.availabilityChanged).to.equal(false);

            // Reconnecting -> Disconnected: now unavailable
            const result2 = nodes.processStateChange(TEST_NODE_ID, NodeStates.Disconnected);
            expect(result2.availabilityChanged).to.equal(true);
            if (result2.availabilityChanged) {
                expect(result2.available).to.equal(false);
            }
        });

        it("should handle full lifecycle: Connected -> Reconnecting -> Disconnected -> Connected", () => {
            nodes.seedState(TEST_NODE_ID, NodeStates.Connected);

            // Connected -> Reconnecting (debounce, still available)
            expect(nodes.processStateChange(TEST_NODE_ID, NodeStates.Reconnecting).availabilityChanged).to.equal(false);

            // Reconnecting -> Disconnected (becomes unavailable)
            const goOffline = nodes.processStateChange(TEST_NODE_ID, NodeStates.Disconnected);
            expect(goOffline.availabilityChanged).to.equal(true);
            if (goOffline.availabilityChanged) {
                expect(goOffline.available).to.equal(false);
            }

            // Disconnected -> Connected (becomes available again)
            const goOnline = nodes.processStateChange(TEST_NODE_ID, NodeStates.Connected);
            expect(goOnline.availabilityChanged).to.equal(true);
            if (goOnline.availabilityChanged) {
                expect(goOnline.available).to.equal(true);
            }
        });
    });
});
