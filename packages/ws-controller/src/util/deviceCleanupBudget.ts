/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Logger, Millis, withTimeout } from "@matter/main";

// Operator log-level filters key on the facility name, so these warnings share the camera manager's.
const logger = Logger.get("CameraStreamManager");

/**
 * How long one request's give-backs, or one release pass, may wait on the device in total.
 *
 * The usual reason anything is being given back is that the camera stopped answering, and the
 * callers cannot wait for that: a request holds the endpoint lock while it gives back, and shutdown
 * runs a release pass before the connections close.
 */
export const DEVICE_CLEANUP_BUDGET_MS = 10000;

/**
 * Await `work` for at most {@link DEVICE_CLEANUP_BUDGET_MS}, then stop waiting for it.
 *
 * The invokes underneath cannot be cancelled and run on unattended, so what they still change on
 * this side must be safe to apply late: see `CameraSessionRegistry.forgetEstablished` and the lease
 * generation on `StreamLease`. What they change on the DEVICE cannot be guarded from here — an
 * abandoned deallocate still reaches the camera, after the endpoint lock is gone, and the id it
 * names may by then be a stream a later request allocated. Closing that needs an invoke this server
 * can abort, and `Invoke` carries no abort signal.
 */
export async function withCleanupBudget(what: string, work: () => Promise<void>): Promise<void> {
    try {
        await withTimeout(Millis(DEVICE_CLEANUP_BUDGET_MS), work());
    } catch (error) {
        logger.warn(`Camera cleanup (${what}) was abandoned after ${DEVICE_CLEANUP_BUDGET_MS} ms:`, error);
    }
}
