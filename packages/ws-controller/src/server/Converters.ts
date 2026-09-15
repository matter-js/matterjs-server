/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { matterNameToWireField } from "@matter-server/ws-client";
import { AttributeId, Bytes, camelize, ClusterId, isObject, Logger } from "@matter/main";
import { ClusterModel, FieldModel, FieldValue, ValueModel } from "@matter/main/model";
import { EndpointNumber, MATTER_EPOCH_OFFSET_S, MATTER_EPOCH_OFFSET_US } from "@matter/main/types";

const logger = new Logger("ChipToolWebSocketHandler");

/** Convert stringified numbers in hex and normal style to either number or bigint. */
export function parseNumber(number: string): number | bigint {
    const parsed = number.startsWith("0x") ? BigInt(number) : parseInt(number);
    if (typeof parsed === "number" && isNaN(parsed)) {
        throw new Error(`Failed to parse number: ${number}`);
    }
    return parsed;
}

/**
 * Bit positions are always small integers, but matter.js types constraint values as `number | bigint`
 * because the same accessor serves 64-bit value constraints. Callers apply the result with 32-bit
 * bitwise operators, so a future map64 bitmap needs more than this coercion.
 */
function bitPosition(value: FieldValue.Open | undefined): number | undefined {
    const numeric = FieldValue.numericValue(value);
    return numeric === undefined ? undefined : Number(numeric);
}

function convertWebSocketGenericToMatter(value: unknown, model: ValueModel, clusterModel: ClusterModel): unknown {
    // Handle bitmaps - convert number to object with boolean flags
    if (typeof value === "number" && model.metabase?.metatype === "bitmap") {
        const bitmapValue: { [key: string]: boolean | number } = {};

        for (const member of getBitmapMembers(model, clusterModel)) {
            const memberName =
                member.name !== undefined && model.name !== "FeatureMap"
                    ? member.propertyName
                    : member.title !== undefined
                      ? camelize(member.title)
                      : undefined;

            if (memberName === undefined) {
                continue;
            }

            const constraintValue = bitPosition(member.constraint.value);
            if (constraintValue !== undefined) {
                // Single bit - extract as boolean
                bitmapValue[memberName] = (value & (1 << constraintValue)) !== 0;
            } else {
                const minBit = bitPosition(member.constraint.min) ?? 0;
                const maxBit = bitPosition(member.constraint.max);
                if (maxBit !== undefined) {
                    // Multi-bit field - extract value
                    const mask = ((1 << (maxBit - minBit + 1)) - 1) << minBit;
                    bitmapValue[memberName] = (value & mask) >> minBit;
                } else {
                    // Single bit at minBit position
                    bitmapValue[memberName] = (value & (1 << minBit)) !== 0;
                }
            }
        }

        return bitmapValue;
    }

    // Handle bytes - convert base64 string to Uint8Array
    if (typeof value === "string" && model.metabase?.metatype === "bytes") {
        return Bytes.fromBase64(value);
    }

    // Handle epoch timestamps - convert from Unix timestamps to Matter epoch
    if (model.metabase?.metatype === "integer") {
        if (model.type === "epoch-s" && typeof value === "number") {
            return value + MATTER_EPOCH_OFFSET_S;
        } else if (model.type === "epoch-us" && (typeof value === "number" || typeof value === "bigint")) {
            return BigInt(value) + MATTER_EPOCH_OFFSET_US;
        }
    }

    // Return primitives as-is
    return value;
}

/**
 * Converts tag-based WebSocket data (with numeric keys) back to Matter.js data format (with camelCased names).
 * This is the reverse of convertMatterToWebSocketTagBased.
 */
