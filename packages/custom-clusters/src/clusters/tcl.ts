/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { attribute, bool, cluster, string, uint8, writable } from "@matter/main/model";

/**
 * TCL primary control/state cluster — Vendor ID 0x1334 (TCL).
 *
 * Found on TCL Matter dehumidifiers (e.g. H50D44W, H50D66KW).
 * The CSA-registered device type is Fan (0x002B), but the dehumidifier-specific
 * controls — target humidity, mode, bucket-full status — are exposed through
 * this vendor cluster.
 *
 * Attribute IDs are local (0x00–0x06); the cluster decorator carries the
 * vendor prefix.
 *
 * Mapping verified empirically against an H50D44W on firmware 1.0:
 * - Mode integer values are observed; the symbolic mapping (Set / Continue /
 *   Comfort / Smart / Dry) follows the order shown in the TCL Home app and
 *   is the consumer's responsibility to translate.
 */
@cluster(0x1334fc03)
export class TclDehumidifierCluster {
    /** Operating mode — 0=Set, 1=Continue, 2=Comfort, 3=Smart, 4=Dry. */
    @attribute(0x0000, uint8, writable)
    mode?: number;

    /** Target humidity setpoint in percent (typically 35..85). */
    @attribute(0x0001, uint8, writable)
    targetHumidity?: number;

    /** Currently measured ambient humidity in percent. */
    @attribute(0x0002, uint8)
    currentHumidity?: number;

    /** True when the water bucket needs to be emptied. */
    @attribute(0x0003, bool)
    waterBucketFull?: boolean;

    /** Filter / child-lock alert (semantics device-specific). */
    @attribute(0x0004, bool)
    filterAlert?: boolean;

    /** Active error codes as a JSON-encoded list, e.g. "[]" or "[3]". */
    @attribute(0x0005, string)
    errorCodes?: string;

    /** Supported feature set as a JSON-encoded list, e.g. "[3]". */
    @attribute(0x0006, string)
    featureSet?: string;
}

/**
 * TCL private/identification cluster — Vendor ID 0x1334.
 *
 * Holds an opaque vendor-prefixed string attribute that is populated by
 * the TCL Home app at first commissioning. Empty on devices commissioned
 * directly without going through TCL Home.
 */
@cluster(0x1334fc00)
export class TclPrivateCluster {
    /** Opaque vendor blob. May be empty. */
    @attribute(0xe000, string)
    opaque?: string;
}
