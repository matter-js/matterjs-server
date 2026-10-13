/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ClientNode,
    FabricId,
    NetworkClient,
    NodeConnectionState,
    NodeId,
    ObserverGroup,
    ServerNode,
} from "@matter/main";
import { OnOff } from "@matter/main/clusters";
import { Endpoint } from "@matter/node";
import { FabricAuthority, FabricManager, SustainedSubscription } from "@matter/protocol";
import { AttributeDataCache } from "../src/controller/AttributeDataCache.js";
import { CameraControllerEndpoint, ControllerCommandHandler } from "../src/controller/ControllerCommandHandler.js";
import { CustomClusterPoller } from "../src/controller/CustomClusterPoller.js";
import { nodeIdOf } from "../src/util/nodeIdOf.js";
import { TestSite } from "./support/ControllerSite.js";

const ON_OFF_PATH = `1/${OnOff.Cluster.id}/${OnOff.Cluster.attributes.onOff.id}`;

async function createHandler(controller: ServerNode) {
    const webRtcRequestor = await controller.add(new Endpoint(CameraControllerEndpoint, { id: "camera-controller" }));
    await controller.env.load(FabricManager);
    const fabric = await (
        await controller.env.load(FabricAuthority)
    ).defaultFabric({ adminFabricLabel: "TestFabric", adminFabricId: FabricId(1), adminNodeId: NodeId(112233) });
    return new ControllerCommandHandler(
        { node: controller, fabric, otaProvider: undefined, webRtcRequestor },
        { bleEnabled: false, bleProxyEnabled: false, otaEnabled: false },
    );
}

/** What a client is served for the node: its availability and the OnOff value. */
type ClientView = { available: boolean; onOff: unknown };

function viewOf(handler: ControllerCommandHandler, nodeId: NodeId): ClientView {
    const { available, attributes } = handler.getNodeDetails(nodeId);
    return { available, onOff: attributes[ON_OFF_PATH] };
}

/**
 * The handler events the WebSocket layer turns into node_updated and attribute_updated: for each event that
 * triggers a node_updated, what the handler serves at that moment, and the path of every forwarded
 * attribute change.
 */
function recordClientView(handler: ControllerCommandHandler) {
    const nodeUpdates = new Array<ClientView>();
    const attributeChanges = new Array<string>();
    const record = (nodeId: NodeId) => {
        nodeUpdates.push(viewOf(handler, nodeId));
    };
    handler.events.nodeStructureChanged.on(record);
    handler.events.nodeAvailabilityChanged.on(record);
    handler.events.attributeChanged.on((_nodeId, { path }) => {
        attributeChanges.push(`${path.endpointId}/${path.clusterId}/${path.attributeId}`);
    });
    return { nodeUpdates, attributeChanges };
}

async function connectionOf(peer: ClientNode) {
    if (peer.lifecycle.isConnected) {
        return;
    }
    const observers = new ObserverGroup();
    try {
        await new Promise<void>(resolve =>
            observers.on(peer.lifecycle.connectionStateChanged, state => {
                if (state === NodeConnectionState.Connected) {
                    resolve();
                }
            }),
        );
    } finally {
        observers.close();
    }
}

async function awaitConnected(peer: ClientNode) {
    await MockTime.resolve(connectionOf(peer), { macrotasks: true });
}

/** Long enough for the first-report refresh and a few subscription reports. */
async function settle() {
    await MockTime.resolve(MockTime.advance(30_000), { macrotasks: true });
}

function onlyPeer(controller: ServerNode) {
    const [peer] = controller.peers.commissioned;
    expect(peer).not.undefined;
    return peer;
}

/**
 * Replaces the cache's full rebuild for the rest of the test. The prototype is the only seam: the cache is
 * private to the handler.
 */
