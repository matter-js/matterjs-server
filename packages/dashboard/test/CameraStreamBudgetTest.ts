/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    planVideoMaxFrameRate,
    VIDEO_MAX_FRAME_RATE,
    videoStreamFitsSnapshotBudget,
} from "../src/util/camera-stream-budget.js";

const RES_1080P = { width: 1920, height: 1080 };
// Aqara G350 advertises MaxEncodedPixelRate = 1080p @ 120 fps.
const BUDGET_1080P_120 = 1920 * 1080 * 120;
const SNAPSHOT_1080P_30 = 1920 * 1080 * 30;

describe("camera-stream-budget", () => {
    describe("planVideoMaxFrameRate", () => {
        it("caps at 60 when the budget comfortably fits video + snapshot", () => {
            expect(
                planVideoMaxFrameRate({
                    maxEncodedPixelRate: BUDGET_1080P_120,
                    videoResolution: RES_1080P,
                    snapshotReservation: SNAPSHOT_1080P_30,
                }),
            ).to.equal(VIDEO_MAX_FRAME_RATE);
        });

        it("reduces the rate when the snapshot reservation eats into the budget", () => {
            // Budget one px/s short of video @ 45 fps once the snapshot is reserved → floors to 44.
            const budget = 1920 * 1080 * 45 + SNAPSHOT_1080P_30 - 1;
            expect(
                planVideoMaxFrameRate({
                    maxEncodedPixelRate: budget,
                    videoResolution: RES_1080P,
                    snapshotReservation: SNAPSHOT_1080P_30,
                }),
            ).to.equal(44);
        });

        it("gives video the whole budget when video + snapshot cannot both fit", () => {
            // Budget for video @ 20 fps only; snapshot cannot be reserved concurrently.
            const budget = 1920 * 1080 * 20;
            expect(
                planVideoMaxFrameRate({
                    maxEncodedPixelRate: budget,
                    videoResolution: RES_1080P,
                    snapshotReservation: SNAPSHOT_1080P_30,
                }),
            ).to.equal(20);
        });

        it("falls back to the 60 fps cap when the budget is unknown", () => {
            expect(
                planVideoMaxFrameRate({
                    maxEncodedPixelRate: null,
                    videoResolution: RES_1080P,
                    snapshotReservation: SNAPSHOT_1080P_30,
                }),
            ).to.equal(VIDEO_MAX_FRAME_RATE);
        });

        it("ignores the snapshot reservation when it is zero", () => {
            expect(
                planVideoMaxFrameRate({
                    maxEncodedPixelRate: BUDGET_1080P_120,
                    videoResolution: RES_1080P,
                    snapshotReservation: 0,
                }),
            ).to.equal(VIDEO_MAX_FRAME_RATE);
        });
    });

    describe("videoStreamFitsSnapshotBudget", () => {
        it("rejects a 120 fps stream that would consume the whole budget", () => {
            expect(
                videoStreamFitsSnapshotBudget({
                    maxEncodedPixelRate: BUDGET_1080P_120,
                    candidateResolution: RES_1080P,
                    candidateFrameRate: 120,
                    snapshotReservation: SNAPSHOT_1080P_30,
                }),
            ).to.equal(false);
        });

        it("accepts a 60 fps stream that leaves room for the snapshot", () => {
            expect(
                videoStreamFitsSnapshotBudget({
                    maxEncodedPixelRate: BUDGET_1080P_120,
                    candidateResolution: RES_1080P,
                    candidateFrameRate: 60,
                    snapshotReservation: SNAPSHOT_1080P_30,
                }),
            ).to.equal(true);
        });

        it("accepts any candidate when the budget is unknown", () => {
            expect(
                videoStreamFitsSnapshotBudget({
                    maxEncodedPixelRate: null,
                    candidateResolution: RES_1080P,
                    candidateFrameRate: 120,
                    snapshotReservation: SNAPSHOT_1080P_30,
                }),
            ).to.equal(true);
        });

        it("accepts any candidate when no snapshot reservation is needed", () => {
            expect(
                videoStreamFitsSnapshotBudget({
                    maxEncodedPixelRate: BUDGET_1080P_120,
                    candidateResolution: RES_1080P,
                    candidateFrameRate: 120,
                    snapshotReservation: 0,
                }),
            ).to.equal(true);
        });
    });
});
