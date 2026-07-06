/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/** Formats a duration in seconds as a short human string, max two units (e.g. "1 h 5 min"). */
export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = new Array<string>();
    if (hours > 0) {
        parts.push(`${hours} h`);
        if (minutes > 0) parts.push(`${minutes} min`);
    } else if (minutes > 0) {
        parts.push(`${minutes} min`);
        if (secs > 0) parts.push(`${secs} s`);
    } else {
        parts.push(`${secs} s`);
    }
    return parts.join(" ");
}
