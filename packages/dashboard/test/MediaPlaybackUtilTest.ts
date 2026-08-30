/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterNode, type MatterNodeData } from "@matter-server/ws-client";
import {
    formatDurationMs,
    formatPlaybackState,
    NEXT_COMMAND_ID,
    PlaybackState,
    readCurrentState,
    readDurationMs,
    readPlaybackSpeed,
    readPositionMs,
    supportsCommand,
} from "../src/util/media-playback.js";

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
    });

    describe("readDurationMs / readPlaybackSpeed", () => {
        it("read their attributes when present", () => {
            expect(readDurationMs(node({ "1/1286/2": 120_000 }), 1)).to.equal(120_000);
            expect(readPlaybackSpeed(node({ "1/1286/4": 1.5 }), 1)).to.equal(1.5);
        });

        it("return null when absent", () => {
            expect(readDurationMs(node({}), 1)).to.equal(null);
            expect(readPlaybackSpeed(node({}), 1)).to.equal(null);
        });
    });

    describe("formatDurationMs", () => {
        it("formats under an hour as m:ss", () => {
            expect(formatDurationMs(0)).to.equal("0:00");
            expect(formatDurationMs(65_000)).to.equal("1:05");
        });

        it("formats an hour or more as h:mm:ss", () => {
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
});
