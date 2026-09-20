/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The Matter status a device rejection carries, or `undefined` for anything else.
 *
 * Structural rather than an `instanceof StatusResponseError` test, so a test double can raise a
 * device status without constructing matter.js's error type.
 */
export function deviceStatusOf(error: unknown): number | undefined {
    if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
    return typeof error.code === "number" ? error.code : undefined;
}
