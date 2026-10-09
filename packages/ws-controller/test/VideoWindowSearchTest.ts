/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VideoEnvelope } from "../src/camera/cameraTypes.js";
import { computeVideoEnvelope, encodedPixelRate } from "../src/camera/streamPolicy.js";
import type { VideoEnvelopeArgs, VideoPlan } from "../src/camera/streamPolicy.js";
import { firstVideoWindow, videoRetryWindow, VideoWindowSearch } from "../src/camera/videoWindowSearch.js";
import type { VideoRefusal } from "../src/camera/videoWindowSearch.js";

const H265 = 1;

const WINDOW: VideoEnvelope = {
    overlays: {},
    codec: H265,
    minResolution: { width: 640, height: 360 },
    maxResolution: { width: 2560, height: 1440 },
    minFrameRate: 30,
    maxFrameRate: 30,
    minBitRate: 800000,
    maxBitRate: 8000000,
    keyFrameInterval: 4000,
};

const PLAN: VideoPlan = { envelope: WINDOW, frameRateFloor: 1, frameRateCeiling: 30, limits: {} };

const ANY_BUDGET = (): boolean => true;

function summary(window: VideoEnvelope): string {
    const { maxResolution, minFrameRate, maxFrameRate, maxBitRate } = window;
    return `${maxResolution.width}x${maxResolution.height}@${minFrameRate}-${maxFrameRate} ${maxBitRate}`;
}

/**
 * Drives a search the way the allocate ladder does. `camera` answers each window sent; `room` says
 * whether a stream can be freed when the search asks for one.
 */
function walk(
    plan: VideoPlan,
    camera: (window: VideoEnvelope) => VideoRefusal | "accepted",
    options: { room?: () => boolean; fits?: (window: VideoEnvelope) => boolean } = {},
): { asked: string[]; outcome: "accepted" | "giveUp"; search: VideoWindowSearch } {
    const search = new VideoWindowSearch(plan, options.fits ?? ANY_BUDGET);
    const asked = new Array<string>();
    for (let moves = 0; moves < 100; moves++) {
        const move = search.move;
        if (move.kind === "giveUp") return { asked, outcome: "giveUp", search };
        if (move.kind === "makeRoom") {
            asked.push("makeRoom");
            if (options.room?.() === true) search.roomMade();
            else search.noRoom();
            continue;
        }
        asked.push(summary(move.window));
        const answer = camera(move.window);
        if (answer === "accepted") return { asked, outcome: "accepted", search };
        search.refused(answer);
    }
    throw new Error("the search did not end");
}

const unservable = (): VideoRefusal => "unservable";
const capacity = (): VideoRefusal => "capacity";

function plan(args: Omit<VideoEnvelopeArgs, "overlays">): VideoPlan {
    const selection = computeVideoEnvelope({ overlays: {}, ...args });
    if ("unsatisfiable" in selection) throw new Error(`unsatisfiable: ${selection.field}`);
    return selection.plan;
}

