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
 * for capacity is servable. Only the camera refuses: the encoder budget predicts, it never refuses.
 */
export type VideoRefusal = "unservable" | "capacity";

interface Step {
    readonly from: VideoRetrySteps;
    readonly dimension: RetryDimension;
}

/** `makeRoom`: free a stream, then call `roomMade`, or `noRoom` when nothing could be freed. */
export type VideoSearchMove =
    | { readonly kind: "ask"; readonly window: VideoEnvelope }
    | { readonly kind: "makeRoom" }
    | { readonly kind: "giveUp" };

/** `budgetLoweredRate`: the budget, not the camera, lowered the frame rate on the way to `steps`. */
interface Fitted {
    readonly steps: VideoRetrySteps;
    readonly fits: boolean;
    readonly budgetLoweredRate: boolean;
    /** The steps before the budget lowered the frame rate. */
    readonly beforeRate: VideoRetrySteps;
}

/**
 * The window to ask instead of `wanted` when `wanted` costs more than the free encoder budget: the
 * capacity order, frame size first at the same rate, then frame rate. When nothing fits, the smallest
 * size at the wanted rate, which the camera then decides on.
 */
function fitToBudget(
    plan: VideoPlan,
    wanted: VideoRetrySteps,
    limits: VideoRetrySteps,
    fits: (window: VideoEnvelope) => boolean,
): Fitted {
    let steps = wanted;
    if (fits(videoRetryWindow(plan, steps))) return { steps, fits: true, budgetLoweredRate: false, beforeRate: steps };
    for (let count = steps.resolution + 1; count <= limits.resolution; count++) {
        steps = { ...steps, resolution: count };
        if (fits(videoRetryWindow(plan, steps)))
            return { steps, fits: true, budgetLoweredRate: false, beforeRate: steps };
    }
    const beforeRate = steps;
    for (let count = steps.frameRate + 1; count <= limits.frameRate; count++) {
        const slower = { ...beforeRate, frameRate: count };
        if (fits(videoRetryWindow(plan, slower))) {
            return { steps: slower, fits: true, budgetLoweredRate: true, beforeRate };
        }
    }
    return { steps: beforeRate, fits: false, budgetLoweredRate: false, beforeRate };
}

/**
 * The only thing that changes a request window. It walks the windows of a {@link VideoPlan}, best
 * first; every window lies inside the plan, so inside the caller's bounds and the offer's decode
 * ceiling.
 *
 * - `fits` is the encoder budget, and it only predicts: a window it rejects is replaced by the first
 *   one in the capacity order that fits ({@link fitToBudget}), which is then asked. Only the camera's
 *   answers count as refusals, so nothing is freed before the camera itself answers ResourceExhausted.
 * - A window the camera refused is never asked again, except the best one refused for capacity, which
 *   is asked again (through the budget, now with the freed room) once room has been made.
 * - Unservable: lower the first dimension in {@link RETRY_DIMENSIONS} order that can still step. A
 *   frame size step starts frame rate again at the highest rate the smaller size allows.
 * - Capacity: lower a dimension that charges the encoder and has a published floor, keeping the frame
 *   rate so the window charges less; without one, ask for room. Only when no room can be made, lower
 *   one with an unpublished floor.
 * - Unservable right after a frame rate lowered for capacity: the rate before is restored. If the
 *   camera refused that window for capacity, it was servable and the step found the camera's floor,
 *   which becomes the frame rate limit, and the search goes on as after that capacity refusal. If only
 *   the budget lowered the rate, that window is asked as it is; the budget will not pick the refused
 *   rate again, since steps pass over every window the camera refused as the budget would fit it.
 */
export class VideoWindowSearch {
    readonly #plan: VideoPlan;
    readonly #fits: (window: VideoEnvelope) => boolean;
    /** The steps asked last, and the steps the search wanted before the budget moved them. */
    #asked = NO_RETRY_STEPS;
    #wanted = NO_RETRY_STEPS;
    #budgetBefore: VideoRetrySteps | undefined;
    #limits = MAX_RETRY_STEPS;
    #lastStep: Step | undefined;
    readonly #refused = new Array<{ readonly window: VideoEnvelope; readonly refusal: VideoRefusal }>();
    #bestServable: VideoRetrySteps | undefined;
    #capacitySeen = false;
    #budgetMoved = false;
    #move: VideoSearchMove;

