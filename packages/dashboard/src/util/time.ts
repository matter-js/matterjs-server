/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/** Matter epoch-s values count seconds since 2000-01-01T00:00:00Z, not the Unix epoch. */
export const MATTER_EPOCH_OFFSET_SECONDS = 946_684_800;

/** Largest value the uint32 epoch-s wire field can carry, i.e. 2136-02-07T06:28:15. */
export const MATTER_EPOCH_MAX_SECONDS = 0xffffffff;

/** Formats a Matter epoch-s instant as a local time, prefixed with the date when it isn't today. */
export function formatEpochTime(matterEpochSeconds: number, relativeTo: Date = new Date()): string {
    const date = new Date((matterEpochSeconds + MATTER_EPOCH_OFFSET_SECONDS) * 1000);
    const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    if (date.toDateString() === relativeTo.toDateString()) return time;
    const tomorrow = new Date(relativeTo);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) return `tomorrow ${time}`;
    const dateOptions: Intl.DateTimeFormatOptions =
        date.getFullYear() === relativeTo.getFullYear()
            ? { month: "2-digit", day: "2-digit" }
            : { year: "numeric", month: "2-digit", day: "2-digit" };
    return `${date.toLocaleDateString(undefined, dateOptions)} ${time}`;
}

/** Formats a Matter epoch-s instant as the value of an `<input type="datetime-local">`, in the viewer's own time zone. */
export function toLocalDateTimeInputValue(matterEpochSeconds: number): string {
    const date = new Date((matterEpochSeconds + MATTER_EPOCH_OFFSET_SECONDS) * 1000);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Reads an `<input type="datetime-local">` value back as a Matter epoch-s instant, or undefined when it
 * is empty or unparsable. The browser reports such values with no time zone, so `new Date(value)` reads
 * it as the viewer's own local time, the same zone `toLocalDateTimeInputValue` formatted it in.
 */
export function fromLocalDateTimeInputValue(value: string): number | undefined {
    if (value.trim() === "") return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return Math.floor(date.getTime() / 1000) - MATTER_EPOCH_OFFSET_SECONDS;
}
