/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Resolution, VideoBudgetNarrowing, VideoEnvelope } from "./cameraTypes.js";
import type { VideoPlan } from "./streamPolicy.js";
import { halveResolution, planFrameRate, sameVideoEnvelope, withFrameRate } from "./streamPolicy.js";

export type VideoRetryDimension = "bitRate" | "frameRate" | "resolution";

/** How many times each ceiling of a {@link VideoPlan} is halved. */
export interface VideoRetrySteps extends Readonly<Record<VideoRetryDimension, number>> {
    /**
     * The rate frame rate counts down from; the plan's first rate when absent. A size step for an
     * unservable window starts it again at the highest rate the smaller size allows.
     */
    readonly frameRateTarget?: number;
}

export const NO_RETRY_STEPS: VideoRetrySteps = { bitRate: 0, frameRate: 0, resolution: 0 };

/** Bounded, so a camera refusing everything fails after a known number of attempts. */
export const MAX_RETRY_STEPS: VideoRetrySteps = { bitRate: 4, frameRate: 2, resolution: 2 };

interface RetryDimension {
    readonly name: VideoRetryDimension;
    /**
     * No attribute states how low the camera goes, so a lower value can make a servable window
     * unservable. Resolution has `MinViewport`, bit rate the rate-distortion trade-off point.
     */
    readonly unpublishedFloor: boolean;
    /** Lowering it charges the encoder budget less (`MaxEncodedPixelRate`, §11.2.7.2). */
    readonly chargesEncoder: boolean;
}

/**
 * The order an unservable window is narrowed in: the quality given up first comes first. Bit rate
 * first, since no attribute publishes a profile's bit rate ceiling (the Aqara G350 refuses anything
 * over 2 Mbit/s). Then frame rate, then frame size: a stream keeps its frame size longest, so a camera
 * serving 1080p only at 30 fps gets 1080p at 30 rather than 480p at 60.
 */
const RETRY_DIMENSIONS: readonly RetryDimension[] = [
    { name: "bitRate", unpublishedFloor: false, chargesEncoder: false },
    { name: "frameRate", unpublishedFloor: true, chargesEncoder: true },
    { name: "resolution", unpublishedFloor: false, chargesEncoder: true },
];

/** The plan's window with each ceiling lowered as often as `steps` says, never below its floor. */
export function videoRetryWindow(plan: VideoPlan, steps: VideoRetrySteps): VideoEnvelope {
    const { envelope, frameRateFloor } = plan;
    const maxResolution = retryResolution(plan, steps.resolution);
    let frameRate = steps.frameRateTarget ?? envelope.maxFrameRate;
    for (let taken = 0; taken < steps.frameRate; taken++) {
        frameRate = Math.max(frameRateFloor, Math.floor(frameRate / 2));
    }
    let maxBitRate = envelope.maxBitRate;
    for (let taken = 0; taken < steps.bitRate; taken++) {
        maxBitRate = Math.max(envelope.minBitRate, Math.floor(maxBitRate / 2));
    }
    return { ...withFrameRate(envelope, frameRate), maxResolution, maxBitRate };
}

function retryResolution(plan: VideoPlan, steps: number): Resolution {
    let resolution = plan.envelope.maxResolution;
    for (let taken = 0; taken < steps; taken++) resolution = halveResolution(resolution, plan.envelope.minResolution);
    return resolution;
}

/**
 * The camera's answer to a window: `unservable` (DynamicConstraintError: outside every profile) or
 * `capacity` (ResourceExhausted). The reference camera app checks profiles first, so a window refused
 * for capacity is servable.
 */
export type VideoRefusal = "unservable" | "capacity";

/** `overBudget`: not sent, because it costs more than the camera's free encoded pixel rate. */
type Refusal = VideoRefusal | "overBudget";

interface Step {
    readonly from: VideoRetrySteps;
    readonly dimension: RetryDimension;
}

