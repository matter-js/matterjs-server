/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { attributeArray } from "./access-control.js";
import { tagField } from "./attribute-shapes.js";
import { describeRawEntry, type ChipText } from "./chip-text.js";

// FixedLabel (0x40 / 64) and UserLabel (0x41 / 65) both expose a LabelList of LabelStruct
// entries; either can be present on any endpoint as Matter's generic per-endpoint labeling
// mechanism (FixedLabel is factory-set, UserLabel is user/controller-writable).
export const FIXED_LABEL_CLUSTER_ID = 64;
export const USER_LABEL_CLUSTER_ID = 65;
export const LABEL_LIST_ATTR = 0;
export const LABEL_STRUCT_LABEL_TAG = 0;
export const LABEL_STRUCT_VALUE_TAG = 1;

export interface LabelListItem {
    label: string;
    value: string;
}

export type LabelListEntry = { kind: "label"; item: LabelListItem } | { kind: "raw"; raw: unknown };

function labelField(raw: unknown): string | undefined {
    return typeof raw === "string" && !raw.includes("\u0000") ? raw : undefined;
}

// Both fields are mandatory, so an entry missing one is flagged instead of taking the spec's empty fallback.
function decodeLabelListItem(entry: unknown): LabelListItem | undefined {
    const label = labelField(tagField(entry, LABEL_STRUCT_LABEL_TAG));
    const value = labelField(tagField(entry, LABEL_STRUCT_VALUE_TAG));
    return label === undefined || value === undefined ? undefined : { label, value };
}

/**
 * Decodes a FixedLabel/UserLabel LabelList for display. An entry that is not a LabelStruct with two
 * strings, or that carries NUL characters, stays a `raw` entry so the reported data remains visible.
 *
 * @returns undefined when the attribute was not read or was removed (`null`); an empty array when the
 *   device reports no labels
 * @see MatterSpecification.v161.Core § 9.7.4.1
 */
export function decodeLabelList(value: unknown): LabelListEntry[] | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "object") return [{ kind: "raw", raw: value }];

    return attributeArray(value).map((entry): LabelListEntry => {
        const item = decodeLabelListItem(entry);
        return item === undefined ? { kind: "raw", raw: entry } : { kind: "label", item };
    });
}

export function describeLabelListEntry(entry: LabelListEntry): ChipText {
    if (entry.kind === "raw") return describeRawEntry(entry.raw, "LabelStruct");

    const label = entry.item.label.trim();
    const value = entry.item.value.trim();
    const text = label !== "" && value !== "" ? `${label}: ${value}` : label || value || "(empty label)";
    const title = `Label ${JSON.stringify(entry.item.label)} = ${JSON.stringify(entry.item.value)}`;
    return { text, title, erroneous: false };
}
