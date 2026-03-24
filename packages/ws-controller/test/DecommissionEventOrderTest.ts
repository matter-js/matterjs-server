/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeId, Observable } from "@matter/main";
import type { DecodedEventReportValue } from "@matter/main/protocol";
import type { EventId, EventPriority } from "@matter/main/types";

/**
 * Tests for the decommission event ordering fix (matter-js/matterjs-server#75).
 *
 * When another controller removes a node from the fabric, matter.js's PairedNode
 * processes the BasicInformation Leave event and emits events in this synchronous
 * order:
 *   1. decommissioned (via _triggerEventUpdate → Peers.#onLeave → lifecycle.decommissioned)
 *   2. eventTriggered  (the Leave event itself, emitted after _triggerEventUpdate)
 *
 * ControllerCommandHandler must relay these so that WebSocket clients receive
 * the Leave node_event BEFORE node_removed.  It achieves this by deferring the
 * nodeDecommissioned emission via queueMicrotask().
 *
 * These tests exercise that deferral pattern in isolation, without requiring a
 * full CommissioningController / PairedNode stack.
 */
describe("Decommission event ordering", () => {
    /**
     * Simulates the ControllerCommandHandler event wiring and the PairedNode
     * firing pattern for a decommission triggered by an external controller.
     */
    it("should emit eventChanged before nodeDecommissioned when both fire synchronously", async () => {
        // --- Simulated PairedNode events (source) ---
        const nodeEvents = {
            decommissioned: new Observable<[void]>(),
            eventTriggered: new Observable<[DecodedEventReportValue<any>]>(),
        };

        // --- Simulated ControllerCommandHandler events (sink) ---
        const handlerEvents = {
            eventChanged: new Observable<[nodeId: NodeId, data: DecodedEventReportValue<any>]>(),
            nodeDecommissioned: new Observable<[nodeId: NodeId]>(),
        };

        const nodeId = NodeId(1);

        // Wire up listeners the same way ControllerCommandHandler does:
        // eventTriggered → eventChanged (synchronous relay)
        nodeEvents.eventTriggered.on(data => handlerEvents.eventChanged.emit(nodeId, data));

        // decommissioned → nodeDecommissioned (deferred via microtask)
        nodeEvents.decommissioned.on(() => {
            queueMicrotask(() => handlerEvents.nodeDecommissioned.emit(nodeId));
        });

        // Track the order in which a WebSocket client would receive events
        const received: string[] = [];
        handlerEvents.eventChanged.on(() => {
            received.push("node_event");
        });
        handlerEvents.nodeDecommissioned.on(() => {
            received.push("node_removed");
        });

        // --- Simulate PairedNode's processing of a Leave event ---
        // In PairedNode, _triggerEventUpdate fires first (leading to decommissioned),
        // then eventTriggered fires synchronously after.
        nodeEvents.decommissioned.emit();
        nodeEvents.eventTriggered.emit({
            path: {
                endpointId: 0,
                clusterId: 0x28, // BasicInformation
                eventId: 3 as EventId, // Leave
                eventName: "leave",
            },
            events: [
                {
                    eventNumber: 1,
                    epochTimestamp: Date.now(),
                    priority: 2 as EventPriority,
                    data: { fabricIndex: 1 },
                },
            ],
        } as unknown as DecodedEventReportValue<any>);

        // At this point, eventChanged has fired synchronously but nodeDecommissioned
        // is still pending in the microtask queue.
        expect(received).to.deep.equal(["node_event"]);

        // Flush the microtask queue
        await new Promise<void>(resolve => queueMicrotask(resolve));

        // Now nodeDecommissioned should have fired, AFTER eventChanged
        expect(received).to.deep.equal(["node_event", "node_removed"]);
    });

    it("should emit nodeDecommissioned even when no Leave event fires (offline removal)", async () => {
        const nodeEvents = {
            decommissioned: new Observable<[void]>(),
            eventTriggered: new Observable<[DecodedEventReportValue<any>]>(),
        };

        const handlerEvents = {
            eventChanged: new Observable<[nodeId: NodeId, data: DecodedEventReportValue<any>]>(),
            nodeDecommissioned: new Observable<[nodeId: NodeId]>(),
        };

        const nodeId = NodeId(1);

        nodeEvents.eventTriggered.on(data => handlerEvents.eventChanged.emit(nodeId, data));
        nodeEvents.decommissioned.on(() => {
            queueMicrotask(() => handlerEvents.nodeDecommissioned.emit(nodeId));
        });

        const received: string[] = [];
        handlerEvents.eventChanged.on(() => {
            received.push("node_event");
        });
        handlerEvents.nodeDecommissioned.on(() => {
            received.push("node_removed");
        });

        // Only decommissioned fires — no Leave event (device is offline)
        nodeEvents.decommissioned.emit();

        expect(received).to.deep.equal([]);

        await new Promise<void>(resolve => queueMicrotask(resolve));

        // Only node_removed should be received
        expect(received).to.deep.equal(["node_removed"]);
    });

    it("should not crash when nodeDecommissioned listener throws", async () => {
        const decommissioned = new Observable<[void]>();
        const nodeDecommissioned = new Observable<[nodeId: NodeId]>();

        const nodeId = NodeId(1);
        let errorCaught = false;

        decommissioned.on(() => {
            queueMicrotask(() => {
                try {
                    nodeDecommissioned.emit(nodeId);
                } catch {
                    errorCaught = true;
                }
            });
        });

        // Register a listener that throws
        nodeDecommissioned.on(() => {
            throw new Error("listener error");
        });

        decommissioned.emit();
        await new Promise<void>(resolve => queueMicrotask(resolve));

        expect(errorCaught).to.equal(true);
    });
});
