/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Seconds } from "@matter/general";
import { ClientNode, ClusterBehavior, NetworkClient, NodeId, ObserverGroup, ServerNode, Timestamp } from "@matter/main";
import { BooleanState, OnOff } from "@matter/main/clusters";
import { Matter } from "@matter/main/model";
import { EndpointNumber, EventNumber } from "@matter/main/types";
import { ChangeNotificationService } from "@matter/node";
import { OnOffServer } from "@matter/node/behaviors/on-off";
import { SustainedSubscription } from "@matter/protocol";
import { AttributeChange, EventChange, PeerChangeBus } from "../src/controller/PeerChangeBus.js";
import { applyAutoSubscribe, PeerSettingsRepairMarker, repairRestoredPeers } from "../src/controller/restoredPeers.js";
import { TestSite } from "./support/ControllerSite.js";

describe("PeerChangeBus", () => {
    let site: TestSite;
    let controller: ServerNode;
    let device: ServerNode;
    let light: Awaited<ReturnType<TestSite["startPair"]>>["light"];
    let bus: PeerChangeBus;
    let attributes: Array<[NodeId, AttributeChange]>;
    let events: Array<[NodeId, EventChange]>;
    let removedEndpoints: Array<[NodeId, number]>;
    let reportingStarted: NodeId[];

    beforeEach(async () => {
        MockTime.reset();
        attributes = [];
        events = [];
        removedEndpoints = [];
        reportingStarted = [];

        site = new TestSite();
        ({ controller, device, light } = await site.startPair());

        bus = new PeerChangeBus(controller);
        bus.events.attributeChanged.on((nodeId, change) => {
            attributes.push([nodeId, change]);
        });
        bus.events.eventTriggered.on((nodeId, change) => {
            events.push([nodeId, change]);
        });
        bus.events.endpointRemoved.on((nodeId, endpointId) => {
            removedEndpoints.push([nodeId, endpointId]);
        });
        bus.events.reportingStarted.on(nodeId => {
            reportingStarted.push(nodeId);
        });
    });

    afterEach(async () => {
        bus.close();
        await site.close();
    });

    function peer(): ClientNode {
        const commissioned = controller.peers.commissioned[0];
        expect(commissioned).not.undefined;
        return commissioned;
    }

    async function awaitSubscribed() {
        const subscription = peer().behaviors.internalsOf(NetworkClient).activeSubscription;
        expect(subscription).not.undefined;
        await MockTime.resolve((subscription as SustainedSubscription).active);
    }

    /**
     * Turns the light on and resolves once the resulting report has travelled to the controller.
     * Switching on also reports `globalSceneControl`, so the wanted attribute is selected explicitly
     * rather than by report order.
     */
    async function turnLightOnAndAwaitReport() {
        const observers = new ObserverGroup();
        const reported = new Promise<[NodeId, AttributeChange]>(resolve => {
            observers.on(bus.events.attributeChanged, (nodeId, change) => {
                if (
                    change.path.clusterId === OnOff.Cluster.id &&
                    change.path.attributeId === OnOff.Cluster.attributes.onOff.id
                ) {
                    resolve([nodeId, change]);
                }
            });
        });
        try {
            await light.act(agent => agent.get(OnOffServer).on());
            return await MockTime.resolve(reported, { macrotasks: true });
        } finally {
            observers.close();
        }
    }

    it("reports nothing for the seeding read that commissioning triggers", async () => {
        await site.commission(controller, device);

        expect(attributes.length).equals(0);
        expect(events.length).equals(0);
    });

    it("routes a peer's attribute change to that peer's node id once subscribed", async () => {
        await site.commission(controller, device);
        await awaitSubscribed();
        attributes.length = 0;

        const [nodeId, change] = await turnLightOnAndAwaitReport();

        expect(nodeId).equals(peer().peerAddress?.nodeId);
        expect(change.path.endpointId).equals(light.number);
        expect(change.path.attributeId).equals(OnOff.Cluster.attributes.onOff.id);
        expect(change.value).equals(true);
    });

    it("ignores changes on the controller's own endpoints", async () => {
        await site.commission(controller, device);
        await awaitSubscribed();
        attributes.length = 0;

        await controller.set({ basicInformation: { nodeLabel: "renamed" } });

        // The peer report is a barrier: once it has arrived, any controller-owned change would have too.
        await turnLightOnAndAwaitReport();

        const peerNodeId = peer().peerAddress?.nodeId;
        expect(attributes.length).greaterThan(0);
        expect(attributes.every(([nodeId]) => nodeId === peerNodeId)).true;
    });

    it("reports an event from a peer with the path the wire format needs", async () => {
        await site.commission(controller, device);
        await awaitSubscribed();

        const reported = new Promise<[NodeId, EventChange]>(resolve => {
            bus.events.eventTriggered.on((nodeId, change) => {
                if (change.path.clusterId === BooleanState.Cluster.id) {
                    resolve([nodeId, change]);
                }
            });
        });
        await light.set({ booleanState: { stateValue: true } });

        const [nodeId, change] = await MockTime.resolve(reported, { macrotasks: true });
        expect(nodeId).equals(peer().peerAddress?.nodeId);
        expect(change.path.endpointId).equals(light.number);
        expect(change.path.eventId).equals(BooleanState.Cluster.events.stateChange.id);
        expect(change.events.length).equals(1);
        expect(change.events[0].eventNumber).not.undefined;
        expect(change.events[0].epochTimestamp).not.undefined;
        expect(change.events[0].data).deep.equals({ stateValue: true });
    });

    it("resolves a delta event timestamp against an event from before reporting started", async () => {
        await site.commission(controller, device);
        expect(bus.isReporting(peer())).equals(false);
        const endpoint = peer().endpoints.for(EndpointNumber(light.number));
        const behavior = endpoint.behaviors.supported.booleanState;
        expect(ClusterBehavior.is(behavior)).equals(true);
        const event = Matter.clusters(BooleanState.Cluster.id)?.events(BooleanState.Cluster.events.stateChange.id);
        expect(event).not.undefined;
        if (behavior === undefined || event === undefined) {
            return;
        }
        const notifications = controller.env.get(ChangeNotificationService);
        const broadcast = (number: number, timestamp: number, timestampKind: "system" | "system-delta") =>
            notifications.broadcastEvent(endpoint, behavior, event, {
                number: EventNumber(number),
                timestamp: Timestamp(timestamp),
                timestampKind,
                priority: 1,
                payload: { stateValue: true },
            });

        broadcast(100, 5_000, "system");
        await awaitSubscribed();
        events.length = 0;
        broadcast(101, 4, "system-delta");

        expect(events.map(([, change]) => change.events[0].systemTimestamp)).deep.equals([5_004]);
    });

    it("reports one endpoint going away without latching the whole peer as torn down", async () => {
        await site.commission(controller, device);
        await awaitSubscribed();
        const endpointId = EndpointNumber(light.number);
        expect(peer().endpoints.has(endpointId)).equals(true);
        removedEndpoints.length = 0;

        // `lifecycle.changed` bubbles, so a child endpoint going away reaches the peer's own observer.
        // Treating that as the peer tearing down swallows this removal and every later one.
        await MockTime.resolve(peer().endpoints.for(endpointId).close(), { macrotasks: true });

        expect(removedEndpoints.map(([, removed]) => removed)).deep.equals([light.number]);
    });

    it("announces once that a peer's changes are forwarded, not again when it resubscribes", async () => {
        await site.commission(controller, device);
        await awaitSubscribed();
        expect(reportingStarted).deep.equals([peer().peerAddress?.nodeId]);

        const observers = new ObserverGroup();
        const statuses = new Array<boolean>();
        const resubscribed = new Promise<void>(resolve =>
            observers.on(peer().eventsOf(NetworkClient).subscriptionStatusChanged, isActive => {
                statuses.push(isActive);
                if (isActive) {
                    resolve();
                }
            }),
        );
        try {
            await MockTime.resolve(peer().set({ network: { autoSubscribe: false } }), { macrotasks: true });
            await MockTime.resolve(peer().set({ network: { autoSubscribe: true } }), { macrotasks: true });
            await MockTime.resolve(resubscribed, { macrotasks: true });
        } finally {
            observers.close();
        }
        expect(statuses).include(false);
        await turnLightOnAndAwaitReport();

        expect(reportingStarted.length).equals(1);
    });

    it("does not announce reporting for a peer already connected when it is watched", async () => {
        await site.commission(controller, device);
        await awaitSubscribed();
        const lateBus = new PeerChangeBus(controller);
        const announced = new Array<NodeId>();
        lateBus.events.reportingStarted.on(nodeId => {
            announced.push(nodeId);
        });
        try {
            await turnLightOnAndAwaitReport();
            expect(announced).deep.equals([]);
        } finally {
            lateBus.close();
        }
    });

    it("does not report a removed node's endpoints as individual endpoint removals", async () => {
        await site.commission(controller, device);
        await awaitSubscribed();
        removedEndpoints.length = 0;

        await MockTime.resolve(peer().close(), { macrotasks: true });

        expect(removedEndpoints).deep.equals([]);
    });
});

