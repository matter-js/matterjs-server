/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VideoEnvelope } from "./cameraTypes.js";
import type { VideoPlan } from "./streamPolicy.js";
import { halveResolution, sameVideoEnvelope, withFrameRate } from "./streamPolicy.js";

export type VideoRetryDimension = "bitRate" | "resolution" | "frameRate";

/** How many times each ceiling of a {@link VideoPlan} is halved. */
export type VideoRetrySteps = Readonly<Record<VideoRetryDimension, number>>;

export const NO_RETRY_STEPS: VideoRetrySteps = { bitRate: 0, resolution: 0, frameRate: 0 };

/** Bounded, so a camera refusing everything fails after a known number of attempts. */
export const MAX_RETRY_STEPS: VideoRetrySteps = { bitRate: 4, resolution: 2, frameRate: 2 };

interface RetryDimension {
    readonly name: VideoRetryDimension;
    /**
     * No attribute states how low the camera goes, so a lower value can make a servable window
     * unservable. Resolution has `MinViewport`, bit rate the rate-distortion trade-off point.
     */
    readonly unpublishedFloor: boolean;
    /** Lowering it charges the encoder budget less (`MaxEncodedPixelRate`, §11.2.7.2). */
    readonly chargesEncoder: boolean;
    /** One step down, never below the plan's floor for this dimension. */
    readonly lower: (window: VideoEnvelope, plan: VideoPlan) => VideoEnvelope;
}

/**
 * In the order an unservable window is narrowed. Bit rate first: no attribute publishes a profile's
 * bit rate ceiling, and the Aqara G350 refuses anything over 2 Mbit/s. Frame rate last, for its
 * unpublished floor.
 */
const RETRY_DIMENSIONS: readonly RetryDimension[] = [
    {
        name: "bitRate",
        unpublishedFloor: false,
        chargesEncoder: false,
        lower: window => ({ ...window, maxBitRate: Math.max(window.minBitRate, Math.floor(window.maxBitRate / 2)) }),
    },
    {
        name: "resolution",
        unpublishedFloor: false,
        chargesEncoder: true,
        lower: window => ({ ...window, maxResolution: halveResolution(window.maxResolution, window.minResolution) }),
    },
    {
        name: "frameRate",
        unpublishedFloor: true,
        chargesEncoder: true,
        lower: (window, plan) =>
            withFrameRate(window, Math.max(plan.frameRateFloor, Math.floor(window.maxFrameRate / 2))),
    },
];

/** The plan's window with each dimension lowered as often as `steps` says. */
export function videoRetryWindow(plan: VideoPlan, steps: VideoRetrySteps): VideoEnvelope {
    let window = plan.envelope;
    for (const dimension of RETRY_DIMENSIONS) {
        for (let taken = 0; taken < steps[dimension.name]; taken++) window = dimension.lower(window, plan);
    }
    return window;
}

/**
 * What the camera said about a window: `unservable` (DynamicConstraintError: outside every profile) or
 * `capacity` (ResourceExhausted). The reference camera app checks profiles first, so a window refused
 * for capacity is servable.
 */
export type VideoRefusal = "unservable" | "capacity";

/** `makeRoom`: free a stream, then call `roomMade`, or `noRoom` when nothing could be freed. */
export type VideoSearchMove = "retry" | "makeRoom" | "giveUp";

interface Step {
    readonly from: VideoRetrySteps;
    /** Why the window stepped from was refused. */
    readonly fromRefusal: VideoRefusal;
    readonly dimension: RetryDimension;
}

/**
 * The windows a `VideoStreamAllocate` asks for, one at a time, best first. Every window lies inside the
 * plan, so inside the caller's bounds and the offer's decode ceiling.
 *
 * - A window the camera refused is never asked again, except the best one it refused only for capacity,
 *   which is asked again once room has been made.
 * - After an unservable refusal, the next window lowers the first dimension that can still step, in
 *   {@link RETRY_DIMENSIONS} order.
 * - After a capacity refusal, the next window lowers a dimension that charges the encoder less and has a
 *   published floor. Without one, the search asks for room, and only when no room can be made does it
 *   lower one with an unpublished floor.
 * - An unservable refusal right after a step in a dimension with an unpublished floor has found that
 *   floor: the dimension goes back to where it was and stays there, and the window before is handled
 *   again under its own refusal.
 *
 * `fit` turns the requested window into the one sent (the encoder budget); it may answer differently
 * once room has been made.
 */
export class VideoWindowSearch {
    readonly #plan: VideoPlan;
    readonly #fit: (window: VideoEnvelope) => VideoEnvelope;
    #steps = NO_RETRY_STEPS;
    #limits = MAX_RETRY_STEPS;
    #lastStep: Step | undefined;
    readonly #refused = new Array<VideoEnvelope>();
    #bestServable: VideoRetrySteps | undefined;
    #servableSeen = false;

    constructor(plan: VideoPlan, fit: (window: VideoEnvelope) => VideoEnvelope) {
        this.#plan = plan;
        this.#fit = fit;
    }

    /** The window to ask for now, before `fit`. */
    get requested(): VideoEnvelope {
        return videoRetryWindow(this.#plan, this.#steps);
    }

    /**
     * Why the search ended without a stream: `capacity` once any window was refused only for capacity,
     * since the camera can serve that one and only room is missing.
     */
    get outcome(): VideoRefusal {
        return this.#servableSeen ? "capacity" : "unservable";
    }

    refused(refusal: VideoRefusal): VideoSearchMove {
        this.#refused.push(this.#fit(this.requested));
        if (refusal === "capacity") this.#servableSeen = true;
        const lastStep = this.#lastStep;
        if (refusal === "unservable" && lastStep?.dimension.unpublishedFloor) {
            const name = lastStep.dimension.name;
            this.#limits = { ...this.#limits, [name]: lastStep.from[name] };
            this.#moveTo(lastStep.from);
            return this.#after(lastStep.fromRefusal);
        }
        return this.#after(refusal);
    }

    roomMade(): void {
        if (this.#bestServable !== undefined) this.#moveTo(this.#bestServable);
        this.#bestServable = undefined;
    }

    noRoom(): VideoSearchMove {
        return this.#step(
            RETRY_DIMENSIONS.filter(dimension => dimension.chargesEncoder && dimension.unpublishedFloor),
            "capacity",
        );
    }

    #after(refusal: VideoRefusal): VideoSearchMove {
        if (refusal === "unservable") return this.#step(RETRY_DIMENSIONS, refusal);
        this.#bestServable ??= this.#steps;
        const safe = RETRY_DIMENSIONS.filter(dimension => dimension.chargesEncoder && !dimension.unpublishedFloor);
        return this.#step(safe, refusal) === "retry" ? "retry" : "makeRoom";
    }

    /** Passes over windows already refused, so a later step starts from the furthest one. */
    #step(dimensions: readonly RetryDimension[], refusal: VideoRefusal): VideoSearchMove {
        let position = this.#steps;
        for (const dimension of dimensions) {
            for (let count = position[dimension.name] + 1; count <= this.#limits[dimension.name]; count++) {
                const next = { ...position, [dimension.name]: count };
                const window = this.#fit(videoRetryWindow(this.#plan, next));
                if (this.#refused.some(refused => sameVideoEnvelope(refused, window))) {
                    position = next;
                    continue;
                }
                this.#lastStep = { from: position, fromRefusal: refusal, dimension };
                this.#steps = next;
                return "retry";
            }
        }
        this.#moveTo(position);
        return "giveUp";
    }

    #moveTo(steps: VideoRetrySteps): void {
        this.#steps = steps;
        this.#lastStep = undefined;
    }
}
