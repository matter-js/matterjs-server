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
    it("emits started then ended when commissionNode fails", async () => {
        const fakeController = {
            commissionNode: async () => {
                throw new Error("boom");
            },
        } as unknown as CommissioningController;

        const handler = new ControllerCommandHandler(fakeController, false, false, false);
        let started = 0;
        let ended = 0;
        handler.events.commissioningStarted.on(() => {
            started++;
        });
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
        expect(started).to.equal(1);
        expect(ended).to.equal(1);
    });

    it("emits started then ended when commissionNode succeeds (ended before registerNode)", async () => {
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
        let started = 0;
        let ended = 0;
        handler.events.commissioningStarted.on(() => {
            started++;
        });
        handler.events.commissioningEnded.on(() => {
            ended++;
        });

        // commissionNode succeeds at the controller level; #registerNode throws afterward.
        // The started/ended pair must already have fired before that throw.
        let threw = false;
        try {
            await handler.commissionNode({ passcode: 20202021 } satisfies CommissioningRequest);
        } catch {
            threw = true;
        }

        expect(threw).to.be.true;
        expect(started).to.equal(1);
        expect(ended).to.equal(1);
    });

    it("emits neither event for an invalid request that never reaches the controller", async () => {
        let controllerCalled = false;
        const fakeController = {
            commissionNode: async () => {
                controllerCalled = true;
                return NodeId(1n);
            },
        } as unknown as CommissioningController;

        const handler = new ControllerCommandHandler(fakeController, false, false, false);
        let started = 0;
        let ended = 0;
        handler.events.commissioningStarted.on(() => {
            started++;
        });
        handler.events.commissioningEnded.on(() => {
            ended++;
        });

        // Empty manualCode fails #determineCommissionOptions before any controller call.
        let threw = false;
        try {
            await handler.commissionNode({ manualCode: "" } satisfies CommissioningRequest);
        } catch {
            threw = true;
        }

        expect(threw).to.be.true;
        expect(controllerCalled).to.be.false;
        expect(started).to.equal(0);
        expect(ended).to.equal(0);
    });

    it("emits a balanced started/ended pair for each concurrent attempt", async () => {
        const resolvers = new Array<(value: NodeId) => void>();
        const fakeController = {
            commissionNode: () => new Promise<NodeId>(resolve => resolvers.push(resolve)),
            getNode: async () => {
                throw new Error("stop before registerNode");
            },
            fabric: { fabricIndex: 1 },
        } as unknown as CommissioningController;

        const handler = new ControllerCommandHandler(fakeController, false, false, false);
        let started = 0;
        let ended = 0;
        handler.events.commissioningStarted.on(() => {
            started++;
        });
        handler.events.commissioningEnded.on(() => {
            ended++;
        });

        const first = handler.commissionNode({ passcode: 20202021 } satisfies CommissioningRequest).catch(() => {});
        const second = handler.commissionNode({ passcode: 20202022 } satisfies CommissioningRequest).catch(() => {});

        await new Promise(r => setTimeout(r, 5));
        expect(started).to.equal(2);
        expect(ended).to.equal(0);

        resolvers[0](NodeId(1n));
        resolvers[1](NodeId(2n));
        await Promise.all([first, second]);
        expect(ended).to.equal(2);
    });
});
