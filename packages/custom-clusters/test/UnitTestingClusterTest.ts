/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { Matter } from "@matter/main/model";
import "../src/register.js";

describe("CHIP UnitTesting cluster", () => {
    it("registers the writable attributes the controller certification suite uses", () => {
        const cluster = Matter.clusters.find(model => model.id === 0xfff1fc05);
        expect(cluster, "cluster 0xfff1fc05 is registered").to.exist;

        expect(
            [...(cluster?.attributes ?? [])]
                .filter(attribute => !attribute.isGlobal)
                .map(attribute => [attribute.id, attribute.name, attribute.effectiveMetatype, attribute.writable]),
        ).to.deep.equal([
            [0x17, "floatSingle", "float", true],
            [0x19, "octetString", "bytes", true],
            [0x25, "structAttr", "object", true],
            [0x2a, "listLongOctetString", "array", true],
        ]);
    });
});
