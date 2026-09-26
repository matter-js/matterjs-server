/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { StatusResponseError } from "@matter/main/types";

/**
 * The Matter status a device rejection carries, or `undefined` for anything else.
 *
 * `StatusResponseError.of` walks the `cause` chain and `AggregateError.errors`, so a status wrapped
 * by any layer between the invoke and here is still found. The structural read behind it covers a
 * raiser that is not matter.js's error type.
 */
export function deviceStatusOf(error: unknown): number | undefined {
    const statusResponse = StatusResponseError.of(error);
    if (statusResponse !== undefined) return statusResponse.code;
    if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
    return typeof error.code === "number" ? error.code : undefined;
}
