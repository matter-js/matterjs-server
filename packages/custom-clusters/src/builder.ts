/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { camelize, capitalize } from "@matter/main";
import { ClusterModel, ElementTag, GLOBAL_IDS } from "@matter/main/model";
import { ClusterType, MutableCluster, OptionalAttribute, TlvOfModel } from "@matter/main/types";

export function ClusterTypeOfModel(model: ClusterModel) {
    if (model.tag !== ElementTag.Cluster || model.id === undefined) {
        throw new Error("Model is not a valid ClusterModel");
    }

    const cluster: ClusterType.Options = {
        id: model.id,
        name: capitalize(model.name),
        revision: model.revision,

        attributes: {},
    };

    for (const attr of model.attributes) {
        const id = attr.id;
        // Exclude Global attributes
        if (GLOBAL_IDS.has(id)) {
            continue;
        }
        const name = camelize(attr.name);
        // TODO resect mandatory flag when needed
        cluster.attributes![name] = OptionalAttribute(id, TlvOfModel(attr));
    }

    // TODO also add events and commands when needed

    return MutableCluster(cluster);
}
