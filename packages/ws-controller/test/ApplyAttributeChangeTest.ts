/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeId } from "@matter/main";
import { AttributeList } from "@matter/main/model";
import { AttributeId, ClusterId, EndpointNumber } from "@matter/main/types";
import { applyAttributeChange } from "../src/controller/applyAttributeChange.js";
import type { AttributeChange } from "../src/controller/PeerChangeBus.js";

const NODE_ID = NodeId(1);

function change(clusterId: number, attributeId: number, value: unknown): AttributeChange {
    return {
        path: { endpointId: EndpointNumber(1), clusterId: ClusterId(clusterId), attributeId: AttributeId(attributeId) },
        value,
    };
}

function apply(data: AttributeChange, removed: boolean) {
    const emitted = new Array<AttributeChange>();
    const reasons = new Array<string>();
    applyAttributeChange(NODE_ID, data, {
        cache: { updateAttribute: () => removed },
        emit: (_nodeId, emittedChange) => emitted.push(emittedChange),
        markNodeUpdatePending: reason => reasons.push(reason),
    });
    return { emitted, reasons };
}

describe("applyAttributeChange", () => {
    it("emits a removal of a cached attribute and requests a node refresh", () => {
        const removal = change(6, 0, undefined);

        const { emitted, reasons } = apply(removal, true);

        expect(emitted).to.deep.equal([removal]);
        expect(reasons).to.deep.equal(["attribute removed"]);
    });

    it("requests no refresh for a removal the cache did not hold", () => {
        const { emitted, reasons } = apply(change(6, 0, undefined), false);

        expect(emitted.length).to.equal(1);
        expect(reasons).to.deep.equal([]);
    });

    it("requests a refresh for an attribute that describes the node structure", () => {
        const { reasons } = apply(change(6, AttributeList.id, [0]), false);

        expect(reasons).to.deep.equal(["cluster capabilities changed"]);
    });

    it("names the removal as the reason when the cache dropped a structure attribute", () => {
        const { reasons } = apply(change(6, AttributeList.id, undefined), true);

        expect(reasons).to.deep.equal(["attribute removed"]);
    });

    it("requests a refresh for a structure attribute removal the cache did not hold", () => {
        const { reasons } = apply(change(6, AttributeList.id, undefined), false);

        expect(reasons).to.deep.equal(["cluster capabilities changed"]);
    });

    it("emits a value change without a refresh", () => {
        const update = change(6, 0, true);

        const { emitted, reasons } = apply(update, false);

        expect(emitted).to.deep.equal([update]);
        expect(reasons).to.deep.equal([]);
    });
});
