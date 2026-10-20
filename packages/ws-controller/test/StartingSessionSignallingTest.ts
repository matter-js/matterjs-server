/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { EndpointNumber, NodeId } from "@matter/main";
import { MAX_QUEUED_ICE_CANDIDATES, StartingSessionSignalling } from "../src/server/startingSessionSignalling.js";
import { ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";

const NODE = NodeId(5);
const OTHER_NODE = NodeId(6);
const ENDPOINT = EndpointNumber(1);
const OTHER_ENDPOINT = EndpointNumber(2);

const fieldsFor = (webRtcSessionId: number) => ({ webRtcSessionId });

/** Records what `provide` received, in call order. */
function recorder() {
    const provided = new Array<Record<string, unknown>>();
    return {
        provided,
        provide: async (fields: Record<string, unknown>) => {
            provided.push(fields);
        },
    };
}

/** Resolves after the work the promise depends on had a chance to run, so a promise that never settles still fails on an assertion. */
async function outcomeOf(promise: Promise<void>): Promise<"resolved" | { rejected: unknown } | "pending"> {
    const pending = new Promise<"pending">(resolve => setImmediate(() => resolve("pending")));
    return Promise.race([
        promise.then(
            () => "resolved" as const,
            rejected => ({ rejected }),
        ),
        pending,
    ]);
}

describe("StartingSessionSignalling", () => {
    describe("hold", () => {
        it("holds an event of the started session only for its node, endpoint and id", () => {
            const signalling = new StartingSessionSignalling();
            signalling.begin(NODE, ENDPOINT, "key-a").established(7);

            expect(signalling.hold(OTHER_NODE, ENDPOINT, 7, () => {})).to.equal(false);
            expect(signalling.hold(NODE, OTHER_ENDPOINT, 7, () => {})).to.equal(false);
            expect(signalling.hold(NODE, ENDPOINT, 8, () => {})).to.equal(false);
            expect(signalling.hold(NODE, ENDPOINT, 7, () => {})).to.equal(true);
        });

        it("sends held events at release, in order, before the queued candidates", async () => {
            const signalling = new StartingSessionSignalling();
            const start = signalling.begin(NODE, ENDPOINT, "key-a");
            start.established(7);
            const order = new Array<string>();
            signalling.hold(NODE, ENDPOINT, 7, () => order.push("event-1"));
            signalling.hold(NODE, ENDPOINT, 7, () => order.push("event-2"));
            const queued = signalling.queueCandidates(NODE, ENDPOINT, "key-a", 1, fieldsFor);
            expect(order).to.deep.equal([]);

            start.release(async () => {
                order.push("candidates");
            });
            expect(await outcomeOf(queued!)).to.equal("resolved");

            expect(order).to.deep.equal(["event-1", "event-2", "candidates"]);
            expect(signalling.hold(NODE, ENDPOINT, 7, () => {})).to.equal(false);
        });
    });

    describe("queueCandidates", () => {
        it("answers undefined when no start names the key", () => {
            const signalling = new StartingSessionSignalling();
            signalling.begin(NODE, ENDPOINT, "key-a");
            expect(signalling.queueCandidates(NODE, ENDPOINT, "key-b", 1, fieldsFor)).to.equal(undefined);
        });

        it("provides the queued candidates in the order they were queued, with the session id", async () => {
            const signalling = new StartingSessionSignalling();
            const start = signalling.begin(NODE, ENDPOINT, "key-a");
            const first = signalling.queueCandidates(NODE, ENDPOINT, "key-a", 1, id => ({ id, n: 1 }));
            const second = signalling.queueCandidates(NODE, ENDPOINT, "key-a", 1, id => ({ id, n: 2 }));
            const third = signalling.queueCandidates(NODE, ENDPOINT, "key-a", 1, id => ({ id, n: 3 }));
            const { provided, provide } = recorder();

            start.established(7);
            start.release(provide);
            expect(await outcomeOf(Promise.all([first!, second!, third!]).then(() => undefined))).to.equal("resolved");

            expect(provided).to.deep.equal([
                { id: 7, n: 1 },
                { id: 7, n: 2 },
                { id: 7, n: 3 },
            ]);
        });

        it("queues on the start that named the key, not on another start of the same node and endpoint", async () => {
            const signalling = new StartingSessionSignalling();
            const first = signalling.begin(NODE, ENDPOINT, "key-a");
            const second = signalling.begin(NODE, ENDPOINT, "key-b");
            first.established(7);
            second.established(8);
            const queued = signalling.queueCandidates(NODE, ENDPOINT, "key-a", 1, fieldsFor);
            const { provided, provide } = recorder();

            second.release(provide);
            first.release(provide);
            expect(await outcomeOf(queued!)).to.equal("resolved");

            expect(provided).to.deep.equal([{ webRtcSessionId: 7 }]);
        });

        it("queues on the start of its own node when another node's start uses the same key", async () => {
            const signalling = new StartingSessionSignalling();
            const own = signalling.begin(OTHER_NODE, ENDPOINT, "key-a");
            const newer = signalling.begin(NODE, ENDPOINT, "key-a");
            own.established(7);
            newer.established(8);
            const queued = signalling.queueCandidates(OTHER_NODE, ENDPOINT, "key-a", 1, fieldsFor);
            const { provided, provide } = recorder();

            newer.release(provide);
            own.release(provide);
            expect(await outcomeOf(queued!)).to.equal("resolved");

            expect(provided).to.deep.equal([{ webRtcSessionId: 7 }]);
        });

        it("queues on the start of its own endpoint when another endpoint's start uses the same key", async () => {
            const signalling = new StartingSessionSignalling();
            const own = signalling.begin(NODE, OTHER_ENDPOINT, "key-a");
            const newer = signalling.begin(NODE, ENDPOINT, "key-a");
            own.established(7);
            newer.established(8);
            const queued = signalling.queueCandidates(NODE, OTHER_ENDPOINT, "key-a", 1, fieldsFor);
            const { provided, provide } = recorder();

            newer.release(provide);
            own.release(provide);
            expect(await outcomeOf(queued!)).to.equal("resolved");

            expect(provided).to.deep.equal([{ webRtcSessionId: 7 }]);
        });

        it("refuses with error 8 once more candidates than the bound wait, and accepts exactly the bound", async () => {
            const signalling = new StartingSessionSignalling();
            const start = signalling.begin(NODE, ENDPOINT, "key-a");
            const filling = signalling.queueCandidates(NODE, ENDPOINT, "key-a", MAX_QUEUED_ICE_CANDIDATES, fieldsFor);
            expect(filling).to.not.equal(undefined);

            const refused = signalling.queueCandidates(NODE, ENDPOINT, "key-a", 1, fieldsFor);
            expect(refused).to.not.equal(undefined);
            expect(await outcomeOf(refused!)).to.have.nested.property(
                "rejected.code",
                ServerErrorCode.InvalidArguments,
            );

            start.established(7);
            start.release(recorder().provide);
            expect(await outcomeOf(filling!)).to.equal("resolved");
        });

        it("counts only the candidates still waiting once the queue is being sent", async () => {
            const signalling = new StartingSessionSignalling();
            const start = signalling.begin(NODE, ENDPOINT, "key-a");
            const first = signalling.queueCandidates(NODE, ENDPOINT, "key-a", MAX_QUEUED_ICE_CANDIDATES, fieldsFor);
            let finishSending = (): void => {};
            const sending = new Promise<void>(resolve => {
                finishSending = resolve;
            });
            const provided = new Array<Record<string, unknown>>();

            start.established(7);
            start.release(async fields => {
                provided.push(fields);
                await sending;
            });
            expect(provided).to.have.lengthOf(1);

            const second = signalling.queueCandidates(NODE, ENDPOINT, "key-a", MAX_QUEUED_ICE_CANDIDATES, fieldsFor);
            expect(second).to.not.equal(undefined);
            finishSending();
            expect(await outcomeOf(first!)).to.equal("resolved");
            expect(await outcomeOf(second!)).to.equal("resolved");
            expect(provided).to.have.lengthOf(2);
        });

        it("rejects the queued candidates with error 8 when the response was an error", async () => {
            const signalling = new StartingSessionSignalling();
            const start = signalling.begin(NODE, ENDPOINT, "key-a");
            const queued = signalling.queueCandidates(NODE, ENDPOINT, "key-a", 1, fieldsFor);

            start.drop();

            expect(await outcomeOf(queued!)).to.have.nested.property("rejected.code", ServerErrorCode.InvalidArguments);
            expect(signalling.queueCandidates(NODE, ENDPOINT, "key-a", 1, fieldsFor)).to.equal(undefined);
        });
    });
});