describe("repairRestoredPeers", () => {
    let site: TestSite;
    let controller: ServerNode;
    let device: ServerNode;
    let marker: PeerSettingsRepairMarker & { repaired: string[]; markedFor: string[] };

    beforeEach(async () => {
        MockTime.reset();
        site = new TestSite();
        ({ controller, device } = await site.startPair());
        marker = {
            repaired: new Array<string>(),
            markedFor: new Array<string>(),
            hasRepairedPeerSettings(scope: string) {
                return this.repaired.includes(scope);
            },
            async markPeerSettingsRepaired(scope: string) {
                this.repaired.push(scope);
                this.markedFor.push(scope);
            },
        };
        await site.commission(controller, device);
    });

    afterEach(async () => {
        await site.close();
    });

    function peer(): ClientNode {
        const commissioned = controller.peers.commissioned[0];
        expect(commissioned).not.undefined;
        return commissioned;
    }

    it("re-enables a peer stored disabled and unsubscribed by an earlier version", async () => {
        await peer().set({ network: { autoSubscribe: false, isDisabled: true } });

        expect(await repairRestoredPeers(controller, "scope", marker)).equals(1);

        expect(peer().stateOf(NetworkClient).autoSubscribe).equals(true);
        expect(peer().stateOf(NetworkClient).isDisabled).equals(false);
        expect(marker.markedFor).deep.equals(["scope"]);
    });

    it("subscribes a peer that was stored enabled but unsubscribed", async () => {
        await peer().set({ network: { autoSubscribe: false } });

        expect(await repairRestoredPeers(controller, "scope", marker)).equals(1);

        expect(peer().stateOf(NetworkClient).autoSubscribe).equals(true);
    });

    it("clears subscription parameters pinned by an earlier version", async () => {
        await peer().set({ network: { defaultSubscription: { minIntervalFloor: Seconds(5) } } });

        expect(await repairRestoredPeers(controller, "scope", marker)).equals(1);

        expect(peer().stateOf(NetworkClient).defaultSubscription).equals(undefined);
    });

    it("leaves a peer stored by the current version alone", async () => {
        expect(await repairRestoredPeers(controller, "scope", marker)).equals(0);
        expect(marker.markedFor).deep.equals(["scope"]);
    });

    it("remembers every scope it repaired, so switching back does not repeat one", async () => {
        await peer().set({ network: { autoSubscribe: false, isDisabled: true } });

        expect(await repairRestoredPeers(controller, "scope-a", marker)).equals(1);
        await repairRestoredPeers(controller, "scope-b", marker);

        // Back to the first scope: a single-slot marker would have forgotten it and repaired again,
        // overwriting whatever the peer was set to since.
        await peer().set({ network: { isDisabled: true } });
        expect(await repairRestoredPeers(controller, "scope-a", marker)).equals(0);
        expect(peer().stateOf(NetworkClient).isDisabled).equals(true);
    });

    it("leaves a peer that is not commissioned alone", async () => {
        const uncommissioned = await controller.peers.forDescriptor({
            addresses: [{ type: "udp", ip: "10.10.10.99", port: 5540 }],
        });
        await uncommissioned.set({ network: { autoSubscribe: false } });

        expect(await repairRestoredPeers(controller, "scope", marker)).equals(0);

        expect(uncommissioned.stateOf(NetworkClient).autoSubscribe).equals(false);
    });

    it("does not run again for a scope it already repaired", async () => {
        await peer().set({ network: { autoSubscribe: false, isDisabled: true } });
        marker.repaired.push("scope");

        expect(await repairRestoredPeers(controller, "scope", marker)).equals(0);

        expect(peer().stateOf(NetworkClient).autoSubscribe).equals(false);
        expect(peer().stateOf(NetworkClient).isDisabled).equals(true);
        expect(marker.markedFor).deep.equals([]);
    });
});

