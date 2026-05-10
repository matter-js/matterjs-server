/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Bytes } from "@matter/main";
import { attribute, bool, cluster, octstr, string, uint8, writable } from "@matter/main/model";

/**
 * TCL primary control/state cluster — Vendor ID 0x1334 (TCL).
 *
 * Found on TCL Matter dehumidifiers (e.g. H50D44W, H50D66KW). The CSA-registered
 * device type is Fan (0x002B), so dehumidifier-specific controls live here.
 *
 * Attribute IDs are local (0x00–0x06); the cluster decorator carries the vendor
 * prefix. Datatypes verified empirically against an H50D44W on firmware 1.0.
 */
@cluster(0x1334fc03)
export class TclDehumidifierCluster {
    /**
     * Operating mode. Integer values 0..4 observed on H50D44W firmware 1.0;
     * the symbolic mapping follows the order shown in the TCL Home mobile app:
     *
     * - `0` Set
     * - `1` Continue
     * - `2` Comfort
     * - `3` Smart
     * - `4` Dry
     *
     * Wire-encoded as `uint8` rather than `enum8` so the auto-generated Python
     * client surfaces this as `int` (`enum8` without a named-values map
     * generates `Optional[unknown]`); consumers translate the integer to a
     * symbolic name.
     */
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

    /** Filter-replacement / child-lock alert (semantics device-specific). */
    @attribute(0x0004, bool)
    filterAlert?: boolean;

    /**
     * Active error codes. The device emits a literal JSON-encoded string here
     * (e.g. `"[]"` or `"[3]"`), not a Matter list TLV — confirmed by reads on
     * H50D44W firmware 1.0. Treating the attribute as a string preserves what
     * the device actually puts on the wire; consumers are expected to JSON.parse
     * it if they want a numeric list.
     */
    @attribute(0x0005, string)
    errorCodes?: string;

    /**
     * Device feature set. Same format as {@link errorCodes} — a JSON-encoded
     * string, e.g. `"[3]"` (verified on H50D44W). Static across the device's
     * lifetime in observed captures.
     */
    @attribute(0x0006, string)
    featureSet?: string;
}

/**
 * TCL private/vendor cluster — Vendor ID 0x1334.
 *
 * Declared only because TCL devices include cluster `0x1334FC00` in their
 * Descriptor.ServerList — without a registered decoder, reads against any
 * attribute on this cluster fail with `UNSUPPORTED_CLUSTER`. The single
 * attribute at vendor-prefixed ID `0x1334E000` is exposed as opaque bytes.
 *
 * Contents and purpose are **unknown**; the attribute reads back empty on
 * devices commissioned without going through TCL Home. We surface it as
 * raw bytes rather than guessing a higher-level type — refine in a follow-up
 * if the format is ever identified.
 */
@cluster(0x1334fc00)
export class TclPrivateCluster {
    /** Opaque vendor blob; semantics unknown. May be empty. */
    @attribute(0xe000, octstr)
    opaque?: Bytes;
}
