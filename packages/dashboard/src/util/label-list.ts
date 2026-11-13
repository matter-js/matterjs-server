/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { toBigIntAwareJson } from "@matter-server/ws-client";
import { attributeArray } from "./access-control.js";
import { tagField, toText } from "./attribute-shapes.js";

// FixedLabel (0x40 / 64) and UserLabel (0x41 / 65) both expose a LabelList of LabelStruct
// entries; either can be present on any endpoint as Matter's generic per-endpoint labeling
// mechanism (FixedLabel is factory-set, UserLabel is user/controller-writable).
export const FIXED_LABEL_CLUSTER_ID = 64;
export const USER_LABEL_CLUSTER_ID = 65;
export const LABEL_LIST_ATTR = 0;

export interface LabelListItem {
    label: string;
    value: string;
}

export type LabelListEntry = { kind: "label"; item: LabelListItem } | { kind: "raw"; raw: unknown };

/**
 * A device padding a fixed-width label field with NULs reports the padding as text;
 * `MatterNode.nodeLabel` rejects the same shape rather than rendering it.
 */
function labelText(value: unknown): string | undefined {
    const text = toText(value);
    return text === undefined || text.includes("\u0000") ? undefined : text;
}

// A field that's absent, or a string blanked out by NUL padding, is a normal "no value" case.
// A field present with a non-string type is malformed and must not be conflated with "absent" —
// it has to surface as a raw/error entry so the reported value isn't silently dropped.
function decodeLabelField(raw: unknown): { text: string; invalid: boolean } {
    if (raw === undefined) return { text: "", invalid: false };
    if (typeof raw !== "string") return { text: "", invalid: true };
    return { text: labelText(raw) ?? "", invalid: false };
}

// LabelStruct wire entries are field-tag keyed: "0" Label (category, e.g. "room"), "1" Value.
function decodeLabelListItem(entry: unknown): LabelListItem | undefined {
    const label = decodeLabelField(tagField(entry, 0));
    const value = decodeLabelField(tagField(entry, 1));
    if (label.invalid || value.invalid) return undefined;
    return label.text === "" && value.text === "" ? undefined : { label: label.text, value: value.text };
}

// undefined means the LabelList attribute hasn't been read yet — an empty array means the
// device reported no labels.
export function decodeLabelList(value: unknown): LabelListEntry[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value) && (typeof value !== "object" || value === null)) return [{ kind: "raw", raw: value }];

    return attributeArray(value).map((entry): LabelListEntry => {
        const item = decodeLabelListItem(entry);
        return item === undefined ? { kind: "raw", raw: entry } : { kind: "label", item };
    });
}

const RAW_ENTRY_TEXT_MAX = 60;

export function describeLabelListEntry(entry: LabelListEntry): { text: string; title: string; erroneous: boolean } {
    if (entry.kind === "label") {
        const { label, value } = entry.item;
        const text = value.length > 0 ? `${label}: ${value}` : label;
        return { text, title: `Label "${label}" = "${value}"`, erroneous: false };
    }

    const raw = entry.raw === undefined ? "undefined" : toBigIntAwareJson(entry.raw);
    const text = raw.length > RAW_ENTRY_TEXT_MAX ? `${raw.slice(0, RAW_ENTRY_TEXT_MAX - 1)}…` : raw;
    return { text, title: `Not a LabelStruct: ${raw}`, erroneous: true };
}
