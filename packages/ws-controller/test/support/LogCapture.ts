/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { LogLevel, Logger } from "@matter/main";

/**
 * Collects the formatted lines a facility logs that match {@link pattern}, at every level, until
 * {@link LogCapture.stop} runs. Call stop from `afterEach` so a failing assertion cannot leave the default
 * destination patched. The lines carry ANSI color codes.
 */
export function captureLogs(facility: string, pattern: RegExp): LogCapture {
    const lines = new Array<string>();
    const destination = Logger.destinations.default;
    const { write, level } = destination;
    destination.write = (text, message) => {
        if (message.facility === facility && pattern.test(text)) {
            lines.push(text);
        }
        write.call(destination, text, message);
    };
    destination.level = LogLevel.DEBUG;
    return {
        lines,
        stop: () => {
            destination.write = write;
            destination.level = level;
        },
    };
}

export interface LogCapture {
    readonly lines: string[];
    stop(): void;
}
