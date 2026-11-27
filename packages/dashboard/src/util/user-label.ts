/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterClient, MatterNode } from "@matter-server/ws-client";
import { labelLengthError } from "./label-length.js";
import {
    decodeLabelList,
    LABEL_LIST_ATTR,
    LABEL_STRUCT_LABEL_TAG,
    LABEL_STRUCT_VALUE_TAG,
    USER_LABEL_CLUSTER_ID,
    type LabelListItem,
} from "./label-list.js";
import { requireAttributeWriteSuccess } from "./matter-status.js";

// LabelStruct fields are each a string of up to 16 bytes (MatterSpecification.v161.Core § 9.7.4.1).
export const USER_LABEL_MAX_BYTES = 16;

export function userLabelListPath(endpoint: number): string {
    return `${endpoint}/${USER_LABEL_CLUSTER_ID}/${LABEL_LIST_ATTR}`;
}

/**
 * The editable rows and, separately, any entries the generic decoder could not parse as a LabelStruct. Those
 * are kept verbatim and written back unchanged so editing the well-formed rows cannot silently drop them.
 */
export interface UserLabelRows {
    rows: LabelListItem[];
    rawEntries: unknown[];
}

export function decodeUserLabelRows(node: MatterNode, endpoint: number): UserLabelRows | undefined {
    const entries = decodeLabelList(node.attributes[userLabelListPath(endpoint)]);
    if (entries === undefined) return undefined;
    const rows: LabelListItem[] = [];
    const rawEntries: unknown[] = [];
    for (const entry of entries) {
        if (entry.kind === "label") rows.push(entry.item);
        else rawEntries.push(entry.raw);
    }
    return { rows, rawEntries };
}

function toLabelStruct(item: LabelListItem): Record<string, unknown> {
    return { [LABEL_STRUCT_LABEL_TAG]: item.label, [LABEL_STRUCT_VALUE_TAG]: item.value };
}

/** Why `rows` can't be written, or undefined when every row fits within {@link USER_LABEL_MAX_BYTES}. */
export function userLabelRowsError(rows: LabelListItem[]): string | undefined {
    for (const row of rows) {
        const error =
            labelLengthError(row.label, USER_LABEL_MAX_BYTES) ?? labelLengthError(row.value, USER_LABEL_MAX_BYTES);
        if (error !== undefined) return error;
    }
    return undefined;
}

/**
 * Replaces the UserLabel cluster's LabelList on `endpoint`, keeping any entries the dashboard couldn't decode
 * (`rawEntries`) ahead of the edited rows. Not atomic: UserLabel's LabelList is a plain writable list attribute
 * (§9.7.4), unlike Thermostat Presets.
 */
export async function writeUserLabelRows(
    client: MatterClient,
    node: MatterNode,
    endpoint: number,
    rows: LabelListItem[],
    rawEntries: unknown[],
): Promise<void> {
    const error = userLabelRowsError(rows);
    if (error !== undefined) throw new Error(error);
    const next = [...rawEntries, ...rows.map(toLabelStruct)];
    requireAttributeWriteSuccess(
        await client.writeAttribute(node.node_id, userLabelListPath(endpoint), next),
        "Writing the user labels failed",
    );
}
