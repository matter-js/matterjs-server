/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CameraIceServer } from "@matter-server/ws-client";
import { camelize, InternalError } from "@matter/main";
import type { WebRtcTransportDefinitions } from "@matter/main/clusters";
import type { CommandModel, ValueModel } from "@matter/main/model";
import { ServerError } from "../types/WebSocketMessageTypes.js";
import { fieldRange, ICE_SERVER_LIMITS, providerCommand } from "./cameraFieldRanges.js";
import { isRecord, rejectUnknownKeys, toBoundedString, toRequiredNumber } from "./wireArgumentChecks.js";

/** The `WebRtcTransportProvider` commands `send_webrtc_provider_command` carries a payload for. */
export const PROVIDER_COMMAND_NAMES = ["ProvideOffer", "SolicitOffer"] as const;

export type ProviderCommandName = (typeof PROVIDER_COMMAND_NAMES)[number];

const PROVIDER_COMMAND_NAME_SET: ReadonlySet<string> = new Set(PROVIDER_COMMAND_NAMES);

export function isProviderCommandName(value: string): value is ProviderCommandName {
    return PROVIDER_COMMAND_NAME_SET.has(value);
}

/** Turns one wire value into the value its Matter field encodes as, or refuses it with error 8. */
type FieldConverter = (value: unknown, field: string) => unknown;

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

/** The whole `ice_servers` list, bounded by what the command's own field takes. */
export function toIceServers(value: unknown, field: string): WebRtcTransportDefinitions.IceServer[] {
    if (!Array.isArray(value) || value.length > ICE_SERVER_LIMITS.maxServers) {
        throw ServerError.invalidArguments(
            `${field} must be an array of at most ${ICE_SERVER_LIMITS.maxServers} objects`,
        );
    }
    return value.map((entry, index) => toIceServer(entry, `${field}[${index}]`));
}

/**
 * The provider fields whose wire shape is not the cluster's own, keyed by the matter.js property
 * name of the field they become.
 *
 * Every other field is converted from its own model definition, so this table carries exactly the
 * fields a model cannot describe — today the one struct in the two commands. A struct the table does
 * not name raises in {@link converterFor} rather than reaching the encoder half-built.
 */
const NAMED_FIELD_CONVERTERS = new Map<string, { readonly entryType: string; readonly convert: FieldConverter }>([
    ["iceServers", { entryType: "WebRtcTransportDefinitions.ICEServerStruct", convert: toIceServers }],
]);

/** Server-owned: `establishWebRtcProviderSession` injects the requestor's own endpoint over any value here. */
const ORIGINATING_ENDPOINT_ID = "originatingEndpointId";

/**
 * A field whose constraint states a ceiling is bounded by `toBoundedString`, the same 1-to-max rule
 * the ICE strings follow on both routes. A field that states none takes any string: `sdp` is the only
 * one, and `camera_start_stream` takes it unbounded too.
 */
