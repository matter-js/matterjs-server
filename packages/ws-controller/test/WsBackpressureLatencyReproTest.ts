/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Root-cause repro + fix guard for the reported dashboard disconnect (docs/plans/ws-backpressure.md).
 *
 * The browser dashboard reaches the server through the Home Assistant ingress proxy, which relays
 * WebSocket frames with a non-trivial per-frame round-trip latency L. {@link LatentSocket} models that
 * link: a sent frame occupies `bufferedAmount` until it "arrives" one L later, at which point its
 * flush callback fires (as a real socket's write callback does once the peer drains it).
 *
 * The original strictly-one-in-flight drain sent the next queued frame only after the previous frame's
 * callback, so a burst of N frames serialized to N x L — over a latent link that stalls initial sync
 * long enough for ingress to time out and close. The windowed drain keeps up to `highWater` bytes in
 * flight, so a burst pipelines (bounded latency) while memory stays bounded. On a zero-latency link the
 * two are indistinguishable, which is why the bug only surfaced through ingress.
 */

import { Millis, Time } from "@matter/main";
import { OutboundSocket, WebSocketConnection } from "../src/server/WebSocketConnection.js";

const OPEN = 1;
const L = Millis(100); // per-frame link latency (ingress relay round-trip)
const FRAME_BYTES = 20;
const HIGH_WATER = 100; // window = HIGH_WATER / FRAME_BYTES = 5 frames in flight
const WINDOW_FRAMES = HIGH_WATER / FRAME_BYTES;
const BURST = 10;

/** A frame of exactly FRAME_BYTES bytes, tagged with an index for readability. */
function frame(i: number): string {
    return `e${i}`.padEnd(FRAME_BYTES, "x");
}

/** A WS link where each frame occupies bufferedAmount until it arrives (and its callback fires) L later. */
class LatentSocket implements OutboundSocket {
    bufferedAmount = 0;
    readyState = OPEN;
    readonly delivered = new Array<string>();
    #seq = 0;

    send(data: string, cb?: (err?: Error) => void): void {
        const bytes = Buffer.byteLength(data);
        this.bufferedAmount += bytes;
        Time.getTimer(`latent-${this.#seq++}`, L, () => {
            this.bufferedAmount -= bytes;
            this.delivered.push(data);
            cb?.();
        }).start();
    }

    close(): void {
        this.readyState = 3;
    }

    terminate(): void {
        this.readyState = 3;
    }
}

describe("WS backpressure latency repro (ingress-style link)", () => {
    beforeEach(() => MockTime.init());

    it("direct mode pipelines a burst — all frames arrive after one link latency", async () => {
        const socket = new LatentSocket();
        const conn = new WebSocketConnection(socket, { connId: "direct", highWaterBytes: 10_000_000 });

        for (let i = 1; i <= BURST; i++) conn.sendOrdered(frame(i));
        expect(conn.mode).to.equal("direct");

        await MockTime.advance(L);
        expect(socket.delivered.length).to.equal(BURST);
    });

    it("queued mode keeps the window full — a burst pipelines instead of serializing to N x L", async () => {
        const socket = new LatentSocket();
        const conn = new WebSocketConnection(socket, {
            connId: "queued",
            highWaterBytes: HIGH_WATER,
            highWaterCeilingBytes: HIGH_WATER,
        });

        conn.sendReliable(frame(0).padEnd(HIGH_WATER + 1, "x")); // one frame over the ceiling trips queued
        expect(conn.mode).to.equal("queued");
        await MockTime.advance(L); // flush the trigger
        socket.delivered.length = 0;

        for (let i = 1; i <= BURST; i++) conn.sendOrdered(frame(i));

        // One window's worth is in flight at once (not a single frame), so the first latency window
        // delivers the whole window rather than one frame. Strict one-in-flight would deliver just 1.
        await MockTime.advance(L);
        expect(socket.delivered.length, "frames delivered after one latency window").to.equal(WINDOW_FRAMES);

        // The whole burst clears in BURST/WINDOW windows, not BURST windows.
        await MockTime.advance(L);
        expect(socket.delivered.length).to.equal(BURST);
    });
});
