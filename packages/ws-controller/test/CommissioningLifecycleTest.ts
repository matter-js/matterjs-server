/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeId } from "@matter/main";
import type { CommissioningController } from "@project-chip/matter.js";
import { ControllerCommandHandler } from "../src/controller/ControllerCommandHandler.js";
import type { CommissioningRequest } from "../src/types/CommandHandler.js";

describe("ControllerCommandHandler commissioning lifecycle", () => {
    it("emits commissioningEnded when commissionNode fails", async () => {
        const fakeController = {
            commissionNode: async () => {
                throw new Error("boom");
            },
        } as unknown as CommissioningController;

        const handler = new ControllerCommandHandler(fakeController, false, false, false);
        let ended = 0;
        handler.events.commissioningEnded.on(() => {
            ended++;
        });

        let threw = false;
        try {
            await handler.commissionNode({ passcode: 20202021 } satisfies CommissioningRequest);
        } catch {
            threw = true;
        }

        expect(threw).to.be.true;
        expect(ended).to.equal(1);
    });

    it("emits commissioningEnded when commissionNode succeeds (before registerNode)", async () => {
        const returnedNodeId = NodeId(42n);
        const fakeController = {
            commissionNode: async () => returnedNodeId,
            // getNode is called by #registerNode; throw to keep the test minimal
            getNode: async () => {
                throw new Error("not needed in this test");
            },
            fabric: { fabricIndex: 1 },
        } as unknown as CommissioningController;

        const handler = new ControllerCommandHandler(fakeController, false, false, false);
        let ended = 0;
        handler.events.commissioningEnded.on(() => {
            ended++;
        });

        // commissionNode succeeds at the controller level; #registerNode throws afterward.
        // commissioningEnded must already have fired before that throw.
        let threw = false;
        try {
            await handler.commissionNode({ passcode: 20202021 } satisfies CommissioningRequest);
        } catch {
            threw = true;
        }

        expect(threw).to.be.true;
        expect(ended).to.equal(1);
    });
});
