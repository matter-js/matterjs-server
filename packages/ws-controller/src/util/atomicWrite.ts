/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Duration } from "@matter/main";
import type { AttributeModel } from "@matter/main/model";

/**
 * Whether matter.js sends a write of the attribute as a timed write: the request states a timeout, or the attribute
 * requires timed writes.
 */
export function writesTimed(attributeModel: AttributeModel, timedInteractionTimeoutMs: Duration | undefined): boolean {
    return timedInteractionTimeoutMs !== undefined || attributeModel.effectiveAccess.timed === true;
}
