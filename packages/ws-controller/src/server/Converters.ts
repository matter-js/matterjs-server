/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { AttributeId, Bytes, camelize, ClusterId, isObject, Logger } from "@matter/main";
import { ClusterModel, FieldValue, ValueModel } from "@matter/main/model";
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
        return value.map(v => convertWebSocketTagBasedToMatter(v, model.members[0], clusterModel));
    }

    // Handle structs - convert numeric keys to camelCased member names
    if (isObject(value) && model.metabase?.name === "struct") {
        const valueKeys = Object.keys(value);
        const result: { [key: string]: unknown } = {};

        // Build a map of member ID to member for efficient lookup
        const memberById: { [id: number]: ValueModel } = {};
        for (const member of model.members) {
            if (member.id !== undefined) {
                memberById[member.id] = member;
            }
        }

        for (const key of valueKeys) {
            const memberId = parseInt(key);
            if (!isNaN(memberId) && memberById[memberId]) {
                const member = memberById[memberId];
                result[camelize(member.name)] = convertWebSocketTagBasedToMatter(value[key], member, clusterModel);
            } else {
                // Keep unknown keys as-is (fallback for unknown attributes)
                result[key] = value[key];
            }
        }
        return result;
    }

    // Handle bitmaps - convert number to object with boolean flags
    if (typeof value === "number" && model.metabase?.metatype === "bitmap") {
        const bitmapValue: { [key: string]: boolean | number } = {};

        for (const member of clusterModel.scope.membersOf(model)) {
            const memberName =
                member.name !== undefined && model.name !== "FeatureMap"
                    ? camelize(member.name)
                    : member.title !== undefined
                      ? camelize(member.title)
                      : undefined;

            if (memberName === undefined) {
                continue;
            }

            const constraintValue = FieldValue.numericValue(member.constraint.value);
            if (constraintValue !== undefined) {
                // Single bit - extract as boolean
                bitmapValue[memberName] = (value & (1 << constraintValue)) !== 0;
            } else {
                const minBit = FieldValue.numericValue(member.constraint.min) ?? 0;
                const maxBit = FieldValue.numericValue(member.constraint.max);
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
 * Uses the matter.js Model to convert the response data for read, subscribe and invoke into a tag-based response
 * including conversion of data types.
 */
export function convertMatterToWebSocketTagBased(
    value: unknown,
    model: ValueModel | undefined,
    clusterModel: ClusterModel | undefined,
): unknown {
    if (value === null) {
        return null;
    }
    if (model === undefined) {
        // Do some simple conversions when we have unknown attributes
        if (Bytes.isBytes(value)) {
            return `${Bytes.toBase64(value)}`;
        }
        if (isObject(value) || !["string", "number", "bigint", "boolean", "undefined"].includes(typeof value)) {
            return null; // We cannot convert this
        }

        return value;
    }
    if (Array.isArray(value) && model.type === "list") {
        return value.map(v => convertMatterToWebSocketTagBased(v, model.members[0], clusterModel));
    }
    if (isObject(value) && model.metabase?.name === "struct") {
        const valueKeys = Object.keys(value);
        const result: { [key: string]: any } = {};
        for (const member of model.members) {
            const name = camelize(member.name);
            if (member.name !== undefined && member.id !== undefined && valueKeys.includes(name)) {
                result[member.id] = convertMatterToWebSocketTagBased(value[name], member, clusterModel);
            }
        }
        return result;
    }
    if (isObject(value) && model.metabase?.metatype === "bitmap") {
        if (clusterModel !== undefined) {
            let numberValue = 0;

            for (const member of clusterModel.scope.membersOf(model)) {
                const memberValue =
                    member.name !== undefined && value[camelize(member.name)]
                        ? value[camelize(member.name)]
                        : member.title !== undefined && value[camelize(member.title)]
                          ? value[camelize(member.title)]
                          : undefined;

                if (!memberValue) {
                    continue;
                }
                if (typeof memberValue !== "boolean" && typeof memberValue !== "number") {
                    throw new Error("Invalid bitmap value", memberValue);
                }

                const constraintValue = FieldValue.numericValue(member.constraint.value);
                if (constraintValue !== undefined) {
                    numberValue |= 1 << constraintValue;
                } else {
                    const minBit = FieldValue.numericValue(member.constraint.min) ?? 0;
                    numberValue |= typeof memberValue === "boolean" ? 1 : memberValue << minBit;
                }
            }

            return numberValue;
        }
    }

    if (value instanceof Uint8Array && model.metabase?.metatype === "bytes") {
        value = `${Bytes.toBase64(value)}`;
    }

    if (model.metabase?.metatype === "integer") {
        // Convert Epoch timestamps to Unix timestamps we use internally
        if (model.type === "epoch-s" && typeof value === "number") {
            value -= MATTER_EPOCH_OFFSET_S;
        } else if (model.type === "epoch-us" && (typeof value === "number" || typeof value === "bigint")) {
            value = BigInt(value) - MATTER_EPOCH_OFFSET_US;
        }
        return value;
    }

    return value;
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
 */
export function parseBigIntAwareJson(json: string): unknown {
    // Pre-process: Replace large numbers (15+ digits) with marked string placeholders
    // This must happen before JSON.parse to preserve precision
    // Match numbers after colon (object values) or after [ or , (array elements)
    const processed = json.replace(/([:,[])\s*(\d{15,})(?=[,}\]\s])/g, (match, prefix, number) => {
        const num = BigInt(number);
        if (num > Number.MAX_SAFE_INTEGER) {
            return `${prefix}"${BIGINT_MARKER}${number}"`;
        }
        return match;
    });

    // Parse with reviver to convert marked strings back to BigInt
    return JSON.parse(processed, (_key, value) => {
        if (typeof value === "string" && value.startsWith(BIGINT_MARKER)) {
            return BigInt(value.slice(BIGINT_MARKER.length));
        }
        return value;
    });
}

/** Chip JSON-like data strings can contain long numbers that are not supported by JSON.parse */
function parseChipJSON(json: string) {
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
export function convertWebsocketDataToMatter(value: any, model: ValueModel): any {
    if (value === undefined) {
        return undefined;
    }
    if (value === "null" || value === null) {
        return null;
    }

    if (model.type === "list") {
        if (typeof value === "string") {
            value = parseChipJSON(value);
        }
        if (Array.isArray(value)) {
            return value.map(v => convertWebsocketDataToMatter(v, model.members[0]));
        }
    }

    if (model.metabase?.name === "struct") {
        if (typeof value === "string") {
            value = parseChipJSON(value);
        }
        if (typeof value === "object") {
            const members = model.members.reduce(
                (acc, member) => {
                    if (member.name !== undefined) {
                        acc[member.name.toLowerCase()] = member;
                    }
                    return acc;
                },
                {} as { [key: string]: ValueModel },
            );
            const valueKeys = Object.keys(value);
            const result: { [key: string]: unknown } = {};
            valueKeys.forEach(key => {
                const member = members[camelize(key).toLowerCase()];
                if (member !== undefined) {
                    result[camelize(member.name)] = convertWebsocketDataToMatter(value[key], member);
                }
            });
            return result;
        }
    }

    if (
        (typeof value === "number" || typeof value === "bigint") &&
        (model.metabase?.metatype === "integer" || model.metabase?.metatype === "enum")
    ) {
        // Convert Epoch timestamps to Unix timestamps we use internally
        if (model.type === "epoch-s" && typeof value === "number") {
            value += MATTER_EPOCH_OFFSET_S;
        } else if (model.type === "epoch-us") {
            value = BigInt(value) + MATTER_EPOCH_OFFSET_US;
        }
        return value;
    }

    if (typeof value === "string") {
        if (model.metabase?.metatype === "bytes" && value.startsWith("hex:")) {
            return Bytes.fromHex(value.slice(4));
        }

        if (model.metabase?.metatype === "bitmap") {
            const numberValue = parseInt(value);
            if (isNaN(numberValue)) {
                throw new Error("Invalid bitmap value");
            }
            const bitmapValue: { [key: string]: boolean } = {};
            model.members.forEach(member => {
                if (
                    member.constraint !== undefined &&
                    member.name !== undefined &&
                    numberValue & (1 << parseInt(member.constraint as unknown as string))
                ) {
                    bitmapValue[camelize(member.name)] = true;
                }
            });
            return bitmapValue;
        }

        if (
            ((model.metabase?.metatype === "integer" || model.metabase?.metatype === "enum") &&
                value.startsWith("0x") &&
                value.match(/^0x[\da-fA-F]+$/)) ||
            value.match(/^-?[1-9]\d*$/) ||
            value === "0"
        ) {
            let numberValue = parseNumber(value);
            if (model.type === "epoch-s" && typeof numberValue === "number") {
                numberValue += MATTER_EPOCH_OFFSET_S;
            } else if (model.type === "epoch-us") {
                numberValue = BigInt(value) + MATTER_EPOCH_OFFSET_US;
            }
            return numberValue;
        }

        if (model.metabase?.metatype === "boolean") {
            return value === "true" || value === "1" || value === "True";
        }

        if (model.metabase?.metatype === "string") {
            return value;
        }
    }

    logger.warn("UNHANDLED value ...", value, model.type, model.metatype, model.metabase?.metatype);

    return value;
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
    const endpointNum = /^\d+$/.test(endpointStr) ? parseInt(endpointStr, 10) : undefined;
    const clusterNum = /^\d+$/.test(clusterStr) ? parseInt(clusterStr, 10) : undefined;
    const attributeNum = /^\d+$/.test(attributeStr) ? parseInt(attributeStr, 10) : undefined;

    return {
        endpointId: endpointNum !== undefined ? EndpointNumber(endpointNum) : undefined,
        clusterId: clusterNum !== undefined ? ClusterId(clusterNum) : undefined,
        attributeId: attributeNum !== undefined ? AttributeId(attributeNum) : undefined,
    };
}