export function convertWebSocketTagBasedToMatter(
    value: unknown,
    model: ValueModel | undefined,
    clusterModel: ClusterModel,
): unknown {
    if (model === undefined || value === null) {
        return value; // Return null/undefined values as-is
    }

    // Handle lists
    if (Array.isArray(value) && model.type === "list") {
        const memberModel = model.members.at(0);
        return value.map(v => convertWebSocketTagBasedToMatter(v, memberModel, clusterModel));
    }

    // Handle structs - convert numeric keys to camelCased member names
    if (isObject(value) && model.metabase?.name === "struct") {
        const valueKeys = Object.keys(value);
        const result: { [key: string]: unknown } = {};

        const memberById = getStructMembersById(model);
        // Python clients before matter-server 1.3.0 serialized struct fields by wire field name
        // (e.g. "presetHandle") instead of TLV tag, so unrecognized non-numeric keys are resolved
        // against the same name that convertMatterToWebSocketNameBased emits.
        const memberByWireName = getStructMembersByWireFieldName(model, clusterModel);
        for (const key of valueKeys) {
            const isTag = /^\d+$/.test(key);
            const member = isTag ? memberById.get(parseInt(key)) : memberByWireName.get(key);
            if (member !== undefined) {
                // Old Python clients send null for unset optional fields instead of omitting them.
                if (value[key] === null && !member.mandatory && !member.nullable) {
                    continue;
                }
                result[member.propertyName] = convertWebSocketTagBasedToMatter(value[key], member, clusterModel);
            } else {
                // Keep unknown keys as-is (fallback for unknown attributes)
                result[key] = value[key];
            }
        }
        return result;
    }

    return convertWebSocketGenericToMatter(value, model, clusterModel);
}

/**
 * Converts camelized name-based WebSocket data to Matter.js data format. Mainly to ensure binary and epoch data
 */
export function convertCommandDataToMatter(
    value: unknown,
    model: ValueModel | undefined,
    clusterModel: ClusterModel,
): unknown {
    if (model === undefined || value === null) {
        return value; // Return null/undefined values as-is
    }

    // Handle lists
    if (Array.isArray(value) && model.type === "list") {
        const memberModel = model.members.at(0);
        return value.map(v => convertCommandDataToMatter(v, memberModel, clusterModel));
    }

    // Handle structs - convert numeric keys to camelCased member names
    if (isObject(value) && model.metabase?.name === "struct") {
        const valueKeys = Object.keys(value);
        const result: { [key: string]: unknown } = {};

        const memberByName = getStructMembersByPropertyName(model);
        for (const key of valueKeys) {
            // Camelize the key to normalize PascalCase from Python CHIP SDK (e.g. DSTOffset -> dstOffset)
            const camelizedKey = camelize(key);
            const member = memberByName.get(camelizedKey);
            if (member !== undefined) {
                // Treat null for optional non-nullable fields as omitted (e.g. PINCode: null).
                // This preserves compatibility with clients that send null instead of omitting the field.
                if (value[key] === null && !member.mandatory && !member.nullable) {
                    continue;
                }
                result[camelizedKey] = convertCommandDataToMatter(value[key], member, clusterModel);
            } else {
                // Keep unknown keys as-is (fallback for unknown attributes)
                result[key] = value[key];
            }
        }
        return result;
    }

    return convertWebSocketGenericToMatter(value, model, clusterModel);
}

/**
 * Model conversion kinds, classified once per ValueModel and cached for fast dispatch.
 */
const enum ConvKind {
    Passthrough,
    EpochS,
    EpochUS,
    Bytes,
    Bitmap,
    Struct,
    List,
}

/** Primitive `typeof` results that pass through unchanged for schema-less (unknown) attributes. */
const PRIMITIVE_TYPEOF = new Set(["string", "number", "bigint", "boolean", "undefined"]);

/** Cached model-to-kind classification. Avoids repeated metabase property traversal. */
const modelKindCache = new WeakMap<ValueModel, ConvKind>();

/** Precomputed struct member info: avoids camelize() on every conversion. */
type StructMemberEntry = {
    readonly name: string;
    readonly rawName: string;
    readonly id: number;
    readonly model: ValueModel;
};
const structMemberCache = new WeakMap<ValueModel, StructMemberEntry[]>();

/**
 * Cached bitmap member resolution. Unlike struct members (intrinsic to the model), bitmap bit
 * fields resolve via the cluster scope, so the cache is keyed by clusterModel first, then model.
 */
