/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { attribute, cluster, uint32 } from "@matter/main/model";

@cluster(0x130dfc02)
export class ThirdRealityMeteringCluster {
    @attribute(0x0000, uint32)
    currentSummationDelivered?: number;

    @attribute(0x0400, uint32)
    instantaneousDemand?: number;

    @attribute(0x0301, uint32)
    multiplier?: number;

    @attribute(0x0302, uint32)
    divisor?: number;
}
