/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { clusters, type ClusterFeatureDescription } from "../src/client/models/descriptions.js";
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

describe("generated cluster feature bits", () => {
    it("preserves the reserved-bit gap in the Thermostat feature table", () => {
        const bitsByCode = Object.fromEntries(Object.values(clusters[0x201].features).map(f => [f.code, f.bit]));
        expect(bitsByCode).to.include({
            HEAT: 0,
            COOL: 1,
            OCC: 2,
            SB: 4,
            AUTO: 5,
            LTNE: 6,
            MSCH: 7,
            PRES: 8,
            TEVT: 9,
            TSUGGEST: 10,
        });
    });

    it("keeps a lone high feature bit at its spec position", () => {
        expect(clusters[0x39].features["20"]).to.deep.equal({
            bit: 20,
            code: "BIS",
            label: "Bridged Icd Support",
        });
    });

    it("decodes a real Thermostat FeatureMap against the generated table", () => {
        const active = computeActiveClusterFeatures(1955, Object.values(clusters[0x201].features));
        expect(active.map(f => f.code)).to.deep.equal(["HEAT", "COOL", "AUTO", "MSCH", "PRES", "TEVT", "TSUGGEST"]);
    });
});

describe("generated attribute types", () => {
    it("resolves a type for every attribute", () => {
        const unresolved = Object.values(clusters).flatMap(cluster =>
            Object.values(cluster.attributes)
                .filter(attribute => attribute.type?.includes("unknown"))
                .map(attribute => `${cluster.label}.${attribute.label}`),
        );
        expect(unresolved).to.deep.equal([]);
    });

    it("takes the type of a custom cluster attribute from its datatype", () => {
        expect(clusters[0x120bfc01].attributes[0x1004].type).to.equal("Optional[uint8]");
    });

    it("takes the type of a derived cluster attribute from its base cluster", () => {
        expect(clusters[0x54].attributes[0x01].type).to.equal("uint8");
        expect(clusters[0x54].attributes[0x00].type).to.equal("List[ModeOptionStruct]");
    });

    it("keeps the label of a deprecated attribute that has no type", () => {
        expect(clusters[0x101].attributes[0x34]).to.deep.equal({
            id: 0x34,
            cluster_id: 0x101,
            label: "SecurityLevel",
            writable: false,
        });
    });
});