describe("applyAutoSubscribe", () => {
    let site: TestSite;
    let controller: ServerNode;

    beforeEach(async () => {
        MockTime.reset();
        site = new TestSite();
        let device: ServerNode;
        ({ controller, device } = await site.startPair());
        await site.commission(controller, device);
    });

    afterEach(async () => {
        await site.close();
    });

    it("rewrites only the peers whose setting differs, and counts them", async () => {
        const [peer] = controller.peers.commissioned;
        expect(peer.stateOf(NetworkClient).autoSubscribe).equals(true);

        expect(await applyAutoSubscribe(controller, false)).equals(1);
        expect(peer.stateOf(NetworkClient).autoSubscribe).equals(false);

        expect(await applyAutoSubscribe(controller, false)).equals(0);
        expect(await applyAutoSubscribe(controller, true)).equals(1);
        expect(peer.stateOf(NetworkClient).autoSubscribe).equals(true);
    });

    it("leaves a peer that is not commissioned alone", async () => {
        const uncommissioned = await controller.peers.forDescriptor({
            addresses: [{ type: "udp", ip: "10.10.10.99", port: 5540 }],
        });
        await uncommissioned.set({ network: { autoSubscribe: true } });

        expect(await applyAutoSubscribe(controller, false)).equals(1);

        expect(uncommissioned.stateOf(NetworkClient).autoSubscribe).equals(true);
    });
});
