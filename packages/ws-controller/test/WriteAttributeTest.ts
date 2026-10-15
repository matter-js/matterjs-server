/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { AttributeId, ClientNode, ClusterId, EndpointNumber, Millis } from "@matter/main";
import { OnOffLightDevice } from "@matter/main/devices/on-off-light";
import { Write } from "@matter/main/protocol";
import { Status } from "@matter/main/types";
import { BooleanStateServer } from "@matter/node/behaviors/boolean-state";
import { UserLabelServer } from "@matter/node/behaviors/user-label";
import { WriteAttributeRequest } from "../src/types/CommandHandler.js";
import { ServerError, ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";
import { HandlerSite, NODE_ID } from "./support/HandlerSite.js";

const ON_OFF = ClusterId(6);
const ON_TIME = AttributeId(0x4001);

function recordWrites(peer: ClientNode) {
    const writes = new Array<Write>();
    const interaction = peer.interaction;
    const write = interaction.write.bind(interaction);
    interaction.write = (request, session) => {
        writes.push(request);
        return write(request, session);
    };
    return writes;
}

describe("write_attribute on a commissioned device", () => {
    let site: HandlerSite;

    beforeEach(async () => {
        site = new HandlerSite();
        await site.startDevice(undefined, OnOffLightDevice.with(BooleanStateServer, UserLabelServer));
        await site.device.add(OnOffLightDevice.with(UserLabelServer), { id: "light2" });
        await site.startController(true);
        await site.commission();
    });

    afterEach(async () => {
        await site.close();
    });

    async function write(request: Omit<WriteAttributeRequest, "nodeId" | "clusterId" | "attributeId">) {
        return await MockTime.resolve(
            site.handler.handleWriteAttribute({ nodeId: NODE_ID, clusterId: ON_OFF, attributeId: ON_TIME, ...request }),
            { macrotasks: true },
        );
    }

    it("writes one endpoint and answers with its status", async () => {
        const writes = recordWrites(site.peer);

        const results = await write({ endpointId: EndpointNumber(1), value: 7 });

        expect(results).deep.equals([
            { endpointId: 1, clusterId: ON_OFF, attributeId: ON_TIME, status: 0, clusterStatus: undefined },
        ]);
        expect(writes.map(({ timedRequest }) => timedRequest)).deep.equals([false]);
        expect(site.light.stateOf("onOff").onTime).equals(7);
    });

    it("writes every endpoint with the attribute for a wildcard endpoint, in one request", async () => {
        const writes = recordWrites(site.peer);

        const results = await write({ value: 9 });

        expect(results.map(({ endpointId, status }) => ({ endpointId, status }))).deep.equals([
            { endpointId: 1, status: 0 },
            { endpointId: 2, status: 0 },
        ]);
        expect(writes.map(({ writeRequests }) => writeRequests.map(({ path }) => path.endpointId))).deep.equals([
            [undefined],
        ]);
        expect(site.light.stateOf("onOff").onTime).equals(9);
        expect(site.device.parts.require("light2").stateOf("onOff").onTime).equals(9);
    });

    it("answers the device's status for a read-only attribute instead of writing the local cache", async () => {
        const results = await MockTime.resolve(
            site.handler.handleWriteAttribute({
                nodeId: NODE_ID,
                endpointId: EndpointNumber(1),
                clusterId: ClusterId(0x45),
                attributeId: AttributeId(0),
                value: true,
            }),
            { macrotasks: true },
        );

        expect(results.map(({ status }) => status)).deep.equals([Status.UnsupportedWrite]);
    });

    it("writes a list to a wildcard endpoint unchunked and answers one entry per endpoint", async () => {
        const writes = recordWrites(site.peer);
        const labels = [
            { label: "room", value: "kitchen" },
            { label: "floor", value: "1" },
        ];
        const results = await writeLabels({ value: labels.map(({ label, value }) => ({ "0": label, "1": value })) });

        expect(results.map(({ endpointId, status }) => ({ endpointId, status }))).deep.equals([
            { endpointId: 1, status: 0 },
            { endpointId: 2, status: 0 },
        ]);
        expect(site.light.stateOf("userLabel").labelList).deep.equals(labels);
        expect(writes.map(({ writeRequests }) => writeRequests.length)).deep.equals([1]);
    });

    async function writeLabels(request: Omit<WriteAttributeRequest, "nodeId" | "clusterId" | "attributeId">) {
        return await MockTime.resolve(
            site.handler.handleWriteAttribute({
                nodeId: NODE_ID,
                clusterId: ClusterId(0x41),
                attributeId: AttributeId(0),
                ...request,
            }),
            { macrotasks: true },
        );
    }

    it("answers a chunked timed list write of one endpoint with one entry", async () => {
        const writes = recordWrites(site.peer);

        const results = await writeLabels({
            endpointId: EndpointNumber(2),
            value: [
                { "0": "room", "1": "hall" },
                { "0": "floor", "1": "0" },
            ],
            timedInteractionTimeoutMs: Millis(2000),
        });

        expect(results.map(({ endpointId, status }) => ({ endpointId, status }))).deep.equals([
            { endpointId: 2, status: 0 },
        ]);
        expect(writes.map(({ writeRequests }) => writeRequests.length)).deep.equals([3]);
    });

    it("answers a chunked list write with the failure of a later chunk", async () => {
        const results = await writeLabels({
            endpointId: EndpointNumber(2),
            value: [
                { "0": "room", "1": "hall" },
                { "0": "a label longer than sixteen characters", "1": "x" },
                { "0": "floor", "1": "0" },
            ],
            timedInteractionTimeoutMs: Millis(2000),
        });

        expect(results.map(({ endpointId, status }) => ({ endpointId, status }))).deep.equals([
            { endpointId: 2, status: Status.ConstraintError },
        ]);
    });

    it("refuses a value matter.js cannot encode for a wildcard endpoint", async () => {
        const refusal = await writeLabels({ value: [{ "1": "no label" }] }).catch((error: unknown) => error);

        expect(refusal).instanceOf(ServerError);
        expect(refusal).property("code", ServerErrorCode.InvalidArguments);
    });

    it("answers a value matter.js cannot encode as the status of a specific endpoint", async () => {
        const results = await writeLabels({
            endpointId: EndpointNumber(1),
            value: [{ "1": "no label" }],
            timedInteractionTimeoutMs: Millis(2000),
        });

        expect(results.map(({ endpointId, status }) => ({ endpointId, status }))).deep.equals([
            { endpointId: 1, status: Status.InvalidAction },
        ]);
    });

    it("sends a timed write with the given timeout", async () => {
        const writes = recordWrites(site.peer);

        const results = await write({
            endpointId: EndpointNumber(1),
            value: 3,
            timedInteractionTimeoutMs: Millis(2000),
        });

        expect(results.map(({ status }) => status)).deep.equals([0]);
        expect(writes.map(({ timedRequest, timeout }) => ({ timedRequest, timeout }))).deep.equals([
            { timedRequest: true, timeout: Millis(2000) },
        ]);
        expect(site.light.stateOf("onOff").onTime).equals(3);
    });
});
