/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterNode, type MatterClient, type MatterNodeData } from "@matter-server/ws-client";
import {
    formatDurationMs,
    formatPlaybackState,
    invokeTransportCommand,
    NEXT_COMMAND_ID,
    parseSkipMs,
    PlaybackState,
    readCurrentState,
    readDurationMs,
    readPlaybackSpeed,
    readPositionMs,
    supportsCommand,
} from "../src/util/media-playback.js";

function fakeClient(response: unknown): { client: MatterClient; calls: Array<Record<string, unknown>> } {
    const calls = new Array<Record<string, unknown>>();
    const client = {
        deviceCommand: async (
            _nodeId: number | bigint,
            _endpoint: number,
            _cluster: number,
            command: string,
            payload: Record<string, unknown>,
        ) => {
            calls.push({ command, payload });
            return response;
        },
    } as unknown as MatterClient;
    return { client, calls };
}

function node(attributes: Record<string, unknown>, node_id: number | bigint = 1): MatterNode {
    const data: MatterNodeData = {
        node_id,
        date_commissioned: "",
        last_interview: "",
        interview_version: 1,
        available: true,
        is_bridge: false,
        attributes,
        attribute_subscriptions: [],
    };
    return new MatterNode(data);
}

describe("media playback util", () => {
    describe("readCurrentState", () => {
        it("reads the enum value", () => {
            expect(readCurrentState(node({ "1/1286/0": 1 }), 1)).to.equal(PlaybackState.Paused);
        });

        it("returns null when the attribute is absent", () => {
            expect(readCurrentState(node({}), 1)).to.equal(null);
        });
    });

    describe("formatPlaybackState", () => {
        it("names every known state", () => {
            expect(formatPlaybackState(PlaybackState.Playing)).to.equal("Playing");
            expect(formatPlaybackState(PlaybackState.Paused)).to.equal("Paused");
            expect(formatPlaybackState(PlaybackState.NotPlaying)).to.equal("Not playing");
            expect(formatPlaybackState(PlaybackState.Buffering)).to.equal("Buffering");
        });

        it("falls back to Unknown when there is no state", () => {
            expect(formatPlaybackState(null)).to.equal("Unknown");
        });
    });

    describe("readPositionMs", () => {
        it("reads the struct's field-tag-1 position", () => {
            expect(readPositionMs(node({ "1/1286/3": { "0": 1000, "1": 42_000 } }), 1)).to.equal(42_000);
        });

        it("returns null when SampledPosition is absent or null", () => {
            expect(readPositionMs(node({}), 1)).to.equal(null);
            expect(readPositionMs(node({ "1/1286/3": null }), 1)).to.equal(null);
        });

        it("returns null for the live-stream shape where only Position is null", () => {
            expect(readPositionMs(node({ "1/1286/3": { "0": 1000, "1": null } }), 1)).to.equal(null);
        });

        it("reads a uint64 position that arrives as a bigint", () => {
            expect(readPositionMs(node({ "1/1286/3": { "0": 1000, "1": 42_000n } }), 1)).to.equal(42_000);
        });
    });

    describe("readDurationMs / readPlaybackSpeed", () => {
        it("read their attributes when present", () => {
            expect(readDurationMs(node({ "1/1286/2": 120_000 }), 1)).to.equal(120_000);
            expect(readPlaybackSpeed(node({ "1/1286/4": 1.5 }), 1)).to.equal(1.5);
        });

        it("return null when absent or null on the wire", () => {
            expect(readDurationMs(node({}), 1)).to.equal(null);
            expect(readDurationMs(node({ "1/1286/2": null }), 1)).to.equal(null);
            expect(readPlaybackSpeed(node({}), 1)).to.equal(null);
        });

        it("keeps a zero duration distinct from an absent one", () => {
            expect(readDurationMs(node({ "1/1286/2": 0 }), 1)).to.equal(0);
        });

        it("rounds the float32 playback speed and drops the stopped-player zero", () => {
            expect(readPlaybackSpeed(node({ "1/1286/4": 0.10000000149011612 }), 1)).to.equal(0.1);
            expect(readPlaybackSpeed(node({ "1/1286/4": 0 }), 1)).to.equal(null);
        });
    });

    describe("formatDurationMs", () => {
        it("formats under an hour as m:ss", () => {
            expect(formatDurationMs(0)).to.equal("0:00");
            expect(formatDurationMs(65_000)).to.equal("1:05");
        });

        it("formats an hour or more as h:mm:ss", () => {
            expect(formatDurationMs(3_599_000)).to.equal("59:59");
            expect(formatDurationMs(3_600_000)).to.equal("1:00:00");
            expect(formatDurationMs(3_661_000)).to.equal("1:01:01");
        });
    });

    describe("supportsCommand", () => {
        it("is true when the command id is in AcceptedCommandList", () => {
            expect(supportsCommand(node({ "1/1286/65529": [0, 1, 2, NEXT_COMMAND_ID] }), 1, NEXT_COMMAND_ID)).to.equal(
                true,
            );
        });

        it("is false when the command id is missing or the list is absent", () => {
            expect(supportsCommand(node({ "1/1286/65529": [0, 1, 2] }), 1, NEXT_COMMAND_ID)).to.equal(false);
            expect(supportsCommand(node({}), 1, NEXT_COMMAND_ID)).to.equal(false);
        });
    });

    describe("parseSkipMs", () => {
        it("accepts a positive safe integer", () => {
            expect(parseSkipMs("10000")).to.equal(10_000);
            expect(parseSkipMs(" 1 ")).to.equal(1);
        });

        it("rejects a blank, zero, negative, fractional or unsafe value", () => {
            expect(parseSkipMs("")).to.equal(null);
            expect(parseSkipMs("0")).to.equal(null);
            expect(parseSkipMs("-5")).to.equal(null);
            expect(parseSkipMs("1.5")).to.equal(null);
            expect(parseSkipMs("1e30")).to.equal(null);
            expect(parseSkipMs("abc")).to.equal(null);
        });
    });

    describe("invokeTransportCommand", () => {
        it("sends the command and resolves on a Success response", async () => {
            const { client, calls } = fakeClient({ status: 0 });
            await invokeTransportCommand(client, 1, 1, "Play");
            expect(calls).to.deep.equal([{ command: "Play", payload: {} }]);
        });

        it("resolves when the device answers without a status", async () => {
            const { client } = fakeClient({});
            await invokeTransportCommand(client, 1, 1, "Play");
        });

        it("rejects with the decoded status name when the device refuses", async () => {
            const { client } = fakeClient({ status: 4 });
            let message = "";
            await invokeTransportCommand(client, 1, 1, "Rewind").catch((err: Error) => (message = err.message));
            expect(message).to.equal("Rewind rejected: Speed out of range");
        });

        it("reports an unknown status by number", async () => {
            const { client } = fakeClient({ status: 42 });
            let message = "";
            await invokeTransportCommand(client, 1, 1, "Play").catch((err: Error) => (message = err.message));
            expect(message).to.equal("Play rejected: status 42");
        });

        it("passes the skip payload through", async () => {
            const { client, calls } = fakeClient({ status: 0 });
            await invokeTransportCommand(client, 1, 1, "SkipForward", { deltaPositionMilliseconds: 5000 });
            expect(calls).to.deep.equal([{ command: "SkipForward", payload: { deltaPositionMilliseconds: 5000 } }]);
        });
    });
});
