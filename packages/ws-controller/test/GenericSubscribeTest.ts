/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClientNode, InternalError, NodeId, Seconds, SessionsBehavior } from "@matter/main";
import { ClientSubscribe } from "@matter/main/protocol";
import { Status } from "@matter/main/types";
import { BooleanStateServer } from "@matter/node/behaviors/boolean-state";
import { OnOffServer } from "@matter/node/behaviors/on-off";
import { AttributeChange, EventChange } from "../src/controller/PeerChangeBus.js";
import { InteractionReport, InteractionSubscribeRequest } from "../src/types/CommandHandler.js";
import { ServerError, ServerErrorCode, TEST_NODE_START } from "../src/types/WebSocketMessageTypes.js";
import { HandlerSite, NODE_ID } from "./support/HandlerSite.js";
import { InteractionWsHarness } from "./support/InteractionWsHarness.js";

/** Snapshots the filters too: matter.js appends the data versions it knows to the request's own filter array. */
function captureSubscribes(peer: ClientNode) {
    const captured = new Array<ClientSubscribe>();
    const interaction = peer.interaction;
    const subscribe = interaction.subscribe.bind(interaction);
    interaction.subscribe = (request, session) => {
        captured.push({ ...request, dataVersionFilters: request.dataVersionFilters?.map(filter => ({ ...filter })) });
        return subscribe(request, session);
    };
    return captured;
}

function recorder() {
    const reports = new Array<InteractionReport>();
    let closed = 0;
    return {
        reports,
        get closed() {
            return closed;
        },
        listener: {
            report: (report: InteractionReport) => {
                reports.push(report);
            },
            closed: () => {
                closed++;
            },
        },
    };
}

function activeSubscriptionsOnDevice(site: HandlerSite) {
    return Object.values(site.device.stateOf(SessionsBehavior).sessions).reduce(
        (sum, session) => sum + session.numberOfActiveSubscriptions,
        0,
    );
}

const LIGHT_ON_OFF: InteractionSubscribeRequest = {
    nodeId: NODE_ID,
    attributePaths: ["1/6/0"],
    eventPaths: [{ path: "1/69/0" }],
    minInterval: 0,
    maxInterval: 60,
};

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

