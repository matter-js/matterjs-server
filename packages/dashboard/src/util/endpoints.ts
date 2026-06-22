/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatterNode } from "@matter-server/ws-client";
import { type DeviceType, device_types } from "../client/models/descriptions.js";

export function getEndpointDeviceTypes(node: MatterNode, endpoint: number): DeviceType[] {
    const rawValues = node.attributes[`${endpoint}/29/0`] as Record<string, number>[] | undefined;
    if (!rawValues) return new Array<DeviceType>();
    return rawValues.map(rawValue => {
        const id = rawValue["0"] ?? rawValue["deviceType"];
        return device_types[id] ?? { id: id ?? -1, label: `Unknown Device Type (${id})`, clusters: [] };
    });
}
