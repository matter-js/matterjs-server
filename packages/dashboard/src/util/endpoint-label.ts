/**
 * @license
 * Copyright 2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterNode } from "@matter-server/ws-client";
import { attributeArray } from "./access-control.js";

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

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

// LabelStruct wire entries are field-tag keyed: "0" Label (category, e.g. "room"), "1" Value.
function decodeLabelListValues(raw: unknown): string[] {
    return attributeArray(raw)
        .map(entry => (isRecord(entry) ? entry["1"] : undefined))
        .filter((value): value is string => typeof value === "string" && value.length > 0);
}

/**
 * Best-effort human-readable label for an endpoint, to identify it without opening it.
 * Tries, in order: BridgedDeviceBasicInformation NodeLabel (bridged devices), UserLabel
 * LabelList, FixedLabel LabelList. Returns undefined when none are present/non-empty.
 */
export function getEndpointLabel(node: MatterNode, endpoint: number): string | undefined {
    const bridgedNodeLabel =
        node.attributes[
            `${endpoint}/${BRIDGED_DEVICE_BASIC_INFORMATION_CLUSTER_ID}/${BRIDGED_NODE_LABEL_ATTRIBUTE_ID}`
        ];
    if (typeof bridgedNodeLabel === "string" && bridgedNodeLabel.length > 0) return bridgedNodeLabel;

    const userLabels = decodeLabelListValues(
        node.attributes[`${endpoint}/${USER_LABEL_CLUSTER_ID}/${LABEL_LIST_ATTRIBUTE_ID}`],
    );
    if (userLabels.length > 0) return userLabels.join(" / ");

    const fixedLabels = decodeLabelListValues(
        node.attributes[`${endpoint}/${FIXED_LABEL_CLUSTER_ID}/${LABEL_LIST_ATTRIBUTE_ID}`],
    );
    if (fixedLabels.length > 0) return fixedLabels.join(" / ");

    return undefined;
}
