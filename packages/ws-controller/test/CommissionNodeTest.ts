/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Crypto, FabricId, MockCrypto, NodeId, ServerNode } from "@matter/main";
import { Endpoint } from "@matter/node";
import { FabricAuthority } from "@matter/protocol";
import { CameraControllerEndpoint, ControllerCommandHandler } from "../src/controller/ControllerCommandHandler.js";
import { TestSite } from "./support/ControllerSite.js";

const NODE_ID = NodeId(42n);

describe("commissionNode", () => {
    let site: TestSite;
    let controller: ServerNode;
    let device: ServerNode;
    let handler: ControllerCommandHandler;

    beforeEach(async () => {
        MockTime.reset();
        site = new TestSite();
        ({ controller, device } = await site.startPair());

        // The controller has no fabric until something creates one; production does this in
        // createControllerNode, before the command handler exists.
        const fabric = await (
            await controller.env.load(FabricAuthority)
        ).defaultFabric({
            adminFabricLabel: "TestFabric",
            adminFabricId: FabricId(1),
            adminNodeId: NodeId(112233),
        });
        handler = new ControllerCommandHandler(
            controller,
            fabric,
            undefined,
            await controller.add(new Endpoint(CameraControllerEndpoint, { id: "camera-controller" })),
            false,
            false,
            false,
        );
        await MockTime.resolve(handler.start(), { macrotasks: true });
    });

    afterEach(async () => {
        await MockTime.resolve(handler.close(), { macrotasks: true });
        await site.close();
    });

    /** Session ids collide without entropy while pairing. */
    async function commissioning<T>(act: () => Promise<T>) {
        const controllerCrypto = controller.env.get(Crypto) as MockCrypto;
        const deviceCrypto = device.env.get(Crypto) as MockCrypto;
        controllerCrypto.entropic = deviceCrypto.entropic = true;
        try {
            return await MockTime.resolve(act(), { macrotasks: true });
        } finally {
            controllerCrypto.entropic = deviceCrypto.entropic = false;
        }
    }

    function request(knownAddress?: { ip: string; port: number }) {
        const { passcode, discriminator } = device.state.commissioning;
        return { nodeId: NODE_ID, passcode, longDiscriminator: discriminator, knownAddress };
    }

    it("commissions a device found by discovery", async () => {
        const { nodeId } = await commissioning(() => handler.commissionNode(request()));

        expect(nodeId).equals(NODE_ID);
        expect(handler.isNodeIdInUse(NODE_ID)).equals(true);
    });

    it("commissions a device at the address the caller supplied", async () => {
        // A discriminator no advertisement carries, so only the supplied address can reach this device:
        // falling back to discovery would find nothing.
        const { passcode } = device.state.commissioning;
        const port = device.state.network.operationalPort;
        const { nodeId } = await commissioning(() =>
            handler.commissionNode({
                nodeId: NODE_ID,
                passcode,
                longDiscriminator: 0xfff,
                knownAddress: { ip: "10.10.10.2", port },
            }),
        );

        expect(nodeId).equals(NODE_ID);
        expect(handler.isNodeIdInUse(NODE_ID)).equals(true);
    });

    it("falls back to discovery when the supplied address is stale", async () => {
        const { nodeId } = await commissioning(() =>
            handler.commissionNode(request({ ip: "10.10.10.99", port: 5540 })),
        );

        expect(nodeId).equals(NODE_ID);
        expect(handler.isNodeIdInUse(NODE_ID)).equals(true);
    });
});
