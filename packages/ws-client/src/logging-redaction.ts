/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Field names whose value is a secret wherever it appears under a command's `args`.
 *
 * Judged against request arguments only (checked against `@matter/model`); some names are harmless in
 * responses, which this list never sees. `token` is deliberately absent: the OTA `UpdateToken` and
 * the Channel `PageToken` are handles, not credentials, and are needed to debug failures.
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
 * The secret members of an ICE server (`ICEServerStruct` §11.4.5.3.2, §11.4.5.3.3; webrtc-pc §4.6.2).
 *
 * Masked only directly on an entry of {@link ICE_SERVER_LIST_FIELD}: Door Lock also uses `credential`,
 * for a non-secret `{ credentialType, credentialIndex }` struct.
 */
const ICE_SERVER_SECRET_FIELDS = new Set(["username", "credential"]);

/**
 * The member carrying a list of ICE servers, normalized (`ice_servers`, `ICEServers`, ...).
 *
 * Matched by path, not by a `urls` member, because requests are logged before validation, and an
 * invalid entry without `urls` must still be masked.
 */
const ICE_SERVER_LIST_FIELD = "iceservers";

/**
 * The SDP `a=` lines whose value is a credential: `ice-ufrag` and `ice-pwd` (RFC 5245 §15.4).
 *
 * The rest of the SDP is public and is kept for debugging, including `a=fingerprint` and the ufrag
 * inside `a=candidate`. Case-insensitive because a miss leaks a credential.
 */
const SDP_CREDENTIAL_LINES = /^(a=(?:ice-ufrag|ice-pwd):)[^\r\n]*/gim;

function redactSdp(sdp: string): string {
    return sdp.replace(SDP_CREDENTIAL_LINES, "$1[redacted]");
}

/**
 * Where the walk stops descending. No command nests this deep; see {@link BeyondDepth} for what
 * happens past it. For `args` it masks, so nesting cannot hide a credential.
 */
const MAX_DEPTH = 8;

/**
 * What the walk answers for structure past {@link MAX_DEPTH}: `mask` for caller-supplied `args`,
 * `keep` for incoming messages, whose deep structure (e.g. node attributes) is server-produced.
 */
type BeyondDepth = "mask" | "keep";

/**
 * A field name without case or separators, so `setup_pin_code`, `setupPinCode` and `PINCode` match.
 *
 * Must stay at least as wide as `canonicalKey` (`webRtcProviderArguments.ts`) and `camelize`, or a
 * spelling the server accepts would leak.
 */
function normalize(key: string): string {
    return key.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
}

/** What a rule answers for something it has nothing to say about, so the walk goes on past it. */
const DESCEND = Symbol("descend");

/** What one member of an object logs as, decided by its name and whether it is an ICE server's own. */
type MemberRule = (key: string, value: unknown, iceServer: boolean) => unknown;

/** What one value logs as wherever it sits: a member, an array entry, or the message itself. */
type ValueRule = (value: unknown) => unknown;

/**
 * What one walk masks, and what it answers past its depth bound. A member goes to {@link MemberRule}
 * first and to {@link ValueRule} only if that descends, so a long `sdp` is redacted, not omitted.
 */
interface LogRules {
    member: MemberRule;
    value: ValueRule;
    beyondDepth: BeyondDepth;
}

/** Every masking this module does to a request's `args`. */
function commandMember(key: string, value: unknown, iceServer: boolean): unknown {
    if (SENSITIVE_FIELDS.has(normalize(key))) return "[redacted]";
    return webRtcMember(key, value, iceServer);
}

/** For a walk that judges nothing by the value alone. */
function keepAnyValue(): unknown {
    return DESCEND;
}

/**
 * Strings longer than this are logged as their length (e.g. a `camera_snapshot` frame). Set above
 * every text value a reader needs, such as setup codes, QR payloads and Thread datasets.
 */
const MAX_LOGGED_STRING_LENGTH = 1024;

/** A string past {@link MAX_LOGGED_STRING_LENGTH} logged as its length, and everything else as it is. */
function bulkValue(value: unknown): unknown {
    if (typeof value !== "string" || value.length <= MAX_LOGGED_STRING_LENGTH) return DESCEND;
    return `[${value.length} chars omitted]`;
}

/** The secrets of a WebRTC session, in either direction: a TURN credential, and the ICE credentials in an SDP. */
function webRtcMember(key: string, value: unknown, iceServer: boolean): unknown {
    const name = normalize(key);
    if (iceServer && ICE_SERVER_SECRET_FIELDS.has(name)) return "[redacted]";
    if (name !== "sdp" || typeof value !== "string") return DESCEND;
    return redactSdp(value);
}

/** Copy one member into the result; `defineProperty` so a parsed `__proto__` key is copied, not made the prototype. */
function define(result: Record<string, unknown>, key: string, value: unknown): void {
    Object.defineProperty(result, key, { value, writable: true, enumerable: true, configurable: true });
}

/**
 * `value` with every sensitive field under it masked, or `value` itself when it holds none. Callers
 * compare by identity to learn whether anything was masked.
 */
function redactValue(value: unknown, depth: number, rules: LogRules, iceServer: boolean): unknown {
    const byValue = rules.value(value);
    if (byValue !== DESCEND) return byValue;
    if (typeof value !== "object" || value === null) return value;
    if (depth >= MAX_DEPTH) return rules.beyondDepth === "mask" ? "[redacted]" : value;

    if (Array.isArray(value)) {
        let masked = false;
        const entries = value.map(entry => {
            const redacted = redactValue(entry, depth + 1, rules, iceServer);
            masked ||= redacted !== entry;
            return redacted;
        });
        return masked ? entries : value;
    }

    let masked = false;
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
        const ruled = rules.member(key, entry, iceServer);
        const holdsIceServers = normalize(key) === ICE_SERVER_LIST_FIELD;
        const redacted = ruled === DESCEND ? redactValue(entry, depth + 1, rules, holdsIceServers) : ruled;
        masked ||= redacted !== entry;
        define(result, key, redacted);
    }
    return masked ? result : value;
}

/** A request's `args`: the field-name list, the WebRTC secrets, and a caller's structure bounded. */
const COMMAND_RULES: LogRules = { member: commandMember, value: keepAnyValue, beyondDepth: "mask" };

/** An incoming message: the WebRTC secrets, and bulk content stated by its length. */
const INCOMING_RULES: LogRules = { member: webRtcMember, value: bulkValue, beyondDepth: "keep" };

/**
 * The message as it may be logged: `message` itself when it carries no secret, otherwise a copy with
 * the sensitive fields at any depth under `args` masked. Long strings are kept, since an
 * `import_test_node` dump is needed to debug a refusal.
 */
export function redactSensitiveCommandFields(message: unknown): unknown {
    if (typeof message !== "object" || message === null || !("args" in message)) return message;
    const redacted = redactValue(message.args, 0, COMMAND_RULES, false);
    if (redacted === message.args) return message;

    return { ...message, args: redacted };
}

/**
 * An incoming message as a client may log it: WebRTC session secrets masked and long strings stated
 * by their length, or `message` itself when it carries neither. Rules key on position and value, not
 * on the command, because a response names only its `message_id`.
 */
export function redactIncomingMessage(message: unknown): unknown {
    return redactValue(message, 0, INCOMING_RULES, false);
}
