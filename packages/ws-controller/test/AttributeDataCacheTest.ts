/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeId } from "@matter/main";
import { LevelControlServer } from "@matter/main/behaviors/level-control";
import { DecodedAttributeReportValue } from "@matter/main/protocol";
import { AttributeId, ClusterId, EndpointNumber } from "@matter/main/types";
import { AttributeDataCache, AttributeSourceNode } from "../src/controller/AttributeDataCache.js";

const NODE_ID = NodeId(1);
const LEVEL_CONTROL = 8;
const CURRENT_LEVEL = 0;
const ON_OFF_TRANSITION_TIME = 16;

const path = (attributeId: number) => `1/${LEVEL_CONTROL}/${attributeId}`;

function nodeWithLevelControl(state: Record<string, unknown>): AttributeSourceNode {
    return {
        nodeId: NODE_ID,
        initialized: true,
        node: {
            lifecycle: { isCommissioned: true, isReady: true },
            endpoints: [{ number: 1, behaviors: { active: [LevelControlServer] }, stateOf: () => state }],
        },
    };
}

function report(attributeId: number, value: unknown): DecodedAttributeReportValue<any> {
    return {
        path: {
            endpointId: EndpointNumber(1),
            clusterId: ClusterId(LEVEL_CONTROL),
            attributeId: AttributeId(attributeId),
            attributeName: "test",
        },
        value,
        version: 1,
    };
}

describe("AttributeDataCache", () => {
    describe("updateAttribute", () => {
        it("removes an attribute reported as undefined", async () => {
            const cache = new AttributeDataCache();
            await cache.add(nodeWithLevelControl({ currentLevel: 5, onOffTransitionTime: 3 }));
            expect(cache.get(NODE_ID)![path(ON_OFF_TRANSITION_TIME)]).to.equal(3);

            expect(cache.updateAttribute(NODE_ID, report(ON_OFF_TRANSITION_TIME, undefined))).to.equal(false);

            expect(cache.get(NODE_ID)).not.to.have.property(path(ON_OFF_TRANSITION_TIME));
        });

        it("stores a value and reports it as visible", async () => {
            const cache = new AttributeDataCache();
            await cache.add(nodeWithLevelControl({ currentLevel: 5 }));

            expect(cache.updateAttribute(NODE_ID, report(CURRENT_LEVEL, 7))).to.equal(true);

            expect(cache.get(NODE_ID)![path(CURRENT_LEVEL)]).to.equal(7);
        });

        it("does not create a cache entry without a snapshot", () => {
            const cache = new AttributeDataCache();

            expect(cache.updateAttribute(NODE_ID, report(CURRENT_LEVEL, 7))).to.equal(true);
            expect(cache.updateAttribute(NODE_ID, report(ON_OFF_TRANSITION_TIME, undefined))).to.equal(false);

            expect(cache.has(NODE_ID)).to.equal(false);
        });

        it("replays a removal that arrives during a populate", async () => {
            const cache = new AttributeDataCache();
            const node = nodeWithLevelControl({ currentLevel: 5, onOffTransitionTime: 3 });
            const populate = cache.add(node);

            cache.updateAttribute(NODE_ID, report(ON_OFF_TRANSITION_TIME, undefined));
            await populate;

            expect(cache.get(NODE_ID)).not.to.have.property(path(ON_OFF_TRANSITION_TIME));
        });
    });
});
