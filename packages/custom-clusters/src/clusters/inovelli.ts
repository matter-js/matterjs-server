/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { attribute, bool, cluster, uint32, writable } from "@matter/main/model";

@cluster(0x122ffc31)
export class InovelliCluster {
    @attribute(0x122f0061, uint32, writable)
    ledIndicatorIntensityOn?: number;

    @attribute(0x122f0062, uint32, writable)
    ledIndicatorIntensityOff?: number;

    @attribute(0x122f0106, bool, writable)
    clearNotificationWithConfigDoubleTap?: boolean;
}
