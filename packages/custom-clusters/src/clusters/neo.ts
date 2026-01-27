/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { attribute, cluster, uint32 } from "@matter/main/model";

@cluster(0x125dfc11)
export class NeoCluster {
    @attribute(0x125d0021, uint32)
    wattAccumulated?: number;

    @attribute(0x125d0023, uint32)
    watt?: number;

    @attribute(0x125d0022, uint32)
    current?: number;

    @attribute(0x125d0024, uint32)
    voltage?: number;
}
