/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/** Builds the value logged after a message. Called only when the logger writes the line, possibly once per output. */
export type LogDetail = () => unknown;

/**
 * Where the client writes its log lines. `detail` is a function so a logger that drops a level never
 * builds the value, which for an incoming node dump means walking every attribute.
 *
 * A matter.js `Logger` fits as is: it calls a function value only when the level is enabled.
 */
export interface ClientLogger {
    debug(message: string, detail?: LogDetail): void;
    info(message: string, detail?: LogDetail): void;
    warn(message: string, detail?: LogDetail): void;
    error(message: string, detail?: LogDetail): void;
}

function toConsole(write: (...values: unknown[]) => void): (message: string, detail?: LogDetail) => void {
    return (message, detail) => (detail === undefined ? write(message) : write(message, detail()));
}

/**
 * The default {@link ClientLogger}: every line goes to the `console` method of its level. `console`
 * cannot tell whether a level is shown, so the detail is always built.
 */
export const consoleLogger: ClientLogger = {
    debug: toConsole((...values) => console.debug(...values)),
    info: toConsole((...values) => console.info(...values)),
    warn: toConsole((...values) => console.warn(...values)),
    error: toConsole((...values) => console.error(...values)),
};
