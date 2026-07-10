/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeId } from "@matter/main";
import type { DecodedAttributeReportValue } from "@project-chip/matter.js/cluster";
import type { PairedNode } from "@project-chip/matter.js/device";
import { AttributeDataCache } from "../src/controller/AttributeDataCache.js";
import { ClusterMap } from "../src/model/ModelMapper.js";
import { buildAttributePath } from "../src/server/Converters.js";

const NODE_ID = NodeId(1);

// WindowCovering.ConfigStatus (attribute 7) is a real bitmap-typed attribute. Setting one of its bit
// fields to a string makes the real converter throw ("Invalid bitmap value") — this exercises the
// guard against the actual conversion code path instead of an injected fake.
const WINDOW_COVERING_CLUSTER_ID = 258;
const CONFIG_STATUS_ATTRIBUTE_ID = 7;
const ENDPOINT_ID = 0;
const PATH = buildAttributePath(ENDPOINT_ID, WINDOW_COVERING_CLUSTER_ID, CONFIG_STATUS_ATTRIBUTE_ID);

function attributeReport(value: unknown): DecodedAttributeReportValue<any> {
    return {
        path: {
            endpointId: ENDPOINT_ID,
            clusterId: WINDOW_COVERING_CLUSTER_ID,
            attributeId: CONFIG_STATUS_ATTRIBUTE_ID,
            attributeName: "ConfigStatus",
        },
        version: 1,
        value,
    } as DecodedAttributeReportValue<any>;
}

/** Minimal PairedNode stand-in: no endpoints, so #collectAttributes seeds an empty cached snapshot. */
function makeFakeNode(nodeId: NodeId): PairedNode {
    return {
        nodeId,
        initialized: true,
        node: {
            lifecycle: { isCommissioned: true, isReady: true },
            endpoints: [],
        },
    } as unknown as PairedNode;
}

describe("AttributeDataCache", () => {
    it("sanity: WindowCovering.ConfigStatus is wired up as a real bitmap attribute", () => {
        const entry = ClusterMap[WINDOW_COVERING_CLUSTER_ID];
        expect(entry).to.not.equal(undefined);
        expect(entry?.attributes[CONFIG_STATUS_ATTRIBUTE_ID]?.name).to.equal("ConfigStatus");
    });

    describe("updateAttribute", () => {
        it("does not throw when the converter rejects the value, and leaves the cache unchanged", async () => {
            const cache = new AttributeDataCache();
            await cache.add(makeFakeNode(NODE_ID));
            expect(cache.has(NODE_ID)).to.equal(true);
            const before = { ...cache.get(NODE_ID) };

            expect(() => cache.updateAttribute(NODE_ID, attributeReport({ operational: "poison" }))).to.not.throw();

            expect(cache.get(NODE_ID)).to.deep.equal(before);
        });

        it("still applies a subsequent good update after a rejected one", async () => {
            const cache = new AttributeDataCache();
            await cache.add(makeFakeNode(NODE_ID));

            cache.updateAttribute(NODE_ID, attributeReport({ operational: "poison" })); // rejected, ignored
            cache.updateAttribute(NODE_ID, attributeReport({})); // no bit set -> valid, converts to 0

            expect(cache.get(NODE_ID)?.[PATH]).to.equal(0);
        });
    });
});
