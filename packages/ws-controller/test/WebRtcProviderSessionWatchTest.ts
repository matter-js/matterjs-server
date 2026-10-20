/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { EndpointNumber, Logger, LogLevel, Millis, NodeId } from "@matter/main";
import { Status, StatusResponseError } from "@matter/main/types";
import {
    LEFTOVER_SWEEP_RETRY_DELAY,
    MAX_FAILED_LEFTOVER_SWEEPS,
    RESTART_MARK_TIMEOUT,
    WebRtcProviderSessionWatch,
} from "../src/controller/WebRtcProviderSessionWatch.js";

const CAMERA = NodeId(5);
const ENDPOINT = EndpointNumber(1);
const SERVER = NodeId(100);
const OTHER_CONTROLLER = NodeId(200);
const LEVEL_NAMES = new Map([
    [LogLevel.WARN, "WARN"],
    [LogLevel.NOTICE, "NOTICE"],
]);

interface Fixture {
    watch: WebRtcProviderSessionWatch;
    sessions: Map<number, { id: number; peerNodeId: NodeId }[]>;
    requestor: Set<number>;
    reports: string[];
    ended: number[];
    endAttempts: number;
    endFailure?: Error;
    /** When set, each `EndSession` waits for this instead of answering at once. */
    endGate?: Promise<void>;
}

function fixture(): Fixture {
    const sessions = new Map<number, { id: number; peerNodeId: NodeId }[]>([[ENDPOINT, []]]);
    const requestor = new Set<number>();
    const reports = new Array<string>();
    const ended = new Array<number>();
    const result: Fixture = {
        watch: new WebRtcProviderSessionWatch({
            localNodeId: () => SERVER,
            providerEndpoints: () => [...sessions.keys()].map(id => EndpointNumber(id)),
            currentSessions: (_nodeId, endpointId) => sessions.get(endpointId),
            requestorSessionIds: () => requestor,
            endSession: async (_nodeId, _endpointId, webRtcSessionId) => {
                result.endAttempts++;
                if (result.endGate !== undefined) await result.endGate;
                if (result.endFailure !== undefined) throw result.endFailure;
                ended.push(webRtcSessionId);
            },
            reported: (nodeId, endpointId, present, restarted) => {
                reports.push(`${nodeId}/${endpointId} [${[...present].join(",")}] restarted=${restarted}`);
            },
        }),
        sessions,
        requestor,
        reports,
        ended,
        endAttempts: 0,
    };
    return result;
}

function ours(...ids: number[]) {
    return ids.map(id => ({ id, peerNodeId: SERVER }));
}

/** The first batch end of a run reports every provider endpoint; tests about later batches start after it. */
function pastFirstBatch(f: Fixture): void {
    f.watch.reportCompleted(CAMERA);
    f.reports.length = 0;
}