const bitmapMemberCache = new WeakMap<ClusterModel, WeakMap<ValueModel, FieldModel[]>>();

function classifyModel(model: ValueModel): ConvKind {
    let kind = modelKindCache.get(model);
    if (kind !== undefined) return kind;

    if (model.type === "list") {
        kind = ConvKind.List;
    } else if (model.metabase?.name === "struct") {
        kind = ConvKind.Struct;
    } else if (model.metabase?.metatype === "bitmap") {
        kind = ConvKind.Bitmap;
    } else if (model.metabase?.metatype === "bytes") {
        kind = ConvKind.Bytes;
    } else if (model.metabase?.metatype === "integer") {
        kind =
            model.type === "epoch-s"
                ? ConvKind.EpochS
                : model.type === "epoch-us"
                  ? ConvKind.EpochUS
                  : ConvKind.Passthrough;
    } else {
        kind = ConvKind.Passthrough;
    }

    modelKindCache.set(model, kind);
    return kind;
}

function getStructMembers(model: ValueModel): StructMemberEntry[] {
    let members = structMemberCache.get(model);
    if (members !== undefined) return members;

    members = [];
    for (const member of model.members) {
        if (member.name !== undefined && member.id !== undefined) {
            members.push({ name: member.propertyName, rawName: member.name, id: member.id, model: member });
        }
    }
    structMemberCache.set(model, members);
    return members;
}

/**
 * Struct member lookups for the incoming (WebSocket/legacy -> Matter) converters, cached per model so
 * bulk conversions (e.g. legacy data migration) don't rebuild the map for every struct value.
 */
const structMembersByIdCache = new WeakMap<ValueModel, Map<number, ValueModel>>();
const structMembersByPropertyNameCache = new WeakMap<ValueModel, Map<string, ValueModel>>();
const structMembersByLowerNameCache = new WeakMap<ValueModel, Map<string, ValueModel>>();

function getStructMembersById(model: ValueModel): Map<number, ValueModel> {
    let members = structMembersByIdCache.get(model);
    if (members !== undefined) return members;

    members = new Map();
    for (const member of model.members) {
        if (member.id !== undefined) members.set(member.id, member);
    }
    structMembersByIdCache.set(model, members);
    return members;
}

function getStructMembersByPropertyName(model: ValueModel): Map<string, ValueModel> {
    let members = structMembersByPropertyNameCache.get(model);
    if (members !== undefined) return members;

    members = new Map();
    for (const member of model.members) {
        if (member.name !== undefined) members.set(member.propertyName, member);
    }
    structMembersByPropertyNameCache.set(model, members);
    return members;
}

function getStructMembersByLowerName(model: ValueModel): Map<string, ValueModel> {
    let members = structMembersByLowerNameCache.get(model);
    if (members !== undefined) return members;

    members = new Map();
    for (const member of model.members) {
        if (member.name !== undefined) members.set(member.name.toLowerCase(), member);
    }
    structMembersByLowerNameCache.set(model, members);
    return members;
}

/**
 * Wire field name lookups depend on cluster-qualified overrides in FIELD_NAME_OVERRIDES, so a
 * struct shared across clusters (e.g. a global struct) can map differently per cluster - cache
 * keyed by clusterModel first, then model, matching the getBitmapMembers pattern.
 */
const structMembersByWireNameCache = new WeakMap<ClusterModel, WeakMap<ValueModel, Map<string, ValueModel>>>();

function getStructMembersByWireFieldName(model: ValueModel, clusterModel: ClusterModel): Map<string, ValueModel> {
    let byModel = structMembersByWireNameCache.get(clusterModel);
    if (byModel === undefined) {
        byModel = new WeakMap();
        structMembersByWireNameCache.set(clusterModel, byModel);
    }

    let members = byModel.get(model);
    if (members !== undefined) return members;

    members = new Map();
    for (const member of model.members) {
        if (member.name === undefined) continue;
        const wireName = matterNameToWireField(member.name, clusterModel.name);
        members.set(wireName, member);
        // A member's wire name must win any key collision with another member's propertyName alias
        if (member.propertyName !== wireName && !members.has(member.propertyName)) {
            members.set(member.propertyName, member);
        }
    }
    byModel.set(model, members);
    return members;
}

