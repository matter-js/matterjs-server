/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CameraIceServer } from "@matter-server/ws-client";
import { InternalError, Logger } from "@matter/main";
import type { WebRtcTransportDefinitions } from "@matter/main/clusters";
import { Conformance } from "@matter/main/model";
import type { CommandModel, ValueModel } from "@matter/main/model";
import { ServerError } from "../types/WebSocketMessageTypes.js";
import { fieldRange, ICE_SERVER_LIMITS, providerCommand } from "./cameraFieldRanges.js";
import { isRecord, rejectUnknownKeys, toBoundedString, toRequiredNumber } from "./wireArgumentChecks.js";

const logger = Logger.get("webRtcProviderArguments");

/**
 * The `WebRtcTransportProvider` commands `send_webrtc_provider_command` carries a payload for.
 *
 * `ProvideOffer` and `SolicitOffer` establish a session; `ProvideIceCandidates` signals for one that
 * exists. The command is on this list because a client needs a checked route for it, not because the
 * server tracks anything for it — {@link establishesWebRtcSession} is what tells the two apart.
 */
export const PROVIDER_COMMAND_NAMES = ["ProvideOffer", "SolicitOffer", "ProvideIceCandidates"] as const;

export type ProviderCommandName = (typeof PROVIDER_COMMAND_NAMES)[number];

const PROVIDER_COMMAND_NAME_SET: ReadonlySet<string> = new Set(PROVIDER_COMMAND_NAMES);

export function isProviderCommandName(value: string): value is ProviderCommandName {
    return PROVIDER_COMMAND_NAME_SET.has(value);
}

/** The commands that create a session, as against signaling for one the camera already holds. */
export type SessionEstablishingCommandName = "ProvideOffer" | "SolicitOffer";

const SESSION_ESTABLISHING: ReadonlySet<string> = new Set<SessionEstablishingCommandName>([
    "ProvideOffer",
    "SolicitOffer",
]);

/**
 * Whether invoking `name` produces a session this server has to complete and track.
 *
 * An establishing command needs the requestor's own endpoint injected, its stream fields reconciled
 * against the camera's cluster revision and the resulting session registered with the local
 * requestor, without which no `webrtc_callback` can be routed for it. `ProvideIceCandidates` needs
 * none of that and creates nothing, so sending it down the establishing path would look for a
 * session id in a response that carries none.
 */
export function establishesWebRtcSession(name: ProviderCommandName): name is SessionEstablishingCommandName {
    return SESSION_ESTABLISHING.has(name);
}

/** Turns one wire value into the value its Matter field encodes as, or refuses it with error 8. */
type FieldConverter = (value: unknown, field: string) => unknown;

/**
 * The form a wire key and the matter.js property it names are compared in.
 *
 * `camelize` cannot answer this: it reads `webrtc_session_id` as one word and returns
 * `webrtcSessionId` where the field is `webRtcSessionId`, and it leaves the W3C `sdpMLineIndex`
 * unchanged where `ICECandidateStruct`'s field is `sdpmLineIndex`. Both spellings are ones this API
 * hands a client — `camera_start_stream` reports `webrtc_session_id`, the `webrtc_callback`
 * `ice_candidates` event emits `sdpMLineIndex` — so matching by `camelize` refused the client's echo
 * of the server's own words. Case and the separators between words are all that separate a
 * documented wire key from the field it names, so they are all this drops.
 *
 * Dropping every separator, not only underscores, is what keeps this wider than `camelize` in every
 * case rather than most: `camelize` splits on dashes, dots and spaces too, and it never adds or
 * removes a letter or a digit, so a key it resolved to a field has the same canonical form as that
 * field.
 */
function canonicalKey(key: string): string {
    return key.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
}

/**
 * The keys one `ice_servers` entry takes, in the W3C `RTCIceServer` spelling the wire uses.
 *
 * Tied to the wire model the same way the hint key sets are: a field added to `CameraIceServer` and
 * not listed here does not compile, rather than being refused although the reference documents it.
 */
const ICE_SERVER_KEY_SET: Record<keyof Required<CameraIceServer>, true> = {
    urls: true,
    username: true,
    credential: true,
    caid: true,
};

const ICE_SERVER_KEYS: readonly string[] = Object.keys(ICE_SERVER_KEY_SET);

