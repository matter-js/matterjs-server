/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VideoEnvelope } from "../src/camera/cameraTypes.js";
import { computeVideoEnvelope } from "../src/camera/streamPolicy.js";
import type { VideoEnvelopeArgs, VideoPlan } from "../src/camera/streamPolicy.js";
import { VideoWindowSearch } from "../src/camera/videoWindowSearch.js";
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

const PLAN: VideoPlan = { envelope: WINDOW, frameRateFloor: 1 };

function summary(window: VideoEnvelope): string {
    const { maxResolution, minFrameRate, maxFrameRate, maxBitRate } = window;
    return `${maxResolution.width}x${maxResolution.height}@${minFrameRate}-${maxFrameRate} ${maxBitRate}`;
}

/**
 * Drives a search the way the allocate ladder does. `camera` answers each window; `room` says whether
 * a stream can be freed when the search asks for one.
 */
function walk(
    plan: VideoPlan,
    camera: (window: VideoEnvelope) => VideoRefusal | "accepted",
    room: () => boolean = () => false,
): { asked: string[]; outcome: "accepted" | "giveUp" } {
    const search = new VideoWindowSearch(plan, window => window);
    const asked = new Array<string>();
    for (let attempt = 0; attempt < 50; attempt++) {
        const window = search.requested;
        asked.push(summary(window));
        const answer = camera(window);
        if (answer === "accepted") return { asked, outcome: "accepted" };
        let move = search.refused(answer);
        if (move === "makeRoom") {
            asked.push("makeRoom");
            if (room()) {
                search.roomMade();
                continue;
            }
            move = search.noRoom();
        }
        if (move === "giveUp") return { asked, outcome: "giveUp" };
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
    it("narrows an unservable window by bit rate, then resolution, and tries frame rate last", () => {
        expect(walk(PLAN, unservable).asked).to.deep.equal([
            "2560x1440@30-30 8000000",
            "2560x1440@30-30 4000000",
            "2560x1440@30-30 2000000",
            "2560x1440@30-30 1000000",
            "2560x1440@30-30 800000",
            "1280x720@30-30 800000",
            "640x360@30-30 800000",
            "640x360@15-15 800000",
        ]);
    });

    it("stops lowering the frame rate once a lower rate was refused as unservable", () => {
        // 15 fps is refused like everything else, so 7 fps is never asked.
        const { asked, outcome } = walk(PLAN, unservable);
        expect(outcome).to.equal("giveUp");
        expect(asked.filter(window => window.includes("@7-7"))).to.deep.equal([]);
    });

    it("finds a lower frame rate the camera serves", () => {
        const { asked, outcome } = walk(PLAN, window => (window.maxFrameRate > 15 ? "unservable" : "accepted"));
        expect(outcome).to.equal("accepted");
        expect(asked.at(-1)).to.equal("640x360@15-15 800000");
    });

    it("never lowers the bit rate for a capacity refusal", () => {
        const { asked } = walk(PLAN, capacity);
        expect(asked).to.deep.equal([
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

    it("asks for room before it lowers the frame rate, and returns to the best servable window after", () => {
        let rooms = 1;
        let freed = false;
        const { asked, outcome } = walk(
            PLAN,
            window => (freed && window.maxResolution.width === 2560 ? "accepted" : "capacity"),
            () => {
                if (rooms === 0) return false;
                rooms -= 1;
                freed = true;
                return true;
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
        // Over 2 Mbit/s is unservable; the servable window then lacks room until one stream is freed.
        let freed = false;
        const { asked } = walk(
            PLAN,
            window => {
                if (window.maxBitRate > 2000000) return "unservable";
                return freed ? "accepted" : "capacity";
            },
            () => {
                freed = true;
                return true;
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

    it("treats a refused frame rate step on the capacity path as the floor, and ends there", () => {
        // A profile camera with a hidden 30 fps floor and no room: the lower rate draws DynamicConstraintError.
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

    it("never asks for the same window twice, except the one it returns to after making room", () => {
        let rooms = 3;
        const { asked } = walk(PLAN, capacity, () => rooms-- > 0);
        const windows = asked.filter(entry => entry !== "makeRoom");
        const repeats = windows.filter((window, index) => windows.indexOf(window) !== index);
        expect(new Set(repeats)).to.deep.equal(new Set(["2560x1440@30-30 8000000"]));
    });

    it("lowers the frame rate from the smallest size it already tried, after room ran out", () => {
        let rooms = 1;
        const { asked } = walk(PLAN, capacity, () => rooms-- > 0);
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

    it("reports capacity as the reason once any window was refused only for capacity", () => {
        const search = new VideoWindowSearch(PLAN, window => window);
        expect(search.outcome).to.equal("unservable");
        search.refused("capacity");
        search.noRoom();
        search.refused("unservable");
        expect(search.outcome).to.equal("capacity");
    });

    it("skips a step that leaves the window unchanged", () => {
        const pinned = { ...WINDOW, minResolution: WINDOW.maxResolution, minBitRate: WINDOW.maxBitRate };
        expect(walk({ envelope: pinned, frameRateFloor: 30 }, unservable).asked).to.deep.equal([
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
            limits: { codec: H265, maxPixels: 1920 * 1080 },
            hints: {
                minFrameRate: 20,
                maxFrameRate: 50,
                minBitRate: 3000000,
                maxBitRate: 6000000,
                minResolution: { width: 1280, height: 720 },
            },
        });
        const windows = new Array<VideoEnvelope>();
        const search = new VideoWindowSearch(bounded, window => window);
        for (let move: string = "retry"; move === "retry";) {
            windows.push(search.requested);
            move = search.refused("unservable");
        }
        expect(windows.length).to.be.greaterThan(3);
        for (const window of windows) {
            expect(window.minFrameRate).to.equal(window.maxFrameRate);
            expect(window.maxFrameRate).to.be.within(20, 50);
            expect(window.minBitRate).to.equal(3000000);
            expect(window.maxBitRate).to.be.within(3000000, 6000000);
            expect(window.maxResolution.width).to.be.within(1280, 1920);
            expect(window.maxResolution.height).to.be.within(720, 1080);
        }
    });

    it("compares the windows the budget lets through, not the steps", () => {
        // A budget that caps the frame size makes the resolution steps change nothing.
        const capped = (window: VideoEnvelope): VideoEnvelope => ({
            ...window,
            maxResolution: { width: 640, height: 360 },
        });
        const search = new VideoWindowSearch(PLAN, capped);
        const asked = new Array<string>();
        for (let move: string = "retry"; move === "retry";) {
            asked.push(summary(capped(search.requested)));
            move = search.refused("capacity");
            if (move === "makeRoom") move = search.noRoom();
        }
        expect(asked).to.deep.equal(["640x360@30-30 8000000", "640x360@15-15 8000000", "640x360@7-7 8000000"]);
    });
});
