/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Extracts an error message from an unknown error value.
 * Handles string errors, Error instances, Error-like objects, and
 * falls back to String() for primitives.
 */
export function getErrorMessage(err: unknown): string {
    if (typeof err === "string") return err;
    if (err instanceof Error) return err.message;
    if (err !== null && typeof err === "object") {
        const anyErr = err as { message?: unknown };
        if (typeof anyErr.message === "string") return anyErr.message;
    }
    return String(err);
}
