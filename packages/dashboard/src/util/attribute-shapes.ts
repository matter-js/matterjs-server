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
