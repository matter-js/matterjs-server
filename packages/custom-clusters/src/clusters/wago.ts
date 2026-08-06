/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { attribute, bool, cluster, uint8, writable } from "@matter/main/model";

@cluster(0x1534fc00)
export class WagoCluster {
    /**
     * Connection option: when true the local button input directly controls
     * the relay output ("Directly connected"), when false the button and
     * output are decoupled and only linked via Matter ("Matter only").
     */
    @attribute(0x00000000, bool, writable)
    directlyConnected?: boolean;

    /**
     * Bipolar/Unipolar switching: type of switch connected to the input.
     * 0 = button (momentary), 1 = switch (bistable).
     */
    @attribute(0x00000001, uint8, writable)
    switchType?: number;
}
