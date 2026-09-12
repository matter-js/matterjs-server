/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Seconds } from "@matter/general";
import { ClientNode, NetworkClient, NodeId, ObserverGroup, ServerNode } from "@matter/main";
import { BooleanState, OnOff } from "@matter/main/clusters";
import { OnOffServer } from "@matter/node/behaviors/on-off";
import { SustainedSubscription } from "@matter/protocol";
import { AttributeChange, EventChange, PeerChangeBus } from "../src/controller/PeerChangeBus.js";
import { repairRestoredPeers } from "../src/controller/restoredPeers.js";
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

    beforeEach(async () => {
        MockTime.reset();
        attributes = [];
        events = [];
        removedEndpoints = [];

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
    let marker: {
        peerSettingsRepairedFor: string | undefined;
        markedFor: string[];
        markPeerSettingsRepaired(scope: string): Promise<void>;
    };

    beforeEach(async () => {
        MockTime.reset();
        site = new TestSite();
        ({ controller, device } = await site.startPair());
        marker = {
            peerSettingsRepairedFor: undefined,
            markedFor: new Array<string>(),
            async markPeerSettingsRepaired(scope: string) {
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

    it("does not run again for a scope it already repaired", async () => {
        await peer().set({ network: { autoSubscribe: false, isDisabled: true } });
        marker.peerSettingsRepairedFor = "scope";

        expect(await repairRestoredPeers(controller, "scope", marker)).equals(0);

        expect(peer().stateOf(NetworkClient).autoSubscribe).equals(false);
        expect(peer().stateOf(NetworkClient).isDisabled).equals(true);
        expect(marker.markedFor).deep.equals([]);
    });
});
