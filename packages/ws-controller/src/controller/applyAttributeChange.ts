/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NodeId } from "@matter/main";
import { BasicInformation, BridgedDeviceBasicInformation, Descriptor } from "@matter/main/clusters";
import { AcceptedCommandList, AttributeList, ClusterRevision, FeatureMap } from "@matter/main/model";
import type { AttributeDataCache } from "./AttributeDataCache.js";
import type { AttributeChange } from "./PeerChangeBus.js";

/**
 * Attributes whose change alters the shape of a node rather than a value within it, so consumers need
 * a full refresh rather than a single attribute update. Mirrors what the legacy bus raised
 * `structureChanged` for.
 */
function describesNodeStructure(path: AttributeChange["path"]): string | undefined {
    const { clusterId, attributeId } = path;

    if (
        (clusterId === BasicInformation.id || clusterId === BridgedDeviceBasicInformation.id) &&
        attributeId !== BasicInformation.attributes.nodeLabel.id
    ) {
        return "basic information changed";
    }

    if (clusterId === Descriptor.Cluster.id) {
        switch (attributeId) {
            case Descriptor.Cluster.attributes.partsList.id:
            case Descriptor.Cluster.attributes.serverList.id:
            case Descriptor.Cluster.attributes.clientList.id:
            case Descriptor.Cluster.attributes.deviceTypeList.id:
                return "endpoint composition changed";
        }
    }

    switch (attributeId) {
        case ClusterRevision.id:
        case FeatureMap.id:
        case AttributeList.id:
        case AcceptedCommandList.id:
            return "cluster capabilities changed";
    }

    return undefined;
}

export function applyAttributeChange(
    nodeId: NodeId,
    change: AttributeChange,
    target: {
        cache: Pick<AttributeDataCache, "updateAttribute">;
        emit(nodeId: NodeId, change: AttributeChange): void;
        markNodeUpdatePending(reason: string): void;
    },
) {
    const removed = target.cache.updateAttribute(nodeId, change);
    target.emit(nodeId, change);
    const reason = removed ? "attribute removed" : describesNodeStructure(change.path);
    if (reason !== undefined) {
        target.markNodeUpdatePending(reason);
    }
}
