/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { StatusResponseError, ValidationError } from "@matter/main/types";

/**
 * The status the device sent. A `ValidationError` is a local encode failure that carries a status code but no
 * device answer, so it yields `undefined`. The `code` fallback covers errors raised by something other than matter.js.
 */
export function deviceStatusOf(error: unknown): number | undefined {
    const statusResponse = StatusResponseError.of(error);
    if (statusResponse instanceof ValidationError) return undefined;
    if (statusResponse !== undefined) return statusResponse.code;
    if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
    return typeof error.code === "number" ? error.code : undefined;
}
