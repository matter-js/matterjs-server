/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { EndpointNumber, NodeId } from "@matter/main";
import {
    ICE_CANDIDATE_FRAMING_BYTES,
    ICE_CANDIDATES_BYTE_BUDGET,
    MAX_QUEUED_ICE_CANDIDATES,
    StartingSessionSignalling,
} from "../src/server/startingSessionSignalling.js";
import { ServerErrorCode } from "../src/types/WebSocketMessageTypes.js";

const NODE = NodeId(5);
const OTHER_NODE = NodeId(6);
const ENDPOINT = EndpointNumber(1);
const OTHER_ENDPOINT = EndpointNumber(2);

const fieldsFor = (webRtcSessionId: number) => ({ webRtcSessionId });

/** `count` small candidates, labelled so a test can follow them through a merge. */
const candidates = (count: number, label = "c") =>
    Array.from({ length: count }, (_, index) => ({ candidate: `${label}${index}` }));

/** A candidate whose estimated size in an invoke is exactly `bytes`. */
const candidateOfBytes = (bytes: number, label: string) => ({
    candidate: label.padEnd(bytes - ICE_CANDIDATE_FRAMING_BYTES, "x"),
});

/** The fields of one send: the session id and the candidates it carries. */
const listFields = (id: number, carried: ReadonlyArray<unknown>) => ({ id, candidates: carried });

const labelsOf = (fields: Record<string, unknown>) =>
    Array.isArray(fields.candidates) ? fields.candidates.map(entry => String(entry.candidate).slice(0, 2)) : [];

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

