/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseBigIntAwareJson } from "@matter-server/ws-client";

export type ParsedPayload = { ok: true; value: unknown } | { ok: false; error: string };

/**
 * Parse a JSON payload from a developer-facing textarea.
 *
 * Uses {@link parseBigIntAwareJson} so that literals exceeding `Number.MAX_SAFE_INTEGER`
 * round-trip as `bigint` on the wire (matching the rest of the WebSocket client).
 */
export function parseJsonPayload(text: string): ParsedPayload {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
        return { ok: false, error: "Payload must not be empty" };
    }
    try {
        return { ok: true, value: parseBigIntAwareJson(trimmed) };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}
