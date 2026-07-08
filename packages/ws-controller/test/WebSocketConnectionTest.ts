/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Millis } from "@matter/main";
import { OutboundSocket, WebSocketConnection } from "../src/server/WebSocketConnection.js";

const OPEN = 1;

/**
 * Controllable stand-in for a `ws` socket. `bufferedAmount` is set directly by the test to simulate
 * congestion; queued-mode sends carry a callback that the test releases via {@link flushOne} to step
 * the drain pump deterministically.
 */
class FakeSocket implements OutboundSocket {
    bufferedAmount = 0;
    readyState = OPEN;
    terminated = false;
    readonly sent = new Array<string>();
    readonly closes = new Array<{ code?: number; reason?: string }>();
    #pending = new Array<(err?: Error) => void>();

    send(data: string, cb?: (err?: Error) => void): void {
        this.sent.push(data);
        if (cb) this.#pending.push(cb);
    }

    close(code?: number, reason?: string): void {
        this.readyState = 3;
        this.closes.push({ code, reason });
    }

    terminate(): void {
        this.terminated = true;
        this.readyState = 3;
    }

    /** Release the oldest held send callback, as if that frame flushed to the OS socket. */
    flushOne(err?: Error): void {
        const cb = this.#pending.shift();
        if (cb === undefined) throw new Error("no pending send callback to flush");
        cb(err);
    }

    get pendingCount(): number {
        return this.#pending.length;
    }
}

function makeConn(socket: FakeSocket, overrides: Partial<ConstructorParameters<typeof WebSocketConnection>[1]> = {}) {
    return new WebSocketConnection(socket, {
        connId: "test",
        highWaterBytes: 100,
        capBase: 1000,
        capPerNode: 20,
        watchdog: Millis(300_000),
        getNodeCount: () => 0,
        ...overrides,
    });
}

/** Drive one direct send that trips the high-water mark, leaving the connection in queued mode. */
function enterQueued(socket: FakeSocket, conn: WebSocketConnection): void {
    socket.bufferedAmount = 200;
    conn.sendReliable("<trigger>");
    socket.bufferedAmount = 0;
}

