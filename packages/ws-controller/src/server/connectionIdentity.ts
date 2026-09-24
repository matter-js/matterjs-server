/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

let logTagCounter = 0;
let ownerCounter = 0;

/**
 * A short tag for the log lines of one connection.
 *
 * Four hex digits, so a human reading a log can follow one connection across lines. It wraps at
 * 0xFFFF and is therefore not an identity: nothing may key a resource on it.
 */
export function nextConnectionLogTag(): string {
    const tag = logTagCounter;
    logTagCounter = (logTagCounter + 1) & 0xffff;
    return tag.toString(16);
}

/**
 * The key a connection's resources are held under, distinct for every connection this process
 * accepts.
 *
 * It never wraps, so releasing one connection cannot release another's sessions. A server reaching
 * `Number.MAX_SAFE_INTEGER` connections would have to accept one every microsecond for close to
 * three centuries.
 */
export function nextConnectionOwnerId(): string {
    ownerCounter += 1;
    return `conn-${ownerCounter}`;
}
