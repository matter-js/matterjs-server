/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger, Millis, withTimeout } from "@matter/main";

// Shares the camera manager's facility so operator log-level filters cover these warnings.
const logger = Logger.get("CameraStreamManager");

/**
 * Total time one request's give-backs, or one release pass, may wait on the device. Bounded because
 * a request holds the endpoint lock while it gives back, and shutdown waits for the release pass.
 */
export const DEVICE_CLEANUP_BUDGET_MS = 10000;

/**
 * The invokes underneath cannot be cancelled and keep running, so their late local effects must be
 * safe: see `CameraSessionRegistry.forgetEstablished` and the lease generation on `StreamLease`.
 * Late device effects are not guarded: an abandoned deallocate can reach the camera after the
 * endpoint lock is released and hit a stream id a later request reallocated. `Invoke` takes no
 * abort signal, so this cannot be closed here.
 */
export async function withCleanupBudget(what: string, work: () => Promise<void>): Promise<void> {
    try {
        await withTimeout(Millis(DEVICE_CLEANUP_BUDGET_MS), work());
    } catch (error) {
        logger.warn(`Camera cleanup (${what}) was abandoned after ${DEVICE_CLEANUP_BUDGET_MS} ms:`, error);
    }
}
