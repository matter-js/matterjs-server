/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * JSON utilities for handling BigInt values in WebSocket communication.
 * These functions ensure proper serialization/deserialization of large numbers
 * that exceed JavaScript's MAX_SAFE_INTEGER (e.g., Matter node IDs, fabric IDs).
 */

/** Marker prefix for large numbers that need BigInt conversion */
const BIGINT_MARKER = "__BIGINT__";

/**
 * Serialize to JSON with BigInt support.
 * - BigInt values within safe integer range are converted to numbers
 * - Large BigInt values are output as raw decimal numbers (not quoted strings)
 * Use this for outgoing WebSocket messages and displaying values.
 */
export function toBigIntAwareJson(value: unknown, spaces?: number): string {
    const replacements = new Array<{ from: string; to: string }>();
    let result = JSON.stringify(
        value,
        (_key, val) => {
            if (typeof val === "bigint") {
                if (val > Number.MAX_SAFE_INTEGER) {
                    // Store replacement: quoted hex string -> raw decimal number
                    replacements.push({ from: `"0x${val.toString(16)}"`, to: val.toString() });
                    return `0x${val.toString(16)}`;
                } else {
                    return Number(val);
                }
            }
            return val;
        },
        spaces,
    );
    // Large numbers need to be raw (not quoted) in the output, so replace hex placeholders with decimal
    // This handles both object values and array elements
    if (replacements.length > 0) {
        replacements.forEach(({ from, to }) => {
            result = result.replaceAll(from, to);
        });
    }

    return result;
}

/**
 * Parse JSON with BigInt support for large numbers that exceed JavaScript precision.
 * Numbers with 15+ digits that exceed MAX_SAFE_INTEGER are converted to BigInt.
 * Use this for incoming WebSocket messages.
 *
 * This function carefully avoids modifying numbers that appear inside string values.
 */
export function parseBigIntAwareJson(json: string): unknown {
    // Pre-process: Replace large numbers (15+ digits) with marked string placeholders
    // This must happen before JSON.parse to preserve precision
    // We need to track whether we're inside a string to avoid modifying string contents
    const result: string[] = [];
    let i = 0;
    let inString = false;

    while (i < json.length) {
        const char = json[i];

        if (inString) {
            // Inside a string - copy characters as-is until we find the closing quote
            if (char === "\\") {
                // Escape sequence - copy both the backslash and the next character
                result.push(char);
                i++;
                if (i < json.length) {
                    result.push(json[i]);
                    i++;
                }
            } else if (char === '"') {
                // End of string
                result.push(char);
                inString = false;
                i++;
            } else {
                result.push(char);
                i++;
            }
        } else {
            // Outside a string
            if (char === '"') {
                // Start of a string
                result.push(char);
                inString = true;
                i++;
            } else if (char >= "0" && char <= "9") {
                // Potential number - extract and check
                // Check if previous character was a minus sign (for negative numbers)
                const hasMinus = result.length > 0 && result[result.length - 1] === "-";
                if (hasMinus) {
                    result.pop(); // Remove the minus sign, we'll include it in the number
                }

                const start = i;
                while (i < json.length && json[i] >= "0" && json[i] <= "9") {
                    i++;
                }
                const digitsStr = json.slice(start, i);
                const numberStr = hasMinus ? `-${digitsStr}` : digitsStr;

                // Only convert if it's 15+ digits and exceeds safe integer range
                if (digitsStr.length >= 15) {
                    const num = BigInt(numberStr);
                    if (num > Number.MAX_SAFE_INTEGER || num < Number.MIN_SAFE_INTEGER) {
                        result.push(`"${BIGINT_MARKER}${numberStr}"`);
                    } else {
                        result.push(numberStr);
                    }
                } else {
                    result.push(numberStr);
                }
            } else {
                result.push(char);
                i++;
            }
        }
    }

    const processed = result.join("");

    // Parse with reviver to convert marked strings back to BigInt
    return JSON.parse(processed, (_key, value) => {
        if (typeof value === "string" && value.startsWith(BIGINT_MARKER)) {
            return BigInt(value.slice(BIGINT_MARKER.length));
        }
        return value;
    });
}
