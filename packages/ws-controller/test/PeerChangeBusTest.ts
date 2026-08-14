/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    Crypto,
    Entropy,
    Environment,
    MemoryStorageDriver,
    MockCrypto,
    MockStorageService,
    Network,
    NetworkSimulator,
    Seconds,
} from "@matter/general";
import { ClientNode, ControllerBehavior, NetworkClient, NodeId, ObserverGroup, ServerNode } from "@matter/main";
import { BooleanState, OnOff } from "@matter/main/clusters";
import { BooleanStateServer } from "@matter/node/behaviors/boolean-state";
import { OnOffServer } from "@matter/node/behaviors/on-off";
import { OnOffLightDevice } from "@matter/node/devices/on-off-light";
import { SustainedSubscription } from "@matter/protocol";
import { FabricId } from "@matter/types";
import { prepareNodeForConnect } from "../src/controller/ControllerCommandHandler.js";
import { AttributeChange, EventChange, PeerChangeBus } from "../src/controller/PeerChangeBus.js";

const ControllerRootEndpoint = ServerNode.RootEndpoint.with(ControllerBehavior);

/**
 * A controller and a light on one simulated network, so the bus runs against a real peer endpoint tree
 * rather than synthesised change records. Commissioning is a separate step so a test can observe the
 * seeding read it triggers.
 */
class TestSite {
    #simulator = new NetworkSimulator();
    #nodes = new Set<ServerNode>();
    #storage: Record<string, Record<string, any>> = {};
    #nextIndex = 1;

    async #addNode(config: Record<string, any>) {
        const index = this.#nextIndex++;
        const { id } = config;
        const env = new Environment(id);
        const crypto = MockCrypto(index);
        env.set(Entropy, crypto);
        env.set(Crypto, crypto);
        env.set(Network, this.#simulator.addHost(index));
        this.#storage[id] ??= {};
        new MockStorageService(env, () => new MemoryStorageDriver(this.#storage[id]));

        const node = new ServerNode({ ...config, environment: env });
        this.#nodes.add(node);
        return node;
    }

    async startPair() {
        const controller = await this.#addNode({
            id: "controller",
            type: ControllerRootEndpoint,
            commissioning: { enabled: false },
            controller: { adminFabricId: FabricId(1) },
        });
        const device = await this.#addNode({ id: "device" });
        const light = await device.add(OnOffLightDevice.with(BooleanStateServer), { id: "light" });

        await device.start();
        await controller.start();

        return { controller, device, light };
    }

    async commission(controller: ServerNode, device: ServerNode) {
        // Session ids collide without entropy while pairing.
        const controllerCrypto = controller.env.get(Crypto) as MockCrypto;
        const deviceCrypto = device.env.get(Crypto) as MockCrypto;
        controllerCrypto.entropic = deviceCrypto.entropic = true;
        try {
            const { passcode, discriminator } = device.state.commissioning;
            await MockTime.resolve(controller.peers.commission({ passcode, discriminator, timeout: Seconds(90) }), {
                macrotasks: true,
            });
        } finally {
            controllerCrypto.entropic = deviceCrypto.entropic = false;
        }
    }

    async close() {
        await MockTime.resolve(Promise.allSettled([...this.#nodes].map(node => node.close())), { macrotasks: true });
    }
}

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

    // CommissioningController turns autoSubscribe off for every restored peer on each start, so a
    // node coming back from storage subscribes only if this is put back. Without it the peer never
    // reports, never reaches Connected, and nothing is forwarded.
    it("re-enables subscriptions for a peer whose autoSubscribe was cleared", async () => {
        await site.commission(controller, device);
        await awaitSubscribed();

        await peer().set({ network: { autoSubscribe: false } });
        expect(peer().stateOf(NetworkClient).autoSubscribe).equals(false);

        await prepareNodeForConnect(peer());

        expect(peer().stateOf(NetworkClient).autoSubscribe).equals(true);
    });
});
