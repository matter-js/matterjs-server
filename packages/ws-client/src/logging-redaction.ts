/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `device_command` payload fields carrying a Matter PIN. The wire form is base64 octstr, which is
 * trivially reversible, so logging one writes the plaintext door PIN to the browser or server console.
 *
 * Matched lower-cased: the server camelizes every payload member before use, so a client may spell the
 * field `PINCode` (as the Python Matter Server clients do) or `pinCode`.
 */
const SENSITIVE_PAYLOAD_FIELDS = new Set(["credentialdata", "pincode"]);

/**
 * The message as it may be logged: `message` itself when it carries no secret, otherwise a copy with
 * the sensitive `args.payload` fields masked.
 */
export function redactSensitiveCommandFields(message: unknown): unknown {
    const { args } = (message ?? {}) as { args?: { payload?: Record<string, unknown> } };
    const payload = args?.payload;
    const secrets = Object.keys(payload ?? {}).filter(key => SENSITIVE_PAYLOAD_FIELDS.has(key.toLowerCase()));
    if (secrets.length === 0) return message;

    return {
        ...(message as object),
        args: {
            ...args,
            payload: { ...payload, ...Object.fromEntries(secrets.map(key => [key, "[redacted]"])) },
        },
    };
}