describe("WebRtcProviderSessionWatch", () => {
    it("reports a changed CurrentSessions at the batch end with this server's ids only", () => {
        const f = fixture();
        pastFirstBatch(f);
        f.sessions.set(ENDPOINT, [...ours(3), { id: 4, peerNodeId: OTHER_CONTROLLER }]);

        f.watch.currentSessionsChanged(CAMERA, ENDPOINT);
        expect(f.reports).to.deep.equal([]);
        f.watch.reportCompleted(CAMERA);

        expect(f.reports).to.deep.equal(["5/1 [3] restarted=false"]);
    });

    it("marks the report as a restart when the batch carried a StartUp event, in either order", () => {
        const f = fixture();
        pastFirstBatch(f);

        f.watch.currentSessionsChanged(CAMERA, ENDPOINT);
        f.watch.startedUp(CAMERA);
        f.watch.reportCompleted(CAMERA);
        f.watch.currentSessionsChanged(CAMERA, ENDPOINT);
        f.watch.reportCompleted(CAMERA);

        expect(f.reports).to.deep.equal(["5/1 [] restarted=true", "5/1 [] restarted=false"]);
    });

    it("marks an endpoint's first change report after the StartUp event as a restart, batches later", () => {
        const f = fixture();
        pastFirstBatch(f);

        f.watch.startedUp(CAMERA);
        f.watch.reportCompleted(CAMERA);
        f.watch.reportCompleted(CAMERA);
        f.watch.reportCompleted(CAMERA);
        f.watch.currentSessionsChanged(CAMERA, ENDPOINT);
        f.watch.reportCompleted(CAMERA);
        f.watch.currentSessionsChanged(CAMERA, ENDPOINT);
        f.watch.reportCompleted(CAMERA);

        expect(f.reports).to.deep.equal(["5/1 [] restarted=true", "5/1 [] restarted=false"]);
    });

    it("keeps the mark through a report built from node state in the StartUp batch", () => {
        const f = fixture();
        f.sessions.set(ENDPOINT, ours(3));

        f.watch.startedUp(CAMERA);
        f.watch.reportCompleted(CAMERA);
        f.sessions.set(ENDPOINT, []);
        f.watch.currentSessionsChanged(CAMERA, ENDPOINT);
        f.watch.reportCompleted(CAMERA);

        expect(f.reports).to.deep.equal(["5/1 [3] restarted=false", "5/1 [] restarted=true"]);
    });

    it("keeps the mark through a report sweepAgain or endpointAdded builds from node state", () => {
        const f = fixture();
        pastFirstBatch(f);

        f.watch.startedUp(CAMERA);
        f.watch.sweepAgain(CAMERA, ENDPOINT);
        f.watch.reportCompleted(CAMERA);
        f.watch.endpointAdded(CAMERA);
        f.watch.reportCompleted(CAMERA);
        f.watch.currentSessionsChanged(CAMERA, ENDPOINT);
        f.watch.reportCompleted(CAMERA);

        expect(f.reports).to.deep.equal(["5/1 [] restarted=false", "5/1 [] restarted=false", "5/1 [] restarted=true"]);
    });

    it(`forgets a StartUp event ${RESTART_MARK_TIMEOUT} ms after it arrived`, async () => {
        const f = fixture();
        pastFirstBatch(f);
        MockTime.enable();
        try {
            f.watch.startedUp(CAMERA);
            await MockTime.advance(Millis(RESTART_MARK_TIMEOUT - 1));
            f.watch.currentSessionsChanged(CAMERA, ENDPOINT);
            f.watch.reportCompleted(CAMERA);

            f.watch.startedUp(CAMERA);
            await MockTime.advance(RESTART_MARK_TIMEOUT);
            f.watch.currentSessionsChanged(CAMERA, ENDPOINT);
            f.watch.reportCompleted(CAMERA);
        } finally {
            MockTime.disable();
        }

        expect(f.reports).to.deep.equal(["5/1 [] restarted=true", "5/1 [] restarted=false"]);
    });

    it("reports and sweeps every endpoint when handling one report throws", async () => {
        const OTHER = EndpointNumber(2);
        const sessions = new Map([
            [ENDPOINT, ours(1)],
            [OTHER, ours(2)],
        ]);
        const reported = new Array<string>();
        const ended = new Array<number>();
        const watch = new WebRtcProviderSessionWatch({
            localNodeId: () => SERVER,
            providerEndpoints: () => [ENDPOINT, OTHER],
            currentSessions: (_nodeId, endpointId) => sessions.get(endpointId),
            requestorSessionIds: () => new Set<number>(),
            endSession: async (_nodeId, _endpointId, webRtcSessionId) => {
                ended.push(webRtcSessionId);
            },
            reported: (_nodeId, endpointId, _present, restarted) => {
                reported.push(`${endpointId} restarted=${restarted}`);
                if (endpointId === ENDPOINT) throw new Error("listener failed");
            },
        });

        watch.startedUp(CAMERA);
        watch.currentSessionsChanged(CAMERA, ENDPOINT);
        watch.reportCompleted(CAMERA);
        watch.currentSessionsChanged(CAMERA, ENDPOINT);
        watch.reportCompleted(CAMERA);
        await Promise.resolve();

        expect(reported).to.deep.equal(["1 restarted=true", "2 restarted=false", "1 restarted=false"]);
        expect(ended).to.deep.equal([1, 2]);
    });

    it("marks the first report of each endpoint after a StartUp event, in whichever batch it comes", () => {
        const f = fixture();
        const OTHER = EndpointNumber(2);
        f.sessions.set(OTHER, []);
        pastFirstBatch(f);

        f.watch.startedUp(CAMERA);
        f.watch.currentSessionsChanged(CAMERA, ENDPOINT);
        f.watch.reportCompleted(CAMERA);
        f.watch.currentSessionsChanged(CAMERA, ENDPOINT);
        f.watch.currentSessionsChanged(CAMERA, OTHER);
        f.watch.reportCompleted(CAMERA);

        expect(f.reports).to.deep.equal(["5/1 [] restarted=true", "5/1 [] restarted=false", "5/2 [] restarted=true"]);
    });

    it("reports a changed endpoint once: the batch end consumes its change", () => {
        const f = fixture();
        pastFirstBatch(f);

        f.watch.currentSessionsChanged(CAMERA, ENDPOINT);
        f.watch.reportCompleted(CAMERA);
        f.watch.reportCompleted(CAMERA);

        expect(f.reports).to.deep.equal(["5/1 [] restarted=false"]);
    });

    it("reports nothing for an endpoint whose provider state is gone", () => {
        const f = fixture();
        pastFirstBatch(f);
        f.sessions.delete(ENDPOINT);

        f.watch.currentSessionsChanged(CAMERA, ENDPOINT);
        f.watch.reportCompleted(CAMERA);

        expect(f.reports).to.deep.equal([]);
    });

    it("drops the StartUp event of a removed node", () => {
        const f = fixture();
        pastFirstBatch(f);
        f.watch.startedUp(CAMERA);

        f.watch.nodeRemoved(CAMERA);
        f.watch.reportCompleted(CAMERA);
        f.watch.currentSessionsChanged(CAMERA, ENDPOINT);
        f.watch.reportCompleted(CAMERA);

        expect(f.reports).to.deep.equal(["5/1 [] restarted=false", "5/1 [] restarted=false"]);
    });

    it("keeps the sweep done for other nodes when a node is removed", async () => {
        const f = fixture();
        const OTHER_CAMERA = NodeId(15);
        f.watch.reportCompleted(CAMERA);
        f.watch.reportCompleted(OTHER_CAMERA);
        f.watch.nodeRemoved(NodeId(1));
        f.sessions.set(ENDPOINT, ours(1));

        f.watch.endpointAdded(CAMERA);
        f.watch.endpointAdded(OTHER_CAMERA);
        f.watch.reportCompleted(CAMERA);
        f.watch.reportCompleted(OTHER_CAMERA);
        await Promise.resolve();

        expect(f.ended).to.deep.equal([]);
    });

    it("sweeps an endpoint again after sweepAgain, ending what the requestor does not hold", async () => {
        const f = fixture();
        f.watch.reportCompleted(CAMERA);
        f.sessions.set(ENDPOINT, ours(4, 5));
        f.requestor.add(5);

        f.watch.sweepAgain(CAMERA, ENDPOINT);
        f.watch.reportCompleted(CAMERA);
        await Promise.resolve();

        expect(f.ended).to.deep.equal([4]);
    });

    it("keeps waiting with the sweep while a second establishing call on the endpoint runs", async () => {
        const f = fixture();
        f.sessions.set(ENDPOINT, ours(7));
        const gates = [0, 1].map(() => {
            let finish = () => {};
            const gate = new Promise<void>(resolve => {
                finish = resolve;
            });
            return { finish, running: f.watch.establishing(CAMERA, ENDPOINT, () => gate) };
        });

        gates[0].finish();
        await gates[0].running;
        f.watch.reportCompleted(CAMERA);
        await Promise.resolve();
        expect(f.ended).to.deep.equal([]);

        gates[1].finish();
        await gates[1].running;
        f.watch.reportCompleted(CAMERA);
        await Promise.resolve();
        expect(f.ended).to.deep.equal([7]);
    });

    it("lets the sweep run again once an establishing call failed", async () => {
        const f = fixture();
        f.sessions.set(ENDPOINT, ours(7));
        let failure: unknown;
        try {
            await f.watch.establishing(CAMERA, ENDPOINT, async () => {
                throw new Error("refused");
            });
        } catch (error) {
            failure = error;
        }
        expect(failure).to.be.instanceOf(Error);

        f.watch.reportCompleted(CAMERA);
        await Promise.resolve();
        expect(f.ended).to.deep.equal([7]);
    });

    it("sweeps an endpoint added after the node's first batch end", async () => {
        const f = fixture();
        f.sessions.clear();
        f.watch.reportCompleted(CAMERA);

        f.sessions.set(ENDPOINT, ours(1));
        f.watch.endpointAdded(CAMERA);
        f.watch.reportCompleted(CAMERA);
        await Promise.resolve();

        expect(f.ended).to.deep.equal([1]);
    });

    it("reports nothing for a batch without a CurrentSessions change once the first batch is done", () => {
        const f = fixture();
        f.watch.reportCompleted(CAMERA);
        f.watch.reportCompleted(CAMERA);
        expect(f.reports).to.deep.equal(["5/1 [] restarted=false"]);
    });

    it("looks up a node without a camera endpoint once, not at every batch end", () => {
        let lookups = 0;
        const watch = new WebRtcProviderSessionWatch({
            localNodeId: () => SERVER,
            providerEndpoints: () => {
                lookups++;
                return [];
            },
            currentSessions: () => undefined,
            requestorSessionIds: () => new Set<number>(),
            endSession: async () => {},
            reported: () => {},
        });

        watch.reportCompleted(CAMERA);
        watch.reportCompleted(CAMERA);

        expect(lookups).to.equal(1);
    });

    it("ends, once, every session the camera holds for this server that no local record names", async () => {
        const f = fixture();
        f.sessions.set(ENDPOINT, [...ours(1, 2), { id: 3, peerNodeId: OTHER_CONTROLLER }]);
        f.requestor.add(2);

        f.watch.reportCompleted(CAMERA);
        f.watch.currentSessionsChanged(CAMERA, ENDPOINT);
        f.watch.reportCompleted(CAMERA);
        await Promise.resolve();

        expect(f.ended).to.deep.equal([1]);
    });

    it("waits with the sweep while a session is being established on that endpoint", async () => {
        const f = fixture();
        f.sessions.set(ENDPOINT, ours(7));
        let finish = () => {};
        const establishing = f.watch.establishing(
            CAMERA,
            ENDPOINT,
            () =>
                new Promise<void>(resolve => {
                    finish = resolve;
                }),
        );

        f.watch.reportCompleted(CAMERA);
        await Promise.resolve();
        expect(f.ended).to.deep.equal([]);

        // The establishing call returns once the local requestor holds the session.
        f.requestor.add(7);
        finish();
        await establishing;
        f.sessions.set(ENDPOINT, ours(7, 1));
        f.watch.reportCompleted(CAMERA);
        await Promise.resolve();
        expect(f.ended).to.deep.equal([1]);
    });

    /** What the watch logged while `work` ran, as `level message`. */
    async function logged(work: () => Promise<void>): Promise<string[]> {
        const captured = new Array<string>();
        const destination = Logger.destinations.default;
        const original = destination.add;
        destination.add = message => {
            if (message.facility === "WebRtcProviderSessionWatch") {
                captured.push(
                    `${LEVEL_NAMES.get(message.level) ?? message.level} ${message.values.map(value => String(value)).join(" ")}`,
                );
            }
            original.call(destination, message);
        };
        try {
            await work();
        } finally {
            destination.add = original;
        }
        return captured;
    }

    async function sweepOne(endFailure?: Error): Promise<string[]> {
        const f = fixture();
        f.sessions.set(ENDPOINT, ours(1));
        f.endFailure = endFailure;
        return logged(async () => {
            f.watch.reportCompleted(CAMERA);
            await new Promise(resolve => setTimeout(resolve, 0));
        });
    }

    it("logs each leftover session it ended at notice level", async () => {
        const messages = await sweepOne();
        expect(messages).to.have.length(1);
        expect(messages[0]).to.match(/^NOTICE Ended WebRTC session 1 on node 5 endpoint 1/);
    });

    it("treats a NotFound answer as the session being gone already, and warns on any other failure", async () => {
        expect(await sweepOne(new StatusResponseError("gone", Status.NotFound))).to.deep.equal([]);
        const failed = await sweepOne(new StatusResponseError("busy", Status.Busy));
        expect(failed).to.have.length(1);
        expect(failed[0]).to.match(/^WARN Ending leftover WebRTC session 1/);
    });

    /** Lets the sweep's `EndSession` calls and their result handling settle. */
    const settled = () => new Promise(resolve => setTimeout(resolve, 0));

    it("sweeps again after a failed EndSession, once the retry delay passed, against the current list", async () => {
        const f = fixture();
        f.sessions.set(ENDPOINT, ours(1));
        f.endFailure = new StatusResponseError("busy", Status.Busy);
        MockTime.enable();
        try {
            f.watch.reportCompleted(CAMERA);
            await settled();
            expect(f.endAttempts).to.equal(1);

            f.endFailure = undefined;
            f.sessions.set(ENDPOINT, ours(1, 2));
            await MockTime.advance(Millis(LEFTOVER_SWEEP_RETRY_DELAY - 1));
            f.watch.reportCompleted(CAMERA);
            await settled();
            expect(f.endAttempts).to.equal(1);

            await MockTime.advance(Millis(1));
            f.watch.reportCompleted(CAMERA);
            await settled();
            expect(f.ended).to.deep.equal([1, 2]);

            await MockTime.advance(LEFTOVER_SWEEP_RETRY_DELAY);
            f.watch.reportCompleted(CAMERA);
            await settled();
            expect(f.endAttempts).to.equal(3);
        } finally {
            MockTime.disable();
        }
    });

    it(`stops sweeping an endpoint after ${MAX_FAILED_LEFTOVER_SWEEPS} failed sweeps`, async () => {
        const f = fixture();
        f.sessions.set(ENDPOINT, ours(1));
        f.endFailure = new StatusResponseError("busy", Status.Busy);
        MockTime.enable();
        try {
            const messages = await logged(async () => {
                for (let round = 0; round < MAX_FAILED_LEFTOVER_SWEEPS + 2; round++) {
                    f.watch.reportCompleted(CAMERA);
                    await settled();
                    await MockTime.advance(LEFTOVER_SWEEP_RETRY_DELAY);
                }
            });
            expect(f.endAttempts).to.equal(MAX_FAILED_LEFTOVER_SWEEPS);
            expect(messages.at(-1)).to.match(/^WARN Leaving the leftover WebRTC sessions on node 5 endpoint 1 after 3/);

            f.watch.sweepAgain(CAMERA, ENDPOINT);
            f.watch.reportCompleted(CAMERA);
            await settled();
            expect(f.endAttempts).to.equal(MAX_FAILED_LEFTOVER_SWEEPS + 1);
        } finally {
            MockTime.disable();
        }
    });

    it("lets sweepAgain during a failing EndSession sweep at the next batch end, without the retry delay", async () => {
        const f = fixture();
        f.sessions.set(ENDPOINT, ours(1));
        f.endFailure = new StatusResponseError("busy", Status.Busy);
        let open = () => {};
        f.endGate = new Promise<void>(resolve => {
            open = resolve;
        });

        f.watch.reportCompleted(CAMERA);
        f.watch.sweepAgain(CAMERA, ENDPOINT);
        open();
        await settled();
        f.endGate = undefined;
        f.endFailure = undefined;
        f.watch.reportCompleted(CAMERA);
        await settled();

        expect(f.ended).to.deep.equal([1]);
    });

    for (const [what, reset] of [
        ["sweepAgain", (f: Fixture) => f.watch.sweepAgain(CAMERA, ENDPOINT)],
        ["a node removal", (f: Fixture) => f.watch.nodeRemoved(CAMERA)],
    ] as const) {
        it(`drops the retry delay of a failed sweep on ${what}`, async () => {
            const f = fixture();
            f.sessions.set(ENDPOINT, ours(1));
            f.endFailure = new StatusResponseError("busy", Status.Busy);
            f.watch.reportCompleted(CAMERA);
            await settled();

            f.endFailure = undefined;
            reset(f);
            f.watch.reportCompleted(CAMERA);
            await settled();

            expect(f.ended).to.deep.equal([1]);
        });
    }

    it("sweeps a node again after it was removed and commissioned anew", async () => {
        const f = fixture();
        f.watch.reportCompleted(CAMERA);
        f.watch.nodeRemoved(CAMERA);
        f.sessions.set(ENDPOINT, ours(1));

        f.watch.reportCompleted(CAMERA);
        await Promise.resolve();

        expect(f.ended).to.deep.equal([1]);
    });
});