function getBitmapMembers(model: ValueModel, clusterModel: ClusterModel): FieldModel[] {
    let byModel = bitmapMemberCache.get(clusterModel);
    if (byModel === undefined) {
        byModel = new WeakMap<ValueModel, FieldModel[]>();
        bitmapMemberCache.set(clusterModel, byModel);
    }

    let members = byModel.get(model);
    if (members !== undefined) return members;

    members = [...clusterModel.scope.membersOf(model)];
    byModel.set(model, members);
    return members;
}

/**
 * Uses the matter.js Model to convert the response data for read, subscribe and invoke into a tag-based response
 * including conversion of data types.
 *
 * Model classification and struct member info are cached in WeakMaps so that repeated calls
 * for the same model (e.g. across 160 nodes with identical clusters) skip the metabase traversal.
 */
export function convertMatterToWebSocketTagBased(
    value: unknown,
    model: ValueModel | undefined,
    clusterModel: ClusterModel | undefined,
): unknown {
    return convertMatterToWebSocket(value, model, clusterModel, true);
}

/**
 * Same as convertMatterToWebSocketTagBased but uses camelCase names instead of numeric tag IDs for struct keys.
 * Used for command (invoke) responses to match Python Matter Server behavior.
 */
export function convertMatterToWebSocketNameBased(
    value: unknown,
    model: ValueModel | undefined,
    clusterModel: ClusterModel | undefined,
): unknown {
    return convertMatterToWebSocket(value, model, clusterModel, false);
}

function convertMatterToWebSocket(
    value: unknown,
    model: ValueModel | undefined,
    clusterModel: ClusterModel | undefined,
    tagBased: boolean,
): unknown {
    if (value === null) {
        return null;
    }
    if (model === undefined) {
        // Unknown attributes: simple type conversions only
        if (Bytes.isBytes(value)) {
            return Bytes.toBase64(value);
        }
        if (Array.isArray(value)) {
            // Best-effort: recursively convert elements without schema
            return value.map(v => convertMatterToWebSocket(v, undefined, clusterModel, tagBased));
        }
        if (isObject(value) || !PRIMITIVE_TYPEOF.has(typeof value)) {
            return null;
        }
        return value;
    }

    switch (classifyModel(model)) {
        case ConvKind.Passthrough:
            return value;

        case ConvKind.EpochS:
            return typeof value === "number" ? value - MATTER_EPOCH_OFFSET_S : value;

        case ConvKind.EpochUS:
            return typeof value === "number" || typeof value === "bigint"
                ? BigInt(value) - MATTER_EPOCH_OFFSET_US
                : value;

        case ConvKind.Bytes:
            return value instanceof Uint8Array ? Bytes.toBase64(value) : value;

        case ConvKind.List: {
            if (!Array.isArray(value)) return value;
            // Hoist the element model: `model.members` is a getter that rebuilds its array on every
            // access, so reading it inside the map would rebuild it once per element.
            const memberModel = model.members.at(0);
            return value.map(v => convertMatterToWebSocket(v, memberModel, clusterModel, tagBased));
        }

        case ConvKind.Struct: {
            if (!isObject(value)) return value;
            const result: { [key: string]: unknown } = {};
            for (const { name, rawName, id, model: memberModel } of getStructMembers(model)) {
                if (Object.hasOwn(value, name)) {
                    const converted = convertMatterToWebSocket(value[name], memberModel, clusterModel, tagBased);
                    if (tagBased) {
                        result[id] = converted;
                    } else {
                        const wireName = matterNameToWireField(rawName, clusterModel?.name);
                        result[wireName] = converted;
                        if (wireName !== name) {
                            result[name] = converted;
                        }
                    }
                }
            }
            return result;
        }

        case ConvKind.Bitmap: {
            if (!isObject(value) || clusterModel === undefined) return value;
            let numberValue = 0;
            for (const member of getBitmapMembers(model, clusterModel)) {
                const memberTitle = member.title !== undefined ? camelize(member.title) : undefined;
                const memberValue =
                    member.name !== undefined && value[member.propertyName]
                        ? value[member.propertyName]
                        : memberTitle && value[memberTitle]
                          ? value[memberTitle]
                          : undefined;

                if (!memberValue) {
                    continue;
                }
                if (typeof memberValue !== "boolean" && typeof memberValue !== "number") {
                    throw new Error(`Invalid bitmap value for ${member.propertyName}: ${String(memberValue)}`);
                }

                const constraintValue = bitPosition(member.constraint.value);
                if (constraintValue !== undefined) {
                    numberValue |= 1 << constraintValue;
                } else {
                    const minBit = bitPosition(member.constraint.min) ?? 0;
                    numberValue |= typeof memberValue === "boolean" ? 1 : memberValue << minBit;
                }
            }
            return numberValue;
        }
    }
}

