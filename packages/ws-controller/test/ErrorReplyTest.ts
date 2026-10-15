/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClusterId, EndpointNumber } from "@matter/main";
import { CommissioningError } from "@matter/main/protocol";
import { ReceivedStatusResponseError, Status, StatusResponseError } from "@matter/main/types";
import { OnOffServer } from "@matter/node/behaviors/on-off";
import { OnOffLightDevice } from "@matter/node/devices/on-off-light";
import { ServerError, ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";
import { HandlerSite, NODE_ID } from "./support/HandlerSite.js";
import { InteractionWsHarness } from "./support/InteractionWsHarness.js";

const ON_OFF_CLUSTER = 6;

const deviceCommand = {
    node_id: 1,
    endpoint_id: 1,
    cluster_id: ON_OFF_CLUSTER,
    command_name: "toggle",
    payload: {},
};

describe("error replies", () => {
    let harness: InteractionWsHarness;

    beforeEach(async () => {
        harness = await InteractionWsHarness.create();
    });

    afterEach(async () => {
        await harness.close();
    });

    it("carry the status and cluster status the device answered with", async () => {
        const client = await harness.connect();
        harness.invokeError = new ReceivedStatusResponseError("failed", Status.Failure, 3);

        const reply = await client.command("device_command", deviceCommand);

        expect(reply.error_code).equals(ServerErrorCode.UnknownError);
        expect([reply.status, reply.cluster_status]).deep.equals([Status.Failure, 3]);
    });

    it("find the device status in the cause chain", async () => {
        const client = await harness.connect();
        harness.invokeError = new CommissioningError("wrapped", {
            cause: new AggregateError([
                new Error("other"),
                new ReceivedStatusResponseError("rejected", Status.ConstraintError),
            ]),
        });

        const reply = await client.command("device_command", deviceCommand);

        expect(reply.status).equals(Status.ConstraintError);
        expect(reply).not.have.property("cluster_status");
    });

    it("carry no status for a failure that is not a device status", async () => {
        const client = await harness.connect();
        harness.invokeError = new Error("transport failed");

        const reply = await client.command("device_command", deviceCommand);

        expect(reply.error_code).equals(ServerErrorCode.UnknownError);
        expect(reply).not.have.property("status");
        expect(reply).not.have.property("reason");
    });

    it("carry no status for a status error raised locally", async () => {
        const client = await harness.connect();
        harness.invokeError = StatusResponseError.create(Status.ConstraintError);

        const reply = await client.command("device_command", deviceCommand);

        expect(reply).not.have.property("status");
    });

    it("carry the reason of a server error", async () => {
        const client = await harness.connect();
        harness.invokeError = ServerError.nodeCommissionFailed("Commission failed: timed out", "timeout");

        const reply = await client.command("device_command", deviceCommand);

        expect([reply.error_code, reply.reason]).deep.equals([ServerErrorCode.NodeCommissionFailed, "timeout"]);
    });
});

describe("write_attribute results", () => {
    let harness: InteractionWsHarness;

    beforeEach(async () => {
        harness = await InteractionWsHarness.create();
    });

    afterEach(async () => {
        await harness.close();
    });

    it("carry the cluster status when the device returned one", async () => {
        const client = await harness.connect();
        harness.writeResult = [
            { endpointId: 1, clusterId: ON_OFF_CLUSTER, attributeId: 0, status: Status.Failure, clusterStatus: 2 },
        ];

        const reply = await client.command("write_attribute", { node_id: 1, attribute_path: "1/6/0", value: true });

        expect(reply.result).deep.equals([
            { Path: { EndpointId: 1, ClusterId: 6, AttributeId: 0 }, Status: Status.Failure, ClusterStatus: 2 },
        ]);
    });

    it("reject an out-of-range id as invalid arguments", async () => {
        const client = await harness.connect();

        const reply = await client.command("write_attribute", {
            node_id: 1,
            attribute_path: "1/32768/0",
            value: true,
        });

        expect(reply.error_code).equals(ServerErrorCode.InvalidArguments);
    });

    it("leave the cluster status out otherwise", async () => {
        const client = await harness.connect();

        const reply = await client.command("write_attribute", { node_id: 1, attribute_path: "1/6/0", value: true });

        expect(reply.result).deep.equals([{ Path: { EndpointId: 1, ClusterId: 6, AttributeId: 0 }, Status: 0 }]);
    });
});

describe("device status of a command", () => {
    const UNKNOWN_STATUS: number = 0x02;
    let answer: StatusResponseError;

    class RejectingOnOffServer extends OnOffServer {
        override toggle() {
            throw answer;
        }
    }

    let site: HandlerSite;

    beforeEach(async () => {
        site = new HandlerSite();
        await site.startDevice(undefined, OnOffLightDevice.with(RejectingOnOffServer));
        await site.startController(true);
        await site.commission();
    });

    afterEach(async () => {
        await site.close();
    });

    async function toggleError() {
        const invoke = site.handler.handleInvoke({
            nodeId: NODE_ID,
            endpointId: EndpointNumber(1),
            clusterId: ClusterId(ON_OFF_CLUSTER),
            commandName: "toggle",
            data: {},
        });

        const error = await MockTime.resolve(
            invoke.then(
                () => undefined,
                (failure: unknown) => failure,
            ),
            { macrotasks: true },
        );

        if (!(error instanceof ReceivedStatusResponseError)) {
            throw new Error(`Expected a status received from the device, got ${String(error)}`);
        }
        return error;
    }

    it("is reported as received from the device", async () => {
        answer = new StatusResponseError("Refused", Status.Failure, 5);

        const error = await toggleError();

        expect([error.code, error.clusterCode]).deep.equals([Status.Failure, 5]);
    });

    it("is reported as received from the device also for a status code matter.js does not know", async () => {
        answer = new StatusResponseError("Odd", UNKNOWN_STATUS);

        const error = await toggleError();

        expect([error.code, error.message]).deep.equals([UNKNOWN_STATUS, "Unknown status response (code 2)"]);
    });
});
