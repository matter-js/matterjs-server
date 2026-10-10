/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClientNode, NetworkClient, NodeId } from "@matter/main";
import { Read } from "@matter/main/protocol";
import { Status } from "@matter/main/types";
import { BooleanStateServer } from "@matter/node/behaviors/boolean-state";
import { OnOffServer } from "@matter/node/behaviors/on-off";
import { ServerError, ServerErrorCode, TEST_NODE_START } from "../src/types/WebSocketMessageTypes.js";
import { HandlerSite, NODE_ID } from "./support/HandlerSite.js";
import { InteractionWsHarness } from "./support/InteractionWsHarness.js";

async function expectInvalidArguments(promise: Promise<unknown>) {
    const error = await promise.then(
        () => undefined,
        (error: unknown) => error,
    );
    expect(error).instanceOf(ServerError);
    if (error instanceof ServerError) {
        expect(error.code).equals(ServerErrorCode.InvalidArguments);
    }
}

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

    it("reads events alone", async () => {
        const captured = captureReads(site.peer);

        const report = await read({ nodeId: NODE_ID, eventPaths: [{ path: "1/69/*" }] });

        expect(captured[0].attributeRequests).undefined;
        expect(captured[0].eventRequests).deep.equals([
            { endpointId: 1, clusterId: 69, eventId: undefined, isUrgent: undefined },
        ]);
        expect(report.attributes).deep.equals({});
    });

    it("rejects a request without paths", async () => {
        await expectInvalidArguments(site.handler.read({ nodeId: NODE_ID }));
    });

    it("rejects a malformed path instead of reading it as a wildcard, without contacting the device", async () => {
        const captured = captureReads(site.peer);

        for (const attributePath of ["1/OnOff/0", "", "x", "1/6", "1/6/0/1", "1//0", "-1/6/0"]) {
            await expectInvalidArguments(site.handler.read({ nodeId: NODE_ID, attributePaths: [attributePath] }));
        }
        await expectInvalidArguments(site.handler.read({ nodeId: NODE_ID, eventPaths: [{ path: "1/Switch/*" }] }));
        await expectInvalidArguments(
            site.handler.read({ nodeId: NODE_ID, eventPaths: [{ path: "1/59/1" }, { path: "1/59" }] }),
        );
        for (const filterPath of ["1/6/0", "one/6", "1"]) {
            await expectInvalidArguments(
                site.handler.read({
                    nodeId: NODE_ID,
                    attributePaths: ["1/6/0"],
                    dataVersionFilters: [{ path: filterPath, dataVersion: 1 }],
                }),
            );
        }

        expect(captured).deep.equals([]);
    });

    it("rejects a data version filter without a concrete endpoint", async () => {
        await expectInvalidArguments(
            site.handler.read({
                nodeId: NODE_ID,
                attributePaths: ["1/6/0"],
                dataVersionFilters: [{ path: "*/6", dataVersion: 1 }],
            }),
        );
    });
});

describe("generic read of events already seen", () => {
    let site: HandlerSite;

    beforeEach(async () => {
        site = new HandlerSite();
        await site.startDevice();
    });

    afterEach(async () => {
        await site.close();
    });

    async function read(request: Parameters<typeof site.handler.read>[0]) {
        return await MockTime.resolve(site.handler.read(request), { macrotasks: true });
    }

    async function emitEvent() {
        await site.light.setStateOf(BooleanStateServer, { stateValue: true });
        await site.settle();
    }

    const EVENTS = { nodeId: NODE_ID, eventPaths: [{ path: "1/69/*" }] };

    describe("with auto subscription", () => {
        beforeEach(async () => {
            await site.startController(false);
            await site.commission();
            await emitEvent();
        });

        it("asks only for events after the last one received when event_min is omitted", async () => {
            const captured = captureReads(site.peer);
            const maxEventNumber = site.peer.stateOf(NetworkClient).maxEventNumber;
            expect(maxEventNumber).greaterThan(0n);

            const report = await read(EVENTS);

            expect(captured[0].eventFilters).deep.equals([{ eventMin: maxEventNumber + 1n }]);
            expect(report.events).deep.equals([]);
        });

        it("sends an explicit event_min as given", async () => {
            const captured = captureReads(site.peer);

            const report = await read({ ...EVENTS, eventMin: 0 });

            expect(captured[0].eventFilters).deep.equals([{ eventMin: 0n }]);
            expect(report.events.length).greaterThan(0);
        });

        it("adds no event filter to a read without event paths", async () => {
            const captured = captureReads(site.peer);

            await read({ nodeId: NODE_ID, attributePaths: ["1/6/0"] });

            expect(captured[0].eventFilters).undefined;
        });
    });

    describe("with auto subscription disabled", () => {
        beforeEach(async () => {
            await site.startController(true);
            await site.commission();
        });

        it("sends the request without an event filter", async () => {
            const captured = captureReads(site.peer);

            await read(EVENTS);

            expect(captured[0].eventFilters).undefined;
        });

        it("skips events already seen once the node's auto subscription is enabled", async () => {
            await MockTime.resolve(site.handler.setAutoSubscription(NODE_ID, true), { macrotasks: true });
            await site.settle();
            await emitEvent();
            const captured = captureReads(site.peer);

            await read(EVENTS);

            expect(captured[0].eventFilters).deep.equals([
                { eventMin: site.peer.stateOf(NetworkClient).maxEventNumber + 1n },
            ]);

            await MockTime.resolve(site.handler.setAutoSubscription(NODE_ID, false), { macrotasks: true });
            await read(EVENTS);

            expect(captured[1].eventFilters).undefined;
        });
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

    it("rejects test nodes", async () => {
        const client = await harness.connect();

        for (const command of ["read", "subscribe"]) {
            const response = await client.command(command, {
                node_id: TEST_NODE_START,
                attribute_paths: ["1/6/0"],
                min_interval: 0,
                max_interval: 60,
            });
            expect(response.error_code, command).equals(ServerErrorCode.InvalidArguments);
            expect(response.details, command).contains("test nodes");
        }
        expect(harness.readRequests).deep.equals([]);
        expect(harness.subscribeRequests).deep.equals([]);
    });
});
