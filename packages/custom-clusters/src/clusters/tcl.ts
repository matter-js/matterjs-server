/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { attribute, bool, cluster, enum8, string, uint8, writable } from "@matter/main/model";

/**
 * Operating modes for {@link TclDehumidifierCluster.mode}. Integer values
 * 0..4 are observed on H50D44W firmware 1.0; the symbolic names follow the
 * order shown in the TCL Home mobile app.
 *
 * Declared as a `const enum` so the wire encoding stays a plain 8-bit value
 * and the symbolic mapping is captured alongside the cluster.
 */
const enum TclMode {
    Set = 0,
    Continue = 1,
    Comfort = 2,
    Smart = 3,
    Dry = 4,
}

/**
 * TCL primary control/state cluster — Vendor ID 0x1334 (TCL).
 *
 * Found on TCL Matter dehumidifiers (e.g. H50D44W, H50D66KW). The CSA-registered
 * device type is Fan (0x002B), so the dehumidifier-specific controls are
 * exposed through this vendor cluster.
 *
 * Attribute IDs are local (0x00–0x06); the cluster decorator carries the vendor
 * prefix. Datatypes verified empirically against an H50D44W on firmware 1.0.
 */
@cluster(0x1334fc03)
export class TclDehumidifierCluster {
    /** Operating mode — see {@link TclMode} for the value mapping. */
    @attribute(0x0000, enum8, writable)
    mode?: TclMode;

    /** Target humidity setpoint in percent (typically 35..85). */
    @attribute(0x0001, uint8, writable)
    targetHumidity?: number;

    /** Currently measured ambient humidity in percent. */
    @attribute(0x0002, uint8)
    currentHumidity?: number;

    /** True when the water bucket needs to be emptied. */
    @attribute(0x0003, bool)
    waterBucketFull?: boolean;

    /** Filter-replacement / child-lock alert (semantics device-specific). */
    @attribute(0x0004, bool)
    filterAlert?: boolean;

    /**
     * Active error codes. The device emits a literal JSON-encoded string here
     * (e.g. `"[]"` or `"[5]"`), not a Matter list TLV — confirmed by reads on
     * H50D44W firmware 1.0. Treating the attribute as a string preserves what
     * the device actually puts on the wire; consumers JSON-parse it if they
     * want a numeric list.
     *
     * Empirically verified code semantics on H50D44W firmware 1.0:
     *
     * - `5` — water bucket full. Verified 2026-05-11 by cycling the bucket
     *   and watching this attribute toggle `"[]"` ↔ `"[5]"`. The dedicated
     *   {@link waterBucketFull} bool (attr 3) does **not** flip on this
     *   device, so code 5 is the only reliable bucket-full signal.
     *
     * Other codes will likely surface over time (filter alert, defrost,
     * sensor fault, …); document them here as they're identified.
     */
    @attribute(0x0005, string)
    errorCodes?: string;

    /**
     * Device feature set. Same wire format as {@link errorCodes} — a JSON-
     * encoded string, e.g. `"[3]"` (verified on H50D44W). Static across the
     * device's lifetime in observed captures.
     */
    @attribute(0x0006, string)
    featureSet?: string;
}
