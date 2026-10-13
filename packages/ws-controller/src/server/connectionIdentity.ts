/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

let logTagCounter = 0;
let ownerCounter = 0n;

/** A four-hex-digit tag for one connection's log lines. It wraps after 0xffff, so never key a resource on it. */
export function nextConnectionLogTag(): string {
    const tag = logTagCounter;
    logTagCounter = (logTagCounter + 1) & 0xffff;
    return tag.toString(16).padStart(4, "0");
}

/**
 * Counted in a `bigint`, so it never repeats: a repeated key would let releasing one connection release
 * another's sessions.
 */
export function nextConnectionOwnerId(): string {
    ownerCounter += 1n;
    return `conn-${ownerCounter}`;
}
