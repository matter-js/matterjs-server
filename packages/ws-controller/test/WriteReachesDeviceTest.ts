/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Endpoint, NetworkClient, NodeId, ServerNode } from "@matter/main";
import { AccessControl } from "@matter/main/clusters/access-control";
import { BasicInformation } from "@matter/main/clusters/basic-information";
import { Fabric, FabricManager, SustainedSubscription } from "@matter/main/protocol";
import { AttributeId, ClusterId, EndpointNumber, Status } from "@matter/main/types";
import { InteractionServer } from "@matter/node";
import { AccessControlServer } from "@matter/node/behaviors/access-control";
import { BasicInformationServer } from "@matter/node/behaviors/basic-information";
import { BindingServer } from "@matter/node/behaviors/binding";
import { BooleanStateServer } from "@matter/node/behaviors/boolean-state";
import { OnOffServer } from "@matter/node/behaviors/on-off";
import { OnOffLightDevice } from "@matter/node/devices/on-off-light";
import { CameraControllerEndpoint, ControllerCommandHandler } from "../src/controller/ControllerCommandHandler.js";
import { nodeIdOf } from "../src/util/nodeIdOf.js";
import { TestSite } from "./support/ControllerSite.js";

const LIGHT_ENDPOINT = EndpointNumber(1);