describe("generic subscribe", () => {
    let site: HandlerSite;

    beforeEach(async () => {
        site = new HandlerSite();
        await site.startDevice();
    });

    afterEach(async () => {
        await site.close();
    });

    async function subscribe(request: InteractionSubscribeRequest, listener: ReturnType<typeof recorder>["listener"]) {
        return await MockTime.resolve(site.handler.subscribe(request, listener), { macrotasks: true });
    }

    describe("with auto subscription disabled", () => {
        beforeEach(async () => {
            await site.startController(true);
            await site.commission();
        });

        it("passes every request field to the subscribe interaction", async () => {
            const captured = captureSubscribes(site.peer);

            await subscribe(
                {
                    nodeId: NODE_ID,
                    attributePaths: ["1/6/0", "*/29/*"],
                    eventPaths: [{ path: "1/69/0", isUrgent: true }, { path: "1/69/*" }],
                    minInterval: 1,
                    maxInterval: 30,
                    keepSubscriptions: false,
                    fabricFiltered: false,
                    dataVersionFilters: [{ path: "1/6", dataVersion: 5 }],
                    eventMin: 3,
                },
                recorder().listener,
            );

            expect(captured.length).equals(1);
            const [request] = captured;
            expect(request.attributeRequests).deep.equals([
                { endpointId: 1, clusterId: 6, attributeId: 0 },
                { endpointId: undefined, clusterId: 29, attributeId: undefined },
            ]);
            expect(request.eventRequests).deep.equals([
                { endpointId: 1, clusterId: 69, eventId: 0, isUrgent: true },
                { endpointId: 1, clusterId: 69, eventId: undefined, isUrgent: undefined },
            ]);
            expect(request.minIntervalFloor).equals(Seconds(1));
            expect(request.maxIntervalCeiling).equals(Seconds(30));
            expect(request.keepSubscriptions).equals(false);
            expect(request.includeKnownVersions).equals(true);
            expect(request.isFabricFiltered).equals(false);
            expect(request.dataVersionFilters).deep.equals([{ path: { endpointId: 1, clusterId: 6 }, dataVersion: 5 }]);
            expect(request.eventFilters).deep.equals([{ eventMin: 3n }]);
        });

        it("filters by fabric unless told otherwise", async () => {
            const captured = captureSubscribes(site.peer);

            await subscribe(LIGHT_ON_OFF, recorder().listener);

            expect(captured[0].isFabricFiltered).equals(true);
            expect(captured[0].dataVersionFilters).undefined;
            expect(captured[0].eventFilters).undefined;
        });

        it("sends keep_subscriptions false when omitted and passes an explicit value through", async () => {
            const captured = captureSubscribes(site.peer);

            await subscribe(LIGHT_ON_OFF, recorder().listener);
            await subscribe({ ...LIGHT_ON_OFF, keepSubscriptions: true }, recorder().listener);
            await subscribe({ ...LIGHT_ON_OFF, keepSubscriptions: false }, recorder().listener);

            expect(captured.map(({ keepSubscriptions }) => keepSubscriptions)).deep.equals([false, true, false]);
        });

        it("returns the priming report and forwards later changes, with attribute but no node event changes", async () => {
            const record = recorder();
            const attributeChanges = new Array<AttributeChange>();
            const eventChanges = new Array<EventChange>();
            site.handler.events.attributeChanged.on((_nodeId, change) => {
                attributeChanges.push(change);
            });
            site.handler.events.eventChanged.on((_nodeId, change) => {
                eventChanges.push(change);
            });

            const subscription = await subscribe(LIGHT_ON_OFF, record.listener);

            expect(subscription.nodeId).equals(NODE_ID);
            expect(subscription.id).a("number");
            expect(subscription.priming.attributes).deep.equals({ "1/6/0": false });
            expect(Object.keys(subscription.priming.data_versions ?? {})).deep.equals(["1/6"]);
            expect(record.reports.length).equals(0);

            await site.light.setStateOf(OnOffServer, { onOff: true });
            await site.light.setStateOf(BooleanStateServer, { stateValue: true });
            await site.settle(Seconds(5));

            const attributes = record.reports.map(report => report.attributes);
            expect(attributes).deep.include({ "1/6/0": true });
            const events = record.reports.flatMap(report => report.events);
            const stateChange = events.find(event => event.cluster_id === 69 && event.event_id === 0);
            expect(stateChange).not.undefined;
            expect(stateChange?.node_id).equals(NODE_ID);
            expect(stateChange?.endpoint_id).equals(1);

            expect(
                attributeChanges.some(({ path, value }) => path.attributeId === 0 && path.clusterId === 6 && value),
            ).equals(true);
            expect(eventChanges).deep.equals([]);
        });

        it("reports the status of an unsupported path in the priming report", async () => {
            const subscription = await subscribe(
                { ...LIGHT_ON_OFF, attributePaths: ["1/6/0", "1/6/9999"] },
                recorder().listener,
            );

            expect(subscription.priming.attribute_status).deep.equals({
                "1/6/9999": { status: Status.UnsupportedAttribute },
            });
        });

        it("stops reporting once closed", async () => {
            const record = recorder();
            const subscription = await subscribe(LIGHT_ON_OFF, record.listener);
            expect(activeSubscriptionsOnDevice(site)).equals(1);

            subscription.close();
            expect(record.closed).equals(1);

            const reportsBefore = record.reports.length;
            await site.light.setStateOf(OnOffServer, { onOff: true });
            await site.settle(Seconds(120));

            expect(record.reports.length).equals(reportsBefore);
            expect(activeSubscriptionsOnDevice(site)).equals(0);
        });

        it("closes the node's subscriptions when the node is removed", async () => {
            const record = recorder();
            await subscribe(LIGHT_ON_OFF, record.listener);

            await MockTime.resolve(site.handler.removeNode(NODE_ID), { macrotasks: true });

            expect(record.closed).equals(1);
        });

        it("closes its subscriptions when the controller shuts down", async () => {
            const record = recorder();
            await subscribe(LIGHT_ON_OFF, record.listener);

            await site.stopController();

            expect(record.closed).equals(1);
        });

        it("rejects intervals outside the Matter range or in the wrong order", async () => {
            const captured = captureSubscribes(site.peer);

            for (const [minInterval, maxInterval] of [
                [0, 0x10000],
                [-1, 60],
                [1.5, 60],
                [0, 60.5],
                [0, -1],
                [10, 5],
            ]) {
                await expectInvalidArguments(
                    site.handler.subscribe({ ...LIGHT_ON_OFF, minInterval, maxInterval }, recorder().listener),
                );
            }

            expect(captured).deep.equals([]);
        });

        it("accepts equal intervals and the Matter maximum", async () => {
            const captured = captureSubscribes(site.peer);

            await subscribe({ ...LIGHT_ON_OFF, minInterval: 30, maxInterval: 30 }, recorder().listener);
            await subscribe({ ...LIGHT_ON_OFF, minInterval: 0, maxInterval: 0xffff }, recorder().listener);

            expect(captured.map(({ maxIntervalCeiling }) => maxIntervalCeiling)).deep.equals([
                Seconds(30),
                Seconds(0xffff),
            ]);
        });

        it("rejects an out-of-range id in a path without contacting the device", async () => {
            const captured = captureSubscribes(site.peer);

            await expectInvalidArguments(
                site.handler.subscribe({ ...LIGHT_ON_OFF, attributePaths: ["1/32768/0"] }, recorder().listener),
                'Invalid id in path "1/32768/0"',
            );

            expect(captured).deep.equals([]);
        });

        it("ends the node's subscriptions when auto subscription is enabled for it", async () => {
            const record = recorder();
            await subscribe(LIGHT_ON_OFF, record.listener);

            await MockTime.resolve(site.handler.setAutoSubscription(NODE_ID, true), { macrotasks: true });
            await site.settle();

            expect(record.closed).equals(1);
            expect(site.hasAutoSubscription).equals(true);
        });

        it("rejects subscribe while the node's auto subscription is enabled", async () => {
            await MockTime.resolve(site.handler.setAutoSubscription(NODE_ID, true), { macrotasks: true });
            await site.settle();
            const captured = captureSubscribes(site.peer);

            await expectInvalidArguments(site.handler.subscribe(LIGHT_ON_OFF, recorder().listener));
            expect(captured).deep.equals([]);

            await MockTime.resolve(site.handler.setAutoSubscription(NODE_ID, false), { macrotasks: true });
            await site.settle();
            await subscribe(LIGHT_ON_OFF, recorder().listener);
            expect(captured.length).equals(1);
        });

        it("closes and rejects a subscription whose node had auto subscription enabled meanwhile", async () => {
            const record = recorder();
            const interaction = site.peer.interaction;
            const subscribeOriginal = interaction.subscribe.bind(interaction);
            let enabled = false;
            interaction.subscribe = async (request, session) => {
                const active = await subscribeOriginal(request, session);
                if (!enabled) {
                    enabled = true;
                    await site.peer.set({ network: { autoSubscribe: true } });
                }
                return active;
            };

            await expectInvalidArguments(
                MockTime.resolve(site.handler.subscribe(LIGHT_ON_OFF, record.listener), { macrotasks: true }),
            );

            expect(record.closed).equals(1);
        });

        it("closes and rejects a subscription that became active without a priming report", async () => {
            const record = recorder();
            const interaction = site.peer.interaction;
            const subscribeOriginal = interaction.subscribe.bind(interaction);
            let drained = 0;
            // The report must still be read, or matter.js fails the subscribe; only the handler must not see it.
            interaction.subscribe = (request, session) =>
                subscribeOriginal(
                    {
                        ...request,
                        updated: async data => {
                            for await (const chunk of data) {
                                for await (const _entry of chunk) {
                                    drained++;
                                }
                            }
                        },
                    },
                    session,
                );

            const error = await MockTime.resolve(site.handler.subscribe(LIGHT_ON_OFF, record.listener), {
                macrotasks: true,
            }).then(
                () => undefined,
                (error: unknown) => error,
            );

            expect(error).instanceOf(InternalError);
            expect(String(error)).contains("without a priming report");
            expect(record.closed).equals(1);
            expect(drained).greaterThan(0);
        });

        it("rejects a malformed path, no paths, an out-of-range eventMin and eventMin without event paths without contacting the device", async () => {
            const captured = captureSubscribes(site.peer);

            for (const [request, message] of [
                [{ ...LIGHT_ON_OFF, attributePaths: ["1/OnOff/0"] }, "Malformed attribute_paths path"],
                [{ ...LIGHT_ON_OFF, attributePaths: [], eventPaths: [] }, "At least one attribute or event path"],
                [{ ...LIGHT_ON_OFF, eventMin: -1 }, "event_min must be an event number"],
                [{ ...LIGHT_ON_OFF, eventPaths: undefined, eventMin: 1 }, "event_min requires event_paths"],
            ] satisfies [InteractionSubscribeRequest, string][]) {
                await expectInvalidArguments(site.handler.subscribe(request, recorder().listener), message);
            }

            expect(captured).deep.equals([]);
        });

        it("rejects a data version filter without a concrete endpoint or cluster", async () => {
            for (const path of ["1/*", "*/6"]) {
                await expectInvalidArguments(
                    site.handler.subscribe(
                        { ...LIGHT_ON_OFF, dataVersionFilters: [{ path, dataVersion: 1 }] },
                        recorder().listener,
                    ),
                );
            }
        });
    });

    describe("with auto subscription enabled", () => {
        beforeEach(async () => {
            await site.startController(false);
            await site.commission();
        });

        it("rejects subscribe without contacting the device", async () => {
            const captured = captureSubscribes(site.peer);

            for (const keepSubscriptions of [undefined, true, false]) {
                await expectInvalidArguments(
                    site.handler.subscribe({ ...LIGHT_ON_OFF, keepSubscriptions }, recorder().listener),
                    "requires the server to run with --disable-auto-subscription",
                );
            }

            expect(captured.length).equals(0);
            expect(activeSubscriptionsOnDevice(site)).equals(1);
        });
    });
});

