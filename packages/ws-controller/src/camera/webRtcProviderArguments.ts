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
 * The `WebRtcTransportProvider` commands this boundary converts a payload for. `EndSession` is absent
 * on purpose: `camera_stop_stream` owns it, so the server's session records end with it.
 */
export const PROVIDER_COMMAND_NAMES = [
    "ProvideOffer",
    "SolicitOffer",
    "ProvideAnswer",
    "ProvideIceCandidates",
] as const;

export type ProviderCommandName = (typeof PROVIDER_COMMAND_NAMES)[number];

const PROVIDER_COMMAND_NAME_SET: ReadonlySet<string> = new Set(PROVIDER_COMMAND_NAMES);

export function isProviderCommandName(value: string): value is ProviderCommandName {
    return PROVIDER_COMMAND_NAME_SET.has(value);
}

/** The commands that create a session, as against signaling for one the camera already holds. */
export type SessionEstablishingCommandName = "ProvideOffer" | "SolicitOffer";

/** The commands that signal into a session the camera already holds; neither has a response payload. */
export type SignallingCommandName = Exclude<ProviderCommandName, SessionEstablishingCommandName>;

const SESSION_ESTABLISHING: ReadonlySet<string> = new Set<SessionEstablishingCommandName>([
    "ProvideOffer",
    "SolicitOffer",
]);

/**
 * Whether invoking `name` produces a session this server has to complete and track (originating
 * endpoint injected, stream fields reconciled, session registered with the local requestor).
 */
export function establishesWebRtcSession(name: ProviderCommandName): name is SessionEstablishingCommandName {
    return SESSION_ESTABLISHING.has(name);
}

/** Turns one wire value into the value its Matter field encodes as, or refuses it with error 8. */
type FieldConverter = (value: unknown, field: string) => unknown;

/**
 * The form a wire key and the matter.js property it names are compared in: case and separators
 * dropped, so `webrtc_session_id` matches `webRtcSessionId` and `sdpMLineIndex` matches `sdpmLineIndex`.
 */
function canonicalKey(key: string): string {
    return key.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
}

/** The keys one `ice_servers` entry takes, in the W3C `RTCIceServer` spelling the wire uses. */
const ICE_SERVER_KEY_SET: Record<keyof Required<CameraIceServer>, true> = {
    urls: true,
    username: true,
    credential: true,
    caid: true,
};

const ICE_SERVER_KEYS: readonly string[] = Object.keys(ICE_SERVER_KEY_SET);

/**
 * One wire `ice_servers` entry (W3C `RTCIceServer`: `urls` is one URL or a list) as the `ICEServerStruct`
 * matter.js encodes (`urLs`, always a list). Keys are matched exactly, not by {@link canonicalKey}.
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
 * The whole `ice_servers` list, bounded by what the command's own field takes. Keep the refusal text in
 * line with {@link listConverter}, which the raw route uses for the same list.
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
 * How each struct these commands carry is built from a wire object, keyed by struct type. A struct
 * missing here throws in {@link converterFor} at module load.
 */
const STRUCT_CONVERTERS = new Map<string, (entry: ValueModel) => FieldConverter>([
    [ICE_SERVER_STRUCT, () => toIceServer],
    [ICE_CANDIDATE_STRUCT, structConverter],
]);

/** Server-owned: `establishWebRtcProviderSession` injects the requestor's own endpoint over any value here. */
const ORIGINATING_ENDPOINT_ID = canonicalKey("originatingEndpointId");

/** A string checked against only the length bounds its own constraint states. */
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

/** The conversion `field`'s own definition states. Throws for a field it cannot describe, which stops the import. */
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
    /** Canonical keys of the fields whose null this field's conformance is conditioned on. */
    readonly nullGates: readonly string[];
}

/**
 * The names a conformance requires to be null for a clause of it to apply, e.g. `ProvideOffer.StreamUsage`
 * is `WebRTCSessionID == NULL, O` (§ 11.5.6.3). Does not descend into `!` or `|`, where the meaning
 * would invert or vanish.
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

/** What a set of model fields accepts from a wire object. Throws if two fields share a canonical key. */
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

/** One wire object as the fields `contract` describes. Unknown and duplicate keys are refused. */
function toFields(
    contract: FieldsContract,
    payload: Record<string, unknown>,
    subject: string,
    keyPrefix?: string,
): Record<string, unknown> {
    const fields: Record<string, unknown> = {};
    // Includes keys whose null was dropped, so a duplicate is caught even then.
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
        const named = keyPrefix === undefined ? key : `${keyPrefix}.${key}`;
        if (value === null) {
            // null on a non-nullable optional field means "unset".
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

/** Built at module load, so a Matter model this boundary cannot describe stops server startup. */
const PROVIDER_CONTRACTS: Readonly<Record<ProviderCommandName, FieldsContract>> = {
    ProvideOffer: contractForCommand("ProvideOffer"),
    SolicitOffer: contractForCommand("SolicitOffer"),
    ProvideAnswer: contractForCommand("ProvideAnswer"),
    ProvideIceCandidates: contractForCommand("ProvideIceCandidates"),
};

/**
 * A provider command payload as the named command's arguments. Keys are matched by {@link canonicalKey}.
 * `originatingEndpointId` is dropped, because the server injects its own requestor endpoint.
 *
 * `target` names the device in logs. `subjectName` names what a refusal is about; defaults to
 * "<command> payload".
 */
export function toProviderCommandFields(
    commandName: ProviderCommandName,
    payload: unknown,
    target?: string,
    subjectName?: string,
): Record<string, unknown> {
    const subject = subjectName ?? `${commandName} payload`;
    if (!isRecord(payload)) throw ServerError.invalidArguments(`${subject} must be an object`);
    const contract = PROVIDER_CONTRACTS[commandName];
    const fields = toFields(contract, payload, subject);
    reportFieldsPastTheirGate(commandName, contract, fields, target);
    return fields;
}

/**
 * Log the fields a request states although the cluster describes them for a new session only (a
 * re-offer ignores them, § 11.5.6.3). They are forwarded, not refused: the camera decides.
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
