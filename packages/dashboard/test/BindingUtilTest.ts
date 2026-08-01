/**
 * @license
 * Copyright 2025-2026 Open Home Foundation
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatterNode, type MatterNodeData } from "@matter-server/ws-client";
import type { BindingEntryStruct } from "../src/components/dialogs/binding/model.js";
import {
    bindableClusters,
    boundClientClusterIds,
    readAllBindings,
    readBindings,
    readOurBindings,
    sameBindingTarget,
    reverseAclState,
    sourceClientClusters,
    targetAclCapacityForBinding,
    targetServerClusters,
} from "../src/util/binding.js";

function node(attributes: Record<string, unknown>, node_id: number | bigint = 1): MatterNode {
    const data: MatterNodeData = {
        node_id,
        date_commissioned: "",
        last_interview: "",
        interview_version: 1,
        available: true,
        is_bridge: false,
        attributes,
        attribute_subscriptions: [],
    };
    return new MatterNode(data);
}

function binding(p: Partial<BindingEntryStruct>): BindingEntryStruct {
    return { node: 2, group: undefined, endpoint: 1, cluster: 6, fabricIndex: 1, ...p };
}

describe("binding util", () => {
    it("readBindings / readAllBindings parse the binding attribute", () => {
        const n = node({ "1/30/0": [{ "1": 5, "3": 1, "4": 6 }], "2/30/0": [{ "1": 9, "3": 1 }] });
        expect(readBindings(n, 1)).to.have.length(1);
        const all = readAllBindings(n);
        expect(all.map(b => b.endpoint).sort()).to.deep.equal([1, 2]);
    });

    it("treats null binding fields as unset, not 0", () => {
        const n = node({ "1/30/0": [{ "1": 5, "3": 1, "4": null }] });
        const [b] = readBindings(n, 1);
        expect(b.node).to.equal(5);
        expect(b.endpoint).to.equal(1);
        expect(b.cluster).to.equal(undefined);
    });

    it("source/target cluster lists read Descriptor ClientList/ServerList", () => {
        const n = node({ "1/29/1": [6, 8, 29], "1/29/2": [6, 768] });
        expect(targetServerClusters(n, 1)).to.deep.equal([6, 8, 29]);
        expect(sourceClientClusters(n, 1)).to.deep.equal([6, 768]);
    });

    it("bindableClusters splits intersection vs other-target", () => {
        const source = node({ "1/29/2": [6, 768] }, 1);
        const target = node({ "1/29/1": [6, 8, 768] }, 2);
        const result = bindableClusters(source, 1, target, 1);
        expect(result.bindable.sort()).to.deep.equal([6, 768]);
        expect(result.otherTarget).to.deep.equal([8]);
    });

    it("readAllBindings keeps only our fabric's entries once the fabric index is known", () => {
        const attributes = {
            "1/30/0": [{ "1": 2, "3": 1, "4": 6, "254": 1 }],
            "2/30/0": [{ "1": 3, "3": 1, "4": 8, "254": 2 }],
        };
        expect(readAllBindings(node({ ...attributes, "0/62/5": 1 })).map(b => b.endpoint)).to.deep.equal([1]);
        expect(readAllBindings(node(attributes)).map(b => b.endpoint)).to.deep.equal([1, 2]);
    });

    it("readOurBindings keeps only our fabric's entries, or all while the fabric index is unknown", () => {
        const attributes = {
            "1/30/0": [
                { "1": 2, "3": 1, "4": 6, "254": 1 },
                { "1": 3, "3": 1, "4": 8, "254": 2 },
            ],
        };
        expect(readOurBindings(node({ ...attributes, "0/62/5": 1 }), 1).map(b => b.cluster)).to.deep.equal([6]);
        expect(readOurBindings(node(attributes), 1).map(b => b.cluster)).to.deep.equal([6, 8]);
    });

    it("sameBindingTarget compares the target fields, normalizing node id types", () => {
        const unicast = binding({ node: 2, group: undefined, endpoint: 1, cluster: 6 });
        expect(sameBindingTarget(unicast, binding({ node: BigInt(2), group: undefined, endpoint: 1, cluster: 6 }))).to
            .be.true;
        // fabricIndex is not part of the target identity.
        expect(sameBindingTarget(unicast, { ...unicast, fabricIndex: 9 })).to.be.true;
        expect(sameBindingTarget(unicast, { ...unicast, cluster: 8 })).to.be.false;
        expect(sameBindingTarget(unicast, { ...unicast, endpoint: 2 })).to.be.false;
        expect(sameBindingTarget(unicast, { ...unicast, node: 3 })).to.be.false;
        // A whole-endpoint entry (no cluster) is not the same target as a cluster-specific one.
        expect(sameBindingTarget(unicast, { ...unicast, cluster: undefined })).to.be.false;
        // A group binding never matches a unicast one, even with the same endpoint/cluster.
        const group = binding({ node: undefined, group: 5, endpoint: undefined, cluster: 6 });
        expect(sameBindingTarget(group, { ...group })).to.be.true;
        expect(sameBindingTarget(group, unicast)).to.be.false;
        // undefined and 0 are different targets — 0 is a legal group id.
        expect(sameBindingTarget(group, { ...group, group: 0 })).to.be.false;
    });

    it("boundClientClusterIds collects the clusters covered by existing binding entries", () => {
        const n = node({ "0/62/5": 1, "1/29/2": [6, 768], "1/30/0": [{ "1": 2, "3": 1, "4": 6, "254": 1 }] });
        expect([...boundClientClusterIds(n, 1)]).to.deep.equal([6]);
    });

    it("boundClientClusterIds returns an empty set when the endpoint has no bindings", () => {
        const n = node({ "0/62/5": 1, "1/29/2": [6, 768] });
        expect(boundClientClusterIds(n, 1).size).to.equal(0);
    });

    it("boundClientClusterIds ignores entries belonging to another fabric", () => {
        const n = node({
            "0/62/5": 1,
            "1/29/2": [6, 768],
            "1/30/0": [
                { "1": 2, "3": 1, "4": 6, "254": 1 },
                { "1": 3, "3": 1, "4": 768, "254": 2 },
            ],
        });
        expect([...boundClientClusterIds(n, 1)]).to.deep.equal([6]);
        const foreignWildcard = node({
            "0/62/5": 1,
            "1/29/2": [6, 768],
            "1/30/0": [{ "1": 3, "3": 1, "254": 2 }],
        });
        expect(boundClientClusterIds(foreignWildcard, 1).size).to.equal(0);
    });

    it("boundClientClusterIds treats a cluster-less entry as covering every client cluster", () => {
        // Whole-endpoint unicast binding: Node + Endpoint, no Cluster.
        const wholeEndpoint = node({ "0/62/5": 1, "1/29/2": [6, 768], "1/30/0": [{ "1": 2, "3": 1, "254": 1 }] });
        expect([...boundClientClusterIds(wholeEndpoint, 1)].sort((a, b) => a - b)).to.deep.equal([6, 768]);
        // Group binding: Group only, no Cluster.
        const groupBinding = node({ "0/62/5": 1, "1/29/2": [6, 768], "1/30/0": [{ "2": 5, "254": 1 }] });
        expect([...boundClientClusterIds(groupBinding, 1)].sort((a, b) => a - b)).to.deep.equal([6, 768]);
    });

    it("boundClientClusterIds keeps cluster-specific entries alongside a cluster-less one", () => {
        // 8 is bound but absent from the ClientList, so the wildcard expansion must not replace it.
        const n = node({
            "0/62/5": 1,
            "1/29/2": [6, 768],
            "1/30/0": [
                { "1": 2, "3": 1, "4": 8, "254": 1 },
                { "1": 2, "3": 1, "254": 1 },
            ],
        });
        expect([...boundClientClusterIds(n, 1)].sort((a, b) => a - b)).to.deep.equal([6, 8, 768]);
    });

    it("boundClientClusterIds does not expand an entry that targets nothing", () => {
        const n = node({ "0/62/5": 1, "1/29/2": [6, 768], "1/30/0": [{ "254": 1 }] });
        expect(boundClientClusterIds(n, 1).size).to.equal(0);
    });

    it("boundClientClusterIds only looks at the requested endpoint", () => {
        const n = node({
            "0/62/5": 1,
            "1/29/2": [6, 768],
            "1/30/0": [{ "1": 2, "3": 1, "4": 6, "254": 1 }],
            "2/30/0": [{ "1": 2, "3": 1, "4": 768, "254": 1 }],
        });
        expect([...boundClientClusterIds(n, 1)]).to.deep.equal([6]);
    });

    it("reverseAclState returns present/missing/overPrivileged/cannotVerify", () => {
        const target = node(
            { "0/62/5": 1, "0/31/0": [{ "1": 3, "2": 2, "3": [1], "4": [{ "0": 6, "1": 1 }], "254": 1 }] },
            2,
        );
        expect(reverseAclState(1, binding({ cluster: 6 }), target).state).to.equal("present");
        expect(reverseAclState(1, binding({ cluster: 8 }), target).state).to.equal("missing");
        expect(reverseAclState(1, binding({ cluster: 8 }), undefined).state).to.equal("cannotVerify");
        const overTarget = node(
            { "0/62/5": 1, "0/31/0": [{ "1": 5, "2": 2, "3": [1], "4": [{ "0": 6, "1": 1 }], "254": 1 }] },
            2,
        );
        expect(reverseAclState(1, binding({ cluster: 6 }), overTarget).state).to.equal("overPrivileged");
        // Self-binding (binding target == source) needs no ACL.
        expect(reverseAclState(7, binding({ node: 7 }), node({}, 7)).state).to.equal("self");
    });

    it("targetAclCapacityForBinding treats a self-binding as free (no ACL needed)", () => {
        const self = node({ "0/62/5": 1, "0/31/4": 1, "0/31/0": [{ "1": 5, "2": 2, "3": [99], "254": 1 }] }, 7);
        expect(targetAclCapacityForBinding(self, 7).canAdd).to.equal(true);
    });

    it("targetAclCapacityForBinding gates on the node's CurrentFabricIndex (0/62/5) and reusable room", () => {
        // Our fabric index on the device is 1. Full (max 1) with a non-reusable entry → cannot add.
        const full = node(
            { "0/62/5": 1, "0/31/4": 1, "0/31/0": [{ "1": 3, "2": 2, "3": [9], "4": undefined, "254": 1 }] },
            2,
        );
        expect(targetAclCapacityForBinding(full, 1).canAdd).to.equal(false);
        // The only entry belongs to another fabric (254=2 ≠ our 0/62/5=1) → doesn't count → can add.
        const foreignOnly = node(
            { "0/62/5": 1, "0/31/4": 1, "0/31/0": [{ "1": 3, "2": 2, "3": [9], "4": undefined, "254": 2 }] },
            2,
        );
        expect(targetAclCapacityForBinding(foreignOnly, 1).canAdd).to.equal(true);
        // Our fabric already has a whole-node Operate entry for the source → reusable, can add.
        const reusable = node(
            { "0/62/5": 1, "0/31/4": 1, "0/31/0": [{ "1": 3, "2": 2, "3": [1], "4": undefined, "254": 1 }] },
            2,
        );
        expect(targetAclCapacityForBinding(reusable, 1).canAdd).to.equal(true);
        // CurrentFabricIndex not cached → advisory gate does not block (write path validates).
        const noFabric = node({ "0/31/4": 1, "0/31/0": [{ "1": 3, "2": 2, "3": [9], "4": undefined, "254": 1 }] }, 2);
        expect(targetAclCapacityForBinding(noFabric, 1).canAdd).to.equal(true);
    });
});
