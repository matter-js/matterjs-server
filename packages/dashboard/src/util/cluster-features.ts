/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ClusterFeatureDescription } from "../client/models/descriptions.js";

// Decode a cluster's FeatureMap bitmap into the subset of its known features that are active.
export function computeActiveClusterFeatures(
    featureMapValue: unknown,
    knownFeatures: ClusterFeatureDescription[],
): ClusterFeatureDescription[] {
    if (featureMapValue === undefined) return [];
    const featureMap = Number(featureMapValue);
    return knownFeatures.filter(feature => (featureMap & (1 << feature.bit)) !== 0).sort((a, b) => a.bit - b.bit);
}
