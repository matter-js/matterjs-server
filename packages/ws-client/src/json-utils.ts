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

/**
 * A bigint passes through `JSON.stringify` / `JSON.parse` as a string of a marker plus its digits. The marker holds a
 * fresh random part on every call, so text a device or client sends cannot match it.
 */
function uniqueMarker(): string {
    const random = crypto.getRandomValues(new Uint32Array(2));
    return `\uE000${random[0].toString(16)}${random[1].toString(16)}:`;
}

/**
 * Serialize to JSON with BigInt support: every bigint is written as plain decimal digits, wherever it sits and
 * however large, so a JSON parser that reads integers at full width (the Python client) gets the exact value.
 * Use this for outgoing WebSocket messages and displaying values.
 * @throws TypeError for a value JSON cannot represent at the top level (`undefined`, a function or a symbol)
 */
export function toBigIntAwareJson(value: unknown, spaces?: number): string {
    const marker = uniqueMarker();
    let hasBigint = false;
    // JSON.stringify returns undefined for undefined, a function or a symbol, although its type says string.
    const json: string | undefined = JSON.stringify(
        value,
        (_key, val: unknown) => {
            if (typeof val !== "bigint") return val;
            hasBigint = true;
            return `${marker}${val}`;
        },
        spaces,
    );
    if (json === undefined) {
        throw new TypeError(`Cannot serialize a top-level ${typeof value} to JSON`);
    }
    return hasBigint ? json.replace(new RegExp(`"${marker}(-?\\d+)"`, "g"), "$1") : json;
}

/**
 * Parse JSON with BigInt support for large numbers that exceed JavaScript precision.
 * Integers outside the safe integer range (positive or negative) are converted to BigInt.
 * Use this for incoming WebSocket messages.
 *
 * This function carefully avoids modifying numbers that appear inside string values.
 */
export function parseBigIntAwareJson(json: string): unknown {
    const marker = uniqueMarker();

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

                // Extract the integer part
                const start = i;
                while (i < json.length && json[i] >= "0" && json[i] <= "9") {
                    i++;
                }

                // Check for decimal point (fractional number) or exponent
                let isFloat = false;
                if (i < json.length && json[i] === ".") {
                    isFloat = true;
                    i++; // consume the decimal point
                    while (i < json.length && json[i] >= "0" && json[i] <= "9") {
                        i++;
                    }
                }

                // Check for exponent (e.g., 1e10, 1E-5)
                if (i < json.length && (json[i] === "e" || json[i] === "E")) {
                    isFloat = true;
                    i++; // consume 'e' or 'E'
                    if (i < json.length && (json[i] === "+" || json[i] === "-")) {
                        i++; // consume sign
                    }
                    while (i < json.length && json[i] >= "0" && json[i] <= "9") {
                        i++;
                    }
                }

                const numberStr = (hasMinus ? "-" : "") + json.slice(start, i);

                // Only convert integers (not floats) with 15+ digits that exceed safe integer range
                if (!isFloat && numberStr.length - (hasMinus ? 1 : 0) >= 15) {
                    const num = BigInt(numberStr);
                    if (num > Number.MAX_SAFE_INTEGER || num < Number.MIN_SAFE_INTEGER) {
                        result.push(`"${marker}${numberStr}"`);
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
        if (typeof value === "string" && value.startsWith(marker)) {
            return BigInt(value.slice(marker.length));
        }
        return value;
    });
}