/** The tracked-session lookup for a session that stays open under its key with this id. */
const trackedAs = (webRtcSessionId: number) => () => webRtcSessionId;

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
            const queued = signalling.queueCandidates(NODE, ENDPOINT, "key-a", candidates(1), fieldsFor);
            expect(order).to.deep.equal([]);

            start.release(async () => {
                order.push("candidates");
            }, trackedAs(7));
            expect(await outcomeOf(queued!)).to.equal("resolved");

            expect(order).to.deep.equal(["event-1", "event-2", "candidates"]);
            expect(signalling.hold(NODE, ENDPOINT, 7, () => {})).to.equal(false);
        });
    });

    describe("queueCandidates", () => {
        it("answers undefined when no start names the key", () => {
            const signalling = new StartingSessionSignalling();
            signalling.begin(NODE, ENDPOINT, "key-a");
            expect(signalling.queueCandidates(NODE, ENDPOINT, "key-b", candidates(1), fieldsFor)).to.equal(undefined);
        });

        it("queues on the start that named the key, not on another start of the same node and endpoint", async () => {
            const signalling = new StartingSessionSignalling();
            const first = signalling.begin(NODE, ENDPOINT, "key-a");
            const second = signalling.begin(NODE, ENDPOINT, "key-b");
            first.established(7);
            second.established(8);
            const queued = signalling.queueCandidates(NODE, ENDPOINT, "key-a", candidates(1), fieldsFor);
            const { provided, provide } = recorder();

            second.release(provide, trackedAs(8));
            first.release(provide, trackedAs(7));
            expect(await outcomeOf(queued!)).to.equal("resolved");

            expect(provided).to.deep.equal([{ webRtcSessionId: 7 }]);
        });

        it("queues on the start of its own node when another node's start uses the same key", async () => {
            const signalling = new StartingSessionSignalling();
            const own = signalling.begin(OTHER_NODE, ENDPOINT, "key-a");
            const newer = signalling.begin(NODE, ENDPOINT, "key-a");
            own.established(7);
            newer.established(8);
            const queued = signalling.queueCandidates(OTHER_NODE, ENDPOINT, "key-a", candidates(1), fieldsFor);
            const { provided, provide } = recorder();

            newer.release(provide, trackedAs(8));
            own.release(provide, trackedAs(7));
            expect(await outcomeOf(queued!)).to.equal("resolved");

            expect(provided).to.deep.equal([{ webRtcSessionId: 7 }]);
        });

        it("queues on the start of its own endpoint when another endpoint's start uses the same key", async () => {
            const signalling = new StartingSessionSignalling();
            const own = signalling.begin(NODE, OTHER_ENDPOINT, "key-a");
            const newer = signalling.begin(NODE, ENDPOINT, "key-a");
            own.established(7);
            newer.established(8);
            const queued = signalling.queueCandidates(NODE, OTHER_ENDPOINT, "key-a", candidates(1), fieldsFor);
            const { provided, provide } = recorder();

            newer.release(provide, trackedAs(8));
            own.release(provide, trackedAs(7));
            expect(await outcomeOf(queued!)).to.equal("resolved");

            expect(provided).to.deep.equal([{ webRtcSessionId: 7 }]);
        });

        it("refuses with error 8 once more candidates than the bound wait, and accepts exactly the bound", async () => {
            const signalling = new StartingSessionSignalling();
            const start = signalling.begin(NODE, ENDPOINT, "key-a");
            const filling = signalling.queueCandidates(
                NODE,
                ENDPOINT,
                "key-a",
                candidates(MAX_QUEUED_ICE_CANDIDATES),
                fieldsFor,
            );
            expect(filling).to.not.equal(undefined);

            const refused = signalling.queueCandidates(NODE, ENDPOINT, "key-a", candidates(1), fieldsFor);
            expect(refused).to.not.equal(undefined);
            expect(await outcomeOf(refused!)).to.have.nested.property(
                "rejected.code",
                ServerErrorCode.InvalidArguments,
            );

            start.established(7);
            start.release(recorder().provide, trackedAs(7));
            expect(await outcomeOf(filling!)).to.equal("resolved");
        });

        it("counts only the candidates still waiting once the queue is being sent", async () => {
            const signalling = new StartingSessionSignalling();
            const start = signalling.begin(NODE, ENDPOINT, "key-a");
            const first = signalling.queueCandidates(
                NODE,
                ENDPOINT,
                "key-a",
                candidates(MAX_QUEUED_ICE_CANDIDATES),
                listFields,
            );
            let finishSending = (): void => {};
            const sending = new Promise<void>(resolve => {
                finishSending = resolve;
            });
            const provided = new Array<Record<string, unknown>>();

            start.established(7);
            start.release(async fields => {
                provided.push(fields);
                await sending;
            }, trackedAs(7));
            expect(provided.length).to.be.greaterThan(0);

            const second = signalling.queueCandidates(
                NODE,
                ENDPOINT,
                "key-a",
                candidates(MAX_QUEUED_ICE_CANDIDATES),
                listFields,
            );
            expect(second).to.not.equal(undefined);
            finishSending();
            expect(await outcomeOf(first!)).to.equal("resolved");
            expect(await outcomeOf(second!)).to.equal("resolved");
            const sentCandidates = provided.reduce((sum, fields) => sum + labelsOf(fields).length, 0);
            expect(sentCandidates).to.equal(2 * MAX_QUEUED_ICE_CANDIDATES);
        });

        for (const [what, current] of [
            ["ended or its id went to another session", undefined],
            ["was replaced by a newer one under the same key", 3],
        ] as const) {
            it(`refuses the rest of the queue with error 8 once the session ${what}, during a send`, async () => {
                const signalling = new StartingSessionSignalling();
                const start = signalling.begin(NODE, ENDPOINT, "key-a");
                const first = signalling.queueCandidates(NODE, ENDPOINT, "key-a", candidates(1), fieldsFor);
                let tracked: number | undefined = 7;
                const provided = new Array<Record<string, unknown>>();

                start.established(7);
                let queuedDuringSend: Promise<void> | undefined;
                start.release(
                    async fields => {
                        provided.push(fields);
                        queuedDuringSend = signalling.queueCandidates(
                            NODE,
                            ENDPOINT,
                            "key-a",
                            candidates(1),
                            fieldsFor,
                        );
                        tracked = current;
                    },
                    () => tracked,
                );

                expect(await outcomeOf(first!)).to.equal("resolved");
                expect(await outcomeOf(queuedDuringSend!)).to.have.nested.property(
                    "rejected.code",
                    ServerErrorCode.InvalidArguments,
                );
                expect(provided).to.deep.equal([{ webRtcSessionId: 7 }]);
            });
        }

        it("rejects the queued candidates with error 8 when the response was an error", async () => {
            const signalling = new StartingSessionSignalling();
            const start = signalling.begin(NODE, ENDPOINT, "key-a");
            const queued = signalling.queueCandidates(NODE, ENDPOINT, "key-a", candidates(1), fieldsFor);

            start.drop();

            expect(await outcomeOf(queued!)).to.have.nested.property("rejected.code", ServerErrorCode.InvalidArguments);
            expect(signalling.queueCandidates(NODE, ENDPOINT, "key-a", candidates(1), fieldsFor)).to.equal(undefined);
        });
    });

    describe("sending the queue", () => {
        const half = Math.floor(ICE_CANDIDATES_BYTE_BUDGET / 2);
        const tooBigForTwo = Math.floor(ICE_CANDIDATES_BYTE_BUDGET / 2) + 1;

        /** A start that is established and not released yet, with a recorder whose `provide` can be told to fail. */
        function startedWith(failures: Array<Error | undefined> = []) {
            const signalling = new StartingSessionSignalling();
            const start = signalling.begin(NODE, ENDPOINT, "key-a");
            start.established(7);
            const provided = new Array<Record<string, unknown>>();
            const provide = async (fields: Record<string, unknown>) => {
                provided.push(fields);
                const failure = failures[provided.length - 1];
                if (failure !== undefined) throw failure;
            };
            return { signalling, start, provided, provide };
        }

        it("sends the candidates of every queued command in one invoke, in order, and resolves each", async () => {
            const { signalling, start, provided, provide } = startedWith();
            const queued = [
                signalling.queueCandidates(NODE, ENDPOINT, "key-a", candidates(2, "a"), listFields),
                signalling.queueCandidates(NODE, ENDPOINT, "key-a", candidates(1, "b"), listFields),
                signalling.queueCandidates(NODE, ENDPOINT, "key-a", candidates(2, "c"), listFields),
            ];

            start.release(provide, trackedAs(7));

            for (const promise of queued) expect(await outcomeOf(promise!)).to.equal("resolved");
            expect(provided).to.have.lengthOf(1);
            expect(provided[0].id).to.equal(7);
            expect(labelsOf(provided[0])).to.deep.equal(["a0", "a1", "b0", "c0", "c1"]);
        });

        it("keeps candidates in one invoke up to the byte budget and splits one byte over it", async () => {
            const fitting = startedWith();
            const fits = [
                fitting.signalling.queueCandidates(
                    NODE,
                    ENDPOINT,
                    "key-a",
                    [candidateOfBytes(ICE_CANDIDATES_BYTE_BUDGET - 100, "a0")],
                    listFields,
                ),
                fitting.signalling.queueCandidates(NODE, ENDPOINT, "key-a", [candidateOfBytes(100, "b0")], listFields),
            ];
            fitting.start.release(fitting.provide, trackedAs(7));
            for (const promise of fits) expect(await outcomeOf(promise!)).to.equal("resolved");
            expect(fitting.provided.map(labelsOf)).to.deep.equal([["a0", "b0"]]);

            const over = startedWith();
            const splits = [
                over.signalling.queueCandidates(
                    NODE,
                    ENDPOINT,
                    "key-a",
                    [candidateOfBytes(ICE_CANDIDATES_BYTE_BUDGET - 100, "a0")],
                    listFields,
                ),
                over.signalling.queueCandidates(
                    NODE,
                    ENDPOINT,
                    "key-a",
                    [candidateOfBytes(101, "b0"), candidateOfBytes(10, "b1")],
                    listFields,
                ),
            ];
            over.start.release(over.provide, trackedAs(7));
            for (const promise of splits) expect(await outcomeOf(promise!)).to.equal("resolved");
            expect(over.provided.map(labelsOf)).to.deep.equal([["a0"], ["b0", "b1"]]);
        });

        it("sends a candidate larger than the budget alone instead of dropping it", async () => {
            const { signalling, start, provided, provide } = startedWith();
            const queued = signalling.queueCandidates(
                NODE,
                ENDPOINT,
                "key-a",
                [candidateOfBytes(ICE_CANDIDATES_BYTE_BUDGET * 2, "a0"), candidateOfBytes(20, "b0")],
                listFields,
            );

            start.release(provide, trackedAs(7));

            expect(await outcomeOf(queued!)).to.equal("resolved");
            expect(provided.map(labelsOf)).to.deep.equal([["a0"], ["b0"]]);
        });

        it("answers a command split across invokes with the first failure, else success", async () => {
            const first = new Error("first");
            const second = new Error("second");
            for (const [failures, expected] of [
                [[first, second], { rejected: first }],
                [[undefined, second], { rejected: second }],
                [[first, undefined], { rejected: first }],
                [[undefined, undefined], "resolved"],
            ] as const) {
                const { signalling, start, provided, provide } = startedWith([...failures]);
                const queued = signalling.queueCandidates(
                    NODE,
                    ENDPOINT,
                    "key-a",
                    [candidateOfBytes(tooBigForTwo, "a0"), candidateOfBytes(tooBigForTwo, "a1")],
                    listFields,
                );

                start.release(provide, trackedAs(7));

                expect(await outcomeOf(queued!)).to.deep.equal(expected);
                expect(provided.map(labelsOf)).to.deep.equal([["a0"], ["a1"]]);
            }
        });

        it("fails every command of a failed merged invoke, and not the commands of the next invoke", async () => {
            const failure = new Error("refused");
            const { signalling, start, provided, provide } = startedWith([failure]);
            const inFirst = [
                signalling.queueCandidates(NODE, ENDPOINT, "key-a", [candidateOfBytes(half, "a0")], listFields),
                signalling.queueCandidates(NODE, ENDPOINT, "key-a", [candidateOfBytes(half, "b0")], listFields),
            ];
            const inSecond = signalling.queueCandidates(
                NODE,
                ENDPOINT,
                "key-a",
                [candidateOfBytes(half, "c0")],
                listFields,
            );

            start.release(provide, trackedAs(7));

            for (const promise of inFirst) {
                expect(await outcomeOf(promise!)).to.deep.equal({ rejected: failure });
            }
            expect(await outcomeOf(inSecond!)).to.equal("resolved");
            expect(provided.map(labelsOf)).to.deep.equal([["a0", "b0"], ["c0"]]);
        });

        it("sends candidates queued during an invoke in the next invoke, all together", async () => {
            const { signalling, start } = startedWith();
            const first = signalling.queueCandidates(NODE, ENDPOINT, "key-a", candidates(1, "a"), listFields);
            const provided = new Array<Record<string, unknown>>();
            let finishFirst = (): void => {};
            const held = new Promise<void>(resolve => {
                finishFirst = resolve;
            });

            start.release(async fields => {
                provided.push(fields);
                if (provided.length === 1) await held;
            }, trackedAs(7));
            expect(provided.map(labelsOf)).to.deep.equal([["a0"]]);
            const during = [
                signalling.queueCandidates(NODE, ENDPOINT, "key-a", candidates(1, "b"), listFields),
                signalling.queueCandidates(NODE, ENDPOINT, "key-a", candidates(1, "c"), listFields),
            ];
            expect(provided).to.have.lengthOf(1);
            finishFirst();

            expect(await outcomeOf(first!)).to.equal("resolved");
            for (const promise of during) expect(await outcomeOf(promise!)).to.equal("resolved");
            expect(provided.map(labelsOf)).to.deep.equal([["a0"], ["b0", "c0"]]);
        });

        it("checks that the key still names the session before every invoke of a split queue", async () => {
            const { signalling, start } = startedWith();
            const sent = signalling.queueCandidates(
                NODE,
                ENDPOINT,
                "key-a",
                [candidateOfBytes(tooBigForTwo, "a0")],
                listFields,
            );
            const refused = signalling.queueCandidates(
                NODE,
                ENDPOINT,
                "key-a",
                [candidateOfBytes(tooBigForTwo, "b0")],
                listFields,
            );
            let tracked: number | undefined = 7;
            const provided = new Array<Record<string, unknown>>();

            start.release(
                async fields => {
                    provided.push(fields);
                    tracked = undefined;
                },
                () => tracked,
            );

            expect(await outcomeOf(sent!)).to.equal("resolved");
            expect(await outcomeOf(refused!)).to.have.nested.property(
                "rejected.code",
                ServerErrorCode.InvalidArguments,
            );
            expect(provided.map(labelsOf)).to.deep.equal([["a0"]]);
        });
    });
});