describe("VideoWindowSearch", () => {
    describe("an unservable window", () => {
        it("gives up bit rate first, then frame rate, and frame size last", () => {
            expect(walk(PLAN, unservable).asked).to.deep.equal([
                "2560x1440@30-30 8000000",
                "2560x1440@30-30 4000000",
                "2560x1440@30-30 2000000",
                "2560x1440@30-30 1000000",
                "2560x1440@30-30 800000",
                "2560x1440@15-15 800000",
                "2560x1440@7-7 800000",
                "1280x720@30-30 800000",
                "1280x720@15-15 800000",
                "1280x720@7-7 800000",
                "640x360@30-30 800000",
                "640x360@15-15 800000",
                "640x360@7-7 800000",
            ]);
        });

        it("keeps the frame size and gives up frame rate, for a camera serving its full size only at 30 fps", () => {
            const fast = { ...PLAN, envelope: { ...WINDOW, minFrameRate: 60, maxFrameRate: 60 }, frameRateCeiling: 60 };
            const { asked, outcome } = walk(fast, window =>
                window.maxFrameRate > 30 || window.maxBitRate > 800000 ? "unservable" : "accepted",
            );
            expect(outcome).to.equal("accepted");
            expect(asked.at(-1)).to.equal("2560x1440@30-30 800000");
        });

        it("reaches a camera that serves only 7 fps", () => {
            const { asked, outcome } = walk(PLAN, window => (window.maxFrameRate > 7 ? "unservable" : "accepted"));
            expect(outcome).to.equal("accepted");
            expect(asked.at(-1)).to.equal("2560x1440@7-7 800000");
        });

        it("asks a smaller frame size at the highest frame rate the offer allows there", () => {
            // The offer decodes 2560x1440 at 15 fps only, so 1280x720 at up to 60, capped at 30.
            const bounded: VideoPlan = {
                ...PLAN,
                envelope: { ...WINDOW, minFrameRate: 15, maxFrameRate: 15 },
                limits: { maxPixelsPerSecond: 2560 * 1440 * 15 },
            };
            expect(walk(bounded, unservable).asked.slice(5, 9)).to.deep.equal([
                "2560x1440@7-7 800000",
                "2560x1440@3-3 800000",
                "1280x720@30-30 800000",
                "1280x720@15-15 800000",
            ]);
        });

        it("keeps the frame rate when it shrinks the frame size for capacity", () => {
            const bounded: VideoPlan = {
                ...PLAN,
                envelope: { ...WINDOW, minFrameRate: 15, maxFrameRate: 15 },
                limits: { maxPixelsPerSecond: 2560 * 1440 * 15 },
            };
            expect(walk(bounded, capacity).asked.slice(0, 2)).to.deep.equal([
                "2560x1440@15-15 8000000",
                "1280x720@15-15 8000000",
            ]);
        });
    });

    describe("a window refused for capacity", () => {
        it("never lowers the bit rate, and lowers the frame rate only when no room can be made", () => {
            expect(walk(PLAN, capacity).asked).to.deep.equal([
                "2560x1440@30-30 8000000",
                "1280x720@30-30 8000000",
                "640x360@30-30 8000000",
                "makeRoom",
                "640x360@15-15 8000000",
                "makeRoom",
                "640x360@7-7 8000000",
                "makeRoom",
            ]);
        });

        it("returns to the best servable window once room was made", () => {
            let freed = false;
            const { asked, outcome } = walk(
                PLAN,
                window => (freed && window.maxResolution.width === 2560 ? "accepted" : "capacity"),
                {
                    room: () => {
                        if (freed) return false;
                        freed = true;
                        return true;
                    },
                },
            );
            expect(outcome).to.equal("accepted");
            expect(asked).to.deep.equal([
                "2560x1440@30-30 8000000",
                "1280x720@30-30 8000000",
                "640x360@30-30 8000000",
                "makeRoom",
                "2560x1440@30-30 8000000",
            ]);
        });

        it("returns to the window refused for capacity, not the one an unservable step reached", () => {
            let freed = false;
            const { asked } = walk(
                PLAN,
                window => {
                    if (window.maxBitRate > 2000000) return "unservable";
                    return freed ? "accepted" : "capacity";
                },
                {
                    room: () => {
                        freed = true;
                        return true;
                    },
                },
            );
            expect(asked).to.deep.equal([
                "2560x1440@30-30 8000000",
                "2560x1440@30-30 4000000",
                "2560x1440@30-30 2000000",
                "1280x720@30-30 2000000",
                "640x360@30-30 2000000",
                "makeRoom",
                "2560x1440@30-30 2000000",
            ]);
        });

        it("takes a refused frame rate step from a servable window as the floor, and ends there", () => {
            const { asked, outcome } = walk(PLAN, window => (window.maxFrameRate < 30 ? "unservable" : "capacity"));
            expect(outcome).to.equal("giveUp");
            expect(asked).to.deep.equal([
                "2560x1440@30-30 8000000",
                "1280x720@30-30 8000000",
                "640x360@30-30 8000000",
                "makeRoom",
                "640x360@15-15 8000000",
                "makeRoom",
            ]);
        });

        it("lowers the frame rate from the smallest size it already tried, after room ran out", () => {
            let rooms = 1;
            const { asked } = walk(PLAN, capacity, { room: () => rooms-- > 0 });
            expect(asked.slice(0, 7)).to.deep.equal([
                "2560x1440@30-30 8000000",
                "1280x720@30-30 8000000",
                "640x360@30-30 8000000",
                "makeRoom",
                "2560x1440@30-30 8000000",
                "makeRoom",
                "640x360@15-15 8000000",
            ]);
        });

        it("never asks for the same window twice, except the one it returns to after making room", () => {
            let rooms = 3;
            const { asked } = walk(PLAN, capacity, { room: () => rooms-- > 0 });
            const windows = asked.filter(entry => entry !== "makeRoom");
            const repeats = windows.filter((window, index) => windows.indexOf(window) !== index);
            expect(new Set(repeats)).to.deep.equal(new Set(["2560x1440@30-30 8000000"]));
        });
    });

    describe("the encoder budget", () => {
        const UP_TO_720P_30 = (window: VideoEnvelope): boolean => encodedPixelRate(window) <= 1280 * 720 * 30;

        it("sends no window the budget rejects, and gives up frame size before frame rate for it", () => {
            const { asked, search } = walk(PLAN, () => "accepted", { fits: UP_TO_720P_30 });
            expect(asked).to.deep.equal(["1280x720@30-30 8000000"]);
            expect(
                search.budgetNarrowing(videoRetryWindow(PLAN, { bitRate: 0, frameRate: 0, resolution: 1 })),
            ).to.deep.equal({ maxResolution: { width: 2560, height: 1440 } });
        });

        it("makes room before it lowers the frame rate for the budget", () => {
            let freed = false;
            const { asked } = walk(PLAN, () => "accepted", {
                fits: window => freed || encodedPixelRate(window) < 640 * 360 * 30,
                room: () => {
                    freed = true;
                    return true;
                },
            });
            expect(asked).to.deep.equal(["makeRoom", "2560x1440@30-30 8000000"]);
        });

        it("lets the camera decide on a window the budget rejects when no room can be made", () => {
            // The camera's stream list may be ahead of the reported one.
            const { asked } = walk(PLAN, () => "accepted", { fits: () => false });
            expect(asked).to.deep.equal(["makeRoom", "640x360@30-30 8000000"]);
        });

        it("reports nothing narrowed when the camera, not the budget, made the request give up size", () => {
            // Bit rate and frame rate cannot step, so a refused full size is given up for 1280x720.
            const sizeOnly: VideoPlan = {
                ...PLAN,
                envelope: { ...WINDOW, minBitRate: WINDOW.maxBitRate },
                frameRateFloor: 30,
            };
            const refusals: VideoRefusal[] = ["unservable", "capacity"];
            for (const refusal of refusals) {
                const { asked, search } = walk(sizeOnly, window =>
                    window.maxResolution.width === 2560 ? refusal : "accepted",
                );
                expect(asked.at(-1)).to.equal("1280x720@30-30 8000000");
                const accepted = videoRetryWindow(sizeOnly, { bitRate: 0, frameRate: 0, resolution: 1 });
                expect(search.budgetNarrowing(accepted)).to.equal(undefined);
            }
        });

        it("reports nothing narrowed when the budget rejected no window", () => {
            const { search } = walk(PLAN, () => "accepted");
            expect(search.budgetNarrowing(WINDOW)).to.equal(undefined);
        });
    });

    it("reports capacity as the reason once the camera refused any window for capacity", () => {
        const search = new VideoWindowSearch(PLAN, ANY_BUDGET);
        expect(search.outcome).to.equal("unservable");
        search.refused("capacity");
        search.noRoom();
        search.refused("unservable");
        expect(search.outcome).to.equal("capacity");
    });

    it("skips a step that leaves the window unchanged", () => {
        const pinned = { ...WINDOW, minResolution: WINDOW.maxResolution, minBitRate: WINDOW.maxBitRate };
        expect(walk({ ...PLAN, envelope: pinned, frameRateFloor: 30 }, unservable).asked).to.deep.equal([
            "2560x1440@30-30 8000000",
        ]);
    });

    it("keeps every window inside the caller's bounds and the offer's ceilings", () => {
        const capabilities = {
            sensor: { width: 2560, height: 1440 },
            maxFrameRate: 60,
            minViewport: { width: 640, height: 360 },
            rateDistortionPoints: [{ codec: H265, resolution: { width: 1280, height: 720 }, minBitRate: 400000 }],
            maxNetworkBandwidth: 8000000,
        };
        const bounded = plan({
            capabilities,
            limits: { codec: H265, maxPixels: 1920 * 1080, maxPixelsPerSecond: 1920 * 1080 * 40 },
            hints: {
                minFrameRate: 20,
                maxFrameRate: 50,
                minBitRate: 3000000,
                maxBitRate: 6000000,
                minResolution: { width: 1280, height: 720 },
            },
        });
        const windows = new Array<VideoEnvelope>();
        const search = new VideoWindowSearch(bounded, ANY_BUDGET);
        for (let move = search.move; move.kind === "ask"; move = search.move) {
            windows.push(move.window);
            search.refused("unservable");
        }
        expect(windows.length).to.be.greaterThan(3);
        for (const window of windows) {
            expect(window.minFrameRate).to.equal(window.maxFrameRate);
            expect(window.maxFrameRate).to.be.within(20, 50);
            expect(window.maxFrameRate * window.maxResolution.width * window.maxResolution.height).to.be.at.most(
                1920 * 1080 * 40,
            );
            expect(window.minBitRate).to.equal(3000000);
            expect(window.maxBitRate).to.be.within(3000000, 6000000);
            expect(window.maxResolution.width).to.be.within(1280, 1920);
            expect(window.maxResolution.height).to.be.within(720, 1080);
        }
    });

    describe("firstVideoWindow", () => {
        it("is the plan's window when the budget carries it", () => {
            expect(firstVideoWindow(PLAN, ANY_BUDGET)).to.deep.equal(WINDOW);
        });

        it("is the first window the budget lets through", () => {
            const first = firstVideoWindow(PLAN, window => encodedPixelRate(window) <= 1280 * 720 * 30);
            expect(summary(first)).to.equal("1280x720@30-30 8000000");
        });
    });
});
