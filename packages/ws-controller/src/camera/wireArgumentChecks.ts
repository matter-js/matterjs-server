/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { UINT64_MAX } from "@matter/main";
import { ServerError } from "../types/WebSocketMessageTypes.js";
import type { FieldRange } from "./cameraFieldRanges.js";

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Every key a caller states is a bound: dropping an unknown one would answer a different request. */
export function rejectUnknownKeys(value: object, known: readonly string[], subject: string): void {
    const unknown = Object.keys(value).filter(key => !known.includes(key));
    if (unknown.length > 0) {
        throw ServerError.invalidArguments(
            `unknown ${subject} key: ${unknown.join(", ")}. Accepted: ${known.join(", ")}`,
        );
    }
}

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

/** `NodeId()` validates nothing, so the wire value is checked here. */
export function toNodeIdValue(nodeId: unknown, subject: string): number | bigint {
    if (typeof nodeId !== "number" && typeof nodeId !== "bigint") {
        throw ServerError.invalidArguments(`${subject} requires a numeric or bigint node_id`);
    }
    // parseBigIntAwareJson turns large integer literals into bigint; an unsafe number here lost precision.
    if (typeof nodeId === "number" && !Number.isSafeInteger(nodeId)) {
        throw ServerError.invalidArguments(
            `${subject} requires a numeric node_id to be an integer no greater than ${Number.MAX_SAFE_INTEGER}; state a larger node id as a bigint`,
        );
    }
    if (nodeId < 0 || nodeId > UINT64_MAX) {
        throw ServerError.invalidArguments(`${subject} requires node_id to be between 0 and ${UINT64_MAX}`);
    }
    return nodeId;
}
