/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { StatusResponseError } from "@matter/main/types";

/** The `code` fallback covers errors raised by something other than matter.js. */
export function deviceStatusOf(error: unknown): number | undefined {
    const statusResponse = StatusResponseError.of(error);
    if (statusResponse !== undefined) return statusResponse.code;
    if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
    return typeof error.code === "number" ? error.code : undefined;
}
