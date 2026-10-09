/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { AttributeId, ClusterId, FabricIndex, NodeId } from "@matter/main";
import { EnergyEvse } from "@matter/main/clusters/energy-evse";
import { OnOff } from "@matter/main/clusters/on-off";
import { PeerAddress } from "@matter/main/protocol";
import { ControllerCommandHandler } from "../src/controller/ControllerCommandHandler.js";
import { ServerError, ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";

const FABRIC_INDEX = FabricIndex(7);
const GROUP_NODE_ID = NodeId.fromGroupId(4);

/** A write request as it reaches matter.js, in the only shape a group write may take. */
interface CapturedWrite {
    timedRequest: boolean;
    writeRequests: Array<{ path: { endpointId?: number; clusterId?: number; attributeId?: number } }>;
}

interface CapturedInvoke {
    timedRequest: boolean;
    invokeRequests: Array<{ commandPath: { endpointId?: number; clusterId?: number; commandId?: number } }>;
}

interface Capture {
    addresses: PeerAddress[];
    writes: CapturedWrite[];
    invokes: CapturedInvoke[];
}

/**
 * A command handler whose matter.js peer lookup (`peers.forAddress`, then `interaction`) is recorded
 * instead of performed.
 */
function stubHandler(capture: Capture): { handler: ControllerCommandHandler; capture: Capture } {
    const peer = {
        nodeType: "group",
        interaction: {
            write(request: CapturedWrite) {
                capture.writes.push(request);
                return Promise.resolve(undefined);
            },
            invoke(request: CapturedInvoke) {
                capture.invokes.push(request);
                return (async function* () {})();
            },
        },
    };

    const controller = {
        fabric: { fabricIndex: FABRIC_INDEX },
        node: {
            peers: {
                forAddress(address: PeerAddress) {
                    capture.addresses.push(address);
                    return Promise.resolve(peer);
                },
            },
        },
    };

    const handler = new ControllerCommandHandler(
        controller as unknown as ConstructorParameters<typeof ControllerCommandHandler>[0],
        { bleEnabled: false, bleProxyEnabled: false, otaEnabled: false },
    );
    return { handler, capture };
}

/** The rejection reason, so a test can assert the error's code as well as its type. */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
    return promise.then(
        () => undefined,
        (error: unknown) => error,
    );
}

function freshCapture(): Capture {
    return { addresses: [], writes: [], invokes: [] };
}

describe("groupcast", () => {
    describe("handleGroupWriteAttribute", () => {
        it("multicasts to a group address with a wildcard endpoint and no timed request", async () => {
            const { handler, capture } = stubHandler(freshCapture());

            await handler.handleGroupWriteAttribute({
                nodeId: GROUP_NODE_ID,
                clusterId: ClusterId(OnOff.Cluster.id),
                attributeId: AttributeId(OnOff.Cluster.attributes.onTime.id),
                value: 5,
            });

            expect(capture.addresses.length).to.equal(1);
            const address = capture.addresses[0];
            expect(PeerAddress.isGroup(address)).to.equal(true);
            expect(address.fabricIndex).to.equal(FABRIC_INDEX);
            expect(address.nodeId).to.equal(GROUP_NODE_ID);

            expect(capture.writes.length).to.equal(1);
            const write = capture.writes[0];
            // The three conditions matter.js's ClientGroupInteraction.write rejects a request on.
            expect(write.timedRequest).to.equal(false);
            expect(write.writeRequests.length).to.equal(1);
            expect(write.writeRequests[0].path.endpointId).to.equal(undefined);
            expect(write.writeRequests[0].path.clusterId).to.equal(OnOff.Cluster.id);
            expect(write.writeRequests[0].path.attributeId).to.equal(OnOff.Cluster.attributes.onTime.id);
        });

        it("refuses an unknown attribute before building an address", async () => {
            const { handler, capture } = stubHandler(freshCapture());

            const error = await rejection(
                handler.handleGroupWriteAttribute({
                    nodeId: GROUP_NODE_ID,
                    clusterId: ClusterId(OnOff.Cluster.id),
                    attributeId: AttributeId(0x0042),
                    value: 1,
                }),
            );
            expect(error).to.be.instanceOf(ServerError);
            expect((error as ServerError).code).to.equal(ServerErrorCode.InvalidArguments);
            expect((error as ServerError).message).to.contain("66");
            expect(capture.addresses.length).to.equal(0);
        });
    });

    describe("handleGroupInvoke", () => {
        it("multicasts a command with a wildcard endpoint and no timed request", async () => {
            const { handler, capture } = stubHandler(freshCapture());

            await handler.handleGroupInvoke({
                nodeId: GROUP_NODE_ID,
                clusterId: ClusterId(OnOff.Cluster.id),
                commandName: "toggle",
                data: {},
            });

            expect(capture.addresses.length).to.equal(1);
            expect(PeerAddress.isGroup(capture.addresses[0])).to.equal(true);

            expect(capture.invokes.length).to.equal(1);
            const invoke = capture.invokes[0];
            // The two conditions matter.js's ClientGroupInteraction.invoke rejects a request on.
            expect(invoke.timedRequest).to.equal(false);
            expect(invoke.invokeRequests.length).to.equal(1);
            expect(invoke.invokeRequests[0].commandPath.endpointId).to.equal(undefined);
            expect(invoke.invokeRequests[0].commandPath.clusterId).to.equal(OnOff.Cluster.id);
            expect(invoke.invokeRequests[0].commandPath.commandId).to.equal(OnOff.Cluster.commands.toggle.id);
        });

        it("refuses a command the cluster does not define before building an address", async () => {
            const { handler, capture } = stubHandler(freshCapture());

            const error = await rejection(
                handler.handleGroupInvoke({
                    nodeId: GROUP_NODE_ID,
                    clusterId: ClusterId(OnOff.Cluster.id),
                    commandName: "notACommand",
                    data: {},
                }),
            );
            expect(error).to.be.instanceOf(ServerError);
            expect((error as ServerError).code).to.equal(ServerErrorCode.InvalidArguments);
            expect((error as ServerError).message).to.contain("notACommand");
            expect(capture.addresses.length).to.equal(0);
        });

        it("refuses a command the specification requires to be invoked as a timed request", async () => {
            const { handler, capture } = stubHandler(freshCapture());

            const error = await rejection(
                handler.handleGroupInvoke({
                    nodeId: GROUP_NODE_ID,
                    clusterId: ClusterId(EnergyEvse.Cluster.id),
                    commandName: "disable",
                    data: {},
                }),
            );
            expect(error).to.be.instanceOf(ServerError);
            expect((error as ServerError).code).to.equal(ServerErrorCode.InvalidArguments);
            expect((error as ServerError).message).to.contain("timed request");
            expect(capture.addresses.length).to.equal(0);
        });
    });
});
