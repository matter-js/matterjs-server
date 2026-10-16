/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    Crypto,
    Entropy,
    Environment,
    Filesystem,
    MemoryStorageDriver,
    MockCrypto,
    MockFilesystem,
    MockStorageService,
    Network,
    NetworkSimulator,
    Seconds,
    SupportedStorageTypes,
    Time,
} from "@matter/general";
import { ClientNode, Endpoint, EndpointType, NetworkClient, NodeId, ServerNode } from "@matter/main";
import { BooleanStateServer } from "@matter/node/behaviors/boolean-state";
import { OnOffLightDevice } from "@matter/node/devices/on-off-light";
import { CERT_CONTEXT_FILE } from "../../src/controller/certContext.js";
import { ControllerCommandHandler } from "../../src/controller/ControllerCommandHandler.js";
import { ControllerNode, createControllerNode } from "../../src/controller/ControllerNode.js";

export const NODE_ID = NodeId(42n);

/**
 * A real {@link ControllerCommandHandler} and one commissioned light (endpoint 1: OnOff, BooleanState) on a simulated
 * network.
 */
export class HandlerSite {
    #simulator = new NetworkSimulator();
    #storage: Record<string, Record<string, Record<string, SupportedStorageTypes>>> = {};
    #nextHost = 1;
    #controller?: { resources: ControllerNode; handler: ControllerCommandHandler; crypto: MockCrypto };
    #device?: { node: ServerNode; light: Endpoint; crypto: MockCrypto };

    #environment(id: string) {
        const index = this.#nextHost++;
        const env = new Environment(`${id}-${index}`);
        const crypto = MockCrypto(index);
        env.set(Entropy, crypto);
        env.set(Crypto, crypto);
        env.set(Network, this.#simulator.addHost(index));
        this.#storage[id] ??= {};
        const record = this.#storage[id];
        new MockStorageService(env, () => new MemoryStorageDriver(record));
        return { env, crypto };
    }

    async startDevice(
        root: ServerNode.RootEndpoint = ServerNode.RootEndpoint,
        light: EndpointType = OnOffLightDevice.with(BooleanStateServer),
    ) {
        MockTime.reset();
        const { env, crypto } = this.#environment("device");
        const node = new ServerNode(root, { id: "device", environment: env });
        const endpoint = await node.add(light, { id: "light" });
        await node.start();
        this.#device = { node, light: endpoint, crypto };
    }

    get device() {
        if (this.#device === undefined) {
            throw new Error("Device not started");
        }
        return this.#device.node;
    }

    get light() {
        if (this.#device === undefined) {
            throw new Error("Device not started");
        }
        return this.#device.light;
    }

    get handler() {
        if (this.#controller === undefined) {
            throw new Error("Controller not started");
        }
        return this.#controller.handler;
    }

    get peer(): ClientNode {
        const peer = this.#controller?.resources.node.peers.commissioned[0];
        if (peer === undefined) {
            throw new Error("No commissioned peer");
        }
        return peer;
    }

    get hasAutoSubscription() {
        return this.peer.behaviors.internalsOf(NetworkClient).activeSubscription !== undefined;
    }

    get controller() {
        if (this.#controller === undefined) {
            throw new Error("Controller not started");
        }
        return this.#controller.resources;
    }

    async startController(
        disableAutoSubscription: boolean,
        {
            otaEnabled = false,
            threadDiagnosticsEnabled = false,
            certContextFile,
        }: { otaEnabled?: boolean; threadDiagnosticsEnabled?: boolean; certContextFile?: string } = {},
    ) {
        const { env, crypto } = this.#environment("controller");
        if (certContextFile !== undefined) {
            const fs = new MockFilesystem();
            await fs.file(CERT_CONTEXT_FILE).write(certContextFile);
            env.set(Filesystem, fs);
        }
        const resources = await createControllerNode({
            environment: env,
            id: "controller",
            adminFabricLabel: "TestFabric",
            serverVersion: "1.0.0",
            enableOtaProvider: otaEnabled,
            peerSettingsRepair: {
                hasRepairedPeerSettings: () => true,
                markPeerSettingsRepaired: async () => {},
            },
            disableAutoSubscription,
        });
        const handler = new ControllerCommandHandler(resources, {
            bleEnabled: false,
            bleProxyEnabled: false,
            otaEnabled,
            threadDiagnosticsEnabled,
            disableAutoSubscription,
        });
        await MockTime.resolve(handler.initializeNodes(), { macrotasks: true });
        this.#controller = { resources, handler, crypto };
        return handler;
    }

    async commission() {
        const controller = this.#controller;
        if (controller === undefined) {
            throw new Error("Controller not started");
        }
        // Session ids collide without entropy while pairing.
        const deviceCrypto = this.#device?.crypto;
        if (deviceCrypto === undefined) {
            throw new Error("Device not started");
        }
        controller.crypto.entropic = deviceCrypto.entropic = true;
        try {
            const { passcode, discriminator } = this.device.state.commissioning;
            await MockTime.resolve(
                controller.handler.commissionNode({ nodeId: NODE_ID, passcode, longDiscriminator: discriminator }),
                { macrotasks: true },
            );
        } finally {
            controller.crypto.entropic = deviceCrypto.entropic = false;
        }
        await this.settle();
    }

    /** Long enough for every started peer to establish its sustained subscription. */
    async settle(duration = Seconds(60)) {
        await MockTime.resolve(Time.sleep("settle", duration), { macrotasks: true });
    }

    async stopController() {
        const controller = this.#controller;
        this.#controller = undefined;
        if (controller === undefined) {
            return;
        }
        await MockTime.resolve(controller.handler.close(), { macrotasks: true });
        await MockTime.resolve(controller.resources.close(), { macrotasks: true });
    }

    async close() {
        await this.stopController();
        if (this.#device !== undefined) {
            await MockTime.resolve(this.#device.node.close(), { macrotasks: true });
        }
    }
}