describe("writeAttribute", () => {
    let site: TestSite;
    let controller: ServerNode;
    let device: ServerNode;
    let light: Endpoint;
    let fabric: Fabric;
    let handler: ControllerCommandHandler;
    let nodeId: NodeId;
    let writeRequests: number;

    beforeEach(async () => {
        MockTime.reset();
        site = new TestSite();
        ({ controller, device, light } = await site.startPairWith(node =>
            node.add(OnOffLightDevice.with(BooleanStateServer, BindingServer), { id: "light" }),
        ));
        await site.commission(controller, device);

        fabric = controller.env.get(FabricManager).fabrics[0];
        handler = new ControllerCommandHandler(
            {
                node: controller,
                fabricIndex: fabric.fabricIndex,
                otaProvider: undefined,
                webRtcRequestor: await controller.add(
                    new Endpoint(CameraControllerEndpoint, { id: "camera-controller" }),
                ),
            },
            { bleEnabled: false, bleProxyEnabled: false, otaEnabled: false },
        );
        await MockTime.resolve(handler.initializeNodes(), { macrotasks: true });

        const peer = controller.peers.commissioned[0];
        nodeId = nodeIdOf(peer);
        const subscription = peer.behaviors.internalsOf(NetworkClient).activeSubscription;
        if (!(subscription instanceof SustainedSubscription)) {
            throw new Error("Peer has no sustained subscription");
        }
        await MockTime.resolve(subscription.active);

        writeRequests = 0;
        const interactionServer = device.env.get(InteractionServer);
        const handleWriteRequest = interactionServer.handleWriteRequest.bind(interactionServer);
        interactionServer.handleWriteRequest = (...args) => {
            writeRequests++;
            return handleWriteRequest(...args);
        };
    });

    afterEach(async () => {
        await MockTime.resolve(handler.close(), { macrotasks: true });
        await site.close();
    });

    function writeNodeLabel(value: unknown) {
        return MockTime.resolve(
            handler.handleWriteAttribute({
                nodeId,
                endpointId: EndpointNumber(0),
                clusterId: ClusterId(BasicInformation.Cluster.id),
                attributeId: AttributeId(BasicInformation.Cluster.attributes.nodeLabel.id),
                value,
            }),
            { macrotasks: true },
        );
    }

    it("sends a write for every request, also when the value equals the cached one", async () => {
        const first = await writeNodeLabel("Kitchen");
        const second = await writeNodeLabel("Kitchen");

        expect(first.map(({ status }) => status)).deep.equals([Status.Success]);
        expect(second.map(({ status }) => status)).deep.equals([Status.Success]);
        expect(writeRequests).equals(2);
        expect(device.stateOf(BasicInformationServer).nodeLabel).equals("Kitchen");
    });

    it("returns the status the device answered, also when the value equals the cached one", async () => {
        const { vendorName } = device.stateOf(BasicInformationServer);

        const result = await MockTime.resolve(
            handler.handleWriteAttribute({
                nodeId,
                endpointId: EndpointNumber(0),
                clusterId: ClusterId(BasicInformation.Cluster.id),
                attributeId: AttributeId(BasicInformation.Cluster.attributes.vendorName.id),
                value: vendorName,
            }),
            { macrotasks: true },
        );

        expect(result.map(({ status }) => status)).deep.equals([Status.UnsupportedWrite]);
        expect(writeRequests).equals(1);
    });

    it("refuses a value that violates a constraint without sending it", async () => {
        const { nodeLabel } = device.stateOf(BasicInformationServer);

        const result = await writeNodeLabel("x".repeat(33));

        expect(result.map(({ status }) => status)).deep.equals([Status.ConstraintError]);
        expect(writeRequests).equals(0);
        expect(device.stateOf(BasicInformationServer).nodeLabel).equals(nodeLabel);
    });

    it("refuses a value of the wrong type without sending it", async () => {
        const result = await writeNodeLabel(42);

        expect(result.map(({ status }) => status)).deep.equals([Status.InvalidDataType]);
        expect(writeRequests).equals(0);
    });

    it("refuses an entry missing a mandatory field without sending it", async () => {
        const result = await MockTime.resolve(
            // @ts-expect-error deliberately invalid client input: privilege is mandatory
            handler.setAclEntry(nodeId, [{ auth_mode: 2, subjects: [fabric.rootNodeId], targets: null }]),
            { macrotasks: true },
        );

        expect(result?.[0].status).equals(Status.InvalidAction);
        expect(writeRequests).equals(0);
    });

    function nodeLabelChanges() {
        const changes = new Array<unknown>();
        handler.events.attributeChanged.on((_nodeId, { path, value }) => {
            if (
                path.endpointId === 0 &&
                path.clusterId === BasicInformation.Cluster.id &&
                path.attributeId === BasicInformation.Cluster.attributes.nodeLabel.id
            ) {
                changes.push(value);
            }
        });
        return changes;
    }

    it("emits the written value once when the subscription reports it as well", async () => {
        const changes = nodeLabelChanges();

        await writeNodeLabel("Hallway");

        // Reports arrive in order: once a later device-side change is reported, the label's report was processed too.
        const reported = new Promise<void>(resolve =>
            handler.events.attributeChanged.on((_nodeId, { path }) => {
                if (path.clusterId === OnOffServer.cluster.id) {
                    resolve();
                }
            }),
        );
        await MockTime.resolve(light.setStateOf(OnOffServer, { onOff: !light.stateOf(OnOffServer).onOff }), {
            macrotasks: true,
        });
        await MockTime.resolve(reported, { macrotasks: true });

        expect(changes).deep.equals(["Hallway"]);
    });

    it("emits the written value when the node has no subscription to report it", async () => {
        const peer = controller.peers.commissioned[0];
        await MockTime.resolve(peer.set({ network: { autoSubscribe: false } }), { macrotasks: true });
        expect(peer.behaviors.internalsOf(NetworkClient).activeSubscription).undefined;
        const changes = nodeLabelChanges();

        await writeNodeLabel("Porch");

        expect(changes).deep.equals(["Porch"]);
    });

    it("writes ACL entries, keeping the controller's own entry", async () => {
        const entries = [
            { privilege: 5, auth_mode: 2, subjects: [fabric.rootNodeId], targets: null },
            { privilege: 3, auth_mode: 2, subjects: [0x1234], targets: null },
        ];

        const first = await MockTime.resolve(handler.setAclEntry(nodeId, entries), { macrotasks: true });
        const second = await MockTime.resolve(handler.setAclEntry(nodeId, entries), { macrotasks: true });

        expect(first?.[0].status).equals(Status.Success);
        expect(second?.[0].status).equals(Status.Success);
        expect(writeRequests).equals(2);
        const acl = device.stateOf(AccessControlServer).acl;
        expect(acl.map(({ privilege, subjects }) => ({ privilege, subjects }))).deep.equals([
            { privilege: AccessControl.AccessControlEntryPrivilege.Administer, subjects: [fabric.rootNodeId] },
            { privilege: AccessControl.AccessControlEntryPrivilege.Operate, subjects: [NodeId(0x1234)] },
        ]);
    });

    it("writes bindings, also when they equal the current ones", async () => {
        const bindingsToWrite = [
            { node: 5, group: null, endpoint: 1, cluster: 6 },
            { node: null, group: 7, endpoint: null, cluster: null },
        ];

        const first = await MockTime.resolve(handler.setNodeBinding(nodeId, LIGHT_ENDPOINT, bindingsToWrite), {
            macrotasks: true,
        });
        const second = await MockTime.resolve(handler.setNodeBinding(nodeId, LIGHT_ENDPOINT, bindingsToWrite), {
            macrotasks: true,
        });

        expect(first?.[0].status).equals(Status.Success);
        expect(second?.[0].status).equals(Status.Success);
        expect(writeRequests).equals(2);
        const bindings = light.stateOf(BindingServer).binding;
        expect(bindings.map(({ node, group, endpoint, cluster }) => ({ node, group, endpoint, cluster }))).deep.equals([
            { node: NodeId(5), group: undefined, endpoint: EndpointNumber(1), cluster: ClusterId(6) },
            { node: undefined, group: 7, endpoint: undefined, cluster: undefined },
        ]);
    });
});
