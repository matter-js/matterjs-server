/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Millis } from "@matter/main";
import { OutboundSocket, WebSocketConnection } from "../src/server/WebSocketConnection.js";

const OPEN = 1;

/** A frame of exactly `bytes` bytes, optionally tagged (tag padded out) so it stays identifiable. */
function f(bytes: number, tag = "x"): string {
    return tag.padEnd(bytes, "x").slice(0, bytes);
}

/**
 * Controllable stand-in for a `ws` socket. It tracks `bufferedAmount` from real byte lengths — sends
 * add, {@link flushOne} (simulating the peer draining a frame) subtracts and fires that frame's send
 * callback — so the connection's byte-windowed drain behaves as it would against a real socket.
 */
class FakeSocket implements OutboundSocket {
    bufferedAmount = 0;
    readyState = OPEN;
    terminated = false;
    readonly sent = new Array<string>();
    readonly closes = new Array<{ code?: number; reason?: string }>();
    #pending = new Array<{ bytes: number; cb?: (err?: Error) => void }>();

    send(data: string, cb?: (err?: Error) => void): void {
        this.sent.push(data);
        const bytes = Buffer.byteLength(data);
        this.bufferedAmount += bytes;
        this.#pending.push({ bytes, cb });
    }

    close(code?: number, reason?: string): void {
        this.readyState = 3;
        this.closes.push({ code, reason });
    }

    terminate(): void {
        this.terminated = true;
        this.readyState = 3;
    }

    /** Release the oldest in-flight frame, as if the peer drained it: shrink the buffer, fire its callback. */
    flushOne(err?: Error): void {
        const p = this.#pending.shift();
        if (p === undefined) throw new Error("no pending send to flush");
        this.bufferedAmount -= p.bytes;
        p.cb?.(err);
    }

    get pendingCount(): number {
        return this.#pending.length;
    }
}

/** ceiling === floor so the mark is fixed at 100 and a frame over 100 bytes trips queued mode. */
function makeConn(socket: FakeSocket, overrides: Partial<ConstructorParameters<typeof WebSocketConnection>[1]> = {}) {
    return new WebSocketConnection(socket, {
        connId: "test",
        highWaterBytes: 100,
        highWaterCeilingBytes: 100,
        capBase: 1000,
        capPerNode: 20,
        watchdog: Millis(300_000),
        getNodeCount: () => 0,
        ...overrides,
    });
}

