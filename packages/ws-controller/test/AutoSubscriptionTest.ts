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
    SupportedStorageTypes,
    Time,
} from "@matter/general";
import {
    ClientNode,
    Endpoint,
    NetworkClient,
    NodeConnectionState,
    NodeId,
    ServerNode,
    SessionsBehavior,
} from "@matter/main";
import { BooleanStateServer } from "@matter/node/behaviors/boolean-state";
import { IcdManagementServer } from "@matter/node/behaviors/icd-management";
import { OnOffServer } from "@matter/node/behaviors/on-off";
import { OnOffLightDevice } from "@matter/node/devices/on-off-light";
import { ControllerCommandHandler } from "../src/controller/ControllerCommandHandler.js";
import { ControllerNode, createControllerNode } from "../src/controller/ControllerNode.js";
import { MatterController, MatterControllerOptions } from "../src/controller/MatterController.js";
import { ConfigStorage } from "../src/server/ConfigStorage.js";

const NODE_ID = NodeId(42n);

interface RunningController {
    resources: ControllerNode;
    handler: ControllerCommandHandler;
    crypto: MockCrypto;
}

describe("auto subscription setting", () => {
    let simulator: NetworkSimulator;
    let storage: Record<string, Record<string, Record<string, SupportedStorageTypes>>>;
    let nextHost: number;
    let device: ServerNode;
    let light: Endpoint;
    let deviceCrypto: MockCrypto;
    let subscriptionsOnDevice: number;
    let running: RunningController | undefined;

    function environment(id: string) {
        const index = nextHost++;
        const env = new Environment(`${id}-${index}`);
        const crypto = MockCrypto(index);
        env.set(Entropy, crypto);
        env.set(Crypto, crypto);
        env.set(Network, simulator.addHost(index));
        storage[id] ??= {};
        const record = storage[id];
        new MockStorageService(env, () => new MemoryStorageDriver(record));
        return { env, crypto };
    }

    beforeEach(async () => {
        MockTime.reset();
        simulator = new NetworkSimulator();
        storage = {};
        nextHost = 1;
        subscriptionsOnDevice = 0;
        running = undefined;

        const { env, crypto } = environment("device");
        deviceCrypto = crypto;
        // ICD management, so resync_icd has a registration to drop.
        device = new ServerNode(ServerNode.RootEndpoint.with(IcdManagementServer), { id: "device", environment: env });
        light = await device.add(OnOffLightDevice.with(BooleanStateServer), { id: "light" });
        await device.start();
        device.eventsOf(SessionsBehavior).subscriptionAdded.on(() => {
            subscriptionsOnDevice++;
        });
    });

    afterEach(async () => {
        if (running !== undefined) {
            await stopController(running);
        }
        await MockTime.resolve(device.close(), { macrotasks: true });
    });

    async function startController(
        disableAutoSubscription: boolean,
        repairPending = false,
    ): Promise<RunningController> {
        const { env, crypto } = environment("controller");
        const resources = await createControllerNode({
            environment: env,
            id: "controller",
            adminFabricLabel: "TestFabric",
            serverVersion: "1.0.0",
            enableOtaProvider: false,
            peerSettingsRepair: {
                hasRepairedPeerSettings: () => !repairPending,
                markPeerSettingsRepaired: async () => {},
            },
            disableAutoSubscription,
        });
        const handler = new ControllerCommandHandler(resources, {
            bleEnabled: false,
            bleProxyEnabled: false,
            otaEnabled: false,
            disableAutoSubscription,
        });
        await MockTime.resolve(handler.initializeNodes(), { macrotasks: true });
        running = { resources, handler, crypto };
        return running;
    }

    async function stopController(controller: RunningController) {
        running = undefined;
        await MockTime.resolve(controller.handler.close(), { macrotasks: true });
        await MockTime.resolve(controller.resources.close(), { macrotasks: true });
    }

    async function restartController(disableAutoSubscription: boolean, repairPending = false) {
        if (running !== undefined) {
            await stopController(running);
        }
        const controller = await startController(disableAutoSubscription, repairPending);
        await settle();
        return controller;
    }

    /** Long enough for every started peer to establish its sustained subscription. */
    async function settle() {
        await MockTime.resolve(Time.sleep("settle", Seconds(60)), { macrotasks: true });
    }

    async function commission(controller: RunningController) {
        const controllerCrypto = controller.crypto;
        // Session ids collide without entropy while pairing.
        controllerCrypto.entropic = deviceCrypto.entropic = true;
        try {
            const { passcode, discriminator } = device.state.commissioning;
            await MockTime.resolve(
                controller.handler.commissionNode({ nodeId: NODE_ID, passcode, longDiscriminator: discriminator }),
                { macrotasks: true },
            );
        } finally {
            controllerCrypto.entropic = deviceCrypto.entropic = false;
        }
        await settle();
    }

    async function commissioned(disableAutoSubscription: boolean) {
        const controller = await startController(disableAutoSubscription);
        await commission(controller);
        return controller;
    }

    function peerOf(controller: RunningController) {
        const peer = controller.resources.node.peers.commissioned[0];
        expect(peer).not.undefined;
        return peer;
    }

    function hasActiveSubscription(controller: RunningController) {
        return peerOf(controller).behaviors.internalsOf(NetworkClient).activeSubscription !== undefined;
    }

    describe("when disabled", () => {
        it("commissions a seeded node without ever subscribing", async () => {
            const controller = await startController(true);
            await commission(controller);

            expect(peerOf(controller).lifecycle.isSeeded).equals(true);
            const details = controller.handler.getNodeDetails(NODE_ID);
            expect(Object.keys(details.attributes).length).greaterThan(0);
            expect(controller.handler.autoSubscriptionDisabled).equals(true);
            // Never Connected without a subscription, but still reported available.
            expect(peerOf(controller).lifecycle.connectionState).equals(NodeConnectionState.Reconnecting);
            expect(details.available).equals(true);

            expect(hasActiveSubscription(controller)).equals(false);
            expect(subscriptionsOnDevice).equals(0);
        });

        it("does not subscribe to a stored node after a restart", async () => {
            await commission(await startController(true));

            const controller = await restartController(true);

            expect(peerOf(controller).stateOf(NetworkClient).autoSubscribe).equals(false);
            expect(hasActiveSubscription(controller)).equals(false);
            expect(subscriptionsOnDevice).equals(0);
        });

        it("stops subscribing to a node commissioned while it was enabled", async () => {
            await commission(await startController(false));
            const subscriptionsBefore = subscriptionsOnDevice;

            const controller = await restartController(true);

            expect(peerOf(controller).stateOf(NetworkClient).autoSubscribe).equals(false);
            expect(hasActiveSubscription(controller)).equals(false);
            expect(subscriptionsOnDevice).equals(subscriptionsBefore);
        });

        it("wins over the one-time repair of restored peers, which enables auto subscription", async () => {
            await commission(await startController(true));

            const controller = await restartController(true, true);

            expect(peerOf(controller).stateOf(NetworkClient).autoSubscribe).equals(false);
            expect(hasActiveSubscription(controller)).equals(false);
            expect(subscriptionsOnDevice).equals(0);
        });

        it("does not subscribe when the ICD registration is resynced", async () => {
            const controller = await startController(true);
            await commission(controller);

            await MockTime.resolve(controller.handler.resyncIcd(NODE_ID), { macrotasks: true });
            await settle();

            expect(hasActiveSubscription(controller)).equals(false);
            expect(subscriptionsOnDevice).equals(0);
        });

        it("tells the device to remove the fabric when the node is removed", async () => {
            const controller = await startController(true);
            await commission(controller);
            expect(device.state.operationalCredentials.commissionedFabrics).equals(1);

            await MockTime.resolve(controller.handler.decommissionNode(NODE_ID), { macrotasks: true });

            expect(device.state.operationalCredentials.commissionedFabrics).equals(0);
        });

        it("serves values an interview read in get_node", async () => {
            const controller = await startController(true);
            await commission(controller);
            expect(controller.handler.getNodeDetails(NODE_ID).attributes["1/6/0"]).equals(false);

            await light.setStateOf(OnOffServer, { onOff: true });
            await MockTime.resolve(controller.handler.interviewNode(NODE_ID), { macrotasks: true });
            await settle();

            expect(controller.handler.getNodeDetails(NODE_ID).attributes["1/6/0"]).equals(true);
        });

        it("serves an endpoint an interview discovered in get_node", async () => {
            const controller = await startController(true);
            await commission(controller);

            await device.add(OnOffLightDevice, { id: "light2" });
            await MockTime.resolve(controller.handler.interviewNode(NODE_ID), { macrotasks: true });
            await settle();

            expect(controller.handler.getNodeDetails(NODE_ID).attributes["2/6/0"]).equals(false);
        });
    });

    describe("when enabled (default)", () => {
        it("subscribes to a commissioned node", async () => {
            const controller = await startController(false);
            await commission(controller);

            expect(controller.handler.autoSubscriptionDisabled).equals(false);
            expect(peerOf(controller).stateOf(NetworkClient).autoSubscribe).equals(true);
            expect(hasActiveSubscription(controller)).equals(true);
            expect(subscriptionsOnDevice).greaterThan(0);
        });

        it("subscribes again to a node stored while the setting was on", async () => {
            await commission(await startController(true));

            const controller = await restartController(false);

            expect(peerOf(controller).stateOf(NetworkClient).autoSubscribe).equals(true);
            expect(hasActiveSubscription(controller)).equals(true);
            expect(subscriptionsOnDevice).greaterThan(0);
        });
    });

    describe("a peer whose setting cannot be stored", () => {
        let restoreSet: (() => void) | undefined;

        function failPeerWrites() {
            const set = ClientNode.prototype.set;
            ClientNode.prototype.set = async () => {
                throw new Error("storage is gone");
            };
            restoreSet = () => {
                ClientNode.prototype.set = set;
            };
        }

        afterEach(() => {
            restoreSet?.();
            restoreSet = undefined;
        });

        it("fails the start when auto subscription is disabled", async () => {
            await stopController(await commissioned(false));
            failPeerWrites();

            await expect(startController(true)).rejectedWith("storage is gone");
        });

        it("is skipped when auto subscription is enabled", async () => {
            await stopController(await commissioned(true));
            failPeerWrites();

            const controller = await startController(false);

            expect(peerOf(controller).stateOf(NetworkClient).autoSubscribe).equals(false);
        });
    });

    describe("MatterController", () => {
        let matterController: MatterController | undefined;

        afterEach(async () => {
            await matterController?.stop();
            matterController = undefined;
        });

        async function createMatterController(options: MatterControllerOptions) {
            const { env } = environment("controller");
            const config = await ConfigStorage.create(env);
            matterController = await MatterController.create(env, config, {
                serverId: "controller",
                disableThreadDiagnostics: true,
                ...options,
            });
            return matterController;
        }

        it("hands the setting to the command handler", async () => {
            expect(
                (await createMatterController({ disableAutoSubscription: true })).commandHandler
                    .autoSubscriptionDisabled,
            ).true;
            await matterController?.stop();
            matterController = undefined;
            expect((await createMatterController({})).commandHandler.autoSubscriptionDisabled).false;
        });

        it("applies the setting to the stored peers", async () => {
            await stopController(await commissioned(false));
            const set = ClientNode.prototype.set;
            const written = new Array<unknown>();
            ClientNode.prototype.set = async function (this: ClientNode, ...args: Parameters<ClientNode["set"]>) {
                written.push(args[0]);
                return set.apply(this, args);
            };
            try {
                await createMatterController({ disableAutoSubscription: true });
            } finally {
                ClientNode.prototype.set = set;
            }

            expect(written).deep.include({ network: { autoSubscribe: false } });
        });
    });
});
