/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Extracts an error message from an unknown error value.
 * Handles string errors, Error instances, Error-like objects, and
 * falls back to JSON serialization or String() for other types.
 */
export function getErrorMessage(err: unknown): string {
    if (typeof err === "string") return err;
    if (err instanceof Error) return err.message;
    if (err !== null && typeof err === "object") {
        const anyErr = err as { message?: unknown };
        if (typeof anyErr.message === "string") return anyErr.message;
        if (anyErr.message instanceof Error) return anyErr.message.message;
        if (anyErr.message != null) return String(anyErr.message);
        try {
            return JSON.stringify(err);
        } catch {
            return Object.prototype.toString.call(err);
        }
    }
    return String(err);
}
