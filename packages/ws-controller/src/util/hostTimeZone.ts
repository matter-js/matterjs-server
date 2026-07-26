/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Host time-zone math derived from Node's Intl (full-icu). Pure and dependency-free:
 * inputs are an IANA zone string and timestamps in Unix-epoch milliseconds.
 *
 * The TimeSynchronization cluster splits the local offset into a standard offset (SetTimeZone)
 * plus a DST delta (SetDstOffset). Both halves are derived here from a single scan of the zone's
 * transitions, so they cannot disagree: for every instant a plan covers, the standard offset plus
 * the DST delta the device would pick equals the zone's true offset.
 */

const DAY_MS = 86_400_000;

// Reaches back past the opening transition of a DST period still running at fromMs, so its window
// carries a real starting instant rather than "already in effect" (US periods run 238 days).
const SCAN_BACK_DAYS = 400;
const SCAN_FORWARD_DAYS = 550;
// Probe past the last transition found. Longer than any seasonal cycle, so finding nothing means
// the offset is permanent rather than merely outstaying the scan.
const PROBE_DAYS = 400;

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

function nextTransitionAfter(zone: string, afterMs: number, horizonMs: number): number | null {
    const baseOffset = offsetSecondsAt(zone, afterMs);
    let prev = afterMs;
    for (let t = afterMs + DAY_MS; t <= horizonMs; t += DAY_MS) {
        if (offsetSecondsAt(zone, t) !== baseOffset) {
            return findTransitionInstant(zone, prev, t);
        }
        prev = t;
    }
    return null;
}

export interface OffsetSegment {
    /** Total UTC offset in seconds in effect throughout the segment. */
    offsetSeconds: number;
    /** UTC instant (ms) the segment begins; null when it began before the scanned range. */
    startMs: number | null;
    /** UTC instant (ms) the segment ends; null when it holds past the scanned range. */
    endMs: number | null;
}

/** Constant-offset segments spanning the scanned range around `fromMs`, chronological and gap-free. */
export function offsetSegments(zone: string, fromMs: number): OffsetSegment[] {
    const scanStart = fromMs - SCAN_BACK_DAYS * DAY_MS;
    const scanEnd = fromMs + SCAN_FORWARD_DAYS * DAY_MS;

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

    const segments = new Array<OffsetSegment>();
    let start: number | null = null;
    for (const transition of transitions) {
        segments.push({
            offsetSeconds: offsetSecondsAt(zone, start ?? scanStart),
            startMs: start,
            endMs: transition,
        });
        start = transition;
    }
    segments.push({
        offsetSeconds: offsetSecondsAt(zone, start ?? scanStart),
        startMs: start,
        endMs: start === null ? null : nextTransitionAfter(zone, start, start + PROBE_DAYS * DAY_MS),
    });
    return segments;
}

export interface DstWindow {
    /** Offset in seconds added on top of the plan's standard offset. */
    offsetSeconds: number;
    /**
     * UTC instant (ms) the offset starts applying, or null when it was already in effect before the
     * scanned range began and so has no known start. A window covering `fromMs` normally carries a
     * real instant, since the scan reaches back past the opening transition. Callers push null as
     * the Matter epoch.
     */
    validStartingMs: number | null;
    /** UTC instant (ms) the offset stops applying; null when it never does. */
    validUntilMs: number | null;
}

export interface StandardOffsetRegime {
    /** Standard (non-DST) UTC offset in seconds. */
    offsetSeconds: number;
    /** UTC instant (ms) the regime takes over; null for the one already in effect at `fromMs`. */
    validFromMs: number | null;
}

export interface TimeZonePlan {
    /**
     * Offsets for the cluster's TimeZone list, chronological. Entry 0 is in effect at `fromMs` and
     * always has a null `validFromMs`, as the cluster requires of its first entry.
     */
    regimes: StandardOffsetRegime[];
    /**
     * Deltas on top of the regime in effect at the same instant, chronological and non-overlapping.
     * At most one entry has a null `validUntilMs` and it is last, as SetDstOffset requires.
     */
    dstWindows: DstWindow[];
}

export interface TimeZonePlanLimits {
    /** The node's TimeZoneListMaxSize. The cluster permits 1 or 2. */
    maxRegimes: number;
    /** The node's DSTOffsetListMaxSize. Values below the spec minimum of 1 are raised. */
    maxWindows: number;
}

