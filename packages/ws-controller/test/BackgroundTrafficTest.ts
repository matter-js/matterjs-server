/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Minutes, NodeId, ServerNode, SoftwareUpdateManager } from "@matter/main";
import { ThreadNetworkDiagnostics } from "@matter/main/clusters/thread-network-diagnostics";
import { NetworkCommissioningServer } from "@matter/node/behaviors/network-commissioning";
import { ThreadNetworkDiagnosticsServer } from "@matter/node/behaviors/thread-network-diagnostics";
import { HandlerSite, NODE_ID } from "./support/HandlerSite.js";

const ThreadRootEndpoint = ServerNode.RootEndpoint.with(
    NetworkCommissioningServer.with("ThreadNetworkInterface").set({
        maxNetworks: 1,
        networks: [],
        scanMaxTimeSeconds: 10,
        connectMaxTimeSeconds: 10,
        interfaceEnabled: true,
        lastNetworkingStatus: null,
        lastNetworkId: null,
        lastConnectErrorValue: null,
        supportedThreadFeatures: {},
        threadVersion: 4,
    }),
    ThreadNetworkDiagnosticsServer.set({
        channel: 15,
        routingRole: ThreadNetworkDiagnostics.RoutingRole.Router,
        networkName: "test",
        panId: 0x1234,
        extendedPanId: 0x1234n,
        meshLocalPrefix: null,
        neighborTable: [],
        routeTable: [],
        partitionId: null,
        weighting: null,
        dataVersion: null,
        stableDataVersion: null,
        leaderRouterId: null,
        securityPolicy: null,
        channelPage0Mask: null,
        operationalDatasetComponents: null,
        activeNetworkFaultsList: [],
    }),
);

describe("background traffic", () => {
    let site: HandlerSite;

    beforeEach(() => {
        site = new HandlerSite();
    });

    afterEach(async () => {
        await site.close();
    });

    async function enableAutoSubscription() {
        await MockTime.resolve(site.handler.setAutoSubscription(NODE_ID, true), { macrotasks: true });
    }

    describe("Thread topology polling", () => {
        let threadReads: number;

        beforeEach(async () => {
            await site.startDevice(ThreadRootEndpoint);
            threadReads = 0;
        });

        function countThreadReads() {
            const handler = site.handler;
            const read = handler.handleReadAttributes.bind(handler);
            handler.handleReadAttributes = (nodeId: NodeId, paths: string[], fabricFiltered?: boolean) => {
                if (paths.includes("0/53/7")) {
                    threadReads++;
                }
                return read(nodeId, paths, fabricFiltered);
            };
        }

        it("polls a Thread node with auto subscription on", async () => {
            await site.startController(false, { threadDiagnosticsEnabled: true });
            countThreadReads();
            await site.commission();

            await site.settle(Minutes(10));

            expect(threadReads).greaterThan(0);
        });

        it("does not poll a Thread node switched on with enable_auto_subscription", async () => {
            await site.startController(true, { threadDiagnosticsEnabled: true });
            countThreadReads();
            await site.commission();
            await enableAutoSubscription();

            await site.settle(Minutes(10));

            expect(site.hasAutoSubscription).equals(true);
            expect(threadReads).equals(0);
        });
    });

    describe("OTA update checks", () => {
        let queries: Array<{ peerToCheck?: unknown }>;
        let restoreQueryUpdates: () => void;

        beforeEach(async () => {
            queries = [];
            const queryUpdates = SoftwareUpdateManager.prototype.queryUpdates;
            SoftwareUpdateManager.prototype.queryUpdates = async options => {
                queries.push(options ?? {});
                return [];
            };
            restoreQueryUpdates = () => {
                SoftwareUpdateManager.prototype.queryUpdates = queryUpdates;
            };
            await site.startDevice();
        });

        afterEach(() => {
            restoreQueryUpdates();
        });

        it("run on their own with auto subscription on", async () => {
            await site.startController(false, { otaEnabled: true });
            await site.commission();

            await site.settle(Minutes(15));

            expect(queries.length).greaterThan(0);
        });

        it("do not run on their own for a node switched on with enable_auto_subscription", async () => {
            await site.startController(true, { otaEnabled: true });
            await site.commission();
            await enableAutoSubscription();

            await site.settle(Minutes(15));

            expect(site.hasAutoSubscription).equals(true);
            expect(queries).deep.equals([]);
        });

        it("still run for check_node_update", async () => {
            await site.startController(true, { otaEnabled: true });
            await site.commission();
            await enableAutoSubscription();

            await MockTime.resolve(site.handler.checkNodeUpdate(NODE_ID), { macrotasks: true });

            expect(queries.length).equals(1);
            expect(queries[0].peerToCheck).equals(site.peer);
        });
    });
});
