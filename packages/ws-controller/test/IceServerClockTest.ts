/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Status, StatusResponseError } from "@matter/main/types";
import { offerChecksClock, offerWithClockRetry, usesTlsIceServer } from "../src/controller/iceServerClock.js";

const turns = [{ urls: ["turns:turn.example.org:443"] }];

const noClock = () => new StatusResponseError("no clock", Status.InvalidInState);

interface Run {
    command?: "provideOffer" | "solicitOffer";
    fields?: Record<string, unknown>;
    /** The camera's answer per offer sent, in order; `accept` once they run out. */
    answers?: (Error | "accept")[];
    syncFailure?: Error;
}

/** Returns what was sent (`offer`, `sync`) and the outcome (`accepted` or the thrown error's message). */
async function run({
    command = "provideOffer",
    fields = { webRtcSessionId: null, iceServers: turns },
    answers = [],
    syncFailure,
}: Run): Promise<string[]> {
    const sent = new Array<string>();
    let offers = 0;
    try {
        await offerWithClockRetry({
            command,
            fields,
            invoke: async () => {
                sent.push("offer");
                const answer = answers[offers++] ?? "accept";
                if (answer !== "accept") throw answer;
                return "accepted";
            },
            syncTime: async () => {
                sent.push("sync");
                if (syncFailure) throw syncFailure;
            },
            node: "1",
        });
        sent.push("accepted");
    } catch (error) {
        sent.push(error instanceof Error ? error.message : String(error));
    }
    return sent;
}

describe("usesTlsIceServer", () => {
    it("is true for turns: and stuns:", () => {
        expect(usesTlsIceServer(turns)).to.equal(true);
        expect(usesTlsIceServer([{ urls: ["stuns:stun.example.org"] }])).to.equal(true);
    });

    it("matches the scheme case-insensitively", () => {
        expect(usesTlsIceServer([{ urls: ["TURNS:turn.example.org"] }])).to.equal(true);
        expect(usesTlsIceServer([{ urls: ["Stuns:stun.example.org"] }])).to.equal(true);
    });

    it("finds a TLS url among plain ones", () => {
        expect(usesTlsIceServer([{ urls: ["turn:a"] }, { urls: ["stun:b", "turns:c"] }])).to.equal(true);
    });

    it("is false for turn:, stun:, a host that merely contains the word, and absent servers", () => {
        expect(usesTlsIceServer([{ urls: ["turn:a", "stun:b"] }])).to.equal(false);
        expect(usesTlsIceServer([{ urls: ["turn:turns.example.org"] }])).to.equal(false);
        expect(usesTlsIceServer([])).to.equal(false);
        expect(usesTlsIceServer(undefined)).to.equal(false);
    });

    it("reads the scheme only at the start of a url", () => {
        expect(usesTlsIceServer([{ urls: ["turn:host?transport=turns:x"] }])).to.equal(false);
    });

    it("skips entries that are not ICE servers and still finds a TLS url after them", () => {
        expect(usesTlsIceServer([null, { urls: ["turns:a"] }])).to.equal(true);
        expect(usesTlsIceServer([null])).to.equal(false);
    });

    it("needs a url list, not a single url string", () => {
        expect(usesTlsIceServer([{ urls: "turns:a" }])).to.equal(false);
    });

    it("ignores url entries that are not strings", () => {
        expect(usesTlsIceServer([{ urls: [{ toString: () => "turns:a" }] }])).to.equal(false);
    });
});

describe("offerChecksClock", () => {
    it("is true for a SolicitOffer with a TLS server", () => {
        expect(offerChecksClock("solicitOffer", { iceServers: turns })).to.equal(true);
    });

    it("is true for a ProvideOffer of a new session with a TLS server", () => {
        expect(offerChecksClock("provideOffer", { webRtcSessionId: null, iceServers: turns })).to.equal(true);
    });

    it("is false for a re-offer: the camera checks the clock only for a new session", () => {
        expect(offerChecksClock("provideOffer", { webRtcSessionId: 3, iceServers: turns })).to.equal(false);
    });

    it("is false without a TLS server", () => {
        expect(offerChecksClock("solicitOffer", { iceServers: [{ urls: ["stun:a"] }] })).to.equal(false);
    });
});

describe("offerWithClockRetry", () => {
    it("sends an accepted offer once and pushes nothing", async () => {
        expect(await run({})).to.deep.equal(["offer", "accepted"]);
    });

    it("pushes time and sends the offer again after an INVALID_IN_STATE refusal", async () => {
        expect(await run({ answers: [noClock()] })).to.deep.equal(["offer", "sync", "offer", "accepted"]);
    });

    it("does the same for a SolicitOffer", async () => {
        expect(
            await run({ command: "solicitOffer", fields: { iceServers: turns }, answers: [noClock()] }),
        ).to.deep.equal(["offer", "sync", "offer", "accepted"]);
    });

    it("retries once: a second refusal reaches the caller", async () => {
        const second = new StatusResponseError("privacy", Status.InvalidInState);
        expect(await run({ answers: [noClock(), second] })).to.deep.equal(["offer", "sync", "offer", "privacy"]);
    });

    it("throws the first refusal when the second offer fails without a device status", async () => {
        expect(await run({ answers: [noClock(), new Error("timeout")] })).to.deep.equal([
            "offer",
            "sync",
            "offer",
            "no clock",
        ]);
    });

    it("throws the camera's refusal when the time push fails", async () => {
        expect(await run({ answers: [noClock()], syncFailure: new Error("unreachable") })).to.deep.equal([
            "offer",
            "sync",
            "no clock",
        ]);
    });

    it("does not retry another refusal", async () => {
        const busy = new StatusResponseError("busy", Status.Busy);
        expect(await run({ answers: [busy] })).to.deep.equal(["offer", "busy"]);
        expect(await run({ answers: [new Error("timeout")] })).to.deep.equal(["offer", "timeout"]);
    });

    it("does not retry without a TLS ICE server or for a re-offer", async () => {
        expect(
            await run({ fields: { webRtcSessionId: null, iceServers: [{ urls: ["turn:a"] }] }, answers: [noClock()] }),
        ).to.deep.equal(["offer", "no clock"]);
        expect(await run({ fields: { webRtcSessionId: 4, iceServers: turns }, answers: [noClock()] })).to.deep.equal([
            "offer",
            "no clock",
        ]);
    });
});
