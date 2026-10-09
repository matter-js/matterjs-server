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
            {
                node: controller,
                fabric,
                otaProvider: undefined,
                webRtcRequestor: await controller.add(
                    new Endpoint(CameraControllerEndpoint, { id: "camera-controller" }),
                ),
            },
            { bleEnabled: false, bleProxyEnabled: false, otaEnabled: false },
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

    it("reports every device that advertised, not just one", async () => {
        const second = await site.addDevice("device2");

        const discovered = await MockTime.resolve(handler.handleDiscovery({}), { macrotasks: true });

        const discriminators = discovered.map(({ longDiscriminator }) => longDiscriminator).sort();
        expect(discriminators).deep.equals(
            [device.state.commissioning.discriminator, second.state.commissioning.discriminator].sort(),
        );
    });

    it("reports a wrong pairing code as such", async () => {
        const { passcode, discriminator } = device.state.commissioning;
        const port = device.state.network.operationalPort;

        await expect(
            commissioning(() =>
                handler.commissionNode({
                    nodeId: NODE_ID,
                    passcode: passcode + 1,
                    longDiscriminator: discriminator,
                    knownAddress: { ip: "10.10.10.2", port },
                }),
            ),
        ).rejectedWith(/pairing code does not match/);

        expect(handler.isNodeIdInUse(NODE_ID)).equals(false);
    });

    it("falls back to discovery without a caller-chosen node id", async () => {
        // The node id is the server's to allocate, but a library caller may omit it. Nothing about the
        // fallback depends on it: whether the device joined is the peer's own answer.
        const { passcode, discriminator } = device.state.commissioning;
        const { nodeId } = await commissioning(() =>
            handler.commissionNode({
                passcode,
                longDiscriminator: discriminator,
                knownAddress: { ip: "10.10.10.99", port: 5540 },
            }),
        );

        expect(handler.isNodeIdInUse(nodeId)).equals(true);
    });

    it("falls back to discovery when the supplied address is stale", async () => {
        const { nodeId } = await commissioning(() =>
            handler.commissionNode(request({ ip: "10.10.10.99", port: 5540 })),
        );

        expect(nodeId).equals(NODE_ID);
        expect(handler.isNodeIdInUse(NODE_ID)).equals(true);
    });
});
