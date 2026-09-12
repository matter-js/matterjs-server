/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/** The message to show a user for a thrown value, which need not be an Error. */
export function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
