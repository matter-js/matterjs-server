/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Endpoint, NetworkClient, ServerNode } from "@matter/main";
import { OperationalCredentialsServer } from "@matter/node/behaviors/operational-credentials";
import { FabricManager, SustainedSubscription } from "@matter/protocol";
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

        const fabric = controller.env.get(FabricManager).fabrics[0];
        handler = new ControllerCommandHandler(
            controller,
            fabric,
            undefined,
            await controller.add(new Endpoint(CameraControllerEndpoint, { id: "camera-controller" })),
            false,
            false,
            false,
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
