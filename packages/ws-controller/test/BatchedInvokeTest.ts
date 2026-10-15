/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClientNode, ClusterId, EndpointNumber, Millis } from "@matter/main";
import { OnOffLightDevice } from "@matter/main/devices/on-off-light";
import { Invoke } from "@matter/main/protocol";
import { Status, StatusResponseError } from "@matter/main/types";
import { OnOffServer } from "@matter/node/behaviors/on-off";
import { BatchedInvokeRequest } from "../src/types/CommandHandler.js";
import { ServerError, ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";
import { HandlerSite, NODE_ID } from "./support/HandlerSite.js";

const ON_OFF = ClusterId(6);

class RejectingOnOffServer extends OnOffServer {
    override on() {
        throw new StatusResponseError("refused", Status.Busy);
    }
}

function recordInvokes(peer: ClientNode) {
    const invokes = new Array<Invoke>();
    const interaction = peer.interaction;
    const invoke = interaction.invoke.bind(interaction);
    interaction.invoke = (request, session) => {
        invokes.push(request);
        return invoke(request, session);
    };
    return invokes;
}

async function refusalOf(pending: Promise<unknown>): Promise<ServerError> {
    try {
        await pending;
    } catch (error) {
        if (error instanceof ServerError) {
            return error;
        }
        throw error;
    }
    throw new Error("expected a refusal");
}

function command(endpoint: number, commandName: string) {
    return { endpointId: EndpointNumber(endpoint), clusterId: ON_OFF, commandName, data: {} };
}

describe("batched_device_commands on a commissioned device", () => {
    let site: HandlerSite;

    beforeEach(async () => {
        site = new HandlerSite();
        await site.startDevice();
        await site.device.add(OnOffLightDevice.with(RejectingOnOffServer), { id: "light2" });
        await site.startController(true);
        await site.commission();
    });

    afterEach(async () => {
        await site.close();
    });

    async function batch(request: Omit<BatchedInvokeRequest, "nodeId">) {
        return await MockTime.resolve(site.handler.handleBatchedInvoke({ nodeId: NODE_ID, ...request }), {
            macrotasks: true,
        });
    }

    it("sends all commands in one InvokeRequest and answers each in request order", async () => {
        const invokes = recordInvokes(site.peer);

        const results = await batch({ commands: [command(2, "on"), command(1, "on"), command(1, "toggle")] });

        expect(results).deep.equals([
            { status: Status.Busy, clusterStatus: undefined },
            { status: Status.Success, clusterStatus: undefined },
            { status: Status.Success, clusterStatus: undefined },
        ]);
        expect(invokes.map(({ invokeRequests }) => invokeRequests.map(({ commandRef }) => commandRef))).deep.equals([
            [0, 1, 2],
        ]);
        expect(site.light.stateOf("onOff").onOff).equals(false);
    });

    it("sends a single command at once instead of waiting for a batch window", async () => {
        const invokes = recordInvokes(site.peer);

        const results = await batch({ commands: [command(1, "on")] });

        expect(results.map(({ status }) => status)).deep.equals([Status.Success]);
        expect(invokes.map(({ batchDuration }) => batchDuration)).deep.equals([false]);
    });

    it("passes the timed request timeout and the processing time to the one invoke", async () => {
        const invokes = recordInvokes(site.peer);

        await batch({
            commands: [command(1, "on"), command(1, "off")],
            timedInteractionTimeoutMs: Millis(2000),
            interactionTimeoutMs: Millis(5000),
        });

        expect(
            invokes.map(({ timedRequest, timeout, expectedProcessingTime }) => ({
                timedRequest,
                timeout,
                expectedProcessingTime,
            })),
        ).deep.equals([{ timedRequest: true, timeout: Millis(2000), expectedProcessingTime: Millis(5000) }]);
    });

    it("refuses more commands than the node accepts per invoke without sending anything", async () => {
        const invokes = recordInvokes(site.peer);

        const refusal = await refusalOf(batch({ commands: Array.from({ length: 11 }, () => command(1, "toggle")) }));

        expect(refusal.code).equals(ServerErrorCode.InvalidArguments);
        expect(refusal.message).contains("at most 10");
        expect(invokes).length(0);
    });

    it("sends device_command with a timed request timeout of 0 as a timed request", async () => {
        const invokes = recordInvokes(site.peer);

        await MockTime.resolve(
            site.handler
                .handleInvoke({ nodeId: NODE_ID, ...command(1, "on"), timedInteractionTimeoutMs: Millis(0) })
                .catch(() => undefined),
            { macrotasks: true },
        );

        expect(invokes.map(({ timedRequest }) => timedRequest)).deep.equals([true]);
    });

    it("refuses command fields matter.js cannot encode without sending anything", async () => {
        const invokes = recordInvokes(site.peer);

        const refusal = await refusalOf(
            batch({ commands: [{ ...command(1, "onWithTimedOff"), data: { onOffControl: "not a bitmap" } }] }),
        );

        expect(refusal.code).equals(ServerErrorCode.InvalidArguments);
        expect(invokes).length(0);
    });

    it("refuses an unknown command of device_command as invalid arguments too", async () => {
        const invokes = recordInvokes(site.peer);

        const refusal = await refusalOf(
            MockTime.resolve(site.handler.handleInvoke({ nodeId: NODE_ID, ...command(1, "noSuchCommand") }), {
                macrotasks: true,
            }),
        );

        expect(refusal.code).equals(ServerErrorCode.InvalidArguments);
        expect(invokes).length(0);
    });

    it("refuses a command the node does not have without sending anything", async () => {
        const invokes = recordInvokes(site.peer);

        const refusal = await refusalOf(batch({ commands: [command(1, "on"), command(1, "noSuchCommand")] }));

        expect(refusal.code).equals(ServerErrorCode.InvalidArguments);
        expect(invokes).length(0);
    });
});
