/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClientNode, ClusterId, Duration, EndpointNumber, Millis } from "@matter/main";
import { InvokeRequest } from "../src/types/CommandHandler.js";
import { HandlerSite, NODE_ID } from "./support/HandlerSite.js";
import { InteractionWsHarness } from "./support/InteractionWsHarness.js";

const ON_OFF_CLUSTER = 6;

function countInvokes(peer: ClientNode) {
    const counter = { count: 0 };
    const interaction = peer.interaction;
    const invoke = interaction.invoke.bind(interaction);
    interaction.invoke = (request, session) => {
        counter.count++;
        return invoke(request, session);
    };
    return counter;
}

describe("invoke de-duplication", () => {
    describe("ControllerCommandHandler", () => {
        let site: HandlerSite;

        beforeEach(async () => {
            site = new HandlerSite();
            await site.startDevice();
            await site.startController(true);
            await site.commission();
        });

        afterEach(async () => {
            await site.close();
        });

        function toggle(
            dedupScope?: object,
            timedInteractionTimeoutMs?: Duration,
            interactionTimeoutMs?: Duration,
        ): InvokeRequest {
            return {
                nodeId: NODE_ID,
                endpointId: EndpointNumber(1),
                clusterId: ClusterId(ON_OFF_CLUSTER),
                commandName: "toggle",
                data: {},
                timedInteractionTimeoutMs,
                interactionTimeoutMs,
                dedupScope,
            };
        }

        const connA = {};
        const connB = {};

        async function invokeConcurrently(...requests: InvokeRequest[]) {
            const pending = requests.map(request => site.handler.handleInvoke(request));
            return await MockTime.resolve(Promise.all(pending), { macrotasks: true });
        }

        it("sends identical concurrent invokes of one scope to the device once", async () => {
            const invokes = countInvokes(site.peer);

            await invokeConcurrently(toggle(connA), toggle(connA));

            expect(invokes.count).equals(1);
        });

        it("sends identical concurrent invokes of different scopes to the device separately", async () => {
            const invokes = countInvokes(site.peer);

            await invokeConcurrently(toggle(connA), toggle(connB));

            expect(invokes.count).equals(2);
        });

        it("sends invokes that differ only in the timed interaction timeout to the device separately", async () => {
            const invokes = countInvokes(site.peer);

            await invokeConcurrently(toggle(connA), toggle(connA, Millis(5000)));

            expect(invokes.count).equals(2);
        });

        it("sends invokes that differ only in the interaction timeout to the device separately", async () => {
            const invokes = countInvokes(site.peer);

            await invokeConcurrently(toggle(connA), toggle(connA, undefined, Millis(30000)));

            expect(invokes.count).equals(2);
        });

        it("coalesces unscoped invokes only with each other", async () => {
            const invokes = countInvokes(site.peer);

            await invokeConcurrently(toggle(), toggle());
            expect(invokes.count).equals(1);

            await invokeConcurrently(toggle(), toggle(connA));
            expect(invokes.count).equals(3);
        });
    });

    describe("over WebSocket", () => {
        let harness: InteractionWsHarness;

        beforeEach(async () => {
            harness = await InteractionWsHarness.create();
        });

        afterEach(async () => {
            await harness.close();
        });

        const deviceCommand = {
            node_id: 1,
            endpoint_id: 1,
            cluster_id: ON_OFF_CLUSTER,
            command_name: "toggle",
            payload: {},
        };

        it("gives each connection its own dedup scope", async () => {
            const first = await harness.connect();
            const second = await harness.connect();

            await first.command("device_command", deviceCommand);
            await second.command("device_command", deviceCommand);
            await first.command("device_command", deviceCommand);

            const [a1, b, a2] = harness.invokeRequests.map(request => request.dedupScope);
            expect(harness.invokeRequests).length(3);
            expect(a1).an("object");
            expect(b).an("object");
            expect(a1).not.equals(b);
            expect(a2).equals(a1);
        });
    });
});
