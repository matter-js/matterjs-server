/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { toBigIntAwareJson } from "@matter-server/ws-client";
import { semantic_tag_namespaces } from "../client/models/descriptions.js";
import { attributeArray } from "./access-control.js";
import { formatHex } from "./format_hex.js";

// Descriptor cluster and its TagList attribute (semantic tags for the endpoint)
export const DESCRIPTOR_CLUSTER_ID = 29;
export const TAG_LIST_ATTR = 4;

export interface SemanticTag {
    mfgCode: number | null;
    namespaceId: number;
    tag: number;
    label: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

/** SemanticTagStruct wire entries are field-tag keyed: "0" MfgCode, "1" NamespaceID, "2" Tag, "3" Label. */
function decodeSemanticTag(entry: unknown): SemanticTag | undefined {
    if (!isRecord(entry)) return undefined;
    const namespaceId = entry["1"];
    const tag = entry["2"];
    if (typeof namespaceId !== "number" || typeof tag !== "number") return undefined;
    const mfgCode = entry["0"];
    const label = entry["3"];
    return {
        mfgCode: typeof mfgCode === "number" ? mfgCode : null,
        namespaceId,
        tag,
        label: typeof label === "string" ? label : null,
    };
}

export type SemanticTagListEntry = { kind: "tag"; semtag: SemanticTag } | { kind: "raw"; raw: unknown };

// undefined means the TagList attribute hasn't been read yet — an empty array means the device
// reported no semantic tags.
export function decodeSemanticTagList(value: unknown): SemanticTagListEntry[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value) && !isRecord(value)) return [{ kind: "raw", raw: value }];

    return attributeArray(value).map((entry): SemanticTagListEntry => {
        const semtag = decodeSemanticTag(entry);
        return semtag === undefined ? { kind: "raw", raw: entry } : { kind: "tag", semtag };
    });
}

const RAW_ENTRY_TEXT_MAX = 60;

export function describeSemanticTagListEntry(entry: SemanticTagListEntry): {
    text: string;
    title: string;
    erroneous: boolean;
} {
    if (entry.kind === "tag") return { ...describeSemanticTag(entry.semtag), erroneous: false };

    const raw = entry.raw === undefined ? "undefined" : toBigIntAwareJson(entry.raw);
    const text = raw.length > RAW_ENTRY_TEXT_MAX ? `${raw.slice(0, RAW_ENTRY_TEXT_MAX - 1)}…` : raw;
    return { text, title: `Not a SemanticTagStruct: ${raw}`, erroneous: true };
}

// Renders a single semantic tag as "Namespace → Tag", falling back to raw ids when the
// namespace is manufacturer-specific or unrecognized (standard namespaces only cover Matter's
// own registry, not vendor-defined ones referenced via mfgCode).
export function describeSemanticTag(semtag: SemanticTag): { text: string; title: string } {
    const { mfgCode, namespaceId, tag, label } = semtag;
    const idSuffix = ` (ns ${namespaceId}, tag ${tag})`;

    if (mfgCode != null) {
        const text = label ? `Mfg ${formatHex(mfgCode)}: ${label}` : `Mfg ${formatHex(mfgCode)} tag ${tag}`;
        return { text, title: `Manufacturer-specific${idSuffix}, mfgCode ${formatHex(mfgCode)}` };
    }

    const namespace = semantic_tag_namespaces[namespaceId];
    const tagInfo = namespace?.tags[tag];
    const namespaceLabel = namespace?.label ?? `Namespace ${namespaceId}`;
    const tagLabel = tagInfo?.label ?? `Tag ${tag}`;
    const text = label ? `${namespaceLabel} → ${tagLabel} ("${label}")` : `${namespaceLabel} → ${tagLabel}`;
    return { text, title: `${namespaceLabel} → ${tagLabel}${idSuffix}` };
}
