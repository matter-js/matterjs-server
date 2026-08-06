/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { AttributeModel, Matter } from "@matter/main/model";

/**
 * Add vendor specific (manufacturer extension) attributes to a standard
 * Matter cluster in the matter.js model.
 *
 * Unlike a custom cluster, these attributes live inside a standard cluster
 * and use vendor-prefixed attribute IDs (vendor ID in the upper 16 bits).
 */
export function clusterExtension(
    clusterName: string,
    attributes: ConstructorParameters<typeof AttributeModel>[0][],
): void {
    const cluster = Matter.clusters.find(c => c.name === clusterName);
    if (cluster === undefined) {
        throw new Error(`Cannot extend unknown cluster "${clusterName}"`);
    }
    for (const attribute of attributes) {
        cluster.children.push(new AttributeModel(attribute));
    }
}
