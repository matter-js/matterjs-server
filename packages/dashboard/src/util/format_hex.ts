/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Format a number as a hex string with 0x prefix.
 * Ensures even number of digits with a minimum of 4 digits.
 *
 * Examples:
 *   0 -> "0x0000"
 *   255 -> "0x00FF"
 *   65535 -> "0xFFFF"
 *   65536 -> "0x010000"
 */
export function formatHex(value: number): string {
    let hex = value.toString(16).toUpperCase();

    // Ensure minimum 4 digits
    if (hex.length < 4) {
        hex = hex.padStart(4, "0");
    }
    // Ensure even number of digits
    else if (hex.length % 2 !== 0) {
        hex = "0" + hex;
    }

    return `0x${hex}`;
}
