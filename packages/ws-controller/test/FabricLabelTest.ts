/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ControllerBehavior, Endpoint, FabricId, FabricIndex, NetworkClient, NodeId, ServerNode } from "@matter/main";
import { OperationalCredentialsServer } from "@matter/node/behaviors/operational-credentials";
import { Fabric, FabricAuthority, FabricManager, SustainedSubscription } from "@matter/protocol";
import { CameraControllerEndpoint, ControllerCommandHandler } from "../src/controller/ControllerCommandHandler.js";
import { TestSite } from "./support/ControllerSite.js";

describe("setFabricLabel", () => {
    let site: TestSite;
    let controller: ServerNode;
    let device: ServerNode;
    let handler: ControllerCommandHandler;

    beforeEach(async () => {
        MockTime.reset();
        site = new TestSite();
        ({ controller, device } = await site.startPair());
        await site.commission(controller, device);

        handler = new ControllerCommandHandler(
            {
                node: controller,
                fabricIndex: controller.env.get(FabricManager).fabrics[0].fabricIndex,
                otaProvider: undefined,
                webRtcRequestor: await controller.add(
                    new Endpoint(CameraControllerEndpoint, { id: "camera-controller" }),
                ),
            },
            { bleEnabled: false, bleProxyEnabled: false, otaEnabled: false },
        );
        await MockTime.resolve(handler.initializeNodes(), { macrotasks: true });
        await awaitSubscribed();
    });

    afterEach(async () => {
        await MockTime.resolve(handler.close(), { macrotasks: true });
        await site.close();
    });

    async function awaitSubscribed() {
        const peer = controller.peers.commissioned[0];
        const subscription = peer.behaviors.internalsOf(NetworkClient).activeSubscription;
        expect(subscription).not.undefined;
        await MockTime.resolve((subscription as SustainedSubscription).active);
    }

    function deviceLabel() {
        return device.stateOf(OperationalCredentialsServer).fabrics[0]?.label;
    }

    it("tells a connected node about the new label", async () => {
        await MockTime.resolve(handler.setFabricLabel("Living Room"), { macrotasks: true });

        expect(handler.getFabricLabel()).equals("Living Room");
        expect(deviceLabel()).equals("Living Room");
    });

    it("pushes every later change too", async () => {
        await MockTime.resolve(handler.setFabricLabel("First"), { macrotasks: true });
        await MockTime.resolve(handler.setFabricLabel("Second"), { macrotasks: true });

        expect(deviceLabel()).equals("Second");
    });

    it("keeps the new label when a node cannot be told", async () => {
        await MockTime.resolve(device.close(), { macrotasks: true });

        await MockTime.resolve(handler.setFabricLabel("Unreachable"), { macrotasks: true });

        expect(handler.getFabricLabel()).equals("Unreachable");
    });
});

describe("setFabricLabel after commissioning replaced the fabric", () => {
    let site: TestSite;
    let controller: ServerNode;
    let device: ServerNode;
    let handler: ControllerCommandHandler;
    let fabricIndex: FabricIndex;
    let fabricAtStart: Fabric;

    beforeEach(async () => {
        MockTime.reset();
        site = new TestSite();
        ({ controller, device } = await site.startPair());

        // Fresh storage as in createControllerNode: the fabric exists before the first commissioning,
        // whose own defaultFabric call then rotates the NOC and replaces the Fabric object.
        fabricAtStart = await (
            await controller.env.load(FabricAuthority)
        ).defaultFabric({
            adminFabricLabel: "TestFabric",
            adminFabricId: FabricId(1),
            adminNodeId: NodeId(112233),
        });
        fabricIndex = fabricAtStart.fabricIndex;
        handler = new ControllerCommandHandler(
            {
                node: controller,
                fabricIndex,
                otaProvider: undefined,
                webRtcRequestor: await controller.add(
                    new Endpoint(CameraControllerEndpoint, { id: "camera-controller" }),
                ),
            },
            { bleEnabled: false, bleProxyEnabled: false, otaEnabled: false },
        );
        await MockTime.resolve(handler.start(), { macrotasks: true });
        await site.commission(controller, device);
    });

    afterEach(async () => {
        await MockTime.resolve(handler.close(), { macrotasks: true });
        await site.close();
    });

    it("sets the label on the fabric matter.js currently holds", async () => {
        expect(controller.env.get(FabricManager).for(fabricIndex)).not.equal(fabricAtStart);

        await MockTime.resolve(handler.setFabricLabel("Living Room"), { macrotasks: true });

        expect(controller.env.get(FabricManager).for(fabricIndex).label).equals("Living Room");
        expect(handler.getFabricLabel()).equals("Living Room");
    });

    it("keeps the new label when another node is commissioned", async () => {
        await MockTime.resolve(handler.setFabricLabel("Living Room"), { macrotasks: true });

        const second = await site.addDevice("device2");
        await site.commission(controller, second);

        expect(controller.env.get(FabricManager).for(fabricIndex).label).equals("Living Room");
        expect(second.stateOf(OperationalCredentialsServer).fabrics[0]?.label).equals("Living Room");
    });

    // Characterization test: proves Fabric persistence only; production restarts take the label from the server config.
    it("persists the new label with the fabric", async () => {
        await MockTime.resolve(handler.setFabricLabel("Living Room"), { macrotasks: true });
        await MockTime.resolve(handler.close(), { macrotasks: true });
        await MockTime.resolve(controller.close(), { macrotasks: true });

        const restarted = await site.addController();
        await MockTime.resolve(restarted.start(), { macrotasks: true });

        expect(restarted.env.get(FabricManager).for(fabricIndex).label).equals("Living Room");
    });
});

describe("setFabricLabel before the first commissioning of this run", () => {
    let site: TestSite;
    let controller: ServerNode;
    let handler: ControllerCommandHandler;
    let fabricIndex: FabricIndex;

    beforeEach(async () => {
        MockTime.reset();
        site = new TestSite();
        ({ controller } = await site.startPair());
        ({ fabricIndex } = await (
            await controller.env.load(FabricAuthority)
        ).defaultFabric({
            adminFabricLabel: "matter.js",
            adminFabricId: FabricId(1),
            adminNodeId: NodeId(112233),
        }));
        handler = new ControllerCommandHandler(
            {
                node: controller,
                fabricIndex,
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

    it("keeps the new label while the controller behavior loads", async () => {
        await MockTime.resolve(handler.setFabricLabel("Living Room"), { macrotasks: true });

        expect(controller.env.get(FabricManager).for(fabricIndex).label).equals("Living Room");
        expect(handler.getFabricLabel()).equals("Living Room");
        expect(controller.stateOf(ControllerBehavior).adminFabricLabel).equals("Living Room");
    });
});
