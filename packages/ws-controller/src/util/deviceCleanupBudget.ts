/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger, Millis, PromiseTimeoutError, withTimeout } from "@matter/main";

// Shares the camera manager's facility so operator log-level filters cover these warnings.
const logger = Logger.get("CameraStreamManager");

/**
 * Time one {@link withCleanupBudget} call may wait on the device. Bounded because a request holds the
 * endpoint lock while it gives back, and shutdown waits for the release pass. The budget is per call:
 * one `camera_start_stream` can make several calls (ending a session, then the allocation scope's
 * give-backs), so its cleanup can wait a multiple of this.
 */
export const DEVICE_CLEANUP_BUDGET_MS = 10000;

/**
 * The invokes underneath cannot be cancelled and keep running, so their late local effects must be
 * safe: see `CameraSessionRegistry` (a session ends and is announced once) and the lease generation on
 * `StreamLease`.
 * Late device effects are not guarded: an abandoned deallocate can reach the camera after the
 * endpoint lock is released and hit a stream id a later request reallocated. `Invoke` takes no
 * abort signal, so this cannot be closed here.
 *
 * Resolves with the result of `work`, or with `undefined` when it failed or ran past the budget; either is
 * logged, never thrown.
 */
export async function withCleanupBudget<T>(what: string, work: () => Promise<T>): Promise<T | undefined> {
    try {
        return await withTimeout(Millis(DEVICE_CLEANUP_BUDGET_MS), work());
    } catch (error) {
        const outcome =
            error instanceof PromiseTimeoutError ? `was abandoned after ${DEVICE_CLEANUP_BUDGET_MS} ms` : "failed";
        logger.warn(`Camera cleanup (${what}) ${outcome}:`, error);
        return undefined;
    }
}
