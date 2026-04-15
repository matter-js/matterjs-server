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

        it("returns true when Connected", () => {
            expect(nodes.isNodeAvailable(NodeStates.Connected)).to.equal(true);
        });

        it("returns true when Reconnecting from Connected (debounce)", () => {
            expect(nodes.isNodeAvailable(NodeStates.Reconnecting, NodeStates.Connected)).to.equal(true);
        });

        it("returns false when Reconnecting from WaitingForDeviceDiscovery", () => {
            expect(nodes.isNodeAvailable(NodeStates.Reconnecting, NodeStates.WaitingForDeviceDiscovery)).to.equal(
                false,
            );
        });

        it("returns false when Reconnecting with no previous state", () => {
            expect(nodes.isNodeAvailable(NodeStates.Reconnecting)).to.equal(false);
        });

        it("returns false when Disconnected", () => {
            expect(nodes.isNodeAvailable(NodeStates.Disconnected)).to.equal(false);
        });

        it("returns false when Disconnected even if previously Connected", () => {
            expect(nodes.isNodeAvailable(NodeStates.Disconnected, NodeStates.Connected)).to.equal(false);
        });

        it("returns false when WaitingForDeviceDiscovery", () => {
            expect(nodes.isNodeAvailable(NodeStates.WaitingForDeviceDiscovery)).to.equal(false);
        });
    });

    describe("processStateChange", () => {
        let nodes: Nodes;

        beforeEach(() => {
            nodes = new Nodes();
        });

        it("reports unavailable when Connected -> Disconnected", () => {
            nodes.seedState(TEST_NODE_ID, NodeStates.Connected);
            const result = nodes.processStateChange(TEST_NODE_ID, NodeStates.Disconnected);
            expect(result.availabilityChanged).to.equal(true);
            if (result.availabilityChanged) {
                expect(result.available).to.equal(false);
            }
        });

        it("reports unavailable when Connected -> WaitingForDeviceDiscovery", () => {
            nodes.seedState(TEST_NODE_ID, NodeStates.Connected);
            const result = nodes.processStateChange(TEST_NODE_ID, NodeStates.WaitingForDeviceDiscovery);
            expect(result.availabilityChanged).to.equal(true);
            if (result.availabilityChanged) {
                expect(result.available).to.equal(false);
            }
        });

        it("reports available when Disconnected -> Connected", () => {
            nodes.seedState(TEST_NODE_ID, NodeStates.Disconnected);
            const result = nodes.processStateChange(TEST_NODE_ID, NodeStates.Connected);
            expect(result.availabilityChanged).to.equal(true);
            if (result.availabilityChanged) {
                expect(result.available).to.equal(true);
            }
        });

        it("does NOT report change when Connected -> Reconnecting (debounce)", () => {
            nodes.seedState(TEST_NODE_ID, NodeStates.Connected);
            const result = nodes.processStateChange(TEST_NODE_ID, NodeStates.Reconnecting);
            expect(result.availabilityChanged).to.equal(false);
        });

        it("does NOT report change when unavailable -> another unavailable", () => {
            nodes.seedState(TEST_NODE_ID, NodeStates.Disconnected);
            const result = nodes.processStateChange(TEST_NODE_ID, NodeStates.WaitingForDeviceDiscovery);
            expect(result.availabilityChanged).to.equal(false);
        });

        it("reports available on Connected for unseeded node", () => {
            const result = nodes.processStateChange(TEST_NODE_ID, NodeStates.Connected);
            expect(result.availabilityChanged).to.equal(true);
            if (result.availabilityChanged) {
                expect(result.available).to.equal(true);
            }
        });

        it("handles full lifecycle: Connected -> Reconnecting -> Disconnected -> Connected", () => {
            nodes.seedState(TEST_NODE_ID, NodeStates.Connected);

            // Connected -> Reconnecting: debounced, still available, no change
            const r1 = nodes.processStateChange(TEST_NODE_ID, NodeStates.Reconnecting);
            expect(r1.availabilityChanged).to.equal(false);
            expect(nodes.isAvailable(TEST_NODE_ID)).to.equal(true);

            // Reconnecting -> Disconnected: now unavailable
            const r2 = nodes.processStateChange(TEST_NODE_ID, NodeStates.Disconnected);
            expect(r2.availabilityChanged).to.equal(true);
            if (r2.availabilityChanged) {
                expect(r2.available).to.equal(false);
            }

            // Disconnected -> Connected: available again
            const r3 = nodes.processStateChange(TEST_NODE_ID, NodeStates.Connected);
            expect(r3.availabilityChanged).to.equal(true);
            if (r3.availabilityChanged) {
                expect(r3.available).to.equal(true);
            }
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

            // Transition to Reconnecting - debounced, still available
            const result = nodes.processStateChange(TEST_NODE_ID, NodeStates.Reconnecting);
            expect(result.availabilityChanged).to.equal(false);

            // The core bug fix: isAvailable returns the CACHED value (true)
            // rather than recomputing from live state (Reconnecting without
            // previous-state context would give false)
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
    });
});
