/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChildTableEntry } from "../tlv/diag/ChildTable.js";
import type { Connectivity } from "../tlv/diag/Connectivity.js";
import type { LeaderData } from "../tlv/diag/LeaderData.js";
import type { MacCounters } from "../tlv/diag/MacCounters.js";
import type { MleCounters } from "../tlv/diag/MleCounters.js";
import type { Mode } from "../tlv/diag/Mode.js";
import type { Route64 } from "../tlv/diag/Route64.js";

export interface DiagnosticResponse {
    extMacAddress?: Uint8Array;
    rloc16?: number;
    mode?: Mode;
    timeout?: number;
    connectivity?: Connectivity;
    route64?: Route64;
    leaderData?: LeaderData;
    networkData?: Uint8Array;
    ipv6Addresses?: Uint8Array[];
    macCounters?: MacCounters;
    batteryLevel?: number;
    supplyVoltage?: number;
    childTable?: ChildTableEntry[];
    channelPages?: number[];
    maxChildTimeout?: number;
    eui64?: Uint8Array;
    version?: number;
    vendorName?: string;
    vendorModel?: string;
    vendorSwVersion?: string;
    threadStackVersion?: string;
    vendorAppUrl?: string;
    mleCounters?: MleCounters;
    unknown: Array<{ type: number; value: Uint8Array }>;
}
