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
import { ControllerBehavior, ServerNode } from "@matter/main";
import { BooleanStateServer } from "@matter/node/behaviors/boolean-state";
import { OnOffLightDevice } from "@matter/node/devices/on-off-light";
import { FabricId } from "@matter/types";

const ControllerRootEndpoint = ServerNode.RootEndpointWithoutGroupcast.with(ControllerBehavior);

/**
 * A controller and a light on one simulated network, so the bus runs against a real peer endpoint tree
 * rather than synthesised change records. Commissioning is a separate step so a test can observe the
 * seeding read it triggers.
 */
export class TestSite {
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
        const controller = await this.addController();
        const device = await this.#addNode({ id: "device" });
        const light = await device.add(OnOffLightDevice.with(BooleanStateServer), { id: "light" });

        await device.start();
        await controller.start();

        return { controller, device, light };
    }

    /**
     * A controller node that is not started yet. All controllers share one storage, so a controller added
     * after another one closed restores the peers that one commissioned.
     */
    addController() {
        return this.#addNode({
            id: "controller",
            type: ControllerRootEndpoint,
            commissioning: { enabled: false },
            controller: { adminFabricId: FabricId(1) },
        });
    }

    /** A second commissionable device on the same simulated network. */
    async addDevice(id: string) {
        const device = await this.#addNode({ id });
        await device.add(OnOffLightDevice.with(BooleanStateServer), { id: `${id}-light` });
        await device.start();
        return device;
    }

    async commission(controller: ServerNode, device: ServerNode) {
        const { passcode, discriminator } = device.state.commissioning;
        await this.pairing(controller, device, () =>
            controller.peers.commission({ passcode, discriminator, timeout: Seconds(90) }),
        );
    }

    /** Runs `act`, which commissions the device by any route, with the entropy pairing needs. */
    async pairing<T>(controller: ServerNode, device: ServerNode, act: () => Promise<T>) {
        // Session ids collide without entropy while pairing.
        const controllerCrypto = controller.env.get(Crypto) as MockCrypto;
        const deviceCrypto = device.env.get(Crypto) as MockCrypto;
        controllerCrypto.entropic = deviceCrypto.entropic = true;
        try {
            return await MockTime.resolve(act(), { macrotasks: true });
        } finally {
            controllerCrypto.entropic = deviceCrypto.entropic = false;
        }
    }

    async close() {
        await MockTime.resolve(Promise.allSettled([...this.#nodes].map(node => node.close())), { macrotasks: true });
    }
}
