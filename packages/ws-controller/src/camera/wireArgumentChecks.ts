/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ServerError } from "../types/WebSocketMessageTypes.js";
import type { FieldRange } from "./cameraFieldRanges.js";

/** Arrays are excluded: an argument object's keys are named, and an array's are its indices. */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Every key a caller states is a bound on what it accepts, so a key the server does not know is
 * refused rather than dropped. Dropping it would answer a request nobody made, which is the one
 * thing these commands never do.
 */
export function rejectUnknownKeys(value: object, known: readonly string[], subject: string): void {
    const unknown = Object.keys(value).filter(key => !known.includes(key));
    if (unknown.length > 0) {
        throw ServerError.invalidArguments(
            `unknown ${subject} key: ${unknown.join(", ")}. Accepted: ${known.join(", ")}`,
        );
    }
}

/**
 * Whether `value` is an integer inside the range the Matter field it becomes accepts.
 *
 * The range comes from the cluster's element definition, not from "is it positive": a value past a
 * field's wire width reaches matter.js's TLV encoder and fails there, with an error that names the
 * encoder rather than the argument the client sent.
 */
export function isInRange(value: unknown, range: FieldRange): value is number {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= range.min && value <= range.max;
}

export function rangeText(range: FieldRange): string {
    return `an integer between ${range.min} and ${range.max}`;
}

export function toRequiredNumber(value: unknown, field: string, range: FieldRange): number {
    if (!isInRange(value, range)) throw ServerError.invalidArguments(`${field} must be ${rangeText(range)}`);
    return value;
}

export function toBoundedString(value: unknown, field: string, maxLength: number): string {
    if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
        throw ServerError.invalidArguments(`${field} must be a string of 1 to ${maxLength} characters`);
    }
    return value;
}
