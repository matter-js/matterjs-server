/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    CAMERA_BOUND_FIELDS,
    CAMERA_INCOMPATIBLE_REASONS,
    CAMERA_NOT_SUPPORTED_ERROR_CODE,
    CAMERA_PRIVACY_MODE_ERROR_CODE,
    CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE,
    CAMERA_STREAM_IN_USE_ERROR_CODE,
    CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE,
    type CameraNotSupportedErrorDetails,
    type CameraOccupyingStream,
    type CameraPrivacyMode,
    type CameraPrivacyModeErrorDetails,
    type CameraResourceExhaustedErrorDetails,
    type CameraStreamIncompatibleBound,
    type CameraStreamIncompatibleErrorDetails,
    type CameraStreamIncompatibleReason,
    type CameraStreamInUseErrorDetails,
    type CameraStreamKind,
    ICD_MULTI_ADMIN_ERROR_CODE,
    type IcdMultiAdminErrorDetails,
} from "./models/model.js";

export class MatterError extends Error {}

export class InvalidServerVersion extends MatterError {}

/**
 * Error thrown when a WebSocket command times out waiting for a response.
 */
export class CommandTimeoutError extends MatterError {
    constructor(
        public readonly command: string,
        public readonly timeoutMs: number,
    ) {
        super(`Command '${command}' timed out after ${timeoutMs}ms`);
        this.name = "CommandTimeoutError";
    }
}

/**
 * Error thrown when the WebSocket connection is closed while commands are pending.
 */
export class ConnectionClosedError extends MatterError {
    constructor(message = "Connection closed while command was pending") {
        super(message);
        this.name = "ConnectionClosedError";
    }
}

/** The `details` of each error code whose `details` the server sends as a JSON object, keyed by code. */
export interface ServerErrorDetailsByCode {
    [ICD_MULTI_ADMIN_ERROR_CODE]: IcdMultiAdminErrorDetails;
    [CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE]: CameraStreamIncompatibleErrorDetails;
    [CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE]: CameraResourceExhaustedErrorDetails;
    [CAMERA_STREAM_IN_USE_ERROR_CODE]: CameraStreamInUseErrorDetails;
    [CAMERA_NOT_SUPPORTED_ERROR_CODE]: CameraNotSupportedErrorDetails;
    [CAMERA_PRIVACY_MODE_ERROR_CODE]: CameraPrivacyModeErrorDetails;
}

export type ServerErrorCodeWithDetails = keyof ServerErrorDetailsByCode;

type Guard<T> = (value: unknown) => value is T;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
    return typeof value === "string";
}

function isNumber(value: unknown): value is number {
    return typeof value === "number";
}

function isArrayOf<T>(value: unknown, guard: Guard<T>): value is T[] {
    return Array.isArray(value) && value.every(guard);
}

function isOptional<T>(value: unknown, guard: Guard<T>): value is T | undefined {
    return value === undefined || guard(value);
}

function isOneOf<T extends string>(values: readonly T[]): Guard<T> {
    return (value: unknown): value is T => values.some(entry => entry === value);
}

function isKeyOf<K extends string>(record: Record<K, true>): Guard<K> {
    return (value: unknown): value is K => typeof value === "string" && Object.hasOwn(record, value);
}

const PRIVACY_MODES: Record<CameraPrivacyMode, true> = {
    soft_recording_mode_enabled: true,
    soft_livestream_mode_enabled: true,
    hard_mode_on: true,
};
const STREAM_KINDS: Record<CameraStreamKind, true> = { video: true, audio: true, snapshot: true };

const isPrivacyMode = isKeyOf(PRIVACY_MODES);
const isStreamKind = isKeyOf(STREAM_KINDS);
const isIncompatibleReason = isOneOf(CAMERA_INCOMPATIBLE_REASONS);
const isBoundField = isOneOf(CAMERA_BOUND_FIELDS);
const isTrack = isOneOf(["video", "audio"] as const);

function isBound(value: unknown): value is CameraStreamIncompatibleBound {
    return isRecord(value) && isBoundField(value.field) && isString(value.requested) && isString(value.limit);
}

function isOccupyingStream(value: unknown): value is CameraOccupyingStream {
    return isRecord(value) && isStreamKind(value.kind) && isNumber(value.stream_id) && isNumber(value.reference_count);
}