/**
 * One wire `ice_servers` entry as the `ICEServerStruct` matter.js encodes.
 *
 * The wire keeps the W3C `RTCIceServer` spelling — `urls`, a single URL or a list of them — while the
 * struct's field is `URLs`, always a list, which matter.js camelizes to `urLs`. Forwarding the wire
 * object unchanged leaves the mandatory field unset and puts a string where a list belongs, so the
 * translation happens here, and an entry whose shape or whose stated lengths are wrong is refused
 * with error 8 instead of failing inside the TLV encoder, where the message names the encoder rather
 * than the argument the client sent.
 *
 * Its keys are the documented ones exactly, not {@link canonicalKey} matches: this entry is not the
 * cluster's struct under another spelling — `urls` may be one string where `URLs` is always a list —
 * so the shape it names is this API's own and has one spelling.
 *
 * @see Matter spec § 11.4.5.3 (ICEServerStruct)
 */
function toIceServer(value: unknown, field: string): WebRtcTransportDefinitions.IceServer {
    if (!isRecord(value)) throw ServerError.invalidArguments(`${field} must be an object`);
    rejectUnknownKeys(value, ICE_SERVER_KEYS, field);
    const { urls, username, credential, caid } = value;
    const urlList = urls === undefined ? [] : Array.isArray(urls) ? urls : [urls];
    if (urlList.length === 0 || urlList.length > ICE_SERVER_LIMITS.maxUrls) {
        throw ServerError.invalidArguments(
            `${field}.urls must name between 1 and ${ICE_SERVER_LIMITS.maxUrls} servers`,
        );
    }
    return {
        urLs: urlList.map((url, index) =>
            toBoundedString(url, `${field}.urls[${index}]`, ICE_SERVER_LIMITS.maxUrlLength),
        ),
        ...(username === undefined
            ? {}
            : { username: toBoundedString(username, `${field}.username`, ICE_SERVER_LIMITS.maxUsernameLength) }),
        ...(credential === undefined
            ? {}
            : {
                  credential: toBoundedString(credential, `${field}.credential`, ICE_SERVER_LIMITS.maxCredentialLength),
              }),
        ...(caid === undefined ? {} : { caid: toRequiredNumber(caid, `${field}.caid`, ICE_SERVER_LIMITS.caid) }),
    };
}

/**
 * The whole `ice_servers` list, bounded by what the command's own field takes.
 *
 * `camera_start_stream` reaches the entries through here and the raw route reaches them through
 * {@link listConverter}, so the refusal is worded as that one words it: the same list refused on two
 * routes must read the same, or the contract a client reads differs by route even where the bound
 * does not.
 */
export function toIceServers(value: unknown, field: string): WebRtcTransportDefinitions.IceServer[] {
    if (!Array.isArray(value) || value.length > ICE_SERVER_LIMITS.maxServers) {
        throw ServerError.invalidArguments(`${field} must be an array of 0 to ${ICE_SERVER_LIMITS.maxServers} entries`);
    }
    return value.map((entry, index) => toIceServer(entry, `${field}[${index}]`));
}

const ICE_SERVER_STRUCT = "WebRtcTransportDefinitions.ICEServerStruct";
const ICE_CANDIDATE_STRUCT = "WebRtcTransportDefinitions.ICECandidateStruct";

/**
 * How each struct these commands carry is built from a wire object, keyed by the struct the model
 * names rather than by the field carrying it, so a field that happens to share a name with another
 * cannot inherit its conversion.
 *
 * A struct absent from here throws in {@link converterFor} at module load. Whether a struct's wire
 * shape is the cluster's under another spelling, or this API's own, is a decision a human makes once
 * for both routes; it is not something a model states.
 */
const STRUCT_CONVERTERS = new Map<string, (entry: ValueModel) => FieldConverter>([
    [ICE_SERVER_STRUCT, () => toIceServer],
    [ICE_CANDIDATE_STRUCT, structConverter],
]);

/** Server-owned: `establishWebRtcProviderSession` injects the requestor's own endpoint over any value here. */
const ORIGINATING_ENDPOINT_ID = canonicalKey("originatingEndpointId");

