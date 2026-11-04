/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Matter } from "@matter/main/model";
import "../src/register.js";

describe("Linky (LiXee ZLinky) cluster", () => {
    it("registers the raw TIC attributes with periodicSend as the only writable one", () => {
        const cluster = Matter.clusters.find(model => model.id === 0xfff1fc01);
        expect(cluster, "cluster 0xfff1fc01 is registered").to.exist;

        const attributes = [...(cluster?.attributes ?? [])].filter(attribute => !attribute.isGlobal);
        expect(attributes.map(attribute => [attribute.id, attribute.name])).to.deep.equal([
            [0xfff10000, "optarif"],
            [0xfff10001, "demain"],
            [0xfff10002, "hhphc"],
            [0xfff10003, "ppot"],
            [0xfff10004, "pejp"],
            [0xfff10005, "adps"],
            [0xfff10006, "adir1"],
            [0xfff10007, "adir2"],
            [0xfff10008, "adir3"],
            [0xfff10009, "motdetat"],
            [0xfff10010, "tarifPeriod"],
            [0xfff10100, "periodicSend"],
            [0xfff10300, "mode"],
            [0xfff10200, "ltarf"],
            [0xfff10201, "ntarf"],
            [0xfff10202, "date"],
            [0xfff10225, "njourf"],
            [0xfff10226, "njourf1"],
            [0xfff10227, "pjourf1"],
            [0xfff10228, "ppointe"],
            [0xfff10218, "dpm1"],
            [0xfff10219, "fpm1"],
            [0xfff10220, "dpm2"],
            [0xfff10221, "fpm2"],
            [0xfff10222, "dpm3"],
            [0xfff10223, "fpm3"],
            [0xfff10203, "easd01"],
            [0xfff10204, "easd02"],
            [0xfff10205, "easd03"],
            [0xfff10206, "easd04"],
            [0xfff10207, "sinsti"],
            [0xfff10208, "smaxin"],
            [0xfff10209, "smaxin1"],
            [0xfff10210, "ccain"],
            [0xfff10211, "ccain1"],
            [0xfff10212, "smaxsn11"],
            [0xfff10213, "smaxsn21"],
            [0xfff10214, "smaxsn31"],
            [0xfff10400, "smaxsn1"],
            [0xfff10215, "msg1"],
            [0xfff10216, "msg2"],
            [0xfff10217, "stge"],
            [0xfff10224, "relais"],
        ]);

        const writable = attributes.filter(attribute => attribute.writable).map(attribute => attribute.id);
        expect(writable).to.deep.equal([0xfff10100]);
    });

    it("types the raw frame state word as an octet string", () => {
        const cluster = Matter.clusters.find(model => model.id === 0xfff1fc01);
        const stge = [...(cluster?.attributes ?? [])].find(attribute => attribute.name === "stge");
        expect(stge?.effectiveMetatype).to.equal("bytes");
    });
});