/** `makeRoom`: free a stream, then call `roomMade`, or `noRoom` when nothing could be freed. */
export type VideoSearchMove =
    | { readonly kind: "ask"; readonly window: VideoEnvelope }
    | { readonly kind: "makeRoom" }
    | { readonly kind: "giveUp" };

/**
 * The only thing that changes a request window. It walks the windows of a {@link VideoPlan}, best
 * first; every window lies inside the plan, so inside the caller's bounds and the offer's decode
 * ceiling.
 *
 * - `fits` is the encoder budget. A window it rejects is not sent and counts as refused for capacity.
 * - A refused window is never asked again, except the best one refused for capacity, which is asked
 *   again once room has been made.
 * - Unservable: lower the first dimension in {@link RETRY_DIMENSIONS} order that can still step. A
 *   frame size step starts frame rate again at the highest rate the smaller size allows.
 * - Capacity: lower a dimension that charges the encoder and has a published floor, keeping the frame
 *   rate so the window charges less; without one, ask for room. Only when no room can be made, lower
 *   one with an unpublished floor, and only on the camera's own refusal: a window the budget alone rejected is then sent anyway, since the camera
 *   arbitrates (§11.2.1.2.2) and its stream list may be ahead of ours.
 * - Unservable right after a frame rate step from a window the camera refused for capacity: that
 *   window was servable, so the step found the camera's frame rate floor. Frame rate goes back, stays
 *   there, and the window before is handled as refused for capacity.
 */
export class VideoWindowSearch {
    readonly #plan: VideoPlan;
    readonly #fits: (window: VideoEnvelope) => boolean;
    #steps = NO_RETRY_STEPS;
    #limits = MAX_RETRY_STEPS;
    #lastStep: Step | undefined;
    readonly #refused = new Array<{ readonly window: VideoEnvelope; readonly refusal: Refusal }>();
    #bestServable: VideoRetrySteps | undefined;
    #capacitySeen = false;
    #overBudgetSeen = false;
    #move: VideoSearchMove;
    readonly #budgetIsFinal: boolean;

    /** `budgetIsFinal`: never send a window the budget rejects, for a prediction no camera answers. */
    constructor(plan: VideoPlan, fits: (window: VideoEnvelope) => boolean, budgetIsFinal = false) {
        this.#plan = plan;
        this.#fits = fits;
        this.#budgetIsFinal = budgetIsFinal;
        this.#move = this.#ask(NO_RETRY_STEPS);
    }

    get move(): VideoSearchMove {
        return this.#move;
    }

    /**
     * Why the search ended without a stream: `capacity` once the camera refused any window for
     * capacity, since it can serve that one and only room is missing.
     */
    get outcome(): VideoRefusal {
        return this.#capacitySeen ? "capacity" : "unservable";
    }

    /** The first window's ceilings the budget made the request give up; undefined when it cost nothing. */
    budgetNarrowing(accepted: VideoEnvelope): VideoBudgetNarrowing | undefined {
        if (!this.#overBudgetSeen) return undefined;
        const first = this.#plan.envelope;
        const rateLowered = accepted.maxFrameRate < first.maxFrameRate;
        const sizeLowered =
            accepted.maxResolution.width < first.maxResolution.width ||
            accepted.maxResolution.height < first.maxResolution.height;
        if (!rateLowered && !sizeLowered) return undefined;
        return {
            ...(rateLowered ? { maxFrameRate: first.maxFrameRate } : {}),
            ...(sizeLowered ? { maxResolution: first.maxResolution } : {}),
        };
    }

    /** The camera's answer to the window of the last `ask`. */
    refused(refusal: VideoRefusal): void {
        if (refusal === "capacity") this.#capacitySeen = true;
        this.#record(refusal);
        const lastStep = this.#lastStep;
        if (
            refusal === "unservable" &&
            lastStep?.dimension.unpublishedFloor &&
            this.#refusalOf(lastStep.from) === "capacity"
        ) {
            const name = lastStep.dimension.name;
            this.#limits = { ...this.#limits, [name]: lastStep.from[name] };
            this.#moveTo(lastStep.from);
            this.#move = this.#after("capacity");
            return;
        }
        this.#move = this.#after(refusal);
    }

    roomMade(): void {
        const best = this.#bestServable ?? this.#steps;
        this.#bestServable = undefined;
        this.#move = this.#ask(best);
    }

    noRoom(): void {
        if (!this.#budgetIsFinal && this.#refusalOf(this.#steps) === "overBudget") {
            this.#move = { kind: "ask", window: videoRetryWindow(this.#plan, this.#steps) };
            return;
        }
        this.#move = this.#step(
            RETRY_DIMENSIONS.filter(dimension => dimension.unpublishedFloor && dimension.chargesEncoder),
            "capacity",
        );
    }