/**
 * Both ends of the length its own constraint states, and neither invented.
 *
 * A field stating a ceiling keeps the 1-to-max rule `toBoundedString` applies to the ICE strings on
 * both routes. A field stating only a floor — `ICECandidateStruct.SdpMid` is `min 1` — is held to it
 * and nothing more, because an empty string there is one the struct forbids and the camera would be
 * the one to say so. A field stating neither takes any string, `ProvideOffer.sdp` and
 * `ICECandidateStruct.Candidate` among them, which is why a length is never assumed.
 */
function stringConverter(field: ValueModel): FieldConverter {
    const { min, max } = field.constraint;
    if (typeof max === "number") return (value, name) => toBoundedString(value, name, max);
    if (typeof min === "number") {
        return (value, name) => {
            if (typeof value !== "string" || value.length < min) {
                throw ServerError.invalidArguments(`${name} must be a string of at least ${min} characters`);
            }
            return value;
        };
    }
    return (value, name) => {
        if (typeof value !== "string") throw ServerError.invalidArguments(`${name} must be a string`);
        return value;
    };
}

function listConverter(field: ValueModel): FieldConverter {
    const entry = field.members.at(0);
    if (entry === undefined) throw new InternalError(`The Matter model states no entry type for ${field.name}`);
    const convertEntry = converterFor(entry);
    const { min, max } = field.constraint;
    const minLength = typeof min === "number" ? min : 0;
    const maxLength = typeof max === "number" ? max : undefined;
    const expected =
        maxLength === undefined
            ? `an array of ${minLength} or more entries`
            : `an array of ${minLength} to ${maxLength} entries`;
    return (value, name) => {
        if (
            !Array.isArray(value) ||
            value.length < minLength ||
            (maxLength !== undefined && value.length > maxLength)
        ) {
            throw ServerError.invalidArguments(`${name} must be ${expected}`);
        }
        return value.map((item, index) => convertEntry(item, `${name}[${index}]`));
    };
}

/**
 * The conversion `field`'s own definition states.
 *
 * A struct no {@link STRUCT_CONVERTERS} entry names raises here and a scalar type with no known width
 * raises in `fieldRange`, so a field this cannot describe stops the import instead of being forwarded
 * raw. The same throw covers a struct reached through a list, because {@link listConverter} converts
 * its entry through here.
 */
function converterFor(field: ValueModel): FieldConverter {
    switch (field.metabase?.name) {
        case "struct": {
            const build = field.type === undefined ? undefined : STRUCT_CONVERTERS.get(field.type);
            if (build === undefined) {
                throw new InternalError(`${field.name} carries the struct ${field.type}; name a converter for it`);
            }
            return build(field);
        }
        case "list":
            return listConverter(field);
        case "string":
            return stringConverter(field);
        case "bool":
            return (value, name) => {
                if (typeof value !== "boolean") throw ServerError.invalidArguments(`${name} must be a boolean`);
                return value;
            };
        default: {
            const range = fieldRange(field);
            return (value, name) => toRequiredNumber(value, name, range);
        }
    }
}

interface FieldContract {
    readonly property: string;
    readonly convert: FieldConverter;
    readonly mandatory: boolean;
    readonly nullable: boolean;
    /**
     * The canonical keys of the fields whose null this field's conformance is conditioned on, empty
     * for a field whose conformance names no such condition. Read from the command's own contract
     * only; a struct member's conformance names no sibling of the command.
     */
    readonly nullGates: readonly string[];
}

/**
 * The names a conformance names as having to be null for a clause of it to apply.
 *
 * `ProvideOffer` states `StreamUsage` as `WebRTCSessionID == NULL, O`, `MetadataEnabled` as
 * `METADATA & (WebRTCSessionID == NULL)` and `VideoStreams` / `AudioStreams` as
 * `[(Rev >= v2) & (WebRTCSessionID == NULL)].d+, O` (spec § 11.5.6.3). What this reads out is which
 * fields the cluster describes for a request whose named field is null — not whether the field may
 * appear at all, which a trailing `otherwise` clause answers and which nothing here refuses.
 *
 * Only the forms that keep that meaning are descended into: the clause wrappers, `&`, and the
 * comparison itself. Under `!` or `|` a name compared to null says the opposite or says nothing, so
 * such an expression contributes no name rather than one this would read backwards.
 */
