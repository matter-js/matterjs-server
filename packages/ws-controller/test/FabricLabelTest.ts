/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ControllerBehavior,
    Endpoint,
    FabricId,
    FabricIndex,
    NetworkClient,
    NodeId,
    Seconds,
    ServerNode,
    Time,
} from "@matter/main";
import { Status, StatusResponseError } from "@matter/main/types";
import { OperationalCredentialsServer } from "@matter/node/behaviors/operational-credentials";
import { Fabric, FabricAuthority, FabricManager, NetworkProfiles, SustainedSubscription } from "@matter/protocol";
import { CameraControllerEndpoint, ControllerCommandHandler } from "../src/controller/ControllerCommandHandler.js";
import { TestSite } from "./support/ControllerSite.js";
import { captureLogs, LogCapture } from "./support/LogCapture.js";

/** Sets the label and waits until the connected nodes were told. */
async function setLabel(handler: ControllerCommandHandler, label: string) {
    const { pushed } = await MockTime.resolve(handler.setFabricLabel(label), { macrotasks: true });
    await MockTime.resolve(pushed, { macrotasks: true });
}

describe("setFabricLabel", () => {
    let site: TestSite;
    let controller: ServerNode;
    let device: ServerNode;
    let handler: ControllerCommandHandler;
    let logs: LogCapture | undefined;

    beforeEach(async () => {
        MockTime.reset();
        logs = undefined;
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
        logs?.stop();
        await MockTime.resolve(handler.close(), { macrotasks: true });
        await site.close();
    });

    function captureFabricLabelLogs() {
        logs = captureLogs("ControllerCommandHandler", /fabric label/);
        return logs;
    }

    /** Takes every slot of the "conservative" profile, so a push waits until the slots are closed. */
    async function holdConservativeSlots() {
        const profile = controller.env.get(NetworkProfiles).get("conservative");
        return MockTime.resolve(Promise.all(Array.from({ length: 4 }, () => profile.semaphore.obtainSlot())));
    }

    function release(slots: { close(): void }[]) {
        for (const slot of slots) {
            slot.close();
        }
    }

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
        await setLabel(handler, "Living Room");

        expect(handler.getFabricLabel()).equals("Living Room");
        expect(deviceLabel()).equals("Living Room");
    });

    it("pushes every later change too", async () => {
        await setLabel(handler, "First");
        await setLabel(handler, "Second");

        expect(deviceLabel()).equals("Second");
    });

    it("answers before the connected nodes were told", async () => {
        const labelBefore = deviceLabel();
        const { pushed } = await MockTime.resolve(handler.setFabricLabel("Living Room"), { macrotasks: true });

        expect(handler.getFabricLabel()).equals("Living Room");
        expect(deviceLabel()).equals(labelBefore);

        await MockTime.resolve(pushed, { macrotasks: true });
        expect(deviceLabel()).equals("Living Room");
    });

    it("queues the push behind other conservative traffic", async () => {
        const held = await holdConservativeSlots();
        const labelBefore = deviceLabel();

        const { pushed } = await MockTime.resolve(handler.setFabricLabel("Living Room"), { macrotasks: true });
        await MockTime.resolve(Time.sleep("other conservative traffic", Seconds(30)), { macrotasks: true });
        expect(deviceLabel()).equals(labelBefore);

        release(held);
        await MockTime.resolve(pushed, { macrotasks: true });
        expect(deviceLabel()).equals("Living Room");
    });

    function countLabelChanges() {
        const counter = { changes: 0 };
        device.eventsOf(OperationalCredentialsServer).fabrics$Changed.on(() => {
            counter.changes++;
        });
        return counter;
    }

    it("stops a running push when a newer label replaces it, without reporting a failure", async () => {
        const counter = countLabelChanges();
        const held = await holdConservativeSlots();
        const { lines } = captureFabricLabelLogs();

        const { pushed: firstPushed } = await MockTime.resolve(handler.setFabricLabel("First"), { macrotasks: true });
        const { pushed: secondPushed } = await MockTime.resolve(handler.setFabricLabel("Second"), {
            macrotasks: true,
        });
        release(held);
        await MockTime.resolve(Promise.all([firstPushed, secondPushed]), { macrotasks: true });

        expect(deviceLabel()).equals("Second");
        expect(counter.changes).equals(1);
        expect(lines.filter(line => line.includes("Stopped telling 1 node(s)"))).length(1);
        expect(lines.filter(line => line.includes("Could not update"))).length(0);
    });

    it("lets a third label stop the second push after the first push ended", async () => {
        const counter = countLabelChanges();
        const held = await holdConservativeSlots();

        const { pushed: firstPushed } = await MockTime.resolve(handler.setFabricLabel("First"), { macrotasks: true });
        const { pushed: secondPushed } = await MockTime.resolve(handler.setFabricLabel("Second"), {
            macrotasks: true,
        });
        await MockTime.resolve(firstPushed, { macrotasks: true });
        const { pushed: thirdPushed } = await MockTime.resolve(handler.setFabricLabel("Third"), { macrotasks: true });
        release(held);
        await MockTime.resolve(Promise.all([secondPushed, thirdPushed]), { macrotasks: true });

        expect(deviceLabel()).equals("Third");
        expect(counter.changes).equals(1);
    });

    it("stops a running push when the handler closes", async () => {
        const labelBefore = deviceLabel();
        const held = await holdConservativeSlots();
        const { lines } = captureFabricLabelLogs();

        const { pushed } = await MockTime.resolve(handler.setFabricLabel("Living Room"), { macrotasks: true });
        await MockTime.resolve(handler.close(), { macrotasks: true });
        await MockTime.resolve(pushed, { macrotasks: true });
        release(held);

        expect(deviceLabel()).equals(labelBefore);
        expect(lines.filter(line => line.includes("Could not update"))).length(0);
    });

    it("tells the nodes only the newer of two overlapping labels", async () => {
        const counter = countLabelChanges();

        const first = handler.setFabricLabel("First");
        const second = handler.setFabricLabel("Second");
        const [{ pushed: firstPushed }, { pushed: secondPushed }] = await MockTime.resolve(
            Promise.all([first, second]),
            { macrotasks: true },
        );
        await MockTime.resolve(Promise.all([firstPushed, secondPushed]), { macrotasks: true });

        expect(deviceLabel()).equals("Second");
        expect(counter.changes).equals(1);
    });

    it("keeps the new label when a node cannot be told", async () => {
        await MockTime.resolve(device.close(), { macrotasks: true });

        await setLabel(handler, "Unreachable");

        expect(handler.getFabricLabel()).equals("Unreachable");
    });

    it("reports a node that refuses the new label", async () => {
        const original = OperationalCredentialsServer.prototype.updateFabricLabel;
        OperationalCredentialsServer.prototype.updateFabricLabel = async () => {
            throw new StatusResponseError("Refused by the test", Status.Failure);
        };
        const { lines } = captureFabricLabelLogs();
        try {
            await setLabel(handler, "Refused");
        } finally {
            OperationalCredentialsServer.prototype.updateFabricLabel = original;
        }

        expect(handler.getFabricLabel()).equals("Refused");
        const warnings = lines.filter(
            line => line.includes(" WARN ") && line.includes("Could not update the fabric label"),
        );
        expect(warnings).length(1);
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

        await setLabel(handler, "Living Room");

        expect(controller.env.get(FabricManager).for(fabricIndex).label).equals("Living Room");
        expect(handler.getFabricLabel()).equals("Living Room");
    });

    it("keeps the new label when another node is commissioned", async () => {
        await setLabel(handler, "Living Room");

        const second = await site.addDevice("device2");
        await site.commission(controller, second);

        expect(controller.env.get(FabricManager).for(fabricIndex).label).equals("Living Room");
        expect(second.stateOf(OperationalCredentialsServer).fabrics[0]?.label).equals("Living Room");
    });

    // Characterization test: proves Fabric persistence only; production restarts take the label from the server config.
    it("persists the new label with the fabric", async () => {
        await setLabel(handler, "Living Room");
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
        await setLabel(handler, "Living Room");

        expect(controller.env.get(FabricManager).for(fabricIndex).label).equals("Living Room");
        expect(handler.getFabricLabel()).equals("Living Room");
        expect(controller.stateOf(ControllerBehavior).adminFabricLabel).equals("Living Room");
    });
});