    #after(refusal: Refusal): VideoSearchMove {
        if (refusal === "unservable") return this.#step(RETRY_DIMENSIONS, refusal);
        this.#bestServable ??= this.#steps;
        const safe = RETRY_DIMENSIONS.filter(dimension => dimension.chargesEncoder && !dimension.unpublishedFloor);
        const move = this.#step(safe, "capacity");
        return move.kind === "giveUp" ? { kind: "makeRoom" } : move;
    }

    /**
     * Passes over windows already refused, so a later step starts from the furthest one. A step for
     * capacity must charge the encoder less, so a size step then keeps the frame rate.
     */
    #step(dimensions: readonly RetryDimension[], refusal: VideoRefusal): VideoSearchMove {
        let position = this.#steps;
        for (const dimension of dimensions) {
            for (let count = position[dimension.name] + 1; count <= this.#limits[dimension.name]; count++) {
                const next =
                    dimension.name === "resolution" && refusal === "unservable"
                        ? {
                              ...position,
                              resolution: count,
                              frameRate: 0,
                              frameRateTarget: planFrameRate(this.#plan, retryResolution(this.#plan, count)),
                          }
                        : { ...position, [dimension.name]: count };
                if (this.#isRefused(next)) {
                    position = next;
                    continue;
                }
                return this.#ask(next, { from: position, dimension });
            }
        }
        this.#moveTo(position);
        return { kind: "giveUp" };
    }

    /** Asks for `steps`, unless the budget rejects the window, which is then handled as a capacity refusal. */
    #ask(steps: VideoRetrySteps, lastStep?: Step): VideoSearchMove {
        this.#moveTo(steps);
        this.#lastStep = lastStep;
        const window = videoRetryWindow(this.#plan, steps);
        if (this.#fits(window)) return { kind: "ask", window };
        this.#overBudgetSeen = true;
        this.#record("overBudget");
        return this.#after("overBudget");
    }

    #record(refusal: Refusal): void {
        this.#refused.push({ window: videoRetryWindow(this.#plan, this.#steps), refusal });
    }

    #isRefused(steps: VideoRetrySteps): boolean {
        const window = videoRetryWindow(this.#plan, steps);
        return this.#refused.some(entry => sameVideoEnvelope(entry.window, window));
    }

    /** The latest answer for the window these steps make, the camera's or the budget's. */
    #refusalOf(steps: VideoRetrySteps): Refusal | undefined {
        const window = videoRetryWindow(this.#plan, steps);
        return this.#refused.filter(entry => sameVideoEnvelope(entry.window, window)).at(-1)?.refusal;
    }

    #moveTo(steps: VideoRetrySteps): void {
        this.#steps = steps;
        this.#lastStep = undefined;
    }
}

/**
 * The window an allocate would end at if the camera's answers matched the encoder budget `fits`
 * describes and no room could be made.
 */
export function firstVideoWindow(plan: VideoPlan, fits: (window: VideoEnvelope) => boolean): VideoEnvelope {
    const search = new VideoWindowSearch(plan, fits, true);
    for (let move = search.move; ; move = search.move) {
        if (move.kind === "ask") return move.window;
        if (move.kind === "giveUp") return plan.envelope;
        search.noRoom();
    }
}
