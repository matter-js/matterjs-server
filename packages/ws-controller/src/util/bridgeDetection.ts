/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AttributesData } from "../types/CommandHandler.js";

/** Descriptor cluster (29) DeviceTypeList attribute (0) on any endpoint. */
const DEVICE_TYPE_LIST_PATH = /^\d+\/29\/0$/;

/** Aggregator device type (0x000e); an endpoint carrying it makes the node a bridge. */
const AGGREGATOR_DEVICE_TYPE = 14;

function isRecord(entry: unknown): entry is Record<string, unknown> {
    return typeof entry === "object" && entry !== null;
}

/**
 * Determine whether a node is a bridge from its cached attributes.
 *
 * A node is a bridge when any endpoint's Descriptor DeviceTypeList contains the Aggregator device
 * type. The specification does not place the aggregator on a fixed endpoint, and a bridge may nest
 * an aggregator below another aggregator, so every endpoint is considered.
 *
 * @see Matter Device Library Specification, "Aggregator" device type (0x000e)
 */
export function isBridgeNode(attributes: AttributesData): boolean {
    for (const [path, value] of Object.entries(attributes)) {
        if (!DEVICE_TYPE_LIST_PATH.test(path) || !Array.isArray(value)) {
            continue;
        }
        if (value.some(entry => isRecord(entry) && entry["0"] === AGGREGATOR_DEVICE_TYPE)) {
            return true;
        }
    }
    return false;
}
