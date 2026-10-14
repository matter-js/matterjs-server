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
import { EventChange } from "../src/controller/PeerChangeBus.js";
import { ServerError, ServerErrorCode, TEST_NODE_START } from "../src/types/WebSocketMessageTypes.js";
import { HandlerSite, NODE_ID } from "./support/HandlerSite.js";
import { InteractionWsHarness } from "./support/InteractionWsHarness.js";

async function expectInvalidArguments(promise: Promise<unknown>, message?: string) {
    const error = await promise.then(
        () => undefined,
        (error: unknown) => error,
    );
    expect(error).instanceOf(ServerError);
    if (error instanceof ServerError) {
        expect(error.code).equals(ServerErrorCode.InvalidArguments);
        if (message !== undefined) {
            expect(error.message).contains(message);
        }
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
            eventPaths: [{ path: "1/69/0" }, { path: "1/69/*" }],
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
            { endpointId: 1, clusterId: 69, eventId: undefined, isUrgent: undefined },
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

    it("keeps the status of every unsupported event path", async () => {
        const report = await read({ nodeId: NODE_ID, eventPaths: [{ path: "1/69/5" }, { path: "1/69/6" }] });

        expect(report.event_status).deep.equals({
            "1/69/5": { status: Status.UnsupportedEvent },
            "1/69/6": { status: Status.UnsupportedEvent },
        });
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

    it("does not send the events it returns as node events", async () => {
        const eventChanges = new Array<EventChange>();
        site.handler.events.eventChanged.on((_nodeId, change) => {
            eventChanges.push(change);
        });
        await site.light.setStateOf(BooleanStateServer, { stateValue: true });

        const { events } = await read({ nodeId: NODE_ID, eventPaths: [{ path: "1/69/0" }] });

        expect(events.some(event => event.cluster_id === 69 && event.event_id === 0)).equals(true);
        expect(eventChanges).deep.equals([]);
    });

    it("returns the data version of each reported cluster, which a later read can filter on", async () => {
        const first = await read({ nodeId: NODE_ID, attributePaths: ["1/6/0"] });
        const version = first.data_versions?.["1/6"];
        expect(version).a("number");

        const second = await read({
            nodeId: NODE_ID,
            attributePaths: ["1/6/0"],
            dataVersionFilters: [{ path: "1/6", dataVersion: version ?? -1 }],
        });

        expect(first.attributes).deep.equals({ "1/6/0": false });
        expect(second.attributes).deep.equals({});
        expect(second.data_versions).undefined;
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

    it("rejects an out-of-range id in a path without contacting the device", async () => {
        const captured = captureReads(site.peer);

        for (const attributePath of ["65536/6/0", "1/4294967294/0", "1/32768/0", "1/6/4294967296"]) {
            await expectInvalidArguments(site.handler.read({ nodeId: NODE_ID, attributePaths: [attributePath] }));
        }
        await expectInvalidArguments(site.handler.read({ nodeId: NODE_ID, eventPaths: [{ path: "1/59/256" }] }));
        await expectInvalidArguments(
            site.handler.read({
                nodeId: NODE_ID,
                attributePaths: ["1/6/0"],
                dataVersionFilters: [{ path: "65536/6", dataVersion: 1 }],
            }),
        );

        expect(captured).deep.equals([]);
    });

    it("rejects an out-of-range id in read_attribute without contacting the device", async () => {
        const captured = captureReads(site.peer);

        await expectInvalidArguments(site.handler.handleReadAttributes(NODE_ID, ["1/32768/0"]));

        expect(captured).deep.equals([]);
    });

    it("accepts the largest event_min and data_version", async () => {
        const captured = captureReads(site.peer);

        await read({
            nodeId: NODE_ID,
            attributePaths: ["1/6/0"],
            eventPaths: [{ path: "1/69/*" }],
            eventMin: 0xffff_ffff_ffff_ffffn,
            dataVersionFilters: [{ path: "1/6", dataVersion: 0xffff_ffff }],
        });

        expect(captured[0].eventFilters).deep.equals([{ eventMin: 0xffff_ffff_ffff_ffffn }]);
    });

    it("rejects a malformed path without contacting the device", async () => {
        const captured = captureReads(site.peer);

        await expectInvalidArguments(
            site.handler.read({ nodeId: NODE_ID, attributePaths: ["1/OnOff/0"] }),
            "Malformed attribute_paths path",
        );

        expect(captured).deep.equals([]);
    });

    it("rejects a request without paths without contacting the device", async () => {
        const captured = captureReads(site.peer);

        await expectInvalidArguments(
            site.handler.read({ nodeId: NODE_ID, attributePaths: [], eventPaths: [] }),
            "At least one attribute or event path",
        );

        expect(captured).deep.equals([]);
    });

    it("rejects an out-of-range eventMin without contacting the device", async () => {
        const captured = captureReads(site.peer);

        for (const eventMin of [-1, 1.5, 0x1_0000_0000_0000_0000n]) {
            await expectInvalidArguments(
                site.handler.read({ nodeId: NODE_ID, eventPaths: [{ path: "1/69/*" }], eventMin }),
                "event_min must be an event number",
            );
        }

        expect(captured).deep.equals([]);
    });

    it("rejects eventMin without event paths and data version filters without attribute paths", async () => {
        const captured = captureReads(site.peer);

        await expectInvalidArguments(
            site.handler.read({ nodeId: NODE_ID, attributePaths: ["1/6/0"], eventMin: 1 }),
            "event_min requires event_paths",
        );
        await expectInvalidArguments(
            site.handler.read({
                nodeId: NODE_ID,
                eventPaths: [{ path: "1/69/*" }],
                dataVersionFilters: [{ path: "1/6", dataVersion: 1 }],
            }),
            "data_version_filters requires attribute_paths",
        );

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

describe("generic read with auto subscription", () => {
    let site: HandlerSite;

    beforeEach(async () => {
        site = new HandlerSite();
        await site.startDevice();
        await site.startController(false);
        await site.commission();
    });

    afterEach(async () => {
        await site.close();
    });

    it("sends no event filter without event_min", async () => {
        await site.light.setStateOf(BooleanStateServer, { stateValue: true });
        await site.settle();
        const captured = captureReads(site.peer);

        const report = await MockTime.resolve(
            site.handler.read({ nodeId: NODE_ID, eventPaths: [{ path: "1/69/*" }] }),
            { macrotasks: true },
        );

        expect(captured[0].eventFilters).undefined;
        expect(report.events.length).greaterThan(0);
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
                eventPaths: [{ path: "1/69/0" }],
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

    it("refuses malformed arguments with InvalidArguments before any read", async () => {
        const client = await harness.connect();

        for (const args of [
            { attribute_paths: [1] },
            { attribute_paths: "1/6/0" },
            { attribute_paths: [null] },
            { event_paths: [null] },
            { event_paths: [{ path: 1 }] },
            { event_paths: "1/69/0" },
            { attribute_paths: ["1/6/0"], data_version_filters: [null] },
            { attribute_paths: ["1/6/0"], data_version_filters: [{ path: "1/6", data_version: "1" }] },
            { attribute_paths: ["1/6/0"], fabric_filtered: "false" },
            { attribute_paths: ["1/6/0"], fabric_filtered: 0 },
            { event_paths: [{ path: "1/69/0" }], event_min: "2" },
            { attribute_paths: ["1/6/0"], node_id: "42" },
            { attribute_paths: ["1/6/0"], node_id: 1.5 },
        ]) {
            const response = await client.command("read", { node_id: 42, ...args });
            expect(response.error_code, JSON.stringify(args)).equals(ServerErrorCode.InvalidArguments);
        }
        expect(harness.readRequests).deep.equals([]);
    });

    it("refuses event_min without event paths and data version filters without attribute paths", async () => {
        const client = await harness.connect();

        const eventMin = await client.command("read", { node_id: 42, attribute_paths: ["1/6/0"], event_min: 1 });
        expect(eventMin.error_code).equals(ServerErrorCode.InvalidArguments);
        expect(eventMin.details).equals("event_min requires event_paths");
        const filters = await client.command("read", {
            node_id: 42,
            event_paths: [{ path: "1/69/0" }],
            data_version_filters: [{ path: "1/6", data_version: 1 }],
        });
        expect(filters.error_code).equals(ServerErrorCode.InvalidArguments);
        expect(filters.details).equals("data_version_filters requires attribute_paths");
        expect(harness.readRequests).deep.equals([]);
    });

    it("reads optional arguments sent as null as left out", async () => {
        const client = await harness.connect();

        const response = await client.command("read", {
            node_id: 42,
            attribute_paths: ["1/6/0"],
            event_paths: null,
            event_min: null,
            fabric_filtered: null,
            data_version_filters: null,
        });

        expect(response.error_code).undefined;
        expect(harness.readRequests).deep.equals([
            {
                nodeId: NodeId(42),
                attributePaths: ["1/6/0"],
                eventPaths: undefined,
                eventMin: undefined,
                fabricFiltered: undefined,
                dataVersionFilters: undefined,
            },
        ]);
    });
});