function stringConverter(field: ValueModel): FieldConverter {
    const { max } = field.constraint;
    if (typeof max === "number") return (value, name) => toBoundedString(value, name, max);
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
            ? `an array of at least ${minLength} entries`
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
 * A struct raises here and a scalar type with no known width raises in `fieldRange`, so a field this
 * cannot describe stops the import instead of being forwarded raw. A struct is the case a model
 * cannot answer at all: its wire spelling is this API's, not the cluster's, so only a named converter
 * states it. The same throw covers a struct reached through a list, because {@link listConverter}
 * converts its entry through here.
 */
function converterFor(field: ValueModel): FieldConverter {
    const named = NAMED_FIELD_CONVERTERS.get(field.propertyName);
    if (named !== undefined) {
        const entryType = field.members.at(0)?.type;
        if (entryType !== named.entryType) {
            throw new InternalError(
                `${field.name} carries ${String(entryType)}, not the ${named.entryType} its converter states`,
            );
        }
        return named.convert;
    }
    switch (field.metabase?.name) {
        case "struct":
            throw new InternalError(`${field.name} carries the struct ${field.type}; name a converter for it`);
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

interface ProviderFieldContract {
    readonly convert: FieldConverter;
    readonly mandatory: boolean;
    readonly nullable: boolean;
}

interface ProviderCommandContract {
    readonly fields: ReadonlyMap<string, ProviderFieldContract>;
    readonly mandatory: readonly string[];
}

function contractFor(name: ProviderCommandName): ProviderCommandContract {
    const command: CommandModel = providerCommand(name);
    const fields = new Map<string, ProviderFieldContract>();
    const mandatory = new Array<string>();
    for (const field of command.children) {
        if (field.propertyName === ORIGINATING_ENDPOINT_ID) continue;
        fields.set(field.propertyName, {
            convert: converterFor(field),
            mandatory: field.mandatory,
            nullable: field.nullable,
        });
        if (field.mandatory) mandatory.push(field.propertyName);
    }
    return { fields, mandatory };
}

/**
 * Both provider commands' contracts, built at module load, so a model this boundary cannot describe
 * fails the import rather than the first offer. The import is the server's, not the camera
 * subsystem's, so such a model stops startup — the same trade `cameraFieldRanges` already takes: a
 * `@matter/model` whose provider commands this code cannot describe is a build mismatch, and a loud
 * start beats a command that fails on a device the operator will blame instead.
 */
const PROVIDER_CONTRACTS: Readonly<Record<ProviderCommandName, ProviderCommandContract>> = {
    ProvideOffer: contractFor("ProvideOffer"),
    SolicitOffer: contractFor("SolicitOffer"),
};

/**
 * A whole `send_webrtc_provider_command` payload as `ProvideOffer` / `SolicitOffer` arguments; the
 * fields `camera_start_stream` takes from its caller reach the same converters through
 * {@link toIceServers}.
 *
 * A key is matched by `camelize`, so the Python Matter Server spelling (`webRtcSessionID`) and the
 * documented snake spelling (`ice_servers`) both resolve to the field they name. A key that resolves
 * to no field, and a second key resolving to a field another already filled, are both refused rather
 * than forwarded or overwritten: matter.js drops what it cannot place, and a caller whose argument
 * was ignored gets the session it did not ask for.
 *
 * `originatingEndpointId` is dropped: the server injects its own requestor endpoint downstream, so a
 * value here is overwritten and validating it would refuse a payload nothing reads.
 */
export function toProviderCommandFields(commandName: ProviderCommandName, payload: unknown): Record<string, unknown> {
    if (!isRecord(payload)) throw ServerError.invalidArguments(`${commandName} payload must be an object`);
    const contract = PROVIDER_CONTRACTS[commandName];
    const fields: Record<string, unknown> = {};
    // Every key the walk has decided about, including one whose null was dropped: a field is stated
    // twice whether or not the first spelling put a value in `fields`.
    const stated = new Set<string>();
    for (const [key, value] of Object.entries(payload)) {
        const name = camelize(key);
        if (name === ORIGINATING_ENDPOINT_ID) continue;
        if (stated.has(name)) {
            throw ServerError.invalidArguments(`${commandName} payload states ${name} twice, last as ${key}`);
        }
        const field = contract.fields.get(name);
        if (field === undefined) {
            throw ServerError.invalidArguments(
                `unknown ${commandName} payload key: ${key}. Keys are matched with case and underscores normalized. Accepted: ${[...contract.fields.keys()].join(", ")}`,
            );
        }
        stated.add(name);
        if (value === null) {
            // A client that sends null for an unset optional field means it unset, not null.
            if (!field.mandatory && !field.nullable) continue;
            if (!field.nullable) throw ServerError.invalidArguments(`${key} must not be null`);
            fields[name] = null;
            continue;
        }
        fields[name] = field.convert(value, key);
    }
    for (const name of contract.mandatory) {
        if (!Object.hasOwn(fields, name)) throw ServerError.invalidArguments(`${commandName} requires ${name}`);
    }
    return fields;
}
