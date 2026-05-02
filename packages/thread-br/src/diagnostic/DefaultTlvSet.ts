/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { NetworkDiagTlvType } from "../tlv/networkDiagTlvTypes.js";

/** Default diagnostic TLV set (spec §4.9) for topology + per-node identity. */
export const DefaultTlvSet: ReadonlyArray<number> = [
    NetworkDiagTlvType.EXT_MAC_ADDRESS,
    NetworkDiagTlvType.ADDRESS16,
    NetworkDiagTlvType.MODE,
    NetworkDiagTlvType.CONNECTIVITY,
    NetworkDiagTlvType.ROUTE64,
    NetworkDiagTlvType.LEADER_DATA,
    NetworkDiagTlvType.IPV6_ADDRESS_LIST,
    NetworkDiagTlvType.CHILD_TABLE,
    NetworkDiagTlvType.VERSION,
    NetworkDiagTlvType.VENDOR_NAME,
    NetworkDiagTlvType.VENDOR_MODEL,
    NetworkDiagTlvType.VENDOR_SW_VERSION,
];
