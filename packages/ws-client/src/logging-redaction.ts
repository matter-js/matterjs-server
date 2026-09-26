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
 * The `a=` lines of an SDP whose value is a credential rather than a published parameter.
 *
 * `ice-ufrag` and `ice-pwd` (RFC 5245 §15.4) are the short-term credential the peer's ICE
 * connectivity checks are authenticated with: anyone holding the pair can answer those checks for
 * the session and take the media path over. The `ufrag` also travels in an `a=candidate` extension,
 * which is left whole: it is the half a peer publishes, and the `pwd` never appears there.
 * Everything else in the offer stays, because the offer
 * is the one thing that makes a failed session readable, and the rest of it is what the peer
 * publishes to its counterpart: `a=fingerprint` is the hash of the certificate the peer presents in
 * the DTLS handshake, which binds that handshake to this offer and is useless without the private
 * key, and it is the first thing anyone reads when the handshake fails.
 *
 * Matched without regard to case because a spelling this misses puts a credential in the log, while
 * a spelling it matches too eagerly only hides a line nobody reads.
 */
const SDP_CREDENTIAL_LINES = /^(a=(?:ice-ufrag|ice-pwd):)[^\r\n]*/gim;

/** `sdp` with the value of every credential-bearing line masked, and every other line intact. */
function redactSdp(sdp: string): string {
    return sdp.replace(SDP_CREDENTIAL_LINES, "$1[redacted]");
}

/**
 * Where the walk stops descending, and starts masking instead.
 *
 * `args` is caller-supplied structure, so the walk needs an end that does not depend on the caller
 * being well behaved. {@link BeyondDepth} states what a walk that is not over `args` does here. Nothing this API defines nests anywhere near this deep, so what is masked here
 * is structure no command sends; a bound that stopped masking instead would answer a caller that
 * buries a credential by nesting it.
 */
const MAX_DEPTH = 8;

/**
 * What the walk answers for structure past {@link MAX_DEPTH}.
 *
 * `mask` for a request's `args`, per the bound's own reasoning. `keep` for a whole incoming message,
 * whose depth is the server's and not a caller's: a `start_listening` result carries every node's
 * attributes, nested structs included, and masking those would take the thing the log is read for
 * away to answer a shape no message has. The bound still ends the recursion there.
 */
type BeyondDepth = "mask" | "keep";

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

/** What a rule answers for something it has nothing to say about, so the walk goes on past it. */
const DESCEND = Symbol("descend");

/** What one member of an object logs as, decided by its name and the names beside it. */
type MemberRule = (key: string, value: unknown, keys: readonly string[]) => unknown;

/** What one value logs as wherever it sits: a member, an array entry, or the message itself. */
type ValueRule = (value: unknown) => unknown;

/**
 * What one walk masks, and what it answers past its depth bound.
 *
 * The rules are what differ between the two entry points; the walk is what they share, so the depth
 * bound, the array handling and the `__proto__`-safe copy are written once and cannot drift. A member
 * is offered to {@link MemberRule} first and to {@link ValueRule} only if that descends, which is what
 * keeps an `sdp` out of a rule on length.
 */
interface LogRules {
    member: MemberRule;
    value: ValueRule;
    beyondDepth: BeyondDepth;
}

/** Every masking this module does to a request's `args`. */
function commandMember(key: string, value: unknown, keys: readonly string[]): unknown {
    if (SENSITIVE_FIELDS.has(normalize(key))) return "[redacted]";
    return webRtcMember(key, value, keys);
}

/** For a walk that judges nothing by the value alone. */
function keepAnyValue(): unknown {
    return DESCEND;
}

/**
 * Where a string stops being a value a reader takes in and becomes bulk.
 *
 * A `camera_snapshot` response carries the whole frame as base64, tens to hundreds of kilobytes of it,
 * which buries every other line of the log; the server keeps it out of its own by naming the command,
 * and a browser console is a worse place for image data still. The bound sits above every value in
 * this API a reader reads as text — a setup code, a QR payload, a Thread dataset, an attribute's
 * octstr — and an offer, which can pass it, is answered by {@link webRtcMember} first and keeps its
 * lines however long it is.
 */
const MAX_LOGGED_STRING_LENGTH = 1024;

/** A string past {@link MAX_LOGGED_STRING_LENGTH} logged as its length, and everything else as it is. */
function bulkValue(value: unknown): unknown {
    if (typeof value !== "string" || value.length <= MAX_LOGGED_STRING_LENGTH) return DESCEND;
    return `[${value.length} chars omitted]`;
}

/**
 * The secrets of a WebRTC session: a TURN credential, and the ICE credentials inside an SDP.
 *
 * Both are matched by shape rather than by name — an ICE server states a URL member, an SDP is a
 * string under `sdp` — so the same rule holds for a message travelling either way, which the field
 * name list does not.
 */
function webRtcMember(key: string, value: unknown, keys: readonly string[]): unknown {
    const name = normalize(key);
    if (ICE_SERVER_SECRET_FIELDS.has(name) && keys.some(other => ICE_SERVER_MARKERS.has(normalize(other)))) {
        return "[redacted]";
    }
    if (name !== "sdp" || typeof value !== "string") return DESCEND;
    return redactSdp(value);
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
function redactValue(value: unknown, depth: number, rules: LogRules): unknown {
    const byValue = rules.value(value);
    if (byValue !== DESCEND) return byValue;
    if (typeof value !== "object" || value === null) return value;
    if (depth >= MAX_DEPTH) return rules.beyondDepth === "mask" ? "[redacted]" : value;

    if (Array.isArray(value)) {
        let masked = false;
        const entries = value.map(entry => {
            const redacted = redactValue(entry, depth + 1, rules);
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
        const ruled = rules.member(key, entry, keys);
        const redacted = ruled === DESCEND ? redactValue(entry, depth + 1, rules) : ruled;
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
 * the sensitive fields under `args` masked.
 *
 * The field names are explicit lists rather than a heuristic, and everything else reaches the log
 * unchanged, because a request the log cannot show is a request nobody can debug. That includes a
 * string of any length: an argument nobody logs is an argument nobody can diagnose, and the one bulk
 * argument this API takes — an `import_test_node` dump — is the whole record of what was refused. They
 * are matched at any depth under `args`: the shapes that carry a secret differ per command — a
 * `device_command` payload object, a list of ICE servers — and a redactor pinned to one of them masks
 * nothing in the next.
 */
export function redactSensitiveCommandFields(message: unknown): unknown {
    if (typeof message !== "object" || message === null || !("args" in message)) return message;
    const redacted = redactValue(message.args, 0, COMMAND_RULES);
    if (redacted === message.args) return message;

    return { ...message, args: redacted };
}

/**
 * `message` as a client may log it — WebRTC session secrets masked and bulk content stated by its
 * length — or `message` itself when it carries neither.
 *
 * For what a client logs on the way in, where {@link redactSensitiveCommandFields} does not apply:
 * that walks a request's `args` and masks a list of field names judged against request arguments
 * alone, and several of those names mean something harmless in a response. A `webrtc_callback` offer
 * carries the camera's own ICE credentials, in the SDP and in `ice_servers`, and a `camera_snapshot`
 * response carries the frame. Both are judged by shape, which is the only thing there is to judge by
 * here: a response states its `message_id` and nothing else about the request, so a rule keyed on the
 * command would mean handing the log the pending-command map the client keeps for its promises — and
 * a list of command names kept in step with the server's.
 */
export function redactIncomingMessage(message: unknown): unknown {
    return redactValue(message, 0, INCOMING_RULES);
}
