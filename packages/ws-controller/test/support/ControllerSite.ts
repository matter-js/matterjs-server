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

const ControllerRootEndpoint = ServerNode.RootEndpoint.with(ControllerBehavior);

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
