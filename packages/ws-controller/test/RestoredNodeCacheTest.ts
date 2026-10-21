/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ClientNode,
    FabricId,
    Logger,
    LogLevel,
    MatterError,
    NetworkClient,
    NodeConnectionState,
    NodeId,
    ObserverGroup,
    ServerNode,
} from "@matter/main";
import { OnOff } from "@matter/main/clusters";
import { Endpoint } from "@matter/node";
import { OnOffLightDevice } from "@matter/node/devices/on-off-light";
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
    const { fabricIndex } = await (
        await controller.env.load(FabricAuthority)
    ).defaultFabric({ adminFabricLabel: "TestFabric", adminFabricId: FabricId(1), adminNodeId: NodeId(112233) });
    return new ControllerCommandHandler(
        { node: controller, fabricIndex, otaProvider: undefined, webRtcRequestor },
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

async function stateOf(peer: ClientNode, target: NodeConnectionState) {
    if (peer.lifecycle.connectionState === target) {
        return;
    }
    const observers = new ObserverGroup();
    try {
        await new Promise<void>(resolve =>
            observers.on(peer.lifecycle.connectionStateChanged, state => {
                if (state === target) {
                    resolve();
                }
            }),
        );
    } finally {
        observers.close();
    }
}

function connectionOf(peer: ClientNode) {
    return stateOf(peer, NodeConnectionState.Connected);
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

/** Collects every availability log line of the handler until the returned stop function runs. */
function captureAvailabilityLogs() {
    const lines = new Array<string>();
    const destination = Logger.destinations.default;
    const { write, level } = destination;
    destination.write = (text, message) => {
        if (message.facility === "ControllerCommandHandler" && /Node .*? availab(le |ility changed)/.test(text)) {
            lines.push(text);
        }
        write.call(destination, text, message);
    };
    destination.level = LogLevel.DEBUG;
    return {
        lines,
        stop: () => {
            destination.write = write;
            destination.level = level;
        },
    };
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
    let logs: ReturnType<typeof captureAvailabilityLogs> | undefined;

    beforeEach(() => {
        MockTime.reset();
        site = new TestSite();
        handler = undefined;
        restore = undefined;
        logs = undefined;
    });

    afterEach(async () => {
        restore?.();
        logs?.stop();
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
        logs = captureAvailabilityLogs();
        await MockTime.resolve(handler.initializeNodes(), { macrotasks: true });
        const peer = onlyPeer(controller);
        const nodeId = nodeIdOf(peer);
        expect(peer.lifecycle.isConnected).equals(false);
        expect(viewOf(handler, nodeId).available).equals(false);
        await awaitConnected(peer);
        await settle();

        expect(logs.lines).length(1);
        expect(logs.lines[0]).contains("available after its first report");
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
        logs = captureAvailabilityLogs();
        await MockTime.resolve(handler.initializeNodes(), { macrotasks: true });

        expect(viewOf(handler, nodeIdOf(peer))).deep.equals({ available: true, onOff: true });
        await settle();
        expect(logs.lines).length(1);
        expect(logs.lines[0]).contains("available at registration (state: Connected)");
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

    it("makes a restored node available even when its rebuild fails", async () => {
        const device = await changeWhileControllerIsDown();
        await MockTime.resolve(device.cancel(), { macrotasks: true });
        restore = replaceCacheUpdate(async () => {
            throw new MatterError("rebuild failure");
        });

        const { controller, handler, view } = await restartController();
        await MockTime.resolve(handler.initializeNodes(), { macrotasks: true });
        await MockTime.resolve(device.start(), { macrotasks: true });
        await awaitConnected(onlyPeer(controller));
        await settle();

        expect(view.nodeUpdates).deep.equals([{ available: true, onOff: false }]);
    });

    it("keeps a restored node unavailable when it goes offline while its first report is being applied", async () => {
        const device = await changeWhileControllerIsDown();
        let offline: Promise<void> | undefined;
        restore = replaceCacheUpdate(async (original, cache, node) => {
            offline ??= device.cancel().then(() => stateOf(node, NodeConnectionState.WaitingForDeviceDiscovery));
            await offline;
            return original.call(cache, node);
        });

        const { controller, handler, view } = await restartController();
        await MockTime.resolve(handler.initializeNodes(), { macrotasks: true });
        const peer = onlyPeer(controller);
        await awaitConnected(peer);
        for (
            let i = 0;
            i < 20 && peer.lifecycle.connectionState !== NodeConnectionState.WaitingForDeviceDiscovery;
            i++
        ) {
            await settle();
        }
        await settle();

        expect(peer.lifecycle.connectionState).equals(NodeConnectionState.WaitingForDeviceDiscovery);
        expect(viewOf(handler, nodeIdOf(peer)).available).equals(false);
        expect(view.nodeUpdates).deep.equals([]);

        await MockTime.resolve(device.start(), { macrotasks: true });
        await awaitConnected(peer);
        await settle();

        expect(view.nodeUpdates).deep.equals([{ available: true, onOff: true }]);
    });

    it("sends an attribute the first report no longer carries as a removal before the node becomes available", async () => {
        await changeWhileControllerIsDown();
        const removedPath = `1/${OnOff.Cluster.id}/65000`;
        const add = AttributeDataCache.prototype.add;
        AttributeDataCache.prototype.add = async function (node: ClientNode) {
            await add.call(this, node);
            const stored = this.get(nodeIdOf(node));
            if (stored !== undefined) {
                stored[removedPath] = 5;
                stored[`9/${OnOff.Cluster.id}/0`] = true;
            }
        };
        restore = () => {
            AttributeDataCache.prototype.add = add;
        };

        const { controller, handler } = await restartController();
        const events = new Array<string>();
        handler.events.attributeChanged.on((_nodeId, { path, value }) => {
            events.push(`${path.endpointId}/${path.clusterId}/${path.attributeId}=${value}`);
        });
        handler.events.nodeAvailabilityChanged.on((_nodeId, available) => {
            events.push(`available=${available}`);
        });
        await MockTime.resolve(handler.initializeNodes(), { macrotasks: true });
        await awaitConnected(onlyPeer(controller));
        await settle();

        const removedAt = events.indexOf(`${removedPath}=undefined`);
        expect(removedAt, events.join(", ")).greaterThan(-1);
        expect(removedAt).lessThan(events.indexOf("available=true"));
        expect(events.filter(event => event.endsWith("=undefined"))).deep.equals([`${removedPath}=undefined`]);
        expect(handler.getNodeDetails(nodeIdOf(onlyPeer(controller))).attributes).not.have.property(removedPath);
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
        logs = captureAvailabilityLogs();

        const { passcode, discriminator } = device.state.commissioning;
        const { nodeId } = await site.pairing(controller, device, () =>
            commandHandler.commissionNode({ nodeId: NodeId(42), passcode, longDiscriminator: discriminator }),
        );
        const availableWhenAdded = commandHandler.getNodeDetails(nodeId).available;
        await awaitConnected(onlyPeer(controller));
        await settle();
        return { view, availableWhenAdded, device };
    }

    it("never serves a freshly commissioned node as unavailable, and sends it once more after its first report", async () => {
        const { view, availableWhenAdded } = await commissionThroughHandler();

        expect(availableWhenAdded).equals(true);
        expect(logs?.lines).length(1);
        expect(logs?.lines[0]).contains("available at registration");
        expect(view.nodeUpdates).deep.equals([{ available: true, onOff: false }]);
        expect(view.attributeChanges).not.include(ON_OFF_PATH);
    });

    it("hands the rebuilt snapshot to the pollers after a structure change", async () => {
        const registered = new Array<string[]>();
        const registerNode = CustomClusterPoller.prototype.registerNode;
        CustomClusterPoller.prototype.registerNode = function (peer, attributes) {
            registered.push(Object.keys(attributes));
            return registerNode.call(this, peer, attributes);
        };
        restore = () => {
            CustomClusterPoller.prototype.registerNode = registerNode;
        };
        const { device } = await commissionThroughHandler();
        registered.length = 0;

        await device.add(OnOffLightDevice, { id: "second-light", number: 2 });
        for (let i = 0; i < 5 && !registered.some(paths => paths.includes(`2/${OnOff.Cluster.id}/0`)); i++) {
            await settle();
        }

        expect(registered.some(paths => paths.includes(`2/${OnOff.Cluster.id}/0`))).equals(true);
    });

    it("does not send a freshly commissioned node again when its rebuild produces no new snapshot", async () => {
        restore = replaceCacheUpdate(async () => {});

        const { view } = await commissionThroughHandler();

        expect(view.nodeUpdates).deep.equals([]);
    });
});
