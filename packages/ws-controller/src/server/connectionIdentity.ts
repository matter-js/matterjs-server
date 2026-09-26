/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

let logTagCounter = 0;
let ownerCounter = 0n;

/**
 * A short tag for the log lines of one connection.
 *
 * Always four hex digits, so the tag is one scannable column a human can follow a connection down.
 * It wraps after 0xffff and is therefore not an identity: nothing may key a resource on it.
 */
export function nextConnectionLogTag(): string {
    const tag = logTagCounter;
    logTagCounter = (logTagCounter + 1) & 0xffff;
    return tag.toString(16).padStart(4, "0");
}

/**
 * The key a connection's resources are held under, distinct for every connection this process
 * accepts.
 *
 * It never wraps, so releasing one connection cannot release another's sessions. A `bigint` is what
 * makes that unconditional: a number stops counting at `Number.MAX_SAFE_INTEGER` and would hand the
 * same key to every connection after it.
 */
export function nextConnectionOwnerId(): string {
    ownerCounter += 1n;
    return `conn-${ownerCounter}`;
}
