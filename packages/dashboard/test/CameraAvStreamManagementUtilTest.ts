/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterNode, type MatterNodeData } from "@matter-server/ws-client";
import {
    CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID,
    formatNightVision,
    hasAudioFeature,
    hasHighDynamicRangeFeature,
    hasNightVisionFeature,
    hasPrivacyFeature,
    hasSnapshotFeature,
    hasSpeakerFeature,
    hasVideoFeature,
    readAllocatedAudioStreamCount,
    readAllocatedSnapshotStreamCount,
    readAllocatedVideoStreamCount,
    readHardPrivacyModeOn,
    readHdrModeEnabled,
    readMicrophoneMuted,
    readNightVision,
    readSoftLivestreamPrivacyModeEnabled,
    readSoftRecordingPrivacyModeEnabled,
    readSpeakerMuted,
    readStatusLightEnabled,
} from "../src/util/camera-av-stream-management.js";

function node(attributes: Record<string, unknown>): MatterNode {
    const data: MatterNodeData = {
        node_id: 1,
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

function attr(id: number): string {
    return `1/${CAMERA_AV_STREAM_MANAGEMENT_CLUSTER_ID}/${id}`;
}

describe("camera-av-stream-management util", () => {
    describe("feature detection", () => {
        it("decodes each known feature bit from FeatureMap", () => {
            const n = node({ [attr(0xfffc)]: 0b0000_0010_0001_1111 });
            expect(hasAudioFeature(n, 1)).to.equal(true);
            expect(hasVideoFeature(n, 1)).to.equal(true);
            expect(hasSnapshotFeature(n, 1)).to.equal(true);
            expect(hasPrivacyFeature(n, 1)).to.equal(true);
            expect(hasSpeakerFeature(n, 1)).to.equal(true);
            expect(hasHighDynamicRangeFeature(n, 1)).to.equal(true);
            expect(hasNightVisionFeature(n, 1)).to.equal(false);
        });

        it("treats an unread FeatureMap as no features supported", () => {
            const n = node({});
            expect(hasAudioFeature(n, 1)).to.equal(false);
            expect(hasVideoFeature(n, 1)).to.equal(false);
        });
    });

    describe("mute attributes", () => {
        it("reads MicrophoneMuted and SpeakerMuted", () => {
            const n = node({ [attr(0x1d)]: true, [attr(0x19)]: false });
            expect(readMicrophoneMuted(n, 1)).to.equal(true);
            expect(readSpeakerMuted(n, 1)).to.equal(false);
        });

        it("is null when the attribute hasn't been read yet", () => {
            const n = node({});
            expect(readMicrophoneMuted(n, 1)).to.equal(null);
            expect(readSpeakerMuted(n, 1)).to.equal(null);
        });
    });

    describe("image and status attributes", () => {
        it("reads HdrModeEnabled and StatusLightEnabled", () => {
            const n = node({ [attr(0x0d)]: true, [attr(0x27)]: false });
            expect(readHdrModeEnabled(n, 1)).to.equal(true);
            expect(readStatusLightEnabled(n, 1)).to.equal(false);
        });
    });

    describe("privacy attributes", () => {
        it("reads hard and soft privacy mode attributes independently", () => {
            const n = node({
                [attr(0x15)]: true,
                [attr(0x13)]: false,
                [attr(0x14)]: true,
            });
            expect(readHardPrivacyModeOn(n, 1)).to.equal(true);
            expect(readSoftRecordingPrivacyModeEnabled(n, 1)).to.equal(false);
            expect(readSoftLivestreamPrivacyModeEnabled(n, 1)).to.equal(true);
        });
    });

    describe("readNightVision / formatNightVision", () => {
        it("reads and formats each TriStateAutoEnum value", () => {
            expect(formatNightVision(readNightVision(node({ [attr(0x16)]: 0 }), 1))).to.equal("Off");
            expect(formatNightVision(readNightVision(node({ [attr(0x16)]: 1 }), 1))).to.equal("On");
            expect(formatNightVision(readNightVision(node({ [attr(0x16)]: 2 }), 1))).to.equal("Auto");
        });

        it("falls back to a numeric label for an unknown value", () => {
            expect(formatNightVision(readNightVision(node({ [attr(0x16)]: 9 }), 1))).to.equal("Mode 9");
        });

        it("is null when the attribute is absent", () => {
            expect(readNightVision(node({}), 1)).to.equal(null);
            expect(formatNightVision(null)).to.equal(null);
        });
    });

    describe("allocated stream counts", () => {
        it("counts entries in each allocated stream list", () => {
            const n = node({
                [attr(0x0f)]: [{}, {}],
                [attr(0x10)]: [{}],
                [attr(0x11)]: [],
            });
            expect(readAllocatedVideoStreamCount(n, 1)).to.equal(2);
            expect(readAllocatedAudioStreamCount(n, 1)).to.equal(1);
            expect(readAllocatedSnapshotStreamCount(n, 1)).to.equal(0);
        });

        it("is null when the list hasn't been read yet", () => {
            const n = node({});
            expect(readAllocatedVideoStreamCount(n, 1)).to.equal(null);
            expect(readAllocatedAudioStreamCount(n, 1)).to.equal(null);
            expect(readAllocatedSnapshotStreamCount(n, 1)).to.equal(null);
        });
    });
});
