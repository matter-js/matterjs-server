/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

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
