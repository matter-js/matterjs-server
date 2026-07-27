/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AttributesData } from "./models/model.js";

// IcdManagement (cluster 0x46/70) OperatingMode and FeatureMap, always on endpoint 0
const OPERATING_MODE_PATH = "0/70/8";
const FEATURE_MAP_PATH = "0/70/65532";

// BasicInformation SpecificationVersion, encoded 0xMMmmpprr
const SPECIFICATION_VERSION_PATH = "0/40/21";

// IcdManagement.OperatingMode.Lit and IcdManagement.Feature.LongIdleTimeSupport; spelled out because
// this package stays free of the matter.js model
const OPERATING_MODE_LIT = 1;
const FEATURE_LONG_IDLE_TIME_SUPPORT = 1 << 2;

// matter.js only treats LIT as usable at >= 1.4.0; below that it does not track check-ins and reaches
// the node like any other, so holding work back for it would defer it for nothing.
const MIN_LIT_SPECIFICATION_VERSION = 0x01040000;

/**
 * Whether the node can be treated as a Long Idle Time device at all. Read from cached attributes
 * rather than from IcdClient, so the server-side processors and the dashboard decide the same way.
 */
export function isLongIdleTimeCapable(attributes: AttributesData): boolean {
    const featureMap = attributes[FEATURE_MAP_PATH];
    if (typeof featureMap !== "number" || (featureMap & FEATURE_LONG_IDLE_TIME_SUPPORT) === 0) {
        return false;
    }
    const specificationVersion = attributes[SPECIFICATION_VERSION_PATH];
    return typeof specificationVersion === "number" && specificationVersion >= MIN_LIT_SPECIFICATION_VERSION;
}

/**
 * Whether the node currently operates in Long Idle Time mode, i.e. an interaction with it can be
 * queued for the length of its idle interval — up to hours — before the node polls for it. A DSLS node
 * switching mode is only picked up once its attribute cache updates.
 */
export function isLongIdleTimeDevice(attributes: AttributesData): boolean {
    return attributes[OPERATING_MODE_PATH] === OPERATING_MODE_LIT && isLongIdleTimeCapable(attributes);
}