describe("WebSocketConnection", () => {
    beforeEach(() => MockTime.init());

    describe("direct mode", () => {
        it("sends frames immediately and in emit order while bufferedAmount stays low", () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket);

            conn.sendOrdered("a");
            conn.sendReliable("b");
            conn.sendCoalescable("k", () => "c");

            expect(conn.mode).to.equal("direct");
            expect(socket.sent).to.deep.equal(["a", "b", "c"]);
        });

        it("flips to queued when a send pushes bufferedAmount over the high-water mark", () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket);

            socket.bufferedAmount = 101;
            conn.sendOrdered("a");

            expect(socket.sent).to.deep.equal(["a"]);
            expect(conn.mode).to.equal("queued");
        });
    });

    describe("queued mode", () => {
        it("enqueues instead of sending, draining one frame per flushed callback", () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket);
            enterQueued(socket, conn);

            conn.sendOrdered("x");
            conn.sendOrdered("y");

            expect(socket.sent).to.deep.equal(["<trigger>", "x"]);
            expect(conn.outboxSize).to.equal(1);

            socket.flushOne();
            expect(socket.sent).to.deep.equal(["<trigger>", "x", "y"]);
        });

        it("returns to direct mode once the outbox drains empty", () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket);
            enterQueued(socket, conn);

            conn.sendOrdered("x");
            expect(conn.mode).to.equal("queued");

            socket.flushOne();
            expect(conn.mode).to.equal("direct");
        });

        it("disposes on a send error, releasing queued frames and refusing further sends", () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket);
            enterQueued(socket, conn);

            conn.sendOrdered("x"); // in flight
            conn.sendOrdered("y"); // queued behind it
            expect(conn.outboxSize).to.equal(1);

            socket.flushOne(new Error("socket write failed"));

            // A send error means the socket is dead: drop the queued closures now instead of pinning
            // them until the (possibly never-arriving) close event, and send nothing more.
            expect(conn.outboxSize).to.equal(0);
            const before = socket.sent.length;
            conn.sendReliable("late");
            expect(socket.sent.length).to.equal(before);
        });

        it("coalesces same-key sends to one frame, built once, keeping first position", () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket);
            enterQueued(socket, conn);

            conn.sendOrdered("blocker"); // occupies the single in-flight slot
            let builds = 0;
            conn.sendCoalescable("k", () => {
                builds++;
                return "v-latest";
            });
            conn.sendCoalescable("k", () => {
                builds++;
                return "v-latest";
            });
            conn.sendOrdered("after");

            expect(conn.outboxSize).to.equal(2); // {k, after}
            socket.flushOne(); // blocker flushed -> drains k
            expect(builds).to.equal(1);
            expect(socket.sent).to.deep.equal(["<trigger>", "blocker", "v-latest"]);

            socket.flushOne(); // k flushed -> drains after
            expect(socket.sent[socket.sent.length - 1]).to.equal("after");
        });

        it("skips a coalescable whose builder returns undefined", () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket);
            enterQueued(socket, conn);

            conn.sendOrdered("blocker");
            conn.sendCoalescable("gone", () => undefined);
            conn.sendOrdered("after");

            socket.flushOne(); // blocker -> skip gone -> send after
            expect(socket.sent).to.deep.equal(["<trigger>", "blocker", "after"]);
        });

        it("skips a coalescable whose builder throws, without escaping the drain pump", () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket);
            enterQueued(socket, conn);

            conn.sendOrdered("blocker");
            conn.sendCoalescable("boom", () => {
                throw new Error("build failed");
            });
            conn.sendOrdered("after");

            // The throwing entry drains via the flushed callback; it must not propagate out of the
            // ws send-completion callback (which would become an uncaught exception in production).
            expect(() => socket.flushOne()).to.not.throw();
            expect(socket.sent).to.deep.equal(["<trigger>", "blocker", "after"]);
        });

        it("sendReliable bypasses the queue and sends immediately even while congested", () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket);
            enterQueued(socket, conn);

            conn.sendOrdered("blocker");
            conn.sendReliable("urgent");

            expect(socket.sent).to.deep.equal(["<trigger>", "blocker", "urgent"]);
            expect(conn.outboxSize).to.equal(0);
        });
    });

    describe("closed socket", () => {
        it("does not send when the socket is not OPEN", () => {
            const socket = new FakeSocket();
            socket.readyState = 2; // CLOSING
            const conn = makeConn(socket);

            conn.sendReliable("x");
            conn.sendOrdered("y");

            expect(socket.sent).to.be.empty;
        });
    });

    describe("outbox cap", () => {
        it("drops oldest ordered entries beyond the cap, never coalescables", () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket, { capBase: 3, capPerNode: 0 });
            enterQueued(socket, conn);

            conn.sendOrdered("blocker"); // in flight, not in outbox
            conn.sendCoalescable("keep", () => "keep");
            conn.sendOrdered("e1");
            conn.sendOrdered("e2");
            conn.sendOrdered("e3");
            conn.sendOrdered("e4"); // {keep,e1,e2,e3,e4} exceeds cap 3 -> oldest ordered e1,e2 dropped

            expect(conn.outboxSize).to.equal(3); // {keep, e3, e4}

            for (let i = 0; i < 4 && socket.pendingCount > 0; i++) {
                socket.flushOne();
            }
            // after blocker flush, survivors drain in order: keep, e3, e4 (e1/e2 dropped, keep never dropped).
            expect(socket.sent.slice(2)).to.deep.equal(["keep", "e3", "e4"]);
        });

        it("scales the cap with node count (nodeCount * capPerNode)", () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket, { capBase: 3, capPerNode: 20, getNodeCount: () => 10 });
            enterQueued(socket, conn);

            conn.sendOrdered("blocker");
            for (let i = 0; i < 250; i++) conn.sendOrdered(`e${i}`);

            expect(conn.outboxSize).to.equal(200); // capped at max(3, 10*20)
        });
    });

    describe("watchdog", () => {
        it("terminates and disposes a socket whose in-flight send never flushes within the window", async () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket, { watchdog: Millis(300_000) });
            enterQueued(socket, conn);

            conn.sendOrdered("stuck"); // in flight, callback never released

            expect(socket.terminated).to.equal(false);
            await MockTime.advance(Millis(300_000));

            // terminate() (not a graceful close) forces the ws "close" event so the handler removes
            // the dead connection even when a half-open socket would never emit close on its own.
            expect(socket.terminated).to.equal(true);
            // Disposed: no further frames are queued or sent after the watchdog gives up.
            const before = socket.sent.length;
            conn.sendReliable("late");
            expect(socket.sent.length).to.equal(before);
        });

        it("does not terminate when the in-flight send flushes in time", async () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket, { watchdog: Millis(300_000) });
            enterQueued(socket, conn);

            conn.sendOrdered("ok");
            socket.flushOne();
            await MockTime.advance(Millis(300_000));

            expect(socket.terminated).to.equal(false);
        });
    });
});