function isIncompatibleDetails(value: unknown): value is CameraStreamIncompatibleErrorDetails {
    if (
        !isRecord(value) ||
        !isString(value.message) ||
        !isArrayOf(value.device, isString) ||
        !isArrayOf(value.requested, isString) ||
        !isOptional(value.device_status, isNumber) ||
        !isOptional(value.track, isTrack)
    ) {
        return false;
    }
    const reason = value.reason;
    if (!isIncompatibleReason(reason)) return false;
    switch (reason) {
        case "feature":
            return isString(value.feature);
        case "bounds":
            return isOptional(value.bound, isBound);
        default:
            return true;
    }
}

const DETAILS_GUARDS: { [C in ServerErrorCodeWithDetails]: Guard<ServerErrorDetailsByCode[C]> } = {
    [ICD_MULTI_ADMIN_ERROR_CODE]: (value): value is IcdMultiAdminErrorDetails =>
        isRecord(value) && isString(value.message) && isArrayOf(value.admin_vendor_ids, isNumber),
    [CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE]: isIncompatibleDetails,
    [CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE]: (value): value is CameraResourceExhaustedErrorDetails =>
        isRecord(value) &&
        isString(value.message) &&
        isArrayOf(value.allocated, isOccupyingStream) &&
        isOptional(value.max_concurrent_encoders, isNumber) &&
        isOptional(value.max_encoded_pixel_rate, isNumber),
    [CAMERA_STREAM_IN_USE_ERROR_CODE]: (value): value is CameraStreamInUseErrorDetails =>
        isRecord(value) &&
        isString(value.message) &&
        isNumber(value.stream_id) &&
        isOptional(value.reference_count, isNumber),
    [CAMERA_NOT_SUPPORTED_ERROR_CODE]: (value): value is CameraNotSupportedErrorDetails =>
        isRecord(value) && isString(value.message) && isArrayOf(value.missing_clusters, isNumber),
    [CAMERA_PRIVACY_MODE_ERROR_CODE]: (value): value is CameraPrivacyModeErrorDetails =>
        isRecord(value) &&
        isString(value.message) &&
        isArrayOf(value.modes, isPrivacyMode) &&
        isNumber(value.device_status),
};

function isCodeWithDetails(errorCode: number): errorCode is ServerErrorCodeWithDetails {
    return errorCode in DETAILS_GUARDS;
}

function parseDetails(
    message: string,
    errorCode: number,
): ServerErrorDetailsByCode[ServerErrorCodeWithDetails] | undefined {
    if (!isCodeWithDetails(errorCode)) return undefined;
    let parsed: unknown;
    try {
        parsed = JSON.parse(message);
    } catch {
        return undefined;
    }
    const guard: Guard<ServerErrorDetailsByCode[ServerErrorCodeWithDetails]> = DETAILS_GUARDS[errorCode];
    return guard(parsed) ? parsed : undefined;
}

/** Command failure reported by the server; preserves the wire error_code. */
export class ServerCommandError extends MatterError {
    /**
     * `message` parsed as JSON, for a code in {@link ServerErrorDetailsByCode} when it matches that
     * code's type; otherwise undefined. Narrow it by code with {@link hasDetails}.
     */
    readonly details?: ServerErrorDetailsByCode[ServerErrorCodeWithDetails];

    constructor(
        message: string,
        readonly errorCode: number,
    ) {
        super(message);
        this.name = "ServerCommandError";
        this.details = parseDetails(message, errorCode);
    }

    hasDetails<C extends ServerErrorCodeWithDetails>(
        code: C,
    ): this is Omit<ServerCommandError, "details"> & { errorCode: C; details: ServerErrorDetailsByCode[C] } {
        return this.errorCode === code && this.details !== undefined;
    }
}

/**
 * Error 102's details when `error` is that error and states `reason`, typed to that reason's fields;
 * otherwise undefined.
 */
export function cameraStreamIncompatibleDetails<R extends CameraStreamIncompatibleReason>(
    error: unknown,
    reason: R,
): (CameraStreamIncompatibleErrorDetails & { reason: R }) | undefined {
    if (!(error instanceof ServerCommandError) || !error.hasDetails(CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE)) {
        return undefined;
    }
    const { details } = error;
    return hasReason(details, reason) ? details : undefined;
}

function hasReason<R extends CameraStreamIncompatibleReason>(
    details: CameraStreamIncompatibleErrorDetails,
    reason: R,
): details is CameraStreamIncompatibleErrorDetails & { reason: R } {
    return details.reason === reason;
}