/** Trip into queued mode with one over-the-mark frame, then flush it so the window starts empty. */
function enterQueued(socket: FakeSocket, conn: WebSocketConnection): void {
    conn.sendReliable(f(150, "<trigger>"));
    socket.flushOne();
    socket.sent.length = 0;
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

            conn.sendOrdered(f(150)); // one frame over the 100-byte mark

            expect(conn.mode).to.equal("queued");
        });

        it("skips a coalescable whose builder throws, without crashing the connection", () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket);

            expect(() =>
                conn.sendCoalescable("boom", () => {
                    throw new Error("build failed");
                }),
            ).to.not.throw();

            // The connection must still be usable for the next frame.
            conn.sendReliable("after");
            expect(socket.sent).to.deep.equal(["after"]);
        });
    });

    describe("dynamic high-water", () => {
        it("does not trip on a single large frame — the mark scales to 2x the largest frame", () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket, { highWaterBytes: 100, highWaterCeilingBytes: 10_000 });

            conn.sendReliable(f(200)); // mark rises to 400; bufferedAmount 200 < 400

            expect(conn.mode).to.equal("direct");
        });

        it("still trips when backlog grows past 2x the largest frame (stalled consumer)", () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket, { highWaterBytes: 100, highWaterCeilingBytes: 10_000 });

            conn.sendReliable(f(200)); // mark → 400, direct
            conn.sendReliable(f(200)); // bufferedAmount 400, still not > 400
            conn.sendReliable(f(200)); // bufferedAmount 600 > 400 → trips

            expect(conn.mode).to.equal("queued");
        });

        it("caps the dynamic mark at the ceiling", () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket, { highWaterBytes: 100, highWaterCeilingBytes: 1000 });

            conn.sendReliable(f(800)); // 2x = 1600, clamped to 1000; bufferedAmount 800 < 1000, direct
            conn.sendReliable(f(300)); // bufferedAmount 1100 > 1000 → trips (proves clamp to 1000, not 1600)

            expect(conn.mode).to.equal("queued");
        });

        it("clamps the initial mark to the ceiling when a floor above the ceiling is configured", () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket, { highWaterBytes: 1000, highWaterCeilingBytes: 500 });

            conn.sendReliable(f(600)); // above the 500 ceiling → trips; a floor of 1000 must not apply

            expect(conn.mode).to.equal("queued");
        });
    });

    describe("queued mode (byte-windowed drain)", () => {
        it("keeps up to high-water bytes in flight and queues the rest", () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket);
            enterQueued(socket, conn);

            conn.sendOrdered(f(50, "e1"));
            conn.sendOrdered(f(50, "e2"));
            conn.sendOrdered(f(50, "e3"));
            conn.sendOrdered(f(50, "e4"));

            // Window is 100 bytes: e1+e2 (100) are in flight, e3+e4 wait in the outbox.
            expect(socket.sent.length).to.equal(2);
            expect(conn.outboxSize).to.equal(2);

            socket.flushOne(); // frees 50 bytes → e3 goes
            expect(socket.sent.length).to.equal(3);
            socket.flushOne(); // → e4 goes
            expect(socket.sent.length).to.equal(4);
        });

        it("returns to direct mode once the outbox drains and the window empties", () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket);
            enterQueued(socket, conn);

            conn.sendOrdered(f(50, "e1"));
            expect(conn.mode).to.equal("queued");

            socket.flushOne();
            expect(conn.mode).to.equal("direct");
        });

        it("coalesces same-key sends beyond the window to one frame, built once, keeping first position", () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket);
            enterQueued(socket, conn);

            conn.sendOrdered(f(50, "w1")); // fill the window
            conn.sendOrdered(f(50, "w2"));

            let builds = 0;
            const build = () => {
                builds++;
                return f(50, "kv");
            };
            conn.sendCoalescable("k", build);
            conn.sendCoalescable("k", build); // coalesces onto the first
            conn.sendOrdered(f(50, "after"));

            expect(conn.outboxSize).to.equal(2); // {k, after}
            socket.flushOne(); // w1 flushed → drains k
            expect(builds).to.equal(1);
            expect(socket.sent[socket.sent.length - 1]).to.equal(f(50, "kv"));

            socket.flushOne(); // w2 flushed → drains after
            expect(socket.sent[socket.sent.length - 1]).to.equal(f(50, "after"));
        });

        it("skips a coalescable whose builder returns undefined", () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket);
            enterQueued(socket, conn);

            conn.sendOrdered(f(50, "w1"));
            conn.sendOrdered(f(50, "w2")); // window full
            conn.sendCoalescable("gone", () => undefined);
            conn.sendOrdered(f(50, "after"));

            socket.flushOne(); // w1 → skip gone → send after
            expect(socket.sent[socket.sent.length - 1]).to.equal(f(50, "after"));
        });

        it("skips a coalescable whose builder throws, without escaping the drain", () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket);
            enterQueued(socket, conn);

            conn.sendOrdered(f(50, "w1"));
            conn.sendOrdered(f(50, "w2"));
            conn.sendCoalescable("boom", () => {
                throw new Error("build failed");
            });
            conn.sendOrdered(f(50, "after"));

            expect(() => socket.flushOne()).to.not.throw();
            expect(socket.sent[socket.sent.length - 1]).to.equal(f(50, "after"));
        });

        it("sendReliable bypasses the queue and sends immediately even while congested", () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket);
            enterQueued(socket, conn);

            conn.sendOrdered(f(50, "w1"));
            conn.sendOrdered(f(50, "w2")); // window full
            conn.sendOrdered(f(50, "queued")); // waits in outbox
            expect(conn.outboxSize).to.equal(1);

            conn.sendReliable("urgent");
            expect(socket.sent[socket.sent.length - 1]).to.equal("urgent");
            expect(conn.outboxSize).to.equal(1); // queued frame untouched
        });

        it("disposes on a send error, releasing queued frames and refusing further sends", () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket);
            enterQueued(socket, conn);

            conn.sendOrdered(f(50, "w1"));
            conn.sendOrdered(f(50, "w2"));
            conn.sendOrdered(f(50, "q1")); // queued behind the window
            expect(conn.outboxSize).to.equal(1);

            socket.flushOne(new Error("socket write failed"));

            expect(conn.outboxSize).to.equal(0);
            expect(socket.terminated).to.equal(true);
            const before = socket.sent.length;
            conn.sendReliable("late");
            expect(socket.sent.length).to.equal(before);
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

            conn.sendOrdered(f(50, "w1")); // fill window (2 frames of 50 = 100)
            conn.sendOrdered(f(50, "w2"));
            conn.sendCoalescable("keep", () => f(50, "keep"));
            conn.sendOrdered(f(50, "e1"));
            conn.sendOrdered(f(50, "e2"));
            conn.sendOrdered(f(50, "e3"));
            conn.sendOrdered(f(50, "e4")); // {keep,e1,e2,e3,e4} over cap 3 → drop oldest ordered e1,e2

            expect(conn.outboxSize).to.equal(3); // {keep, e3, e4}

            for (let i = 0; i < 6 && socket.pendingCount > 0; i++) socket.flushOne();
            // Exact sequence: the window (w1,w2) sent first, then the survivors keep,e3,e4 in order —
            // the oldest ordered entries e1,e2 were dropped and nothing extra slipped through.
            expect(socket.sent).to.deep.equal([f(50, "w1"), f(50, "w2"), f(50, "keep"), f(50, "e3"), f(50, "e4")]);
        });

        it("scales the cap with node count (nodeCount * capPerNode)", () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket, { capBase: 3, capPerNode: 20, getNodeCount: () => 10 });
            enterQueued(socket, conn);

            conn.sendOrdered(f(50, "w1"));
            conn.sendOrdered(f(50, "w2")); // window full; the rest queue
            for (let i = 0; i < 250; i++) conn.sendOrdered(f(50, `e${i}`));

            expect(conn.outboxSize).to.equal(200); // capped at max(3, 10*20)
        });
    });

    describe("watchdog", () => {
        it("terminates and disposes a socket whose in-flight send never flushes within the window", async () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket, { watchdog: Millis(300_000) });
            enterQueued(socket, conn);

            conn.sendOrdered(f(50, "stuck")); // in flight, callback never released

            expect(socket.terminated).to.equal(false);
            await MockTime.advance(Millis(300_000));

            expect(socket.terminated).to.equal(true);
            const before = socket.sent.length;
            conn.sendReliable("late");
            expect(socket.sent.length).to.equal(before);
        });

        it("does not terminate while in-flight sends keep flushing in time", async () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket, { watchdog: Millis(300_000) });
            enterQueued(socket, conn);

            conn.sendOrdered(f(50, "ok"));
            socket.flushOne();
            await MockTime.advance(Millis(300_000));

            expect(socket.terminated).to.equal(false);
        });

        it("does not terminate a busy window that keeps flushing across intervals (watchdog restarts on progress)", async () => {
            const socket = new FakeSocket();
            const conn = makeConn(socket, { watchdog: Millis(300_000) });
            enterQueued(socket, conn);

            // Window holds 2; keep 4 more queued so every flush pulls a replacement and the window
            // never empties (frames stay in flight throughout).
            for (let i = 1; i <= 6; i++) conn.sendOrdered(f(50, `e${i}`));

            // Advance well past the watchdog interval in total, but flush a frame each step (< interval
            // apart), so progress keeps resetting the deadline. It must never terminate.
            for (let step = 0; step < 4; step++) {
                await MockTime.advance(Millis(200_000));
                socket.flushOne();
            }

            expect(socket.terminated).to.equal(false);
        });
    });
});
