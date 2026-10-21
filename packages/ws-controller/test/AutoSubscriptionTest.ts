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
    Minutes,
    Seconds,
    SupportedStorageTypes,
    Time,
} from "@matter/general";
import {
    ClientNode,
    Endpoint,
    InteractionServer,
    NetworkClient,
    NodeConnectionState,
    NodeId,
    ServerNode,
    SessionsBehavior,
} from "@matter/main";
import { PeerSet } from "@matter/main/protocol";
import { Status, StatusResponseError } from "@matter/main/types";
import { BooleanStateServer } from "@matter/node/behaviors/boolean-state";
import { IcdManagementServer } from "@matter/node/behaviors/icd-management";
import { OnOffServer } from "@matter/node/behaviors/on-off";
import { OperationalCredentialsServer } from "@matter/node/behaviors/operational-credentials";
import { TimeSynchronizationServer } from "@matter/node/behaviors/time-synchronization";
import { OnOffLightDevice } from "@matter/node/devices/on-off-light";
import { BorderRouterRegistry } from "@matter/thread-br-client";
import { ControllerCommandHandler } from "../src/controller/ControllerCommandHandler.js";
import { ControllerNode, createControllerNode } from "../src/controller/ControllerNode.js";
import { MatterController, MatterControllerOptions } from "../src/controller/MatterController.js";
import { ConfigStorage } from "../src/server/ConfigStorage.js";
import { ServerError, ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";

const NODE_ID = NodeId(42n);

let timeSyncsOnDevice = 0;

class CountingTimeSynchronizationServer extends TimeSynchronizationServer {
    override setUtcTime() {
        timeSyncsOnDevice++;
    }
}

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
        timeSyncsOnDevice = 0;
        running = undefined;

        const { env, crypto } = environment("device");
        deviceCrypto = crypto;
        // ICD management, so resync_icd has a registration to drop.
        device = new ServerNode(ServerNode.RootEndpoint.with(IcdManagementServer, CountingTimeSynchronizationServer), {
            id: "device",
            environment: env,
        });
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
        timeSyncEnabled = false,
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
            timeSyncEnabled,
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

    describe("per node", () => {
        async function setAutoSubscription(controller: RunningController, enabled: boolean) {
            await MockTime.resolve(controller.handler.setAutoSubscription(NODE_ID, enabled), { macrotasks: true });
            await settle();
        }

        it("is rejected without changing the node while auto subscription is on", async () => {
            const controller = await commissioned(false);

            for (const enabled of [true, false]) {
                const error = await controller.handler.setAutoSubscription(NODE_ID, enabled).then(
                    () => undefined,
                    (error: unknown) => error,
                );
                expect(error).instanceOf(ServerError);
                if (error instanceof ServerError) {
                    expect(error.code).equals(ServerErrorCode.InvalidArguments);
                    expect(error.message).contains("--disable-auto-subscription");
                }
            }

            expect(peerOf(controller).stateOf(NetworkClient).autoSubscribe).equals(true);
            expect(hasActiveSubscription(controller)).equals(true);
        });

        it("subscribes to the node once enabled and stops once disabled", async () => {
            const controller = await commissioned(true);

            await setAutoSubscription(controller, true);

            expect(peerOf(controller).stateOf(NetworkClient).autoSubscribe).equals(true);
            expect(hasActiveSubscription(controller)).equals(true);
            expect(subscriptionsOnDevice).greaterThan(0);
            expect(peerOf(controller).lifecycle.connectionState).equals(NodeConnectionState.Connected);

            await setAutoSubscription(controller, false);

            expect(peerOf(controller).stateOf(NetworkClient).autoSubscribe).equals(false);
            expect(hasActiveSubscription(controller)).equals(false);
        });

        it("is switched off again on the next start", async () => {
            await setAutoSubscription(await commissioned(true), true);

            const controller = await restartController(true);

            expect(peerOf(controller).stateOf(NetworkClient).autoSubscribe).equals(false);
            expect(hasActiveSubscription(controller)).equals(false);
        });

        it("subscribes again to an enabled node when the ICD registration is resynced", async () => {
            const controller = await commissioned(true);
            await setAutoSubscription(controller, true);
            const subscriptionsBefore = subscriptionsOnDevice;

            await MockTime.resolve(controller.handler.resyncIcd(NODE_ID), { macrotasks: true });
            await settle();

            expect(hasActiveSubscription(controller)).equals(true);
            expect(subscriptionsOnDevice).greaterThan(subscriptionsBefore);
        });

        it("does not push a changed fabric label to an enabled node", async () => {
            const controller = await commissioned(true);
            await setAutoSubscription(controller, true);

            const { pushed } = await MockTime.resolve(controller.handler.setFabricLabel("Changed"), {
                macrotasks: true,
            });
            await MockTime.resolve(pushed, { macrotasks: true });
            await settle();

            expect(device.stateOf(OperationalCredentialsServer).fabrics[0]?.label).equals("TestFabric");
        });

        it("does not synchronize the time of an enabled node", async () => {
            const controller = await startController(true, false, true);
            await commission(controller);
            await setAutoSubscription(controller, true);

            await MockTime.resolve(Time.sleep("time sync window", Minutes(10)), { macrotasks: true });

            expect(hasActiveSubscription(controller)).equals(true);
            expect(timeSyncsOnDevice).equals(0);
        });

        it("synchronizes the time with auto subscription on, as the reference for the test above", async () => {
            const controller = await startController(false, false, true);
            await commission(controller);

            await MockTime.resolve(Time.sleep("time sync window", Minutes(10)), { macrotasks: true });

            expect(timeSyncsOnDevice).greaterThan(0);
        });
    });

    describe("enabling per node", () => {
        async function enable(controller: RunningController) {
            await MockTime.resolve(controller.handler.setAutoSubscription(NODE_ID, true), { macrotasks: true });
        }

        async function enableFailure(controller: RunningController) {
            return await enable(controller).then(
                () => undefined,
                (error: unknown) => error,
            );
        }

        function expectServerError(error: unknown, code: ServerErrorCode) {
            expect(error).instanceOf(ServerError);
            if (error instanceof ServerError) {
                expect(error.code).equals(code);
            }
        }

        async function subscriptionActive(controller: RunningController) {
            return await peerOf(controller).act(agent => agent.get(NetworkClient).subscriptionActive);
        }

        /** Returns a function that accepts subscriptions again. */
        function refuseSubscriptions() {
            const server = device.env.get(InteractionServer);
            const original = server.handleSubscribeRequest;
            server.handleSubscribeRequest = async () => {
                throw new StatusResponseError("Refused by the test", Status.ResourceExhausted);
            };
            return () => {
                server.handleSubscribeRequest = original;
            };
        }

        it("refuses a client subscription while enabling is still being applied", async () => {
            const controller = await commissioned(true);
            const pending = enable(controller);

            const subscribe = await MockTime.resolve(
                controller.handler.subscribe(
                    { nodeId: NODE_ID, attributePaths: ["1/6/0"], minInterval: 0, maxInterval: 60 },
                    { report: () => {}, closed: () => {} },
                ),
                { macrotasks: true },
            ).then(
                () => undefined,
                (error: unknown) => error,
            );
            await pending;

            expectServerError(subscribe, ServerErrorCode.InvalidArguments);
            expect(subscriptionsOnDevice).equals(1);
        });

        it("does not keep the auto subscription it could not switch on", async () => {
            const controller = await commissioned(true);
            const peer = peerOf(controller);
            const set = peer.set.bind(peer);
            peer.set = async () => {
                throw new Error("Refused by the test");
            };

            const failure = await enableFailure(controller);
            peer.set = set;
            await MockTime.resolve(controller.handler.resyncIcd(NODE_ID), { macrotasks: true });
            await settle();

            expect(String(failure)).contains("Refused by the test");
            expect(peer.stateOf(NetworkClient).autoSubscribe).equals(false);
            expect(subscriptionsOnDevice).equals(0);
        });

        it("resolves once the subscription is active", async () => {
            const controller = await commissioned(true);

            await enable(controller);

            expect(await subscriptionActive(controller)).equals(true);
            expect(controller.handler.events.nodeDecommissioned.isObserved).equals(false);
        });

        it("resolves at once when the subscription is already active", async () => {
            const controller = await commissioned(true);
            await enable(controller);
            await settle();
            const before = Time.nowUs;

            await enable(controller);

            expect(Time.nowUs).equals(before);
        });

        it("fails after the timeout when the subscription does not become active, and stays enabled", async () => {
            const controller = await commissioned(true);
            refuseSubscriptions();
            const before = Time.nowUs;

            const error = await enableFailure(controller);

            expectServerError(error, ServerErrorCode.NodeNotReady);
            expect(String(error)).contains("not active within");
            expect(Time.nowUs - before).least(Seconds(255));
            expect(peerOf(controller).stateOf(NetworkClient).autoSubscribe).equals(true);
            expect(controller.handler.events.nodeDecommissioned.isObserved).equals(false);
        });

        it("fails after 4 minutes 15 seconds, not before", async () => {
            const controller = await commissioned(true);
            refuseSubscriptions();
            let outcome: unknown = "pending";
            const pending = controller.handler.setAutoSubscription(NODE_ID, true).then(
                () => {
                    outcome = undefined;
                },
                (error: unknown) => {
                    outcome = error;
                },
            );

            await MockTime.resolve(Time.sleep("before timeout", Seconds(254)), { macrotasks: true });
            expect(outcome).equals("pending");

            await MockTime.resolve(Time.sleep("after timeout", Seconds(2)), { macrotasks: true });
            expectServerError(outcome, ServerErrorCode.NodeNotReady);
            await pending;
        });

        it("fails when the node is removed while waiting", async () => {
            const controller = await commissioned(true);
            refuseSubscriptions();
            const pending = controller.handler.setAutoSubscription(NODE_ID, true).then(
                () => undefined,
                (error: unknown) => error,
            );
            await settle();

            await MockTime.resolve(controller.handler.decommissionNode(NODE_ID), { macrotasks: true });

            expectServerError(await MockTime.resolve(pending), ServerErrorCode.NodeNotExists);
            expect(controller.handler.events.nodeDecommissioned.isObserved).equals(false);
        });

        it("fails when the handler closes while waiting", async () => {
            const controller = await commissioned(true);
            refuseSubscriptions();
            const pending = controller.handler.setAutoSubscription(NODE_ID, true).then(
                () => undefined,
                (error: unknown) => error,
            );
            await settle();

            await MockTime.resolve(controller.handler.close(), { macrotasks: true });

            const error = await MockTime.resolve(pending);
            expect(error).instanceOf(Error);
            expect(String(error)).contains("shutting down");
        });

        it("fails when the device does not respond", async () => {
            const controller = await commissioned(true);
            await MockTime.resolve(device.close(), { macrotasks: true });

            const error = await enableFailure(controller);

            expectServerError(error, ServerErrorCode.NodeNotResolving);
        });

        it("does not fail for an older unreachable mark and resolves once the subscription is active", async () => {
            const controller = await commissioned(true);
            const peer = controller.resources.node.env.get(PeerSet).get(controller.resources.fabric.addressOf(NODE_ID));
            expect(peer).not.undefined;
            peer?.establishmentUnresponsive.emit();
            expect(peerOf(controller).lifecycle.connectionState).equals(NodeConnectionState.WaitingForDeviceDiscovery);

            await enable(controller);

            expect(await subscriptionActive(controller)).equals(true);
        });

        it("fails when switched off while waiting", async () => {
            const controller = await commissioned(true);
            refuseSubscriptions();
            const pending = controller.handler.setAutoSubscription(NODE_ID, true).then(
                () => undefined,
                (error: unknown) => error,
            );
            await settle();

            await MockTime.resolve(controller.handler.setAutoSubscription(NODE_ID, false), { macrotasks: true });

            const error = await MockTime.resolve(pending);
            expectServerError(error, ServerErrorCode.NodeNotReady);
            expect(String(error)).contains("disabled while waiting");
            expect(peerOf(controller).stateOf(NetworkClient).autoSubscribe).equals(false);
        });

        it("keeps waiting while the ICD registration is resynced and resolves once the subscription is active", async () => {
            const controller = await commissioned(true);
            const acceptSubscriptions = refuseSubscriptions();
            const pending = controller.handler.setAutoSubscription(NODE_ID, true).then(
                () => undefined,
                (error: unknown) => error,
            );
            await settle();

            await MockTime.resolve(controller.handler.resyncIcd(NODE_ID), { macrotasks: true });
            acceptSubscriptions();
            await settle();

            expect(await MockTime.resolve(pending, { macrotasks: true })).undefined;
            expect(await subscriptionActive(controller)).equals(true);
        });

        function pendingEnable(controller: RunningController) {
            return controller.handler.setAutoSubscription(NODE_ID, true).then(
                () => undefined,
                (error: unknown) => error,
            );
        }

        it("keeps waiting while two ICD registration resyncs run at once and resolves once the subscription is active", async () => {
            const controller = await commissioned(true);
            const acceptSubscriptions = refuseSubscriptions();
            const pending = pendingEnable(controller);
            await settle();

            await MockTime.resolve(
                Promise.all([controller.handler.resyncIcd(NODE_ID), controller.handler.resyncIcd(NODE_ID)]),
                { macrotasks: true },
            );
            acceptSubscriptions();
            await settle();

            expect(await MockTime.resolve(pending, { macrotasks: true })).undefined;
            expect(await subscriptionActive(controller)).equals(true);
        });

        it("stays off when switched off while an ICD registration resync runs", async () => {
            const controller = await commissioned(true);
            refuseSubscriptions();
            const pending = pendingEnable(controller);
            await settle();
            const peer = peerOf(controller);
            let disabling: Promise<void> | undefined;
            peer.eventsOf(NetworkClient).autoSubscribe$Changed.on(autoSubscribe => {
                if (!autoSubscribe && disabling === undefined) {
                    disabling = controller.handler.setAutoSubscription(NODE_ID, false);
                }
            });

            await MockTime.resolve(controller.handler.resyncIcd(NODE_ID), { macrotasks: true });
            expect(disabling).not.undefined;
            await MockTime.resolve(disabling, { macrotasks: true });
            await settle();

            const error = await MockTime.resolve(pending);
            expectServerError(error, ServerErrorCode.NodeNotReady);
            expect(String(error)).contains("disabled while waiting");
            expect(peer.stateOf(NetworkClient).autoSubscribe).equals(false);
            expect(hasActiveSubscription(controller)).equals(false);
        });

        it("stays off when switched off just before an ICD registration resync", async () => {
            const controller = await commissioned(true);
            await enable(controller);

            const disabling = controller.handler.setAutoSubscription(NODE_ID, false);
            const resyncing = controller.handler.resyncIcd(NODE_ID);
            await MockTime.resolve(Promise.all([disabling, resyncing]), { macrotasks: true });
            await settle();

            expect(peerOf(controller).stateOf(NetworkClient).autoSubscribe).equals(false);
            expect(hasActiveSubscription(controller)).equals(false);
        });

        it("fails at once when an ICD registration resync cannot switch the subscription back on", async () => {
            const controller = await commissioned(true);
            refuseSubscriptions();
            let outcome: unknown = "pending";
            const pending = controller.handler.setAutoSubscription(NODE_ID, true).then(
                () => {
                    outcome = undefined;
                },
                (error: unknown) => {
                    outcome = error;
                },
            );
            await settle();
            const peer = peerOf(controller);
            const set = peer.set.bind(peer);
            let calls = 0;
            peer.set = async values => {
                if (++calls === 2) {
                    throw new Error("Refused by the test");
                }
                return set(values);
            };

            const resync = await MockTime.resolve(controller.handler.resyncIcd(NODE_ID), { macrotasks: true }).then(
                () => undefined,
                (error: unknown) => error,
            );

            expect(String(resync)).contains("Refused by the test");
            expectServerError(outcome, ServerErrorCode.NodeNotReady);
            expect(String(outcome)).contains("Refused by the test");
            expect(peer.stateOf(NetworkClient).autoSubscribe).equals(false);
            await pending;
        });

        it("closes the subscription by the time disabling resolves", async () => {
            const controller = await commissioned(true);
            await enable(controller);

            await MockTime.resolve(controller.handler.setAutoSubscription(NODE_ID, false), { macrotasks: true });

            expect(hasActiveSubscription(controller)).equals(false);
            expect(await subscriptionActive(controller)).equals(false);
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
                disableDclSeed: true,
                ...options,
            });
            return matterController;
        }

        it("hands the setting to the command handler", async () => {
            const controller = await createMatterController({ disableAutoSubscription: true });
            expect(controller.commandHandler.autoSubscriptionDisabled).true;
        });

        it("leaves auto subscription on by default", async () => {
            const controller = await createMatterController({});
            expect(controller.commandHandler.autoSubscriptionDisabled).false;
        });

        it("runs every DCL service offline with dclOffline", async () => {
            const controller = await createMatterController({ dclOffline: true, disableDclSeed: false });
            await MockTime.resolve(controller.commandHandler.events.started.emit(), { macrotasks: true });

            const services = await MockTime.resolve(
                Promise.all([
                    controller.certificateService(),
                    controller.vendorInfoService(),
                    controller.otaUpdateService(),
                ]),
                { macrotasks: true },
            );

            expect(services.map(service => service.offline)).deep.equals([true, true, true]);
        });

        it("runs the OTA provider's DCL service offline with dclOffline", async () => {
            const controller = await createMatterController({
                dclOffline: true,
                disableDclSeed: false,
                disableOtaProvider: false,
            });

            const service = await MockTime.resolve(controller.otaUpdateService(), { macrotasks: true });

            expect(service.offline).equals(true);
        });

        describe("Border Router discovery", () => {
            let starts: number;
            let restoreStart: () => void;

            beforeEach(() => {
                starts = 0;
                const start = BorderRouterRegistry.prototype.start;
                BorderRouterRegistry.prototype.start = async () => {
                    starts++;
                };
                restoreStart = () => {
                    BorderRouterRegistry.prototype.start = start;
                };
            });

            afterEach(() => {
                restoreStart();
            });

            async function started(disableAutoSubscription: boolean) {
                // Online, the vendor info preload fetches from the DCL, and stop() waits for it on a mock clock.
                const controller = await createMatterController({
                    disableAutoSubscription,
                    disableThreadDiagnostics: false,
                    dclOffline: true,
                    disableDclSeed: false,
                });
                await MockTime.resolve(controller.commandHandler.events.started.emit(), { macrotasks: true });
                return controller;
            }

            it("starts with the controller", async () => {
                await started(false);

                expect(starts).equals(1);
            });

            it("waits for the first request when auto subscription is disabled, and starts once", async () => {
                const controller = await started(true);
                expect(starts).equals(0);

                expect(controller.startBorderRouterDiscovery()).equals(true);
                expect(controller.startBorderRouterDiscovery()).equals(false);

                expect(starts).equals(1);
            });

            it("does not start with Thread diagnostics disabled", async () => {
                const controller = await createMatterController({ disableAutoSubscription: true });

                controller.startBorderRouterDiscovery();

                expect(starts).equals(0);
            });

            it("does not start once the controller is stopped", async () => {
                const controller = await started(true);
                matterController = undefined;
                await controller.stop();

                controller.startBorderRouterDiscovery();

                expect(starts).equals(0);
            });
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