/**
 * Serialize to JSON with BigInt support.
 * - BigInt values within safe integer range are converted to numbers
 * - Large BigInt values are output as raw decimal numbers (not quoted strings)
 */
export function toBigIntAwareJson(object: object, spaces?: number): string {
    const replacements = new Array<{ from: string; to: string }>();
    let result = JSON.stringify(
        object,
        (_key, value) => {
            if (typeof value === "bigint") {
                if (value > Number.MAX_SAFE_INTEGER) {
                    // Store replacement: quoted hex string -> raw decimal number
                    replacements.push({ from: `"0x${value.toString(16)}"`, to: value.toString() });
                    return `0x${value.toString(16)}`;
                } else {
                    return Number(value);
                }
            }
            return value;
        },
        spaces,
    );
    // Large numbers need to be raw (not quoted) in the output, so replace hex placeholders with decimal
    // This handles both object values and array elements
    if (replacements.length > 0) {
        replacements.forEach(({ from, to }) => {
            result = result.replaceAll(from, to);
        });
    }

    return result;
}

/** Marker prefix for large numbers that need BigInt conversion */
const BIGINT_MARKER = "__BIGINT__";

/**
 * Parse JSON with BigInt support for large numbers that exceed JavaScript precision.
 * Numbers with 15+ digits that exceed MAX_SAFE_INTEGER are converted to BigInt.
 *
 * This function carefully avoids modifying numbers that appear inside string values.
 */
