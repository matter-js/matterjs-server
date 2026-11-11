/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

export function asObject(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

export function pickNumber(obj: Record<string, unknown>, ...keys: string[]): number | null {
    for (const k of keys) {
        const v = obj[k];
        if (typeof v === "number" && Number.isFinite(v)) return v;
    }
    return null;
}

export function pickString(obj: Record<string, unknown>, key: string): string | null {
    const v = obj[key];
    return typeof v === "string" ? v : null;
}

/** Struct attributes reach the dashboard field-tag keyed (`{"0": …}`) via convertMatterToWebSocketTagBased. */
export function tagField(value: unknown, tag: number): unknown {
    return asObject(value)?.[String(tag)];
}

/**
 * int64/uint64 fields arrive as bigint, smaller ones as number. parseBigIntAwareJson only yields a bigint
 * beyond the safe integer range, so converting one there would round it: such a value reads as absent
 * rather than as a wrong number.
 */
export function toNumber(value: unknown): number | undefined {
    if (typeof value === "number") return value;
    if (typeof value !== "bigint") return undefined;
    return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)
        ? Number(value)
        : undefined;
}

/** A blank string carries no display value, so it reads as absent. */
export function toText(value: unknown): string | undefined {
    const text = typeof value === "string" ? value.trim() : "";
    return text.length > 0 ? text : undefined;
}

export function toBoolean(value: unknown): boolean | undefined {
    return typeof value === "boolean" ? value : undefined;
}

export function pickBoolean(obj: Record<string, unknown>, key: string): boolean | null {
    const v = obj[key];
    return typeof v === "boolean" ? v : null;
}

export function pickArray(obj: Record<string, unknown>, key: string): unknown[] {
    const v = obj[key];
    return Array.isArray(v) ? v : [];
}

export function extractAttributeValue(attributesData: unknown): unknown {
    const obj = asObject(attributesData);
    if (!obj) return attributesData;
    const vals = Object.values(obj);
    return vals.length > 0 ? vals[0] : null;
}

export function extractAttributeList(attributesData: unknown): unknown[] {
    const val = extractAttributeValue(attributesData);
    return Array.isArray(val) ? val : [];
}
