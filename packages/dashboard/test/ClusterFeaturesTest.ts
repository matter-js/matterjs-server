/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ClusterFeatureDescription } from "../src/client/models/descriptions.js";
import { computeActiveClusterFeatures } from "../src/util/cluster-features.js";

// CameraAvStreamManagement's real feature set (spec §11.2.4), used in the FeatureMap=39 case below.
const AVSM_FEATURES: ClusterFeatureDescription[] = [
    { bit: 0, code: "ADO", label: "Audio" },
    { bit: 1, code: "VDO", label: "Video" },
    { bit: 2, code: "SNP", label: "Snapshot" },
    { bit: 3, code: "PRIV", label: "Privacy" },
    { bit: 4, code: "SPKR", label: "Speaker" },
    { bit: 5, code: "ICTL", label: "Image Control" },
    { bit: 6, code: "WMARK", label: "Watermark" },
    { bit: 7, code: "OSD", label: "On Screen Display" },
];

describe("computeActiveClusterFeatures", () => {
    it("decodes only the bits set in the FeatureMap", () => {
        // 39 = 0b100111 = bits 0, 1, 2, 5
        const active = computeActiveClusterFeatures(39, AVSM_FEATURES);
        expect(active.map(f => f.code)).to.deep.equal(["ADO", "VDO", "SNP", "ICTL"]);
    });

    it("returns an empty list when no optional feature bits are set", () => {
        expect(computeActiveClusterFeatures(0, AVSM_FEATURES)).to.deep.equal([]);
    });

    it("returns an empty list when the FeatureMap attribute hasn't been read yet", () => {
        expect(computeActiveClusterFeatures(undefined, AVSM_FEATURES)).to.deep.equal([]);
    });

    it("sorts active features by bit position regardless of input order", () => {
        const shuffled = [AVSM_FEATURES[5], AVSM_FEATURES[0], AVSM_FEATURES[2]];
        const active = computeActiveClusterFeatures(0b100101, shuffled);
        expect(active.map(f => f.bit)).to.deep.equal([0, 2, 5]);
    });

    it("coerces bigint FeatureMap values", () => {
        const active = computeActiveClusterFeatures(16n, AVSM_FEATURES);
        expect(active.map(f => f.code)).to.deep.equal(["SPKR"]);
    });
});
