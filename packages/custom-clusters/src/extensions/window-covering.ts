/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { WindowCovering } from "@matter/main/clusters/window-covering";
import { clusterExtension } from "./extension.js";

/**
 * Manufacturer-specific extensions of all vendors to the standard Window Covering cluster.
 *
 * WAGO (vendor ID 0x1534/5428), as found on the WAGO Home Blind Control (2757-1105/2757-1106): the travel times
 * correspond to the reference times used for positioning the covering. The device re-measures them on every full
 * end-to-end travel, so their values may change without an explicit write.
 */
clusterExtension(WindowCovering.id, [
    {
        id: 0x15340001,
        name: "WagoTravelTimeUp",
        type: "uint32",
        access: "RW VM",
        details: "Travel time from the fully closed to the fully open position, in units of 10 ms.",
    },
    {
        id: 0x15340002,
        name: "WagoTravelTimeDown",
        type: "uint32",
        access: "RW VM",
        details: "Travel time from the fully open to the fully closed position, in units of 10 ms.",
    },
    {
        id: 0x15340003,
        name: "WagoSlatRotationTime",
        type: "uint32",
        access: "RW VM",
        details: "Time for a full slat rotation, in milliseconds.",
    },
]);
