/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Extracts an error message from an unknown error value.
 */
export function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
}
