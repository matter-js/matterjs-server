/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `device_command` payload fields that carry a Matter PIN. The wire format encodes them as base64
 * octstr, which is trivially reversible, so logging them verbatim writes the plaintext door PIN to
 * the browser/server console.
 */
const SENSITIVE_PAYLOAD_FIELDS = ["credentialdata", "pincode"];

/**
 * Returns `message` unchanged, or a shallow copy with any {@link SENSITIVE_PAYLOAD_FIELDS} in its
 * `args.payload` replaced by a placeholder — safe to pass to a debug logger on both the client and
 * server side of the same wire message.
 *
 * Keys are matched case-insensitively: the server camelizes every payload member before use, so a
 * client may spell the field `PINCode` (as the Python Matter Server clients do) or `credentialData`.
 */
export function redactSensitiveCommandFields(message: object): object {
    const args = (message as Record<string, unknown>)["args"];
    if (args === null || typeof args !== "object") return message;
    const payload = (args as Record<string, unknown>)["payload"];
    if (payload === null || typeof payload !== "object") return message;
    const payloadRecord = payload as Record<string, unknown>;
    const sensitiveKeys = Object.keys(payloadRecord).filter(key =>
        SENSITIVE_PAYLOAD_FIELDS.includes(key.toLowerCase()),
    );
    if (sensitiveKeys.length === 0) return message;
    const redactedPayload = { ...payloadRecord };
    for (const key of sensitiveKeys) redactedPayload[key] = "[redacted]";
    return {
        ...(message as Record<string, unknown>),
        args: { ...(args as Record<string, unknown>), payload: redactedPayload },
    };
}
