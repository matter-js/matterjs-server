/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { AttributeElement, AttributeModel, Matter, SchemaImplementationError } from "@matter/main/model";
import { ClusterId } from "@matter/main/types";

/**
 * A vendor-specific attribute added to a standard cluster. Conformance is
 * always optional, so it cannot be declared.
 */
export type ExtensionAttribute = Omit<AttributeElement.Properties, "conformance">;

/**
 * Add vendor-specific (manufacturer extension) attributes to a standard
 * Matter cluster in the matter.js model.
 *
 * Unlike a custom cluster, these attributes live inside a standard cluster
 * and use vendor-prefixed attribute IDs (vendor ID in the upper 16 bits).
 */
export function clusterExtension(cluster: ClusterId | string, attributes: ExtensionAttribute[]): void {
    const clusterModel = Matter.clusters.require(cluster);
    // A cluster model freezes once anything uses it, and pushing children then fails with an opaque TypeError
    if (Object.isFrozen(clusterModel.children)) {
        throw new SchemaImplementationError(
            { path: clusterModel.name },
            "Cluster is already in use and can no longer be extended; register extensions before using any cluster",
        );
    }
    for (const attribute of attributes) {
        if (attribute.id <= 0xffff) {
            throw new SchemaImplementationError(
                { path: clusterModel.name },
                `Extension attribute "${attribute.name}" must use a vendor prefixed ID (vendor ID in the upper 16 bits)`,
            );
        }
        const conflict = clusterModel.attributes.find(
            existing => existing.id === attribute.id || existing.name === attribute.name,
        );
        if (conflict !== undefined) {
            throw new SchemaImplementationError(
                { path: clusterModel.name },
                `Extension attribute "${attribute.name}" (0x${attribute.id.toString(16)}) conflicts with attribute "${conflict.name}" (0x${conflict.id.toString(16)})`,
            );
        }
        clusterModel.children.push(new AttributeModel({ ...attribute, conformance: "O" }));
    }
}
