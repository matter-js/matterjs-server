/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeId, SoftwareUpdateInfo, SoftwareUpdateManager } from "@matter/main";
import { PeerAddress } from "@matter/main/protocol";
import { VendorId } from "@matter/main/types";
import { HandlerSite, NODE_ID } from "./support/HandlerSite.js";

const UPDATE: SoftwareUpdateInfo = {
    vendorId: VendorId(0xfff1),
    productId: 0x8000,
    softwareVersion: 2,
    softwareVersionString: "2.0",
    source: "local",
};

const OTHER_NODE_ID = NodeId(999n);

describe("OTA update events", () => {
    let site: HandlerSite;
    let offered: SoftwareUpdateInfo[];
    let queries: number;
    let restoreQueryUpdates: () => void;

    beforeEach(async () => {
        site = new HandlerSite();
        offered = [UPDATE];
        queries = 0;
        const queryUpdates = SoftwareUpdateManager.prototype.queryUpdates;
        SoftwareUpdateManager.prototype.queryUpdates = async ({ peerToCheck } = {}) => {
            queries++;
            return offered.map(info => ({ peerAddress: peerToCheck!.peerAddress!, info }));
        };
        restoreQueryUpdates = () => {
            SoftwareUpdateManager.prototype.queryUpdates = queryUpdates;
        };
        await site.startDevice();
        await site.startController(true, { otaEnabled: true });
        await site.commission();
    });

    afterEach(async () => {
        restoreQueryUpdates();
        await site.close();
    });

    async function checkNodeUpdate(nodeId = NODE_ID) {
        return MockTime.resolve(site.handler.checkNodeUpdate(nodeId), { macrotasks: true });
    }

    async function updateEvents() {
        return site.controller.otaProvider!.act(agent => agent.get(SoftwareUpdateManager).events);
    }

    it("forgets the cached update of a node whose update failed", async () => {
        expect((await checkNodeUpdate())?.software_version).equals(2);
        offered = [];
        expect((await checkNodeUpdate())?.software_version).equals(2);
        expect(queries).equals(1);

        (await updateEvents()).updateFailed.emit(site.peer.peerAddress!);

        expect(await checkNodeUpdate()).equals(null);
        expect(queries).equals(2);
    });

    it("keeps the cached update of other nodes", async () => {
        const events = await updateEvents();
        const { fabricIndex } = site.peer.peerAddress!;
        events.updateAvailable.emit(PeerAddress({ fabricIndex, nodeId: OTHER_NODE_ID }), UPDATE);

        events.updateFailed.emit(site.peer.peerAddress!);

        expect((await checkNodeUpdate(OTHER_NODE_ID))?.software_version).equals(2);
        expect(queries).equals(0);
    });
});
