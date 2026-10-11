/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommissionFailureReason } from "./models/model.js";

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

/** Command failure reported by the server; preserves the wire error_code and the typed failure details. */
export class ServerCommandError extends MatterError {
    /** The Matter status the device answered with, when the failure is one. */
    readonly status?: number;
    readonly clusterStatus?: number;
    /** Why commissioning failed, for `commission_with_code` and `commission_on_network`. */
    readonly reason?: CommissionFailureReason;

    constructor(
        message: string,
        readonly errorCode: number,
        details: { status?: number; clusterStatus?: number; reason?: CommissionFailureReason } = {},
    ) {
        super(message);
        this.name = "ServerCommandError";
        this.status = details.status;
        this.clusterStatus = details.clusterStatus;
        this.reason = details.reason;
    }
}