export function parseBigIntAwareJson(json: string): unknown {
    // Pre-process: Replace large numbers (15+ digits) with marked string placeholders
    // This must happen before JSON.parse to preserve precision
    // We need to track whether we're inside a string to avoid modifying string contents
    const result = new Array<string>();
    let i = 0;
    let inString = false;

    while (i < json.length) {
        const char = json[i];

        if (inString) {
            // Inside a string - copy characters as-is until we find the closing quote
            if (char === "\\") {
                // Escape sequence - copy both the backslash and the next character
                result.push(char);
                i++;
                if (i < json.length) {
                    result.push(json[i]);
                    i++;
                }
            } else if (char === '"') {
                // End of string
                result.push(char);
                inString = false;
                i++;
            } else {
                result.push(char);
                i++;
            }
        } else {
            // Outside a string
            if (char === '"') {
                // Start of a string
                result.push(char);
                inString = true;
                i++;
            } else if (char >= "0" && char <= "9") {
                // Potential number - extract and check
                // Check if previous character was a minus sign (for negative numbers)
                const hasMinus = result.length > 0 && result[result.length - 1] === "-";
                if (hasMinus) {
                    result.pop(); // Remove the minus sign, we'll include it in the number
                }

                // Extract the integer part
                const start = i;
                while (i < json.length && json[i] >= "0" && json[i] <= "9") {
                    i++;
                }

                // Check for decimal point (fractional number) or exponent
                let isFloat = false;
                if (i < json.length && json[i] === ".") {
                    isFloat = true;
                    i++; // consume the decimal point
                    while (i < json.length && json[i] >= "0" && json[i] <= "9") {
                        i++;
                    }
                }

                // Check for exponent (e.g., 1e10, 1E-5)
                if (i < json.length && (json[i] === "e" || json[i] === "E")) {
                    isFloat = true;
                    i++; // consume 'e' or 'E'
                    if (i < json.length && (json[i] === "+" || json[i] === "-")) {
                        i++; // consume sign
                    }
                    while (i < json.length && json[i] >= "0" && json[i] <= "9") {
                        i++;
                    }
                }

                const numberStr = (hasMinus ? "-" : "") + json.slice(start, i);

                // Only convert integers (not floats) with 15+ digits that exceed safe integer range
                if (!isFloat && numberStr.length - (hasMinus ? 1 : 0) >= 15) {
                    const num = BigInt(numberStr);
                    if (num > Number.MAX_SAFE_INTEGER || num < Number.MIN_SAFE_INTEGER) {
                        result.push(`"${BIGINT_MARKER}${numberStr}"`);
                    } else {
                        result.push(numberStr);
                    }
                } else {
                    result.push(numberStr);
                }
            } else {
                result.push(char);
                i++;
            }
        }
    }

    const processed = result.join("");

    // Parse with reviver to convert marked strings back to BigInt
    return JSON.parse(processed, (_key, value) => {
        if (typeof value === "string" && value.startsWith(BIGINT_MARKER)) {
            return BigInt(value.slice(BIGINT_MARKER.length));
        }
        return value;
    });
}

/** Chip JSON-like data strings can contain long numbers that are not supported by JSON.parse */
function parseChipJSON(json: string): unknown {
    json = json.replace(/: (\d{15,})[,}]/g, (match, number) => {
        const num = BigInt(number);
        if (num > Number.MAX_SAFE_INTEGER) {
            return match.replace(number, `"0x${num.toString(16)}"`);
        }
        return match;
    });

    return JSON.parse(json);
}

