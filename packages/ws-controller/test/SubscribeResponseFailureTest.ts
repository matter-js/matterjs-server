/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { InteractionWsHarness } from "./support/InteractionWsHarness.js";

describe("subscribe response that cannot be sent", () => {
    let harness: InteractionWsHarness;

    beforeEach(async () => {
        harness = await InteractionWsHarness.create();
    });

    afterEach(async () => {
        await harness.close();
    });

    it("still sends the reports held until the response", async () => {
        const unserializable: Record<string, unknown> = {};
        unserializable.self = unserializable;
        harness.primingReport = { attributes: { "1/6/0": unserializable }, events: [] };
        harness.earlyReport = { attributes: { "1/6/0": true }, events: [] };
        harness.nextSubscriptionId = 78;
        const client = await harness.connect();

        client
            .command("subscribe", { node_id: 42, attribute_paths: ["1/6/0"], min_interval: 1, max_interval: 30 })
            .catch(() => undefined);
        await harness.waitFor(() => harness.subscriptions.length === 1);
        await new Promise(resolve => setTimeout(resolve, 50));

        const reports = client.events("subscription_report");
        expect(reports.map(report => report.data)).to.deep.equal([
            { node_id: 42, subscription_id: 78, attributes: { "1/6/0": true }, events: [] },
        ]);
    });
});