/**
 * A permanent offset change leaves its previous base behind for good, whereas a seasonal excursion
 * returns to it. Three conditions must hold, and each rejects a distinct false positive:
 *
 * - the trailing segment is open-ended, i.e. the probe found the offset holding indefinitely.
 *   Otherwise "the old base never recurs" may only mean the scan ended mid-cycle, which would make
 *   every zone's last summer in view look like a permanent adoption.
 * - the minimum offset differs across the split, so a seasonal excursion inside one base is skipped.
 * - the earlier minimum never recurs after the split, which rejects a zone that merely happens to be
 *   mid-DST at `fromMs` and so has a higher minimum in its leading segment than in the rest.
 */
function permanentChangeIndex(covered: OffsetSegment[]): number | undefined {
    if (covered[covered.length - 1].endMs !== null) {
        return undefined;
    }
    for (let i = 1; i < covered.length; i++) {
        const before = covered.slice(0, i).map(segment => segment.offsetSeconds);
        const after = covered.slice(i).map(segment => segment.offsetSeconds);
        const beforeMin = Math.min(...before);
        if (beforeMin !== Math.min(...after) && !after.includes(beforeMin)) {
            return i;
        }
    }
    return undefined;
}

/** Deltas a decomposition has to send: one per segment sitting above its own run's base. */
function windowsNeeded(runs: OffsetSegment[][]): number {
    return runs.reduce((total, run) => {
        const base = Math.min(...run.map(segment => segment.offsetSeconds));
        return total + run.filter(segment => segment.offsetSeconds !== base).length;
    }, 0);
}

/** Decompose a zone's upcoming offsets into the standard offsets and DST windows to push. */
export function timeZonePlan(zone: string, fromMs: number, limits: TimeZonePlanLimits): TimeZonePlan {
    const segments = offsetSegments(zone, fromMs);
    const currentIndex = segments.findIndex(
        segment =>
            (segment.startMs === null || segment.startMs <= fromMs) &&
            (segment.endMs === null || segment.endMs > fromMs),
    );
    if (currentIndex < 0) {
        return {
            regimes: [{ offsetSeconds: offsetSecondsAt(zone, fromMs), validFromMs: null }],
            dstWindows: [],
        };
    }

    // Segments before fromMs are excluded so a past permanent change cannot pull the base away from
    // the offset in effect now.
    const covered = segments.slice(currentIndex);
    const windowLimit = Math.max(1, limits.maxWindows);
    // One TimeZone entry can only carry the change as a delta, which the whole-range minimum allows.
    const splitIndex = limits.maxRegimes >= 2 ? permanentChangeIndex(covered) : undefined;

    const runsFor = (index: number | undefined) =>
        index === undefined ? [covered] : [covered.slice(0, index), covered.slice(index)];
    // Splitting gives each run its own base and so can need more deltas than the budget holds, and a
    // dropped delta would leave the node on a base that does not apply yet.
    const runs = windowsNeeded(runsFor(splitIndex)) > windowLimit ? runsFor(undefined) : runsFor(splitIndex);
    const regimes = runs.map((run, index) => ({
        offsetSeconds: Math.min(...run.map(segment => segment.offsetSeconds)),
        validFromMs: index === 0 ? null : run[0].startMs,
    }));

    const dstWindows = new Array<DstWindow>();
    for (const [index, run] of runs.entries()) {
        const standard = regimes[index].offsetSeconds;
        for (const segment of run) {
            if (dstWindows.length >= windowLimit || segment.offsetSeconds === standard) {
                continue;
            }
            dstWindows.push({
                offsetSeconds: segment.offsetSeconds - standard,
                validStartingMs: segment.startMs,
                validUntilMs: segment.endMs,
            });
        }
    }

    // A node whose last window expires drops the whole list and reports no valid local time until
    // the next resync, so spend a spare slot stating that the standard offset then applies alone.
    const last = dstWindows[dstWindows.length - 1];
    if (last !== undefined && last.validUntilMs !== null && dstWindows.length < windowLimit) {
        dstWindows.push({ offsetSeconds: 0, validStartingMs: last.validUntilMs, validUntilMs: null });
    }

    return { regimes, dstWindows };
}

/**
 * The next instant after `fromMs` where the plan changes the offset it reports, or null when it
 * reports the same offset throughout. Bounds that carry an instant are real transitions, so this
 * covers seasonal DST changes and permanent offset changes alike.
 */
export function nextOffsetChangeMs(plan: TimeZonePlan, fromMs: number): number | null {
    let next: number | null = null;
    const boundaries = [
        ...plan.regimes.map(regime => regime.validFromMs),
        ...plan.dstWindows.flatMap(window => [window.validStartingMs, window.validUntilMs]),
    ];
    for (const boundary of boundaries) {
        if (boundary !== null && boundary > fromMs && (next === null || boundary < next)) {
            next = boundary;
        }
    }
    return next;
}
