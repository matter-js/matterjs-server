/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterNode } from "@matter-server/ws-client";
import { attributeArray } from "./access-control.js";
import { tagField, toText } from "./attribute-shapes.js";

// BridgedDeviceBasicInformation cluster (0x39 / 57): carries its own NodeLabel per bridged
// endpoint, distinct from the whole-node BasicInformation NodeLabel on endpoint 0.
const BRIDGED_DEVICE_BASIC_INFORMATION_CLUSTER_ID = 57;
const BRIDGED_NODE_LABEL_ATTRIBUTE_ID = 5;

// FixedLabel (0x40 / 64) and UserLabel (0x41 / 65) both expose a LabelList of LabelStruct
// entries; either can be present on any endpoint as Matter's generic per-endpoint labeling
// mechanism (FixedLabel is factory-set, UserLabel is user/controller-writable).
const FIXED_LABEL_CLUSTER_ID = 64;
const USER_LABEL_CLUSTER_ID = 65;
const LABEL_LIST_ATTRIBUTE_ID = 0;

/** The label shares a single-line header with the endpoint number and the cluster name. */
const MAX_LABEL_ENTRIES = 3;
const MAX_LABEL_LENGTH = 60;

/**
 * A device padding a fixed-width label field with NULs reports the padding as text;
 * `MatterNode.nodeLabel` rejects the same shape rather than rendering it.
 */
function labelText(value: unknown): string | undefined {
    const text = toText(value);
    return text === undefined || text.includes("\u0000") ? undefined : text;
}

// LabelStruct wire entries are field-tag keyed: "0" Label (category, e.g. "room"), "1" Value.
function decodeLabelListValues(raw: unknown): string[] {
    return attributeArray(raw)
        .map(entry => labelText(tagField(entry, 1)))
        .filter((value): value is string => value !== undefined);
}

function joinLabels(values: string[]): string | undefined {
    if (values.length === 0) return undefined;
    const joined = values.slice(0, MAX_LABEL_ENTRIES).join(" / ");
    return joined.length > MAX_LABEL_LENGTH ? `${joined.slice(0, MAX_LABEL_LENGTH - 1)}\u2026` : joined;
}

/**
 * Best-effort human-readable label for an endpoint, to identify it without opening it.
 * Tries, in order: BridgedDeviceBasicInformation NodeLabel (bridged devices), UserLabel
 * LabelList, FixedLabel LabelList. Returns undefined when none are present/non-empty.
 */
export function getEndpointLabel(node: MatterNode, endpoint: number): string | undefined {
    const bridgedNodeLabel = labelText(
        node.attributes[
            `${endpoint}/${BRIDGED_DEVICE_BASIC_INFORMATION_CLUSTER_ID}/${BRIDGED_NODE_LABEL_ATTRIBUTE_ID}`
        ],
    );
    if (bridgedNodeLabel !== undefined) return joinLabels([bridgedNodeLabel]);

    return (
        joinLabels(
            decodeLabelListValues(node.attributes[`${endpoint}/${USER_LABEL_CLUSTER_ID}/${LABEL_LIST_ATTRIBUTE_ID}`]),
        ) ??
        joinLabels(
            decodeLabelListValues(node.attributes[`${endpoint}/${FIXED_LABEL_CLUSTER_ID}/${LABEL_LIST_ATTRIBUTE_ID}`]),
        )
    );
}
