/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Field names whose value is a secret wherever it appears under a command's `args`.
 *
 * Only request arguments are ever walked, so the list is judged against those alone: every entry is
 * a name that carries nothing but secret material in this API's own arguments and in the Matter
 * commands a `device_command` payload reaches. Several of them name something harmless in a
 * *response* — `Credentials` on `DoorLock.GetUserResponse` is a `{credentialType, credentialIndex}`
 * list — and that is not a contradiction, because no response passes through here. It also means
 * this list protects nothing on the way back; a response that carries a secret has to be kept out
 * of the log by its command name instead.
 *
 * The list was checked against `@matter/model` rather than read off the names. `token` is
 * deliberately absent — the OTA `UpdateToken` and the Channel `PageToken` are handles rather than
 * credentials, and they are what an OTA or paging failure is read from.
 *
 * - Commissioning: `code` and `setup_pin_code` are the device passcode or a payload carrying it;
 *   `pakePasscodeVerifier` is derived from one and opens a commissioning window by itself.
 * - Network credentials: `credentials` is the Wi-Fi PSK, on `set_wifi_credentials` and on Network
 *   Commissioning's `AddOrUpdateWiFiNetwork`. `dataset`, `operationalDataset`, `activeDataset` and
 *   `pendingDataset` are Thread operational datasets, which carry the network key.
 * - Key material: `key`, `verificationKey`, `signingKey`, `groupResolvingKey`, `enableKey`,
 *   `epochKey0`-`2` and `ipkValue`, on ICD Management, Groupcast, Door Lock Aliro, General
 *   Diagnostics, Group Key Management and Operational Credentials.
 * - PINs: `credentialData` and `pinCode` (Door Lock), `oldPin` / `newPin` (Content Control) and
 *   `setupPin` (Account Login). The wire form is base64 octstr, which is trivially reversible.
 */
const SENSITIVE_FIELDS = new Set([
    "code",
    "setuppincode",
    "pakepasscodeverifier",
    "credentials",
    "dataset",
    "operationaldataset",
    "activedataset",
    "pendingdataset",
    "key",
    "verificationkey",
    "signingkey",
    "groupresolvingkey",
    "enablekey",
    "epochkey0",
    "epochkey1",
    "epochkey2",
    "ipkvalue",
    "credentialdata",
    "pincode",
    "oldpin",
    "newpin",
    "setuppin",
]);

/**
 * The two secret-bearing members of an ICE server — Matter's `ICEServerStruct` §11.4.5.3.2 and
 * §11.4.5.3.3, which are the WebRTC `RTCIceServer` members of the same names (webrtc-pc §4.6.2).
 * `camera_start_stream` takes a list of them as `ice_servers`. A TURN credential is a shared secret
 * or a time-limited REST token, and the username is the other half of the pair.
 *
 * Masked only beside a URL member, because `credential` is a member name the Door Lock cluster uses
 * as well, for a `{ credentialType, credentialIndex }` struct that is no secret and is worth reading
 * in a log. Nothing validates `ice_servers` before it is logged, so the URL member is read as a hint
 * about the shape and not as an invariant: an entry that carries the pair under some other spelling
 * is logged unmasked, which is why both spellings a caller may send are listed.
 */
const ICE_SERVER_SECRET_FIELDS = new Set(["username", "credential"]);

/**
 * What marks an object as an ICE server rather than something else carrying a `credential`.
 *
 * `urls` is the Matter member (§11.4.5.3.1) and the current WebRTC one; `url` is the older singular
 * spelling that WebRTC clients still emit, and a caller that sends it sends the same secrets.
 */
const ICE_SERVER_MARKERS = new Set(["urls", "url"]);

/**
 * Where the walk stops descending, and starts masking instead.
 *
 * `args` is caller-supplied structure, so the walk needs an end that does not depend on the caller
 * being well behaved. Nothing this API defines nests anywhere near this deep, so what is masked here
 * is structure no command sends; a bound that stopped masking instead would answer a caller that
 * buries a credential by nesting it.
 */
const MAX_DEPTH = 8;

/**
 * A field name in the single spelling the lists above are written in.
 *
 * The walk sees the request exactly as the client sent it, and clients disagree on how to spell a
 * field: `setup_pin_code` beside `setupPinCode`, `pinCode` beside the `PINCode` the Python Matter
 * Server clients send. Dropping case and underscores makes one list entry cover all of them.
 */
function normalize(key: string): string {
    return key.toLowerCase().replaceAll("_", "");
}

/** Whether `key` names a secret in an object whose members are `keys`. */
function isSensitive(key: string, keys: string[]): boolean {
    const name = normalize(key);
    if (SENSITIVE_FIELDS.has(name)) return true;
    return ICE_SERVER_SECRET_FIELDS.has(name) && keys.some(other => ICE_SERVER_MARKERS.has(normalize(other)));
}

/**
 * Copy one member into the result.
 *
 * `__proto__` survives `JSON.parse` as an own enumerable member, and assigning to it would reach
 * `Object.prototype`'s setter instead: the member would be missing from the logged copy and that
 * copy's prototype would be whatever the caller sent.
 */
function define(result: Record<string, unknown>, key: string, value: unknown): void {
    Object.defineProperty(result, key, { value, writable: true, enumerable: true, configurable: true });
}

/**
 * `value` with every sensitive field under it masked, or `value` itself when it holds none.
 *
 * Returning the input unchanged is what lets the caller keep the original message, and it is how
 * each level tells its parent whether anything below it was masked.
 */
function redactValue(value: unknown, depth: number): unknown {
    if (typeof value !== "object" || value === null) return value;
    if (depth >= MAX_DEPTH) return "[redacted]";

    if (Array.isArray(value)) {
        let masked = false;
        const entries = value.map(entry => {
            const redacted = redactValue(entry, depth + 1);
            masked ||= redacted !== entry;
            return redacted;
        });
        return masked ? entries : value;
    }

    let masked = false;
    const result: Record<string, unknown> = {};
    const entries = Object.entries(value);
    const keys = entries.map(([key]) => key);
    for (const [key, entry] of entries) {
        if (isSensitive(key, keys)) {
            define(result, key, "[redacted]");
            masked = true;
            continue;
        }
        const redacted = redactValue(entry, depth + 1);
        masked ||= redacted !== entry;
        define(result, key, redacted);
    }
    return masked ? result : value;
}

/**
 * The message as it may be logged: `message` itself when it carries no secret, otherwise a copy with
 * the sensitive fields under `args` masked.
 *
 * The field names are explicit lists rather than a heuristic, and everything else reaches the log
 * unchanged, because a request the log cannot show is a request nobody can debug. They are matched
 * at any depth under `args`: the shapes that carry a secret differ per command — a `device_command`
 * payload object, a list of ICE servers — and a redactor pinned to one of them masks nothing in the
 * next.
 */
export function redactSensitiveCommandFields(message: unknown): unknown {
    if (typeof message !== "object" || message === null || !("args" in message)) return message;
    const redacted = redactValue(message.args, 0);
    if (redacted === message.args) return message;

    return { ...message, args: redacted };
}