describe("subscribe over WebSocket", () => {
    let harness: InteractionWsHarness;

    beforeEach(async () => {
        harness = await InteractionWsHarness.create();
    });

    afterEach(async () => {
        await harness.close();
    });

    const SUBSCRIBE_ARGS = {
        node_id: 42,
        attribute_paths: ["1/6/0"],
        event_paths: [{ path: "1/69/0", is_urgent: true }],
        min_interval: 1,
        max_interval: 30,
        keep_subscriptions: true,
        fabric_filtered: false,
        data_version_filters: [{ path: "1/6", data_version: 7 }],
        event_min: 4,
    };

    it("maps the arguments onto the controller request", async () => {
        const client = await harness.connect();

        await client.command("subscribe", SUBSCRIBE_ARGS);

        expect(harness.subscribeRequests).deep.equals([
            {
                nodeId: NodeId(42),
                attributePaths: ["1/6/0"],
                eventPaths: [{ path: "1/69/0", isUrgent: true }],
                eventMin: 4,
                fabricFiltered: false,
                dataVersionFilters: [{ path: "1/6", dataVersion: 7 }],
                minInterval: 1,
                maxInterval: 30,
                keepSubscriptions: true,
            },
        ]);
    });

    it("refuses malformed arguments with InvalidArguments before any subscribe", async () => {
        const client = await harness.connect();

        for (const args of [
            { attribute_paths: [1] },
            { attribute_paths: "1/6/0" },
            { event_paths: [null] },
            { event_paths: [{ path: "1/69/0", is_urgent: "yes" }] },
            { data_version_filters: [null] },
            { fabric_filtered: "true" },
            { keep_subscriptions: 1 },
            { min_interval: "1" },
            { max_interval: undefined },
            { min_interval: 0, max_interval: 0x10000 },
            { min_interval: 31, max_interval: 30 },
            { attribute_paths: undefined, data_version_filters: [{ path: "1/6", data_version: 7 }] },
            { event_paths: undefined, event_min: 4 },
        ]) {
            const response = await client.command("subscribe", { ...SUBSCRIBE_ARGS, ...args });
            expect(response.error_code, JSON.stringify(args)).equals(ServerErrorCode.InvalidArguments);
        }
        expect(harness.subscribeRequests).deep.equals([]);
    });

    it("refuses a malformed unsubscribe with InvalidArguments", async () => {
        const client = await harness.connect();
        harness.nextSubscriptionId = 5;
        await client.command("subscribe", SUBSCRIBE_ARGS);

        for (const args of [
            { node_id: 42, subscription_id: "5" },
            { node_id: 42 },
            { node_id: 42, subscription_id: 5.5 },
            { node_id: 42, subscription_id: 0x1_0000_0000 },
            { node_id: "42", subscription_id: 5 },
        ]) {
            const response = await client.command("unsubscribe", args);
            expect(response.error_code, JSON.stringify(args)).equals(ServerErrorCode.InvalidArguments);
        }
        expect(harness.isOpen(5)).equals(true);
    });

    it("answers with the subscription id and the priming report, then sends later reports to the owner only", async () => {
        const owner = await harness.connect();
        const other = await harness.connect();
        harness.primingReport = { attributes: { "1/6/0": false }, events: [] };
        harness.nextSubscriptionId = 77;

        const response = await owner.command("subscribe", SUBSCRIBE_ARGS);
        expect(response.result).deep.equals({ subscription_id: 77, attributes: { "1/6/0": false }, events: [] });

        harness.report(77, { attributes: { "1/6/0": true }, events: [] });
        const update = await owner.nextEvent("subscription_report");
        expect(update.data).deep.equals({
            node_id: 42,
            subscription_id: 77,
            attributes: { "1/6/0": true },
            events: [],
        });
        expect(owner.events("subscription_report")).deep.equals([update]);

        await other.command("server_info", {});
        expect(other.events("subscription_report")).deep.equals([]);
    });

    it("sends a report that arrives before the subscription resolves after the response", async () => {
        const owner = await harness.connect();
        harness.earlyReport = { attributes: { "1/6/0": true }, events: [] };
        harness.nextSubscriptionId = 78;

        const response = await owner.command("subscribe", SUBSCRIBE_ARGS);
        const early = await owner.nextEvent("subscription_report");

        expect(early.data).deep.equals({ node_id: 42, subscription_id: 78, attributes: { "1/6/0": true }, events: [] });
        expect(owner.indexOf(early)).greaterThan(owner.indexOf(response));
    });

    it("ends the subscription on unsubscribe from its owner only", async () => {
        const owner = await harness.connect();
        const other = await harness.connect();
        harness.nextSubscriptionId = 5;
        await owner.command("subscribe", SUBSCRIBE_ARGS);

        const foreign = await other.command("unsubscribe", { node_id: 42, subscription_id: 5 });
        expect(foreign.error_code).equals(ServerErrorCode.InvalidArguments);
        expect(harness.isOpen(5)).equals(true);

        const own = await owner.command("unsubscribe", { node_id: 42, subscription_id: 5 });
        expect(own.error_code).undefined;
        expect(own.result).equals(null);
        expect(harness.isOpen(5)).equals(false);

        const again = await owner.command("unsubscribe", { node_id: 42, subscription_id: 5 });
        expect(again.error_code).equals(ServerErrorCode.InvalidArguments);
    });

    it("rejects unsubscribe while auto subscription is on, naming the setting", async () => {
        harness.autoSubscriptionDisabled = false;
        const client = await harness.connect();

        const response = await client.command("unsubscribe", { node_id: 42, subscription_id: 8 });

        expect(response.error_code).equals(ServerErrorCode.InvalidArguments);
        expect(response.details).contains("--disable-auto-subscription");
    });

    it("maps enable_auto_subscription and disable_auto_subscription onto the controller", async () => {
        const client = await harness.connect();

        const enabled = await client.command("enable_auto_subscription", { node_id: 42 });
        const disabled = await client.command("disable_auto_subscription", { node_id: 42 });

        expect(enabled.error_code).undefined;
        expect(enabled.result).equals(null);
        expect(disabled.result).equals(null);
        expect(harness.autoSubscriptionRequests).deep.equals([
            { nodeId: NodeId(42), enabled: true },
            { nodeId: NodeId(42), enabled: false },
        ]);
    });

    it("rejects enable_auto_subscription and disable_auto_subscription for test nodes", async () => {
        const client = await harness.connect();

        for (const command of ["enable_auto_subscription", "disable_auto_subscription"]) {
            const response = await client.command(command, { node_id: TEST_NODE_START });
            expect(response.error_code, command).equals(ServerErrorCode.InvalidArguments);
            expect(response.details, command).contains("test nodes");
        }
        expect(harness.autoSubscriptionRequests).deep.equals([]);
    });

    it("answers an unknown subscription id with an error result", async () => {
        const client = await harness.connect();

        const response = await client.command("unsubscribe", { node_id: 42, subscription_id: 1234 });

        expect(response.error_code).equals(ServerErrorCode.InvalidArguments);
        const followUp = await client.command("server_info", {});
        expect(followUp.error_code).undefined;
    });

    it("forgets a subscription the controller ended", async () => {
        const client = await harness.connect();
        harness.nextSubscriptionId = 9;
        await client.command("subscribe", SUBSCRIBE_ARGS);

        harness.endFromController(9);

        const response = await client.command("unsubscribe", { node_id: 42, subscription_id: 9 });
        expect(response.error_code).equals(ServerErrorCode.InvalidArguments);
    });

    it("tells only the owner when a subscription ends without unsubscribe", async () => {
        const owner = await harness.connect();
        const other = await harness.connect();
        harness.nextSubscriptionId = 10;
        await owner.command("subscribe", SUBSCRIBE_ARGS);

        harness.endFromController(10);

        const ended = await owner.nextEvent("subscription_ended");
        expect(ended.data).deep.equals({ node_id: 42, subscription_id: 10 });
        await other.command("server_info", {});
        expect(other.events("subscription_ended")).deep.equals([]);
    });

    it("does not announce the end of an unsubscribed subscription", async () => {
        const client = await harness.connect();
        harness.nextSubscriptionId = 6;
        await client.command("subscribe", SUBSCRIBE_ARGS);

        await client.command("unsubscribe", { node_id: 42, subscription_id: 6 });
        harness.repeatClosedNotice(6);
        await client.command("server_info", {});

        expect(client.events("subscription_ended")).deep.equals([]);
    });

    it("keeps a newer subscription when an ended one with the same id reports its end late", async () => {
        const client = await harness.connect();
        harness.nextSubscriptionId = 31;
        await client.command("subscribe", SUBSCRIBE_ARGS);
        await client.command("unsubscribe", { node_id: 42, subscription_id: 31 });
        await client.command("subscribe", SUBSCRIBE_ARGS);

        harness.repeatClosedNotice(31);

        const response = await client.command("unsubscribe", { node_id: 42, subscription_id: 31 });
        expect(response.error_code).undefined;
    });

    it("ends the connection's subscriptions when it closes", async () => {
        const owner = await harness.connect();
        const other = await harness.connect();
        harness.nextSubscriptionId = 11;
        await owner.command("subscribe", SUBSCRIBE_ARGS);
        harness.nextSubscriptionId = 12;
        await other.command("subscribe", SUBSCRIBE_ARGS);

        await owner.close();
        await harness.waitFor(() => !harness.isOpen(11));

        expect(harness.isOpen(12)).equals(true);
    });

    it("ends a subscription whose connection closed while it was being set up", async () => {
        const client = await harness.connect();
        harness.nextSubscriptionId = 14;
        await client.command("subscribe", SUBSCRIBE_ARGS);
        let release = () => {};
        harness.subscribeGate = new Promise<void>(resolve => (release = resolve));
        harness.nextSubscriptionId = 15;

        client.command("subscribe", SUBSCRIBE_ARGS).catch(() => undefined);
        await harness.waitFor(() => harness.subscribeRequests.length === 2);
        await client.close();
        // The server has handled the close once it ended the first subscription.
        await harness.waitFor(() => !harness.isOpen(14));
        release();
        await harness.waitFor(() => harness.subscriptions.length === 2);
        await new Promise(resolve => setImmediate(resolve));

        expect(harness.isOpen(15)).equals(false);
    });

    it("frees the id of a closed connection's subscription before matter.js reports the end", async () => {
        harness.closeNotifies = false;
        const owner = await harness.connect();
        const other = await harness.connect();
        harness.nextSubscriptionId = 40;
        await owner.command("subscribe", SUBSCRIBE_ARGS);

        await owner.close();
        await harness.waitFor(() => !harness.isOpen(40));

        const response = await other.command("subscribe", SUBSCRIBE_ARGS);
        expect(response.error_code).undefined;
        expect(response.result).deep.include({ subscription_id: 40 });
    });

    it("never drops an end notice under backpressure, unlike reports", async () => {
        const client = await harness.connect();
        harness.nextSubscriptionId = 50;
        await client.command("subscribe", SUBSCRIBE_ARGS);
        harness.nextSubscriptionId = 51;
        await client.command("subscribe", SUBSCRIBE_ARGS);
        const bulky = { attributes: { "1/6/0": "x".repeat(4096) }, events: [] };
        const sent = 3000;

        client.pause();
        for (let i = 0; i < sent / 2; i++) {
            harness.report(51, bulky);
        }
        harness.endFromController(50);
        for (let i = 0; i < sent / 2; i++) {
            harness.report(51, bulky);
        }
        client.resume();

        const ended = await client.nextEvent("subscription_ended");
        expect(ended.data).deep.equals({ node_id: 42, subscription_id: 50 });
        await client.command("server_info", {});
        expect(client.events("subscription_report").length).lessThan(sent);
    });

    it("ends the subscriptions on server shutdown", async () => {
        const client = await harness.connect();
        harness.nextSubscriptionId = 13;
        await client.command("subscribe", SUBSCRIBE_ARGS);

        await harness.unregister();

        expect(harness.isOpen(13)).equals(false);
    });

    it("rejects a subscription whose id the same node already uses and closes it", async () => {
        const client = await harness.connect();
        harness.nextSubscriptionId = 21;
        await client.command("subscribe", SUBSCRIBE_ARGS);

        const response = await client.command("subscribe", SUBSCRIBE_ARGS);

        expect(response.error_code).equals(ServerErrorCode.SDKStackError);
        expect(harness.openSubscriptions(21)).equals(1);
        const own = await client.command("unsubscribe", { node_id: 42, subscription_id: 21 });
        expect(own.error_code).undefined;
        expect(harness.openSubscriptions(21)).equals(0);
    });

    it("refuses a node_id that names a group on every read and subscription command", async () => {
        const client = await harness.connect();
        const group = 0xffff_ffff_ffff_0001n;

        const responses = [
            await client.command("read", { node_id: group, attribute_paths: ["1/6/0"] }),
            await client.command("subscribe", { ...SUBSCRIBE_ARGS, node_id: group }),
            await client.command("unsubscribe", { node_id: group, subscription_id: 1 }),
            await client.command("enable_auto_subscription", { node_id: group }),
            await client.command("disable_auto_subscription", { node_id: group }),
        ];

        expect(responses.map(({ error_code }) => error_code)).deep.equals(
            Array(5).fill(ServerErrorCode.InvalidArguments),
        );
        // An unknown subscription is refused too; only the message tells the node id check ran.
        expect(responses[2]?.details).contains("node_id must name one node");
        expect([harness.readRequests, harness.subscribeRequests, harness.autoSubscriptionRequests]).deep.equals([
            [],
            [],
            [],
        ]);
    });

    it("keeps the subscriptions of two nodes that got the same id apart", async () => {
        const client = await harness.connect();
        harness.nextSubscriptionId = 21;
        await client.command("subscribe", SUBSCRIBE_ARGS);
        const second = await client.command("subscribe", { ...SUBSCRIBE_ARGS, node_id: 43 });
        const [ofNode42, ofNode43] = harness.subscriptions;

        ofNode43?.listener.report({ attributes: { "1/6/0": true }, events: [] });
        const report = await client.nextEvent("subscription_report");
        const own = await client.command("unsubscribe", { node_id: 43, subscription_id: 21 });

        expect(second.error_code).undefined;
        expect(report.data).deep.equals({
            node_id: 43,
            subscription_id: 21,
            attributes: { "1/6/0": true },
            events: [],
        });
        expect(own.error_code).undefined;
        expect([ofNode42?.open, ofNode43?.open]).deep.equals([true, false]);
    });

    it("announces the end of one of two subscriptions that share an id with its node", async () => {
        const client = await harness.connect();
        harness.nextSubscriptionId = 21;
        await client.command("subscribe", SUBSCRIBE_ARGS);
        await client.command("subscribe", { ...SUBSCRIBE_ARGS, node_id: 43 });
        const [ofNode42, ofNode43] = harness.subscriptions;

        ofNode43?.close();
        const ended = await client.nextEvent("subscription_ended");
        const own = await client.command("unsubscribe", { node_id: 42, subscription_id: 21 });

        expect(ended.data).deep.equals({ node_id: 43, subscription_id: 21 });
        expect(own.error_code).undefined;
        expect(ofNode42?.open).equals(false);
    });
});