    constructor(plan: VideoPlan, fits: (window: VideoEnvelope) => boolean) {
        this.#plan = plan;
        this.#fits = fits;
        this.#move = this.#propose(NO_RETRY_STEPS, undefined);
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
        if (!this.#budgetMoved) return undefined;
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
        this.#refused.push({ window: videoRetryWindow(this.#plan, this.#asked), refusal });
        if (refusal === "unservable" && this.#budgetBefore !== undefined) {
            this.#move = this.#askAsIs(this.#budgetBefore);
            return;
        }
        const lastStep = this.#lastStep;
        if (
            refusal === "unservable" &&
            lastStep?.dimension.unpublishedFloor &&
            this.#refusalOf(lastStep.from) === "capacity"
        ) {
            const name = lastStep.dimension.name;
            this.#limits = { ...this.#limits, [name]: lastStep.from[name] };
            this.#asked = lastStep.from;
            this.#wanted = lastStep.from;
            this.#move = this.#after("capacity");
            return;
        }
        this.#move = this.#after(refusal);
    }

    roomMade(): void {
        const best = this.#bestServable ?? this.#wanted;
        this.#bestServable = undefined;
        this.#move = this.#propose(best, undefined);
    }

    noRoom(): void {
        this.#move = this.#step(
            RETRY_DIMENSIONS.filter(dimension => dimension.unpublishedFloor && dimension.chargesEncoder),
            "capacity",
        );
    }

    #after(refusal: VideoRefusal): VideoSearchMove {
        if (refusal === "unservable") return this.#step(RETRY_DIMENSIONS, refusal);
        this.#bestServable ??= this.#wanted;
        const safe = RETRY_DIMENSIONS.filter(dimension => dimension.chargesEncoder && !dimension.unpublishedFloor);
        const move = this.#step(safe, "capacity");
        return move.kind === "giveUp" ? { kind: "makeRoom" } : move;
    }

    /**
     * Steps over windows the camera already refused, so a later step starts from the furthest one. An
     * unservable window steps from what the search wanted, which the budget then fits again; a window
     * refused for capacity steps from what was asked, since it must charge the encoder less, so a size
     * step then keeps the frame rate.
     */
    #step(dimensions: readonly RetryDimension[], refusal: VideoRefusal): VideoSearchMove {
        let position = refusal === "unservable" ? this.#wanted : this.#asked;
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
                return this.#propose(next, { from: position, dimension });
            }
        }
        this.#asked = position;
        return { kind: "giveUp" };
    }

    /** Asks for `wanted`, or for the window the budget points to instead. */
    #propose(wanted: VideoRetrySteps, lastStep: Step | undefined): VideoSearchMove {
        const fitted = fitToBudget(this.#plan, wanted, this.#limits, this.#fits);
        if (!sameSteps(fitted.steps, wanted)) this.#budgetMoved = true;
        this.#wanted = wanted;
        this.#asked = fitted.steps;
        this.#lastStep = lastStep;
        this.#budgetBefore = fitted.budgetLoweredRate ? fitted.beforeRate : undefined;
        return { kind: "ask", window: videoRetryWindow(this.#plan, fitted.steps) };
    }

    /** Asks for `steps` whatever the budget predicts: the camera decides. */
    #askAsIs(steps: VideoRetrySteps): VideoSearchMove {
        this.#wanted = steps;
        this.#asked = steps;
        this.#lastStep = undefined;
        this.#budgetBefore = undefined;
        return { kind: "ask", window: videoRetryWindow(this.#plan, steps) };
    }

    /** Whether the camera refused the window `steps` would be asked as. */
    #isRefused(steps: VideoRetrySteps): boolean {
        const window = videoRetryWindow(this.#plan, fitToBudget(this.#plan, steps, this.#limits, this.#fits).steps);
        return this.#refused.some(entry => sameVideoEnvelope(entry.window, window));
    }

    /** The camera's latest answer for the window these steps make. */
    #refusalOf(steps: VideoRetrySteps): VideoRefusal | undefined {
        const window = videoRetryWindow(this.#plan, steps);
        return this.#refused.filter(entry => sameVideoEnvelope(entry.window, window)).at(-1)?.refusal;
    }
}

function sameSteps(a: VideoRetrySteps, b: VideoRetrySteps): boolean {
    return (
        a.bitRate === b.bitRate &&
        a.frameRate === b.frameRate &&
        a.resolution === b.resolution &&
        a.frameRateTarget === b.frameRateTarget
    );
}

/**
 * The first window an allocate would ask that the encoder budget `fits` carries, or undefined when no
 * window fits, so an allocate could only succeed by freeing room or by the camera disagreeing.
 */
export function firstVideoWindow(plan: VideoPlan, fits: (window: VideoEnvelope) => boolean): VideoEnvelope | undefined {
    const fitted = fitToBudget(plan, NO_RETRY_STEPS, MAX_RETRY_STEPS, fits);
    return fitted.fits ? videoRetryWindow(plan, fitted.steps) : undefined;
}