function nullComparedNames(ast: Conformance.Ast, into: Set<string>): void {
    switch (ast.type) {
        case Conformance.Special.Otherwise:
            for (const clause of ast.param) nullComparedNames(clause, into);
            return;
        case Conformance.Special.Choice:
            nullComparedNames(ast.param.expr, into);
            return;
        case Conformance.Special.OptionalIf:
            nullComparedNames(ast.param, into);
            return;
        case Conformance.Operator.AND:
            nullComparedNames(ast.param.lhs, into);
            nullComparedNames(ast.param.rhs, into);
            return;
        case Conformance.Operator.EQ: {
            const { lhs, rhs } = ast.param;
            if (lhs.type === Conformance.Special.Name && rhs.type === Conformance.Special.Value && rhs.param === null) {
                into.add(canonicalKey(lhs.param));
            }
            return;
        }
        default:
            return;
    }
}

interface FieldsContract {
    /** Keyed by {@link canonicalKey}, so every documented spelling of a field resolves to it. */
    readonly byKey: ReadonlyMap<string, FieldContract>;
    readonly mandatory: readonly string[];
    readonly accepted: readonly string[];
    /** The canonical key of the field this contract left out, which the walk drops rather than refuses. */
    readonly dropped?: string;
}

/**
 * What a set of model fields accepts from a wire object.
 *
 * Two fields whose canonical keys collide would make one of them unreachable, and the walk would
 * refuse the second spelling as a duplicate of the first, so the model is checked for that here
 * rather than leaving it to be met on a device.
 */
function contractFor(fields: Iterable<ValueModel>, subject: string, skip?: string): FieldsContract {
    const byKey = new Map<string, FieldContract>();
    const mandatory = new Array<string>();
    const accepted = new Array<string>();
    let dropped: string | undefined;
    for (const field of fields) {
        const property = field.propertyName;
        const key = canonicalKey(property);
        if (key === skip) {
            dropped = key;
            continue;
        }
        const clash = byKey.get(key);
        if (clash !== undefined) {
            throw new InternalError(
                `${subject} states ${property} and ${clash.property}, which no wire key can tell apart`,
            );
        }
        const nullGates = new Set<string>();
        nullComparedNames(field.conformance.ast, nullGates);
        byKey.set(key, {
            property,
            convert: converterFor(field),
            mandatory: field.mandatory,
            nullable: field.nullable,
            nullGates: [...nullGates],
        });
        accepted.push(property);
        if (field.mandatory) mandatory.push(property);
    }
    return { byKey, mandatory, accepted, ...(dropped === undefined ? {} : { dropped }) };
}

/** A struct whose wire object is the cluster's own, spelled the way this API's events emit it. */
function structConverter(entry: ValueModel): FieldConverter {
    const contract = contractFor(entry.members, entry.type ?? entry.name);
    return (value, field) => {
        if (!isRecord(value)) throw ServerError.invalidArguments(`${field} must be an object`);
        return toFields(contract, value, field, field);
    };
}

/**
 * One wire object as the fields `contract` describes.
 *
 * A key that resolves to no field, and a second key resolving to a field another already filled, are
 * both refused rather than forwarded or overwritten: matter.js drops what it cannot place, and a
 * caller whose argument was ignored gets the session it did not ask for.
 */
function toFields(
    contract: FieldsContract,
    payload: Record<string, unknown>,
    subject: string,
    keyPrefix?: string,
): Record<string, unknown> {
    const fields: Record<string, unknown> = {};
    // Every key the walk has decided about, including one whose null was dropped: a field is stated
    // twice whether or not the first spelling put a value in `fields`.
    const stated = new Set<string>();
    for (const [key, value] of Object.entries(payload)) {
        const canonical = canonicalKey(key);
        if (canonical === contract.dropped) continue;
        const field = contract.byKey.get(canonical);
        if (field === undefined) {
            throw ServerError.invalidArguments(
                `unknown ${subject} key: ${key}. Keys are matched with case and word separators ignored. Accepted: ${contract.accepted.join(", ")}`,
            );
        }
        if (stated.has(canonical)) {
            throw ServerError.invalidArguments(`${subject} states ${field.property} twice, last as ${key}`);
        }
        stated.add(canonical);
        // A member's refusal names the entry it was in, which is how a client tells which of a
        // list's entries is wrong.
        const named = keyPrefix === undefined ? key : `${keyPrefix}.${key}`;
        if (value === null) {
            // A client that sends null for an unset optional field means it unset, not null.
            if (!field.mandatory && !field.nullable) continue;
            if (!field.nullable) throw ServerError.invalidArguments(`${named} must not be null`);
            fields[field.property] = null;
            continue;
        }
        fields[field.property] = field.convert(value, named);
    }
    for (const property of contract.mandatory) {
        if (!Object.hasOwn(fields, property)) throw ServerError.invalidArguments(`${subject} requires ${property}`);
    }
    return fields;
}