function replaceCacheUpdate(
    update: (original: AttributeDataCache["update"], cache: AttributeDataCache, node: ClientNode) => Promise<void>,
) {
    const original = AttributeDataCache.prototype.update;
    AttributeDataCache.prototype.update = function (node: ClientNode) {
        return update(original, this, node);
    };
    return () => {
        AttributeDataCache.prototype.update = original;
    };
}

describe("restored node cache", () => {
    let site: TestSite;
    let handler: ControllerCommandHandler | undefined;
    let restore: (() => void) | undefined;

    beforeEach(() => {
        MockTime.reset();
        site = new TestSite();
        handler = undefined;
        restore = undefined;
    });

    afterEach(async () => {
        restore?.();
        if (handler !== undefined) {
            await MockTime.resolve(handler.close(), { macrotasks: true });
        }
        await site.close();
    });

    /** Commissions the light, stops the controller and switches the light on while nobody watches. */
    async function changeWhileControllerIsDown() {
        const { controller, device, light } = await site.startPair();
        await site.commission(controller, device);
        const subscription = onlyPeer(controller).behaviors.internalsOf(NetworkClient).activeSubscription;
        expect(subscription).instanceOf(SustainedSubscription);
        if (subscription instanceof SustainedSubscription) {
            await MockTime.resolve(subscription.active, { macrotasks: true });
        }
        await MockTime.resolve(controller.close(), { macrotasks: true });
        await light.set({ onOff: { onOff: true } });
        return device;
    }

    async function restartController() {
        const controller = await site.addController();
        handler = await createHandler(controller);
        return { controller, handler, view: recordClientView(handler) };
    }

    it("serves a restored node as unavailable, then available with the device's values after its first report", async () => {
        await changeWhileControllerIsDown();
        let rebuilds = 0;
        restore = replaceCacheUpdate((original, cache, node) => {
            rebuilds++;
            return original.call(cache, node);
        });

        const { controller, handler, view } = await restartController();
        await MockTime.resolve(handler.initializeNodes(), { macrotasks: true });
        const peer = onlyPeer(controller);
        const nodeId = nodeIdOf(peer);
        expect(peer.lifecycle.isConnected).equals(false);
        expect(viewOf(handler, nodeId).available).equals(false);
        await awaitConnected(peer);
        await settle();

        expect(viewOf(handler, nodeId)).deep.equals({ available: true, onOff: true });
        expect(view.nodeUpdates).deep.equals([{ available: true, onOff: true }]);
        expect(view.attributeChanges).not.include(ON_OFF_PATH);
        expect(rebuilds).equals(1);
    });

    it("keeps a restored node unavailable while its device is unreachable, then sends it once", async () => {
        const device = await changeWhileControllerIsDown();
        await MockTime.resolve(device.cancel(), { macrotasks: true });

        const { controller, handler, view } = await restartController();
        await MockTime.resolve(handler.initializeNodes(), { macrotasks: true });
        const peer = onlyPeer(controller);
        const nodeId = nodeIdOf(peer);
        for (
            let i = 0;
            i < 20 && peer.lifecycle.connectionState !== NodeConnectionState.WaitingForDeviceDiscovery;
            i++
        ) {
            await settle();
        }
        expect(peer.lifecycle.connectionState).equals(NodeConnectionState.WaitingForDeviceDiscovery);
        expect(viewOf(handler, nodeId)).deep.equals({ available: false, onOff: false });

        await MockTime.resolve(device.start(), { macrotasks: true });
        await awaitConnected(peer);
        await settle();

        expect(view.nodeUpdates).deep.equals([{ available: true, onOff: true }]);
        expect(view.attributeChanges).not.include(ON_OFF_PATH);
    });

    it("serves a node whose first report came before its registration as available at once", async () => {
        await changeWhileControllerIsDown();

        const { controller, handler, view } = await restartController();
        await MockTime.resolve(handler.start(), { macrotasks: true });
        const peer = onlyPeer(controller);
        await awaitConnected(peer);
        await MockTime.resolve(handler.initializeNodes(), { macrotasks: true });

        expect(viewOf(handler, nodeIdOf(peer))).deep.equals({ available: true, onOff: true });
        await settle();
        expect(view.nodeUpdates).deep.equals([]);
        expect(view.attributeChanges).not.include(ON_OFF_PATH);
    });

    it("makes a restored node available when its first report came before any snapshot of it", async () => {
        await changeWhileControllerIsDown();

        // The registration snapshot is private to the handler too, so it is held back through the prototype.
        const add = AttributeDataCache.prototype.add;
        AttributeDataCache.prototype.add = async function (node: ClientNode) {
            await connectionOf(node);
            return add.call(this, node);
        };
        restore = () => {
            AttributeDataCache.prototype.add = add;
        };

        const { controller, handler, view } = await restartController();
        await MockTime.resolve(handler.initializeNodes(), { macrotasks: true });
        await settle();

        expect(viewOf(handler, nodeIdOf(onlyPeer(controller)))).deep.equals({ available: true, onOff: true });
        expect(view.nodeUpdates).deep.equals([{ available: true, onOff: true }]);
    });

    it("makes a restored node available even when its rebuild produces no snapshot, and serves the stored values", async () => {
        const device = await changeWhileControllerIsDown();
        await MockTime.resolve(device.cancel(), { macrotasks: true });
        // During startup only the first-report refresh rebuilds, so this stands in for its populate failing.
        restore = replaceCacheUpdate(async () => {});

        const { controller, handler, view } = await restartController();
        await MockTime.resolve(handler.initializeNodes(), { macrotasks: true });
        await MockTime.resolve(device.start(), { macrotasks: true });
        await awaitConnected(onlyPeer(controller));
        await settle();

        expect(view.nodeUpdates).deep.equals([{ available: true, onOff: false }]);
    });

    it("makes a restored node available even when handing its snapshot to the pollers throws", async () => {
        await changeWhileControllerIsDown();
        const registerNode = CustomClusterPoller.prototype.registerNode;
        CustomClusterPoller.prototype.registerNode = () => {
            throw new Error("poller failure");
        };
        restore = () => {
            CustomClusterPoller.prototype.registerNode = registerNode;
        };

        const { controller, handler, view } = await restartController();
        await MockTime.resolve(handler.initializeNodes(), { macrotasks: true });
        await awaitConnected(onlyPeer(controller));
        await settle();

        expect(view.nodeUpdates).deep.equals([{ available: true, onOff: true }]);
    });

    async function commissionThroughHandler() {
        const { controller, device } = await site.startPair();
        handler = await createHandler(controller);
        const commandHandler = handler;
        const view = recordClientView(commandHandler);
        await MockTime.resolve(commandHandler.initializeNodes(), { macrotasks: true });

        const { passcode, discriminator } = device.state.commissioning;
        const { nodeId } = await site.pairing(controller, device, () =>
            commandHandler.commissionNode({ nodeId: NodeId(42), passcode, longDiscriminator: discriminator }),
        );
        const availableWhenAdded = commandHandler.getNodeDetails(nodeId).available;
        await awaitConnected(onlyPeer(controller));
        await settle();
        return { view, availableWhenAdded };
    }

    it("never serves a freshly commissioned node as unavailable, and sends it once more after its first report", async () => {
        const { view, availableWhenAdded } = await commissionThroughHandler();

        expect(availableWhenAdded).equals(true);
        expect(view.nodeUpdates).deep.equals([{ available: true, onOff: false }]);
        expect(view.attributeChanges).not.include(ON_OFF_PATH);
    });

    it("does not send a freshly commissioned node again when its rebuild produces no new snapshot", async () => {
        restore = replaceCacheUpdate(async () => {});

        const { view } = await commissionThroughHandler();

        expect(view.nodeUpdates).deep.equals([]);
    });
});