/** Use the matter.js model to convert the incoming data for write and invoke commands into the expected format. */
export function convertWebsocketDataToMatter(value: unknown, model: ValueModel): unknown {
    if (value === undefined) {
        return undefined;
    }
    if (value === "null" || value === null) {
        return null;
    }

    let data: unknown = value;

    if (model.type === "list") {
        if (typeof data === "string") {
            data = parseChipJSON(data);
        }
        if (Array.isArray(data)) {
            const memberModel = model.members.at(0)!;
            return data.map(v => convertWebsocketDataToMatter(v, memberModel));
        }
    }

    if (model.metabase?.name === "struct") {
        if (typeof data === "string") {
            data = parseChipJSON(data);
        }
        if (isObject(data)) {
            const members = getStructMembersByLowerName(model);
            const result: { [key: string]: unknown } = {};
            for (const key of Object.keys(data)) {
                const member = members.get(camelize(key).toLowerCase());
                if (member !== undefined) {
                    result[member.propertyName] = convertWebsocketDataToMatter(data[key], member);
                }
            }
            return result;
        }
    }

    if (
        (typeof data === "number" || typeof data === "bigint") &&
        (model.metabase?.metatype === "integer" || model.metabase?.metatype === "enum")
    ) {
        // Convert Epoch timestamps to Unix timestamps we use internally
        if (model.type === "epoch-s" && typeof data === "number") {
            return data + MATTER_EPOCH_OFFSET_S;
        }
        if (model.type === "epoch-us") {
            return BigInt(data) + MATTER_EPOCH_OFFSET_US;
        }
        return data;
    }

    if (typeof data === "string") {
        if (model.metabase?.metatype === "bytes" && data.startsWith("hex:")) {
            return Bytes.fromHex(data.slice(4));
        }

        if (model.metabase?.metatype === "bitmap") {
            const numberValue = parseInt(data);
            if (isNaN(numberValue)) {
                throw new Error("Invalid bitmap value");
            }
            const bitmapValue: { [key: string]: boolean | number } = {};
            for (const member of model.members) {
                if (member.name === undefined) {
                    continue;
                }
                const bit = bitPosition(member.constraint.value);
                if (bit !== undefined) {
                    if (numberValue & (1 << bit)) {
                        bitmapValue[member.propertyName] = true;
                    }
                    continue;
                }
                const minBit = bitPosition(member.constraint.min) ?? 0;
                const maxBit = bitPosition(member.constraint.max);
                if (maxBit === undefined) {
                    if (numberValue & (1 << minBit)) {
                        bitmapValue[member.propertyName] = true;
                    }
                    continue;
                }
                const mask = ((1 << (maxBit - minBit + 1)) - 1) << minBit;
                const fieldValue = (numberValue & mask) >> minBit;
                if (fieldValue !== 0) {
                    bitmapValue[member.propertyName] = fieldValue;
                }
            }
            return bitmapValue;
        }

        if (
            ((model.metabase?.metatype === "integer" || model.metabase?.metatype === "enum") &&
                data.startsWith("0x") &&
                data.match(/^0x[\da-fA-F]+$/)) ||
            data.match(/^-?[1-9]\d*$/) ||
            data === "0"
        ) {
            const numberValue = parseNumber(data);
            if (model.type === "epoch-s" && typeof numberValue === "number") {
                return numberValue + MATTER_EPOCH_OFFSET_S;
            }
            if (model.type === "epoch-us") {
                // epoch-us values can exceed 2^53, so only the unparsed string carries full precision
                return BigInt(data) + MATTER_EPOCH_OFFSET_US;
            }
            return numberValue;
        }

        if (model.metabase?.metatype === "boolean") {
            return data === "true" || data === "1" || data === "True";
        }

        if (model.metabase?.metatype === "string") {
            return data;
        }
    }

    logger.warn("UNHANDLED value ...", data, model.type, model.metatype, model.metabase?.metatype);

    return data;
}

export function getDateAsString(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const milliseconds = String(date.getMilliseconds()).padStart(3, "0");
    const microseconds = "000"; // JavaScript Date object does not support microseconds

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${microseconds}`;
}

export function buildAttributePath(endpointId: number, clusterId: number, attributeId: number): string {
    return `${endpointId}/${clusterId}/${attributeId}`;
}

/**
 * Parse an attribute path string into its components.
 * Supports wildcards (*) for endpoint, cluster, and attribute IDs.
 * Non-numeric values are treated as wildcards and returned as undefined.
 *
 * @param path - Attribute path string in format "endpoint/cluster/attribute"
 * @returns Object with endpointId, clusterId, attributeId - each undefined if wildcard
 */
export function splitAttributePath(path: string): {
    endpointId: EndpointNumber | undefined;
    clusterId: ClusterId | undefined;
    attributeId: AttributeId | undefined;
} {
    const [endpointStr, clusterStr, attributeStr] = path.split("/");

    // Non-numeric values (like "*") are treated as wildcards (undefined)
    let endpointNum = /^\d+$/.test(endpointStr) ? parseInt(endpointStr, 10) : undefined;
    let clusterNum = /^\d+$/.test(clusterStr) ? parseInt(clusterStr, 10) : undefined;
    let attributeNum = /^\d+$/.test(attributeStr) ? parseInt(attributeStr, 10) : undefined;

    if (endpointNum !== undefined && endpointNum === 0xffff) {
        endpointNum = undefined;
    }
    if (clusterNum !== undefined && clusterNum === 0xffffffff) {
        clusterNum = undefined;
    }
    if (attributeNum !== undefined && attributeNum === 0xffffffff) {
        attributeNum = undefined;
    }

    return {
        endpointId: endpointNum !== undefined ? EndpointNumber(endpointNum) : undefined,
        clusterId: clusterNum !== undefined ? ClusterId(clusterNum) : undefined,
        attributeId: attributeNum !== undefined ? AttributeId(attributeNum) : undefined,
    };
}