function contractForCommand(name: ProviderCommandName): FieldsContract {
    const command: CommandModel = providerCommand(name);
    return contractFor(command.children, name, ORIGINATING_ENDPOINT_ID);
}

/**
 * Every permitted command's contract, built at module load, so a model this boundary cannot describe
 * fails the import rather than the first offer. The import is the server's, not the camera
 * subsystem's, so such a model stops startup — the same trade `cameraFieldRanges` already takes: a
 * `@matter/model` whose provider commands this code cannot describe is a build mismatch, and a loud
 * start beats a command that fails on a device the operator will blame instead.
 */
const PROVIDER_CONTRACTS: Readonly<Record<ProviderCommandName, FieldsContract>> = {
    ProvideOffer: contractForCommand("ProvideOffer"),
    SolicitOffer: contractForCommand("SolicitOffer"),
    ProvideIceCandidates: contractForCommand("ProvideIceCandidates"),
};

/**
 * A whole `send_webrtc_provider_command` payload as the named command's arguments; the fields
 * `camera_start_stream` takes from its caller reach the same converters through {@link toIceServers}.
 *
 * A key is matched by {@link canonicalKey}, so the Python Matter Server spelling (`webRtcSessionID`),
 * this API's own snake spelling (`webrtc_session_id`, `ice_servers`) and the W3C spelling the
 * `webrtc_callback` events emit (`sdpMLineIndex`) all resolve to the field they name.
 *
 * `originatingEndpointId` is dropped: the server injects its own requestor endpoint downstream, so a
 * value here is overwritten and validating it would refuse a payload nothing reads.
 */
export function toProviderCommandFields(
    commandName: ProviderCommandName,
    payload: unknown,
    target?: string,
): Record<string, unknown> {
    const subject = `${commandName} payload`;
    if (!isRecord(payload)) throw ServerError.invalidArguments(`${subject} must be an object`);
    const contract = PROVIDER_CONTRACTS[commandName];
    const fields = toFields(contract, payload, subject);
    reportFieldsPastTheirGate(commandName, contract, fields, target);
    return fields;
}

/**
 * Log the fields a request states although the cluster describes them for a new session only.
 *
 * A `ProvideOffer` naming an existing `WebRTCSessionID` is a re-offer, and the provider's Effect on
 * Receipt runs its whole stream-selection block under `WebRTCSessionID` being null (§ 11.5.6.3), so
 * `VideoStreams`, `AudioStreams`, `StreamUsage` and `MetadataEnabled` change nothing there.
 *
 * None of them is refused, and the camera is what decides: three of the four end their conformance in
 * a clause that leaves them optional whatever the session id, so refusing those would state a rule the
 * cluster does not. `MetadataEnabled` is the one that does not (`METADATA & (WebRTCSessionID ==
 * NULL)`, so a re-offer states a field that does not apply) — it is still forwarded, because what a
 * device does with a field it did not ask for is the device's answer to give. The log is the only
 * place the mismatch is visible, since the response says nothing about a field the camera ignored.
 */
function reportFieldsPastTheirGate(
    commandName: ProviderCommandName,
    contract: FieldsContract,
    fields: Record<string, unknown>,
    target?: string,
): void {
    for (const [gateKey, gate] of contract.byKey) {
        const gateValue = fields[gate.property];
        if (gateValue === undefined || gateValue === null) continue;
        const stated = new Array<string>();
        for (const field of contract.byKey.values()) {
            if (field.nullGates.includes(gateKey) && Object.hasOwn(fields, field.property)) {
                stated.push(field.property);
            }
        }
        if (stated.length === 0) continue;
        const them = stated.length === 1 ? "it" : "them";
        logger.warn(
            `${commandName}${target === undefined ? "" : ` for ${target}`} states ${stated.join(", ")} while ` +
                `${gate.property} is ${String(gateValue)}. The cluster describes ${them} for a request whose ` +
                `${gate.property} is null, so the camera may ignore ${them}; this boundary does not change ${them}.`,
        );
    }
}
