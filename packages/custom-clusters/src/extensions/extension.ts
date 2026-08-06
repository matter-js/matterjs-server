/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { AttributeElement, AttributeModel, ClusterModel, Matter, SchemaImplementationError } from "@matter/main/model";
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
    const clusterModel = Matter.clusters(cluster);
    if (clusterModel === undefined) {
        throw new SchemaImplementationError({ path: `${cluster}` }, "Cannot extend unknown cluster");
    }
    extendCluster(clusterModel, attributes);
}

/**
 * Add extension attributes to a resolved cluster model. Either all attributes are added or none.
 */
export function extendCluster(cluster: ClusterModel, attributes: ExtensionAttribute[]): void {
    // A cluster model freezes once anything uses it, and pushing children then fails with an opaque TypeError
    if (Object.isFrozen(cluster.children)) {
        throw new SchemaImplementationError(
            { path: cluster.name },
            "Cluster is already in use and can no longer be extended; register extensions before using any cluster",
        );
    }

    const models = new Array<AttributeModel>();
    for (const attribute of attributes) {
        const model = new AttributeModel({ ...attribute, conformance: "O" });

        assertVendorPrefixedId(cluster, model);

        const conflict = [...cluster.properties, ...models].find(
            existing => existing.id === model.id || existing.propertyName === model.propertyName,
        );
        if (conflict !== undefined) {
            throw new SchemaImplementationError(
                { path: cluster.name },
                `Extension attribute "${model.name}" (0x${model.id.toString(16)}) conflicts with "${conflict.name}" (0x${conflict.id?.toString(16)})`,
            );
        }

        models.push(model);
    }

    cluster.children.push(...models);
}

/**
 * Bounds are Matter's MEI bounds, additionally requiring a vendor prefix as extension attributes are never standard.
 */
function assertVendorPrefixedId(cluster: ClusterModel, attribute: AttributeModel) {
    const vendorId = attribute.id >>> 16;
    const suffix = attribute.id & 0xffff;
    if (vendorId < 0x0001 || vendorId > 0xfff4 || suffix > 0xfffe) {
        throw new SchemaImplementationError(
            { path: cluster.name },
            `Extension attribute "${attribute.name}" must use a vendor prefixed ID of the form 0xVVVVAAAA with a vendor ID of 0x0001 - 0xfff4 and an attribute ID of 0x0000 - 0xfffe`,
        );
    }
}
