/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Host time-zone math derived from Node's Intl (full-icu). Pure and dependency-free:
 * inputs are an IANA zone string and timestamps in Unix-epoch milliseconds.
 */

export interface DstWindow {
    /** DST offset in seconds, added on top of the standard offset (typically 3600). */
    offsetSeconds: number;
    /** UTC instant (ms) the DST offset starts applying. */
    validStartingMs: number;
    /** UTC instant (ms) the DST offset stops applying; null for a permanent change. */
    validUntilMs: number | null;
}

const DAY_MS = 86_400_000;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(zone: string): Intl.DateTimeFormat {
    let formatter = formatterCache.get(zone);
    if (formatter === undefined) {
        formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: zone,
            hourCycle: "h23",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
        formatterCache.set(zone, formatter);
    }
    return formatter;
}

export function resolveHostTimeZone(): string {
    return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function offsetSecondsAt(zone: string, atMs: number): number {
    const parts = formatterFor(zone).formatToParts(new Date(atMs));
    const wall: Record<string, number> = {};
    for (const part of parts) {
        if (part.type !== "literal") {
            wall[part.type] = Number(part.value);
        }
    }
    const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
    // formatToParts truncates to whole seconds, so comparing against raw atMs would introduce
    // up to 1s of rounding error whenever atMs isn't second-aligned (e.g. binary-search midpoints).
    const atSecondMs = Math.floor(atMs / 1000) * 1000;
    return Math.round((asUtc - atSecondMs) / 1000);
}

export function standardOffsetSeconds(zone: string, atMs: number): number {
    // Standard (non-DST) offset = the smallest UTC offset over the year starting at atMs.
    // Sampling forward from atMs (not the fixed calendar year) keeps the window inside the
    // current regime, so a past permanent standard-offset change — e.g. a zone abolishing DST
    // mid-year — can't drag in a stale pre-change base. Reverse-DST zones (winter offset below
    // the tzdata "standard") still resolve: the lowest offset is what SetTimeZone must carry,
    // with dstWindows emitting the positive deltas on top.
    let min = offsetSecondsAt(zone, atMs);
    for (let day = 30; day <= 365; day += 30) {
        min = Math.min(min, offsetSecondsAt(zone, atMs + day * DAY_MS));
    }
    return min;
}

function findTransitionInstant(zone: string, beforeMs: number, afterMs: number): number {
    let lo = beforeMs;
    let hi = afterMs;
    const loOffset = offsetSecondsAt(zone, lo);
    // Converge to the exact millisecond: transitions land on whole seconds, and a coarser
    // tolerance leaves `hi` up to ~1s past the boundary, breaking millisecond-exact callers.
    while (hi - lo > 1) {
        const mid = lo + Math.floor((hi - lo) / 2);
        if (offsetSecondsAt(zone, mid) === loOffset) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    return hi;
}

export function dstWindows(zone: string, fromMs: number, max: number): DstWindow[] {
    const windows = new Array<DstWindow>();
    if (max <= 0) {
        return windows;
    }
    const standard = standardOffsetSeconds(zone, fromMs);
    const scanStart = fromMs - 200 * DAY_MS;
    const scanEnd = fromMs + 550 * DAY_MS;

    const transitions = new Array<number>();
    let prev = scanStart;
    let prevOffset = offsetSecondsAt(zone, prev);
    for (let t = scanStart + DAY_MS; t <= scanEnd; t += DAY_MS) {
        const offset = offsetSecondsAt(zone, t);
        if (offset !== prevOffset) {
            transitions.push(findTransitionInstant(zone, prev, t));
            prevOffset = offset;
        }
        prev = t;
    }

    // Emit only segments bounded by two real transitions, so no window has an artificial
    // scan-boundary start or end. Keep windows still in effect at or after fromMs.
    for (let i = 0; i < transitions.length - 1 && windows.length < max; i++) {
        const start = transitions[i];
        const until = transitions[i + 1];
        if (until <= fromMs) {
            continue;
        }
        const offset = offsetSecondsAt(zone, start);
        if (offset > standard) {
            windows.push({ offsetSeconds: offset - standard, validStartingMs: start, validUntilMs: until });
        }
    }
    return windows;
}
