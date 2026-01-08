/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClusterId } from "@matter/main";
import {
    AcceptedCommandList,
    AttributeList,
    AttributeModel,
    ClusterModel,
    ClusterRevision,
    CommandModel,
    EventModel,
    FeatureMap,
    GeneratedCommandList,
    MatterModel,
} from "@matter/model";

type AttributeDetails = { readonly [key: string]: AttributeModel | undefined };

/** Metadata for Global attributes */
export const GlobalAttributes: AttributeDetails = Object.freeze({
    clusterRevision: ClusterRevision,
    featureMap: FeatureMap,
    attributeList: AttributeList,
    acceptedCommandList: AcceptedCommandList,
    generatedCommandList: GeneratedCommandList,
});

/**
 * Metadata for all clusters collected in an optimized form for direct access with the incoming websocket requests.
 * All names are just lowercased to prevent differences in camelize and decamelize handling.
 */
export type ClusterMapEntry = {
    readonly clusterId: ClusterId;
    readonly model: ClusterModel;
    readonly commands: { readonly [key: string]: CommandModel | undefined };
    readonly attributes: AttributeDetails;
    readonly events: { readonly [key: string]: EventModel | undefined };
};

export type ClusterMapType = {
    readonly [key: string]: ClusterMapEntry | undefined;
};

// Build the cluster map at module load time
const clusterMapBuilder: { [key: string]: ClusterMapEntry | undefined } = {};

MatterModel.standard.clusters.forEach(cluster => {
    if (cluster.id === undefined) {
        return;
    } // Skip clusters without an ID
    const aces = cluster.allAces;
    const commands: { [key: string]: CommandModel | undefined } = {};
    const attributes: { [key: string]: AttributeModel | undefined } = {};
    const events: { [key: string]: EventModel | undefined } = {};

    aces.forEach(ace => {
        const name = ace.name.toLowerCase();
        if (ace instanceof CommandModel) {
            commands[name] = ace;
            commands[ace.id] = ace;
        } else if (ace instanceof AttributeModel) {
            attributes[name] = ace;
            attributes[ace.id] = ace;
        } else if (ace instanceof EventModel) {
            events[name] = ace;
            events[ace.id] = ace;
        }
    });

    const clusterData: ClusterMapEntry = Object.freeze({
        clusterId: ClusterId(cluster.id),
        model: cluster,
        commands: Object.freeze(commands),
        attributes: Object.freeze(attributes),
        events: Object.freeze(events),
    });

    clusterMapBuilder[cluster.name.toLowerCase()] = clusterData;
    clusterMapBuilder[cluster.id] = clusterData;
});

/** Readonly map of all clusters, frozen after initialization */
export const ClusterMap: ClusterMapType = Object.freeze(clusterMapBuilder);
