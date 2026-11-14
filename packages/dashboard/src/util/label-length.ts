/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Why this label is too long, or undefined when it fits. Matter string limits count UTF-8 bytes, so a label inside
 * the character count can still be too long.
 */
export function labelLengthError(label: string, maxBytes: number): string | undefined {
    const bytes = new TextEncoder().encode(label).length;
    if (bytes <= maxBytes) return undefined;
    return `The label is ${bytes} bytes long, the maximum is ${maxBytes}; accented and non-Latin characters take more than one byte.`;
}
