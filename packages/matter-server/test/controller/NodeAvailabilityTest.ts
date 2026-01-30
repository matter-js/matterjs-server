/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { isNodeAvailable } from "@matter-server/ws-controller";
import { NodeStates } from "@project-chip/matter.js/device";

/**
 * Tests for node availability determination with debouncing logic.
 *
 * The availability logic matches Python Matter Server behavior:
 * - Connected: always available
 * - Reconnecting from Connected: still available (debouncing)
 * - Reconnecting from other states: unavailable
 * - WaitingForDeviceDiscovery: unavailable
 * - Disconnected: unavailable
 */
describe("Node Availability", function () {
    describe("isNodeAvailable", function () {
        describe("Connected state", function () {
            it("should be available when Connected (no previous state)", function () {
                expect(isNodeAvailable(NodeStates.Connected, undefined)).to.be.true;
            });

            it("should be available when Connected from Disconnected", function () {
                expect(isNodeAvailable(NodeStates.Connected, NodeStates.Disconnected)).to.be.true;
            });

            it("should be available when Connected from Reconnecting", function () {
                expect(isNodeAvailable(NodeStates.Connected, NodeStates.Reconnecting)).to.be.true;
            });

            it("should be available when Connected from WaitingForDeviceDiscovery", function () {
                expect(isNodeAvailable(NodeStates.Connected, NodeStates.WaitingForDeviceDiscovery)).to.be.true;
            });
        });

        describe("Reconnecting state (debouncing)", function () {
            it("should be available when Reconnecting from Connected (debouncing)", function () {
                // This is the key debouncing behavior - when transitioning from Connected
                // to Reconnecting, we still report as available to avoid flapping
                expect(isNodeAvailable(NodeStates.Reconnecting, NodeStates.Connected)).to.be.true;
            });

            it("should NOT be available when Reconnecting from Disconnected", function () {
                expect(isNodeAvailable(NodeStates.Reconnecting, NodeStates.Disconnected)).to.be.false;
            });

            it("should NOT be available when Reconnecting from WaitingForDeviceDiscovery", function () {
                expect(isNodeAvailable(NodeStates.Reconnecting, NodeStates.WaitingForDeviceDiscovery)).to.be.false;
            });

            it("should NOT be available when Reconnecting with no previous state", function () {
                expect(isNodeAvailable(NodeStates.Reconnecting, undefined)).to.be.false;
            });

            it("should NOT be available when Reconnecting from Reconnecting", function () {
                // If we were already reconnecting (and thus unavailable), stay unavailable
                expect(isNodeAvailable(NodeStates.Reconnecting, NodeStates.Reconnecting)).to.be.false;
            });
        });

        describe("WaitingForDeviceDiscovery state", function () {
            it("should NOT be available when WaitingForDeviceDiscovery (no previous state)", function () {
                expect(isNodeAvailable(NodeStates.WaitingForDeviceDiscovery, undefined)).to.be.false;
            });

            it("should NOT be available when WaitingForDeviceDiscovery from Connected", function () {
                expect(isNodeAvailable(NodeStates.WaitingForDeviceDiscovery, NodeStates.Connected)).to.be.false;
            });

            it("should NOT be available when WaitingForDeviceDiscovery from Reconnecting", function () {
                expect(isNodeAvailable(NodeStates.WaitingForDeviceDiscovery, NodeStates.Reconnecting)).to.be.false;
            });
        });

        describe("Disconnected state", function () {
            it("should NOT be available when Disconnected (no previous state)", function () {
                expect(isNodeAvailable(NodeStates.Disconnected, undefined)).to.be.false;
            });

            it("should NOT be available when Disconnected from Connected", function () {
                expect(isNodeAvailable(NodeStates.Disconnected, NodeStates.Connected)).to.be.false;
            });

            it("should NOT be available when Disconnected from Reconnecting", function () {
                expect(isNodeAvailable(NodeStates.Disconnected, NodeStates.Reconnecting)).to.be.false;
            });
        });

        describe("State transition scenarios", function () {
            it("should handle typical reconnection cycle: Connected -> Reconnecting -> Connected", function () {
                // Initial connected state
                expect(isNodeAvailable(NodeStates.Connected, undefined)).to.be.true;

                // Subscription times out, start reconnecting - should STILL be available (debouncing)
                expect(isNodeAvailable(NodeStates.Reconnecting, NodeStates.Connected)).to.be.true;

                // Successfully reconnected
                expect(isNodeAvailable(NodeStates.Connected, NodeStates.Reconnecting)).to.be.true;
            });

            it("should handle failed reconnection: Connected -> Reconnecting -> WaitingForDeviceDiscovery", function () {
                // Initial connected state
                expect(isNodeAvailable(NodeStates.Connected, undefined)).to.be.true;

                // Subscription times out, start reconnecting - still available
                expect(isNodeAvailable(NodeStates.Reconnecting, NodeStates.Connected)).to.be.true;

                // Reconnection failed, now waiting for mDNS discovery - NOW unavailable
                expect(isNodeAvailable(NodeStates.WaitingForDeviceDiscovery, NodeStates.Reconnecting)).to.be.false;
            });

            it("should handle initial connection: Disconnected -> Reconnecting -> Connected", function () {
                // Initially disconnected (e.g., after server startup)
                expect(isNodeAvailable(NodeStates.Disconnected, undefined)).to.be.false;

                // Start trying to connect - not available yet
                expect(isNodeAvailable(NodeStates.Reconnecting, NodeStates.Disconnected)).to.be.false;

                // Successfully connected
                expect(isNodeAvailable(NodeStates.Connected, NodeStates.Reconnecting)).to.be.true;
            });

            it("should handle device power cycle: Connected -> Reconnecting -> WaitingForDeviceDiscovery -> Connected", function () {
                // Device was connected
                expect(isNodeAvailable(NodeStates.Connected, undefined)).to.be.true;

                // Device powered off, subscription times out - still available (debouncing)
                expect(isNodeAvailable(NodeStates.Reconnecting, NodeStates.Connected)).to.be.true;

                // Extended offline, now waiting for discovery - unavailable
                expect(isNodeAvailable(NodeStates.WaitingForDeviceDiscovery, NodeStates.Reconnecting)).to.be.false;

                // Device powered back on and discovered
                expect(isNodeAvailable(NodeStates.Connected, NodeStates.WaitingForDeviceDiscovery)).to.be.true;
            });
        });
    });
});
