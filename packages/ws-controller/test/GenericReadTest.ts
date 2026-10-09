/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClientNode, NodeId } from "@matter/main";
import { Read } from "@matter/main/protocol";
import { Status } from "@matter/main/types";
import { BooleanStateServer } from "@matter/node/behaviors/boolean-state";
import { OnOffServer } from "@matter/node/behaviors/on-off";
import { ServerError, ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";
import { HandlerSite, NODE_ID } from "./support/HandlerSite.js";
import { InteractionWsHarness } from "./support/InteractionWsHarness.js";

function captureReads(peer: ClientNode) {
    const captured = new Array<Read & { includeKnownVersions?: boolean }>();
    const interaction = peer.interaction;
    const read = interaction.read.bind(interaction);
    interaction.read = (request, session) => {
        captured.push(request);
        return read(request, session);
    };
    return captured;
}

describe("generic read", () => {
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

    async function read(request: Parameters<typeof site.handler.read>[0]) {
        return await MockTime.resolve(site.handler.read(request), { macrotasks: true });
    }

    it("passes every request field to the read interaction as one request", async () => {
        const captured = captureReads(site.peer);

        await read({
            nodeId: NODE_ID,
            attributePaths: ["1/6/0", "*/29/*"],
            eventPaths: [{ path: "1/69/0" }, { path: "1/69/*", isUrgent: true }],
            eventMin: 2,
            fabricFiltered: false,
            dataVersionFilters: [{ path: "1/6", dataVersion: 9 }],
        });

        expect(captured.length).equals(1);
        const [request] = captured;
        expect(request.attributeRequests).deep.equals([
            { endpointId: 1, clusterId: 6, attributeId: 0 },
            { endpointId: undefined, clusterId: 29, attributeId: undefined },
        ]);
        expect(request.eventRequests).deep.equals([
            { endpointId: 1, clusterId: 69, eventId: 0, isUrgent: undefined },
            { endpointId: 1, clusterId: 69, eventId: undefined, isUrgent: true },
        ]);
        expect(request.eventFilters).deep.equals([{ eventMin: 2n }]);
        expect(request.isFabricFiltered).equals(false);
        expect(request.dataVersionFilters).deep.equals([{ path: { endpointId: 1, clusterId: 6 }, dataVersion: 9 }]);
        expect(request.includeKnownVersions).equals(true);
    });

    it("filters by fabric unless told otherwise", async () => {
        const captured = captureReads(site.peer);

        await read({ nodeId: NODE_ID, attributePaths: ["1/6/0"] });

        expect(captured[0].isFabricFiltered).equals(true);
    });

    it("returns the status of an unsupported attribute, cluster, endpoint and event path", async () => {
        const report = await read({
            nodeId: NODE_ID,
            attributePaths: ["1/6/0", "1/6/9999", "1/1234/0", "9/6/0"],
            eventPaths: [{ path: "1/69/5" }],
        });

        expect(report.attributes).deep.equals({ "1/6/0": false });
        expect(report.attribute_status).deep.equals({
            "1/6/9999": { status: Status.UnsupportedAttribute },
            "1/1234/0": { status: Status.UnsupportedCluster },
            "9/6/0": { status: Status.UnsupportedEndpoint },
        });
        expect(report.event_status).deep.equals({ "1/69/5": { status: Status.UnsupportedEvent } });
    });

    it("has no status fields when every path succeeds", async () => {
        const report = await read({ nodeId: NODE_ID, attributePaths: ["1/6/0"], eventPaths: [{ path: "1/69/0" }] });

        expect(report).not.have.property("attribute_status");
        expect(report).not.have.property("event_status");
    });

    it("returns attributes and events in the read_attribute and node_event shapes", async () => {
        await site.light.setStateOf(OnOffServer, { onOff: true });
        await site.light.setStateOf(BooleanStateServer, { stateValue: true });

        const { attributes, events } = await read({
            nodeId: NODE_ID,
            attributePaths: ["1/6/0"],
            eventPaths: [{ path: "1/69/0" }],
        });

        expect(attributes).deep.equals({ "1/6/0": true });
        const stateChange = events.find(event => event.cluster_id === 69 && event.event_id === 0);
        expect(stateChange).not.undefined;
        expect(stateChange?.node_id).equals(NODE_ID);
        expect(stateChange?.endpoint_id).equals(1);
        expect(stateChange?.data).deep.equals({ stateValue: true });
    });

    it("rejects a request without paths", async () => {
        const error = await site.handler.read({ nodeId: NODE_ID }).then(
            () => undefined,
            (error: unknown) => error,
        );

        expect(error).instanceOf(ServerError);
        if (error instanceof ServerError) {
            expect(error.code).equals(ServerErrorCode.InvalidArguments);
        }
    });
});

describe("read over WebSocket", () => {
    let harness: InteractionWsHarness;

    beforeEach(async () => {
        harness = await InteractionWsHarness.create();
    });

    afterEach(async () => {
        await harness.close();
    });

    it("maps the arguments onto the controller request and returns its report", async () => {
        const client = await harness.connect();
        harness.readResult = { attributes: { "1/6/0": true }, events: [] };

        const response = await client.command("read", {
            node_id: 42,
            attribute_paths: ["1/6/0"],
            event_paths: [{ path: "1/69/0" }],
            event_min: 2,
            fabric_filtered: false,
            data_version_filters: [{ path: "1/6", data_version: 9 }],
        });

        expect(response.result).deep.equals({ attributes: { "1/6/0": true }, events: [] });
        expect(harness.readRequests).deep.equals([
            {
                nodeId: NodeId(42),
                attributePaths: ["1/6/0"],
                eventPaths: [{ path: "1/69/0", isUrgent: undefined }],
                eventMin: 2,
                fabricFiltered: false,
                dataVersionFilters: [{ path: "1/6", dataVersion: 9 }],
            },
        ]);
    });
});
