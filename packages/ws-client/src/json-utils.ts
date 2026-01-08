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
 */
export function parseBigIntAwareJson(json: string): unknown {
    // Pre-process: Replace large numbers (15+ digits) with marked string placeholders
    // This must happen before JSON.parse to preserve precision
    // Match numbers after colon (object values) or after [ or , (array elements)
    const processed = json.replace(/([:,[])\s*(\d{15,})(?=[,}\]\s])/g, (match, prefix, number) => {
        const num = BigInt(number);
        if (num > Number.MAX_SAFE_INTEGER) {
            return `${prefix}"${BIGINT_MARKER}${number}"`;
        }
        return match;
    });

    // Parse with reviver to convert marked strings back to BigInt
    return JSON.parse(processed, (_key, value) => {
        if (typeof value === "string" && value.startsWith(BIGINT_MARKER)) {
            return BigInt(value.slice(BIGINT_MARKER.length));
        }
        return value;
    });
}
