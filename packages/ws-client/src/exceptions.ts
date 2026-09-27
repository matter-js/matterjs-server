/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    CAMERA_NOT_SUPPORTED_ERROR_CODE,
    CAMERA_PRIVACY_MODE_ERROR_CODE,
    CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE,
    CAMERA_STREAM_IN_USE_ERROR_CODE,
    CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE,
    type CameraNotSupportedErrorDetails,
    type CameraPrivacyModeErrorDetails,
    type CameraResourceExhaustedErrorDetails,
    type CameraStreamIncompatibleErrorDetails,
    type CameraStreamIncompatibleReason,
    type CameraStreamInUseErrorDetails,
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

const CODES_WITH_DETAILS: Record<ServerErrorCodeWithDetails, true> = {
    [ICD_MULTI_ADMIN_ERROR_CODE]: true,
    [CAMERA_STREAM_INCOMPATIBLE_ERROR_CODE]: true,
    [CAMERA_RESOURCE_EXHAUSTED_ERROR_CODE]: true,
    [CAMERA_STREAM_IN_USE_ERROR_CODE]: true,
    [CAMERA_NOT_SUPPORTED_ERROR_CODE]: true,
    [CAMERA_PRIVACY_MODE_ERROR_CODE]: true,
};

function parseDetails(
    message: string,
    errorCode: number,
): ServerErrorDetailsByCode[ServerErrorCodeWithDetails] | undefined {
    if (!(errorCode in CODES_WITH_DETAILS)) return undefined;
    try {
        // Trusts the server's shape for the code, as the client does for every command response.
        const parsed = JSON.parse(message);
        return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : undefined;
    } catch {
        return undefined;
    }
}

/** Command failure reported by the server; preserves the wire error_code. */
export class ServerCommandError extends MatterError {
    /**
     * `message` parsed as JSON for a code in {@link ServerErrorDetailsByCode}. Undefined for any other
     * code, or when `message` is not a JSON object. Narrow it by code with {@link hasDetails}.
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
